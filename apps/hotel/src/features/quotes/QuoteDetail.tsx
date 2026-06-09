import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { supabase } from '../../api/supabase';
import { Cotizacion } from '../../types';
import { useToast } from '../../components/Toast';
import { useSync } from '../../context/SyncContext';

export const QuoteDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const { hotel: syncHotel } = useSync();
  const activeHotelName = syncHotel?.nombre_hotel || hotel?.nombre_hotel || '';

  const [quote, setQuote] = useState<Cotizacion | null>(null);
  const [hotel, setHotel] = useState<any>(null);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [tasaIsv, setTasaIsv] = useState(0.15);
  const [tasaTurismo, setTasaTurismo] = useState(0.04);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>(`/hotel/quotes/${id}`, {
        headers: { 'x-hotel-id': activeHotelId }
      });
      const formattedQuote = {
        ...data,
        items: data.items || data.cotizacion_items
      };
      setQuote(formattedQuote);

      const { data: hotelData } = await supabase
        .from('hoteles')
        .select('*')
        .eq('id_hotel', activeHotelId)
        .single();
      setHotel(hotelData);

      const { data: roomTypesData } = await supabase
        .from('tipos_habitacion')
        .select('*')
        .eq('id_hotel', activeHotelId);
      setRoomTypes(roomTypesData || []);

      const { data: cfgData } = await supabase
        .from('configuracion_hotelera')
        .select('porcentaje_impuesto, tasa_turistica')
        .eq('id_hotel', activeHotelId)
        .maybeSingle();
      if (cfgData) {
        setTasaIsv(Number(cfgData.porcentaje_impuesto ?? 0.15));
        setTasaTurismo(Number(cfgData.tasa_turistica ?? 0.04));
      }
    } catch (err: any) {
      console.error('Error fetching quote detail:', err);
      addToast('Error al cargar la cotización', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeHotelId && id) {
      fetchDetail();
    }
  }, [id, activeHotelId]);

  // Renderiza la tarjeta de cotización (printRef) a un PDF A4 paginado.
  // Es el mismo "sello" rasterizado que se sube como documento protegido:
  // al generarse aquí (sesión autenticada del hotel) y nunca como HTML/JSON
  // editable, el cliente no puede alterar montos desde las DevTools.
  const buildQuotePdf = async () => {
    if (!printRef.current) return null;
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(printRef.current, {
      scale: 2,
      useCORS: true,
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 295; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf;
  };

  // Export to PDF
  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setActionLoading(true);
    addToast('Generando documento PDF...', 'info');
    try {
      const pdf = await buildQuotePdf();
      if (!pdf) return;
      pdf.save(`Cotizacion_${quote?.numero_cotizacion || 'Solaris'}.pdf`);
      addToast('PDF generado correctamente', 'success');
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      addToast('Error al exportar el archivo PDF. Intenta más tarde.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Send Email (Enlace or PDF)
  const handleSendEmail = async (sendPdf: boolean) => {
    if (!quote) return;
    setActionLoading(true);
    let payload: any = {};

    try {
      if (sendPdf) {
        if (!printRef.current) return;
        addToast('Generando PDF para adjuntar...', 'info');

        const pdf = await buildQuotePdf();
        if (!pdf) return;

        const pdfDataUri = pdf.output('datauristring');
        payload.pdfBase64 = pdfDataUri;
      }

      await apiClient.post(`/hotel/quotes/${quote.id_cotizacion}/send-email`, payload, {
        headers: { 'x-hotel-id': activeHotelId }
      });
      addToast(
        sendPdf 
          ? 'Cotización con PDF adjunto enviada al cliente por correo' 
          : 'Enlace de la cotización enviado al cliente por correo', 
        'success'
      );
      // Reload quote to show the 'Enviada' status
      fetchDetail();
    } catch (err: any) {
      console.error('Error sending quote email:', err);
      addToast(err.response?.data?.message || err.response?.data?.error || 'Error al enviar el correo', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Enviar por WhatsApp ────────────────────────────────────────────────
  // Genera el PDF localmente (lo descarga al equipo), luego abre WhatsApp
  // Web/App con el número del cliente y un mensaje con el link público.
  const handleSendWhatsApp = async () => {
    if (!quote) return;

    const rawPhone = quote.cliente_telefono?.trim();
    if (!rawPhone) {
      addToast('El cliente no tiene número de teléfono registrado. Edita la cotización para agregarlo.', 'warning');
      return;
    }

    setActionLoading(true);
    addToast('Generando PDF...', 'info');

    try {
      // 1. Generar y descargar el PDF
      const pdf = await buildQuotePdf();
      if (!pdf) return;

      // Descarga automática del PDF en el equipo
      pdf.save(`Cotizacion_${quote.numero_cotizacion}.pdf`);

      // 2. Limpiar el número para formato internacional
      // Elimina espacios, guiones, paréntesis
      let phone = rawPhone.replace(/[\s\-().+]/g, '');
      // Si no empieza con código de país, asume Honduras (+504)
      if (!phone.startsWith('504') && phone.length <= 8) {
        phone = '504' + phone;
      }

      // 3. Mensaje de WhatsApp
      const hotelName = hotel?.nombre_hotel || 'el hotel';
      const message =
        `Hola ${quote.cliente_nombre}, le contactamos de *${hotelName}*.\n\n` +
        `Le compartimos su cotización *${quote.numero_cotizacion}* con el resumen de su estadía.\n\n` +
        `El documento PDF fue descargado en este dispositivo, adjúntalo aquí para compartírselo directamente.\n\n` +
        `Para confirmar su reserva o si tiene alguna consulta, con gusto le atendemos. ¡Gracias!`;

      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      addToast('PDF descargado. WhatsApp abierto con el mensaje listo para enviar.', 'success');
    } catch (err: any) {
      console.error('Error enviando por WhatsApp:', err);
      addToast('Error al generar el PDF. Intenta de nuevo.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Convert to Reservation
  const handleConvertBooking = async () => {
    if (!quote) return;
    if (!window.confirm('¿Deseas confirmar la conversión de esta cotización a una reserva activa?')) return;

    setActionLoading(true);
    try {
      const res = await apiClient.post(`/hotel/quotes/${quote.id_cotizacion}/convert-booking`, {}, {
        headers: { 'x-hotel-id': activeHotelId }
      });
      if (res && (res.success || res.bookings)) {
        addToast(`Cotización convertida en ${res.bookings?.length || 1} reserva(s) correctamente`, 'success');
        navigate('/reservas');
      }
    } catch (err: any) {
      console.error('Error converting booking:', err);
      addToast(err.response?.data?.error || 'Error al convertir en reserva', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: currency || 'HNL'
    }).format(amount);
  };

  const getStatusBadgeClass = (estado: string) => {
    switch (estado) {
      case 'Borrador': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Enviada': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Aceptada': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Rechazada': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Expirada': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 space-y-4">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Cargando cotización...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-4">
        <p className="text-red-500 font-bold">La cotización no existe o no se tiene acceso.</p>
        <button onClick={() => navigate('/cotizaciones')} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold">
          Volver al Listado
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Top Bar Actions */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/cotizaciones')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-slate-600 hover:text-slate-800 font-semibold text-sm transition-all"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Volver
          </button>
          {activeHotelName && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
              {activeHotelName}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            Exportar PDF
          </button>
          
          {(quote.estado === 'Borrador' || quote.estado === 'Enviada') && (
            <button
              onClick={() => handleSendEmail(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              title="Envía un correo con el PDF de la cotización adjunto y botones para aceptar o rechazar"
            >
              Enviar por Email
            </button>
          )}

          {(quote.estado === 'Borrador' || quote.estado === 'Enviada' || quote.estado === 'Aceptada') && (
            <>
              <button
                onClick={handleSendWhatsApp}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                title={`Descarga el PDF y abre WhatsApp con ${quote.cliente_nombre} para compartirlo`}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp PDF
              </button>
            </>
          )}

          {quote.convertida ? (
            <button
              disabled={true}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all cursor-not-allowed animate-fade-in"
            >
              Reservas Creadas
            </button>
          ) : (
            (quote.estado === 'Aceptada' || quote.estado === 'Enviada' || quote.estado === 'Borrador') && (
              <button
                onClick={handleConvertBooking}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Convertir en Reserva
              </button>
            )
          )}
        </div>
      </div>

      {/* Invoice Document Card */}
      <div
        ref={printRef}
        className="bg-white p-10 rounded-2xl border border-slate-200/80 shadow-md space-y-8 text-slate-800"
        style={{ minHeight: '297mm' }}
      >
        {/* Header Block */}
        <div className="flex justify-between items-start border-b border-slate-200/60 pb-6">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {hotel?.nombre_hotel || 'Hotel Solaris'}
            </h2>
            <div className="text-slate-400 text-[11px] font-semibold tracking-wider uppercase mt-2 space-y-0.5">
              <p>
                {hotel?.direccion 
                  ? hotel.direccion.toUpperCase() 
                  : (hotel?.ciudad ? `${hotel.ciudad.toUpperCase()} • HONDURAS` : 'HONDURAS')}
              </p>
              <p>Tel: {hotel?.telefono || ''} • RTN: {hotel?.rtn || 'N/A'}</p>
            </div>
          </div>

          <div className="text-right">
            <h1 className="text-3xl font-black text-slate-900 tracking-widest uppercase">COTIZACIÓN</h1>
            <p className="text-sm font-bold text-indigo-600 tracking-wide mt-1">{quote.numero_cotizacion}</p>
            <div className="text-[11px] text-slate-400 font-bold tracking-wider uppercase mt-2 space-y-1">
              <div>Emisión: <span className="text-slate-600 font-semibold">{quote.fecha_emision}</span></div>
              <div>Vence: <span className="text-rose-500 font-extrabold">{quote.fecha_vencimiento}</span></div>
            </div>
          </div>
        </div>

        {/* Client Info Section */}
        <div className="border-b border-slate-100 pb-6">
          <div className="space-y-1">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Información del Cliente</h4>
            <div className="text-base font-bold text-slate-900 tracking-wide uppercase mt-1">{quote.cliente_nombre}</div>
            <div className="text-slate-500 text-xs mt-1">{quote.cliente_correo}</div>
            {quote.cliente_telefono && <div className="text-slate-500 text-xs mt-0.5">Tel: {quote.cliente_telefono}</div>}
            {quote.cliente_identificacion && <div className="text-slate-500 text-xs mt-0.5">DNI/RTN: {quote.cliente_identificacion}</div>}
          </div>
        </div>

        {/* Table Body Breakdown */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Servicios Detallados</h4>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-4 w-28">Tipo</th>
                <th className="py-2.5 px-4">Descripción</th>
                <th className="py-2.5 px-4 w-24">Check-in</th>
                <th className="py-2.5 px-4 w-24">Check-out</th>
                <th className="py-2.5 px-4 w-28 text-center">Huéspedes</th>
                <th className="py-2.5 px-4 w-24 text-center">Noches / Cant.</th>
                <th className="py-2.5 px-4 w-28 text-right">Precio Unit.</th>
                <th className="py-2.5 px-4 w-28 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {quote.items?.map((it, idx) => {
                const roomType = roomTypes.find(rt => rt.id_tipo_habitacion === it.id_tipo_habitacion);
                const nights = it.noches || (it.check_in && it.check_out 
                  ? Math.max(1, Math.round((new Date(it.check_out.split('T')[0]).getTime() - new Date(it.check_in.split('T')[0]).getTime()) / (1000 * 60 * 60 * 24)))
                  : quote.cant_noches) || 1;
                return (
                  <tr key={it.id_item || idx}>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        it.tipo_item === 'habitacion' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {it.tipo_item === 'habitacion' 
                          ? (roomType ? roomType.nombre_tipo : 'Alojamiento') 
                          : 'Servicio'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      <div className="text-sm font-bold text-slate-800">
                        {it.tipo_item === 'habitacion' 
                          ? (it.descripcion ? it.descripcion.split(' · ')[0] : '-') 
                          : it.descripcion}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                      {it.tipo_item === 'habitacion' 
                        ? (it.check_in ? it.check_in.split('T')[0] : quote.check_in) 
                        : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                      {it.tipo_item === 'habitacion' 
                        ? (it.check_out ? it.check_out.split('T')[0] : quote.check_out) 
                        : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs text-slate-700 font-medium">
                      {it.tipo_item === 'habitacion' 
                        ? `${it.adultos ?? 1} Ad.${(it.ninos ?? 0) > 0 ? ` / ${it.ninos} Niñ.` : ''}` 
                        : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold">
                      {it.tipo_item === 'habitacion' ? (
                        <div className="text-center">
                          <span className="block text-sm font-bold text-slate-800">{nights}</span>
                          <span className="text-[10px] text-slate-400 block font-normal">{ nights === 1 ? 'noche' : 'noches' }</span>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-bold">{it.cantidad}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-700">{formatCurrency(it.precio_unitario, quote.moneda)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">{formatCurrency(it.subtotal, quote.moneda)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary & Totals Breakdown */}
        <div className="flex flex-col sm:flex-row justify-between pt-4 border-t border-slate-100 gap-8 items-start">
          {/* Left: Room & Nights Summary */}
          {(() => {
            const roomItems = quote.items?.filter(it => it.tipo_item === 'habitacion') || [];
            if (roomItems.length === 0) return <div />;

            const roomTypeSummary: { [key: string]: { count: number; nights: number } } = {};
            roomItems.forEach(it => {
              const roomType = roomTypes.find(rt => rt.id_tipo_habitacion === it.id_tipo_habitacion);
              const typeName = roomType ? roomType.nombre_tipo : 'Alojamiento';
              const nights = it.noches || (it.check_in && it.check_out 
                ? Math.max(1, Math.round((new Date(it.check_out.split('T')[0]).getTime() - new Date(it.check_in.split('T')[0]).getTime()) / (1000 * 60 * 60 * 24)))
                : quote.cant_noches) || 1;
              if (!roomTypeSummary[typeName]) {
                roomTypeSummary[typeName] = { count: 0, nights: nights };
              }
              roomTypeSummary[typeName].count += 1;
              roomTypeSummary[typeName].nights = Math.max(roomTypeSummary[typeName].nights, nights);
            });

            const totalNightsSum = roomItems.reduce((sum, it) => {
              const nights = it.noches || (it.check_in && it.check_out 
                ? Math.max(1, Math.round((new Date(it.check_out.split('T')[0]).getTime() - new Date(it.check_in.split('T')[0]).getTime()) / (1000 * 60 * 60 * 24)))
                : quote.cant_noches) || 1;
              return sum + nights;
            }, 0);

            return (
              <div className="flex-1 w-full max-w-sm bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-2.5">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1.5">
                  Resumen de Alojamiento
                </h5>
                <div className="space-y-2 text-xs">
                  <div className="space-y-1">
                    {Object.entries(roomTypeSummary).map(([typeName, summary]) => (
                      <div key={typeName} className="flex justify-between text-slate-700">
                        <span className="font-semibold">{typeName}:</span>
                        <span className="font-bold">
                          {summary.count} {summary.count === 1 ? 'unidad' : 'unidades'} ({summary.nights} {summary.nights === 1 ? 'noche' : 'noches'})
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 pt-2 space-y-1 text-[11px] text-slate-500">
                    <div className="flex justify-between">
                      <span>Habitaciones Totales:</span>
                      <span className="font-bold text-slate-800">{roomItems.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Noches Totales:</span>
                      <span className="font-bold text-indigo-600">{totalNightsSum} {totalNightsSum === 1 ? 'noche' : 'noches'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Right: Totals Breakdown */}
          <div className="w-80 space-y-2 text-xs">
            {quote.impuestos_incluidos && (
              <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-100 mb-2 text-right">
                * Precios incluyen impuestos (ISV/Turismo).
              </div>
            )}
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Subtotal:</span>
              <span className="font-bold text-slate-800">{formatCurrency(quote.subtotal, quote.moneda)}</span>
            </div>
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Impuesto ISV ({(tasaIsv * 100).toFixed(0)}%):</span>
              <span className="font-bold text-slate-800">{formatCurrency(quote.impuesto_isv, quote.moneda)}</span>
            </div>
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Impuesto Turístico ({(tasaTurismo * 100).toFixed(0)}%):</span>
              <span className="font-bold text-slate-800">{formatCurrency(quote.impuesto_turismo, quote.moneda)}</span>
            </div>
            <div className="flex justify-between text-indigo-600 font-black border-t border-slate-100 pt-3.5 text-base">
              <span>Total Estimado:</span>
              <span>{formatCurrency(quote.total, quote.moneda)}</span>
            </div>
            {quote.moneda === 'HNL' ? (
              <div className="flex justify-between text-slate-400 font-semibold">
                <span>Equivalente en Dólares (USD):</span>
                <span>{formatCurrency(quote.total / quote.tipo_cambio, 'USD')}</span>
              </div>
            ) : (
              <div className="flex justify-between text-slate-400 font-semibold">
                <span>Equivalente en Lempiras (HNL):</span>
                <span>{formatCurrency(quote.total * quote.tipo_cambio, 'HNL')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Legal footers */}
        <div className="border-t border-slate-200/60 pt-6 grid grid-cols-2 gap-6 text-[10px] leading-relaxed text-slate-400 font-medium">
          <div className="space-y-3">
            <div>
              <span className="font-bold uppercase block text-[11px] text-slate-600 mb-1">Políticas de Reserva</span>
              <p>{quote.politicas_cancelacion}</p>
            </div>
            <div>
              <span className="font-bold uppercase block text-[11px] text-slate-600 mb-1">Cuentas Bancarias</span>
              <p className="whitespace-pre-line">{quote.cuentas_bancarias}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <span className="font-bold uppercase block text-[11px] text-slate-600 mb-1">Vigencia</span>
              <p>{quote.vigencia_texto}</p>
            </div>
            <div>
              <span className="font-bold uppercase block text-[11px] text-slate-600 mb-1">Cláusula de No Fiscalidad</span>
              <p>{quote.clausula_no_fiscalidad}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
