import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { Cotizacion } from '../../types';
import { useToast } from '../../components/Toast';

export const QuotesPanel: React.FC = () => {
  const [quotes, setQuotes] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const activeHotelId = localStorage.getItem('active_hotel_id') || '';

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<Cotizacion[]>('/hotel/quotes', {
        headers: { 'x-hotel-id': activeHotelId }
      });
      setQuotes(res || []);
    } catch (err: any) {
      console.error('Error fetching quotes:', err);
      addToast('Error al cargar las cotizaciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeHotelId) {
      fetchQuotes();
    }
  }, [activeHotelId]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta cotización?')) return;

    try {
      await apiClient.delete(`/hotel/quotes/${id}`, {
        headers: { 'x-hotel-id': activeHotelId }
      });
      addToast('Cotización eliminada correctamente', 'success');
      setQuotes(prev => prev.filter(q => q.id_cotizacion !== id));
    } catch (err: any) {
      console.error('Error deleting quote:', err);
      addToast('Error al eliminar la cotización', 'error');
    }
  };

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = 
      q.numero_cotizacion.toLowerCase().includes(search.toLowerCase()) ||
      q.cliente_nombre.toLowerCase().includes(search.toLowerCase()) ||
      q.cliente_correo.toLowerCase().includes(search.toLowerCase());
    
    const matchesEstado = filterEstado === 'Todos' || q.estado === filterEstado;

    return matchesSearch && matchesEstado;
  });

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

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: currency || 'HNL'
    }).format(amount);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestión de Cotizaciones</h1>
          <p className="text-slate-500 text-sm mt-1">Crea y administra estimaciones formales de hospedaje para tus clientes.</p>
        </div>
        <button
          onClick={() => navigate('/cotizaciones/nueva')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all duration-200 hover:scale-[1.02]"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva Cotización
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Buscar por número, cliente o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {['Todos', 'Borrador', 'Enviada', 'Aceptada', 'Rechazada', 'Expirada'].map((est) => (
            <button
              key={est}
              onClick={() => setFilterEstado(est)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all whitespace-nowrap ${
                filterEstado === est
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {est}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Cargando cotizaciones...</p>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 border border-slate-100">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <p className="text-slate-800 font-semibold text-base">No se encontraron cotizaciones</p>
              <p className="text-slate-400 text-sm max-w-xs mx-auto mt-1">
                {search || filterEstado !== 'Todos' 
                  ? 'Prueba modificando tus criterios de búsqueda o filtros.'
                  : 'Comienza creando tu primera cotización formal haciendo clic arriba.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">Número</th>
                  <th className="py-4 px-6">Cliente</th>
                  <th className="py-4 px-6">Emisión / Vence</th>
                  <th className="py-4 px-6">Estancia (Noches)</th>
                  <th className="py-4 px-6">Total</th>
                  <th className="py-4 px-6">Estado</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                {filteredQuotes.map((q) => (
                  <tr key={q.id_cotizacion} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-4 px-6 font-semibold text-indigo-600">{q.numero_cotizacion}</td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-900">{q.cliente_nombre}</div>
                      <div className="text-slate-400 text-xs mt-0.5">{q.cliente_correo}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div>{q.fecha_emision}</div>
                      <div className="text-slate-400 text-xs mt-0.5">Vence: {q.fecha_vencimiento}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div>{q.check_in} al {q.check_out}</div>
                      <div className="text-slate-400 text-xs mt-0.5">
                        {q.cant_noches} {q.cant_noches === 1 ? 'noche' : 'noches'} • {q.adultos} ad. / {q.ninos} niñ.
                      </div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-900">
                      {formatCurrency(q.total, q.moneda)}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeClass(q.estado)}`}>
                        {q.estado}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/cotizaciones/${q.id_cotizacion}`)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all"
                        title="Ver detalle"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      {(q.estado === 'Borrador' || q.estado === 'Enviada') && (
                        <button
                          onClick={() => navigate(`/cotizaciones/editar/${q.id_cotizacion}`)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all"
                          title="Editar"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(q.id_cotizacion)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-rose-600 transition-all"
                        title="Eliminar"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
