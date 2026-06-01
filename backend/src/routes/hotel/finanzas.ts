import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase.js';
import { getAuthUser, getOwnerHotelIdsForUser } from '../../utils/tenantHelper.js';

const router = Router();
const db = () => supabaseAdmin;

const TIPO_CAMBIO_HNL_USD = 24.5;

/**
 * Resuelve el hotel/owner activo desde el JWT + headers.
 * Retorna { ownerId, hotelId } donde hotelId puede ser null (significa "todos los hoteles del owner").
 */
async function resolveHotelContext(req: Request): Promise<{ ownerId: string | null; hotelId: string | null }> {
  const headerHotelId = req.headers['x-hotel-id'] as string | undefined;
  const user = await getAuthUser(req);
  if (!user) {
    return {
      ownerId:  null,
      hotelId:  (headerHotelId && headerHotelId !== 'all') ? headerHotelId : null,
    };
  }

  const { ownerIds } = await getOwnerHotelIdsForUser(user);
  const ownerId = ownerIds[0] ?? null;
  const hotelId = (headerHotelId && headerHotelId !== 'all') ? headerHotelId : null;
  return { ownerId, hotelId };
}

function rangoPeriodo(periodo: string): { desde: string; hasta: string } {
  const ahora = new Date();
  const hasta = ahora.toLocaleDateString('en-CA');
  const desde = new Date(ahora);

  if (periodo === 'semana') desde.setDate(ahora.getDate() - 7);
  else if (periodo === 'trimestre') desde.setDate(ahora.getDate() - 90);
  else if (periodo === 'aÃ±o') desde.setFullYear(ahora.getFullYear() - 1);
  else desde.setDate(ahora.getDate() - 30); // mes por defecto

  return { desde: desde.toLocaleDateString('en-CA'), hasta };
}

// GET /api/finanzas/resumen
router.get('/resumen', async (req: Request, res: Response) => {
  try {
    const { periodo = 'mes' } = req.query;
    const { desde, hasta } = rangoPeriodo(periodo as string);
    const { ownerId, hotelId } = await resolveHotelContext(req);
    if (!ownerId && !hotelId) return res.status(401).json({ error: 'No autorizado' });

    // Ingresos: suma de pagos_hotel activos en el período
    let queryPagos = db()
      .from('pagos_hotel')
      .select('monto, moneda, reservas_hotel!inner(id_hotel)')
      .neq('estado', 'anulado')
      .gte('fecha_pago', desde)
      .lte('fecha_pago', hasta);

    if (hotelId) {
      queryPagos = queryPagos.eq('reservas_hotel.id_hotel', hotelId);
    } else if (ownerId) {
      queryPagos = queryPagos.eq('owner_id', ownerId);
    }
    const { data: pagos, error: pagErr } = await queryPagos;

    if (pagErr) throw pagErr;

    const ingresoTotal = (pagos ?? []).reduce((s, p: any) => s + (p.monto ?? 0), 0);
    const ingresoUSD = Math.round(ingresoTotal / TIPO_CAMBIO_HNL_USD);

    // Egresos: suma de facturas en el período
    let queryFacturas = db()
      .from('facturas')
      .select('monto_total')
      .gte('fecha', desde)
      .lte('fecha', hasta);

    if (hotelId) {
      queryFacturas = queryFacturas.eq('id_hotel', hotelId);
    } else if (ownerId) {
      queryFacturas = queryFacturas.eq('owner_id', ownerId);
    }
    const { data: facturas, error: facErr } = await queryFacturas;

    if (facErr) throw facErr;

    const egresosTotal = (facturas ?? []).reduce((s, f: any) => s + (f.monto_total ?? 0), 0);
    const egresosUSD = Math.round(egresosTotal / TIPO_CAMBIO_HNL_USD);
    const saldo = ingresoTotal - egresosTotal;

    return res.json({
      ingresoTotal: Math.round(ingresoTotal),
      egresosTotal: Math.round(egresosTotal),
      saldo: Math.round(saldo),
      tipoCambio: TIPO_CAMBIO_HNL_USD,
      ingresoUSD,
      egresosUSD,
      saldoUSD: Math.round(saldo / TIPO_CAMBIO_HNL_USD),
    });
  } catch (error: any) {
    console.error('Error en finanzas/resumen:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/finanzas/movimientos
router.get('/movimientos', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, tipo } = req.query;
    const { desde, hasta } = startDate
      ? { desde: startDate as string, hasta: (endDate as string) || new Date().toLocaleDateString('en-CA') }
      : rangoPeriodo('mes');
    const { ownerId, hotelId } = await resolveHotelContext(req);

    // Obtener pagos con datos de reserva y huésped
    let query = db()
      .from('pagos_hotel')
      .select(`
        id_pago_hotel,
        monto,
        moneda,
        metodo_pago,
        fecha_pago,
        estado,
        notas,
        reservas_hotel!inner (
          id_reserva_hotel,
          id_hotel,
          huespedes ( nombre_completo ),
          habitaciones ( nombre_habitacion )
        )
      `)
      .neq('estado', 'anulado')
      .gte('fecha_pago', desde)
      .lte('fecha_pago', hasta)
      .order('fecha_pago', { ascending: false })
      .limit(50);

    if (hotelId) {
      query = query.eq('reservas_hotel.id_hotel', hotelId);
    } else if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }
    const { data: pagos, error } = await query;

    if (error) throw error;

    const movimientos = (pagos ?? []).map((p: any, i: number) => ({
      id: i + 1,
      tipo: 'ingreso' as const,
      concepto: `Pago — ${p.reservas_hotel?.habitaciones?.nombre_habitacion ?? 'Habitación'} (${p.reservas_hotel?.huespedes?.nombre_completo ?? 'Huésped'})`,
      monto: Math.round(p.monto ?? 0),
      fecha: p.fecha_pago ?? '',
      referencia: p.id_pago_hotel,
    }));

    return res.json(movimientos);
  } catch (error: any) {
    console.error('Error en finanzas/movimientos:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/finanzas/ingresos
router.get('/ingresos', async (req: Request, res: Response) => {
  try {
    const { periodo = 'mes' } = req.query;
    const { desde, hasta } = rangoPeriodo(periodo as string);
    const { ownerId, hotelId } = await resolveHotelContext(req);

    let query = db()
      .from('pagos_hotel')
      .select('monto, fecha_pago, reservas_hotel!inner(id_hotel)')
      .neq('estado', 'anulado')
      .gte('fecha_pago', desde)
      .lte('fecha_pago', hasta)
      .order('fecha_pago');

    if (hotelId) {
      query = query.eq('reservas_hotel.id_hotel', hotelId);
    } else if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }
    const { data: pagos, error } = await query;

    if (error) throw error;

    // Agrupar por día
    const porDia: Record<string, { cantidad: number; reservas: number }> = {};
    for (const p of pagos ?? []) {
      const dia = (p as any).fecha_pago?.substring(0, 10) ?? '';
      if (!porDia[dia]) porDia[dia] = { cantidad: 0, reservas: 0 };
      porDia[dia].cantidad += (p as any).monto ?? 0;
      porDia[dia].reservas += 1;
    }

    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const detalles = Object.entries(porDia)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([fecha, { cantidad, reservas }]) => ({
        periodo: diasSemana[new Date(fecha + 'T12:00:00').getDay()],
        cantidad: Math.round(cantidad),
        reservas,
        promedioPorReserva: reservas > 0 ? Math.round(cantidad / reservas) : 0,
      }));

    const total = (pagos ?? []).reduce((s, p: any) => s + (p.monto ?? 0), 0);

    return res.json({
      total: Math.round(total),
      totalUSD: Math.round(total / TIPO_CAMBIO_HNL_USD),
      detalles,
    });
  } catch (error: any) {
    console.error('Error en finanzas/ingresos:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/finanzas/egresos
router.get('/egresos', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, periodo = 'mes' } = req.query;
    const { desde, hasta } = startDate
      ? { desde: startDate as string, hasta: (endDate as string) || new Date().toLocaleDateString('en-CA') }
      : rangoPeriodo(periodo as string);
    const { ownerId, hotelId } = await resolveHotelContext(req);

    let query = db()
      .from('facturas')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta);

    if (hotelId) {
      query = query.eq('id_hotel', hotelId);
    } else if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }
    const { data: facturas, error } = await query;

    if (error) throw error;

    const total = (facturas ?? []).reduce((s, f: any) => s + (f.monto_total ?? 0), 0);

    return res.json({
      total: Math.round(total),
      totalUSD: Math.round(total / TIPO_CAMBIO_HNL_USD),
      facturas: facturas ?? [],
    });
  } catch (error: any) {
    console.error('Error en finanzas/egresos:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/finanzas/tendencias
router.get('/tendencias', async (req: Request, res: Response) => {
  try {
    const { dias = 7 } = req.query;
    const numDias = Math.min(30, parseInt(dias as string) || 7);
    const { ownerId, hotelId } = await resolveHotelContext(req);

    let query = db()
      .from('pagos_hotel')
      .select('monto, fecha_pago, reservas_hotel!inner(id_hotel)')
      .neq('estado', 'anulado')
      .gte('fecha_pago', new Date(Date.now() - numDias * 86400000).toLocaleDateString('en-CA'))
      .order('fecha_pago');

    if (hotelId) {
      query = query.eq('reservas_hotel.id_hotel', hotelId);
    } else if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }
    const { data: pagos, error } = await query;

    if (error) throw error;

    const porDia: Record<string, number> = {};
    for (const p of pagos ?? []) {
      const dia = (p as any).fecha_pago?.substring(0, 10) ?? '';
      porDia[dia] = (porDia[dia] ?? 0) + ((p as any).monto ?? 0);
    }

    const detalles = [];
    for (let i = numDias - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toLocaleDateString('en-CA');
      const ingresos = Math.round(porDia[dStr] ?? 0);
      const egresos = 0;
      detalles.push({ fecha: dStr, ingresos, egresos, saldo: ingresos - egresos });
    }

    const totalIngresos = detalles.reduce((s, d) => s + d.ingresos, 0);
    const ingresoPromedioDia = numDias > 0 ? Math.round(totalIngresos / numDias) : 0;

    return res.json({
      ultimosDias: numDias,
      ingresoPromedioDia,
      egresoPromedioDia: 0,
      margenPromedio: 100,
      tendencia: 'estable',
      detalles,
    });
  } catch (error: any) {
    console.error('Error en finanzas/tendencias:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/finanzas/tipo-cambio
router.get('/tipo-cambio', async (_req: Request, res: Response) => {
  return res.json({
    HNL_USD: TIPO_CAMBIO_HNL_USD,
    USD_HNL: 1 / TIPO_CAMBIO_HNL_USD,
    actualizadoEn: new Date().toISOString(),
    fuente: 'BCH - Banco Central de Honduras',
  });
});

// POST /api/finanzas/escanear-factura
// Proxy seguro hacia Gemini Vision — con soporte para múltiples imágenes y rotación de claves
router.post('/escanear-factura', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mediaType, imagenes, categoriasGenerales, categoriasCajaChica } = req.body as {
      imageBase64?: string;
      mediaType?: string;
      imagenes?: { imageBase64: string; mediaType: string }[];
      categoriasGenerales?: { id: number; nombre: string }[];
      categoriasCajaChica?: { id: number; nombre: string }[];
    };

    const tieneImagenes = (Array.isArray(imagenes) && imagenes.length > 0) || (imageBase64 && mediaType);
    if (!tieneImagenes) {
      return res.status(400).json({ error: 'Se requiere al menos una imagen (imageBase64/mediaType o arreglo imagenes)' });
    }

    // Split key by comma in case multiple keys are provided for rotation
    const apiKeys = (
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      ''
    ).split(',').map(k => k.trim()).filter(Boolean);

    if (apiKeys.length === 0) {
      return res.status(503).json({ error: 'Clave de Gemini no configurada en el servidor (GEMINI_API_KEY)' });
    }

    const catGeneralesStr = Array.isArray(categoriasGenerales) && categoriasGenerales.length > 0
      ? categoriasGenerales.map(c => `ID: ${c.id} -> ${c.nombre}`).join('\n')
      : 'No provistas';

    const catChicaStr = Array.isArray(categoriasCajaChica) && categoriasCajaChica.length > 0
      ? categoriasCajaChica.map(c => `ID: ${c.id} -> ${c.nombre}`).join('\n')
      : 'No provistas';

    const PROMPT = `Eres un asistente contable e inteligencia artificial contable de nivel sénior experto en facturación de Honduras (normativa SAR).
Analiza las imágenes adjuntas. Estas imágenes pueden corresponder a una o varias facturas distintas. Cada factura puede estar compuesta por una o varias fotos (por ejemplo, fotos de cerca del encabezado, del desglose de artículos o del pie del ticket, o diferentes páginas del mismo documento).

Tu primera tarea es AGRUPAR las imágenes según la factura a la que pertenecen. Usa criterios lógicos como el nombre del Proveedor, el RTN, la Fecha, el número de factura/CAI, o el aspecto físico del ticket/papel para determinar qué imágenes pertenecen al mismo documento.

Para cada factura identificada, extrae y consolida su información de manera sumamente precisa.

⚠️ ADVERTENCIA CRÍTICA DE ROTACIÓN:
La(s) imagen(es) provista(s) pueden estar rotadas (por ejemplo, giradas 90 grados a la izquierda, acostadas de lado, o invertidas). Analiza con sumo cuidado la orientación de los caracteres antes de comenzar a leer. Lee el texto en la dirección natural de la escritura para evitar distorsiones o confusiones.

⚠️ ESTRUCTURA DE TABLA DE ARTÍCULOS:
Las columnas típicas de los artículos en la factura son: CÓDIGO/DESCRIPCIÓN | CANT | PRECIO (unitario) | MONTO (Subtotal de la línea).
- NO confundas el PRECIO unitario con el MONTO total de la línea (monto total de la línea = cantidad * precio unitario).
- Extrae el 'MONTO' de la línea (que representa el total cobrado antes de impuestos por esa línea) como base para el desglose.
- Lee con paciencia línea por línea de arriba a abajo. Asegúrate de incluir TODOS los artículos sin omitir el primero (por ejemplo, si el primer artículo es "JUGO NARANJ PREM", debes extraerlo obligatoriamente).
- NO inventes nombres de artículos ni asumas marcas que no están escritas (por ejemplo, si el ticket dice "YOG FRESA BISIGNANO", no inventes "VOG FRESA RUISIANO" ni omitas letras). Mantén el texto sumamente fiel a lo impreso.

⚠️ GUÍA CRÍTICA DE CLASIFICACIÓN Y MARCAS HONDUREÑAS (MUY IMPORTANTE):
Para evitar errores comunes de contexto, usa estas reglas estrictas al clasificar los ítems en las categorías de Caja Chica:
- **Yogurt (YOG)**: A veces la cámara o el OCR lee "YOG" como "VOG" (ej: "VOG FRESA", "VOG CEREZA BISIGNANO", "VOG MELOCOTON BISIG"). Estos son yogures y pertenecen estrictamente a la categoría "Jaleas, yogurt" (ID: 20).
- **Semita / Semitas** (ej: "SUPERMAN SEMITA DESP" o "Semita"): Es pan tradicional hondureño. Clasifícalo siempre en "Pan dulce" (ID: 9). NO lo confundas con jugos ni refrescos.
- **Margaritas (La Moderna)** (ej: "MODERNA MARGARITAS" o "Margaritas"): Son galletas dulces tradicionales de mantequilla. Clasifícalas siempre en "Pan dulce" (ID: 9) o en su defecto "Galletas, Donas, Arroz" (ID: 22). NO las confundas con jugos.
- **Crema Pradera / Mendoza** (ej: "CREM LA PRADERA" o "Crema"): Es crema fresca de leche o mantequilla. Clasifícala siempre en "Mantequilla" (ID: 16). NO la confundas con "Cremora".
- **Cremora**: Es un sustituto de crema en polvo (marca "Cremora") para disolver en el café. Solo clasifica aquí si explícitamente es la marca en polvo "Cremora" (ID: 4). Cremas frescas lácteas van en "Mantequilla" (ID: 16) o "Queso" (ID: 13).
- **Queso** (ej: "QUESO SEMI SECO MENDOZA" o "Queso"): Clasifícalo estrictamente en la categoría "Queso" (ID: 13). NO lo confundas con cremora.
- **Harina** (ej: "GOLD STAR HARINA" o "Harina"): Clasifícalo en "Confites, Harina para Hacer Panqueques" (ID: 23) o en su defecto "Otros" (ID: 25). NO lo confundas con azúcar.
- **Azúcar** (ej: "AZUCAR" o "Azúcar en Libras"): Clasifícalo estrictamente en "Azucar en Libras" (ID: 6).
- **Jugos** (ej: "JUGO SULA P.FRUTAS" o "JUGO MANZ PREM" o "Jugo"): Clasifícalo estrictamente en "Jugos" (ID: 2).

Para cada factura, debes realizar un DESGLOSE O DETALLE de los artículos, productos o servicios individuales comprados. Clasifica cada ítem en la categoría correcta según las siguientes listas oficiales:

--- CATEGORÍAS PARA GASTOS GENERALES (Si determinas que la factura es tipo "general") ---
${catGeneralesStr}

--- CATEGORÍAS PARA CAJA CHICA (Si determinas que la factura es tipo "caja_chica") ---
${catChicaStr}

Responde ÚNICAMENTE con un objeto JSON válido que cumpla con el siguiente formato exacto. No incluyas ningún texto fuera del JSON. Todo el JSON debe ser perfectamente válido:

{
  "facturas": [
    {
      "proveedor": "Nombre del emisor o negocio (ej. Lacthosa)",
      "no_factura": "000-000-00-00000000",
      "rtn_proveedor": "14 dígitos del RTN o null",
      "fecha": "YYYY-MM-DD",
      "descripcion": "Breve resumen de los artículos comprados (máx 120 caracteres)",
      "subtotal": 0.0,
      "isv_15": 0.0,
      "isv_18": 0.0,
      "monto_total": 0.0,
      "tipo": "general",
      "indices_imagenes": [0],
      "desglose": [
        {
          "descripcion": "Descripción individual del artículo comprado",
          "categoria_id": 1,
          "monto": 0.0
        }
      ]
    }
  ]
}

Reglas críticas de negocio:
- El campo "tipo" debe ser estrictamente "general" o "caja_chica".
- El campo "indices_imagenes" es una lista de números (ej: [0, 1]) que mapea qué imágenes de las enviadas corresponden a esta factura específica.
- NO mezcles datos de facturas distintas. Cada elemento en la lista "facturas" debe representar un documento comercial único.
- Todos los montos como números sin símbolo de moneda ni comas.
- Si un campo no aparece, usa null o 0.
- La fecha debe estar en formato YYYY-MM-DD.
- En el campo "desglose": La suma de los "monto" de todos los ítems individuales DEBE SUMAR EXACTAMENTE EL "monto_total" de esa factura (al centavo). Para lograr esto:
  a) Calcula el total real de la suma de los ítems del ticket antes de impuestos (subtotal de la factura).
  b) Calcula la proporción del total que representa cada línea: factor = monto_total_factura / subtotal_factura.
  c) Para cada ítem, toma su subtotal original del ticket, multiplícalo por este factor y redondéalo a dos decimales.
  d) Ajusta los centavos decimales restantes en el último artículo para que la suma total sea exactamente igual al "monto_total" reportado.`;

    let lastError: any = null;
    let extraido: any = null;

    for (const apiKey of apiKeys) {
      try {
        const parts: any[] = [{ text: PROMPT }];

        if (Array.isArray(imagenes) && imagenes.length > 0) {
          for (const img of imagenes) {
            if (img.imageBase64 && img.mediaType) {
              parts.push({
                inlineData: {
                  mimeType: img.mediaType,
                  data: img.imageBase64,
                },
              });
            }
          }
        } else if (imageBase64 && mediaType) {
          parts.push({
            inlineData: {
              mimeType: mediaType,
              data: imageBase64,
            },
          });
        }

        const respuesta = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts,
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            }),
          }
        );

        if (!respuesta.ok) {
          const errData = await respuesta.json() as any;
          throw new Error(errData.error?.message || `Gemini API error: ${respuesta.status}`);
        }

        const resData = await respuesta.json() as any;
        const texto = resData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        
        // Robust cleaning of the response JSON string
        let cleanText = texto.trim();
        
        // Remove markdown block wraps if they exist
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
        }
        
        try {
          extraido = JSON.parse(cleanText);
        } catch (parseErr: any) {
          console.error('[Gemini JSON Parse Error] Raw text was:\n', texto);
          throw new Error(`Error al decodificar JSON devuelto por la IA: ${parseErr.message}`);
        }
        
        break; // Éxito, salir del loop de rotación
      } catch (err: any) {
        console.warn(`⚠️ Error con API Key de Gemini: ${err.message || err}. Probando siguiente...`);
        lastError = err;
      }
    }

    if (!extraido) {
      throw new Error(lastError?.message || 'Todas las API Keys de Gemini configuradas fallaron o excedieron su cuota.');
    }

    return res.json({ ok: true, datos: extraido });
  } catch (error: any) {
    console.error('Error en escanear-factura con Gemini:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Error interno' });
  }
});

// POST /api/finanzas/facturas — Guardar factura en DB
router.post('/facturas', async (req: Request, res: Response) => {
  try {
    const {
      fecha, proveedor, no_factura, rtn_proveedor, tipo,
      categoria_general_id, categoria_chica_id, descripcion,
      subtotal, isv_15, isv_18, monto_total, imagen_url, desglose,
      id_hotel
    } = req.body;

    const { hotelId } = await resolveHotelContext(req);
    const resolvedHotelId = id_hotel || hotelId || null;

    if (!resolvedHotelId) return res.status(400).json({ error: 'id_hotel requerido (header x-hotel-id o campo id_hotel)' });
    if (!proveedor || !monto_total) {
      return res.status(400).json({ error: 'proveedor y monto_total son requeridos' });
    }

    const { data, error } = await db()
      .from('facturas')
      .insert({
        id_hotel:             resolvedHotelId,
        fecha:                fecha || new Date().toLocaleDateString('en-CA'),
        proveedor,
        no_factura:           no_factura || null,
        rtn_proveedor:        rtn_proveedor || null,
        tipo:                 tipo || 'general',
        categoria_general_id: categoria_general_id ? Number(categoria_general_id) : null,
        categoria_chica_id:   categoria_chica_id ? Number(categoria_chica_id) : null,
        descripcion:          descripcion || null,
        subtotal:             Number(subtotal) || 0,
        isv_15:               Number(isv_15) || 0,
        isv_18:               Number(isv_18) || 0,
        monto_total:          Number(monto_total),
        imagen_url:           imagen_url || null,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error: any) {
    console.error('Error guardando factura:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/finanzas/facturas — Listar facturas
router.get('/facturas', async (req: Request, res: Response) => {
  try {
    const { periodo = 'mes' } = req.query;
    const { desde, hasta } = rangoPeriodo(periodo as string);
    const { ownerId, hotelId } = await resolveHotelContext(req);
    if (!ownerId && !hotelId) return res.status(401).json({ error: 'No autorizado' });

    let query = db()
      .from('facturas')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false });

    if (hotelId) {
      query = query.eq('id_hotel', hotelId);
    } else if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }
    const { data, error } = await query;

    if (error) throw error;
    return res.json(data ?? []);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// PUT /api/finanzas/facturas/:id — Actualizar factura
router.put('/facturas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fecha,
      proveedor,
      no_factura,
      rtn_proveedor,
      tipo,
      categoria_general_id,
      categoria_chica_id,
      descripcion,
      subtotal,
      isv_15,
      isv_18,
      monto_total,
      imagen_url,
      desglose
    } = req.body;

    const { data, error } = await db()
      .from('facturas')
      .update({
        fecha: fecha || undefined,
        proveedor: proveedor || undefined,
        no_factura: no_factura !== undefined ? no_factura : undefined,
        rtn_proveedor: rtn_proveedor !== undefined ? rtn_proveedor : undefined,
        tipo: tipo || undefined,
        categoria_general_id: categoria_general_id !== undefined ? (categoria_general_id ? Number(categoria_general_id) : null) : undefined,
        categoria_chica_id: categoria_chica_id !== undefined ? (categoria_chica_id ? Number(categoria_chica_id) : null) : undefined,
        descripcion: descripcion !== undefined ? descripcion : undefined,
        subtotal: subtotal !== undefined ? Number(subtotal) : undefined,
        isv_15: isv_15 !== undefined ? Number(isv_15) : undefined,
        isv_18: isv_18 !== undefined ? Number(isv_18) : undefined,
        monto_total: monto_total !== undefined ? Number(monto_total) : undefined,
        imagen_url: imagen_url !== undefined ? imagen_url : undefined,
        desglose: desglose !== undefined ? desglose : undefined,
      })
      .eq('id_factura', id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error: any) {
    console.error('Error actualizando factura:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// DELETE /api/finanzas/facturas/:id — Eliminar factura
router.delete('/facturas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await db()
      .from('facturas')
      .delete()
      .eq('id_factura', id);

    if (error) throw error;
    return res.json({ ok: true, mensaje: 'Factura eliminada' });
  } catch (error: any) {
    console.error('Error eliminando factura:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

export default router;

