import React, { useEffect, useState } from 'react';
import { AlertCircle, DollarSign, Building2, Shield, Calendar } from 'lucide-react';
import {
  obtenerConfigHotelera,
  actualizarConfigHotelera,
  obtenerTiposHabitacion,
  crearTipoHabitacion,
  actualizarTipoHabitacion,
  eliminarTipoHabitacion,
  obtenerAmenidades,
  actualizarAmenidad,
  actualizarParametrosReserva,
  obtenerHoteles,
  registrarHotel,
  actualizarHotel,
} from '../../api/configService';
import { AuditPanel } from './AuditPanel';

interface ConfiguracionHotelera {
  id: string;
  moneda_principal: string;
  moneda_alterna: string;
  tipo_cambio_base: number;
  tasa_isv: number;
  tasa_turistica: number;
  actualizado_en: string;
  nombre_red_hoteles?: string;
}

interface TipoHabitacion {
  id: string;
  nombre: string;
  descripcion: string;
  precio_base: number;
  estado: 'activo' | 'inactivo';
}

interface Amenidad {
  id: string;
  nombre: string;
  descripcion: string;
  activa: boolean;
}

export const Config: React.FC = () => {
  const [config, setConfig] = useState<ConfiguracionHotelera | null>(null);
  const [tiposHabitacion, setTiposHabitacion] = useState<TipoHabitacion[]>([]);
  const [amenidades, setAmenidades] = useState<Amenidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  // Estados para multi-hotel
  const [hoteles, setHoteles] = useState<any[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState(localStorage.getItem('active_hotel_id') || '');
  const [showAddHotelForm, setShowAddHotelForm] = useState(false);
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelCity, setNewHotelCity] = useState('');
  const [newHotelAddress, setNewHotelAddress] = useState('');
  const [newHotelPhone, setNewHotelPhone] = useState('');
  const [newHotelStars, setNewHotelStars] = useState(3);
  const [newHotelMaps, setNewHotelMaps] = useState('');

  // Estados para editar el hotel activo
  const [editingHotelInfo, setEditingHotelInfo] = useState(false);
  const [editHotelAddress, setEditHotelAddress] = useState('');
  const [editHotelMaps, setEditHotelMaps] = useState('');

  // Estados de configuración consolidados
  const [allConfigs, setAllConfigs] = useState<any[]>([]);
  const [editingHotelConfigs, setEditingHotelConfigs] = useState<Record<string, any>>({});

  // Estados para edición
  const [editingCurrency, setEditingCurrency] = useState(false);
  const [newTipoCambio, setNewTipoCambio] = useState(0);
  const [newTasaISV, setNewTasaISV] = useState(0);
  const [newTasaTuristica, setNewTasaTuristica] = useState(0);
  const [newNombreRedHoteles, setNewNombreRedHoteles] = useState('Hotel Verona');

  // Estados para parámetros de reserva
  const [horaCheckin, setHoraCheckin] = useState('14:00');
  const [horaCheckout, setHoraCheckout] = useState('11:00');
  const [diasMinimos, setDiasMinimos] = useState(1);
  const [diasMaximos, setDiasMaximos] = useState(90);

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const cargarConfiguracion = async () => {
    setLoading(true);
    try {
      // Cargar lista de hoteles
      let hotelesList: any[] = [];
      try {
        const hotelesData = await obtenerHoteles();
        if (hotelesData && Array.isArray(hotelesData)) {
          setHoteles(hotelesData);
          hotelesList = hotelesData;
          const currentStored = localStorage.getItem('active_hotel_id');
          const exists = currentStored === 'all' || hotelesData.some((h: any) => h.id_hotel === currentStored);
          if (!exists && hotelesData.length > 0) {
            const defaultId = hotelesData[0].id_hotel;
            localStorage.setItem('active_hotel_id', defaultId);
            setSelectedHotelId(defaultId);
          }
        }
      } catch (hErr) {
        console.error('Error loading hotels list:', hErr);
      }

      const activeId = localStorage.getItem('active_hotel_id') || '';

      // Cargar datos reales del backend
      const [configData, tiposData, amenidadesData] = await Promise.all([
        obtenerConfigHotelera(activeId),
        obtenerTiposHabitacion(),
        obtenerAmenidades(),
      ]);

      if (configData) {
        if (Array.isArray(configData)) {
          setAllConfigs(configData);
          setConfig(null);
          // Pre-cargar borradores para edición simultánea
          const editingDrafts: Record<string, any> = {};
          
          // Asegurarse de que cada hotel de la lista tenga un borrador inicializado
          hotelesList.forEach((item: any) => {
            const c = configData.find((conf: any) => conf.id_hotel === item.id_hotel) || {};
            editingDrafts[item.id_hotel] = {
              moneda_principal: c.moneda_principal || 'HNL',
              moneda_alterna: c.moneda_alterna || 'USD',
              tipo_cambio_base: c.tipo_cambio_base || 24.85,
              tasa_isv: c.tasa_isv || 0.15,
              tasa_turistica: c.tasa_turistica || 0,
              hora_checkin: c.hora_checkin || '14:00',
              hora_checkout: c.hora_checkout || '11:00',
              dias_minimos: c.dias_minimos || 1,
              dias_maximos: c.dias_maximos || 90,
            };
          });
          setEditingHotelConfigs(editingDrafts);
        } else {
          setConfig(configData);
          setAllConfigs([]);
          setNewTipoCambio(configData.tipo_cambio_base || 0);
          setNewTasaISV((configData.tasa_isv || 0) * 100);
          setNewTasaTuristica((configData.tasa_turistica || 0) * 100);
          setNewNombreRedHoteles(configData.nombre_red_hoteles || 'Hotel Verona');
          
          if (configData.hora_checkin) setHoraCheckin(configData.hora_checkin.substring(0, 5));
          if (configData.hora_checkout) setHoraCheckout(configData.hora_checkout.substring(0, 5));
          if (configData.dias_minimos_reserva) setDiasMinimos(configData.dias_minimos_reserva);
          if (configData.dias_maximos_reserva) setDiasMaximos(configData.dias_maximos_reserva);
        }
      }

      if (tiposData) {
        setTiposHabitacion(tiposData);
      }

      if (amenidadesData) {
        setAmenidades(amenidadesData);
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar configuración');
      // Fallback a datos mock si hay error
      setConfig({
        id: '1',
        moneda_principal: 'HNL',
        moneda_alterna: 'USD',
        tipo_cambio_base: 24.85,
        tasa_isv: 0.15,
        tasa_turistica: 0.03,
        actualizado_en: new Date().toISOString(),
      });

      setTiposHabitacion([
        { id: '1', nombre: 'Suite Deluxe', descripcion: 'Habitación con vista al mar', precio_base: 150, estado: 'activo' },
        { id: '2', nombre: 'Doble Estándar', descripcion: 'Habitación doble confortable', precio_base: 100, estado: 'activo' },
        { id: '3', nombre: 'Simple', descripcion: 'Habitación sencilla', precio_base: 70, estado: 'activo' },
      ]);

      setAmenidades([
        { id: '1', nombre: 'WiFi Gratis', descripcion: 'Internet de alta velocidad', activa: true },
        { id: '2', nombre: 'Aire Acondicionado', descripcion: 'A/C en todas las habitaciones', activa: true },
        { id: '3', nombre: 'Desayuno Incluido', descripcion: 'Desayuno buffet completo', activa: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchHotel = (hotelId: string) => {
    localStorage.setItem('active_hotel_id', hotelId);
    setSelectedHotelId(hotelId);
    cargarConfiguracion();
  };

  const handleCrearHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHotelName.trim()) return;

    try {
      const res = await registrarHotel({
        nombre_hotel: newHotelName,
        ciudad: newHotelCity || undefined,
        direccion: newHotelAddress || undefined,
        telefono: newHotelPhone || undefined,
        estrellas: newHotelStars,
        enlace_google_maps: newHotelMaps || undefined
      });

      if (res && res.success) {
        alert('Hotel registrado correctamente');
        setNewHotelName('');
        setNewHotelCity('');
        setNewHotelAddress('');
        setNewHotelPhone('');
        setNewHotelStars(3);
        setNewHotelMaps('');
        setShowAddHotelForm(false);
        
        // Auto-seleccionar el nuevo hotel
        const nuevoId = res.data.id_hotel;
        localStorage.setItem('active_hotel_id', nuevoId);
        setSelectedHotelId(nuevoId);
        
        cargarConfiguracion();
      }
    } catch (err) {
      console.error(err);
      setError('Error al registrar el nuevo hotel');
    }
  };

  const handleActualizarInfoHotel = async () => {
    const activeHotelData = hoteles.find(h => h.id_hotel === selectedHotelId);
    if (!activeHotelData) return;

    try {
      const res = await actualizarHotel(selectedHotelId, {
        nombre_hotel: activeHotelData.nombre_hotel,
        ciudad: activeHotelData.ciudad,
        direccion: editHotelAddress,
        telefono: activeHotelData.telefono,
        correo_contacto: activeHotelData.correo_contacto,
        estrellas: activeHotelData.estrellas,
        enlace_google_maps: editHotelMaps
      });

      if (res && res.success) {
        alert('Información del hotel actualizada correctamente');
        setEditingHotelInfo(false);
        cargarConfiguracion();
      }
    } catch (err) {
      console.error(err);
      setError('Error al actualizar la información del hotel');
    }
  };

  const handleActualizarTipoCambio = async () => {
    try {
      if (config) {
        const updatedConfig = await actualizarConfigHotelera({
          moneda_principal: config.moneda_principal,
          moneda_alterna: config.moneda_alterna,
          tipo_cambio_base: newTipoCambio,
          tasa_isv: newTasaISV / 100,
          tasa_turistica: newTasaTuristica / 100,
          nombre_red_hoteles: newNombreRedHoteles,
        }, selectedHotelId);

        setConfig(updatedConfig);
        setEditingCurrency(false);
      }
    } catch (err) {
      console.error(err);
      setError('Error al actualizar configuración');
    }
  };

  const handleGuardarParametros = async () => {
    try {
      await actualizarParametrosReserva({
        hora_checkin: horaCheckin,
        hora_checkout: horaCheckout,
        dias_minimos_reserva: diasMinimos,
        dias_maximos_reserva: diasMaximos,
      }, selectedHotelId);
      setError(null);
      alert('Parámetros de reserva actualizados correctamente');
    } catch (err) {
      console.error(err);
      setError('Error al guardar parámetros de reserva');
    }
  };

  const handleUpdateSimultaneousConfig = async (hotelId: string) => {
    const draft = editingHotelConfigs[hotelId];
    if (!draft) return;
    
    try {
      // 1. Update financial parameters
      await actualizarConfigHotelera({
        moneda_principal: draft.moneda_principal || 'HNL',
        moneda_alterna: draft.moneda_alterna || 'USD',
        tipo_cambio_base: Number(draft.tipo_cambio_base || 24.85),
        tasa_isv: Number(draft.tasa_isv || 0.15),
        tasa_turistica: Number(draft.tasa_turistica || 0),
      }, hotelId);

      // 2. Update reservation hours and days
      await actualizarParametrosReserva({
        hora_checkin: draft.hora_checkin || '14:00',
        hora_checkout: draft.hora_checkout || '11:00',
        dias_minimos_reserva: Number(draft.dias_minimos || 1),
        dias_maximos_reserva: Number(draft.dias_maximos || 90),
      }, hotelId);

      setError(null);
      alert('Configuración guardada para este hotel exitosamente');
      cargarConfiguracion();
    } catch (err) {
      console.error(err);
      setError('Error al actualizar configuración simultánea');
    }
  };

  const handleEliminarTipo = async (id: string) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este tipo de habitación?')) {
      return;
    }
    try {
      await eliminarTipoHabitacion(id);
      setTiposHabitacion(tiposHabitacion.filter(tipo => tipo.id !== id));
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Error al eliminar tipo de habitación');
    }
  };

  const handleToggleAmenidad = async (id: string, activa: boolean) => {
    try {
      await actualizarAmenidad(id, !activa);
      setAmenidades(
        amenidades.map(a => a.id === id ? { ...a, activa: !activa } : a)
      );
    } catch (err) {
      console.error(err);
      setError('Error al actualizar amenidad');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2.5px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, color: '#64748b' }}>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showAudit ? (
        <>
          <button
            onClick={() => setShowAudit(false)}
            style={{ marginBottom: 20, padding: '8px 16px', backgroundColor: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            ← Volver a Configuración
          </button>
          <AuditPanel />
        </>
      ) : (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>
          ⚙️ Configuración del Sistema
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Gestiona los parámetros principales de tu hotel
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', color: '#dc2626', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Selector de Hotel Activo y Registro */}
      <div style={{ marginBottom: 32, padding: '20px', borderRadius: 12, border: '1px solid #e2e8f0', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Building2 size={24} style={{ color: '#2563eb' }} />
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 2 }}>
                🏨 Hotel Activo en Pantalla
              </label>
              <select
                value={selectedHotelId}
                onChange={e => handleSwitchHotel(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 600, color: '#1e293b', minWidth: 250, outline: 'none' }}
                disabled={localStorage.getItem('active_hotel_id') !== 'all'}
                className="disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="all">🌍 Todos los Hoteles (Consolidado)</option>
                {hoteles.map((h: any) => (
                  <option key={h.id_hotel} value={h.id_hotel}>
                    🏢 {h.nombre_hotel} ({h.ciudad || 'Sin ciudad'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => setShowAddHotelForm(!showAddHotelForm)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {showAddHotelForm ? '✕ Cancelar' : '➕ Registrar Nuevo Hotel'}
          </button>
        </div>

        {showAddHotelForm && (
          <form onSubmit={handleCrearHotel} style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #f1f5f9', display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>Agregar Nueva Propiedad</h4>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Registra un nuevo hotel físico en el sistema. Se le creará una configuración por defecto en el primer acceso.</p>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Nombre del Hotel *</label>
              <input
                type="text"
                required
                value={newHotelName}
                onChange={e => setNewHotelName(e.target.value)}
                placeholder="Ej. Hotel Verona Costa Azul"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Ciudad</label>
              <input
                type="text"
                value={newHotelCity}
                onChange={e => setNewHotelCity(e.target.value)}
                placeholder="Ej. Roatán"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Teléfono</label>
              <input
                type="text"
                value={newHotelPhone}
                onChange={e => setNewHotelPhone(e.target.value)}
                placeholder="Ej. +504 9876-5432"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Estrellas</label>
              <select
                value={newHotelStars}
                onChange={e => setNewHotelStars(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              >
                <option value={1}>1 Estrella</option>
                <option value={2}>2 Estrellas</option>
                <option value={3}>3 Estrellas</option>
                <option value={4}>4 Estrellas</option>
                <option value={5}>5 Estrellas</option>
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Dirección Completa</label>
              <input
                type="text"
                value={newHotelAddress}
                onChange={e => setNewHotelAddress(e.target.value)}
                placeholder="Ej. West Bay Beach, Frente a la playa principal"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Enlace Google Maps (URL)</label>
              <input
                type="url"
                value={newHotelMaps}
                onChange={e => setNewHotelMaps(e.target.value)}
                placeholder="Ej. https://maps.app.goo.gl/..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="submit"
                style={{
                  padding: '8px 24px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#16a34a',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                💾 Registrar Propiedad
              </button>
            </div>
          </form>
        )}
      </div>

      {selectedHotelId !== 'all' ? (
        <>
          {/* 0. INFORMACIÓN GENERAL DEL HOTEL */}
          <div style={{ marginBottom: 32, padding: '20px', borderRadius: 12, border: '1px solid #e0e7ff', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Building2 size={24} style={{ color: '#2563eb' }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                📍 Información General del Hotel
              </h2>
            </div>

            {!editingHotelInfo ? (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>Dirección Completa</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', margin: 0 }}>
                    {hoteles.find(h => h.id_hotel === selectedHotelId)?.direccion || 'No registrada'}
                  </p>
                </div>
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>Enlace Google Maps</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', margin: 0, wordBreak: 'break-all' }}>
                    {hoteles.find(h => h.id_hotel === selectedHotelId)?.enlace_google_maps ? (
                      <a href={hoteles.find(h => h.id_hotel === selectedHotelId)?.enlace_google_maps} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>
                        Ver en el mapa 🌍
                      </a>
                    ) : (
                      'No registrado'
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Dirección Completa
                  </label>
                  <input
                    type="text"
                    value={editHotelAddress}
                    onChange={e => setEditHotelAddress(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Enlace Google Maps (URL)
                  </label>
                  <input
                    type="url"
                    value={editHotelMaps}
                    onChange={e => setEditHotelMaps(e.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (editingHotelInfo) {
                  handleActualizarInfoHotel();
                } else {
                  const activeHotel = hoteles.find(h => h.id_hotel === selectedHotelId);
                  if (activeHotel) {
                    setEditHotelAddress(activeHotel.direccion || '');
                    setEditHotelMaps(activeHotel.enlace_google_maps || '');
                    setEditingHotelInfo(true);
                  }
                }
              }}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: editingHotelInfo ? '#16a34a' : '#2563eb',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {editingHotelInfo ? '💾 Guardar Información' : '✏️ Editar Información'}
            </button>
          </div>

          {/* 1. CONFIGURACIÓN FINANCIERA */}
          <div style={{ marginBottom: 32, padding: '20px', borderRadius: 12, border: '1px solid #e0e7ff', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <DollarSign size={24} style={{ color: '#2563eb' }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                💰 Configuración Financiera
              </h2>
            </div>

            {config && !editingCurrency ? (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>Moneda Principal</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#2563eb', margin: 0 }}>{config.moneda_principal}</p>
                </div>
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>Tipo de Cambio (1 USD =)</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#059669', margin: 0 }}>
                    {config.tipo_cambio_base.toFixed(2)} {config.moneda_principal}
                  </p>
                </div>
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>Tasa ISV</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#d97706', margin: 0 }}>
                    {(config.tasa_isv * 100).toFixed(1)}%
                  </p>
                </div>
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>Tasa Turística</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#0891b2', margin: 0 }}>
                    {(config.tasa_turistica * 100).toFixed(1)}%
                  </p>
                </div>
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>Red de Hoteles</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#6366f1', margin: 0 }}>
                    {config.nombre_red_hoteles || 'Hotel Verona'}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Nombre Red de Hoteles
                  </label>
                  <input
                    type="text"
                    value={newNombreRedHoteles}
                    onChange={e => setNewNombreRedHoteles(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Tipo de Cambio (1 USD =)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTipoCambio || config?.tipo_cambio_base}
                    onChange={e => setNewTipoCambio(parseFloat(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Tasa ISV (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newTasaISV}
                    onChange={e => setNewTasaISV(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Tasa Turística (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newTasaTuristica}
                    onChange={e => setNewTasaTuristica(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (editingCurrency) {
                  handleActualizarTipoCambio();
                } else {
                  setEditingCurrency(true);
                  if (config) {
                    setNewTipoCambio(config.tipo_cambio_base);
                    setNewTasaISV(config.tasa_isv * 100);
                    setNewTasaTuristica(config.tasa_turistica * 100);
                    setNewNombreRedHoteles(config.nombre_red_hoteles || 'Hotel Verona');
                  }
                }
              }}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: editingCurrency ? '#16a34a' : '#2563eb',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {editingCurrency ? '💾 Guardar' : '✏️ Editar'}
            </button>
          </div>

          {/* 2. GESTIÓN DE PROPIEDAD */}
          <div style={{ marginBottom: 32, padding: '20px', borderRadius: 12, border: '1px solid #dcfce7', backgroundColor: '#f0fdf4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Building2 size={24} style={{ color: '#16a34a' }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                🏨 Gestión de Propiedad
              </h2>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>Tipos de Habitación</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {tiposHabitacion.map(tipo => (
                  <div key={tipo.id} style={{ padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: 0 }}>{tipo.nombre}</p>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>{tipo.descripcion}</p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', margin: '4px 0 0' }}>
                        Precio Base: L. {tipo.precio_base.toFixed(2)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: 11, cursor: 'pointer' }}>
                        ✏️ Editar
                      </button>
                      <button 
                        onClick={() => handleEliminarTipo(tipo.id)}
                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #fee2e2', backgroundColor: '#fff', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: '#16a34a',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ➕ Agregar Tipo de Habitación
            </button>
          </div>

          {/* 3. SEGURIDAD Y AUDITORÍA */}
          <div style={{ marginBottom: 32, padding: '20px', borderRadius: 12, border: '1px solid #fce7f3', backgroundColor: '#fdf2f8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Shield size={24} style={{ color: '#ec4899' }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                🔒 Seguridad y Auditoría
              </h2>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
              <button 
                onClick={() => setShowAudit(true)}
                style={{ padding: 16, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>📋 Bitácora de Actividad</p>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Ver historial exhaustivo de acciones</p>
              </button>
              <button style={{ padding: 16, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>❤️ Salud del Sistema</p>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Monitor de integridad referencial</p>
              </button>
              <button style={{ padding: 16, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>👥 Usuarios y Roles</p>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Gestionar permisos de empleados</p>
              </button>
            </div>
          </div>

          {/* 4. PARÁMETROS DE RESERVA */}
          <div style={{ marginBottom: 32, padding: '20px', borderRadius: 12, border: '1px solid #fef08a', backgroundColor: '#fefce8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Calendar size={24} style={{ color: '#ca8a04' }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                📅 Parámetros de Reserva
              </h2>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Hora Check-in
                </label>
                <input
                  type="time"
                  value={horaCheckin}
                  onChange={e => setHoraCheckin(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Hora Check-out
                </label>
                <input
                  type="time"
                  value={horaCheckout}
                  onChange={e => setHoraCheckout(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Mín. Días Reserva
                </label>
                <input
                  type="number"
                  value={diasMinimos}
                  onChange={e => setDiasMinimos(parseInt(e.target.value))}
                  min="1"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Máx. Días Reserva
                </label>
                <input
                  type="number"
                  value={diasMaximos}
                  onChange={e => setDiasMaximos(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
            </div>

            <button
              onClick={handleGuardarParametros}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: '#ca8a04',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              💾 Guardar Parámetros
            </button>
          </div>

          {/* 5. AMENIDADES */}
          <div style={{ padding: '20px', borderRadius: 12, border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>🎁 Amenidades</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              {amenidades.map(amenidad => (
                <div key={amenidad.id} style={{ display: 'flex', alignItems: 'center', padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
                  <input
                    type="checkbox"
                    checked={amenidad.activa}
                    onChange={() => handleToggleAmenidad(amenidad.id, amenidad.activa)}
                    style={{ marginRight: 12, width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: 0 }}>{amenidad.nombre}</p>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>{amenidad.descripcion}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* PANEL DE ADMINISTRACIÓN SIMULTÁNEA MULTI-HOTEL */
        <div style={{ display: 'grid', gap: 24 }}>
          <div style={{ padding: '20px', borderRadius: 12, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Building2 size={28} style={{ color: '#2563eb' }} />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>📊 Panel de Administración Simultánea Multi-Hotel</h3>
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                Configura los parámetros financieros y operativos de todas tus propiedades de forma individualizada y simultánea sin cambiar de pantalla.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
            {hoteles.map((h: any) => {
              const draft = editingHotelConfigs[h.id_hotel] || {
                moneda_principal: 'HNL',
                moneda_alterna: 'USD',
                tipo_cambio_base: 24.85,
                tasa_isv: 0.15,
                tasa_turistica: 0,
                hora_checkin: '14:00',
                hora_checkout: '11:00',
                dias_minimos: 1,
                dias_maximos: 90,
              };

              const updateDraft = (field: string, val: any) => {
                setEditingHotelConfigs(prev => ({
                  ...prev,
                  [h.id_hotel]: {
                    ...prev[h.id_hotel],
                    [field]: val
                  }
                }));
              };

              return (
                <div 
                  key={h.id_hotel} 
                  style={{ 
                    padding: '24px', 
                    borderRadius: 16, 
                    border: '1px solid #e2e8f0', 
                    backgroundColor: '#fff', 
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.02)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#2563eb' }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>🏢 {h.nombre_hotel}</h4>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>📍 {h.ciudad || 'Honduras'} • {h.estrellas} ⭐</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', padding: '4px 8px', borderRadius: 12, backgroundColor: '#eff6ff' }}>
                      Ref: {h.id_hotel.substring(0, 8)}...
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                        💰 Finanzas
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>1 USD = (HNL)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.tipo_cambio_base}
                            onChange={e => updateDraft('tipo_cambio_base', parseFloat(e.target.value))}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Tasa ISV (%)</label>
                          <input
                            type="number"
                            step="1"
                            value={Math.round((draft.tasa_isv || 0) * 100)}
                            onChange={e => updateDraft('tasa_isv', parseFloat(e.target.value) / 100)}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Tasa Turística (%)</label>
                          <input
                            type="number"
                            step="1"
                            value={Math.round((draft.tasa_turistica || 0) * 100)}
                            onChange={e => updateDraft('tasa_turistica', parseFloat(e.target.value) / 100)}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                        📅 Operaciones de Reserva
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Check-in</label>
                          <input
                            type="time"
                            value={draft.hora_checkin ? draft.hora_checkin.substring(0, 5) : '14:00'}
                            onChange={e => updateDraft('hora_checkin', e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Check-out</label>
                          <input
                            type="time"
                            value={draft.hora_checkout ? draft.hora_checkout.substring(0, 5) : '11:00'}
                            onChange={e => updateDraft('hora_checkout', e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Mín Estadía (Días)</label>
                          <input
                            type="number"
                            min="1"
                            value={draft.dias_minimos}
                            onChange={e => updateDraft('dias_minimos', parseInt(e.target.value))}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Máx Estadía (Días)</label>
                          <input
                            type="number"
                            value={draft.dias_maximos}
                            onChange={e => updateDraft('dias_maximos', parseInt(e.target.value))}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUpdateSimultaneousConfig(h.id_hotel)}
                    style={{
                      width: '100%',
                      marginTop: 18,
                      padding: '10px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 2px 4px rgba(37,99,235,0.1)',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    💾 Guardar Cambios
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
      )}
    </>
  );
};
