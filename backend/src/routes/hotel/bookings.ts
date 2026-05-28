import express from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { crearClienteUsuario, supabaseAdmin, supabase } from '../../config/supabase.js';
import { extractToken, getInfoFromToken, patchAuditUser } from '../../utils/auditHelper.js';
import { getAuthUser, getOwnerHotelIdsForUser, getOwnerIdsFromHotelId } from '../../utils/tenantHelper.js';
import { sendBookingConfirmation } from '../../utils/emailService.js';

const router = express.Router();
const db = () => supabaseAdmin ?? supabase;
/** Cliente que usa el JWT del usuario — hace que auth.uid() funcione en triggers */
const dbUser = (req: express.Request) => {
  const token = extractToken(req);
  return token ? crearClienteUsuario(token) : db();
};

/**
 * Verifica si hay disponibilidad de camas extras (unipersonales) en un rango de fechas.
 * El hotel cuenta con un stock máximo de 3 camas.
 * Las reservas canceladas se excluyen.
 * Si se especifica un `excludeReservaId`, se excluye de la sumatoria (útil en actualizaciones).
 */
export async function verificarCamasExtrasDisponibles(
  checkInStr: string,
  checkOutStr: string,
  excludeReservaId?: string
): Promise<{ disponible: boolean; error?: string; maxAsignadas?: number; fechasConSobrecupo?: string[] }> {
  try {
    const { data: reservas, error } = await db()
      .from('reserva_servicios')
      .select(`
        id_reserva_hotel,
        reservas_hotel!inner(check_in, check_out, estado),
        servicios_adicionales!inner(nombre)
      `)
      .eq('servicios_adicionales.nombre', 'Cama Extra')
      .not('reservas_hotel.estado', 'in', '("cancelada","no_show")');

    if (error) {
      return { disponible: false, error: error.message };
    }

    // Normalizar el rango de fechas solicitado como strings 'YYYY-MM-DD'
    const ciStr = checkInStr.split('T')[0];
    const coStr = checkOutStr.split('T')[0];

    if (!ciStr || !coStr || ciStr >= coStr) {
      return { disponible: true, maxAsignadas: 0 };
    }

    // Generar array de fechas (noches) dentro del rango
    const noches: string[] = [];
    let tempDate = new Date(ciStr + 'T12:00:00Z');
    const finDate = new Date(coStr + 'T12:00:00Z');
    while (tempDate < finDate) {
      noches.push(tempDate.toISOString().split('T')[0]);
      tempDate.setUTCDate(tempDate.getUTCDate() + 1);
    }

    const fechasConSobrecupo: string[] = [];
    let maxAsignadas = 0;

    for (const nocheStr of noches) {
      let asignadas = 0;

      for (const res of (reservas || [])) {
        if (excludeReservaId && res.id_reserva_hotel === excludeReservaId) {
          continue;
        }
        const parentRes = res.reservas_hotel as any;
        if (!parentRes) continue;
        // Extraer solo la parte de fecha 'YYYY-MM-DD' para comparar sin timezone
        const resInStr = String(parentRes.check_in).split('T')[0].split(' ')[0];
        const resOutStr = String(parentRes.check_out).split('T')[0].split(' ')[0];

        if (nocheStr >= resInStr && nocheStr < resOutStr) {
          asignadas++;
        }
      }

      if (asignadas > maxAsignadas) maxAsignadas = asignadas;
      if (asignadas >= 3) fechasConSobrecupo.push(nocheStr);
    }

    if (fechasConSobrecupo.length > 0) {
      return { disponible: false, maxAsignadas, fechasConSobrecupo };
    }
    return { disponible: true, maxAsignadas };
  } catch (err: any) {
    return { disponible: false, error: err.message };
  }
}

/**
 * Verifica si hay disponibilidad de neveritas en un rango de fechas.
 * El hotel cuenta con un stock máximo de 1 neverita.
 * Las reservas canceladas se excluyen.
 * Si se especifica un `excludeReservaId`, se excluye de la sumatoria.
 */
export async function verificarNeveritasDisponibles(
  checkInStr: string,
  checkOutStr: string,
  excludeReservaId?: string
): Promise<{ disponible: boolean; error?: string; maxAsignadas?: number; fechasConSobrecupo?: string[] }> {
  try {
    const { data: reservas, error } = await db()
      .from('reserva_servicios')
      .select(`
        id_reserva_hotel,
        reservas_hotel!inner(check_in, check_out, estado),
        servicios_adicionales!inner(nombre)
      `)
      .eq('servicios_adicionales.nombre', 'Neverita')
      .not('reservas_hotel.estado', 'in', '("cancelada","no_show")');

    if (error) {
      return { disponible: false, error: error.message };
    }

    const ciStr = checkInStr.split('T')[0];
    const coStr = checkOutStr.split('T')[0];

    if (!ciStr || !coStr || ciStr >= coStr) {
      return { disponible: true, maxAsignadas: 0 };
    }

    const noches: string[] = [];
    let tempDate = new Date(ciStr + 'T12:00:00Z');
    const finDate = new Date(coStr + 'T12:00:00Z');
    while (tempDate < finDate) {
      noches.push(tempDate.toISOString().split('T')[0]);
      tempDate.setUTCDate(tempDate.getUTCDate() + 1);
    }

    const fechasConSobrecupo: string[] = [];
    let maxAsignadas = 0;

    for (const nocheStr of noches) {
      let asignadas = 0;

      for (const res of (reservas || [])) {
        if (excludeReservaId && res.id_reserva_hotel === excludeReservaId) {
          continue;
        }
        const parentRes = res.reservas_hotel as any;
        if (!parentRes) continue;
        const resInStr = String(parentRes.check_in).split('T')[0].split(' ')[0];
        const resOutStr = String(parentRes.check_out).split('T')[0].split(' ')[0];

        if (nocheStr >= resInStr && nocheStr < resOutStr) {
          asignadas++;
        }
      }

      if (asignadas > maxAsignadas) maxAsignadas = asignadas;
      if (asignadas >= 1) fechasConSobrecupo.push(nocheStr);
    }

    if (fechasConSobrecupo.length > 0) {
      return { disponible: false, maxAsignadas, fechasConSobrecupo };
    }
    return { disponible: true, maxAsignadas };
  } catch (err: any) {
    return { disponible: false, error: err.message };
  }
}

/**
 * Verifica si hay disponibilidad de planchas en un rango de fechas.
 * El hotel cuenta con un stock máximo de 8 planchas.
 * Las reservas canceladas se excluyen.
 * Si se especifica un `excludeReservaId`, se excluye de la sumatoria.
 */
export async function verificarPlanchasDisponibles(
  checkInStr: string,
  checkOutStr: string,
  excludeReservaId?: string
): Promise<{ disponible: boolean; error?: string; maxAsignadas?: number; fechasConSobrecupo?: string[] }> {
  try {
    const { data: reservas, error } = await db()
      .from('reserva_servicios')
      .select(`
        id_reserva_hotel,
        reservas_hotel!inner(check_in, check_out, estado),
        servicios_adicionales!inner(nombre)
      `)
      .eq('servicios_adicionales.nombre', 'Plancha')
      .not('reservas_hotel.estado', 'in', '("cancelada","no_show")');

    if (error) {
      return { disponible: false, error: error.message };
    }

    const ciStr = checkInStr.split('T')[0];
    const coStr = checkOutStr.split('T')[0];

    if (!ciStr || !coStr || ciStr >= coStr) {
      return { disponible: true, maxAsignadas: 0 };
    }

    const noches: string[] = [];
    let tempDate = new Date(ciStr + 'T12:00:00Z');
    const finDate = new Date(coStr + 'T12:00:00Z');
    while (tempDate < finDate) {
      noches.push(tempDate.toISOString().split('T')[0]);
      tempDate.setUTCDate(tempDate.getUTCDate() + 1);
    }

    const fechasConSobrecupo: string[] = [];
    let maxAsignadas = 0;

    for (const nocheStr of noches) {
      let asignadas = 0;

      for (const res of (reservas || [])) {
        if (excludeReservaId && res.id_reserva_hotel === excludeReservaId) {
          continue;
        }
        const parentRes = res.reservas_hotel as any;
        if (!parentRes) continue;
        const resInStr = String(parentRes.check_in).split('T')[0].split(' ')[0];
        const resOutStr = String(parentRes.check_out).split('T')[0].split(' ')[0];

        if (nocheStr >= resInStr && nocheStr < resOutStr) {
          asignadas++;
        }
      }

      if (asignadas > maxAsignadas) maxAsignadas = asignadas;
      if (asignadas >= 8) fechasConSobrecupo.push(nocheStr);
    }

    if (fechasConSobrecupo.length > 0) {
      return {
        disponible: false,
        maxAsignadas,
        fechasConSobrecupo
      };
    }

    return { disponible: true, maxAsignadas };
  } catch (err: any) {
    return { disponible: false, error: err.message };
  }
}

// ─── Empresas ─────────────────────────────────────────────────────────────────

// GET /api/bookings/empresas
router.get('/empresas', async (_req, res) => {
  const { data, error } = await db()
    .from('empresas')
    .select('id_empresa, nombre, rtn, contacto_nombre, contacto_telefono, contacto_correo, limite_credito, dias_credito, estado')
    .eq('estado', 'activo')
    .order('nombre');
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

// POST /api/bookings/empresas
router.post('/empresas', async (req, res) => {
  const result = await getOwnerIdAndRole(req);
  if (!result.ownerId) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const owner_id = result.ownerId;
  const { nombre, rtn, contacto_nombre, contacto_telefono, contacto_correo, limite_credito, dias_credito } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'nombre es requerido' });
  }
  const { data, error } = await db()
    .from('empresas')
    .insert({
      owner_id,
      nombre,
      rtn: rtn || null,
      contacto_nombre: contacto_nombre || null,
      contacto_telefono: contacto_telefono || null,
      contacto_correo: contacto_correo || null,
      limite_credito: limite_credito ?? 0,
      dias_credito: dias_credito ?? 30,
      estado: 'activo',
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// ─── Hoteles ─────────────────────────────────────────────────────────────────

// GET /api/bookings/hoteles
router.get('/hoteles', async (req, res) => {
  try {
    let ownerIds: string[] = [];
    let hotelIds: string[] = [];
    const user = await getAuthUser(req);

    if (user) {
      const result = await getOwnerHotelIdsForUser(user);
      if (result.error) {
        return res.status(400).json({ error: result.error.message || 'Error al resolver permisos del usuario.' });
      }
      ownerIds = result.ownerIds;
      hotelIds = result.hotelIds;
    } else {
      const activeHotelId = req.headers['x-hotel-id'];
      if (typeof activeHotelId === 'string' && activeHotelId !== 'all') {
        ownerIds = await getOwnerIdsFromHotelId(activeHotelId);
      }
    }

    if (ownerIds.length === 0 && hotelIds.length === 0) {
      return res.json([]);
    }

    let query = supabaseAdmin!
      .from('hoteles')
      .select('id_hotel, nombre_hotel, ciudad, direccion, telefono, enlace_google_maps, estado')
      .eq('estado', 'activo');

    if (ownerIds.length > 0 && hotelIds.length > 0) {
      const ownerIdsCsv = ownerIds.join(',');
      const hotelIdsCsv = hotelIds.join(',');
      query = query.or(`owner_id.in.(${ownerIdsCsv}),id_hotel.in.(${hotelIdsCsv})`);
    } else if (ownerIds.length > 0) {
      query = query.in('owner_id', ownerIds);
    } else if (hotelIds.length > 0) {
      query = query.in('id_hotel', hotelIds);
    }

    const { data, error } = await query.order('nombre_hotel');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error al obtener hoteles' });
  }
});

// ─── Habitaciones ─────────────────────────────────────────────────────────────

// GET /api/bookings/habitaciones
router.get('/habitaciones', async (req, res) => {
  let query = db()
    .from('habitaciones_con_detalles')
    .select(`
      id_habitacion,
      nombre_habitacion,
      nombre_alias,
      id_hotel,
      tipo,
      capacidad,
      tarifa_noche,
      estado,
      piso,
      numero_camas,
      imagenes,
      imagen_360,
      comodidades,
      hoteles ( nombre_hotel )
    `);

  const hotelId = req.headers['x-hotel-id'];
  if (hotelId && hotelId !== 'all') {
    query = query.eq('id_hotel', hotelId);
  }

  const { data, error } = await query.order('nombre_habitacion');
  if (error) return res.status(500).json({ error: error.message });
  const result = (data ?? []).map((h: any) => ({
    ...h,
    hotel: h.hoteles?.nombre_hotel ?? '',
    hoteles: undefined,
  }));
  return res.json(result);
});

// POST /api/bookings/habitaciones
router.post('/habitaciones', async (req, res) => {
  const { nombre_habitacion, nombre_alias, tipo, capacidad, tarifa_noche, estado, piso, id_hotel, numero_camas, imagenes, imagen_360, comodidades } = req.body;
  if (!nombre_habitacion || !id_hotel) {
    return res.status(400).json({ error: 'nombre_habitacion e id_hotel son requeridos' });
  }

  // Buscar id_tipo_habitacion que coincida con el tipo, o usar el primero disponible
  const { data: tipoHab } = await db()
    .from('tipos_habitacion')
    .select('id_tipo_habitacion')
    .ilike('nombre_tipo', tipo ?? '%')
    .limit(1)
    .single();

  let id_tipo_habitacion = tipoHab?.id_tipo_habitacion;
  if (!id_tipo_habitacion) {
    const { data: cualquierTipo } = await db()
      .from('tipos_habitacion')
      .select('id_tipo_habitacion')
      .limit(1)
      .single();
    id_tipo_habitacion = cualquierTipo?.id_tipo_habitacion;
  }

  if (!id_tipo_habitacion) {
    return res.status(400).json({ error: 'No existe ningún tipo de habitación. Crea uno primero en tipos_habitacion.' });
  }

  // Generar codigo_habitacion único automáticamente
  const base = nombre_habitacion
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-]/g, '')
    .slice(0, 20);
  const suffix = Date.now().toString().slice(-4);
  const codigo_habitacion = `${base}-${suffix}`;

  // Obtener el owner_id del hotel
  const { data: hotelData, error: hotelError } = await db()
    .from('hoteles')
    .select('owner_id')
    .eq('id_hotel', id_hotel)
    .single();

  if (hotelError || !hotelData) {
    return res.status(400).json({ error: 'El hotel especificado no existe o no tiene un propietario asociado.' });
  }
  const owner_id = hotelData.owner_id;

  const { data, error } = await db()
    .from('habitaciones')
    .insert({
      nombre_habitacion,
      codigo_habitacion,
      capacidad,
      tarifa_noche,
      estado: estado ?? 'disponible',
      piso,
      id_hotel,
      numero_camas,
      id_tipo_habitacion,
      imagen_360: imagen_360 || null,
      owner_id
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  if (data && data.id_habitacion) {
    if (imagenes && Array.isArray(imagenes) && imagenes.length > 0) {
      await db().from('habitacion_imagenes').insert(
        imagenes.map((url: string, index: number) => ({
          id_habitacion: data.id_habitacion,
          url_imagen: url,
          orden: index
        }))
      );
    }
    if (comodidades && Array.isArray(comodidades) && comodidades.length > 0) {
      await db().from('habitacion_comodidades').insert(
        comodidades.map((c: string) => ({
          id_habitacion: data.id_habitacion,
          nombre_comodidad: c
        }))
      );
    }
  }

  // Obtener registro enriquecido desde la vista
  const { data: enrichedData } = await db()
    .from('habitaciones_con_detalles')
    .select('*')
    .eq('id_habitacion', data.id_habitacion)
    .single();

  return res.status(201).json(enrichedData || data);
});

// PATCH y PUT /api/bookings/habitaciones/:id
const updateHabitacionHandler = async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { nombre_habitacion, tipo, capacidad, tarifa_noche, estado, piso, id_hotel, numero_camas, imagenes, imagen_360, comodidades } = req.body;

  // Buscar id_tipo_habitacion que coincida con el tipo, si se provee
  let id_tipo_habitacion = undefined;
  if (tipo) {
    const { data: tipoHab } = await db()
      .from('tipos_habitacion')
      .select('id_tipo_habitacion')
      .ilike('nombre_tipo', tipo)
      .limit(1)
      .single();
    if (tipoHab) {
      id_tipo_habitacion = tipoHab.id_tipo_habitacion;
    }
  }

  const updateFields: any = {};
  if (nombre_habitacion !== undefined) updateFields.nombre_habitacion = nombre_habitacion;
  if (capacidad !== undefined) updateFields.capacidad = capacidad;
  if (tarifa_noche !== undefined) updateFields.tarifa_noche = tarifa_noche;
  if (estado !== undefined) updateFields.estado = estado;
  if (piso !== undefined) updateFields.piso = piso;
  if (id_hotel !== undefined) updateFields.id_hotel = id_hotel;
  if (numero_camas !== undefined) updateFields.numero_camas = numero_camas;
  if (imagen_360 !== undefined) updateFields.imagen_360 = imagen_360 || null;
  if (id_tipo_habitacion !== undefined) updateFields.id_tipo_habitacion = id_tipo_habitacion;

  const { error } = await db()
    .from('habitaciones')
    .update(updateFields)
    .eq('id_habitacion', id);
  if (error) return res.status(500).json({ error: error.message });

  if (imagenes !== undefined && Array.isArray(imagenes)) {
    await db().from('habitacion_imagenes').delete().eq('id_habitacion', id);
    if (imagenes.length > 0) {
      await db().from('habitacion_imagenes').insert(
        imagenes.map((url: string, index: number) => ({
          id_habitacion: id,
          url_imagen: url,
          orden: index
        }))
      );
    }
  }

  if (comodidades !== undefined && Array.isArray(comodidades)) {
    await db().from('habitacion_comodidades').delete().eq('id_habitacion', id);
    if (comodidades.length > 0) {
      await db().from('habitacion_comodidades').insert(
        comodidades.map((c: string) => ({
          id_habitacion: id,
          nombre_comodidad: c
        }))
      );
    }
  }

  return res.json({ success: true });
};

router.patch('/habitaciones/:id', updateHabitacionHandler);
router.put('/habitaciones/:id', updateHabitacionHandler);

// DELETE /api/bookings/habitaciones/:id
router.delete('/habitaciones/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await db()
    .from('habitaciones')
    .delete()
    .eq('id_habitacion', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// ─── Huéspedes ────────────────────────────────────────────────────────────────

// GET /api/bookings/huespedes
router.get('/huespedes', async (req, res) => {
  const hotelId = req.headers['x-hotel-id'] || 'all';

  if (hotelId && hotelId !== 'all') {
    // Obtener los ids de huéspedes con reservas en este hotel
    const { data: reservas, error: rErr } = await db()
      .from('reservas_hotel')
      .select('id_huesped')
      .eq('id_hotel', hotelId);

    if (rErr) return res.status(500).json({ error: rErr.message });

    const idsHuespedes = [...new Set((reservas ?? []).map(r => r.id_huesped).filter(Boolean))];

    if (idsHuespedes.length === 0) {
      return res.json([]);
    }

    const { data, error } = await db()
      .from('huespedes')
      .select('id_huesped, nombre_completo, correo, telefono, ciudad, direccion')
      .in('id_huesped', idsHuespedes)
      .order('nombre_completo');

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } else {
    const { data, error } = await db()
      .from('huespedes')
      .select('id_huesped, nombre_completo, correo, telefono, ciudad, direccion')
      .order('nombre_completo');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  }
});

// POST /api/bookings/huespedes
router.post('/huespedes', async (req, res) => {
  const result = await getOwnerIdAndRole(req);
  if (!result.ownerId) {
    return res.status(401).json({ error: 'No autorizado o no hay owner_id asociado' });
  }

  const { nombre_completo, correo, telefono, ciudad, direccion, documento_identidad } = req.body;
  if (!nombre_completo) {
    return res.status(400).json({ error: 'nombre_completo es requerido' });
  }
  // correo es NOT NULL UNIQUE - generar uno placeholder si no se proporciona
  const correoFinal = correo?.trim() || `sin-correo-${Date.now()}@partnercentral.local`;

  const { data, error } = await db()
    .from('huespedes')
    .insert({ owner_id: result.ownerId, nombre_completo, correo: correoFinal, telefono, ciudad, direccion, documento_identidad })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// GET /api/bookings/huespedes/:id — Perfil completo con reservas, estadísticas y saldos
router.get('/huespedes/:id', async (req, res) => {
  const { id } = req.params;
  const hotelId = req.headers['x-hotel-id'];

  // 1) Datos del huésped
  const { data: huesped, error: hErr } = await db()
    .from('huespedes')
    .select('id_huesped, nombre_completo, correo, telefono, ciudad, direccion')
    .eq('id_huesped', id)
    .single();
  if (hErr || !huesped) return res.status(404).json({ error: 'Huésped no encontrado' });

  // 2) Reservas del huésped
  let queryReservas = db()
    .from('reservas_hotel')
    .select(`
      id_reserva_hotel, check_in, check_out, estado, estado_display,
      total_reserva, moneda, adultos, ninos, observaciones, es_cortesia,
      id_habitacion, id_hotel, tipo_reserva
    `)
    .eq('id_huesped', id);

  if (hotelId && hotelId !== 'all') {
    queryReservas = queryReservas.eq('id_hotel', hotelId);
  }

  const { data: reservas } = await queryReservas.order('check_in', { ascending: false });

  // Enriquecer con nombre/tipo/piso de habitación
  const habitacionIds = [...new Set(
    (reservas ?? []).map((r: any) => r.id_habitacion).filter((id: any) => id != null)
  )];
  let habitacionesDetalleMap: Record<string, { nombre: string; tipo: string | null; piso: string | null }> = {};
  if (habitacionIds.length > 0) {
    const { data: habs } = await db()
      .from('habitaciones')
      .select('id_habitacion, nombre_habitacion, tipo, piso')
      .in('id_habitacion', habitacionIds);
    for (const h of habs ?? []) {
      habitacionesDetalleMap[h.id_habitacion] = { nombre: h.nombre_habitacion, tipo: h.tipo ?? null, piso: h.piso != null ? String(h.piso) : null };
    }
  }

  const reservasEnriquecidas = (reservas ?? []).map((r: any) => ({
    ...r,
    habitacion: habitacionesDetalleMap[r.id_habitacion]?.nombre ?? '—',
  }));

  // 3) Estadísticas
  // Una reserva está "completada" si: estado=check_out, O estado_display=pagada/abonada y ya no está cancelada
  const esCompletada = (r: any) =>
    r.estado === 'check_out' || r.estado_display === 'pagada';

  const totalReservas = reservasEnriquecidas.length;
  const totalGastado = reservasEnriquecidas
    .filter(esCompletada)
    .reduce((sum: number, r: any) => sum + (r.total_reserva ?? 0), 0);
  const ultimaVisita = reservasEnriquecidas[0]?.check_in ?? null;
  const reservasCompletadas = reservasEnriquecidas.filter(esCompletada).length;

  // 4) Saldos disponibles
  const { data: saldos } = await db()
    .from('saldos_clientes')
    .select('id_saldo, monto, descripcion, tipo, fecha_creacion, aplicado')
    .eq('id_huesped', id)
    .eq('aplicado', false)
    .eq('tipo', 'credito')
    .order('fecha_creacion', { ascending: true });

  const saldoTotal = (saldos ?? []).reduce((sum: number, s: any) => sum + s.monto, 0);

  // 5) Preferencias derivadas del historial
  const reservasValidas = reservasEnriquecidas.filter((r: any) => !['cancelada', 'no_show'].includes(r.estado));
  const tipoCount: Record<string, number> = {};
  const pisoCount: Record<string, number> = {};
  const habCount: Record<string, number> = {};
  let totalNoches = 0, totalHuespedes = 0, nPref = 0;
  for (const r of reservasValidas) {
    const det = habitacionesDetalleMap[r.id_habitacion];
    if (det?.tipo) tipoCount[det.tipo] = (tipoCount[det.tipo] ?? 0) + 1;
    if (det?.piso) pisoCount[det.piso] = (pisoCount[det.piso] ?? 0) + 1;
    if (det?.nombre) habCount[det.nombre] = (habCount[det.nombre] ?? 0) + 1;
    const noches = Math.max(1, Math.round((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000));
    totalNoches += noches;
    totalHuespedes += (r.adultos ?? 1) + (r.ninos ?? 0);
    nPref++;
  }
  const preferencias = {
    habitacionFrecuente: Object.entries(habCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    tipoFrecuente: Object.entries(tipoCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    pisoFrecuente: Object.entries(pisoCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    promedioNoches: nPref > 0 ? Math.round(totalNoches / nPref) : null,
    promedioHuespedes: nPref > 0 ? Math.round(totalHuespedes / nPref) : null,
  };

  return res.json({
    ...huesped,
    reservas: reservasEnriquecidas,
    saldos: saldos ?? [],
    estadisticas: { totalReservas, totalGastado, ultimaVisita, reservasCompletadas, saldoTotal },
    preferencias,
  });
});

// PATCH /api/bookings/huespedes/:id — Editar datos de contacto
router.patch('/huespedes/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, telefono, ciudad, direccion } = req.body;

  const updates: Record<string, any> = {};
  if (nombre_completo !== undefined) updates.nombre_completo = nombre_completo;
  if (telefono !== undefined) updates.telefono = telefono || null;
  if (ciudad !== undefined) updates.ciudad = ciudad || null;
  if (direccion !== undefined) updates.direccion = direccion || null;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  const { data, error } = await db()
    .from('huespedes')
    .update(updates)
    .eq('id_huesped', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// ─── Reservas ─────────────────────────────────────────────────────────────────

// GET /api/bookings/reservas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/reservas', async (req, res) => {
  const { desde, hasta } = req.query as { desde?: string; hasta?: string };
  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Parámetros "desde" y "hasta" son requeridos' });
  }

  try {
    let query = db()
      .from('reservas_hotel')
      .select(`
        id_reserva_hotel,
        id_huesped,
        id_habitacion,
        id_hotel,
        id_empresa,
        check_in,
        check_out,
        adultos,
        ninos,
        estado,
        estado_pago,
        estado_display,
        total_reserva,
        moneda,
        observaciones,
        es_cortesia,
        tipo_reserva,
        created_at,
        huesped:huespedes(nombre_completo),
        habitacion:habitaciones(nombre_habitacion, hoteles(nombre_hotel)),
        pagos:pagos_hotel(id_pago_hotel, monto, moneda, metodo_pago, fecha_pago, estado),
        servicios:reserva_servicios(servicios_adicionales(nombre))
      `)
      .neq('estado', 'cancelada')
      .lt('check_in', hasta)
      .gt('check_out', desde);

    const hotelId = req.headers['x-hotel-id'];
    if (hotelId && hotelId !== 'all') {
      query = query.eq('id_hotel', hotelId);
    }

    const { data, error } = await query.order('check_in');

    if (error) throw error;

    // Fetch relacionados manualmente para mejor control de errores
    const result = (data ?? []).map((r: any) => {
      const servicios = r.servicios || [];
      const hasService = (name: string) => {
        return servicios.some((s: any) => s.servicios_adicionales?.nombre === name);
      };

      const mapped = {
        ...r,
        huesped: r.huesped?.nombre_completo ?? '',
        habitacion: r.habitacion?.nombre_habitacion ?? '',
        hotel: r.habitacion?.hoteles?.nombre_hotel ?? '',
        pagos: r.pagos ?? [],
        cama_extra: hasService('Cama Extra'),
        neverita: hasService('Neverita'),
        plancha: hasService('Plancha'),
        limpieza_diaria: hasService('Limpieza Diaria')
      };
      
      // Eliminar los objetos relacionales crudos para no engordar la respuesta
      delete mapped.huesped;
      delete mapped.habitacion;
      delete mapped.servicios;

      return mapped;
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Error en GET /reservas:', error);
    return res.status(500).json({ error: error?.message ?? 'Error desconocido' });
  }
});

// Utilidad para mapear de forma defensiva el estado_pago a valores permitidos por el constraint de Supabase
const mapEstadoPago = (estado: string | undefined | null, esCortesia: boolean, idEmpresa: string | null): string => {
  if (esCortesia) return 'cortesia';
  if (idEmpresa) return 'credito';

  if (!estado) return 'deuda';

  const normalizado = estado.toLowerCase().trim();
  if (normalizado === 'pagado') return 'pagado';
  if (normalizado === 'cortesia') return 'cortesia';
  if (normalizado === 'credito' || normalizado === 'crédito') return 'credito';
  if (normalizado === 'abonada' || normalizado === 'parcial' || normalizado === 'abonado') return 'abonada';

  return 'deuda'; // Mapeo defensivo para 'reservada', 'capital_pendiente', 'n/a', etc.
};

// POST /api/bookings/reservas
router.post('/reservas', async (req, res) => {
  const {
    id_huesped,
    id_habitacion,
    check_in,
    check_out,
    adultos,
    ninos,
    estado,
    total_reserva,
    moneda,
    observaciones,
    estado_pago,
    anticipo,
    es_cortesia,
    id_empresa,
    cama_extra,
    limpieza_diaria,
    neverita,
    plancha,
    origen_reserva,
    tipo_reserva,
  } = req.body;

  if (!id_huesped || !id_habitacion || !check_in || !check_out) {
    return res.status(400).json({ error: 'Faltan campos requeridos: id_huesped, id_habitacion, check_in, check_out' });
  }

  // Verificar disponibilidad de camas extras si se solicita una
  if (cama_extra) {
    const checkExtra = await verificarCamasExtrasDisponibles(check_in, check_out);
    if (!checkExtra.disponible) {
      const fechas = (checkExtra.fechasConSobrecupo || []).join(', ');
      return res.status(400).json({
        error: `No hay camas extras unipersonales disponibles para las siguientes fechas: [${fechas}]. Capacidad máxima del hotel: 3.`
      });
    }
  }

  // Verificar disponibilidad de neveritas si se solicita una
  if (neverita) {
    const checkNevera = await verificarNeveritasDisponibles(check_in, check_out);
    if (!checkNevera.disponible) {
      const fechas = (checkNevera.fechasConSobrecupo || []).join(', ');
      return res.status(400).json({
        error: `No hay neveritas/minibares disponibles para las siguientes fechas: [${fechas}]. Capacidad máxima del hotel: 1.`
      });
    }
  }

  // Verificar disponibilidad de planchas si se solicita una
  if (plancha) {
    const checkPlancha = await verificarPlanchasDisponibles(check_in, check_out);
    if (!checkPlancha.disponible) {
      const fechas = (checkPlancha.fechasConSobrecupo || []).join(', ');
      return res.status(400).json({
        error: `No hay planchas de ropa disponibles para las siguientes fechas: [${fechas}]. Capacidad máxima del hotel: 8.`
      });
    }
  }

  // Obtener id_hotel y owner_id de la habitación
  const { data: habitacion, error: habError } = await db()
    .from('habitaciones')
    .select('id_hotel, owner_id')
    .eq('id_habitacion', id_habitacion)
    .single();

  if (habError || !habitacion?.id_hotel || !habitacion?.owner_id) {
    return res.status(400).json({ error: 'Habitación no encontrada o no posee propietario asociado.' });
  }

  const { data, error } = await dbUser(req)
    .from('reservas_hotel')
    .insert({
      id_huesped,
      id_habitacion,
      id_hotel: habitacion.id_hotel,
      owner_id: habitacion.owner_id,
      check_in,
      check_out,
      adultos,
      ninos,
      estado: estado ?? 'confirmada',
      total_reserva,
      moneda,
      observaciones,
      estado_pago: mapEstadoPago(estado_pago, es_cortesia ?? false, id_empresa ?? null),
      anticipo: anticipo ?? 0,
      es_cortesia: es_cortesia ?? false,
      id_empresa: id_empresa ?? null,
      tipo_reserva: tipo_reserva ?? 'noche',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Guardar servicios adicionales contratados en la tabla intermedia
  if (data && data.id_reserva_hotel) {
    const servicesToInsert = [];
    if (cama_extra) servicesToInsert.push({ name: 'Cama Extra' });
    if (neverita) servicesToInsert.push({ name: 'Neverita' });
    if (plancha) servicesToInsert.push({ name: 'Plancha' });
    if (limpieza_diaria) servicesToInsert.push({ name: 'Limpieza Diaria' });

    if (servicesToInsert.length > 0) {
      const { data: dbServices } = await db()
        .from('servicios_adicionales')
        .select('id_servicio, nombre, precio_defecto')
        .in('nombre', servicesToInsert.map(s => s.name));

      if (dbServices && dbServices.length > 0) {
        await db().from('reserva_servicios').insert(
          dbServices.map(s => ({
            id_reserva_hotel: data.id_reserva_hotel,
            id_servicio: s.id_servicio,
            cantidad: 1,
            precio_unitario: s.precio_defecto,
            owner_id: habitacion.owner_id
          }))
        );
      }
    }
  }

  const token = extractToken(req);
  if (token && data?.id_reserva_hotel) {
    const { email } = getInfoFromToken(token);
    if (email) patchAuditUser(data.id_reserva_hotel, email);
  }

  // Enviar correo de confirmación de forma asíncrona
  if (data?.id_reserva_hotel) {
    (async () => {
      try {
        const { data: huesped } = await db()
          .from('huespedes')
          .select('nombre_completo, correo')
          .eq('id_huesped', data.id_huesped)
          .single();

        const { data: hotel } = await db()
          .from('negocios')
          .select('nombre')
          .eq('id_negocio', habitacion.id_hotel)
          .single();

        if (huesped && huesped.correo && hotel && hotel.nombre) {
          await sendBookingConfirmation({
            guestName: huesped.nombre_completo,
            guestEmail: huesped.correo,
            bookingId: data.id_reserva_hotel,
            checkIn: data.check_in,
            checkOut: data.check_out,
            totalAmount: data.total_reserva,
            currency: data.moneda,
            hotelName: hotel.nombre
          });
        }
      } catch (err) {
        console.error('Error enviando correo post-reserva:', err);
      }
    })();
  }

  // El trigger automáticamente calculó estado_display
  return res.status(201).json(data);
});

// PATCH /api/bookings/reservas/:id
router.patch('/reservas/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Obtener los datos existentes de la reserva
  const { data: reservaExistente } = await db()
    .from('reservas_hotel')
    .select('check_in, check_out, estado, id_habitacion, owner_id, es_cortesia, id_empresa')
    .eq('id_reserva_hotel', id)
    .single();

  if (!reservaExistente) {
    return res.status(404).json({ error: 'Reserva no encontrada' });
  }

  // Validar si es una reserva del pasado
  const hoyServer = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const existingCi = reservaExistente.check_in.split(/[T ]/)[0];
  const existingCo = reservaExistente.check_out.split(/[T ]/)[0];
  const isPast = reservaExistente.estado === 'check_in' ||
    reservaExistente.estado === 'check_out' ||
    reservaExistente.estado === 'cancelada' ||
    existingCi < hoyServer ||
    existingCo < hoyServer;

  if (isPast) {
    const tryingToChangeDates = (updates.check_in !== undefined && updates.check_in !== reservaExistente.check_in) ||
      (updates.check_out !== undefined && updates.check_out !== reservaExistente.check_out);
    const tryingToChangeRoom = (updates.id_habitacion !== undefined && updates.id_habitacion !== reservaExistente.id_habitacion);

    if (tryingToChangeDates || tryingToChangeRoom) {
      return res.status(400).json({ error: 'No se pueden modificar las fechas ni la habitación de una reserva del pasado.' });
    }
  }

  // Obtener los servicios existentes de la reserva
  const { data: dbExistingServices } = await db()
    .from('reserva_servicios')
    .select('servicios_adicionales(nombre)')
    .eq('id_reserva_hotel', id);

  const hasExistingService = (name: string) => {
    if (!dbExistingServices || !Array.isArray(dbExistingServices)) return false;
    return dbExistingServices.some((s: any) => s.servicios_adicionales?.nombre === name);
  };

  const finalCamaExtra = updates.cama_extra !== undefined ? updates.cama_extra : hasExistingService('Cama Extra');
  const finalNeverita = updates.neverita !== undefined ? updates.neverita : hasExistingService('Neverita');
  const finalPlancha = updates.plancha !== undefined ? updates.plancha : hasExistingService('Plancha');
  const finalLimpiezaDiaria = updates.limpieza_diaria !== undefined ? updates.limpieza_diaria : hasExistingService('Limpieza Diaria');

  // Si se está modificando check_in, check_out, cama_extra, neverita o plancha
  if (
    updates.cama_extra !== undefined ||
    updates.neverita !== undefined ||
    updates.plancha !== undefined ||
    updates.check_in !== undefined ||
    updates.check_out !== undefined
  ) {

    if (reservaExistente && reservaExistente.estado !== 'cancelada') {
      const finalCheckIn = updates.check_in !== undefined ? updates.check_in : reservaExistente.check_in;
      const finalCheckOut = updates.check_out !== undefined ? updates.check_out : reservaExistente.check_out;

      if (finalCamaExtra) {
        const checkExtra = await verificarCamasExtrasDisponibles(finalCheckIn, finalCheckOut, id);
        if (!checkExtra.disponible) {
          const fechas = (checkExtra.fechasConSobrecupo || []).join(', ');
          return res.status(400).json({
            error: `No hay camas extras unipersonales disponibles para las siguientes fechas: [${fechas}]. Capacidad máxima del hotel: 3.`
          });
        }
      }

      if (finalNeverita) {
        const checkNevera = await verificarNeveritasDisponibles(finalCheckIn, finalCheckOut, id);
        if (!checkNevera.disponible) {
          const fechas = (checkNevera.fechasConSobrecupo || []).join(', ');
          return res.status(400).json({
            error: `No hay neveritas/minibares disponibles para las siguientes fechas: [${fechas}]. Capacidad máxima del hotel: 1.`
          });
        }
      }

      if (finalPlancha) {
        const checkPlancha = await verificarPlanchasDisponibles(finalCheckIn, finalCheckOut, id);
        if (!checkPlancha.disponible) {
          const fechas = (checkPlancha.fechasConSobrecupo || []).join(', ');
          return res.status(400).json({
            error: `No hay planchas de ropa disponibles para las siguientes fechas: [${fechas}]. Capacidad máxima del hotel: 8.`
          });
        }
      }
    }
  }

  // Quitar los booleanos heredados antes de actualizar para evitar que falle
  const { cama_extra, neverita, plancha, limpieza_diaria, ...reservasUpdates } = updates;

  // Mapear el estado_pago defensivamente en las actualizaciones si se provee
  if (reservasUpdates.estado_pago !== undefined) {
    reservasUpdates.estado_pago = mapEstadoPago(
      reservasUpdates.estado_pago,
      updates.es_cortesia !== undefined ? updates.es_cortesia : (reservaExistente as any).es_cortesia,
      updates.id_empresa !== undefined ? updates.id_empresa : (reservaExistente as any).id_empresa
    );
  }

  const { error } = await dbUser(req)
    .from('reservas_hotel')
    .update(reservasUpdates)
    .eq('id_reserva_hotel', id);

  if (error) return res.status(500).json({ error: error.message });

  // Si se pasaron actualizaciones de servicios, recrear la tabla intermedia
  if (
    updates.cama_extra !== undefined ||
    updates.neverita !== undefined ||
    updates.plancha !== undefined ||
    updates.limpieza_diaria !== undefined
  ) {
    await db().from('reserva_servicios').delete().eq('id_reserva_hotel', id);

    const servicesToInsert = [];
    if (finalCamaExtra) servicesToInsert.push({ name: 'Cama Extra' });
    if (finalNeverita) servicesToInsert.push({ name: 'Neverita' });
    if (finalPlancha) servicesToInsert.push({ name: 'Plancha' });
    if (finalLimpiezaDiaria) servicesToInsert.push({ name: 'Limpieza Diaria' });

    if (servicesToInsert.length > 0) {
      const { data: dbServices } = await db()
        .from('servicios_adicionales')
        .select('id_servicio, nombre, precio_defecto')
        .in('nombre', servicesToInsert.map(s => s.name));

      if (dbServices && dbServices.length > 0) {
        await db().from('reserva_servicios').insert(
          dbServices.map(s => ({
            id_reserva_hotel: id,
            id_servicio: s.id_servicio,
            cantidad: 1,
            precio_unitario: s.precio_defecto,
            owner_id: (reservaExistente as any).owner_id
          }))
        );
      }
    }
  }

  const token = extractToken(req);
  if (token) { const { email } = getInfoFromToken(token); if (email) patchAuditUser(id, email); }

  return res.json({ success: true });
});

// DELETE /api/bookings/reservas/:id  (cancelar)
router.delete('/reservas/:id', async (req, res) => {
  const { id } = req.params;
  const anularPagos = req.query.anularPagos === 'true';

  try {
    // Si debe anular pagos, obtener primero la reserva y sus pagos
    if (anularPagos) {
      const { data: reserva } = await db()
        .from('reservas_hotel')
        .select('id_huesped, total_reserva')
        .eq('id_reserva_hotel', id)
        .single();

      if (reserva) {
        const { data: pagosActivos } = await db()
          .from('pagos_hotel')
          .select('monto')
          .eq('id_reserva_hotel', id)
          .neq('estado', 'anulado');

        const totalPagado = (pagosActivos ?? []).reduce((s: number, p: { monto: number }) => s + p.monto, 0);

        // Anular los pagos
        if (totalPagado > 0) {
          const token = extractToken(req);
          const email = token ? getInfoFromToken(token).email : 'Desconocido';
          const notasAnulacion = `Anulado por cancelación de reserva (Usuario: ${email})`;

          const { data: pagosHotel } = await db()
            .from('pagos_hotel')
            .select('id_pago_hotel, notas')
            .eq('id_reserva_hotel', id)
            .neq('estado', 'anulado');

          for (const p of pagosHotel ?? []) {
            const nuevasNotas = p.notas ? `${p.notas}\n${notasAnulacion}` : notasAnulacion;
            await db()
              .from('pagos_hotel')
              .update({ estado: 'anulado', notas: nuevasNotas })
              .eq('id_pago_hotel', p.id_pago_hotel);
          }

          // Registrar el saldo en saldos_clientes para posterior crédito
          const { error: saldoError } = await db()
            .from('saldos_clientes')
            .insert({
              id_huesped: reserva.id_huesped,
              monto: totalPagado,
              descripcion: `Pago anulado por cancelación de reserva ${id}`,
              tipo: 'credito',
              fecha_creacion: new Date().toISOString(),
            });
          if (saldoError) console.error('Error registrando saldo:', saldoError);
        }
      }
    }

    // Usar token del usuario para que auth.uid() funcione en el trigger de auditoría
    const { error } = await dbUser(req)
      .from('reservas_hotel')
      .update({ estado: 'cancelada', estado_display: 'cancelada' })
      .eq('id_reserva_hotel', id);

    if (error) {
      console.error('Error al cancelar reserva:', error.message, error.details, error.hint);
      return res.status(500).json({ error: error.message });
    }

    const token = extractToken(req);
    if (token) { const { email } = getInfoFromToken(token); if (email) patchAuditUser(id, email); }

    return res.json({ success: true });
  } catch (e) {
    console.error('Error en cancelación:', e instanceof Error ? e.message : e);
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Error desconocido' });
  }
});

// ─── Saldos Clientes ─────────────────────────────────────────────────────────

// GET /api/bookings/saldos
router.get('/saldos', async (req, res) => {
  const hotelId = req.headers['x-hotel-id'] || 'all';

  if (hotelId && hotelId !== 'all') {
    // Obtener los ids de huéspedes con reservas en este hotel
    const { data: reservas, error: rErr } = await db()
      .from('reservas_hotel')
      .select('id_huesped')
      .eq('id_hotel', hotelId);

    if (rErr) return res.status(500).json({ error: rErr.message });

    const idsHuespedes = [...new Set((reservas ?? []).map(r => r.id_huesped).filter(Boolean))];

    if (idsHuespedes.length === 0) {
      return res.json([]);
    }

    const { data, error } = await db()
      .from('saldos_clientes')
      .select('*, huesped:huespedes(nombre_completo)')
      .in('id_huesped', idsHuespedes)
      .order('fecha_creacion', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } else {
    const { data, error } = await db()
      .from('saldos_clientes')
      .select('*, huesped:huespedes(nombre_completo)')
      .order('fecha_creacion', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  }
});

// GET /api/bookings/estado-cuenta/:id_huesped
// Devuelve todos los movimientos del cliente: pagos + saldos, ordenados por fecha
router.get('/estado-cuenta/:id_huesped', async (req, res) => {
  const { id_huesped } = req.params;
  const hotelId = req.headers['x-hotel-id'];

  // 1) Pagos realizados por este cliente (a través de reservas)
  // Excluir reservas de cortesía (no generan cobro) y canceladas sin pagos previos
  let queryReservas = db()
    .from('reservas_hotel')
    .select('id_reserva_hotel, check_in, check_out, total_reserva, moneda, estado, id_habitacion, es_cortesia, id_hotel')
    .eq('id_huesped', id_huesped)
    .eq('es_cortesia', false);

  if (hotelId && hotelId !== 'all') {
    queryReservas = queryReservas.eq('id_hotel', hotelId);
  }

  const { data: reservas } = await queryReservas;

  const movimientos: any[] = [];

  for (const r of reservas ?? []) {
    // Nombre habitación
    const { data: hab } = await db()
      .from('habitaciones')
      .select('nombre')
      .eq('id_habitacion', r.id_habitacion)
      .single();
    const nombreHab = hab?.nombre ?? `Hab. …${String(r.id_habitacion).slice(-4)}`;

    const { data: pagos } = await db()
      .from('pagos_hotel')
      .select('id_pago_hotel, monto, moneda, metodo_pago, referencia, fecha_pago, estado, notas')
      .eq('id_reserva_hotel', r.id_reserva_hotel)
      .order('fecha_pago', { ascending: false });

    for (const p of pagos ?? []) {
      const METODO_LABELS: Record<string, string> = {
        efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
        deposito: 'Depósito', canje: 'Canje', otro: 'Otro',
      };
      movimientos.push({
        id: p.id_pago_hotel,
        fecha: p.fecha_pago ?? r.check_in,
        tipo: p.estado === 'anulado' ? 'pago_anulado' : 'pago',
        descripcion: `Pago — ${nombreHab} (${r.check_in?.split('T')[0]} → ${r.check_out?.split('T')[0]})${p.notas ? ' · ' + p.notas : ''}`,
        monto: p.monto,
        moneda: p.moneda ?? r.moneda ?? 'HNL',
        metodo: METODO_LABELS[p.metodo_pago] ?? p.metodo_pago,
        referencia: p.referencia ?? null,
        reserva_info: `${nombreHab} · Check-in ${r.check_in?.split('T')[0]}`,
        id_reserva_hotel: r.id_reserva_hotel,
        estado_pago: p.estado,
        signo: p.estado === 'anulado' ? 'anulado' : 'cargo',
      });
    }
  }

  // 2) Movimientos en saldos_clientes (créditos por cancelación, aplicaciones, devoluciones)
  const { data: saldos } = await db()
    .from('saldos_clientes')
    .select('*')
    .eq('id_huesped', id_huesped)
    .order('fecha_creacion', { ascending: false });

  for (const s of saldos ?? []) {
    movimientos.push({
      id: s.id_saldo,
      fecha: s.fecha_creacion,
      tipo: s.tipo === 'credito' ? (s.aplicado ? 'credito_aplicado' : 'credito') : s.tipo,
      descripcion: s.descripcion,
      monto: s.monto,
      moneda: 'HNL',
      metodo: null,
      referencia: null,
      reserva_info: null,
      id_saldo: s.id_saldo,
      aplicado: s.aplicado,
      fecha_aplicacion: s.fecha_aplicacion,
      signo: s.tipo === 'debito' ? 'cargo' : 'abono',
      es_saldo: true,
    });
  }

  // Ordenar por fecha descendente
  movimientos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return res.json(movimientos);
});

// GET /api/bookings/saldos/reservas-pendientes/:id_huesped
router.get('/saldos/reservas-pendientes/:id_huesped', async (req, res) => {
  const { id_huesped } = req.params;
  const hotelId = req.headers['x-hotel-id'];

  let queryReservas = db()
    .from('reservas_hotel')
    .select('id_reserva_hotel, check_in, check_out, total_reserva, estado, id_habitacion, id_hotel')
    .eq('id_huesped', id_huesped)
    .not('estado', 'in', '("cancelada","no_show","check_out")');

  if (hotelId && hotelId !== 'all') {
    queryReservas = queryReservas.eq('id_hotel', hotelId);
  }

  const { data: reservas, error } = await queryReservas.order('check_in', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const result = [];
  for (const r of reservas ?? []) {
    const { data: pagos } = await db()
      .from('pagos_hotel')
      .select('monto')
      .eq('id_reserva_hotel', r.id_reserva_hotel)
      .neq('estado', 'anulado');

    const totalPagado = (pagos ?? []).reduce((s: number, p: { monto: number }) => s + p.monto, 0);
    const pendiente = (r.total_reserva ?? 0) - totalPagado;

    if (pendiente > 0.01) {
      const { data: hab } = await db()
        .from('habitaciones')
        .select('nombre')
        .eq('id_habitacion', r.id_habitacion)
        .single();

      result.push({
        id_reserva_hotel: r.id_reserva_hotel,
        check_in: r.check_in,
        check_out: r.check_out,
        total_reserva: r.total_reserva,
        saldo_pendiente: pendiente,
        habitacion: hab?.nombre ?? `Hab. …${String(r.id_habitacion).slice(-4)}`,
      });
    }
  }

  return res.json(result);
});

// POST /api/bookings/saldos/:id/aplicar
router.post('/saldos/:id/aplicar', async (req, res) => {
  const { id } = req.params;
  const { id_reserva_hotel } = req.body as { id_reserva_hotel: string };

  if (!id_reserva_hotel) return res.status(400).json({ error: 'id_reserva_hotel requerido' });

  const { data: saldo, error: sErr } = await db()
    .from('saldos_clientes')
    .select('monto, aplicado')
    .eq('id_saldo', id)
    .single();

  if (sErr || !saldo) return res.status(404).json({ error: 'Saldo no encontrado' });
  if (saldo.aplicado) return res.status(400).json({ error: 'Este saldo ya fue aplicado' });

  const { data: pagos } = await db()
    .from('pagos_hotel')
    .select('monto')
    .eq('id_reserva_hotel', id_reserva_hotel)
    .neq('estado', 'anulado');

  const { data: reserva } = await db()
    .from('reservas_hotel')
    .select('total_reserva')
    .eq('id_reserva_hotel', id_reserva_hotel)
    .single();

  const totalPagado = (pagos ?? []).reduce((s: number, p: { monto: number }) => s + p.monto, 0);
  const pendiente = (reserva?.total_reserva ?? 0) - totalPagado;
  const montoAplicar = Math.min(saldo.monto, pendiente > 0 ? pendiente : saldo.monto);

  // Usar fecha local del servidor (toLocaleDateString evita la coma de toLocaleString)
  const hoyServer = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  const { error: pagoErr } = await db()
    .from('pagos_hotel')
    .insert({
      id_reserva_hotel,
      monto: montoAplicar,
      moneda: 'HNL', // Saldos siempre están en HNL
      metodo_pago: 'transferencia',
      fecha_pago: hoyServer,
      estado: 'registrado',
      notas: `Aplicado desde saldo de cliente (saldo ID: ${id})`,
    });

  if (pagoErr) return res.status(500).json({ error: pagoErr.message });

  const { error: saldoErr } = await db()
    .from('saldos_clientes')
    .update({ aplicado: true, fecha_aplicacion: new Date().toISOString() })
    .eq('id_saldo', id);

  if (saldoErr) return res.status(500).json({ error: saldoErr.message });

  return res.json({ success: true, monto_aplicado: montoAplicar, diferencia: saldo.monto - montoAplicar });
});

// PATCH /api/bookings/saldos/:id  (devolver / marcar aplicado manualmente)
router.patch('/saldos/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await db()
    .from('saldos_clientes')
    .update({ aplicado: true, fecha_aplicacion: new Date().toISOString() })
    .eq('id_saldo', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// ─── Bloqueos ─────────────────────────────────────────────────────────────────

// GET /api/bookings/bloqueos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/bloqueos', async (req, res) => {
  const { desde, hasta } = req.query as { desde?: string; hasta?: string };
  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Parámetros "desde" y "hasta" son requeridos' });
  }

  let query = db()
    .from('bloqueos_habitacion')
    .select('*, habitaciones!inner(id_hotel)')
    .lt('fecha_inicio', hasta)
    .gt('fecha_fin', desde);

  const hotelId = req.headers['x-hotel-id'];
  if (hotelId && hotelId !== 'all') {
    query = query.eq('habitaciones.id_hotel', hotelId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('Tabla bloqueos_habitacion no disponible:', error.message);
    return res.json([]);
  }
  return res.json((data ?? []).map((b: any) => ({
    ...b,
    habitaciones: undefined
  })));
});

// POST /api/bookings/bloqueos/toggle
router.post('/bloqueos/toggle', async (req, res) => {
  const { id_habitacion, fecha, motivo } = req.body;
  if (!id_habitacion || !fecha) {
    return res.status(400).json({ error: 'id_habitacion y fecha son requeridos' });
  }

  try {
    const dateStr = fecha.split('T')[0];
    const fechaInicio = `${dateStr}T00:00:00.000Z`;
    const fechaFin = `${dateStr}T23:59:59.999Z`;

    // Buscar si ya existe un bloqueo para esta fecha y habitación
    const { data: existente, error: findError } = await db()
      .from('bloqueos_habitacion')
      .select('*')
      .eq('id_habitacion', id_habitacion)
      .lte('fecha_inicio', fechaFin)
      .gte('fecha_fin', fechaInicio);

    if (findError) {
      return res.status(500).json({ error: findError.message });
    }

    if (existente && existente.length > 0) {
      // Ya existe, eliminarlo
      const idsAEliminar = existente.map(e => e.id_bloqueo);
      const { error: deleteError } = await db()
        .from('bloqueos_habitacion')
        .delete()
        .in('id_bloqueo', idsAEliminar);

      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }
      return res.json({ success: true, action: 'removed', idsRemoved: idsAEliminar });
    } else {
      // Obtener owner_id de la habitación
      const { data: hab, error: habError } = await db()
        .from('habitaciones')
        .select('owner_id')
        .eq('id_habitacion', id_habitacion)
        .single();

      if (habError || !hab?.owner_id) {
        return res.status(400).json({ error: 'Habitación no encontrada o no posee propietario asociado.' });
      }

      // No existe, crearlo
      const { data: creado, error: insertError } = await db()
        .from('bloqueos_habitacion')
        .insert({
          id_habitacion,
          owner_id: hab.owner_id,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          motivo: motivo || 'Bloqueo rápido desde calendario'
        })
        .select();

      if (insertError) {
        return res.status(500).json({ error: insertError.message });
      }
      return res.json({ success: true, action: 'added', data: creado });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/bloqueos
router.post('/bloqueos', async (req, res) => {
  const { id_habitacion, fecha_inicio, fecha_fin, motivo } = req.body;
  if (!id_habitacion || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'id_habitacion, fecha_inicio y fecha_fin son requeridos' });
  }

  // Obtener owner_id de la habitación
  const { data: hab, error: habError } = await db()
    .from('habitaciones')
    .select('owner_id')
    .eq('id_habitacion', id_habitacion)
    .single();

  if (habError || !hab?.owner_id) {
    return res.status(400).json({ error: 'Habitación no encontrada o no posee propietario asociado.' });
  }

  const { data, error } = await db()
    .from('bloqueos_habitacion')
    .insert({
      id_habitacion,
      owner_id: hab.owner_id,
      fecha_inicio,
      fecha_fin,
      motivo: motivo || 'Bloqueo'
    })
    .select();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data?.[0] ?? null);
});

// DELETE /api/bookings/bloqueos/:id
router.delete('/bloqueos/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await db()
    .from('bloqueos_habitacion')
    .delete()
    .eq('id_bloqueo', id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});


// ─── Pagos ────────────────────────────────────────────────────────────────────

// GET /api/bookings/pagos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&id_reserva=...
router.get('/pagos', async (req, res) => {
  const { desde, hasta, id_reserva } = req.query as { desde?: string; hasta?: string; id_reserva?: string };

  let query = db()
    .from('pagos_hotel')
    .select(`
      id_pago_hotel,
      id_reserva_hotel,
      monto,
      moneda,
      metodo_pago,
      referencia,
      fecha_pago,
      estado,
      notas,
      created_at,
      reservas_hotel!inner (
        id_reserva_hotel,
        id_hotel,
        check_in,
        check_out,
        total_reserva,
        moneda,
        huespedes ( nombre_completo ),
        habitaciones ( nombre_habitacion, hoteles ( nombre_hotel ) )
      )
    `)
    .order('fecha_pago', { ascending: false });

  if (id_reserva) {
    query = query.eq('id_reserva_hotel', id_reserva);
  } else {
    if (desde) query = query.gte('fecha_pago', desde);
    if (hasta) query = query.lte('fecha_pago', hasta + 'T23:59:59');
  }

  const hotelId = req.headers['x-hotel-id'];
  if (hotelId && hotelId !== 'all') {
    query = query.eq('reservas_hotel.id_hotel', hotelId);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const result = (data ?? []).map((p: any) => ({
    id_pago_hotel: p.id_pago_hotel,
    id_reserva_hotel: p.id_reserva_hotel,
    monto: p.monto,
    moneda: p.moneda,
    metodo_pago: p.metodo_pago,
    referencia: p.referencia,
    fecha_pago: p.fecha_pago,
    estado: p.estado,
    notas: p.notas,
    created_at: p.created_at,
    huesped: p.reservas_hotel?.huespedes?.nombre_completo ?? '',
    habitacion: p.reservas_hotel?.habitaciones?.nombre_habitacion ?? '',
    hotel: p.reservas_hotel?.habitaciones?.hoteles?.nombre_hotel ?? '',
    check_in: p.reservas_hotel?.check_in ?? '',
    check_out: p.reservas_hotel?.check_out ?? '',
    total_reserva: p.reservas_hotel?.total_reserva ?? 0,
  }));

  return res.json(result);
});

// POST /api/bookings/pagos
router.post('/pagos', async (req, res) => {
  const { id_reserva_hotel, monto, moneda, metodo_pago, referencia, estado, notas } = req.body;
  if (!id_reserva_hotel || !monto || !metodo_pago) {
    return res.status(400).json({ error: 'Faltan campos requeridos: id_reserva_hotel, monto, metodo_pago' });
  }

  // Obtener owner_id de la reserva asociada
  const { data: reserva, error: resError } = await db()
    .from('reservas_hotel')
    .select('owner_id')
    .eq('id_reserva_hotel', id_reserva_hotel)
    .single();

  if (resError || !reserva?.owner_id) {
    return res.status(400).json({ error: 'Reserva no encontrada o no posee propietario asociado.' });
  }
  const owner_id = reserva.owner_id;

  // Para registros nuevos, usar ALWAYS la fecha del servidor (toLocaleDateString evita la coma de toLocaleString)
  const hoyServer = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const { data: nuevoPago, error } = await db()
    .from('pagos_hotel')
    .insert({
      id_reserva_hotel,
      owner_id,
      monto: Number(monto),
      moneda: moneda ?? 'HNL',
      monto_en_moneda_reserva: Number(monto),
      metodo_pago,
      referencia: referencia ?? null,
      fecha_pago: hoyServer,
      estado: estado ?? 'registrado',
      notas: notas ?? null,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // ── Actualizar estado_display de la reserva según total pagado ──
  try {
    const { data: reserva } = await db()
      .from('reservas_hotel')
      .select('total_reserva, estado, es_cortesia, id_empresa, estado_display')
      .eq('id_reserva_hotel', id_reserva_hotel)
      .single();

    if (reserva && !reserva.es_cortesia && !['cancelada', 'no_show'].includes(reserva.estado)) {
      const { data: pagosActivos } = await db()
        .from('pagos_hotel')
        .select('monto')
        .eq('id_reserva_hotel', id_reserva_hotel)
        .neq('estado', 'anulado');

      const totalPagado = (pagosActivos ?? []).reduce((s: number, p: { monto: number }) => s + p.monto, 0);
      const totalReserva = reserva.total_reserva ?? 0;

      let nuevoDisplay: string | null = null;
      if (totalPagado >= totalReserva - 0.01) {
        nuevoDisplay = 'pagada';
      } else if (totalPagado > 0) {
        nuevoDisplay = reserva.id_empresa ? 'credito' : 'abonada';
      }

      // No tocar check_in / check_out aunque esté pagada (son estados operativos)
      if (nuevoDisplay && !['check_in', 'check_out'].includes(reserva.estado)) {
        await db()
          .from('reservas_hotel')
          .update({ estado_display: nuevoDisplay })
          .eq('id_reserva_hotel', id_reserva_hotel);
      }
    }
  } catch (e) {
    console.error('Error en recalc estado_display:', e instanceof Error ? e.message : e);
  }

  return res.status(201).json(nuevoPago);
});

// POST /api/bookings/split
router.post('/split', async (req, res) => {
  const { id_reserva_hotel, fecha_split } = req.body;
  if (!id_reserva_hotel || !fecha_split) {
    return res.status(400).json({ error: 'Faltan campos requeridos: id_reserva_hotel, fecha_split' });
  }

  const { data, error } = await db()
    .rpc('fn_split_reserva', {
      p_id_reserva_hotel: id_reserva_hotel,
      p_fecha_split: fecha_split,
    });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
});

// PATCH /api/bookings/pagos/:id
router.patch('/pagos/:id', async (req, res) => {
  const { id } = req.params;
  const { monto, moneda, metodo_pago, referencia, fecha_pago, estado, notas } = req.body;
  const { error } = await db()
    .from('pagos_hotel')
    .update({ monto, moneda, metodo_pago, referencia, fecha_pago, estado, notas })
    .eq('id_pago_hotel', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// DELETE /api/bookings/pagos/:id  (anular)
router.delete('/pagos/:id', async (req, res) => {
  const { id } = req.params;
  const motivo = req.query.motivo || req.body.motivo || 'No especificado';

  // Obtener el pago antes de anular para poder recalcular y registrar saldo
  const { data: pagoAntes } = await db()
    .from('pagos_hotel')
    .select('id_reserva_hotel, monto, estado, notas')
    .eq('id_pago_hotel', id)
    .single();

  if (pagoAntes?.estado === 'anulado') {
    return res.status(400).json({ error: 'Este pago ya está anulado' });
  }

  const token = extractToken(req);
  const email = token ? getInfoFromToken(token).email : 'Desconocido';
  const notasAnulacion = `Anulado por: ${email} (Motivo: ${motivo})`;
  const nuevasNotas = pagoAntes?.notas ? `${pagoAntes.notas}\n${notasAnulacion}` : notasAnulacion;

  const { error } = await db()
    .from('pagos_hotel')
    .update({ estado: 'anulado', notas: nuevasNotas })
    .eq('id_pago_hotel', id);
  if (error) return res.status(500).json({ error: error.message });

  if (pagoAntes?.id_reserva_hotel) {
    const reservaId = pagoAntes.id_reserva_hotel;
    try {
      const { data: reserva } = await db()
        .from('reservas_hotel')
        .select('total_reserva, estado, es_cortesia, id_empresa, id_huesped')
        .eq('id_reserva_hotel', reservaId)
        .single();

      if (reserva) {
        // ── Registrar saldo del cliente si la reserva NO está cancelada ──
        // (si está cancelada ya se registró el saldo al cancelar)
        if (!['cancelada', 'no_show'].includes(reserva.estado) && reserva.id_huesped) {
          const { error: saldoErr } = await db()
            .from('saldos_clientes')
            .insert({
              id_huesped: reserva.id_huesped,
              monto: pagoAntes.monto,
              descripcion: `Pago anulado manualmente (reserva ${reservaId.slice(-8)})`,
              tipo: 'credito',
              fecha_creacion: new Date().toISOString(),
            });
          if (saldoErr) console.error('Error registrando saldo tras anulación:', saldoErr);
        }

        // ── Recalcular estado_display ──
        if (!reserva.es_cortesia && !['cancelada', 'no_show', 'check_in', 'check_out'].includes(reserva.estado)) {
          const { data: pagosActivos } = await db()
            .from('pagos_hotel')
            .select('monto')
            .eq('id_reserva_hotel', reservaId)
            .neq('estado', 'anulado');

          const totalPagado = (pagosActivos ?? []).reduce((s: number, p: { monto: number }) => s + p.monto, 0);
          const totalReserva = reserva.total_reserva ?? 0;

          let nuevoDisplay: string;
          if (totalPagado >= totalReserva - 0.01) {
            nuevoDisplay = 'pagada';
          } else if (totalPagado > 0) {
            nuevoDisplay = reserva.id_empresa ? 'credito' : 'abonada';
          } else {
            nuevoDisplay = reserva.id_empresa ? 'credito' : 'reservada';
          }

          await db()
            .from('reservas_hotel')
            .update({ estado_display: nuevoDisplay })
            .eq('id_reserva_hotel', reservaId);
        }
      }
    } catch (e) {
      console.error('Error post-anulación:', e instanceof Error ? e.message : e);
    }
  }

  return res.json({ success: true });
});

// ─── KPIs Dashboard ────────────────────────────────────────────────────────────

// GET /api/bookings/kpis/ocupacion-actual
// GET /api/bookings/kpis/ocupacion-actual
router.get('/kpis/ocupacion-actual', async (req, res) => {
  try {
    const hotelId = req.headers['x-hotel-id'];

    // 1. Obtener habitaciones (filtrando por hotel si aplica)
    let queryHab = db().from('habitaciones').select('estado');
    if (hotelId && hotelId !== 'all') {
      queryHab = queryHab.eq('id_hotel', hotelId);
    }
    const { data: habs, error: habError } = await queryHab;
    if (habError) throw habError;

    const totalHabitaciones = habs?.length || 0;
    const ocupadas = habs?.filter(h => h.estado === 'ocupada').length || 0;

    const ocupacion = totalHabitaciones && totalHabitaciones > 0
      ? Math.round((ocupadas / totalHabitaciones) * 100)
      : 0;

    return res.json({ ocupacion });
  } catch (e) {
    console.error('Error calculando ocupación:', e instanceof Error ? e.message : e);
    return res.json({ ocupacion: 0 });
  }
});

// GET /api/bookings/kpis/ingresos-hoy
router.get('/kpis/ingresos-hoy', async (req, res) => {
  try {
    const hotelId = req.headers['x-hotel-id'];
    const hoy = new Date().toLocaleDateString('en-CA'); // fecha local del servidor
    const mañana = new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-CA');

    // Pagos de hoy que NO estén anulados
    let query = db()
      .from('pagos_hotel')
      .select('monto, reservas_hotel!inner(id_hotel)')
      .gte('fecha_pago', hoy)
      .lt('fecha_pago', mañana)
      .neq('estado', 'anulado');

    if (hotelId && hotelId !== 'all') {
      query = query.eq('reservas_hotel.id_hotel', hotelId);
    }

    const { data: pagos, error } = await query;
    if (error) throw error;

    const ingresos = (pagos ?? []).reduce((sum, p) => sum + (p.monto || 0), 0);
    return res.json({ ingresosHoy: Math.round(ingresos * 100) / 100 });
  } catch (e) {
    console.error('Error calculando ingresos hoy:', e instanceof Error ? e.message : e);
    return res.json({ ingresosHoy: 0 });
  }
});

// GET /api/bookings/kpis/ingresos-mes
router.get('/kpis/ingresos-mes', async (req, res) => {
  try {
    const hotelId = req.headers['x-hotel-id'];
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      .toLocaleDateString('en-CA');
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
      .toLocaleDateString('en-CA');

    // Pagos del mes que NO estén anulados (ingresos reales)
    let query = db()
      .from('pagos_hotel')
      .select('monto, reservas_hotel!inner(id_hotel)')
      .gte('fecha_pago', primerDia)
      .lte('fecha_pago', ultimoDia)
      .neq('estado', 'anulado');

    if (hotelId && hotelId !== 'all') {
      query = query.eq('reservas_hotel.id_hotel', hotelId);
    }

    const { data: pagos, error } = await query;
    if (error) throw error;

    const ingresos = (pagos ?? []).reduce((sum, p) => sum + (p.monto || 0), 0);
    const gastos = Math.round(ingresos * 0.25); // Estimado: 25% de ingresos
    const neto = ingresos - gastos;

    return res.json({
      ingresosMes: Math.round(ingresos * 100) / 100,
      gastosMes: Math.round(gastos * 100) / 100,
      netoMes: Math.round(neto * 100) / 100,
    });
  } catch (e) {
    console.error('Error calculando ingresos mes:', e instanceof Error ? e.message : e);
    return res.json({ ingresosMes: 0, gastosMes: 0, netoMes: 0 });
  }
});

// GET /api/bookings/kpis/tendencias-ocupacion
router.get('/kpis/tendencias-ocupacion', async (req, res) => {
  try {
    const hotelId = req.headers['x-hotel-id'];
    const tendencias: Array<{ dia: string; fecha: string; ocupacion: number }> = [];
    const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sab', 'Dom'];

    let queryHab = db().from('habitaciones').select('*', { count: 'exact', head: true });
    if (hotelId && hotelId !== 'all') {
      queryHab = queryHab.eq('id_hotel', hotelId);
    }
    const { count: totalHabitaciones, error: habError } = await queryHab;
    if (habError) throw habError;

    if (!totalHabitaciones || totalHabitaciones === 0) {
      return res.json([]);
    }

    // Calcular para últimos 7 días
    const hoy = new Date();
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
      const fechaStr = fecha.toLocaleDateString('en-CA');
      const diaIndex = fecha.getDay();
      const diaNombre = dias[diaIndex === 0 ? 6 : diaIndex - 1];

      // Contar reservas que incluyen esta fecha
      let queryRes = db()
        .from('reservas_hotel')
        .select('*', { count: 'exact', head: true })
        .lte('check_in', `${fechaStr}T23:59:59`)
        .gt('check_out', `${fechaStr}T00:00:00`)
        .in('estado', ['confirmada', 'check_in', 'check_out']);

      if (hotelId && hotelId !== 'all') {
        queryRes = queryRes.eq('id_hotel', hotelId);
      }

      const { count: ocupadas, error: resError } = await queryRes;
      if (resError) throw resError;

      const ocupacion = Math.round(((ocupadas || 0) / totalHabitaciones) * 100);
      tendencias.push({ dia: diaNombre, fecha: fechaStr, ocupacion });
    }

    return res.json(tendencias);
  } catch (e) {
    console.error('Error calculando tendencias:', e instanceof Error ? e.message : e);
    return res.json([]);
  }
});

// ─── Importación desde Excel ───────────────────────────────────────────────────
const upload = multer({ dest: os.tmpdir() });

router.post('/simulate-import', upload.single('file') as any, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }

  let scriptPath = path.resolve('src/scripts/extract_reservas_final.py');
  if (!fs.existsSync(scriptPath)) {
    scriptPath = path.resolve('backend/src/scripts/extract_reservas_final.py');
  }

  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: 'No se encontró el script de Python.' });
  }

  // openpyxl requiere que el archivo tenga la extensión .xlsx para poder procesarlo
  const originalExt = path.extname(req.file.originalname) || '.xlsx';
  const excelPath = req.file.path + originalExt;
  fs.renameSync(req.file.path, excelPath);

  exec(`python "${scriptPath}" "${excelPath}"`, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }, (error, stdout, stderr) => {
    // Intentar borrar el archivo temporal subido
    fs.unlink(excelPath, () => { });

    if (error) {
      console.error('Error ejecutando script python:', stderr);
      return res.status(500).json({ error: `Error en Python: ${stderr || error.message}` });
    }

    const jsonPath = path.join(os.tmpdir(), 'reservas_final.json');
    if (!fs.existsSync(jsonPath)) {
      return res.status(500).json({ error: 'El script no generó el archivo de resultados' });
    }

    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: 'Error leyendo resultados de simulación' });
    }
  });
});

router.post('/bulk-import', async (req, res) => {
  const hotelId = req.headers['x-hotel-id'];
  if (!hotelId || hotelId === 'all') {
    return res.status(400).json({ error: 'Debe seleccionar un hotel específico para importar reservas.' });
  }

  try {
    const { data: hotelData, error: hotelError } = await db()
      .from('hoteles')
      .select('owner_id')
      .eq('id_hotel', hotelId)
      .single();

    if (hotelError || !hotelData) {
      return res.status(400).json({ error: 'Hotel no encontrado o sin propietario.' });
    }
    const owner_id = hotelData.owner_id;

    const { reservas } = req.body;
    if (!reservas || !Array.isArray(reservas)) {
      return res.status(400).json({ error: 'Se requiere un arreglo de reservas.' });
    }

    const resultados = { insertadas: 0, errores: 0 };

    for (const r of reservas) {
      try {
        const huespedNombre = r.huesped || 'Huésped Importado';
        let id_huesped = null;

        const { data: huespedData } = await db()
          .from('huespedes')
          .select('id_huesped')
          .eq('nombre_completo', huespedNombre)
          .limit(1)
          .single();

        if (huespedData) {
          id_huesped = huespedData.id_huesped;
        } else {
          const { data: newHuesped, error: newHuespedError } = await db()
            .from('huespedes')
            .insert({
              owner_id: owner_id,
              nombre_completo: huespedNombre,
              correo: `importado-${Date.now()}-${Math.floor(Math.random() * 1000)}@hotel.local`,
              telefono: '',
            })
            .select('id_huesped')
            .single();

          if (newHuespedError) throw newHuespedError;
          id_huesped = newHuesped.id_huesped;
        }

        if (!r.id_habitacion || r.id_habitacion === 'unknown' || r.id_habitacion.startsWith('sim-hab')) {
          console.error('Habitación no enlazada, omitiendo reserva:', r.id_reserva_hotel);
          resultados.errores++;
          continue;
        }

        let final_id_empresa = r.id_empresa;

        // Manejo de creación dinámica de empresas
        if (r._sim_empresa) {
          const empresaNombre = r._sim_empresa;
          const { data: empresaData } = await db()
            .from('empresas')
            .select('id_empresa')
            .eq('owner_id', owner_id)
            .ilike('nombre', empresaNombre)
            .limit(1)
            .single();

          if (empresaData) {
            final_id_empresa = empresaData.id_empresa;
          } else {
            const { data: newEmpresa, error: newEmpresaError } = await db()
              .from('empresas')
              .insert({
                owner_id: owner_id,
                nombre: empresaNombre,
                rtn: '00000000000000',
                contacto_telefono: '',
                direccion: 'Importado automáticamente'
              })
              .select('id_empresa')
              .single();

            if (!newEmpresaError && newEmpresa) {
              final_id_empresa = newEmpresa.id_empresa;
            }
          }
        }

        const { data: newReserva, error: resError } = await db()
          .from('reservas_hotel')
          .insert({
            id_hotel: hotelId,
            id_habitacion: r.id_habitacion,
            id_huesped: id_huesped,
            id_empresa: final_id_empresa,
            owner_id: owner_id,
            check_in: r.check_in,
            check_out: r.check_out,
            adultos: r.adultos || 1,
            ninos: r.ninos || 0,
            estado: r.estado || 'confirmada',
            total_reserva: r.total_reserva || 0,
            moneda: r.moneda || 'HNL',
            estado_pago: r.estado_pago || 'deuda',
            es_cortesia: r.es_cortesia || false,
            observaciones: r.observaciones || 'Importado desde Excel',
            tipo_reserva: r.tipo_reserva || 'noche',
          })
          .select('id_reserva_hotel')
          .single();

        if (resError) {
          console.error('Error insertando reserva', resError);
          resultados.errores++;
        } else if (newReserva) {
          resultados.insertadas++;

          // Si el estado de pago es 'pagado' y tiene un total, insertamos el registro de pago correspondiente
          if (r.estado_pago === 'pagado' && (r.total_reserva || 0) > 0) {
            const { error: pagoError } = await db()
              .from('pagos_hotel')
              .insert({
                owner_id: owner_id,
                id_reserva_hotel: newReserva.id_reserva_hotel,
                monto: r.total_reserva,
                metodo_pago: 'efectivo',
                referencia: 'Importación Excel',
                fecha_pago: r.check_in, // se asume pagado al momento del check-in
                estado: 'aplicado',
                moneda: r.moneda || 'HNL',
                monto_en_moneda_reserva: r.total_reserva,
                notas: 'Pago importado automáticamente desde Excel'
              });

            if (pagoError) {
              console.error('Error insertando pago para reserva importada:', pagoError);
            }
          }
        }
      } catch (err) {
        console.error('Error procesando reserva', err);
        resultados.errores++;
      }
    }

    return res.json({ success: true, ...resultados });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

async function getOwnerIdAndRole(req: express.Request): Promise<{ ownerId: string | null; role: string | null }> {
  try {
    const user = await getAuthUser(req);
    if (!user) return { ownerId: null, role: null };
    const { ownerIds } = await getOwnerHotelIdsForUser(user);
    const ownerId = ownerIds[0] || null;
    const { data: roleRow } = await db()
      .from('usuarios_roles')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('estado', 'activo')
      .limit(1)
      .maybeSingle();
    return { ownerId, role: roleRow?.rol || null };
  } catch (err) {
    console.error('Error resolving owner id and role:', err);
    return { ownerId: null, role: null };
  }
}


