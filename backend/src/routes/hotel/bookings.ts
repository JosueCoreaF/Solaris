import express from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { crearClienteUsuario, supabaseAdmin, supabase } from '../../config/supabase.js';
import { extractToken, getInfoFromToken, patchAuditUser } from '../../utils/auditHelper.js';
import { getAuthUser, getOwnerHotelIdsForUser, getOwnerIdsFromHotelId, hotelHasFeature } from '../../utils/tenantHelper.js';
import { requirePlanFeature } from '../../middlewares/requirePlanFeature.js';
import {
  sendBookingConfirmation,
  sendHotelNotificationEmail,
  sendBookingCancelledEmail,
  sendBookingUpdatedEmail,
  sendCustomEmail,
  getBookingConfirmationTemplate,
  getBookingCancelledTemplate,
  getBookingUpdatedTemplate,
  getQuoteEmailTemplate,
  compileCustomTemplate,
  getCustomTemplate
} from '../../utils/emailService.js';

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
router.get('/empresas', async (req, res) => {
  const { hotelIds } = await getOwnerIdAndRole(req);
  const hotelId = req.headers['x-hotel-id'] as string;
  const soloActivas = req.query.estado !== 'todos';

  const SELECT = 'id_empresa, nombre, rtn, contacto_nombre, contacto_telefono, contacto_correo, direccion, limite_credito, dias_credito, estado, notas';

  if (!hotelIds.length) {
    if (!hotelId || hotelId === 'all') return res.status(401).json({ error: 'No autorizado' });
    let q = db().from('empresas').select(SELECT).eq('id_hotel', hotelId).order('nombre');
    if (soloActivas) q = q.eq('estado', 'activo');
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  }

  let q = db().from('empresas').select(SELECT).in('id_hotel', hotelIds).order('nombre');
  if (soloActivas) q = q.eq('estado', 'activo');
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

// POST /api/bookings/empresas
router.post('/empresas', async (req, res) => {
  const hotelId = req.headers['x-hotel-id'] as string;
  if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });
  const { nombre, rtn, contacto_nombre, contacto_telefono, contacto_correo, direccion, limite_credito, dias_credito, notas } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });
  const { data, error } = await db()
    .from('empresas')
    .insert({
      id_hotel: hotelId,
      nombre,
      rtn:               rtn               || null,
      contacto_nombre:   contacto_nombre   || null,
      contacto_telefono: contacto_telefono || null,
      contacto_correo:   contacto_correo   || null,
      direccion:         direccion         || null,
      limite_credito:    limite_credito    ?? 0,
      dias_credito:      dias_credito      ?? 30,
      notas:             notas             || null,
      estado: 'activo',
    })
    .select('id_empresa, nombre, rtn, contacto_nombre, contacto_telefono, contacto_correo, direccion, limite_credito, dias_credito, estado, notas')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// PUT /api/bookings/empresas/:id
router.put('/empresas/:id', async (req, res) => {
  const hotelId = req.headers['x-hotel-id'] as string;
  if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });
  const { id } = req.params;
  const { nombre, rtn, contacto_nombre, contacto_telefono, contacto_correo, direccion, limite_credito, dias_credito, estado, notas } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });
  // Solo incluir campos que realmente vengan en el body (no sobreescribir con undefined)
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (nombre   !== undefined) updates.nombre             = nombre;
  if (rtn      !== undefined) updates.rtn                = rtn      || null;
  if (contacto_nombre   !== undefined) updates.contacto_nombre   = contacto_nombre   || null;
  if (contacto_telefono !== undefined) updates.contacto_telefono = contacto_telefono || null;
  if (contacto_correo   !== undefined) updates.contacto_correo   = contacto_correo   || null;
  if (direccion         !== undefined) updates.direccion         = direccion         || null;
  if (limite_credito    !== undefined) updates.limite_credito    = limite_credito;
  if (dias_credito      !== undefined) updates.dias_credito      = dias_credito;
  if (estado            !== undefined) updates.estado            = estado;
  if (notas             !== undefined) updates.notas             = notas             || null;
  const { data, error } = await db()
    .from('empresas')
    .update(updates)
    .eq('id_empresa', id)
    .eq('id_hotel', hotelId)
    .select('id_empresa, nombre, rtn, contacto_nombre, contacto_telefono, contacto_correo, direccion, limite_credito, dias_credito, estado, notas')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// DELETE /api/bookings/empresas/:id
router.delete('/empresas/:id', async (req, res) => {
  const hotelId = req.headers['x-hotel-id'] as string;
  const { id } = req.params;
  const { error } = await db()
    .from('empresas')
    .update({ estado: 'inactivo', updated_at: new Date().toISOString() })
    .eq('id_empresa', id)
    .eq('id_hotel', hotelId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// GET /api/bookings/empresas/creditos/alertas  — créditos próximos a vencer o vencidos
router.get('/empresas/creditos/alertas', async (req, res) => {
  const { hotelIds } = await getOwnerIdAndRole(req);
  const hotelId = req.headers['x-hotel-id'] as string;
  const ids = hotelIds.length ? hotelIds : hotelId && hotelId !== 'all' ? [hotelId] : [];
  if (!ids.length) return res.json([]);
  const hoy = new Date().toISOString().substring(0, 10);
  const en7dias = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
  const { data, error } = await db()
    .from('empresa_creditos')
    .select('*, empresas(nombre, contacto_nombre, contacto_telefono)')
    .in('id_hotel', ids)
    .in('estado', ['activo'])
    .lte('fecha_vencimiento', en7dias)
    .order('fecha_vencimiento', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

// GET /api/bookings/empresas/:id/creditos
router.get('/empresas/:id/creditos', async (req, res) => {
  const hotelId = req.headers['x-hotel-id'] as string;
  const { id } = req.params;
  const { data, error } = await db()
    .from('empresa_creditos')
    .select('*, reservas_hotel(check_in, check_out, id_habitacion)')
    .eq('id_empresa', id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

// POST /api/bookings/empresas/:id/creditos
router.post('/empresas/:id/creditos', async (req, res) => {
  const hotelId = req.headers['x-hotel-id'] as string;
  if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });
  const { id } = req.params;
  const { id_reserva, monto, fecha_emision, dias_credito, notas } = req.body;
  if (!monto || monto <= 0) return res.status(400).json({ error: 'monto debe ser mayor a 0' });
  const emision = fecha_emision ?? new Date().toISOString().substring(0, 10);
  const diasV = dias_credito ?? 30;
  const vencimiento = new Date(new Date(emision).getTime() + diasV * 86400000).toISOString().substring(0, 10);
  const { data, error } = await db()
    .from('empresa_creditos')
    .insert({ id_empresa: id, id_hotel: hotelId, id_reserva: id_reserva ?? null, monto, saldo_restante: monto, fecha_emision: emision, fecha_vencimiento: vencimiento, notas: notas ?? null })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// PUT /api/bookings/empresas/:id/creditos/:cid
router.put('/empresas/:id/creditos/:cid', async (req, res) => {
  const hotelId = req.headers['x-hotel-id'] as string;
  if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });
  const { id, cid } = req.params;
  const { saldo_restante, estado, notas } = req.body;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (saldo_restante !== undefined) updates.saldo_restante = saldo_restante;
  if (estado         !== undefined) updates.estado         = estado;
  if (notas          !== undefined) updates.notas          = notas || null;
  const { data, error } = await db()
    .from('empresa_creditos')
    .update(updates)
    .eq('id', cid)
    .eq('id_empresa', id)
    .eq('id_hotel', hotelId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// GET /api/bookings/empresas/:id/colaboradores
router.get('/empresas/:id/colaboradores', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await db()
    .from('empresa_colaboradores')
    .select('*, huespedes(id_huesped, nombre_completo, correo, telefono, documento_identidad)')
    .eq('id_empresa', id)
    .eq('activo', true)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

// POST /api/bookings/empresas/:id/colaboradores
router.post('/empresas/:id/colaboradores', async (req, res) => {
  const { id } = req.params;
  const { id_huesped, cargo } = req.body;
  if (!id_huesped) return res.status(400).json({ error: 'id_huesped requerido' });
  const { data, error } = await db()
    .from('empresa_colaboradores')
    .upsert({ id_empresa: id, id_huesped, cargo: cargo ?? null, activo: true }, { onConflict: 'id_empresa,id_huesped' })
    .select('*, huespedes(id_huesped, nombre_completo, correo, telefono)').single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// DELETE /api/bookings/empresas/:id/colaboradores/:hid
router.delete('/empresas/:id/colaboradores/:hid', async (req, res) => {
  const { id, hid } = req.params;
  const { error } = await db()
    .from('empresa_colaboradores')
    .update({ activo: false })
    .eq('id_empresa', id)
    .eq('id_huesped', hid);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// ─── Hoteles ─────────────────────────────────────────────────────────────────

// GET /api/bookings/hoteles
router.get('/hoteles', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.json([]);

    const { ownerIds, hotelIds } = await getOwnerHotelIdsForUser(user);
    if (ownerIds.length === 0 && hotelIds.length === 0) return res.json([]);

    // hoteles no tiene owner_id — filtrar por id_hotel o via business_modules
    let query = db()
      .from('hoteles')
      .select('id_hotel, nombre_hotel, ciudad, direccion, telefono, enlace_google_maps, estado')
      .eq('estado', 'activo');

    if (hotelIds.length > 0) {
      // Staff: acceso a hoteles específicos
      query = query.in('id_hotel', hotelIds);
    } else if (ownerIds.length > 0) {
      // Propietario: hoteles via business_modules.owner_id
      const { data: mods } = await db()
        .from('business_modules')
        .select('id_module')
        .in('owner_id', ownerIds);
      const moduleIds = (mods || []).map((m: any) => m.id_module);
      if (moduleIds.length === 0) return res.json([]);
      query = query.in('id_module', moduleIds);
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
      id_tarifa_default,
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

  // Obtener capacidad_base por habitación (via tipos_habitacion)
  const roomIds = (data ?? []).map((h: any) => h.id_habitacion);
  let capacidadMap: Record<string, { id_tipo_habitacion: string; capacidad_base: number }> = {};
  if (roomIds.length > 0) {
    const { data: habTipos } = await db()
      .from('habitaciones')
      .select('id_habitacion, id_tipo_habitacion, tipos_habitacion(capacidad_base)')
      .in('id_habitacion', roomIds);
    for (const ht of (habTipos || [])) {
      capacidadMap[ht.id_habitacion] = {
        id_tipo_habitacion: ht.id_tipo_habitacion,
        capacidad_base: Number((ht.tipos_habitacion as any)?.capacidad_base ?? 2),
      };
    }
  }

  const result = (data ?? []).map((h: any) => ({
    ...h,
    id_tipo_habitacion: capacidadMap[h.id_habitacion]?.id_tipo_habitacion ?? h.id_tipo_habitacion,
    capacidad_base: capacidadMap[h.id_habitacion]?.capacidad_base ?? 2,
    hotel: h.hoteles?.nombre_hotel ?? '',
    hoteles: undefined,
  }));
  return res.json(result);
});

// POST /api/bookings/habitaciones
router.post('/habitaciones', async (req, res) => {
  const { nombre_habitacion, nombre_alias, tipo, capacidad, tarifa_noche, id_tarifa_default, estado, piso, id_hotel, numero_camas, imagenes, imagen_360, comodidades } = req.body;
  if (!nombre_habitacion || !id_hotel) {
    return res.status(400).json({ error: 'nombre_habitacion e id_hotel son requeridos' });
  }

  // Buscar id_tipo_habitacion filtrado por el hotel (tipos son hotel-específicos)
  let id_tipo_habitacion: string | undefined;

  if (tipo) {
    const { data: tipoHab } = await db()
      .from('tipos_habitacion')
      .select('id_tipo_habitacion')
      .eq('id_hotel', id_hotel)
      .ilike('nombre_tipo', tipo)
      .limit(1)
      .maybeSingle();
    id_tipo_habitacion = tipoHab?.id_tipo_habitacion;
  }

  if (!id_tipo_habitacion) {
    return res.status(400).json({ error: `El tipo de habitación "${tipo || ''}" no existe para este hotel. Créalo primero en Configuración > Tipos de habitación.` });
  }

  // Generar codigo_habitacion único automáticamente
  const base = nombre_habitacion
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-]/g, '')
    .slice(0, 20);
  const suffix = Date.now().toString().slice(-4);
  const codigo_habitacion = `${base}-${suffix}`;

  // Verificar que el hotel existe
  const { data: hotelData, error: hotelError } = await db()
    .from('hoteles')
    .select('id_hotel')
    .eq('id_hotel', id_hotel)
    .single();

  if (hotelError || !hotelData) {
    return res.status(400).json({ error: 'El hotel especificado no existe.' });
  }

  const { data, error } = await db()
    .from('habitaciones')
    .insert({
      nombre_habitacion,
      codigo_habitacion,
      capacidad,
      tarifa_noche,
      id_tarifa_default: id_tarifa_default || null,
      estado: estado ?? 'disponible',
      piso,
      id_hotel,
      numero_camas,
      id_tipo_habitacion,
      imagen_360: imagen_360 || null,
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
  const { nombre_habitacion, nombre_alias, tipo, capacidad, tarifa_noche, id_tarifa_default, estado, piso, id_hotel, numero_camas, imagenes, imagen_360, comodidades } = req.body;

  // Buscar id_tipo_habitacion filtrado por hotel (tipos son hotel-específicos)
  let id_tipo_habitacion = undefined;
  if (tipo) {
    // Obtener id_hotel actual de la habitación si no viene en el body
    const hotelIdForTipo = id_hotel || (await db()
      .from('habitaciones')
      .select('id_hotel')
      .eq('id_habitacion', id)
      .maybeSingle()
    ).data?.id_hotel;

    if (hotelIdForTipo) {
      const { data: tipoHab } = await db()
        .from('tipos_habitacion')
        .select('id_tipo_habitacion')
        .eq('id_hotel', hotelIdForTipo)
        .ilike('nombre_tipo', tipo)
        .limit(1)
        .maybeSingle();
      if (tipoHab) id_tipo_habitacion = tipoHab.id_tipo_habitacion;
    }
  }

  const updateFields: any = {};
  if (nombre_habitacion !== undefined) updateFields.nombre_habitacion = nombre_habitacion;
  if (nombre_alias !== undefined) updateFields.nombre_alias = nombre_alias || null;
  if (capacidad !== undefined) updateFields.capacidad = capacidad;
  if (tarifa_noche !== undefined) updateFields.tarifa_noche = tarifa_noche;
  if (id_tarifa_default !== undefined) updateFields.id_tarifa_default = id_tarifa_default || null;
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
  const { hotelIds } = await getOwnerIdAndRole(req);
  const hotelId = req.headers['x-hotel-id'] as string;
  const filterIds = hotelId && hotelId !== 'all' ? [hotelId] : hotelIds;

  if (filterIds.length === 0) return res.status(401).json({ error: 'No autorizado' });

  const { data, error } = await db()
    .from('huespedes')
    .select('id_huesped, nombre_completo, correo, telefono, ciudad, direccion, documento_identidad')
    .in('id_hotel', filterIds)
    .order('nombre_completo');

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

// POST /api/bookings/huespedes
router.post('/huespedes', async (req, res) => {
  const hotelId = req.headers['x-hotel-id'] as string;
  if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });

  const { nombre_completo, correo, telefono, ciudad, direccion, documento_identidad } = req.body;
  if (!nombre_completo) return res.status(400).json({ error: 'nombre_completo es requerido' });

  const correoFinal = correo?.trim() || `sin-correo-${Date.now()}@partnercentral.local`;

  const { data, error } = await db()
    .from('huespedes')
    .insert({ id_hotel: hotelId, nombre_completo, correo: correoFinal, telefono, ciudad, direccion, documento_identidad })
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
    .select('id_saldo, monto, descripcion, tipo, created_at, aplicado')
    .eq('id_huesped', id)
    .eq('aplicado', false)
    .eq('tipo', 'credito')
    .order('created_at', { ascending: true });

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
    // Auto check-out reservations that are in 'check_in' and check_out is in the past
    const nowIso = new Date().toISOString();
    let autoCheckOutQuery = db()
      .from('reservas_hotel')
      .update({ estado: 'check_out', updated_at: nowIso })
      .eq('estado', 'check_in')
      .lte('check_out', nowIso);

    const hotelId = req.headers['x-hotel-id'];
    if (hotelId && hotelId !== 'all') {
      autoCheckOutQuery = autoCheckOutQuery.eq('id_hotel', hotelId);
    }
    await autoCheckOutQuery;

    let query = db()
      .from('reservas_hotel')
      .select(`
        id_reserva_hotel,
        id_huesped,
        id_habitacion,
        id_hotel,
        id_empresa,
        id_cotizacion,
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
      // huesped y habitacion ya fueron sobrescritos por strings en el map, as que NO debemos borrarlos
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
    tipo_reserva,
  } = req.body;

  if (!id_huesped || !id_habitacion || !check_in || !check_out) {
    return res.status(400).json({ error: 'Faltan campos requeridos: id_huesped, id_habitacion, check_in, check_out' });
  }

  // Resolver owner_id del usuario autenticado
  const { ownerId } = await getOwnerIdAndRole(req);
  if (!ownerId) {
    return res.status(401).json({ error: 'No autorizado o no hay owner_id asociado' });
  }

  // Construir lista de servicios
  const servicios: string[] = [];
  if (cama_extra)      servicios.push('Cama Extra');
  if (neverita)        servicios.push('Neverita');
  if (plancha)         servicios.push('Plancha');
  if (limpieza_diaria) servicios.push('Limpieza Diaria');

  // Resolver tarifa activa para las fechas de la reserva.
  // Prioridad: 1) período específico en habitacion_tarifas_periodo
  //            2) tarifa base en habitacion_tarifas_periodo (es_base=true)
  //            3) habitaciones.tarifa_noche como fallback final
  let totalFinal = total_reserva ?? 0;
  if (!totalFinal || totalFinal <= 0) {
    try {
      const fechaCI = typeof check_in === 'string' ? check_in.substring(0, 10) : check_in;

      // 1. Buscar período activo específico para esta habitación y fecha
      const { data: periodoActivo } = await db()
        .from('habitacion_tarifas_periodo')
        .select('tarifa_noche')
        .eq('id_habitacion', id_habitacion)
        .eq('es_base', false)
        .lte('fecha_desde', fechaCI)
        .or(`fecha_hasta.is.null,fecha_hasta.gte.${fechaCI}`)
        .order('fecha_hasta', { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      let tarifaNoche: number = 0;

      if (periodoActivo?.tarifa_noche) {
        tarifaNoche = Number(periodoActivo.tarifa_noche);
      } else {
        // 2. Tarifa base de la habitación
        const { data: tarifaBase } = await db()
          .from('habitacion_tarifas_periodo')
          .select('tarifa_noche')
          .eq('id_habitacion', id_habitacion)
          .eq('es_base', true)
          .maybeSingle();

        if (tarifaBase?.tarifa_noche) {
          tarifaNoche = Number(tarifaBase.tarifa_noche);
        } else {
          // 3. Fallback: tarifa_noche almacenada en la habitación
          const { data: hab } = await db()
            .from('habitaciones')
            .select('tarifa_noche')
            .eq('id_habitacion', id_habitacion)
            .maybeSingle();
          tarifaNoche = Number(hab?.tarifa_noche ?? 0);
        }
      }

      if (tarifaNoche > 0) {
        const noches = Math.max(1, Math.round(
          (new Date(check_out).getTime() - new Date(check_in).getTime()) / 86400000
        ));
        totalFinal = tarifaNoche * noches;
      }
    } catch (_) { /* Silencioso — usar valor del frontend */ }
  }

  // Llamada atómica: valida disponibilidad + inserta reserva + inserta servicios
  const { data: rpcResult, error: rpcError } = await db()
    .rpc('fn_crear_reserva_completa', {
      p_owner_id:      ownerId,
      p_id_huesped:    id_huesped,
      p_id_habitacion: id_habitacion,
      p_check_in:      check_in,
      p_check_out:     check_out,
      p_adultos:       adultos  ?? 1,
      p_ninos:         ninos    ?? 0,
      p_estado:        estado   ?? 'confirmada',
      p_total_reserva: totalFinal,
      p_moneda:        moneda   ?? 'HNL',
      p_observaciones: observaciones ?? null,
      p_estado_pago:   mapEstadoPago(estado_pago, es_cortesia ?? false, id_empresa ?? null),
      p_anticipo:      anticipo ?? 0,
      p_es_cortesia:   es_cortesia ?? false,
      p_id_empresa:    id_empresa  ?? null,
      p_tipo_reserva:  tipo_reserva ?? 'noche',
      p_servicios:     servicios,
    });

  if (rpcError) {
    const msg = rpcError.message ?? '';
    const status = msg.includes('HABITACION_OCUPADA') || msg.includes('SERVICIO_NO_DISPONIBLE') ? 400 : 500;
    return res.status(status).json({ error: msg });
  }

  const id_reserva_hotel: string = (rpcResult as any)?.id_reserva_hotel;
  const id_hotel: string         = (rpcResult as any)?.id_hotel;

  const token = extractToken(req);
  if (token && id_reserva_hotel) {
    const { email, userId } = getInfoFromToken(token);
    if (email && userId) patchAuditUser('reservas_hotel', userId, email);
  }

  // Crear crédito empresarial automáticamente cuando la reserva tiene empresa
  if (id_empresa && id_reserva_hotel && id_hotel && totalFinal > 0) {
    (async () => {
      try {
        const { data: emp } = await db()
          .from('empresas').select('dias_credito').eq('id_empresa', id_empresa).maybeSingle();
        const diasV = emp?.dias_credito ?? 30;
        const checkOutDate = typeof check_out === 'string' ? check_out.substring(0, 10) : new Date(check_out).toISOString().substring(0, 10);
        const vencimiento = new Date(new Date(checkOutDate).getTime() + diasV * 86400000).toISOString().substring(0, 10);
        await db().from('empresa_creditos').insert({
          id_empresa,
          id_hotel,
          id_reserva: id_reserva_hotel,
          monto: totalFinal,
          saldo_restante: totalFinal,
          fecha_emision: new Date().toISOString().substring(0, 10),
          fecha_vencimiento: vencimiento,
        });
      } catch (_) { /* no bloquea la respuesta */ }
    })();
  }

  // Enviar correos de confirmación de forma asíncrona (no bloquea la respuesta)
  // Beneficio del plan Estándar/Pro y superior (feature flag 'email_confirmaciones').
  if (id_reserva_hotel) {
    (async () => {
      try {
        if (!(await hotelHasFeature(id_hotel, 'email_confirmaciones'))) return;

        const [{ data: huesped }, { data: hotel }, { data: habData }, { data: reservaData }] = await Promise.all([
          db().from('huespedes').select('nombre_completo, correo').eq('id_huesped', id_huesped).single(),
          db().from('hoteles').select('nombre_hotel, correo_contacto').eq('id_hotel', id_hotel).single(),
          db().from('habitaciones').select('tipos_habitacion(nombre_tipo)').eq('id_habitacion', id_habitacion).single(),
          db().from('reservas_hotel').select('check_in, check_out, total_reserva, moneda, adultos, ninos').eq('id_reserva_hotel', id_reserva_hotel).single(),
        ]);

        if (hotel?.nombre_hotel && reservaData) {
          const emailData = {
            guestName:   huesped?.nombre_completo || 'Huésped',
            guestEmail:  huesped?.correo || '',
            bookingId:   id_reserva_hotel,
            checkIn:     reservaData.check_in,
            checkOut:    reservaData.check_out,
            totalAmount: reservaData.total_reserva,
            currency:    reservaData.moneda,
            hotelName:   hotel.nombre_hotel,
            roomType:    (habData?.tipos_habitacion as any)?.nombre_tipo || 'Habitación',
            adults:      reservaData.adultos,
            children:    reservaData.ninos,
            services:    servicios,
            id_hotel:    id_hotel,
          };
          if (huesped?.correo) await sendBookingConfirmation(emailData);
          if (hotel.correo_contacto && hotel.correo_contacto !== huesped?.correo) {
            await sendHotelNotificationEmail(emailData, hotel.correo_contacto);
          }
        }
      } catch (err) {
        console.error('Error enviando correo post-reserva:', err);
      }
    })();
  }

  // Retornar el registro completo de la reserva creada
  const { data: reservaCreada } = await db()
    .from('reservas_hotel')
    .select('*')
    .eq('id_reserva_hotel', id_reserva_hotel)
    .single();

  return res.status(201).json(reservaCreada ?? rpcResult);
});

// PATCH /api/bookings/reservas/:id
router.patch('/reservas/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Obtener los datos existentes de la reserva
  const { data: reservaExistente } = await db()
    .from('reservas_hotel')
    .select('check_in, check_out, estado, id_habitacion, es_cortesia, id_empresa, total_reserva')
    .eq('id_reserva_hotel', id)
    .single();

  if (!reservaExistente) {
    return res.status(404).json({ error: 'Reserva no encontrada' });
  }

  // Validar si es una reserva del pasado o activa
  const hoyServer = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const existingCi = reservaExistente.check_in.split(/[T ]/)[0];
  const existingCo = reservaExistente.check_out.split(/[T ]/)[0];

  const datesEqual = (d1: any, d2: any) => {
    if (d1 === d2) return true;
    if (!d1 || !d2) return false;
    try {
      return new Date(d1).getTime() === new Date(d2).getTime();
    } catch {
      return false;
    }
  };

  const isFinalized = reservaExistente.estado === 'check_out' ||
    reservaExistente.estado === 'cancelada' ||
    reservaExistente.estado === 'no_show';

  // Si está finalizada, no se puede cambiar nada de fechas ni habitación
  if (isFinalized) {
    const tryingToChangeDates = (updates.check_in !== undefined && !datesEqual(updates.check_in, reservaExistente.check_in)) ||
      (updates.check_out !== undefined && !datesEqual(updates.check_out, reservaExistente.check_out));
    const tryingToChangeRoom = (updates.id_habitacion !== undefined && updates.id_habitacion !== reservaExistente.id_habitacion);

    if (tryingToChangeDates || tryingToChangeRoom) {
      return res.status(400).json({ error: 'No se pueden modificar las fechas ni la habitación de una reserva finalizada.' });
    }
  }

  // Si está en check_in, no se puede cambiar la fecha de check_in ni la habitación (excepto por split), pero SÍ se puede cambiar la de check_out (extensiones o check-out temprano)
  if (reservaExistente.estado === 'check_in') {
    const tryingToChangeCheckIn = (updates.check_in !== undefined && !datesEqual(updates.check_in, reservaExistente.check_in));
    const tryingToChangeRoom = (updates.id_habitacion !== undefined && updates.id_habitacion !== reservaExistente.id_habitacion);

    if (tryingToChangeCheckIn || tryingToChangeRoom) {
      return res.status(400).json({ error: 'No se puede modificar la fecha de entrada ni la habitación de una reserva activa (check-in).' });
    }
  }

  // Si la fecha de salida ya pasó y no está en check_in, es una reserva del pasado
  if (reservaExistente.estado !== 'check_in' && existingCo < hoyServer) {
    const tryingToChangeDates = (updates.check_in !== undefined && !datesEqual(updates.check_in, reservaExistente.check_in)) ||
      (updates.check_out !== undefined && !datesEqual(updates.check_out, reservaExistente.check_out));
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

  const { error } = await db()
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
          }))
        );
      }
    }
  }

  const token = extractToken(req);
  if (token) { const { email, userId } = getInfoFromToken(token); if (email && userId) patchAuditUser('reservas_hotel', userId, email); }

  // Correo de actualización de reserva (fire-and-forget)
  // Beneficio del plan Estándar/Pro y superior (feature flag 'email_confirmaciones').
  void (async () => {
    try {
      const dateChanged  = (updates.check_in  !== undefined && updates.check_in  !== reservaExistente.check_in)  ||
                           (updates.check_out !== undefined && updates.check_out !== reservaExistente.check_out);
      const roomChanged  = updates.id_habitacion !== undefined && updates.id_habitacion !== reservaExistente.id_habitacion;
      if (!dateChanged && !roomChanged) return;

      const { data: reservaFull } = await db()
        .from('reservas_hotel')
        .select('id_reserva_hotel, id_hotel, check_in, check_out, total_reserva, moneda, huesped:huespedes(nombre_completo, correo), hotel:hoteles(nombre_hotel), habitacion:habitaciones(nombre_habitacion)')
        .eq('id_reserva_hotel', id)
        .maybeSingle();

      if (!reservaFull) return;
      if (!(await hotelHasFeature(reservaFull.id_hotel, 'email_confirmaciones'))) return;
      const guestObj = Array.isArray(reservaFull.huesped) ? reservaFull.huesped[0] : reservaFull.huesped;
      const guestEmail: string = (guestObj as any)?.correo ?? '';
      if (!guestEmail || guestEmail.includes('@partnercentral.local')) return;

      const changes: string[] = [];
      if (dateChanged) changes.push('Fechas de estadía actualizadas');
      if (roomChanged) changes.push('Habitación modificada');

      await sendBookingUpdatedEmail({
        guestEmail,
        guestName:   (guestObj as any)?.nombre_completo ?? 'Huésped',
        bookingId:   id,
        checkIn:     (reservaFull.check_in  ?? '').split('T')[0],
        checkOut:    (reservaFull.check_out ?? '').split('T')[0],
        hotelName:   (reservaFull.hotel as any)?.nombre_hotel ?? 'Hotel',
        roomName:    (reservaFull.habitacion as any)?.nombre_habitacion,
        changes,
        id_hotel:    reservaFull.id_hotel || (req.headers['x-hotel-id'] as string),
        totalAmount: reservaFull.total_reserva ?? undefined,
        currency:    reservaFull.moneda ?? undefined,
      });
    } catch (err) {
      console.error('Error al enviar correo de actualización de reserva:', err);
    }
  })();

  // Auto-crear crédito cuando se asigna empresa por primera vez en edición
  const nuevaEmpresa = updates.id_empresa;
  const empresaAnterior = (reservaExistente as any).id_empresa;
  if (nuevaEmpresa && !empresaAnterior) {
    const hotelId = req.headers['x-hotel-id'] as string;
    if (hotelId && hotelId !== 'all') {
      (async () => {
        try {
          const { data: existingCredit } = await db()
            .from('empresa_creditos')
            .select('id')
            .eq('id_reserva', id)
            .maybeSingle();
          if (existingCredit) return;

          const { data: emp } = await db()
            .from('empresas')
            .select('dias_credito')
            .eq('id_empresa', nuevaEmpresa)
            .maybeSingle();

          const diasV = emp?.dias_credito ?? 30;
          const checkOutDate = (updates.check_out ?? (reservaExistente as any).check_out ?? '').substring(0, 10);
          const vencimiento = new Date(new Date(checkOutDate).getTime() + diasV * 86400000).toISOString().substring(0, 10);
          const totalFinal = updates.total_reserva ?? (reservaExistente as any).total_reserva ?? 0;
          if (totalFinal > 0 && checkOutDate) {
            await db().from('empresa_creditos').insert({
              id_empresa: nuevaEmpresa,
              id_hotel: hotelId,
              id_reserva: id,
              monto: totalFinal,
              saldo_restante: totalFinal,
              fecha_emision: new Date().toISOString().substring(0, 10),
              fecha_vencimiento: vencimiento,
            });
          }
        } catch (_) {}
      })();
    }
  }

  return res.json({ success: true });
});

// DELETE /api/bookings/reservas/:id  (cancelar)
router.delete('/reservas/:id', async (req, res) => {
  const { id } = req.params;
  const anularPagos = req.query.anularPagos === 'true';

  try {
    const { ownerId } = await getOwnerIdAndRole(req);
    if (!ownerId) return res.status(401).json({ error: 'No autorizado' });

    const token = extractToken(req);
    const emailUsuario = token ? getInfoFromToken(token).email : null;

    // Operación atómica: cancela reserva, anula pagos (opcional) y genera crédito
    const { data: rpcResult, error: rpcError } = await db()
      .rpc('fn_cancelar_reserva', {
        p_id_reserva:   id,
        p_owner_id:     ownerId,
        p_anular_pagos: anularPagos,
        p_email_usuario: emailUsuario ?? null,
      });

    if (rpcError) {
      const msg = rpcError.message ?? '';
      const status = msg.includes('RESERVA_YA_CANCELADA') ? 400 : 500;
      return res.status(status).json({ error: msg });
    }

    if (token) { const { userId } = getInfoFromToken(token); if (emailUsuario && userId) patchAuditUser('reservas_hotel', userId, emailUsuario); }

    // Correo de cancelación (fire-and-forget)
    // Beneficio del plan Estándar/Pro y superior (feature flag 'email_confirmaciones').
    void (async () => {
      try {
        const { data: reservaFull } = await db()
          .from('reservas_hotel')
          .select('id_reserva_hotel, id_hotel, check_in, check_out, total_reserva, moneda, huesped:huespedes(nombre_completo, correo), hotel:hoteles(nombre_hotel), habitacion:habitaciones(nombre_habitacion)')
          .eq('id_reserva_hotel', id)
          .maybeSingle();

        if (!reservaFull) return;
        if (!(await hotelHasFeature(reservaFull.id_hotel, 'email_confirmaciones'))) return;
        const guestObj = Array.isArray(reservaFull.huesped) ? reservaFull.huesped[0] : reservaFull.huesped;
        const guestEmail: string = (guestObj as any)?.correo ?? '';
        if (!guestEmail || guestEmail.includes('@partnercentral.local')) return;

        await sendBookingCancelledEmail({
          guestEmail,
          guestName:    (guestObj as any)?.nombre_completo ?? 'Huésped',
          bookingId:    id,
          checkIn:      (reservaFull.check_in  ?? '').split('T')[0],
          checkOut:     (reservaFull.check_out ?? '').split('T')[0],
          hotelName:    (reservaFull.hotel as any)?.nombre_hotel ?? 'Hotel',
          roomName:     (reservaFull.habitacion as any)?.nombre_habitacion,
          totalAmount:  reservaFull.total_reserva ?? undefined,
          currency:     reservaFull.moneda ?? undefined,
          id_hotel:     reservaFull.id_hotel || (req.headers['x-hotel-id'] as string),
        });
      } catch (err) {
        console.error('Error al enviar correo de cancelación de reserva:', err);
      }
    })();

    return res.json(rpcResult ?? { success: true });
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
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } else {
    const { data, error } = await db()
      .from('saldos_clientes')
      .select('*, huesped:huespedes(nombre_completo)')
      .order('created_at', { ascending: false });
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
      .select('nombre_habitacion')
      .eq('id_habitacion', r.id_habitacion)
      .single();
    const nombreHab = hab?.nombre_habitacion ?? `Hab. …${String(r.id_habitacion).slice(-4)}`;

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
    .order('created_at', { ascending: false });

  for (const s of saldos ?? []) {
    movimientos.push({
      id: s.id_saldo,
      fecha: s.created_at,
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
        .select('nombre_habitacion')
        .eq('id_habitacion', r.id_habitacion)
        .single();

      result.push({
        id_reserva_hotel: r.id_reserva_hotel,
        check_in: r.check_in,
        check_out: r.check_out,
        total_reserva: r.total_reserva,
        saldo_pendiente: pendiente,
        habitacion: hab?.nombre_habitacion ?? `Hab. …${String(r.id_habitacion).slice(-4)}`,
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

  const { ownerId } = await getOwnerIdAndRole(req);
  if (!ownerId) return res.status(401).json({ error: 'No autorizado' });

  // Operación atómica: valida saldo, crea pago, marca saldo como aplicado
  const { data: rpcResult, error: rpcError } = await db()
    .rpc('fn_aplicar_saldo_cliente', {
      p_id_saldo:         id,
      p_id_reserva_hotel: id_reserva_hotel,
      p_owner_id:         ownerId,
    });

  if (rpcError) {
    const msg = rpcError.message ?? '';
    const status = msg.includes('SALDO_YA_APLICADO') || msg.includes('NO_ENCONTRADO') ? 400 : 500;
    return res.status(status).json({ error: msg });
  }

  return res.json(rpcResult);
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
      // No existe, crearlo
      const { data: creado, error: insertError } = await db()
        .from('bloqueos_habitacion')
        .insert({
          id_habitacion,
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

  const { data, error } = await db()
    .from('bloqueos_habitacion')
    .insert({ id_habitacion, fecha_inicio, fecha_fin, motivo: motivo || 'Bloqueo' })
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
  const { id_reserva_hotel, monto, moneda, metodo_pago, referencia, notas } = req.body;
  if (!id_reserva_hotel || !monto || !metodo_pago) {
    return res.status(400).json({ error: 'Faltan campos requeridos: id_reserva_hotel, monto, metodo_pago' });
  }

  const { ownerId } = await getOwnerIdAndRole(req);
  if (!ownerId) return res.status(401).json({ error: 'No autorizado' });

  // Si la reserva proviene de una cotización aún no confirmada (estado
  // 'pendiente' + id_cotizacion presente), bloqueamos el registro de pagos:
  // el cliente debe aceptar la cotización (lo que la pasa a 'confirmada'
  // automáticamente) o el hotel debe confirmarla manualmente desde la reserva.
  const { data: bookingCheck, error: bookingCheckErr } = await db()
    .from('reservas_hotel')
    .select('estado, id_cotizacion, cotizaciones(numero_cotizacion)')
    .eq('id_reserva_hotel', id_reserva_hotel)
    .maybeSingle();

  if (bookingCheckErr) return res.status(500).json({ error: bookingCheckErr.message });
  if (!bookingCheck) return res.status(404).json({ error: 'Reserva no encontrada' });

  if (bookingCheck.estado === 'pendiente' && bookingCheck.id_cotizacion) {
    const numero = (bookingCheck.cotizaciones as any)?.numero_cotizacion;
    return res.status(400).json({
      error: `Esta reserva proviene de la cotización${numero ? ` ${numero}` : ''}, que aún no ha sido confirmada. El cliente debe aceptarla o el hotel debe confirmar la reserva manualmente antes de registrar pagos.`
    });
  }

  // Operación atómica: inserta pago + recalcula estado_pago + convierte moneda
  const { data: rpcResult, error: rpcError } = await db()
    .rpc('fn_registrar_pago', {
      p_owner_id:         ownerId,
      p_id_reserva_hotel: id_reserva_hotel,
      p_monto:            Number(monto),
      p_moneda:           moneda     ?? 'HNL',
      p_metodo_pago:      metodo_pago,
      p_referencia:       referencia ?? null,
      p_notas:            notas      ?? null,
      p_fecha_pago:       new Date().toLocaleDateString('en-CA'),
    });

  if (rpcError) {
    const status = rpcError.message?.includes('MONTO_INVALIDO') ? 400 : 500;
    return res.status(status).json({ error: rpcError.message });
  }

  // Retornar el pago recién creado
  const id_pago = (rpcResult as any)?.id_pago_hotel;
  const { data: nuevoPago } = id_pago
    ? await db().from('pagos_hotel').select('*').eq('id_pago_hotel', id_pago).single()
    : { data: rpcResult };

  const tokenPago = extractToken(req);
  if (tokenPago) { const { email, userId } = getInfoFromToken(tokenPago); if (email && userId) patchAuditUser('pagos_hotel', userId, email); }

  return res.status(201).json(nuevoPago ?? rpcResult);
});

// POST /api/bookings/split
router.post('/split', async (req, res) => {
  const { id_reserva_hotel, fecha_split } = req.body;
  if (!id_reserva_hotel || !fecha_split) {
    return res.status(400).json({ error: 'Faltan campos requeridos: id_reserva_hotel, fecha_split' });
  }

  const { ownerId } = await getOwnerIdAndRole(req);
  if (!ownerId) return res.status(401).json({ error: 'No autorizado' });

  const { data, error } = await db()
    .rpc('fn_split_reserva', {
      p_id_reserva_hotel: id_reserva_hotel,
      p_fecha_split: fecha_split,
      p_owner_id: ownerId,
    });

  if (error) {
    const msg = error.message ?? '';
    const status = msg.includes('RESERVA_NO_ENCONTRADA') || msg.includes('ESTADO_INVALIDO') || msg.includes('FECHA_SPLIT_INVALIDA') ? 400 : 500;
    return res.status(status).json({ error: msg });
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
  const tokenPatch = extractToken(req);
  if (tokenPatch) { const { email, userId } = getInfoFromToken(tokenPatch); if (email && userId) patchAuditUser('pagos_hotel', userId, email); }
  return res.json({ success: true });
});

// DELETE /api/bookings/pagos/:id  (anular)
router.delete('/pagos/:id', async (req, res) => {
  const { id } = req.params;
  const motivo = (req.query.motivo as string) || req.body.motivo || undefined;

  const { ownerId } = await getOwnerIdAndRole(req);
  if (!ownerId) return res.status(401).json({ error: 'No autorizado' });

  const token = extractToken(req);
  const emailUsuario = token ? getInfoFromToken(token).email : null;

  // Operación atómica: anula pago + genera crédito + recalcula estado_pago
  const { data: rpcResult, error: rpcError } = await db()
    .rpc('fn_anular_pago', {
      p_id_pago_hotel: id,
      p_owner_id:      ownerId,
      p_motivo:        motivo        ?? null,
      p_email_usuario: emailUsuario  ?? null,
    });

  if (rpcError) {
    const msg = rpcError.message ?? '';
    const status = msg.includes('PAGO_YA_ANULADO') || msg.includes('NO_ENCONTRADO') ? 400 : 500;
    return res.status(status).json({ error: msg });
  }

  return res.json(rpcResult ?? { success: true });
});

// ─── KPIs Dashboard ────────────────────────────────────────────────────────────

// GET /api/bookings/kpis/ocupacion-actual
router.get('/kpis/ocupacion-actual', async (req, res) => {
  try {
    const hotelId = req.headers['x-hotel-id'];

    // Total de habitaciones del hotel (excluye las que están en mantenimiento)
    let queryHab = db()
      .from('habitaciones')
      .select('id_habitacion')
      .neq('estado', 'mantenimiento');
    if (hotelId && hotelId !== 'all') {
      queryHab = queryHab.eq('id_hotel', hotelId);
    }
    const { data: habs, error: habError } = await queryHab;
    if (habError) throw habError;

    const totalHabitaciones = habs?.length || 0;
    if (totalHabitaciones === 0) return res.json({ ocupacion: 0 });

    // Reservas actualmente en check_in (huésped físicamente en el hotel)
    let queryRes = db()
      .from('reservas_hotel')
      .select('id_habitacion, habitaciones!inner(id_hotel)')
      .eq('estado', 'check_in');
    if (hotelId && hotelId !== 'all') {
      queryRes = (queryRes as any).eq('habitaciones.id_hotel', hotelId);
    }
    const { data: reservasActivas, error: resError } = await queryRes;
    if (resError) throw resError;

    // Habitaciones únicas ocupadas (una reserva = una habitación)
    const habitacionesOcupadas = new Set(
      (reservasActivas ?? []).map((r: any) => r.id_habitacion)
    ).size;

    const ocupacion = Math.round((habitacionesOcupadas / totalHabitaciones) * 100);
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
      .select('id_hotel')
      .eq('id_hotel', hotelId)
      .single();

    if (hotelError || !hotelData) {
      return res.status(400).json({ error: 'Hotel no encontrado.' });
    }

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
              id_hotel: hotelId,
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
            .eq('id_hotel', hotelId as string)
            .ilike('nombre', empresaNombre)
            .limit(1)
            .single();

          if (empresaData) {
            final_id_empresa = empresaData.id_empresa;
          } else {
            const { data: newEmpresa, error: newEmpresaError } = await db()
              .from('empresas')
              .insert({
                id_hotel: hotelId,
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

// ── Tarifas por período para habitaciones individuales ──────────────────────

/**
 * GET /api/bookings/habitaciones/:id/tarifas-periodo
 * Lista TODOS los períodos de una habitación (activos, próximos y vencidos).
 */
router.get('/habitaciones/:id/tarifas-periodo', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await db()
      .from('habitacion_tarifas_periodo')
      .select('*, tarifas(id_tarifa, tarifa_noche, categorias_tarifa(nombre))')
      .eq('id_habitacion', id)
      .order('es_base', { ascending: false })        // base primero
      .order('fecha_desde', { ascending: false });   // luego más recientes

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data ?? []);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/bookings/habitaciones/:id/tarifas-periodo
 * Crea un nuevo período de tarifa. Valida que no se solape con períodos existentes.
 */
router.post('/habitaciones/:id/tarifas-periodo', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_periodo, id_tarifa, tarifa_noche, fecha_desde, fecha_hasta, es_base } = req.body;

    if (!tarifa_noche || Number(tarifa_noche) < 0) {
      return res.status(400).json({ error: 'tarifa_noche es requerida y debe ser >= 0' });
    }
    if (!es_base && !fecha_desde) {
      return res.status(400).json({ error: 'fecha_desde es requerida para períodos no base' });
    }

    // Verificar solapamiento con períodos existentes (solo para no-base)
    if (!es_base && fecha_desde) {
      const { data: existentes } = await db()
        .from('habitacion_tarifas_periodo')
        .select('id, fecha_desde, fecha_hasta, nombre_periodo')
        .eq('id_habitacion', id)
        .eq('es_base', false);

      const nuevo_desde = new Date(fecha_desde);
      const nuevo_hasta = fecha_hasta ? new Date(fecha_hasta) : null;

      const solapado = (existentes ?? []).find((p: any) => {
        const p_desde = new Date(p.fecha_desde);
        const p_hasta  = p.fecha_hasta ? new Date(p.fecha_hasta) : null;

        // Se solapan si los rangos se intersectan
        const inicio_antes = !nuevo_hasta || p_desde <= nuevo_hasta;
        const fin_despues  = !p_hasta    || p_hasta >= nuevo_desde;
        return inicio_antes && fin_despues;
      });

      if (solapado) {
        return res.status(400).json({
          error: `El período se solapa con "${solapado.nombre_periodo || 'otro período'}" (${solapado.fecha_desde}${solapado.fecha_hasta ? ' → ' + solapado.fecha_hasta : ''})`,
        });
      }
    }

    const { data, error } = await db()
      .from('habitacion_tarifas_periodo')
      .insert({
        id_habitacion:  id,
        id_tarifa:      id_tarifa || null,
        tarifa_noche:   Number(tarifa_noche),
        nombre_periodo: nombre_periodo || null,
        fecha_desde:    es_base ? null : fecha_desde,
        fecha_hasta:    fecha_hasta || null,
        es_base:        !!es_base,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /api/bookings/habitaciones/:id/tarifas-periodo/:pid
 * Actualiza un período. Revalida solapamiento.
 */
router.put('/habitaciones/:id/tarifas-periodo/:pid', async (req, res) => {
  try {
    const { id, pid } = req.params;
    const { nombre_periodo, id_tarifa, tarifa_noche, fecha_desde, fecha_hasta } = req.body;

    // Obtener el período actual para saber si es_base
    const { data: actual } = await db()
      .from('habitacion_tarifas_periodo')
      .select('es_base')
      .eq('id', pid)
      .eq('id_habitacion', id)
      .single();

    if (!actual) return res.status(404).json({ error: 'Período no encontrado' });

    // Verificar solapamiento (excluir el propio período del check)
    if (!actual.es_base && fecha_desde) {
      const { data: existentes } = await db()
        .from('habitacion_tarifas_periodo')
        .select('id, fecha_desde, fecha_hasta, nombre_periodo')
        .eq('id_habitacion', id)
        .eq('es_base', false)
        .neq('id', pid);

      const nuevo_desde = new Date(fecha_desde);
      const nuevo_hasta = fecha_hasta ? new Date(fecha_hasta) : null;

      const solapado = (existentes ?? []).find((p: any) => {
        const p_desde = new Date(p.fecha_desde);
        const p_hasta  = p.fecha_hasta ? new Date(p.fecha_hasta) : null;
        return (!nuevo_hasta || p_desde <= nuevo_hasta) && (!p_hasta || p_hasta >= nuevo_desde);
      });

      if (solapado) {
        return res.status(400).json({
          error: `El período se solapa con "${solapado.nombre_periodo || 'otro período'}" (${solapado.fecha_desde}${solapado.fecha_hasta ? ' → ' + solapado.fecha_hasta : ''})`,
        });
      }
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (nombre_periodo !== undefined) updates.nombre_periodo = nombre_periodo || null;
    if (id_tarifa      !== undefined) updates.id_tarifa      = id_tarifa || null;
    if (tarifa_noche   !== undefined) updates.tarifa_noche   = Number(tarifa_noche);
    if (!actual.es_base) {
      if (fecha_desde !== undefined) updates.fecha_desde = fecha_desde || null;
      if (fecha_hasta !== undefined) updates.fecha_hasta = fecha_hasta || null;
    }

    const { data, error } = await db()
      .from('habitacion_tarifas_periodo')
      .update(updates)
      .eq('id', pid)
      .eq('id_habitacion', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /api/bookings/habitaciones/:id/tarifas-periodo/:pid
 * Elimina un período (no se puede eliminar la tarifa base si es la única).
 */
router.delete('/habitaciones/:id/tarifas-periodo/:pid', async (req, res) => {
  try {
    const { id, pid } = req.params;
    const { error } = await db()
      .from('habitacion_tarifas_periodo')
      .delete()
      .eq('id', pid)
      .eq('id_habitacion', id);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/bookings/reservas/:id/email-preview
 * Genera el asunto y el HTML de vista previa del correo según la reserva y el tipo deseado.
 */
router.post('/reservas/:id/email-preview', requirePlanFeature('email_studio'), async (req, res) => {
  try {
    const { id } = req.params;
    const { type, changes } = req.body; // type: 'confirmation' | 'update' | 'cancellation'

    const { data: reservaFull } = await db()
      .from('reservas_hotel')
      .select(`
        id_reserva_hotel,
        check_in,
        check_out,
        total_reserva,
        moneda,
        adultos,
        ninos,
        huesped:huespedes(nombre_completo, correo),
        hotel:hoteles(nombre_hotel),
        habitacion:habitaciones(nombre_habitacion, tipos_habitacion(nombre_tipo))
      `)
      .eq('id_reserva_hotel', id)
      .maybeSingle();

    if (!reservaFull) return res.status(404).json({ error: 'Reserva no encontrada' });

    const guestObj = Array.isArray(reservaFull.huesped) ? reservaFull.huesped[0] : reservaFull.huesped;
    const guestEmail = (guestObj as any)?.correo ?? '';
    const guestName = (guestObj as any)?.nombre_completo ?? 'Huésped';
    const hotelName = (reservaFull.hotel as any)?.nombre_hotel ?? 'Hotel';
    const roomName = (reservaFull.habitacion as any)?.nombre_habitacion ?? 'Habitación';
    const roomTypeName = ((reservaFull.habitacion as any)?.tipos_habitacion as any)?.nombre_tipo ?? 'Habitación';

    let subject = '';
    let html = '';

    if (type === 'confirmation') {
      subject = `Confirmación de Reserva - ${hotelName}`;
      html = getBookingConfirmationTemplate({
        guestName,
        guestEmail,
        bookingId: id,
        checkIn: (reservaFull.check_in ?? '').split('T')[0],
        checkOut: (reservaFull.check_out ?? '').split('T')[0],
        totalAmount: Number(reservaFull.total_reserva ?? 0),
        currency: reservaFull.moneda ?? 'HNL',
        hotelName,
        roomType: roomTypeName,
        adults: reservaFull.adultos,
        children: reservaFull.ninos,
      });
    } else if (type === 'cancellation') {
      subject = `Reserva cancelada — ${hotelName}`;
      html = getBookingCancelledTemplate({
        guestEmail,
        guestName,
        bookingId: id,
        checkIn: (reservaFull.check_in ?? '').split('T')[0],
        checkOut: (reservaFull.check_out ?? '').split('T')[0],
        hotelName,
        roomName,
        totalAmount: Number(reservaFull.total_reserva ?? 0),
        currency: reservaFull.moneda ?? 'HNL',
      });
    } else {
      // default: update
      subject = `Reserva actualizada — ${hotelName}`;
      html = getBookingUpdatedTemplate({
        guestEmail,
        guestName,
        bookingId: id,
        checkIn: (reservaFull.check_in ?? '').split('T')[0],
        checkOut: (reservaFull.check_out ?? '').split('T')[0],
        hotelName,
        roomName,
        changes: changes || ['Cambios generales en los detalles de la reserva'],
      });
    }

    return res.json({
      subject,
      html,
      guestEmail,
      guestName,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bookings/reservas/:id/send-custom-email
 * Envía un correo con asunto y HTML personalizados redactados por el usuario.
 */
router.post('/reservas/:id/send-custom-email', requirePlanFeature('email_studio'), async (req, res) => {
  try {
    const { id } = req.params;
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (to, subject, html)' });
    }

    const { data: reservaFull } = await db()
      .from('reservas_hotel')
      .select('hotel:hoteles(nombre_hotel)')
      .eq('id_reserva_hotel', id)
      .maybeSingle();

    const hotelName = (reservaFull?.hotel as any)?.nombre_hotel ?? 'Solaris';

    const sendRes = await sendCustomEmail({
      to,
      subject,
      html,
      hotelName,
    });

    if (!sendRes.success) {
      return res.status(500).json({ error: sendRes.error || 'Error al enviar el correo' });
    }

    return res.json({ success: true, data: sendRes.data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/bookings/plantillas
 * Obtiene todas las plantillas de correo del hotel activo.
 */
router.get('/plantillas', requirePlanFeature('email_studio'), async (req, res) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });

    const { data, error } = await dbUser(req)
      .from('plantillas_correo')
      .select('*')
      .eq('id_hotel', hotelId);

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data ?? []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/bookings/plantillas/:tipo
 * Obtiene la plantilla del tipo indicado para el hotel activo.
 */
router.get('/plantillas/:tipo', requirePlanFeature('email_studio'), async (req, res) => {
  try {
    const { tipo } = req.params;
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });

    const { data, error } = await dbUser(req)
      .from('plantillas_correo')
      .select('*')
      .eq('id_hotel', hotelId)
      .eq('tipo_plantilla', tipo)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || null);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bookings/plantillas
 * Crea o actualiza la configuración de una plantilla de correo (UPSERT).
 */
router.post('/plantillas', requirePlanFeature('email_studio'), async (req, res) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });

    const { tipo_plantilla, asunto, cuerpo_personalizado, estilos } = req.body;
    if (!tipo_plantilla || !asunto) {
      return res.status(400).json({ error: 'tipo_plantilla y asunto son requeridos' });
    }

    const { data, error } = await dbUser(req)
      .from('plantillas_correo')
      .upsert({
        id_hotel: hotelId,
        tipo_plantilla,
        asunto,
        cuerpo_personalizado: cuerpo_personalizado || null,
        estilos: estilos || {},
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id_hotel,tipo_plantilla'
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bookings/plantillas/preview
 * Genera una previsualización HTML en tiempo real con datos de prueba ficticios.
 */
router.post('/plantillas/preview', requirePlanFeature('email_studio'), async (req, res) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });

    const { tipo_plantilla, asunto, cuerpo_personalizado, estilos } = req.body;
    if (!tipo_plantilla) return res.status(400).json({ error: 'tipo_plantilla es requerido' });

    const { data: hotel } = await db()
      .from('hoteles')
      .select('nombre_hotel')
      .eq('id_hotel', hotelId)
      .maybeSingle();

    const hotelName = hotel?.nombre_hotel ?? 'Hotel Demo';

    const mockVariables = {
      huesped: 'Josué Corea',
      hotel: hotelName,
      check_in: 'lunes, 8 de junio de 2026',
      check_out: 'viernes, 12 de junio de 2026',
      habitacion: 'Habitación Ejecutiva (Doble)',
      total: 'L 4,500.00',
      moneda: 'HNL',
      bookingId: 'MOCK-12345',
      roomName: 'Habitación 101',
      roomType: 'Habitación Ejecutiva'
    };

    let defaultHtml = '';
    let defaultSubject = asunto || '';

    if (tipo_plantilla === 'confirmacion') {
      if (!defaultSubject) defaultSubject = `Confirmación de Reserva - ${hotelName}`;
      defaultHtml = getBookingConfirmationTemplate({
        guestName: mockVariables.huesped,
        guestEmail: 'demo@solarys.uk',
        bookingId: mockVariables.bookingId,
        checkIn: '2026-06-08',
        checkOut: '2026-06-12',
        totalAmount: 4500,
        currency: 'HNL',
        hotelName,
        roomType: mockVariables.roomType,
        adults: 2,
        children: 0,
      });
    } else if (tipo_plantilla === 'cancelacion') {
      if (!defaultSubject) defaultSubject = `Reserva cancelada — ${hotelName}`;
      defaultHtml = getBookingCancelledTemplate({
        guestEmail: 'demo@solarys.uk',
        guestName: mockVariables.huesped,
        bookingId: mockVariables.bookingId,
        checkIn: '2026-06-08',
        checkOut: '2026-06-12',
        hotelName,
        roomName: mockVariables.roomName,
        totalAmount: 4500,
        currency: 'HNL',
      });
    } else if (tipo_plantilla === 'actualizacion') {
      if (!defaultSubject) defaultSubject = `Reserva actualizada — ${hotelName}`;
      defaultHtml = getBookingUpdatedTemplate({
        guestEmail: 'demo@solarys.uk',
        guestName: mockVariables.huesped,
        bookingId: mockVariables.bookingId,
        checkIn: '2026-06-08',
        checkOut: '2026-06-12',
        hotelName,
        roomName: mockVariables.roomName,
        changes: ['Fecha de ingreso cambiada al 8 de junio', 'Habitación asignada: Habitación 101'],
      });
    } else if (tipo_plantilla === 'cotizacion') {
      if (!defaultSubject) defaultSubject = `Cotización de Hospedaje Q-1001 - ${hotelName}`;
      defaultHtml = getQuoteEmailTemplate({
        guestName: mockVariables.huesped,
        guestEmail: 'demo@solarys.uk',
        quoteNumber: 'Q-1001',
        checkIn: '2026-06-08',
        checkOut: '2026-06-12',
        totalAmount: 4500,
        currency: 'HNL',
        hotelName,
        acceptUrl: '#',
        rejectUrl: '#',
      });
    } else {
      return res.status(400).json({ error: 'tipo_plantilla inválido' });
    }

    const compiled = compileCustomTemplate(
      defaultHtml,
      defaultSubject,
      { asunto, cuerpo_personalizado, estilos },
      mockVariables
    );

    return res.json({
      subject: compiled.subject,
      html: compiled.html
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

async function getOwnerIdAndRole(req: express.Request): Promise<{ ownerId: string | null; role: string | null; hotelIds: string[] }> {
  try {
    const user = await getAuthUser(req);
    if (!user) return { ownerId: null, role: null, hotelIds: [] };

    const { ownerIds, hotelIds } = await getOwnerHotelIdsForUser(user);
    const ownerId = ownerIds[0] || null;
    if (!ownerId) return { ownerId: null, role: null, hotelIds: [] };

    // Propietario directo: owners.id_owner = auth.uid()
    if (ownerId === user.id) {
      return { ownerId, role: 'PROPIETARIO', hotelIds };
    }

    // Staff: buscar rol en usuarios_roles (user_id, no usuario_id)
    const { data: roleRow } = await db()
      .from('usuarios_roles')
      .select('rol')
      .eq('user_id', user.id)
      .eq('owner_id', ownerId)
      .eq('estado', 'activo')
      .limit(1)
      .maybeSingle();
    return { ownerId, role: roleRow?.rol || null, hotelIds };
  } catch (err) {
    console.error('Error resolving owner id and role:', err);
    return { ownerId: null, role: null, hotelIds: [] };
  }
}


