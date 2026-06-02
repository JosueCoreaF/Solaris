import React, { useEffect, useState } from 'react';
import { 
  Building2, 
  DollarSign, 
  Clock, 
  Shield, 
  Calendar, 
  Coins, 
  Percent, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Compass,
  Star,
  Phone,
  Mail,
  MapPin,
  Heart
} from 'lucide-react';
import {
  obtenerConfigHotelera,
  actualizarConfigHotelera,
  obtenerTiposHabitacion,
  crearTipoHabitacion,
  actualizarTipoHabitacion,
  eliminarTipoHabitacion,
  obtenerServicios,
  crearServicio,
  actualizarServicio,
  eliminarServicio,
  type Servicio,
  obtenerHoteles,
  actualizarHotel,
} from '../../api/configService';

interface ConfiguracionHotelera {
  id: string;
  id_hotel: string;
  moneda_principal: string;
  moneda_alterna: string;
  tipo_cambio_base: number;
  tipo_cambio_actualizado_en: string;
  tasa_isv: number;
  tasa_turistica: number;
  hora_checkin: string;
  hora_checkout: string;
  descuento_tercera_edad: number;
  edad_tercera_edad: number;
  ciudad_base: string;
  nombre_red_hoteles?: string;
  permite_sobreventa: boolean;
  auto_confirmar_pagos: boolean;
  permitir_edicion_personal: boolean;
  horas_anticipacion_reserva: number;
  umbral_ocupacion: number;
  orientacion_calendario: string;
  actualizado_en: string;
}

interface TipoHabitacion {
  id: string;
  nombre: string;
  descripcion: string;
  precio_base: number;
  estado: 'activo' | 'inactivo';
}


interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

export const Config: React.FC = () => {
  // Configuración del Hotel Activo
  const [config, setConfig] = useState<ConfiguracionHotelera | null>(null);
  const [tiposHabitacion, setTiposHabitacion] = useState<TipoHabitacion[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [hoteles, setHoteles] = useState<any[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState(localStorage.getItem('active_hotel_id') || '');
  
  // UX y Controladores
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'finanzas' | 'operaciones' | 'politicas'>('general');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Estados para Edición de Hotel
  const [hotelNombre, setHotelNombre] = useState('');
  const [hotelCiudad, setHotelCiudad] = useState('');
  const [hotelDireccion, setHotelDireccion] = useState('');
  const [hotelTelefono, setHotelTelefono] = useState('');
  const [hotelCorreo, setHotelCorreo] = useState('');
  const [hotelEstrellas, setHotelEstrellas] = useState(3);
  const [hotelMaps, setHotelMaps] = useState('');
  const [hotelSlug, setHotelSlug] = useState('');
  const [hotelLogoUrl, setHotelLogoUrl] = useState('');
  const [hotelColorPrimario, setHotelColorPrimario] = useState('#1c1917');
  const [hotelColorSecundario, setHotelColorSecundario] = useState('');
  const [hotelFacebook, setHotelFacebook] = useState('');
  const [hotelInstagram, setHotelInstagram] = useState('');

  // Estados para Parámetros de Configuración
  const [nombreRed, setNombreRed] = useState('');
  const [monedaPrincipal, setMonedaPrincipal] = useState('HNL');
  const [monedaAlterna, setMonedaAlterna] = useState('USD');
  const [tipoCambio, setTipoCambio] = useState(24.50);
  const [tasaISV, setTasaISV] = useState(15);
  const [tasaTuristica, setTasaTuristica] = useState(4);
  const [horaCheckin, setHoraCheckin] = useState('15:00');
  const [horaCheckout, setHoraCheckout] = useState('12:00');
  const [descuentoTerceraEdad, setDescuentoTerceraEdad] = useState(25);
  const [edadTerceraEdad, setEdadTerceraEdad] = useState(60);
  const [permiteSobreventa, setPermiteSobreventa] = useState(false);
  const [autoConfirmarPagos, setAutoConfirmarPagos] = useState(true);
  const [permitirEdicionPersonal, setPermitirEdicionPersonal] = useState(true);
  const [horasAnticipacion, setHorasAnticipacion] = useState(14);
  const [umbralOcupacion, setUmbralOcupacion] = useState(85);
  const [orientacionCalendario, setOrientacionCalendario] = useState('vertical');
  const [ciudadBase, setCiudadBase] = useState('');

  // Estados para Formulario de Habitación
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomEditId, setRoomEditId] = useState<string | null>(null);
  const [roomNombre, setRoomNombre] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [roomPrecio, setRoomPrecio] = useState(100);

  // Estados para Formulario de Servicio
  const [showServicioModal, setShowServicioModal] = useState(false);
  const [editingServicio, setEditingServicio] = useState<Servicio | null>(null);
  const [svcNombre, setSvcNombre] = useState('');
  const [svcIcono, setSvcIcono] = useState('');
  const [svcAcumulable, setSvcAcumulable] = useState(false);
  const [svcCantidad, setSvcCantidad] = useState(0);
  const [svcSaving, setSvcSaving] = useState(false);

  // Sistema de Toasts
  const addToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Obtener todos los hoteles accesibles
      const hotelesData = await obtenerHoteles();
      let activeId = localStorage.getItem('active_hotel_id') || '';
      
      if (hotelesData && Array.isArray(hotelesData)) {
        setHoteles(hotelesData);
        // Garantizar que no haya modo consolidado "all"
        const exists = activeId && activeId !== 'all' && hotelesData.some((h: any) => h.id_hotel === activeId);
        if (!exists && hotelesData.length > 0) {
          activeId = hotelesData[0].id_hotel;
          localStorage.setItem('active_hotel_id', activeId);
          setSelectedHotelId(activeId);
        } else {
          setSelectedHotelId(activeId);
        }
      }

      const activeHotel = (hotelesData || []).find((h: any) => h.id_hotel === activeId) || hotelesData?.[0];
      if (activeHotel) {
        setHotelNombre(activeHotel.nombre_hotel || '');
        setHotelCiudad(activeHotel.ciudad || '');
        setHotelDireccion(activeHotel.direccion || '');
        setHotelTelefono(activeHotel.telefono || '');
        setHotelCorreo(activeHotel.correo_contacto || '');
        setHotelEstrellas(Number(activeHotel.estrellas ?? 3));
        setHotelMaps(activeHotel.enlace_google_maps || '');
        setHotelSlug(activeHotel.slug || '');
      }

      if (!activeId) {
        setLoading(false);
        return;
      }

      // 2. Obtener configuración, tipos de habitación y servicios
      const [configData, tiposData, serviciosData] = await Promise.all([
        obtenerConfigHotelera(activeId),
        obtenerTiposHabitacion(),
        obtenerServicios(),
      ]);

      if (configData) {
        setConfig(configData);
        setNombreRed(configData.nombre_red_hoteles || '');
        setMonedaPrincipal(configData.moneda_principal || 'HNL');
        setMonedaAlterna(configData.moneda_alterna || 'USD');
        setTipoCambio(Number(configData.tipo_cambio_base ?? 24.50));
        setTasaISV(Number((configData.tasa_isv ?? 0) * 100));
        setTasaTuristica(Number((configData.tasa_turistica ?? 0) * 100));
        setDescuentoTerceraEdad(Number(configData.descuento_tercera_edad ?? 25));
        setEdadTerceraEdad(Number(configData.edad_tercera_edad ?? 60));
        setPermiteSobreventa(!!configData.permite_sobreventa);
        setAutoConfirmarPagos(!!configData.auto_confirmar_pagos);
        setPermitirEdicionPersonal(!!configData.permitir_edicion_personal);
        setHorasAnticipacion(Number(configData.horas_anticipacion_reserva ?? 14));
        setUmbralOcupacion(Number(configData.umbral_ocupacion ?? 85));
        setOrientacionCalendario(configData.orientacion_calendario || 'vertical');
        setCiudadBase(configData.ciudad_base || '');

        if (configData.hora_checkin) setHoraCheckin(configData.hora_checkin.substring(0, 5));
        if (configData.hora_checkout) setHoraCheckout(configData.hora_checkout.substring(0, 5));
      }

      if (tiposData) {
        setTiposHabitacion(tiposData);
      }

      if (serviciosData) {
        setServicios(serviciosData);
      }

    } catch (err: any) {
      console.error(err);
      setError('Error al conectar con la base de datos o cargar configuraciones.');
      addToast('No se pudieron obtener todos los datos dinámicos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchHotel = (hotelId: string) => {
    if (hotelId === 'all') return; // Bloquear consolidado
    localStorage.setItem('active_hotel_id', hotelId);
    setSelectedHotelId(hotelId);
    cargarDatos();
    addToast('Hotel seleccionado cambiado exitosamente.', 'info');
  };

  // Guardar pestaña actual
  const handleSaveTab = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedHotelId) return;

    setSaving(true);
    try {
      if (activeTab === 'general') {
        // Guardar información del hotel
        const res = await actualizarHotel(selectedHotelId, {
          nombre_hotel: hotelNombre,
          ciudad: hotelCiudad,
          direccion: hotelDireccion,
          telefono: hotelTelefono,
          correo_contacto: hotelCorreo,
          estrellas: hotelEstrellas,
          enlace_google_maps: hotelMaps,
          slug: hotelSlug.trim() || null,
        });

        if (res && res.success) {
          addToast('Información general del hotel actualizada.', 'success');
          // Actualizar lista local de hoteles
          setHoteles(prev => prev.map(h => h.id_hotel === selectedHotelId ? { ...h, nombre_hotel: hotelNombre, ciudad: hotelCiudad } : h));
        } else {
          throw new Error('Error al actualizar hotel');
        }
      } else {
        // Guardar configuración general
        const updatedConfig = await actualizarConfigHotelera({
          moneda_principal: monedaPrincipal,
          moneda_alterna: monedaAlterna,
          tipo_cambio_base: Number(tipoCambio),
          tasa_isv: Number(tasaISV) / 100,
          tasa_turistica: Number(tasaTuristica) / 100,
          nombre_red_hoteles: nombreRed,
          hora_checkin: horaCheckin,
          hora_checkout: horaCheckout,
          descuento_tercera_edad: Number(descuentoTerceraEdad),
          edad_tercera_edad: Number(edadTerceraEdad),
          permite_sobreventa: permiteSobreventa,
          auto_confirmar_pagos: autoConfirmarPagos,
          permitir_edicion_personal: permitirEdicionPersonal,
          horas_anticipacion_reserva: Number(horasAnticipacion),
          umbral_ocupacion: Number(umbralOcupacion),
          orientacion_calendario: orientacionCalendario,
          ciudad_base: ciudadBase
        }, selectedHotelId);

        if (updatedConfig) {
          setConfig(updatedConfig);
          addToast('Configuración del sistema guardada correctamente.', 'success');
        }
      }
    } catch (err: any) {
      console.error(err);
      addToast('Error al intentar guardar los datos.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Crear / Editar Tipo de Habitación
  const handleSaveRoomType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNombre.trim()) return;

    try {
      if (roomEditId) {
        const res = await actualizarTipoHabitacion(roomEditId, {
          nombre: roomNombre,
          descripcion: roomDesc,
          precio_base: roomPrecio
        });
        if (res) {
          setTiposHabitacion(prev => prev.map(t => t.id === roomEditId ? { ...t, nombre: roomNombre, descripcion: roomDesc, precio_base: roomPrecio } : t));
          addToast('Tipo de habitación actualizado.', 'success');
        }
      } else {
        const res = await crearTipoHabitacion({
          nombre: roomNombre,
          descripcion: roomDesc,
          precio_base: roomPrecio,
          id_hotel: selectedHotelId
        });
        if (res && res.data) {
          setTiposHabitacion(prev => [...prev, res.data]);
          addToast('Tipo de habitación creado exitosamente.', 'success');
        } else {
          // Fallback por si la respuesta retorna el objeto mapeado
          cargarDatos();
          addToast('Tipo de habitación creado.', 'success');
        }
      }
      setShowRoomModal(false);
      setRoomEditId(null);
      setRoomNombre('');
      setRoomDesc('');
      setRoomPrecio(100);
    } catch (err) {
      console.error(err);
      addToast('Error al guardar el tipo de habitación.', 'error');
    }
  };

  const handleEditRoomType = (tipo: TipoHabitacion) => {
    setRoomEditId(tipo.id);
    setRoomNombre(tipo.nombre);
    setRoomDesc(tipo.descripcion);
    setRoomPrecio(tipo.precio_base);
    setShowRoomModal(true);
  };

  const handleDeleteRoomType = async (id: string) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este tipo de habitación? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      await eliminarTipoHabitacion(id);
      setTiposHabitacion(prev => prev.filter(t => t.id !== id));
      addToast('Tipo de habitación eliminado.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Error al eliminar tipo de habitación.', 'error');
    }
  };

  // Abrir modal servicio (crear o editar)
  const abrirServicioModal = (s?: Servicio) => {
    setEditingServicio(s ?? null);
    setSvcNombre(s?.nombre ?? '');
    setSvcIcono(s?.icono ?? '');
    setSvcAcumulable(s?.es_acumulable ?? false);
    setSvcCantidad(s?.cantidad_total ?? 0);
    setShowServicioModal(true);
  };

  // Guardar servicio (crear o editar)
  const handleGuardarServicio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!svcNombre.trim()) return;
    setSvcSaving(true);
    try {
      const payload = { nombre: svcNombre.trim(), icono: svcIcono.trim(), es_acumulable: svcAcumulable, cantidad_total: svcAcumulable ? svcCantidad : 0 };
      if (editingServicio) {
        const updated = await actualizarServicio(editingServicio.id, payload);
        setServicios(prev => prev.map(s => s.id === editingServicio.id ? { ...s, ...updated } : s));
        addToast('Servicio actualizado.', 'success');
      } else {
        const created = await crearServicio(payload);
        setServicios(prev => [...prev, created]);
        addToast('Servicio creado.', 'success');
      }
      setShowServicioModal(false);
    } catch (err) {
      console.error(err);
      addToast('Error al guardar el servicio.', 'error');
    } finally {
      setSvcSaving(false);
    }
  };

  // Eliminar servicio
  const handleEliminarServicio = async (id: string) => {
    if (!window.confirm('¿Eliminar este servicio?')) return;
    try {
      await eliminarServicio(id);
      setServicios(prev => prev.filter(s => s.id !== id));
      addToast('Servicio eliminado.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Error al eliminar la amenidad.', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', backgroundColor: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            border: '3px solid #e2e8f0', 
            borderTopColor: '#4f46e5', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite', 
            margin: '0 auto 20px' 
          }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: '#475569', letterSpacing: '0.025em' }}>Cargando Panel de Configuración Dinámico...</p>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Sincronizando información de la propiedad</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const currentHotelObj = hoteles.find(h => h.id_hotel === selectedHotelId);

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f1f5f9', 
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.05) 0px, transparent 50%), radial-gradient(at 50% 0%, rgba(16, 185, 129, 0.03) 0px, transparent 50%)',
      padding: '28px 24px', 
      fontFamily: '"Inter", sans-serif'
    }}>
      
      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 20px',
            borderRadius: 12,
            backgroundColor: '#ffffff',
            borderLeft: `5px solid ${toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6'}`,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            animation: 'slideIn 0.3s ease-out forwards',
            minWidth: 280,
            maxWidth: 400
          }}>
            {toast.type === 'success' && <Check size={18} style={{ color: '#10b981' }} />}
            {toast.type === 'error' && <AlertCircle size={18} style={{ color: '#ef4444' }} />}
            {toast.type === 'info' && <Sparkles size={18} style={{ color: '#3b82f6' }} />}
            <span style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>{toast.text}</span>
          </div>
        ))}
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(120%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
      </div>

      {/* Header Panel */}
      <div style={{ 
        maxWidth: 1200, 
        margin: '0 auto 30px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: 20 
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em', backgroundColor: 'rgba(79, 70, 229, 0.08)', padding: '4px 10px', borderRadius: 20 }}>CONFIGURACIÓN</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.1em', backgroundColor: 'rgba(5, 150, 105, 0.08)', padding: '4px 10px', borderRadius: 20 }}>100% DINÁMICO</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>
            Ajustes del Sistema
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4, margin: 0 }}>
            Gestiona la información comercial, monedas, impuestos y parámetros de reserva de tu propiedad activa.
          </p>
        </div>

        {/* Hotel Selector - Premium Styling */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12, 
          backgroundColor: '#ffffff', 
          padding: '10px 16px', 
          borderRadius: 16, 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0' 
        }}>
          <Building2 size={20} style={{ color: '#4f46e5' }} />
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
              🏨 Propiedad Seleccionada
            </label>
            <select
              value={selectedHotelId}
              onChange={e => handleSwitchHotel(e.target.value)}
              style={{ 
                border: 'none', 
                backgroundColor: 'transparent', 
                fontSize: 14, 
                fontWeight: 700, 
                color: '#1e293b', 
                outline: 'none', 
                cursor: 'pointer',
                paddingRight: 10
              }}
            >
              {hoteles.map((h: any) => (
                <option key={h.id_hotel} value={h.id_hotel}>
                  {h.nombre_hotel} ({h.ciudad || 'Honduras'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ 
          maxWidth: 1200, 
          margin: '0 auto 24px', 
          padding: '16px 20px', 
          borderRadius: 14, 
          backgroundColor: '#fef2f2', 
          border: '1px solid #fee2e2', 
          color: '#ef4444', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12,
          boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.05)'
        }}>
          <AlertCircle size={20} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{error}</span>
        </div>
      )}

      {/* Main Container */}
      <div style={{ 
        maxWidth: 1200, 
        margin: '0 auto', 
        display: 'grid', 
        gridTemplateColumns: '260px 1fr', 
        gap: 30,
        alignItems: 'start'
      }}>
        
        {/* Navigation Sidebar Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ 
            backgroundColor: '#ffffff', 
            borderRadius: 20, 
            padding: '16px', 
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.02), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
            border: '1px solid #e2e8f0'
          }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { id: 'general', label: 'Hotel y Propiedad', icon: Building2, color: '#4f46e5' },
                { id: 'finanzas', label: 'Finanzas e Impuestos', icon: DollarSign, color: '#10b981' },
                { id: 'operaciones', label: 'Operaciones de Reserva', icon: Clock, color: '#3b82f6' },
                { id: 'politicas', label: 'Políticas y Descuentos', icon: Shield, color: '#f59e0b' },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: 'none',
                      backgroundColor: isActive ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                      color: isActive ? '#4f46e5' : '#475569',
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.color = '#1e293b';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#475569';
                      }
                    }}
                  >
                    <Icon size={18} style={{ color: isActive ? '#4f46e5' : '#94a3b8', transition: 'color 0.2s' }} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Info card */}
          {currentHotelObj && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#4f46e5' }} />
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>Estado Operativo</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Ciudad base:</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{ciudadBase || currentHotelObj.ciudad || 'No definida'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Moneda principal:</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#4f46e5' }}>{monedaPrincipal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Cambio actual:</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>{tipoCambio} {monedaPrincipal}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Form Panel */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          borderRadius: 24, 
          padding: '30px', 
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.04), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          minHeight: 480
        }}>
          
          <form onSubmit={handleSaveTab}>
            
            {/* 1. GENERAL TAB */}
            {activeTab === 'general' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
                  <Building2 size={24} style={{ color: '#4f46e5' }} />
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Información de la Propiedad</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Datos reales y de ubicación del hotel para facturas y portal de clientes.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Nombre Comercial del Hotel (Solo lectura)</label>
                    <input 
                      type="text" 
                      required 
                      disabled={true}
                      value={hotelNombre} 
                      onChange={e => setHotelNombre(e.target.value)} 
                      style={{ ...inputStyle, cursor: 'not-allowed', backgroundColor: '#e2e8f0', opacity: 0.8 }} 
                      placeholder="Ej. Hotel Verona Resort"
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Ciudad (Solo lectura)</label>
                    <input 
                      type="text" 
                      required 
                      disabled={true}
                      value={hotelCiudad} 
                      onChange={e => setHotelCiudad(e.target.value)} 
                      style={{ ...inputStyle, cursor: 'not-allowed', backgroundColor: '#e2e8f0', opacity: 0.8 }} 
                      placeholder="Ej. Roatán"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Teléfono de Contacto</label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={14} style={{ position: 'absolute', left: 12, top: 13, color: '#94a3b8' }} />
                      <input 
                        type="text" 
                        value={hotelTelefono} 
                        onChange={e => setHotelTelefono(e.target.value)} 
                        style={{ ...inputStyle, paddingLeft: 34 }} 
                        placeholder="Ej. +504 2550-1234"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Correo de Contacto</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={14} style={{ position: 'absolute', left: 12, top: 13, color: '#94a3b8' }} />
                      <input 
                        type="email" 
                        value={hotelCorreo} 
                        onChange={e => setHotelCorreo(e.target.value)} 
                        style={{ ...inputStyle, paddingLeft: 34 }} 
                        placeholder="Ej. contacto@veronahotel.com"
                      />
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Dirección Completa</label>
                    <div style={{ position: 'relative' }}>
                      <MapPin size={14} style={{ position: 'absolute', left: 12, top: 13, color: '#94a3b8' }} />
                      <input 
                        type="text" 
                        value={hotelDireccion} 
                        onChange={e => setHotelDireccion(e.target.value)} 
                        style={{ ...inputStyle, paddingLeft: 34 }} 
                        placeholder="Ej. Barrio Los Andes, 14 Avenida entre 2 y 3 Calle"
                      />
                    </div>
                  </div>

                  {/* Slug del portal */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                      Slug del Portal Público <span style={{ fontWeight: 400, color: '#94a3b8' }}>(URL de reservas en solarys.uk)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>solarys.uk/</span>
                      <input
                        type="text"
                        value={hotelSlug}
                        onChange={e => setHotelSlug(
                          e.target.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-')
                        )}
                        style={inputStyle}
                        placeholder="hotel-nombre-ciudad"
                      />
                    </div>
              </div>
              
              {/* BRANDING Y DISEÑO */}
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} style={{ color: '#8b5cf6' }} /> Marca Blanca y Diseño (Portal Web)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
                      Logo URL
                    </label>
                    <input
                      type="url"
                      value={hotelLogoUrl}
                      onChange={(e) => setHotelLogoUrl(e.target.value)}
                      placeholder="https://tuhotel.com/logo.png"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
                      Color Primario (Botones)
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="color"
                        value={hotelColorPrimario}
                        onChange={(e) => setHotelColorPrimario(e.target.value)}
                        style={{ height: '42px', width: '50px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={hotelColorPrimario}
                        onChange={(e) => setHotelColorPrimario(e.target.value)}
                        placeholder="#1c1917"
                        style={{ flex: 1, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: 14 }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
                      Enlace de Facebook
                    </label>
                    <input
                      type="url"
                      value={hotelFacebook}
                      onChange={(e) => setHotelFacebook(e.target.value)}
                      placeholder="https://facebook.com/..."
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
                      Enlace de Instagram
                    </label>
                    <input
                      type="url"
                      value={hotelInstagram}
                      onChange={(e) => setHotelInstagram(e.target.value)}
                      placeholder="https://instagram.com/..."
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: 14 }}
                    />
                  </div>
                </div>

                    {hotelSlug && (
                      <a href={`https://solarys.uk/${hotelSlug}`} target="_blank" rel="noreferrer"
                        style={{ display: 'inline-block', fontSize: 11, color: '#4f46e5', fontWeight: 600, marginTop: 6, textDecoration: 'none' }}>
                        Ver portal: solarys.uk/{hotelSlug}
                      </a>
                    )}
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Enlace de Ubicación (Google Maps)</label>
                    <input
                      type="url"
                      value={hotelMaps}
                      onChange={e => setHotelMaps(e.target.value)}
                      style={inputStyle}
                      placeholder="Ej. https://maps.app.goo.gl/abcdefg"
                    />
                    {hotelMaps && (
                      <a href={hotelMaps} target="_blank" rel="noreferrer" style={{ display: 'inline-block', fontSize: 11, color: '#4f46e5', fontWeight: 600, marginTop: 6, textDecoration: 'none' }}>
                        Ver en mapa
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. FINANZAS TAB */}
            {activeTab === 'finanzas' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
                  <DollarSign size={24} style={{ color: '#10b981' }} />
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Monedas, Impuestos y Redes</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Parámetros comerciales y fiscales indispensables para el cálculo de reservas y cobros.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Nombre de la Red de Hoteles</label>
                    <input 
                      type="text" 
                      value={nombreRed} 
                      onChange={e => setNombreRed(e.target.value)} 
                      style={inputStyle} 
                      placeholder="Ej. Partner Central Hoteles"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Ciudad Base de Operación</label>
                    <input 
                      type="text" 
                      value={ciudadBase} 
                      onChange={e => setCiudadBase(e.target.value)} 
                      style={inputStyle} 
                      placeholder="Ej. San Pedro Sula"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Moneda Principal</label>
                    <select value={monedaPrincipal} onChange={e => setMonedaPrincipal(e.target.value)} style={inputStyle}>
                      <option value="HNL">Lempira Hondureño (HNL)</option>
                      <option value="USD">Dólar Estadounidense (USD)</option>
                      <option value="GTQ">Quetzal Guatemalteco (GTQ)</option>
                      <option value="NIO">Córdoba Nicaragüense (NIO)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Moneda Alterna / Referencia</label>
                    <select value={monedaAlterna} onChange={e => setMonedaAlterna(e.target.value)} style={inputStyle}>
                      <option value="USD">Dólar Estadounidense (USD)</option>
                      <option value="HNL">Lempira Hondureño (HNL)</option>
                      <option value="EUR">Euro (EUR)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Tipo de Cambio (1 {monedaAlterna} =)</label>
                    <div style={{ position: 'relative' }}>
                      <Coins size={14} style={{ position: 'absolute', left: 12, top: 13, color: '#94a3b8' }} />
                      <input 
                        type="number" 
                        step="0.0001" 
                        required 
                        value={tipoChangeValue(tipoCambio)} 
                        onChange={e => setTipoCambio(parseFloat(e.target.value) || 0)} 
                        style={{ ...inputStyle, paddingLeft: 34 }} 
                      />
                      <span style={{ position: 'absolute', right: 12, top: 11, fontSize: 12, fontWeight: 700, color: '#64748b' }}>{monedaPrincipal}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Impuesto Sobre la Venta (ISV / IVA)</label>
                    <div style={{ position: 'relative' }}>
                      <Percent size={14} style={{ position: 'absolute', left: 12, top: 13, color: '#94a3b8' }} />
                      <input 
                        type="number" 
                        step="0.1" 
                        required 
                        value={tasaISV} 
                        onChange={e => setTasaISV(parseFloat(e.target.value) || 0)} 
                        style={{ ...inputStyle, paddingLeft: 34 }} 
                        placeholder="Ej. 15"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Tasa de Impuesto Turístico</label>
                    <div style={{ position: 'relative' }}>
                      <Percent size={14} style={{ position: 'absolute', left: 12, top: 13, color: '#94a3b8' }} />
                      <input 
                        type="number" 
                        step="0.1" 
                        required 
                        value={tasaTuristica} 
                        onChange={e => setTasaTuristica(parseFloat(e.target.value) || 0)} 
                        style={{ ...inputStyle, paddingLeft: 34 }} 
                        placeholder="Ej. 4"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. OPERACIONES TAB */}
            {activeTab === 'operaciones' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
                  <Clock size={24} style={{ color: '#3b82f6' }} />
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Operaciones y Reservas</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Controla las restricciones de tiempo, sobreventas y el comportamiento del personal en la plataforma.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Hora de Check-in Estándar</label>
                    <input 
                      type="time" 
                      required 
                      value={horaCheckin} 
                      onChange={e => setHoraCheckin(e.target.value)} 
                      style={inputStyle} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Hora de Check-out Estándar</label>
                    <input 
                      type="time" 
                      required 
                      value={horaCheckout} 
                      onChange={e => setHoraCheckout(e.target.value)} 
                      style={inputStyle} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Anticipación de Reserva (Horas Mínimas)</label>
                    <input 
                      type="number" 
                      min="0"
                      required 
                      value={horasAnticipacion} 
                      onChange={e => setHorasAnticipacion(parseInt(e.target.value) || 0)} 
                      style={inputStyle} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Umbral de Alerta de Ocupación (%)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      required 
                      value={umbralOcupacion} 
                      onChange={e => setUmbralOcupacion(parseInt(e.target.value) || 0)} 
                      style={inputStyle} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Orientación del Calendario Administrativo</label>
                    <select value={orientacionCalendario} onChange={e => setOrientacionCalendario(e.target.value)} style={inputStyle}>
                      <option value="vertical">📅 Orientación Vertical (Línea de tiempo continua)</option>
                      <option value="horizontal">📅 Orientación Horizontal (Bloque estándar)</option>
                    </select>
                  </div>
                </div>

                {/* Switches Operativos con UX Premium */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, backgroundColor: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                  
                  {/* Switch 1: Permite Sobreventa */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>Permitir Sobreventas (Overbooking)</h4>
                      <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0 0' }}>Habilita al personal para registrar reservas aun si la ocupación del tipo está al 100%.</p>
                    </div>
                    {renderiOSSwitch(permiteSobreventa, setPermiteSobreventa)}
                  </div>

                  {/* Switch 2: Auto Confirmar Pagos */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>Auto-Confirmar Pagos</h4>
                      <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0 0' }}>El sistema marcará reservas como confirmadas al detectar cobros equivalentes al anticipo.</p>
                    </div>
                    {renderiOSSwitch(autoConfirmarPagos, setAutoConfirmarPagos)}
                  </div>

                  {/* Switch 3: Permitir Edicion Personal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>Permitir Edición de Datos Personales</h4>
                      <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0 0' }}>Habilita a los recepcionistas y staff no administrativo a editar la información del huésped.</p>
                    </div>
                    {renderiOSSwitch(permitirEdicionPersonal, setPermitirEdicionPersonal)}
                  </div>

                </div>
              </div>
            )}

            {/* 4. POLÍTICAS TAB */}
            {activeTab === 'politicas' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
                  <Shield size={24} style={{ color: '#f59e0b' }} />
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Políticas de Descuentos & Tercera Edad</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Define los descuentos obligatorios por ley o políticas comerciales especiales.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, backgroundColor: '#fdfbeb', padding: 20, borderRadius: 16, border: '1px solid #fef3c7', marginBottom: 20 }}>
                  
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#b45309', display: 'block', marginBottom: 6 }}>Edad de Tercera Edad (Años Mínimos)</label>
                    <input 
                      type="number" 
                      min="0"
                      required 
                      value={edadTerceraEdad} 
                      onChange={e => setEdadTerceraEdad(parseInt(e.target.value) || 0)} 
                      style={{ ...inputStyle, border: '1px solid #fcd34d', backgroundColor: '#ffffff' }} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#b45309', display: 'block', marginBottom: 6 }}>Porcentaje de Descuento (%)</label>
                    <div style={{ position: 'relative' }}>
                      <Percent size={14} style={{ position: 'absolute', left: 12, top: 13, color: '#b45309' }} />
                      <input 
                        type="number" 
                        min="0"
                        max="100"
                        required 
                        value={descuentoTerceraEdad} 
                        onChange={e => setDescuentoTerceraEdad(parseFloat(e.target.value) || 0)} 
                        style={{ ...inputStyle, paddingLeft: 34, border: '1px solid #fcd34d', backgroundColor: '#ffffff' }} 
                      />
                    </div>
                  </div>

                </div>

                <div style={{ padding: '14px 16px', borderRadius: 12, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontSize: 12, display: 'flex', gap: 10 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1, color: '#f59e0b' }} />
                  <span>
                    <strong>Nota Legal:</strong> El descuento de la tercera edad es aplicable automáticamente a la tarifa base de la habitación al activar la opción de descuento tercera edad del huésped titular en el módulo de reservas.
                  </span>
                </div>
              </div>
            )}

            {/* BUTTONS BAR (Saves config / hotel tabs) */}
            {(
              <div style={{ 
                marginTop: 30, 
                paddingTop: 20, 
                borderTop: '1px solid #f1f5f9', 
                display: 'flex', 
                justifyContent: 'flex-end',
                gap: 12
              }}>
                <button
                  type="button"
                  onClick={() => cargarDatos()}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    border: 'none',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = '#4338ca';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(79, 70, 229, 0.3)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = '#4f46e5';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(79, 70, 229, 0.2)';
                  }}
                >
                  {saving ? (
                    <div style={{ width: 14, height: 14, border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                  ) : (
                    <Save size={15} />
                  )}
                  Guardar Configuración
                </button>
              </div>
            )}

          </form>


        </div>
      </div>
    </div>
  );
};

// UI Styling Consts (Inline JS style models)
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  backgroundColor: '#f8fafc',
  fontSize: 13,
  fontWeight: 500,
  color: '#334155',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'all 0.15s ease'
};

// Rendering helpers
const tipoChangeValue = (val: number) => {
  return val === undefined || isNaN(val) ? 24.50 : val;
};

// iOS Toggles custom rendering
const renderiOSSwitch = (checked: boolean, setChecked: (val: boolean) => void) => {
  return (
    <div 
      onClick={() => setChecked(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 20,
        backgroundColor: checked ? '#10b981' : '#cbd5e1',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 2px',
        boxSizing: 'border-box'
      }}
    >
      <div style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        backgroundColor: '#ffffff',
        transform: checked ? 'translateX(20px)' : 'translateX(0px)',
        transition: 'transform 0.2s ease',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
      }} />
    </div>
  );
};
