import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CalendarCheck, CreditCard, ChevronRight, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { DashboardLayout, useDashboard } from '../components/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

const NotificationsContent = () => {
  const { notifications: ctxNotifs } = useDashboard();
  const [notifications, setNotifications] = useState<any[]>(ctxNotifs || []);
  const [loading, setLoading] = useState(ctxNotifs.length === 0);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data: any[] = await apiClient.get('/hub/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ctxNotifs.length > 0) {
      setNotifications(ctxNotifs);
      setLoading(false);
    } else {
      fetchNotifications();
    }
  }, [ctxNotifs]);

  const highAlerts = notifications.filter(n => n.severity === 'high');
  const medAlerts = notifications.filter(n => n.severity === 'medium');

  const typeIcon = (type: string) => {
    if (type === 'checkin') return <CalendarCheck className="w-5 h-5" />;
    if (type === 'payment') return <CreditCard className="w-5 h-5" />;
    return <AlertCircle className="w-5 h-5" />;
  };

  const typeBg = (type: string) => {
    if (type === 'checkin') return 'bg-emerald-100 text-emerald-600';
    if (type === 'payment') return 'bg-rose-100 text-rose-600';
    return 'bg-slate-100 text-slate-600';
  };

  const severityBadge = (sev: string) => {
    if (sev === 'high') return 'bg-rose-100 text-rose-700';
    if (sev === 'medium') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-500';
  };

  return (
    <>
      <div className="max-w-3xl mx-auto py-10 px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Centro de Notificaciones</h1>
              <p className="text-slate-500 text-sm mt-0.5">Alertas en tiempo real de todos tus negocios</p>
            </div>
          </div>
          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium text-sm shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total', value: notifications.length, color: 'text-slate-900', bg: 'bg-white' },
            { label: 'Urgentes', value: highAlerts.length, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
            { label: 'Pendientes', value: medAlerts.length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-2xl border border-slate-100 p-4 text-center shadow-sm`}>
              <p className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</p>
              <p className="text-slate-500 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          </div>
        ) : notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 shadow-sm"
          >
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">¡Todo en orden!</h3>
            <p className="text-slate-500 text-sm">No tienes alertas pendientes en este momento.</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {notifications.map((notif, i) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeBg(notif.type)}`}>
                    {typeIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-slate-900 text-sm">{notif.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${severityBadge(notif.severity)}`}>
                        {notif.severity === 'high' ? 'Urgente' : notif.severity === 'medium' ? 'Próximo' : 'Info'}
                      </span>
                    </div>
                    <p className="text-slate-500 text-sm truncate">{notif.description}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(notif.created_at).toLocaleString('es-HN')}</p>
                  </div>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </>
  );
};

export default function Notifications() {
  return (
    <DashboardLayout>
      <NotificationsContent />
    </DashboardLayout>
  );
}
