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

export const fetchGimnasios = async () => {
  const ctx = await getGymContext();
  if (!ctx) return [];
  const { data } = await supabase.from('gimnasios').select('*').eq('id_gimnasio', ctx.gimnasioId);
  return data ?? [];
};
