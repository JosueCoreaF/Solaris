import { supabase } from './supabase';
import { getGymContext } from './gymContext';

export interface DashboardKPIs {
  totalMiembros: number;
  miembrosActivos: number;
  inscripcionesActivas: number;
  vencenEsteMes: number;
  ingresosMes: number;
  clasesHoy: number;
  nuevosEstaSemana: number;
}

export const fetchDashboardKPIs = async (): Promise<DashboardKPIs> => {
  const empty = { totalMiembros: 0, miembrosActivos: 0, inscripcionesActivas: 0, vencenEsteMes: 0, ingresosMes: 0, clasesHoy: 0, nuevosEstaSemana: 0 };
  const ctx = await getGymContext();
  if (!ctx) return empty;

  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const inicioSemana = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaHoy = diasSemana[now.getDay()];
  const gid = ctx.gimnasioId;

  const [
    { count: totalMiembros },
    { count: miembrosActivos },
    { count: inscripcionesActivas },
    { count: vencenEsteMes },
    { data: pagosMes },
    { count: clasesHoy },
    { count: nuevosEstaSemana },
  ] = await Promise.all([
    supabase.from('miembros').select('*', { count: 'exact', head: true }).eq('id_gimnasio', gid),
    supabase.from('miembros').select('*', { count: 'exact', head: true }).eq('id_gimnasio', gid).eq('estado', 'activo'),
    supabase.from('inscripciones_gym').select('*', { count: 'exact', head: true }).eq('id_gimnasio', gid).eq('estado', 'activa'),
    supabase.from('inscripciones_gym').select('*', { count: 'exact', head: true }).eq('id_gimnasio', gid).eq('estado', 'activa').gte('fecha_fin', inicioMes).lte('fecha_fin', finMes),
    supabase.from('pagos_gym').select('monto, inscripciones_gym!inner(id_gimnasio)').eq('inscripciones_gym.id_gimnasio', gid).neq('estado', 'anulado').gte('fecha_pago', inicioMes),
    supabase.from('clases_gym').select('*', { count: 'exact', head: true }).eq('id_gimnasio', gid).eq('dia_semana', diaHoy).eq('activa', true),
    supabase.from('miembros').select('*', { count: 'exact', head: true }).eq('id_gimnasio', gid).gte('created_at', inicioSemana),
  ]);

  const ingresosMes = (pagosMes ?? []).reduce((sum: number, p: any) => sum + Number(p.monto), 0);

  return {
    totalMiembros: totalMiembros ?? 0,
    miembrosActivos: miembrosActivos ?? 0,
    inscripcionesActivas: inscripcionesActivas ?? 0,
    vencenEsteMes: vencenEsteMes ?? 0,
    ingresosMes,
    clasesHoy: clasesHoy ?? 0,
    nuevosEstaSemana: nuevosEstaSemana ?? 0,
  };
};

export interface TrendPoint {
  label: string;
  value: number;
}

export interface DashboardTrends {
  memberGrowth: TrendPoint[];
  weeklyRevenue: TrendPoint[];
}

export const fetchDashboardTrends = async (): Promise<DashboardTrends> => {
  const empty = { memberGrowth: [], weeklyRevenue: [] };
  const ctx = await getGymContext();
  if (!ctx) return empty;
  const gid = ctx.gimnasioId;
  const now = new Date();

  const inicio6Meses = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const inicio7Dias = new Date(now);
  inicio7Dias.setDate(inicio7Dias.getDate() - 6);
  inicio7Dias.setHours(0, 0, 0, 0);

  const [{ data: miembros }, { data: pagos }] = await Promise.all([
    supabase.from('miembros').select('created_at').eq('id_gimnasio', gid).gte('created_at', inicio6Meses.toISOString()),
    supabase.from('pagos_gym').select('monto, fecha_pago, inscripciones_gym!inner(id_gimnasio)').eq('inscripciones_gym.id_gimnasio', gid).neq('estado', 'anulado').gte('fecha_pago', inicio7Dias.toISOString().split('T')[0]),
  ]);

  const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const memberGrowth: TrendPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = (miembros ?? []).filter((m: any) => {
      const md = new Date(m.created_at);
      return md.getFullYear() === d.getFullYear() && md.getMonth() === d.getMonth();
    }).length;
    memberGrowth.push({ label: monthLabels[d.getMonth()], value: count });
  }

  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const weeklyRevenue: TrendPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const total = (pagos ?? []).filter((p: any) => p.fecha_pago === key).reduce((s: number, p: any) => s + Number(p.monto), 0);
    weeklyRevenue.push({ label: dayLabels[d.getDay()], value: total });
  }

  return { memberGrowth, weeklyRevenue };
};

export interface ActivityItem {
  id: string;
  type: 'miembro' | 'pago' | 'inscripcion';
  message: string;
  date: string;
}

export const fetchRecentActivity = async (): Promise<ActivityItem[]> => {
  const ctx = await getGymContext();
  if (!ctx) return [];
  const gid = ctx.gimnasioId;

  const [{ data: miembros }, { data: pagos }, { data: inscripciones }] = await Promise.all([
    supabase.from('miembros').select('id_miembro, nombre_completo, created_at').eq('id_gimnasio', gid).order('created_at', { ascending: false }).limit(5),
    supabase.from('pagos_gym').select('id_pago_gym, monto, estado, created_at, inscripciones_gym!inner(id_gimnasio, miembros(nombre_completo))').eq('inscripciones_gym.id_gimnasio', gid).order('created_at', { ascending: false }).limit(5),
    supabase.from('inscripciones_gym').select('id_inscripcion, created_at, miembros(nombre_completo), planes_membresia(nombre)').eq('id_gimnasio', gid).order('created_at', { ascending: false }).limit(5),
  ]);

  const items: ActivityItem[] = [];
  (miembros ?? []).forEach((m: any) => items.push({
    id: `m-${m.id_miembro}`,
    type: 'miembro',
    message: `${m.nombre_completo} se registró como nuevo miembro`,
    date: m.created_at,
  }));
  (pagos ?? []).forEach((p: any) => items.push({
    id: `p-${p.id_pago_gym}`,
    type: 'pago',
    message: `Pago de L. ${Number(p.monto).toFixed(2)} ${p.estado === 'anulado' ? 'anulado' : 'aplicado'} — ${p.inscripciones_gym?.miembros?.nombre_completo ?? 'Miembro'}`,
    date: p.created_at,
  }));
  (inscripciones ?? []).forEach((i: any) => items.push({
    id: `i-${i.id_inscripcion}`,
    type: 'inscripcion',
    message: `${i.miembros?.nombre_completo ?? 'Un miembro'} se inscribió en ${i.planes_membresia?.nombre ?? 'un plan'}`,
    date: i.created_at,
  }));

  return items
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
};

export const fetchGimnasios = async () => {
  const { data } = await supabase.from('gimnasios').select('*');
  return data ?? [];
};
