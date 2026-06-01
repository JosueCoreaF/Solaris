import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useSync } from '../../context/SyncContext';
import { useToast } from '../../components/Toast';

export const Config: React.FC = () => {
  const { gimnasio, refresh } = useSync();
  const { addToast } = useToast();
  const [form, setForm] = useState({ nombre_gimnasio: '', ciudad: '', direccion: '', telefono: '', correo_contacto: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (gimnasio) {
      setForm({
        nombre_gimnasio: gimnasio.nombre_gimnasio ?? '',
        ciudad: gimnasio.ciudad ?? '',
        direccion: gimnasio.direccion ?? '',
        telefono: gimnasio.telefono ?? '',
        correo_contacto: gimnasio.correo_contacto ?? '',
      });
    }
  }, [gimnasio]);

  const guardar = async () => {
    if (!gimnasio) return;
    setGuardando(true);
    try {
      const { error } = await supabase
        .from('gimnasios')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id_gimnasio', gimnasio.id_gimnasio);
      if (error) throw error;
      addToast('Configuración guardada', 'success');
      refresh();
    } catch (e: any) { addToast(e.message || 'Error al guardar', 'error'); } finally { setGuardando(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Información del gimnasio</p>
        </div>
        <button className="btn-primary" onClick={guardar} disabled={guardando}>
          <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {!gimnasio ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          No hay un gimnasio configurado. Crea uno desde Supabase para comenzar.
        </div>
      ) : (
        <div style={{ maxWidth: 640, background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 16, padding: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-h)', marginBottom: 20 }}>Datos del Gimnasio</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Nombre del Gimnasio</label>
              <input className="form-input" value={form.nombre_gimnasio} onChange={e => setForm(p => ({ ...p, nombre_gimnasio: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Ciudad</label>
              <input className="form-input" value={form.ciudad} onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input className="form-input" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Dirección</label>
              <input className="form-input" value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Correo de Contacto</label>
              <input className="form-input" type="email" value={form.correo_contacto} onChange={e => setForm(p => ({ ...p, correo_contacto: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--shell-border-subtle)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>Información del Módulo</h4>
            <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
              <div><span style={{ color: 'var(--muted)' }}>ID Módulo:</span> <code style={{ fontSize: 11, background: 'var(--shell-bg)', padding: '2px 6px', borderRadius: 4 }}>{gimnasio.id_module ?? '—'}</code></div>
              <div><span style={{ color: 'var(--muted)' }}>Estado:</span> <span className="badge badge-green" style={{ marginLeft: 6 }}>{gimnasio.estado}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
