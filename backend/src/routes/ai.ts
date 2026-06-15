import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const router = express.Router();
const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GEMINI_KEYS = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await db.auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  return user;
}

async function resolveOwner(user: any) {
  const { data: ownerRow } = await db.from('owners')
    .select('id_owner, nombre_empresa, email_contacto')
    .eq('id_owner', user.id).maybeSingle();

  let ownerIds: string[];
  let hotelIds: string[] = [];
  let finalOwnerRow = ownerRow;

  if (ownerRow) {
    ownerIds = [ownerRow.id_owner];
  } else {
    const { data: roles } = await db.from('usuarios_roles')
      .select('owner_id, id_hotel').eq('user_id', user.id).eq('estado', 'activo');
    ownerIds = [...new Set((roles || []).map((r: any) => r.owner_id).filter(Boolean))] as string[];
    hotelIds = [...new Set((roles || []).map((r: any) => r.id_hotel).filter(Boolean))] as string[];
    const { data: staffOwner } = await db.from('owners')
      .select('id_owner, nombre_empresa, email_contacto').eq('id_owner', ownerIds[0]).maybeSingle();
    finalOwnerRow = staffOwner ?? null;
  }

  const { data: mods } = ownerIds.length
    ? await db.from('business_modules').select('id_module').in('owner_id', ownerIds)
    : { data: [] as any[] };
  const moduleIds = (mods || []).map((m: any) => m.id_module);

  let gymIds: string[] = [];
  let restaurantIds: string[] = [];
  if (moduleIds.length > 0) {
    if (ownerRow) {
      const { data: h } = await db.from('hoteles').select('id_hotel').in('id_module', moduleIds);
      hotelIds = (h || []).map((x: any) => x.id_hotel);
    }
    const { data: g } = await db.from('gimnasios').select('id_gimnasio').in('id_module', moduleIds);
    gymIds = (g || []).map((x: any) => x.id_gimnasio);
    const { data: r } = await db.from('restaurant').select('id_restaurant').in('id_module', moduleIds);
    restaurantIds = (r || []).map((x: any) => x.id_restaurant);
  }

  return { ownerRow: finalOwnerRow, ownerIds, hotelIds, gymIds, restaurantIds };
}

// ─── Herramientas ─────────────────────────────────────────────────────────────
async function executeTool(name: string, args: any, ownerIds: string[], hotelIds: string[], gymIds: string[], restaurantIds: string[]): Promise<any> {
  switch (name) {

    case 'get_businesses': {
      const { data: modules } = await db.from('business_modules')
        .select('id_module, tipo_modulo, nombre_modulo, estado').in('owner_id', ownerIds);
      const moduleIds = (modules || []).map((m: any) => m.id_module);
      let hoteles: any[] = [], gimnasios: any[] = [], restaurantes: any[] = [];
      if (moduleIds.length > 0) {
        const [h, g, r] = await Promise.all([
          db.from('hoteles').select('id_hotel, nombre_hotel, estado, id_module, slug, ciudad').in('id_module', moduleIds),
          db.from('gimnasios').select('id_gimnasio, nombre_gimnasio, estado, id_module, ciudad').in('id_module', moduleIds),
          db.from('restaurant').select('id_restaurant, nombre_restaurante, activo, id_module, ciudad').in('id_module', moduleIds),
        ]);
        hoteles = h.data || [];
        gimnasios = g.data || [];
        restaurantes = r.data || [];
      }
      return { modules, hoteles, gimnasios, restaurantes };
    }

    case 'get_hotel_info': {
      const { data: hotel } = await db.from('hoteles').select('*').eq('id_hotel', args.hotel_id).maybeSingle();
      const { data: cfg } = await db.from('configuracion_hotelera').select('*').eq('id_hotel', args.hotel_id).maybeSingle();
      const { data: rooms } = await db.from('habitaciones').select('id_habitacion, estado, nombre_habitacion, tarifa_noche').eq('id_hotel', args.hotel_id);
      return { hotel, config: cfg, rooms };
    }

    case 'get_reservations': {
      let q = db.from('reservas_hotel')
        .select(`id_reserva_hotel, estado, estado_pago, total_reserva, moneda,
          check_in, check_out, adultos, ninos, observaciones, created_at,
          huespedes(nombre_completo, correo, telefono),
          habitaciones(nombre_habitacion, nombre_alias)`)
        .eq('id_hotel', args.hotel_id)
        .order('created_at', { ascending: false })
        .limit(args.limit || 100);
      if (args.estado) q = q.eq('estado', args.estado);
      if (args.fecha_desde) q = q.gte('check_in', args.fecha_desde);
      if (args.fecha_hasta) q = q.lte('check_in', args.fecha_hasta);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { reservations: data, count: data?.length };
    }

    case 'get_rooms': {
      const { data, error } = await db.from('habitaciones_con_detalles')
        .select('*').eq('id_hotel', args.hotel_id).order('nombre_habitacion');
      if (error) throw new Error(error.message);
      return { rooms: data };
    }

    case 'get_guests': {
      let q = db.from('huespedes')
        .select('id_huesped, nombre_completo, correo, telefono, documento_identidad, estado, created_at')
        .eq('id_hotel', args.hotel_id).order('created_at', { ascending: false }).limit(args.limit || 20);
      if (args.busqueda) q = q.or(`nombre_completo.ilike.%${args.busqueda}%,correo.ilike.%${args.busqueda}%`);
      const { data, error } = await (q as any).limit(args.limit || 100);
      if (error) throw new Error(error.message);
      return { guests: data };
    }

    case 'get_payments': {
      const { data, error } = await db.from('pagos_hotel')
        .select('id_pago_hotel, monto, moneda, metodo_pago, estado, fecha_pago, notas, id_reserva_hotel')
        .in('id_reserva_hotel',
          (await db.from('reservas_hotel').select('id_reserva_hotel').eq('id_hotel', args.hotel_id)).data?.map((r: any) => r.id_reserva_hotel) || []
        )
        .order('fecha_pago', { ascending: false }).limit(args.limit || 100);
      if (error) throw new Error(error.message);
      return { payments: data };
    }

    case 'get_metrics': {
      const now = new Date();
      const y = args.anio || now.getFullYear();
      const m = args.mes || now.getMonth() + 1;
      const desde = `${y}-${String(m).padStart(2,'0')}-01`;
      const hasta = `${y}-${String(m).padStart(2,'0')}-31`;
      const [resData, habData] = await Promise.all([
        db.from('reservas_hotel').select('estado, total_reserva').eq('id_hotel', args.hotel_id).gte('check_in', desde).lte('check_in', hasta),
        db.from('habitaciones').select('estado').eq('id_hotel', args.hotel_id),
      ]);
      const reservas = resData.data || [];
      const habitaciones = habData.data || [];
      const ocupadas = habitaciones.filter((h: any) => h.estado === 'ocupada').length;
      return {
        periodo: `${m}/${y}`,
        total_reservas: reservas.length,
        confirmadas: reservas.filter((r: any) => r.estado === 'confirmada').length,
        canceladas: reservas.filter((r: any) => r.estado === 'cancelada').length,
        ingresos_estimados: reservas.filter((r: any) => !['cancelada','no_show'].includes(r.estado))
          .reduce((s: number, r: any) => s + Number(r.total_reserva || 0), 0),
        habitaciones_total: habitaciones.length,
        ocupadas,
        ocupacion_pct: habitaciones.length > 0 ? Math.round(ocupadas / habitaciones.length * 100) : 0,
      };
    }

    case 'check_in': {
      const { data: r } = await db.from('reservas_hotel').select('id_habitacion, estado').eq('id_reserva_hotel', args.id_reserva_hotel).single();
      if (!r) throw new Error('Reserva no encontrada');
      if (!['confirmada','pendiente'].includes(r.estado)) throw new Error(`Estado inválido para check-in: ${r.estado}`);
      await db.from('reservas_hotel').update({ estado: 'check_in' }).eq('id_reserva_hotel', args.id_reserva_hotel);
      await db.from('habitaciones').update({ estado: 'ocupada' }).eq('id_habitacion', r.id_habitacion);
      return { success: true, message: 'Check-in realizado.' };
    }

    case 'check_out': {
      const { data: r } = await db.from('reservas_hotel').select('id_habitacion, estado').eq('id_reserva_hotel', args.id_reserva_hotel).single();
      if (!r) throw new Error('Reserva no encontrada');
      if (r.estado !== 'check_in') throw new Error(`Estado inválido para check-out: ${r.estado}`);
      await db.from('reservas_hotel').update({ estado: 'check_out' }).eq('id_reserva_hotel', args.id_reserva_hotel);
      await db.from('habitaciones').update({ estado: 'disponible' }).eq('id_habitacion', r.id_habitacion);
      return { success: true, message: 'Check-out realizado.' };
    }

    case 'cancel_reservation': {
      await db.from('reservas_hotel').update({ estado: 'cancelada', observaciones: args.motivo || 'Cancelada desde Solaris AI' }).eq('id_reserva_hotel', args.id_reserva_hotel);
      return { success: true, message: 'Reserva cancelada.' };
    }

    case 'update_reservation': {
      const { data, error } = await db.from('reservas_hotel').update(args.campos).eq('id_reserva_hotel', args.id_reserva_hotel).select().single();
      if (error) throw new Error(error.message);
      return { success: true, reserva: data };
    }

    case 'register_payment': {
      const { data: reserva } = await db.from('reservas_hotel').select('total_reserva').eq('id_reserva_hotel', args.id_reserva_hotel).single();
      if (!reserva) throw new Error('Reserva no encontrada');
      await db.from('pagos_hotel').insert({ id_reserva_hotel: args.id_reserva_hotel, monto: args.monto, monto_en_moneda_reserva: args.monto, metodo_pago: args.metodo_pago, estado: 'registrado', notas: args.notas || null });
      const { data: pagos } = await db.from('pagos_hotel').select('monto_en_moneda_reserva').eq('id_reserva_hotel', args.id_reserva_hotel).neq('estado', 'anulado');
      const totalPagado = (pagos || []).reduce((s: number, p: any) => s + Number(p.monto_en_moneda_reserva), 0);
      const estadoPago = totalPagado >= Number(reserva.total_reserva) - 0.01 ? 'pagado' : totalPagado > 0 ? 'abonada' : 'deuda';
      await db.from('reservas_hotel').update({ estado_pago: estadoPago }).eq('id_reserva_hotel', args.id_reserva_hotel);
      return { success: true, total_pagado: totalPagado, estado_pago: estadoPago };
    }

    case 'update_room': {
      const { data, error } = await db.from('habitaciones').update(args.campos).eq('id_habitacion', args.id_habitacion).select().single();
      if (error) throw new Error(error.message);
      return { success: true, habitacion: data };
    }

    case 'get_available_rooms': {
      const { data: allRooms, error: roomsError } = await db.from('habitaciones_con_detalles')
        .select('*').eq('id_hotel', args.hotel_id);
      if (roomsError) throw new Error(roomsError.message);
      const { data: conflicts } = await db.from('reservas_hotel')
        .select('id_habitacion').eq('id_hotel', args.hotel_id)
        .lt('check_in', args.check_out).gt('check_out', args.check_in);
      const conflictsFiltered = (conflicts || []).filter((r: any) => !['cancelada','no_show','check_out'].includes(r.estado));
      const occupiedIds = new Set(conflictsFiltered.map((r: any) => r.id_habitacion));
      const available = (allRooms || []).filter((r: any) =>
        !occupiedIds.has(r.id_habitacion) && !['mantenimiento','bloqueada'].includes(r.estado)
      );
      return { rooms: available, count: available.length, periodo: { check_in: args.check_in, check_out: args.check_out } };
    }

    case 'create_guest': {
      const { data: existing } = await db.from('huespedes')
        .select('*').eq('id_hotel', args.hotel_id).eq('correo', args.correo).maybeSingle();
      if (existing) return { guest: existing, created: false, message: 'Huésped ya registrado, usando existente.' };
      const { data, error } = await db.from('huespedes').insert({
        id_hotel: args.hotel_id,
        nombre_completo: args.nombre_completo,
        correo: args.correo,
        telefono: args.telefono || null,
        documento_identidad: args.documento_identidad || null,
      }).select().single();
      if (error) throw new Error(error.message);
      return { guest: data, created: true, message: 'Huésped registrado exitosamente.' };
    }

    case 'create_reservation': {
      const { data, error } = await db.rpc('fn_crear_reserva_completa', {
        p_owner_id: ownerIds[0],
        p_id_huesped: args.id_huesped,
        p_id_habitacion: args.id_habitacion,
        p_check_in: args.check_in,
        p_check_out: args.check_out,
        p_adultos: args.adultos || 1,
        p_ninos: args.ninos || 0,
        p_estado: args.estado || 'confirmada',
        p_total_reserva: args.total_reserva || 0,
        p_moneda: args.moneda || 'HNL',
        p_observaciones: args.observaciones || null,
        p_estado_pago: args.estado_pago || 'deuda',
        p_anticipo: args.anticipo || 0,
        p_es_cortesia: args.es_cortesia || false,
        p_tipo_reserva: args.tipo_reserva || 'noche',
        p_servicios: [],
      });
      if (error) throw new Error(error.message);
      return { success: true, reserva: data, message: 'Reserva creada exitosamente.' };
    }

    // ─── Gimnasio ────────────────────────────────────────────────────────────
    case 'get_gym_info': {
      const { data: gimnasio } = await db.from('gimnasios').select('*').eq('id_gimnasio', args.gimnasio_id).maybeSingle();
      const { data: planes } = await db.from('planes_membresia').select('id_plan, nombre, descripcion, duracion_dias, precio, acceso_clases, acceso_gym, activo').eq('id_gimnasio', args.gimnasio_id);
      const { data: entrenadores } = await db.from('entrenadores').select('id_entrenador, nombre_completo, especialidad, estado').eq('id_gimnasio', args.gimnasio_id);
      return { gimnasio, planes, entrenadores };
    }

    case 'get_gym_members': {
      let q = db.from('miembros')
        .select('id_miembro, nombre_completo, correo, telefono, documento_identidad, estado, fecha_registro')
        .eq('id_gimnasio', args.gimnasio_id)
        .order('fecha_registro', { ascending: false })
        .limit(args.limit || 100);
      if (args.estado) q = q.eq('estado', args.estado);
      if (args.busqueda) q = (q as any).or(`nombre_completo.ilike.%${args.busqueda}%,correo.ilike.%${args.busqueda}%,documento_identidad.ilike.%${args.busqueda}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { miembros: data, count: data?.length };
    }

    case 'get_gym_memberships': {
      let q = db.from('inscripciones_gym')
        .select(`id_inscripcion, fecha_inicio, fecha_fin, estado, estado_pago, total, anticipo, notas, id_miembro, id_plan,
          miembros(nombre_completo, correo, telefono),
          planes_membresia(nombre, duracion_dias, precio)`)
        .eq('id_gimnasio', args.gimnasio_id)
        .order('fecha_fin', { ascending: true })
        .limit(args.limit || 100);
      if (args.estado) q = q.eq('estado', args.estado);
      if (args.vencen_antes) q = q.lte('fecha_fin', args.vencen_antes);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { inscripciones: data, count: data?.length };
    }

    case 'get_gym_plans': {
      const { data, error } = await db.from('planes_membresia').select('*').eq('id_gimnasio', args.gimnasio_id).order('precio');
      if (error) throw new Error(error.message);
      return { planes: data };
    }

    case 'get_gym_payments': {
      const { data: inscripciones } = await db.from('inscripciones_gym').select('id_inscripcion').eq('id_gimnasio', args.gimnasio_id);
      const ids = (inscripciones || []).map((i: any) => i.id_inscripcion);
      if (!ids.length) return { pagos: [] };
      let q = db.from('pagos_gym')
        .select(`id_pago_gym, monto, moneda, metodo_pago, referencia, estado, notas, fecha_pago, id_inscripcion,
          inscripciones_gym(miembros(nombre_completo))`)
        .in('id_inscripcion', ids)
        .order('fecha_pago', { ascending: false })
        .limit(args.limit || 100);
      if (args.estado) q = q.eq('estado', args.estado);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { pagos: data };
    }

    case 'get_gym_classes': {
      let q = db.from('clases_gym')
        .select(`id_clase, nombre_clase, descripcion, dia_semana, hora_inicio, hora_fin, capacidad_maxima, activa,
          entrenadores(nombre_completo, especialidad)`)
        .eq('id_gimnasio', args.gimnasio_id)
        .order('dia_semana');
      if (args.dia_semana) q = q.eq('dia_semana', args.dia_semana);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { clases: data };
    }

    case 'get_gym_metrics': {
      const now = new Date();
      const y = args.anio || now.getFullYear();
      const m = args.mes || now.getMonth() + 1;
      const desde = `${y}-${String(m).padStart(2, '0')}-01`;
      const hasta = `${y}-${String(m).padStart(2, '0')}-31`;

      const [miembrosRes, inscripcionesRes] = await Promise.all([
        db.from('miembros').select('estado').eq('id_gimnasio', args.gimnasio_id),
        db.from('inscripciones_gym').select('id_inscripcion, estado, fecha_fin').eq('id_gimnasio', args.gimnasio_id),
      ]);
      const miembros = miembrosRes.data || [];
      const inscripciones = inscripcionesRes.data || [];
      const inscripcionesActivas = inscripciones.filter((i: any) => i.estado === 'activa');
      const vencenEsteMes = inscripcionesActivas.filter((i: any) => i.fecha_fin >= desde && i.fecha_fin <= hasta);

      const ids = inscripciones.map((i: any) => i.id_inscripcion);
      let ingresosMes = 0;
      if (ids.length) {
        const { data: pagos } = await db.from('pagos_gym')
          .select('monto, fecha_pago, estado, id_inscripcion')
          .in('id_inscripcion', ids)
          .gte('fecha_pago', desde).lte('fecha_pago', `${hasta}T23:59:59`);
        ingresosMes = (pagos || []).filter((p: any) => p.estado !== 'anulado').reduce((s: number, p: any) => s + Number(p.monto), 0);
      }

      return {
        periodo: `${m}/${y}`,
        total_miembros: miembros.length,
        miembros_activos: miembros.filter((mm: any) => mm.estado === 'activo').length,
        inscripciones_activas: inscripcionesActivas.length,
        vencen_este_mes: vencenEsteMes.length,
        ingresos_mes: ingresosMes,
      };
    }

    case 'register_gym_payment': {
      const { data: inscripcion } = await db.from('inscripciones_gym').select('total').eq('id_inscripcion', args.id_inscripcion).single();
      if (!inscripcion) throw new Error('Inscripción no encontrada');
      await db.from('pagos_gym').insert({
        id_inscripcion: args.id_inscripcion,
        monto: args.monto,
        metodo_pago: args.metodo_pago,
        referencia: args.referencia || '',
        moneda: args.moneda || 'HNL',
        estado: 'registrado',
        notas: args.notas || '',
        created_by: ownerIds[0],
      });
      const { data: pagos } = await db.from('pagos_gym').select('monto').eq('id_inscripcion', args.id_inscripcion).neq('estado', 'anulado');
      const totalPagado = (pagos || []).reduce((s: number, p: any) => s + Number(p.monto), 0);
      const estadoPago = totalPagado >= Number(inscripcion.total) - 0.01 ? 'pagado' : totalPagado > 0 ? 'parcial' : 'pendiente';
      await db.from('inscripciones_gym').update({ estado_pago: estadoPago }).eq('id_inscripcion', args.id_inscripcion);
      return { success: true, total_pagado: totalPagado, estado_pago: estadoPago };
    }

    case 'create_gym_member': {
      const { data: existing } = await db.from('miembros')
        .select('*').eq('id_gimnasio', args.gimnasio_id).eq('correo', args.correo).maybeSingle();
      if (existing) return { miembro: existing, created: false, message: 'Miembro ya registrado, usando existente.' };
      const { data, error } = await db.from('miembros').insert({
        id_gimnasio: args.gimnasio_id,
        nombre_completo: args.nombre_completo,
        correo: args.correo,
        telefono: args.telefono || '',
        documento_identidad: args.documento_identidad || '',
        fecha_nacimiento: args.fecha_nacimiento || '2000-01-01',
        genero: args.genero || '',
        direccion: args.direccion || '',
        contacto_emergencia: args.contacto_emergencia || '',
        telefono_emergencia: args.telefono_emergencia || '',
        observaciones: args.observaciones || '',
        estado: 'activo',
      }).select().single();
      if (error) throw new Error(error.message);
      return { miembro: data, created: true, message: 'Miembro registrado exitosamente.' };
    }

    case 'create_gym_membership': {
      const { data: plan } = await db.from('planes_membresia').select('precio, duracion_dias').eq('id_plan', args.id_plan).single();
      if (!plan) throw new Error('Plan no encontrado');
      const fechaInicio = args.fecha_inicio || new Date().toLocaleDateString('en-CA');
      const fin = new Date(fechaInicio);
      fin.setDate(fin.getDate() + plan.duracion_dias);
      const fechaFin = fin.toLocaleDateString('en-CA');
      const total = plan.precio;
      const anticipo = args.anticipo || 0;
      const estadoPago = anticipo >= total ? 'pagado' : anticipo > 0 ? 'parcial' : 'pendiente';
      const { data, error } = await db.from('inscripciones_gym').insert({
        id_gimnasio: args.gimnasio_id,
        id_miembro: args.id_miembro,
        id_plan: args.id_plan,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado: 'activa',
        estado_pago: estadoPago,
        total,
        anticipo,
        notas: args.notas || '',
        created_by: ownerIds[0],
      }).select().single();
      if (error) throw new Error(error.message);
      if (anticipo > 0) {
        await db.from('pagos_gym').insert({
          id_inscripcion: data.id_inscripcion,
          monto: anticipo,
          metodo_pago: args.metodo_pago || 'efectivo',
          referencia: '',
          moneda: 'HNL',
          estado: 'registrado',
          notas: 'Anticipo inicial',
          created_by: ownerIds[0],
        });
      }
      return { success: true, inscripcion: data, message: 'Membresía registrada exitosamente.' };
    }

    case 'update_gym_member': {
      const { data, error } = await db.from('miembros').update(args.campos).eq('id_miembro', args.id_miembro).select().single();
      if (error) throw new Error(error.message);
      return { success: true, miembro: data };
    }

    case 'update_gym_membership': {
      const { data, error } = await db.from('inscripciones_gym').update(args.campos).eq('id_inscripcion', args.id_inscripcion).select().single();
      if (error) throw new Error(error.message);
      return { success: true, inscripcion: data };
    }

    // ─── Restaurante ─────────────────────────────────────────────────────────
    case 'get_restaurant_info': {
      const { data: restaurant } = await db.from('restaurant').select('*').eq('id_restaurant', args.restaurant_id).maybeSingle();
      const { data: mesas } = await db.from('mesa_restaurante').select('id_mesa, numero_mesa, capacidad, estado').eq('id_restaurant', args.restaurant_id);
      const { data: menus } = await db.from('menu').select('id_menu, nombre_menu, descripcion, activo').eq('id_restaurant', args.restaurant_id);
      return { restaurant, mesas, menus };
    }

    case 'get_restaurant_tables': {
      let q = db.from('mesa_restaurante').select('id_mesa, numero_mesa, capacidad, estado').eq('id_restaurant', args.restaurant_id).order('numero_mesa');
      if (args.estado) q = q.eq('estado', args.estado);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { mesas: data };
    }

    case 'get_restaurant_menu': {
      const { data, error } = await db.from('platillo')
        .select(`id_platillo, nombre_platillo, descripcion, precio, activo, categoria_platillo(nombre_categoria)`)
        .eq('id_restaurant', args.restaurant_id)
        .eq('activo', true)
        .order('nombre_platillo');
      if (error) throw new Error(error.message);
      return { platillos: data };
    }

    case 'get_restaurant_orders': {
      let q = db.from('pedido_restaurante')
        .select(`id_pedido, fecha_pedido, estado_pedido,
          mesa_restaurante(numero_mesa),
          cliente_restaurante(nombre, apellido),
          detalle_pedido_restaurante(id_platillo, cantidad, precio_unitario, subtotal, platillo(nombre_platillo))`)
        .eq('id_restaurant', args.restaurant_id)
        .order('fecha_pedido', { ascending: false })
        .limit(args.limit || 50);
      if (args.estado) q = q.eq('estado_pedido', args.estado);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { pedidos: data };
    }

    case 'get_restaurant_reservations': {
      let q = db.from('reserva')
        .select(`id_reserva, fecha_reserva, hora_reserva, cantidad_personas, estado, observaciones,
          cliente_restaurante(nombre, apellido, telefono),
          mesa_restaurante(numero_mesa, capacidad)`)
        .eq('id_restaurant', args.restaurant_id)
        .order('fecha_reserva', { ascending: false })
        .limit(args.limit || 50);
      if (args.fecha) q = q.eq('fecha_reserva', args.fecha);
      if (args.estado) q = q.eq('estado', args.estado);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { reservas: data };
    }

    case 'get_restaurant_metrics': {
      const now = new Date();
      const y = args.anio || now.getFullYear();
      const m = args.mes || now.getMonth() + 1;
      const desde = `${y}-${String(m).padStart(2, '0')}-01`;
      const hasta = `${y}-${String(m).padStart(2, '0')}-31`;
      const [facturasRes, pedidosRes] = await Promise.all([
        db.from('factura_restaurante').select('total, fecha').eq('id_restaurant', args.restaurant_id).gte('fecha', desde).lte('fecha', `${hasta}T23:59:59`),
        db.from('pedido_restaurante').select('estado_pedido').eq('id_restaurant', args.restaurant_id).gte('fecha_pedido', desde).lte('fecha_pedido', `${hasta}T23:59:59`),
      ]);
      const facturas = facturasRes.data || [];
      const pedidos = pedidosRes.data || [];
      return {
        periodo: `${m}/${y}`,
        total_facturado: facturas.reduce((s: number, f: any) => s + Number(f.total), 0),
        total_facturas: facturas.length,
        total_pedidos: pedidos.length,
        pedidos_completados: pedidos.filter((p: any) => ['completado', 'pagado', 'entregado'].includes(p.estado_pedido)).length,
      };
    }

    case 'update_table_status': {
      const { data, error } = await db.from('mesa_restaurante').update({ estado: args.estado }).eq('id_mesa', args.id_mesa).select().single();
      if (error) throw new Error(error.message);
      return { success: true, mesa: data };
    }

    case 'update_order_status': {
      const { data, error } = await db.from('pedido_restaurante').update({ estado_pedido: args.estado_pedido }).eq('id_pedido', args.id_pedido).select().single();
      if (error) throw new Error(error.message);
      return { success: true, pedido: data };
    }

    case 'create_restaurant_reservation': {
      let clienteId = args.id_cliente;
      if (!clienteId && args.nombre_cliente) {
        const [nombre, ...rest] = String(args.nombre_cliente).split(' ');
        const apellido = rest.join(' ') || '';
        const { data: cliente, error: clienteError } = await db.from('cliente_restaurante').insert({
          id_restaurant: args.restaurant_id,
          nombre,
          apellido,
          telefono: args.telefono || '',
          correo: args.correo || '',
        }).select().single();
        if (clienteError) throw new Error(clienteError.message);
        clienteId = cliente.id_cliente;
      }
      if (!clienteId) throw new Error('Se requiere id_cliente o nombre_cliente');
      const { data, error } = await db.from('reserva').insert({
        id_restaurant: args.restaurant_id,
        id_cliente: clienteId,
        id_mesa: args.id_mesa,
        fecha_reserva: args.fecha_reserva,
        hora_reserva: args.hora_reserva,
        cantidad_personas: args.cantidad_personas,
        estado: 'pendiente',
        observaciones: args.observaciones || '',
      }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, reserva: data, message: 'Reserva creada exitosamente.' };
    }

    case 'search_database': {
      const allowed = ['hoteles','habitaciones','huespedes','reservas_hotel','pagos_hotel','empresas','facturas','cierres_diarios','saldos_clientes','tipos_habitacion','comodidades_hotel','servicios_adicionales','habitaciones_con_detalles','business_modules','gimnasios','miembros','inscripciones_gym','planes_membresia','pagos_gym','clases_gym','entrenadores','asistencia_clases','restaurant','mesa_restaurante','platillo','categoria_platillo','menu','menu_platillo','pedido_restaurante','detalle_pedido_restaurante','reserva','cliente_restaurante','factura_restaurante','detalle_factura'];
      if (!allowed.includes(args.tabla)) throw new Error(`Tabla no permitida. Disponibles: ${allowed.join(', ')}`);
      let q = (db.from(args.tabla) as any).select(args.columnas || '*').limit(args.limite || 100);
      if (args.filtros) for (const [k, v] of Object.entries(args.filtros)) q = q.eq(k, v);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { tabla: args.tabla, data, count: data?.length };
    }

    default:
      return { error: `Herramienta '${name}' no reconocida.` };
  }
}

// ─── Definición de tools para Gemini REST API ─────────────────────────────────
const TOOLS = [{
  function_declarations: [
    { name: 'get_businesses', description: 'Obtiene todos los negocios, hoteles y módulos del propietario.', parameters: { type: 'OBJECT', properties: {}, required: [] } },
    { name: 'get_hotel_info', description: 'Información completa de un hotel: datos, configuración, habitaciones.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING', description: 'UUID del hotel' } }, required: ['hotel_id'] } },
    { name: 'get_reservations', description: 'Reservas de un hotel. Filtros: estado, fecha_desde, fecha_hasta, limit.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' }, limit: { type: 'INTEGER' }, estado: { type: 'STRING', description: 'pendiente/confirmada/check_in/check_out/cancelada/no_show' }, fecha_desde: { type: 'STRING', description: 'YYYY-MM-DD' }, fecha_hasta: { type: 'STRING', description: 'YYYY-MM-DD' } }, required: ['hotel_id'] } },
    { name: 'get_rooms', description: 'Lista todas las habitaciones con estado, tipo, tarifa y comodidades.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' } }, required: ['hotel_id'] } },
    { name: 'get_guests', description: 'Lista o busca huéspedes. Usa busqueda para filtrar por nombre o correo.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' }, busqueda: { type: 'STRING' }, limit: { type: 'INTEGER' } }, required: ['hotel_id'] } },
    { name: 'get_payments', description: 'Pagos recientes del hotel.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' }, limit: { type: 'INTEGER' } }, required: ['hotel_id'] } },
    { name: 'get_metrics', description: 'Métricas del hotel: ingresos, ocupación, reservas. Omite mes/anio para el mes actual.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' }, mes: { type: 'INTEGER' }, anio: { type: 'INTEGER' } }, required: ['hotel_id'] } },
    { name: 'check_in', description: 'Realiza check-in de una reserva. Cambia estado a check_in y habitación a ocupada.', parameters: { type: 'OBJECT', properties: { id_reserva_hotel: { type: 'STRING' } }, required: ['id_reserva_hotel'] } },
    { name: 'check_out', description: 'Realiza check-out de una reserva. Cambia estado a check_out y habitación a disponible.', parameters: { type: 'OBJECT', properties: { id_reserva_hotel: { type: 'STRING' } }, required: ['id_reserva_hotel'] } },
    { name: 'cancel_reservation', description: 'Cancela una reserva con motivo opcional.', parameters: { type: 'OBJECT', properties: { id_reserva_hotel: { type: 'STRING' }, motivo: { type: 'STRING' } }, required: ['id_reserva_hotel'] } },
    { name: 'update_reservation', description: 'Modifica campos de una reserva (observaciones, total_reserva, adultos, ninos, etc.).', parameters: { type: 'OBJECT', properties: { id_reserva_hotel: { type: 'STRING' }, campos: { type: 'OBJECT', description: 'Campos a actualizar ej: {"observaciones":"nota"}' } }, required: ['id_reserva_hotel', 'campos'] } },
    { name: 'register_payment', description: 'Registra un pago y recalcula estado_pago.', parameters: { type: 'OBJECT', properties: { id_reserva_hotel: { type: 'STRING' }, monto: { type: 'NUMBER' }, metodo_pago: { type: 'STRING', description: 'efectivo/tarjeta/transferencia/deposito/otro' }, notas: { type: 'STRING' } }, required: ['id_reserva_hotel', 'monto', 'metodo_pago'] } },
    { name: 'update_room', description: 'Modifica una habitación: estado, tarifa_noche, etc.', parameters: { type: 'OBJECT', properties: { id_habitacion: { type: 'STRING' }, campos: { type: 'OBJECT', description: 'Campos a actualizar ej: {"estado":"mantenimiento"}' } }, required: ['id_habitacion', 'campos'] } },
    { name: 'get_available_rooms', description: 'Lista habitaciones disponibles para un rango de fechas. Úsala antes de crear una reserva.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' }, check_in: { type: 'STRING', description: 'ISO 8601 ej: 2025-06-15T15:00:00' }, check_out: { type: 'STRING', description: 'ISO 8601 ej: 2025-06-18T12:00:00' } }, required: ['hotel_id', 'check_in', 'check_out'] } },
    { name: 'create_guest', description: 'Registra un nuevo huésped. Si el correo ya existe, retorna el huésped existente sin duplicar.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' }, nombre_completo: { type: 'STRING' }, correo: { type: 'STRING' }, telefono: { type: 'STRING' }, documento_identidad: { type: 'STRING' } }, required: ['hotel_id', 'nombre_completo', 'correo'] } },
    { name: 'create_reservation', description: 'Crea una reserva nueva. Verifica disponibilidad automáticamente. Requiere id_huesped e id_habitacion.', parameters: { type: 'OBJECT', properties: { id_huesped: { type: 'STRING' }, id_habitacion: { type: 'STRING' }, check_in: { type: 'STRING', description: 'ISO 8601 ej: 2025-06-15T15:00:00' }, check_out: { type: 'STRING', description: 'ISO 8601 ej: 2025-06-18T12:00:00' }, adultos: { type: 'INTEGER' }, ninos: { type: 'INTEGER' }, total_reserva: { type: 'NUMBER' }, moneda: { type: 'STRING', description: 'HNL o USD' }, observaciones: { type: 'STRING' }, estado_pago: { type: 'STRING', description: 'deuda/abonada/pagado/cortesia' }, es_cortesia: { type: 'BOOLEAN' }, tipo_reserva: { type: 'STRING', description: 'noche/hora/pasadia' } }, required: ['id_huesped', 'id_habitacion', 'check_in', 'check_out'] } },
    { name: 'search_database', description: 'Consulta directa (solo lectura) a cualquier tabla de la BD.', parameters: { type: 'OBJECT', properties: { tabla: { type: 'STRING' }, filtros: { type: 'OBJECT' }, columnas: { type: 'STRING' }, limite: { type: 'INTEGER' } }, required: ['tabla'] } },

    // ─── Gimnasio ──────────────────────────────────────────────────────────
    { name: 'get_gym_info', description: 'Información de un gimnasio: datos generales, planes de membresía y entrenadores.', parameters: { type: 'OBJECT', properties: { gimnasio_id: { type: 'STRING', description: 'UUID del gimnasio' } }, required: ['gimnasio_id'] } },
    { name: 'get_gym_members', description: 'Lista o busca miembros del gimnasio. Usa busqueda para filtrar por nombre, correo o documento.', parameters: { type: 'OBJECT', properties: { gimnasio_id: { type: 'STRING' }, busqueda: { type: 'STRING' }, estado: { type: 'STRING', description: 'activo/inactivo/suspendido' }, limit: { type: 'INTEGER' } }, required: ['gimnasio_id'] } },
    { name: 'get_gym_memberships', description: 'Inscripciones/membresías del gimnasio con datos del miembro y del plan. Filtra por estado o por vencen_antes (fecha YYYY-MM-DD) para ver próximas a vencer.', parameters: { type: 'OBJECT', properties: { gimnasio_id: { type: 'STRING' }, estado: { type: 'STRING', description: 'activa/vencida/cancelada' }, vencen_antes: { type: 'STRING', description: 'YYYY-MM-DD' }, limit: { type: 'INTEGER' } }, required: ['gimnasio_id'] } },
    { name: 'get_gym_plans', description: 'Lista los planes de membresía disponibles en el gimnasio (nombre, duración, precio).', parameters: { type: 'OBJECT', properties: { gimnasio_id: { type: 'STRING' } }, required: ['gimnasio_id'] } },
    { name: 'get_gym_payments', description: 'Pagos de membresías del gimnasio, con el nombre del miembro asociado.', parameters: { type: 'OBJECT', properties: { gimnasio_id: { type: 'STRING' }, estado: { type: 'STRING' }, limit: { type: 'INTEGER' } }, required: ['gimnasio_id'] } },
    { name: 'get_gym_classes', description: 'Clases/horarios del gimnasio con su entrenador asignado. Filtra opcionalmente por dia_semana.', parameters: { type: 'OBJECT', properties: { gimnasio_id: { type: 'STRING' }, dia_semana: { type: 'STRING' } }, required: ['gimnasio_id'] } },
    { name: 'get_gym_metrics', description: 'Métricas del gimnasio: total de miembros, miembros activos, membresías activas, vencimientos del mes e ingresos del mes. Omite mes/anio para el mes actual.', parameters: { type: 'OBJECT', properties: { gimnasio_id: { type: 'STRING' }, mes: { type: 'INTEGER' }, anio: { type: 'INTEGER' } }, required: ['gimnasio_id'] } },
    { name: 'register_gym_payment', description: 'Registra un pago para una membresía/inscripción existente y recalcula su estado de pago.', parameters: { type: 'OBJECT', properties: { id_inscripcion: { type: 'STRING' }, monto: { type: 'NUMBER' }, metodo_pago: { type: 'STRING', description: 'efectivo/tarjeta/transferencia/otro' }, referencia: { type: 'STRING' }, moneda: { type: 'STRING' }, notas: { type: 'STRING' } }, required: ['id_inscripcion', 'monto', 'metodo_pago'] } },
    { name: 'create_gym_member', description: 'Registra un nuevo miembro del gimnasio. Si el correo ya existe, retorna el miembro existente sin duplicar.', parameters: { type: 'OBJECT', properties: { gimnasio_id: { type: 'STRING' }, nombre_completo: { type: 'STRING' }, correo: { type: 'STRING' }, telefono: { type: 'STRING' }, documento_identidad: { type: 'STRING' }, fecha_nacimiento: { type: 'STRING', description: 'YYYY-MM-DD' }, genero: { type: 'STRING' }, direccion: { type: 'STRING' }, contacto_emergencia: { type: 'STRING' }, telefono_emergencia: { type: 'STRING' }, observaciones: { type: 'STRING' } }, required: ['gimnasio_id', 'nombre_completo', 'correo'] } },
    { name: 'create_gym_membership', description: 'Crea una nueva membresía/inscripción para un miembro a partir de un plan. Calcula fecha de fin y estado de pago automáticamente.', parameters: { type: 'OBJECT', properties: { gimnasio_id: { type: 'STRING' }, id_miembro: { type: 'STRING' }, id_plan: { type: 'STRING' }, fecha_inicio: { type: 'STRING', description: 'YYYY-MM-DD, por defecto hoy' }, anticipo: { type: 'NUMBER' }, metodo_pago: { type: 'STRING' }, notas: { type: 'STRING' } }, required: ['gimnasio_id', 'id_miembro', 'id_plan'] } },
    { name: 'update_gym_member', description: 'Modifica datos de un miembro (estado, teléfono, observaciones, etc.).', parameters: { type: 'OBJECT', properties: { id_miembro: { type: 'STRING' }, campos: { type: 'OBJECT', description: 'Campos a actualizar ej: {"estado":"inactivo"}' } }, required: ['id_miembro', 'campos'] } },
    { name: 'update_gym_membership', description: 'Modifica una membresía/inscripción (estado, fecha_fin, notas, etc.). Útil para renovar o cancelar.', parameters: { type: 'OBJECT', properties: { id_inscripcion: { type: 'STRING' }, campos: { type: 'OBJECT', description: 'Campos a actualizar ej: {"estado":"cancelada"}' } }, required: ['id_inscripcion', 'campos'] } },

    // ─── Restaurante ───────────────────────────────────────────────────────
    { name: 'get_restaurant_info', description: 'Información de un restaurante: datos generales, mesas y menús.', parameters: { type: 'OBJECT', properties: { restaurant_id: { type: 'STRING', description: 'ID del restaurante' } }, required: ['restaurant_id'] } },
    { name: 'get_restaurant_tables', description: 'Lista las mesas del restaurante con su estado (libre/ocupada/reservada) y capacidad.', parameters: { type: 'OBJECT', properties: { restaurant_id: { type: 'STRING' }, estado: { type: 'STRING' } }, required: ['restaurant_id'] } },
    { name: 'get_restaurant_menu', description: 'Lista los platillos activos del menú con su categoría y precio.', parameters: { type: 'OBJECT', properties: { restaurant_id: { type: 'STRING' } }, required: ['restaurant_id'] } },
    { name: 'get_restaurant_orders', description: 'Pedidos del restaurante con mesa, cliente y detalle de platillos. Filtra opcionalmente por estado.', parameters: { type: 'OBJECT', properties: { restaurant_id: { type: 'STRING' }, estado: { type: 'STRING' }, limit: { type: 'INTEGER' } }, required: ['restaurant_id'] } },
    { name: 'get_restaurant_reservations', description: 'Reservas de mesas del restaurante con datos del cliente y la mesa. Filtra opcionalmente por fecha (YYYY-MM-DD) o estado.', parameters: { type: 'OBJECT', properties: { restaurant_id: { type: 'STRING' }, fecha: { type: 'STRING' }, estado: { type: 'STRING' }, limit: { type: 'INTEGER' } }, required: ['restaurant_id'] } },
    { name: 'get_restaurant_metrics', description: 'Métricas del restaurante: total facturado, número de facturas y pedidos del periodo. Omite mes/anio para el mes actual.', parameters: { type: 'OBJECT', properties: { restaurant_id: { type: 'STRING' }, mes: { type: 'INTEGER' }, anio: { type: 'INTEGER' } }, required: ['restaurant_id'] } },
    { name: 'update_table_status', description: 'Cambia el estado de una mesa (libre/ocupada/reservada).', parameters: { type: 'OBJECT', properties: { id_mesa: { type: 'STRING' }, estado: { type: 'STRING' } }, required: ['id_mesa', 'estado'] } },
    { name: 'update_order_status', description: 'Cambia el estado de un pedido (ej. en_preparacion, listo, entregado, pagado, cancelado).', parameters: { type: 'OBJECT', properties: { id_pedido: { type: 'STRING' }, estado_pedido: { type: 'STRING' } }, required: ['id_pedido', 'estado_pedido'] } },
    { name: 'create_restaurant_reservation', description: 'Crea una reserva de mesa. Si no se da id_cliente, crea un cliente nuevo con nombre_cliente/telefono/correo.', parameters: { type: 'OBJECT', properties: { restaurant_id: { type: 'STRING' }, id_cliente: { type: 'STRING' }, nombre_cliente: { type: 'STRING' }, telefono: { type: 'STRING' }, correo: { type: 'STRING' }, id_mesa: { type: 'STRING' }, fecha_reserva: { type: 'STRING', description: 'YYYY-MM-DD' }, hora_reserva: { type: 'STRING', description: 'HH:MM' }, cantidad_personas: { type: 'INTEGER' }, observaciones: { type: 'STRING' } }, required: ['restaurant_id', 'fecha_reserva', 'hora_reserva', 'cantidad_personas'] } },
  ]
}];

// ─── Llamada a Gemini REST API ────────────────────────────────────────────────
async function callGemini(contents: any[], systemInstruction: string, enabledTools?: string[]): Promise<any> {
  let lastError: any;
  
  // Filtrar herramientas si el cliente especificó cuáles están habilitadas
  let activeTools: any[] | undefined = TOOLS;
  if (enabledTools !== undefined) {
    if (enabledTools.length === 0) {
      activeTools = undefined; // Sin herramientas
    } else {
      activeTools = [{
        function_declarations: TOOLS[0].function_declarations.filter(t => enabledTools.includes(t.name))
      }];
    }
  }

  for (const key of GEMINI_KEYS) {
    try {
      const response = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          tools: activeTools,
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      });

      if (response.ok) return await response.json();

      const status = response.status;
      const errText = await response.text();
      lastError = new Error(`Gemini ${status}: ${errText}`);
      console.error(`Key ...${key.slice(-6)} → ${status}`);

      // 403 = suspendida permanentemente, no tiene caso reintentar con esta key
      // 429 = cuota agotada, pasar a la siguiente
      // Cualquier otro error → pasar a la siguiente también
    } catch (err: any) {
      lastError = err;
      console.error(`Gemini key error: ${err.message}`);
    }
  }
  throw lastError || new Error('Todas las API keys de Gemini fallaron.');
}

// ─── Endpoint ─────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { ownerRow, ownerIds, hotelIds, gymIds, restaurantIds } = await resolveOwner(user);
    if (!ownerIds.length) return res.status(400).json({ error: 'Perfil de propietario no encontrado.' });
    if (!GEMINI_KEYS.length) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada.' });

    const { prompt, history = [], enabledTools = [] } = req.body;
    const now = new Date().toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' });
    const todayISO = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

    // Pre-cargar negocios (hoteles, gimnasios, restaurantes) para embeber en el contexto (sin round-trip extra)
    let hotelContext = '';
    if (hotelIds.length > 0) {
      const { data: hoteles } = await db.from('hoteles')
        .select('id_hotel, nombre_hotel, ciudad, estado')
        .in('id_hotel', hotelIds);
      if (hoteles?.length) {
        hotelContext = '\nHOTELES DEL PROPIETARIO (IDs ya conocidos — úsalos directamente sin llamar get_businesses):\n' +
          hoteles.map((h: any) => `- "${h.nombre_hotel}" | ID: ${h.id_hotel} | Ciudad: ${h.ciudad || '—'} | Estado: ${h.estado}`).join('\n');
      }
    }

    let gymContext = '';
    if (gymIds.length > 0) {
      const { data: gimnasios } = await db.from('gimnasios')
        .select('id_gimnasio, nombre_gimnasio, ciudad, estado')
        .in('id_gimnasio', gymIds);
      if (gimnasios?.length) {
        gymContext = '\nGIMNASIOS DEL PROPIETARIO (IDs ya conocidos — úsalos directamente sin llamar get_businesses):\n' +
          gimnasios.map((g: any) => `- "${g.nombre_gimnasio}" | ID: ${g.id_gimnasio} | Ciudad: ${g.ciudad || '—'} | Estado: ${g.estado}`).join('\n');
      }
    }

    let restaurantContext = '';
    if (restaurantIds.length > 0) {
      const { data: restaurantes } = await db.from('restaurant')
        .select('id_restaurant, nombre_restaurante, ciudad, activo')
        .in('id_restaurant', restaurantIds);
      if (restaurantes?.length) {
        restaurantContext = '\nRESTAURANTES DEL PROPIETARIO (IDs ya conocidos — úsalos directamente sin llamar get_businesses):\n' +
          restaurantes.map((r: any) => `- "${r.nombre_restaurante}" | ID: ${r.id_restaurant} | Ciudad: ${r.ciudad || '—'} | Activo: ${r.activo}`).join('\n');
      }
    }

    const allTools = TOOLS[0].function_declarations.map(t => t.name);
    const disabledTools = enabledTools.length === 0 ? allTools : allTools.filter(t => !enabledTools.includes(t));
    const disabledText = disabledTools.length > 0
      ? `\nHERRAMIENTAS DESHABILITADAS:\n${disabledTools.join(', ')}\nSi el usuario pide algo que requiere una herramienta deshabilitada, explícalo y sugiere activarla.`
      : '';

    const systemInstruction = `Eres "Solaris AI", asistente de gestión para negocios del propietario: hoteles, gimnasios y restaurantes.

Propietario: ${ownerRow?.nombre_empresa || 'Sin nombre'} (${ownerRow?.email_contacto || user.email})
Fecha y hora actual: ${now} (hoy es ${todayISO})
${hotelContext}${gymContext}${restaurantContext}

REGLAS ABSOLUTAS — INCUMPLIRLAS ES UN ERROR GRAVE:
1. SIEMPRE usa las herramientas para obtener datos. NUNCA respondas de memoria ni inventes ningún dato (IDs, nombres, números, fechas). Si no tienes el dato, usa una herramienta para buscarlo.
2. Si el usuario pregunta por reservas, huéspedes, pagos, habitaciones, miembros, membresías, clases, mesas, pedidos, menú o métricas: PRIMERO llama a la herramienta correspondiente, LUEGO responde con los datos reales recibidos.
3. Cuando uses get_reservations, get_guests, get_gym_members, get_gym_memberships, get_restaurant_orders o search_database, pasa siempre limit: 100 para obtener datos completos salvo que el usuario pida menos.
4. Si una herramienta devuelve error, repórtalo textualmente. NUNCA inventes el resultado.
5. Para fechas "hoy", usa ${todayISO}. Para "este mes" usa ${todayISO.slice(0, 7)}.
6. Si el propietario tiene varios tipos de negocio (hotel, gimnasio, restaurante), usa el contexto de la conversación para identificar a cuál se refiere el usuario. Si no es claro y hay más de un negocio del mismo tipo, pregunta cuál usando los nombres listados arriba.

INSTRUCCIONES:
- Responde en español, claro y conciso.
- Usa markdown: tablas para listas de datos, negritas para IDs y fechas importantes.
- Si recibes más de 10 registros, muestra un resumen con los más relevantes e indica el total.
- Al modificar datos (crear/editar/cancelar), confirma qué se hizo con el ID afectado.
${disabledText}

FLUJO CREAR RESERVA — SÉ PROACTIVO, NO HAGAS LISTAS DE PREGUNTAS:
Cuando el usuario diga "crea una reserva para [nombre]":
1. INMEDIATAMENTE llama get_guests con busqueda=[nombre] para encontrarlo en la BD.
2. Si solo hay un hotel en el contexto, asúmelo. Si hay varios, pregunta cuál con un menú simple.
3. Pregunta SOLO lo que falta — normalmente solo las fechas. Un solo mensaje conciso.
4. Cuando tengas fechas, llama get_available_rooms y muestra las opciones en tabla.
5. Cuando el usuario confirme habitación, llama create_reservation.
6. Confirma con ID y detalles.

REGLA ANTI-INTERROGATORIO: NUNCA presentes una lista de 5+ preguntas juntas. Usa las herramientas para obtener lo que puedas y pregunta SOLO lo verdaderamente faltante.
ATAJO FORMULARIO: Si el usuario dice "crear reserva", "nueva reserva" o similar SIN dar fechas ni huésped, responde brevemente indicando que puede usar [Abrir formulario de reserva] para rellenar todos los datos de una vez, Y al mismo tiempo busca con get_guests si mencionó un nombre.`;

    // Construir historial en formato Gemini
    const contents: any[] = (history as { role: string; content: string }[])
      .filter(h => h.content?.trim())
      .map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] }));

    // Agregar mensaje actual
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const toolsUsed: string[] = [];
    let maxIter = 8;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const logUsage = () => {
      if (!ownerIds[0] || (totalInputTokens === 0 && totalOutputTokens === 0)) return;
      void db.from('ai_usage_log').insert({
        owner_id: ownerIds[0],
        provider: 'gemini',
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      });
    };

    while (maxIter-- > 0) {
      const data = await callGemini(contents, systemInstruction, enabledTools);
      totalInputTokens  += data.usageMetadata?.promptTokenCount     || 0;
      totalOutputTokens += data.usageMetadata?.candidatesTokenCount || 0;

      const candidate = data.candidates?.[0];

      if (!candidate) {
        logUsage();
        return res.json({ reply: 'No se pudo obtener respuesta del modelo.', toolsUsed });
      }

      const parts = candidate.content?.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text);

      // Sin llamadas a función → respuesta final
      if (functionCalls.length === 0) {
        const reply = textParts.map((p: any) => p.text).join('');
        logUsage();
        return res.json({ reply: reply || '(Sin respuesta de texto)', toolsUsed });
      }

      // Ejecutar herramientas
      contents.push({ role: 'model', parts });

      const functionResponses: any[] = [];
      for (const part of functionCalls) {
        const { name, args } = part.functionCall;
        toolsUsed.push(name);
        let result: any;
        try {
          result = await executeTool(name, args || {}, ownerIds, hotelIds, gymIds, restaurantIds);
        } catch (e: any) {
          result = { error: e.message };
        }
        functionResponses.push({ functionResponse: { name, response: result } });
      }

      contents.push({ role: 'user', parts: functionResponses });
    }

    logUsage();
    return res.json({ reply: 'Se alcanzó el límite de iteraciones.', toolsUsed });

  } catch (err: any) {
    console.error('AI Chat Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
