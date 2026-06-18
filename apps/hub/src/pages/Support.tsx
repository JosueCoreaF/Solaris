import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import axios from 'axios';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, Loader2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export default function Support() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ asunto: '', descripcion: '', prioridad: 'media' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await axios.get(`${API_BASE_URL}/hub/support/tickets`, {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` }
      });
      setTickets(res.data);
    } catch (err) {
      console.error('Error fetching tickets', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      await axios.post(`${API_BASE_URL}/hub/support/tickets`, formData, {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` }
      });
      setShowModal(false);
      setFormData({ asunto: '', descripcion: '', prioridad: 'media' });
      fetchTickets();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-indigo-500" />
            Soporte al Cliente
          </h1>
          <p className="text-slate-500 mt-2">Gestiona tus consultas y reporta incidentes técnicos.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Ticket
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No tienes tickets abiertos</h3>
          <p className="text-slate-500">¿Tienes alguna duda o problema? Crea un ticket y te ayudaremos.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tickets.map(ticket => (
            <motion.div key={ticket.id_ticket} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{ticket.asunto}</h3>
                <p className="text-slate-500 text-sm mt-1 mb-3 line-clamp-2">{ticket.descripcion}</p>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    ticket.estado === 'abierto' ? 'bg-amber-100 text-amber-700' :
                    ticket.estado === 'resuelto' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {ticket.estado.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900">Crear Nuevo Ticket</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Asunto</label>
                  <input required value={formData.asunto} onChange={e => setFormData({ ...formData, asunto: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="Ej. Problema con la facturación" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Prioridad</label>
                  <select value={formData.prioridad} onChange={e => setFormData({ ...formData, prioridad: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción</label>
                  <textarea required rows={4} value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="Describe tu problema con detalle..." />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-50 rounded-xl">Cancelar</button>
                <button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center justify-center min-w-[120px] shadow-sm disabled:opacity-70">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Ticket'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </div>
  );
}
