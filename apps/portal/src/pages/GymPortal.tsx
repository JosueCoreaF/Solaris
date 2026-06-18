import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dumbbell, MapPin, Phone, Mail, Clock, CheckCircle2,
  Loader2, ArrowLeft, X, ChevronRight, Users, Star,
  Calendar, Zap,
} from 'lucide-react';
import { fetchGym, crearSolicitudGym } from '../services/api';

interface Plan {
  id: string; nombre: string; descripcion: string | null;
  duracionDias: number; precio: number; acceso_clases: boolean; acceso_gym: boolean;
}
interface Clase {
  id: string; nombre: string; descripcion: string | null;
  dia: string; horaInicio: string; horaFin: string;
  capacidad: number; entrenador: string | null; especialidad: string | null;
}
interface Gym {
  id: string; nombre: string; ciudad: string; direccion: string;
  telefono: string | null; correo: string | null; moneda: string;
  horaApertura: string; horaCierre: string;
  planes: Plan[]; clases: Clase[];
}

const Sk = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-stone-200 rounded-xl ${className}`} />
);

const DIAS_ES: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue',
  viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
};
const DIAS_FULL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};
const DIAS_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

function agruparClasesPorDia(clases: Clase[]) {
  const map: Record<string, Clase[]> = {};
  clases.forEach(c => {
    if (!map[c.dia]) map[c.dia] = [];
    map[c.dia].push(c);
  });
  return map;
}

export default function GymPortal() {
  const { gymId } = useParams<{ gymId: string }>();

  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<'planes' | 'clases'>('planes');
  const [diaActivo, setDiaActivo] = useState<string | null>(null);
  const [planSeleccionado, setPlanSeleccionado] = useState<Plan | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [documento, setDocumento] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!gymId) return;
    fetchGym(gymId)
      .then((data: Gym) => {
        setGym(data);
        const diasDisponibles = DIAS_ORDER.filter(d => data.clases.some(c => c.dia === d));
        if (diasDisponibles.length > 0) setDiaActivo(diasDisponibles[0]);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [gymId]);

  function abrirForm(plan: Plan) {
    setPlanSeleccionado(plan);
    setShowForm(true);
    setSuccess(null);
    setFormError(null);
    setNombre(''); setCorreo(''); setTelefono(''); setDocumento('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gym) return;
    setFormError(null);
    if (!nombre || !correo || !telefono) {
      setFormError('Completa los campos requeridos.');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await crearSolicitudGym({
        id_gimnasio: gym.id,
        nombre_completo: nombre,
        correo, telefono,
        documento_identidad: documento || undefined,
        id_plan: planSeleccionado?.id,
      });
      setSuccess(resp.mensaje);
      setShowForm(false);
      setNombre(''); setCorreo(''); setTelefono(''); setDocumento('');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6fdf8]">
        <div className="h-56 bg-gradient-to-br from-emerald-100 to-teal-100 animate-pulse" />
        <div className="max-w-2xl mx-auto px-4 -mt-10 space-y-4">
          <Sk className="h-36 w-full rounded-3xl" />
          <Sk className="h-12 w-full rounded-2xl" />
          <Sk className="h-48 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !gym) {
    return (
      <div className="min-h-screen bg-[#f6fdf8] flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-3xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="text-red-400" size={28} />
          </div>
          <h2 className="text-lg font-bold text-stone-800 mb-2">Gimnasio no encontrado</h2>
          <p className="text-sm text-stone-500 mb-6">{error ?? 'El enlace puede ser incorrecto.'}</p>
          <Link to="/" className="text-sm text-emerald-600 font-semibold hover:underline">← Volver al inicio</Link>
        </div>
      </div>
    );
  }

  const gruposDia = agruparClasesPorDia(gym.clases);
  const diasConClases = DIAS_ORDER.filter(d => gruposDia[d]);

  return (
    <div className="min-h-screen bg-[#f6fdf8] font-sans">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-emerald-100/60 px-4 py-3 flex items-center gap-3">
        <Link to="/landing/gym" className="text-stone-400 hover:text-emerald-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-stone-800 truncate">{gym.nombre}</h1>
          {gym.ciudad && <p className="text-xs text-stone-400">{gym.ciudad}</p>}
        </div>
        <button
          onClick={() => { setPlanSeleccionado(gym.planes[0] ?? null); setShowForm(true); setSuccess(null); setFormError(null); setNombre(''); setCorreo(''); setTelefono(''); setDocumento(''); }}
          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm shadow-emerald-200"
        >
          <Dumbbell size={13} />
          Inscribirme
        </button>
      </nav>

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="relative h-52 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 10px)', backgroundSize: '14px 14px' }} />
        <div className="absolute -bottom-12 -right-12 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -top-12 -left-12 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <Dumbbell size={44} className="text-white" />
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pb-24">

        {/* ── Info card ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-stone-100 shadow-md -mt-6 relative z-10 p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-black text-stone-900 leading-tight">{gym.nombre}</h2>
              {gym.ciudad && (
                <p className="text-sm text-emerald-600 font-medium mt-1 flex items-center gap-1">
                  <MapPin size={12} /> {gym.ciudad}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg shrink-0">
              <Zap size={11} className="text-emerald-500 fill-emerald-500" />
              <span className="text-xs font-bold text-emerald-700">Inscripción online</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {gym.direccion && (
              <div className="flex items-start gap-2 text-sm text-stone-500">
                <MapPin size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                <span>{gym.direccion}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <Clock size={14} className="shrink-0 text-emerald-400" />
              <span>Horario: {gym.horaApertura} – {gym.horaCierre}</span>
            </div>
            {gym.telefono && (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Phone size={14} className="shrink-0 text-emerald-400" />
                <a href={`tel:${gym.telefono}`} className="hover:text-emerald-600 transition-colors">{gym.telefono}</a>
              </div>
            )}
            {gym.correo && (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Mail size={14} className="shrink-0 text-emerald-400" />
                <a href={`mailto:${gym.correo}`} className="hover:text-emerald-600 transition-colors">{gym.correo}</a>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Éxito ──────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3"
            >
              <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-emerald-800">¡Solicitud enviada!</p>
                <p className="text-xs text-emerald-600 mt-0.5">{success}</p>
              </div>
              <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-600"><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-4 flex gap-1 bg-stone-100 p-1 rounded-2xl"
        >
          {(['planes', 'clases'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                tab === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}>
              {t === 'planes' ? `Planes (${gym.planes.length})` : `Clases (${gym.clases.length})`}
            </button>
          ))}
        </motion.div>

        {/* ── Planes de membresía ─────────────────────────────────────────── */}
        {tab === 'planes' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-3">
            {gym.planes.length === 0 ? (
              <div className="bg-white rounded-3xl border border-stone-100 p-8 text-center">
                <Dumbbell size={28} className="text-stone-300 mx-auto mb-2" />
                <p className="text-stone-400 text-sm">No hay planes activos disponibles.</p>
                <p className="text-xs text-stone-400 mt-1">Contáctanos directamente para más información.</p>
              </div>
            ) : gym.planes.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`bg-white rounded-3xl shadow-sm overflow-hidden border ${
                  i === 0 && gym.planes.length > 1 ? 'border-emerald-200' : 'border-stone-100'
                }`}
              >
                {i === 0 && gym.planes.length > 1 && (
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1.5 flex items-center gap-1.5">
                    <Star size={11} className="text-white fill-white" />
                    <span className="text-white text-xs font-bold">Más popular</span>
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-black text-stone-900 text-base">{plan.nombre}</h4>
                      {plan.descripcion && <p className="text-sm text-stone-500 mt-1 leading-relaxed">{plan.descripcion}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-medium">
                          {plan.duracionDias} días
                        </span>
                        {plan.acceso_gym && (
                          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                            <Dumbbell size={10} /> Acceso al gym
                          </span>
                        )}
                        {plan.acceso_clases && (
                          <span className="text-xs bg-teal-50 text-teal-700 border border-teal-100 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                            <Users size={10} /> Clases incluidas
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-black text-emerald-600">
                        {gym.moneda} {plan.precio.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-stone-400 mt-0.5">/ {plan.duracionDias} días</div>
                    </div>
                  </div>
                  <button
                    onClick={() => abrirForm(plan)}
                    className={`mt-4 w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      i === 0 && gym.planes.length > 1
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-sm shadow-emerald-200'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    Inscribirme con este plan
                    <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Horario de clases ───────────────────────────────────────────── */}
        {tab === 'clases' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-3">
            {gym.clases.length === 0 ? (
              <div className="bg-white rounded-3xl border border-stone-100 p-8 text-center">
                <Calendar size={28} className="text-stone-300 mx-auto mb-2" />
                <p className="text-stone-400 text-sm">No hay clases programadas en este momento.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {diasConClases.map(dia => (
                    <button key={dia} onClick={() => setDiaActivo(dia)}
                      className={`shrink-0 flex flex-col items-center px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        diaActivo === dia
                          ? 'bg-gradient-to-b from-emerald-500 to-teal-500 text-white shadow-sm'
                          : 'bg-white border border-stone-100 text-stone-500 hover:border-emerald-200 hover:text-emerald-600'
                      }`}>
                      <span className="text-sm font-black">{DIAS_ES[dia]}</span>
                      <span className="opacity-70 mt-0.5">{(gruposDia[dia] ?? []).length} cls</span>
                    </button>
                  ))}
                </div>

                {diaActivo && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider px-1">{DIAS_FULL[diaActivo]}</p>
                    {(gruposDia[diaActivo] ?? []).map((clase, i) => (
                      <motion.div
                        key={clase.id}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="bg-white rounded-2xl border border-stone-100 p-4 flex items-start gap-3 shadow-sm"
                      >
                        <div className="shrink-0 text-center bg-emerald-50 rounded-xl px-2.5 py-2 min-w-[52px]">
                          <div className="text-sm font-black text-emerald-600 leading-none">{clase.horaInicio}</div>
                          <div className="text-[10px] text-stone-400 mt-1 leading-none">– {clase.horaFin}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-stone-800">{clase.nombre}</p>
                          {clase.descripcion && <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{clase.descripcion}</p>}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                            {clase.entrenador && (
                              <span className="text-xs text-stone-500 flex items-center gap-1">
                                <Users size={10} /> {clase.entrenador}{clase.especialidad ? ` · ${clase.especialidad}` : ''}
                              </span>
                            )}
                            <span className="text-xs text-stone-400 flex items-center gap-1">
                              <Users size={10} /> Cap. {clase.capacidad}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </main>

      {/* ── FAB flotante ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          onClick={() => { setPlanSeleccionado(gym.planes[0] ?? null); setShowForm(true); setSuccess(null); setFormError(null); setNombre(''); setCorreo(''); setTelefono(''); setDocumento(''); }}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm px-6 py-3.5 rounded-full shadow-lg shadow-emerald-300/50"
        >
          <Dumbbell size={16} />
          Inscribirme
          <ChevronRight size={14} />
        </motion.button>
      </div>

      {/* ── Modal de inscripción ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center"
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 38 }}
              className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-md max-h-[92vh] overflow-y-auto shadow-2xl"
            >
              <div className="sticky top-0 bg-white rounded-t-3xl z-10 px-5 pt-5 pb-4 border-b border-stone-100">
                <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4 md:hidden" />
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-stone-900">Solicitar membresía</h2>
                    {planSeleccionado && (
                      <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                        {planSeleccionado.nombre} · {gym.moneda} {planSeleccionado.precio.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors">
                    <X size={15} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">

                {gym.planes.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">Plan</label>
                    <div className="space-y-1.5">
                      {gym.planes.map(p => (
                        <button key={p.id} type="button" onClick={() => setPlanSeleccionado(p)}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                            planSeleccionado?.id === p.id
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                              : 'border-stone-200 text-stone-600 hover:border-stone-300'
                          }`}>
                          <span className="font-semibold">{p.nombre}</span>
                          <span className="text-xs font-bold">{gym.moneda} {p.precio.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <hr className="border-stone-100" />

                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">Tus datos</p>
                  <input placeholder="Nombre completo *" value={nombre} onChange={e => setNombre(e.target.value)} required
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder:text-stone-300" />
                  <input type="email" placeholder="Correo electrónico *" value={correo} onChange={e => setCorreo(e.target.value)} required
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder:text-stone-300" />
                  <input type="tel" placeholder="Teléfono *" value={telefono} onChange={e => setTelefono(e.target.value)} required
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder:text-stone-300" />
                  <input placeholder="Documento de identidad (opcional)" value={documento} onChange={e => setDocumento(e.target.value)}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder:text-stone-300" />
                </div>

                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 font-medium">{formError}</div>
                )}

                <button type="submit" disabled={submitting}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 transition-all text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-sm">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {submitting ? 'Enviando…' : 'Enviar solicitud'}
                </button>

                <p className="text-center text-xs text-stone-400">
                  El equipo del gym revisará tu solicitud y te contactará para completar la inscripción.
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
