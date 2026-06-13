import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../services/api';
import { supabase } from '../../api/supabase';
import { Cotizacion, CotizacionItem } from '../../types';
import { useToast } from '../../components/Toast';
import { DatePicker } from '../../components/DatePicker';
import { useSync } from '../../context/SyncContext';
import { RoomAvailabilityModal } from './RoomAvailabilityModal';

interface RoomType {
  id: string;
  nombre: string;
  precio_base: number;
  capacidad_base?: number;
}

interface ServiceType {
  id_servicio: string;
  nombre: string;
  precio_defecto: number;
}

interface Guest {
  id_huesped: string;
  nombre_completo: string;
  correo: string;
  telefono: string;
  documento_identidad: string;
}

interface Company {
  id_empresa: string;
  nombre: string;
  rtn: string;
  contacto_correo: string;
  contacto_telefono: string;
}

// Formato corto de fecha (ej. "10 jun") para los resúmenes compactos de ítems.
const formatFechaCorta = (fecha: string) => {
  if (!fecha) return '';
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};

// Limpia el sufijo "· N noches" que quedó guardado en descripciones generadas
// por una versión anterior del resumen compacto (la cantidad ya lo muestra).
const limpiarNochesDeDescripcion = (descripcion?: string) =>
  (descripcion || '').replace(/\s*·\s*\d+\s*noches?\s*$/i, '');

export const QuoteForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { addToast } = useToast();

  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const { hotel: syncHotel } = useSync();
  const activeHotelName = syncHotel?.nombre_hotel || '';

  // No se pueden cotizar ni reservar estancias en fechas que ya pasaron.
  const todayStr = new Date().toISOString().split('T')[0];

  // Form states
  const [clienteModo, setClienteModo] = useState<'huesped_existente' | 'huesped_nuevo' | 'empresa'>('huesped_existente');
  const [idHuesped, setIdHuesped] = useState('');
  const [idEmpresa, setIdEmpresa] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteCorreo, setClienteCorreo] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteIdentificacion, setClienteIdentificacion] = useState('');
  
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [cantNoches, setCantNoches] = useState(1);
  const [adultos, setAdultos] = useState(1);
  const [ninos, setNinos] = useState(0);
  const [moneda, setMoneda] = useState<'HNL' | 'USD'>('HNL');
  const [tipoCambio, setTipoCambio] = useState(24.50);
  
  const [clausulaNoFiscalidad, setClausulaNoFiscalidad] = useState(
    'Este documento es una estimación de costos y no representa un comprobante fiscal. Los precios están sujetos a cambios sin previo aviso hasta que la cotización sea aceptada y garantizada con el pago.'
  );
  const [politicasCancelacion, setPoliticasCancelacion] = useState(
    'Para garantizar la reserva, se requiere un anticipo del 50% del total cotizado. Las cancelaciones gratuitas se permiten hasta 48 horas antes del check-in, después se cobrará el cargo de la primera noche.'
  );
  const [vigenciaTexto, setVigenciaTexto] = useState('Cotización válida por 5 días hábiles a partir de la fecha de emisión.');
  const [cuentasBancarias, setCuentasBancarias] = useState(
    'Banco Atlántida - Cuenta de Cheques: 100-20034-56\nBanco de Occidente - Cuenta de Ahorro: 21-401-20934'
  );
  const [notas, setNotas] = useState('');
  const [impuestosIncluidos, setImpuestosIncluidos] = useState(true);
  const [tasaIsv, setTasaIsv] = useState(0.15);
  const [tasaTurismo, setTasaTurismo] = useState(0.04);
  const [cargoPersonaExtraRate, setCargoPersonaExtraRate] = useState(0);
  const [items, setItems] = useState<Partial<CotizacionItem>[]>([
    { tipo_item: 'habitacion', descripcion: '', cantidad: 1, precio_unitario: 0, subtotal: 0 }
  ]);

  // Master data
  const [guests, setGuests] = useState<Guest[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [configLoading, setConfigLoading] = useState(true);

  // Índice del ítem que se está editando en el modal de habitación/fechas,
  // o 'new' cuando el modal está creando un ítem de habitación nuevo.
  const [roomModalIdx, setRoomModalIdx] = useState<number | 'new' | null>(null);

  // Load config & Master data
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        setConfigLoading(true);
        // Load hotel config
        const configData = await apiClient.get('/config/hotelera');
        if (configData && configData.data) {
          setTipoCambio(Number(configData.data.tipo_cambio_base || 24.50));
          setMoneda(configData.data.moneda_principal || 'HNL');
          setTasaIsv(Number(configData.data.tasa_isv ?? 0.15));
          setTasaTurismo(Number(configData.data.tasa_turistica ?? 0.04));
          setCargoPersonaExtraRate(Number(configData.data.cargo_persona_extra ?? 0));
        }

        // Load Room Types
        const rtData = await apiClient.get<RoomType[]>('/config/tipos-habitacion');
        setRoomTypes(rtData || []);

        // Load Services
        const { data: srvData } = await supabase
          .from('servicios_adicionales')
          .select('id_servicio, nombre, precio_defecto')
          .eq('id_hotel', activeHotelId)
          .eq('activo', true);
        setServices(srvData || []);

        // Load Guests
        const guestData = await apiClient.get<any[]>('/bookings/huespedes');
        setGuests(guestData || []);

        // Load Companies
        const companyData = await apiClient.get<any[]>('/bookings/empresas');
        setCompanies(companyData || []);

        // Default expiration date: 5 days from today
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + 5);
        setFechaVencimiento(expDate.toISOString().split('T')[0]);

        if (isEdit) {
          await loadQuoteData();
        } else {
          // Restore draft if available
          const savedDraft = localStorage.getItem('solaris_quote_form_draft');
          if (savedDraft) {
            try {
              const draft = JSON.parse(savedDraft);
              setClienteModo(draft.clienteModo ?? 'huesped_existente');
              setIdHuesped(draft.idHuesped ?? '');
              setIdEmpresa(draft.idEmpresa ?? '');
              setClienteNombre(draft.clienteNombre ?? '');
              setClienteCorreo(draft.clienteCorreo ?? '');
              setClienteTelefono(draft.clienteTelefono ?? '');
              setClienteIdentificacion(draft.clienteIdentificacion ?? '');
              setFechaEmision(draft.fechaEmision ?? new Date().toISOString().split('T')[0]);
              setFechaVencimiento(draft.fechaVencimiento ?? '');
              setCheckIn(draft.checkIn ?? '');
              setCheckOut(draft.checkOut ?? '');
              setCantNoches(draft.cantNoches ?? 1);
              setAdultos(draft.adultos ?? 1);
              setNinos(draft.ninos ?? 0);
              setMoneda(draft.moneda ?? 'HNL');
              setTipoCambio(Number(draft.tipoCambio ?? 24.50));
              setClausulaNoFiscalidad(draft.clausulaNoFiscalidad ?? '');
              setPoliticasCancelacion(draft.politicasCancelacion ?? '');
              setVigenciaTexto(draft.vigenciaTexto ?? '');
              setCuentasBancarias(draft.cuentasBancarias ?? '');
              setNotas(draft.notas ?? '');
              setImpuestosIncluidos(!!draft.impuestosIncluidos);
              if (draft.items && Array.isArray(draft.items) && draft.items.length > 0) {
                setItems(draft.items.map((it: any) => (
                  it.tipo_item === 'habitacion'
                    ? { ...it, descripcion: limpiarNochesDeDescripcion(it.descripcion) }
                    : it
                )));
              }
              addToast('Borrador recuperado automáticamente', 'info');
            } catch (e) {
              console.error('Error parsing quote draft:', e);
            }
          }
        }
      } catch (err) {
        console.error('Error loading master data for quote form:', err);
        addToast('Error al cargar datos del hotel', 'error');
      } finally {
        setConfigLoading(false);
      }
    };

    if (activeHotelId) {
      loadMasterData();
    }
  }, [activeHotelId, isEdit]);

  // Save draft to localStorage
  useEffect(() => {
    if (isEdit || configLoading) return;

    const draft = {
      clienteModo,
      idHuesped,
      idEmpresa,
      clienteNombre,
      clienteCorreo,
      clienteTelefono,
      clienteIdentificacion,
      fechaEmision,
      fechaVencimiento,
      checkIn,
      checkOut,
      cantNoches,
      adultos,
      ninos,
      moneda,
      tipoCambio,
      clausulaNoFiscalidad,
      politicasCancelacion,
      vigenciaTexto,
      cuentasBancarias,
      notas,
      impuestosIncluidos,
      items
    };

    localStorage.setItem('solaris_quote_form_draft', JSON.stringify(draft));
  }, [
    isEdit,
    configLoading,
    clienteModo,
    idHuesped,
    idEmpresa,
    clienteNombre,
    clienteCorreo,
    clienteTelefono,
    clienteIdentificacion,
    fechaEmision,
    fechaVencimiento,
    checkIn,
    checkOut,
    cantNoches,
    adultos,
    ninos,
    moneda,
    tipoCambio,
    clausulaNoFiscalidad,
    politicasCancelacion,
    vigenciaTexto,
    cuentasBancarias,
    notas,
    impuestosIncluidos,
    items
  ]);

  const loadQuoteData = async () => {
    try {
      const q = await apiClient.get<Cotizacion>(`/hotel/quotes/${id}`, {
        headers: { 'x-hotel-id': activeHotelId }
      });
      if (q) {
        setIdHuesped(q.id_huesped || '');
        setIdEmpresa(q.id_empresa || '');
        setClienteNombre(q.cliente_nombre);
        setClienteIdentificacion(q.cliente_identificacion || '');
        setClienteCorreo(q.cliente_correo);
        setClienteTelefono(q.cliente_telefono || '');
        setFechaEmision(q.fecha_emision.split('T')[0]);
        setFechaVencimiento(q.fecha_vencimiento.split('T')[0]);
        setCheckIn(q.check_in.split('T')[0]);
        setCheckOut(q.check_out.split('T')[0]);
        setCantNoches(q.cant_noches);
        setAdultos(q.adultos);
        setNinos(q.ninos);
        setMoneda(q.moneda as any);
        setTipoCambio(Number(q.tipo_cambio));
        setClausulaNoFiscalidad(q.clausula_no_fiscalidad || '');
        setPoliticasCancelacion(q.politicas_cancelacion || '');
        setVigenciaTexto(q.vigencia_texto || '');
        setCuentasBancarias(q.cuentas_bancarias || '');
        setNotas(q.notas || '');
        setImpuestosIncluidos(!!q.impuestos_incluidos);

        if (q.id_huesped) setClienteModo('huesped_existente');
        else if (q.id_empresa) setClienteModo('empresa');
        else setClienteModo('huesped_nuevo');

        const rawItems = q.items || q.cotizacion_items || [];
        if (rawItems.length > 0) {
          setItems(rawItems.map((it: any) => ({
            id_item: it.id_item,
            tipo_item: it.tipo_item,
            descripcion: it.tipo_item === 'habitacion' ? limpiarNochesDeDescripcion(it.descripcion) : it.descripcion,
            id_tipo_habitacion: it.id_tipo_habitacion || undefined,
            id_servicio: it.id_servicio || undefined,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            subtotal: it.subtotal,
            check_in: it.check_in ? it.check_in.split('T')[0] : undefined,
            check_out: it.check_out ? it.check_out.split('T')[0] : undefined,
            noches: it.noches,
            adultos: it.adultos ?? 1,
            ninos: it.ninos ?? 0,
            detalles_huespedes: it.detalles_huespedes
          })));
        }
      }
    } catch (err: any) {
      console.error('Error loading quote detail:', err);
      addToast('Error al cargar la cotización para edición', 'error');
    }
  };

  // Date handlers
  useEffect(() => {
    if (checkIn && checkOut) {
      const ci = new Date(checkIn);
      const co = new Date(checkOut);
      const diffTime = co.getTime() - ci.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        setCantNoches(diffDays);
      } else {
        setCantNoches(1);
      }
    }
  }, [checkIn, checkOut]);

  // Auto-calculate check-in, check-out, adults, and children from room items
  useEffect(() => {
    const roomItems = items.filter(it => it.tipo_item === 'habitacion' && it.check_in && it.check_out);
    if (roomItems.length > 0) {
      const earliestCheckIn = roomItems.reduce((earliest, item) => {
        if (!earliest) return item.check_in!;
        return item.check_in! < earliest ? item.check_in! : earliest;
      }, '');

      const latestCheckOut = roomItems.reduce((latest, item) => {
        if (!latest) return item.check_out!;
        return item.check_out! > latest ? item.check_out! : latest;
      }, '');

      const totalAdults = roomItems.reduce((sum, item) => sum + (item.adultos ?? 1), 0);
      const totalNinos = roomItems.reduce((sum, item) => sum + (item.ninos ?? 0), 0);

      if (earliestCheckIn && earliestCheckIn !== checkIn) setCheckIn(earliestCheckIn);
      if (latestCheckOut && latestCheckOut !== checkOut) setCheckOut(latestCheckOut);
      if (totalAdults !== adultos) setAdultos(totalAdults > 0 ? totalAdults : 1);
      if (totalNinos !== ninos) setNinos(totalNinos);
    }
  }, [items, checkIn, checkOut, adultos, ninos]);


  // Client selection handlers
  const handleGuestChange = (gid: string) => {
    setIdHuesped(gid);
    const g = guests.find(x => x.id_huesped === gid);
    if (g) {
      setClienteNombre(g.nombre_completo);
      setClienteCorreo(g.correo);
      setClienteTelefono(g.telefono || '');
      setClienteIdentificacion(g.documento_identidad || '');
    }
  };

  const handleCompanyChange = (cid: string) => {
    setIdEmpresa(cid);
    const c = companies.find(x => x.id_empresa === cid);
    if (c) {
      setClienteNombre(c.nombre);
      setClienteCorreo(c.contacto_correo || '');
      setClienteTelefono(c.contacto_telefono || '');
      setClienteIdentificacion(c.rtn || '');
    }
  };

  // Los ítems de servicio se agregan vacíos para llenarse en la fila; los de
  // habitación se crean directamente desde el modal (ver handleConfirmRoomModal).
  const handleAddServiceItem = () => {
    setItems(prev => [
      ...prev,
      { tipo_item: 'servicio', descripcion: '', cantidad: 1, precio_unitario: 0, subtotal: 0 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    setItems(prev => {
      const next = [...prev];
      const it = { ...next[index], [field]: val };

      // Auto-update price/description if type or id changes
      if (field === 'id_tipo_habitacion' && it.tipo_item === 'habitacion') {
        const rt = roomTypes.find(r => r.id === val);
        if (rt) {
          it.descripcion = `Habitación ${rt.nombre}`;
          it.precio_unitario = rt.precio_base;
        }
      } else if (field === 'id_servicio' && it.tipo_item === 'servicio') {
        const srv = services.find(s => s.id_servicio === val);
        if (srv) {
          it.descripcion = srv.nombre;
          it.precio_unitario = srv.precio_defecto;
        }
      }

      // Recalcula las noches (estancia) si cambian las fechas. "cantidad" es
      // un campo aparte: representa cuántas habitaciones físicas reservar para
      // este ítem (lo usa el backend al asignar habitaciones), por eso no se
      // sincroniza con las noches — el subtotal multiplica ambos factores.
      if (it.tipo_item === 'habitacion' && (field === 'check_in' || field === 'check_out')) {
        const ci = it.check_in || checkIn;
        const co = it.check_out || checkOut;
        if (ci && co) {
          const d1 = new Date(ci);
          const d2 = new Date(co);
          const diff = d2.getTime() - d1.getTime();
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
          it.noches = days > 0 ? days : 1;
        } else {
          it.noches = 1;
        }
      }

      // Re-calculate subtotal: cantidad × noches × precio unitario + cargo persona extra
      const cant = Number(it.cantidad || 1);
      const prc = Number(it.precio_unitario || 0);
      const noc = it.tipo_item === 'habitacion' ? Number(it.noches || cantNoches || 1) : 1;
      if (it.tipo_item === 'habitacion') {
        const rt = roomTypes.find(r => r.id === it.id_tipo_habitacion);
        const capBase = rt?.capacidad_base ?? 2;
        const pExtra = (Number(it.adultos ?? 1) + Number(it.ninos ?? 0)) > capBase ? 1 : 0;
        it.subtotal = cant * noc * prc + pExtra * cargoPersonaExtraRate * noc;
      } else {
        it.subtotal = cant * noc * prc;
      }

      next[index] = it;
      return next;
    });
  };

  // Aplica la selección confirmada en el modal de habitación/fechas: crea un
  // ítem nuevo (roomModalIdx === 'new') o sobrescribe el ítem editado, armando
  // un resumen compacto en la descripción.
  //
  // OJO: "cantidad" representa aquí el número de habitaciones físicas que el
  // backend debe reservar para este ítem (allocateRoomsForQuote la usa para
  // saber cuántas unidades del tipo asignar, y para repartir el subtotal entre
  // las reservas que crea). Cada línea generada por este modal corresponde a
  // UNA habitación, así que cantidad siempre es 1; la estancia se guarda aparte
  // en "noches" y se muestra en su propia columna de la tabla.
  const handleConfirmRoomModal = (sel: {
    id_tipo_habitacion: string;
    descripcion: string;
    check_in: string;
    check_out: string;
    precio_unitario: number;
    adultos: number;
    ninos: number;
  }) => {
    const d1 = new Date(sel.check_in);
    const d2 = new Date(sel.check_out);
    const diff = d2.getTime() - d1.getTime();
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const noches = dias > 0 ? dias : 1;
    const descripcion = sel.descripcion;

    const rt = roomTypes.find(r => r.id === sel.id_tipo_habitacion);
    const capacidadBase = rt?.capacidad_base ?? 2;
    const personasExtra = (sel.adultos + sel.ninos) > capacidadBase ? 1 : 0;
    const cargoExtra = personasExtra * cargoPersonaExtraRate * noches;

    const itemData: Partial<CotizacionItem> = {
      tipo_item: 'habitacion',
      id_tipo_habitacion: sel.id_tipo_habitacion,
      descripcion,
      check_in: sel.check_in,
      check_out: sel.check_out,
      noches,
      cantidad: 1,
      precio_unitario: sel.precio_unitario,
      adultos: sel.adultos,
      ninos: sel.ninos,
      subtotal: noches * Number(sel.precio_unitario || 0) + cargoExtra
    };

    setItems(prev => {
      if (roomModalIdx === 'new') return [...prev, itemData];
      if (typeof roomModalIdx === 'number') {
        const next = [...prev];
        next[roomModalIdx] = { ...next[roomModalIdx], ...itemData };
        return next;
      }
      return prev;
    });
  };

  // Recalculate all items' subtotals if global checkIn/checkOut/cantNoches changes
  useEffect(() => {
    setItems(prev => prev.map(it => {
      if (it.tipo_item === 'habitacion') {
        const ci = it.check_in || checkIn;
        const co = it.check_out || checkOut;
        let noc = it.noches;
        if (!it.check_in && !it.check_out) {
          noc = cantNoches;
        } else if (ci && co) {
          const d1 = new Date(ci);
          const d2 = new Date(co);
          const diff = d2.getTime() - d1.getTime();
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
          noc = days > 0 ? days : 1;
        }
        const noches = noc || 1;
        const cantidad = Number(it.cantidad || 1);
        const rt = roomTypes.find(r => r.id === it.id_tipo_habitacion);
        const capBase = rt?.capacidad_base ?? 2;
        const pExtra = (Number(it.adultos ?? 1) + Number(it.ninos ?? 0)) > capBase ? 1 : 0;
        return {
          ...it,
          noches,
          subtotal: cantidad * noches * Number(it.precio_unitario || 0) + pExtra * cargoPersonaExtraRate * noches
        };
      }
      return it;
    }));
  }, [checkIn, checkOut, cantNoches, cargoPersonaExtraRate, roomTypes]);

  // Math totals with configurable taxes and option for taxes included
  const baseItemsSum = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);

  let subtotal = 0;
  let impuestoIsv = 0;
  let impuestoTurismo = 0;
  let total = 0;

  if (impuestosIncluidos) {
    total = baseItemsSum;
    
    // Back out the taxes per item
    items.forEach(item => {
      const itemTotal = item.subtotal || 0;
      if (item.tipo_item === 'habitacion') {
        const rate = tasaIsv + tasaTurismo;
        const itemBase = itemTotal / (1 + rate);
        impuestoIsv += itemBase * tasaIsv;
        impuestoTurismo += itemBase * tasaTurismo;
      } else {
        const itemBase = itemTotal / (1 + tasaIsv);
        impuestoIsv += itemBase * tasaIsv;
      }
    });
    
    subtotal = total - impuestoIsv - impuestoTurismo;
  } else {
    subtotal = baseItemsSum;
    impuestoIsv = subtotal * tasaIsv;
    
    // Calculate tourism tax only on lodging items
    const lodgingSum = items
      .filter(item => item.tipo_item === 'habitacion')
      .reduce((sum, item) => sum + (item.subtotal || 0), 0);
    impuestoTurismo = lodgingSum * tasaTurismo;
    
    total = subtotal + impuestoIsv + impuestoTurismo;
  }

  const totalAlterno = moneda === 'HNL' ? total / tipoCambio : total * tipoCambio;
  const monedaAlterna = moneda === 'HNL' ? 'USD' : 'HNL';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clienteNombre || !clienteCorreo || !checkIn || !checkOut) {
      addToast('Por favor completa todos los campos requeridos', 'warning');
      return;
    }

    if (items.length === 0 || items.some(it => !it.descripcion)) {
      addToast('La cotización debe tener al menos un ítem con descripción', 'warning');
      return;
    }

    const payload = {
      id_huesped: clienteModo === 'huesped_existente' ? idHuesped : null,
      id_empresa: clienteModo === 'empresa' ? idEmpresa : null,
      cliente_nombre: clienteNombre,
      cliente_identificacion: clienteIdentificacion,
      cliente_correo: clienteCorreo,
      cliente_telefono: clienteTelefono,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      check_in: checkIn,
      check_out: checkOut,
      cant_noches: cantNoches,
      adultos,
      ninos,
      estado: isEdit ? undefined : 'Borrador',
      subtotal,
      impuesto_isv: impuestoIsv,
      impuesto_turismo: impuestoTurismo,
      total,
      moneda,
      tipo_cambio: tipoCambio,
      impuestos_incluidos: impuestosIncluidos,
      clausula_no_fiscalidad: clausulaNoFiscalidad,
      politicas_cancelacion: politicasCancelacion,
      vigencia_texto: vigenciaTexto,
      cuentas_bancarias: cuentasBancarias,
      notas,
      items
    };

    try {
      if (isEdit) {
        await apiClient.patch(`/hotel/quotes/${id}`, payload, {
          headers: { 'x-hotel-id': activeHotelId }
        });
        addToast('Cotización actualizada correctamente', 'success');
      } else {
        await apiClient.post('/hotel/quotes', payload, {
          headers: { 'x-hotel-id': activeHotelId }
        });
        addToast('Cotización creada correctamente', 'success');
      }
      localStorage.removeItem('solaris_quote_form_draft');
      navigate('/cotizaciones');
    } catch (err: any) {
      console.error('Error saving quote:', err);
      addToast('Error al guardar la cotización', 'error');
    }
  };

  if (configLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 space-y-4">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Cargando contexto de cotización...</p>
      </div>
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="p-6 max-w-5xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              {isEdit ? 'Editar Cotización' : 'Nueva Cotización'}
            </h1>
            {activeHotelName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                {activeHotelName}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">
            {isEdit ? 'Modifica los campos del borrador de cotización.' : 'Completa la información para generar un borrador.'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('solaris_quote_form_draft');
              navigate('/cotizaciones');
            }}
            className="px-5 py-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-100 transition-all text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-sm transition-all text-sm"
          >
            Guardar Cotización
          </button>
        </div>
      </div>

      {/* Grid: Client Details & Date Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Client Block */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm md:col-span-2 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-base">Información del Cliente</h3>
            <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200/60">
              <button
                type="button"
                onClick={() => { setClienteModo('huesped_existente'); setIdEmpresa(''); }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  clienteModo === 'huesped_existente' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Huésped Existente
              </button>
              <button
                type="button"
                onClick={() => { setClienteModo('huesped_nuevo'); setIdHuesped(''); setIdEmpresa(''); setClienteNombre(''); setClienteCorreo(''); setClienteTelefono(''); setClienteIdentificacion(''); }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  clienteModo === 'huesped_nuevo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Huésped Nuevo
              </button>
              <button
                type="button"
                onClick={() => { setClienteModo('empresa'); setIdHuesped(''); }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  clienteModo === 'empresa' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Empresa
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {clienteModo === 'huesped_existente' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Seleccionar Huésped *</label>
                <select
                  value={idHuesped}
                  onChange={(e) => handleGuestChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                  required
                >
                  <option value="">-- Elige un Huésped --</option>
                  {guests.map(g => (
                    <option key={g.id_huesped} value={g.id_huesped}>
                      {g.nombre_completo} ({g.correo})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {clienteModo === 'empresa' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Seleccionar Empresa *</label>
                <select
                  value={idEmpresa}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                  required
                >
                  <option value="">-- Elige una Empresa --</option>
                  {companies.map(c => (
                    <option key={c.id_empresa} value={c.id_empresa}>{c.nombre} (RTN: {c.rtn})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre completo / Razón Social *</label>
              <input
                type="text"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                placeholder="Ej. Juan Pérez o Inversiones S.A."
                required
                disabled={clienteModo !== 'huesped_nuevo'}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">DNI / RTN / Identificación</label>
              <input
                type="text"
                value={clienteIdentificacion}
                onChange={(e) => setClienteIdentificacion(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                placeholder="Identificación fiscal/personal"
                disabled={clienteModo !== 'huesped_nuevo'}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Correo Electrónico *</label>
              <input
                type="email"
                value={clienteCorreo}
                onChange={(e) => setClienteCorreo(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                placeholder="ejemplo@correo.com"
                required
                disabled={clienteModo !== 'huesped_nuevo'}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Teléfono de Contacto</label>
              <input
                type="text"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                placeholder="Número celular o fijo"
                disabled={clienteModo !== 'huesped_nuevo'}
              />
            </div>
          </div>
        </div>

        {/* Date / General Settings Block */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3">Parámetros</h3>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Moneda</label>
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setMoneda('HNL')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  moneda === 'HNL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                HNL (Lempiras)
              </button>
              <button
                type="button"
                onClick={() => setMoneda('USD')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  moneda === 'USD' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                USD (Dólares)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">T. Cambio</label>
            <input
              type="number"
              step="0.01"
              value={tipoCambio}
              onChange={(e) => setTipoCambio(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-medium text-center"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
            <input
              type="checkbox"
              id="impuestosIncluidos"
              checked={impuestosIncluidos}
              onChange={(e) => setImpuestosIncluidos(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="impuestosIncluidos" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
              Tarifas incluyen impuestos (ISV/Turismo)
            </label>
          </div>
        </div>
      </div>

      {/* Cuerpo Desglose de Servicios */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Cuerpo: Desglose de la Cotización</h3>
            <p className="text-slate-400 text-xs mt-0.5">Agrega las habitaciones y servicios adicionales para calcular el costo.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRoomModalIdx('new')}
              className="px-3.5 py-2 bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              Añadir Habitación
            </button>
            <button
              type="button"
              onClick={() => handleAddServiceItem()}
              className="px-3.5 py-2 bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              Añadir Servicio
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4 w-40">Tipo</th>
                <th className="py-3 px-4">Descripción / Servicio</th>
                <th className="py-3 px-4 w-28 text-center">Cantidad</th>
                <th className="py-3 px-4 w-36 text-right">Precio Unit.</th>
                <th className="py-3 px-4 w-36 text-right">Subtotal</th>
                <th className="py-3 px-4 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/20 transition-colors">
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                      item.tipo_item === 'habitacion' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {item.tipo_item === 'habitacion' 
                        ? (roomTypes.find(rt => rt.id === item.id_tipo_habitacion)?.nombre || 'Habitación') 
                        : 'Servicio'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {item.tipo_item === 'habitacion' ? (
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {item.id_tipo_habitacion ? (
                            <>
                              <input
                                type="text"
                                value={item.descripcion || ''}
                                onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                                placeholder="Alias de la habitación (ej. Hab. 101)"
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold text-slate-700"
                              />
                              <p className="text-[11px] text-slate-400 mt-1">
                                {item.adultos ?? 1} {(item.adultos ?? 1) === 1 ? 'adulto' : 'adultos'}
                                {(item.ninos ?? 0) > 0 ? ` · ${item.ninos} ${item.ninos === 1 ? 'niño' : 'niños'}` : ''}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-slate-400 italic">Usa el lápiz para elegir habitación, fechas y huéspedes</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setRoomModalIdx(idx)}
                          title="Editar habitación, fechas, tarifa y huéspedes"
                          className="shrink-0 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <select
                          value={item.id_servicio || ''}
                          onChange={(e) => handleItemChange(idx, 'id_servicio', e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-medium"
                          required
                        >
                          <option value="">-- Elige Servicio Adicional --</option>
                          {services.map(s => (
                            <option key={s.id_servicio} value={s.id_servicio}>{s.nombre}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={item.descripcion || ''}
                          onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                          placeholder="Descripción personalizada"
                          className="w-full mt-1.5 px-3 py-1 bg-white border border-slate-200 rounded-md focus:outline-none text-xs text-slate-500"
                        />
                      </>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {item.tipo_item === 'habitacion' ? (
                      <span className="block text-center text-xs font-semibold text-slate-600">
                        {item.noches || 1} {(item.noches || 1) === 1 ? 'noche' : 'noches'}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad || 1}
                        onChange={(e) => handleItemChange(idx, 'cantidad', Number(e.target.value))}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold text-center"
                        required
                      />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {item.tipo_item === 'habitacion' ? (
                      <span className="block text-right text-xs font-semibold text-slate-600">
                        {new Intl.NumberFormat('es-HN', { style: 'currency', currency: moneda }).format(item.precio_unitario || 0)}
                      </span>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{moneda}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.precio_unitario || 0}
                          onChange={(e) => handleItemChange(idx, 'precio_unitario', Number(e.target.value))}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          className="w-full pl-10 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold text-right"
                          required
                        />
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-800 text-xs">
                    {new Intl.NumberFormat('es-HN', { style: 'currency', currency: moneda }).format(item.subtotal || 0)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales Block */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <div className="w-80 space-y-3 text-sm">
            {impuestosIncluidos && (
              <div className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 mb-2">
                * Precios ingresados incluyen impuestos.
              </div>
            )}
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Subtotal:</span>
              <span className="font-bold text-slate-800">
                {new Intl.NumberFormat('es-HN', { style: 'currency', currency: moneda }).format(subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Impuesto ISV ({(tasaIsv * 100).toFixed(0)}%):</span>
              <span className="font-bold text-slate-800">
                {new Intl.NumberFormat('es-HN', { style: 'currency', currency: moneda }).format(impuestoIsv)}
              </span>
            </div>
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Impuesto Turístico ({(tasaTurismo * 100).toFixed(0)}%):</span>
              <span className="font-bold text-slate-800">
                {new Intl.NumberFormat('es-HN', { style: 'currency', currency: moneda }).format(impuestoTurismo)}
              </span>
            </div>
            <div className="flex justify-between text-indigo-600 font-bold border-t border-slate-100 pt-3 text-lg">
              <span>Total Final ({moneda}):</span>
              <span>
                {new Intl.NumberFormat('es-HN', { style: 'currency', currency: moneda }).format(total)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400 font-semibold text-xs text-right">
              <span>Equivalente:</span>
              <span>
                {new Intl.NumberFormat('es-HN', { style: 'currency', currency: monedaAlterna }).format(totalAlterno)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Aspectos Legales & Formales */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3">Aspectos Legales y de Formalidad</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cláusula de No Fiscalidad</label>
            <textarea
              rows={3}
              value={clausulaNoFiscalidad}
              onChange={(e) => setClausulaNoFiscalidad(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-600 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Políticas de Reserva y Cancelación</label>
            <textarea
              rows={3}
              value={politicasCancelacion}
              onChange={(e) => setPoliticasCancelacion(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-600 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Vigencia Expresada</label>
            <input
              type="text"
              value={vigenciaTexto}
              onChange={(e) => setVigenciaTexto(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-600 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cuentas Bancarias Autorizadas</label>
            <textarea
              rows={2}
              value={cuentasBancarias}
              onChange={(e) => setCuentasBancarias(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-600 font-medium"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas Adicionales</label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-600"
              placeholder="Escribe comentarios u observaciones internas o para el cliente..."
            />
          </div>
        </div>
      </div>
    </form>

    <RoomAvailabilityModal
      isOpen={roomModalIdx !== null}
      onClose={() => setRoomModalIdx(null)}
      onConfirm={handleConfirmRoomModal}
      roomTypes={roomTypes}
      activeHotelId={activeHotelId}
      todayStr={todayStr}
      cargoPersonaExtraRate={cargoPersonaExtraRate}
      currentItems={items.filter(it => it.tipo_item === 'habitacion').map(it => ({
        id_tipo_habitacion: it.id_tipo_habitacion,
        check_in: it.check_in,
        check_out: it.check_out,
      }))}
      editingIdx={typeof roomModalIdx === 'number' ? roomModalIdx : null}
      initial={typeof roomModalIdx === 'number' ? {
        id_tipo_habitacion: items[roomModalIdx]?.id_tipo_habitacion,
        check_in: items[roomModalIdx]?.check_in || checkIn,
        check_out: items[roomModalIdx]?.check_out || checkOut,
        adultos: items[roomModalIdx]?.adultos,
        ninos: items[roomModalIdx]?.ninos
      } : undefined}
    />
    </>
  );
};
