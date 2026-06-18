import React, { useState } from 'react';
import { User, Mail, Shield, KeyRound, Eye, EyeOff, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRestaurant } from '../context/RestaurantContext';
import { supabase } from '../api/supabase';

export const Perfil: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const { restaurant, plan } = useRestaurant();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwMsg({ type: 'err', text: 'Las contraseñas no coinciden.' }); return; }
    if (newPw.length < 6) { setPwMsg({ type: 'err', text: 'La contraseña debe tener al menos 6 caracteres.' }); return; }
    setPwLoading(true);
    setPwMsg(null);
    try {
      // Re-autenticar con contraseña actual
      const email = user?.email ?? '';
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPw });
      if (signInErr) { setPwMsg({ type: 'err', text: 'Contraseña actual incorrecta.' }); return; }
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) { setPwMsg({ type: 'err', text: error.message }); return; }
      setPwMsg({ type: 'ok', text: 'Contraseña actualizada correctamente.' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      setPwMsg({ type: 'err', text: err.message || 'Error al cambiar contraseña.' });
    } finally {
      setPwLoading(false);
    }
  };

  const ROLE_LABELS: Record<string, string> = {
    PROPIETARIO: 'Propietario',
    ADMIN:       'Administrador',
    GERENTE:     'Gerente',
    CAJERO:      'Cajero',
    MESERO:      'Mesero',
    COCINA:      'Cocina',
    INVITADO:    'Invitado',
  };

  const hubUrl = (() => {
    const env = import.meta.env.VITE_HUB_URL;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) return env || 'http://localhost:5174';
    return 'https://panel.solarys.uk';
  })();

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--display)', fontSize: 24, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
          Mi Perfil
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Información de tu cuenta y configuración de seguridad
        </p>
      </div>

      {/* Tarjeta de usuario */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: 'var(--accent-bg)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800,
          }}>
            {(user?.email?.[0] ?? 'U').toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-h)' }}>
              {user?.email?.split('@')[0] ?? 'Usuario'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user?.email}</div>
            {role && role !== 'INVITADO' && (
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>
                {ROLE_LABELS[role] ?? role}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <InfoRow icon={<Mail size={14} />} label="Correo" value={user?.email ?? '—'} />
          <InfoRow icon={<Shield size={14} />} label="Rol" value={ROLE_LABELS[role] ?? role} />
          <InfoRow icon={<User size={14} />} label="Restaurante" value={restaurant?.nombre_restaurante ?? '—'} />
          {plan?.nombre && (
            <InfoRow icon={<Shield size={14} />} label="Plan" value={plan.nombre} />
          )}
        </div>
      </div>

      {/* Cambiar contraseña */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <KeyRound size={16} color="var(--accent)" />
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Cambiar Contraseña
          </h2>
        </div>

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <PwField label="Contraseña actual" value={currentPw} onChange={setCurrentPw} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
          <PwField label="Nueva contraseña" value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(v => !v)} />
          <PwField label="Confirmar nueva contraseña" value={confirmPw} onChange={setConfirmPw} show={showNew} onToggle={() => {}} />

          {pwMsg && (
            <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, background: pwMsg.type === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(251,82,82,0.1)', color: pwMsg.type === 'ok' ? 'var(--success)' : 'var(--danger)', border: `1px solid ${pwMsg.type === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(251,82,82,0.3)'}` }}>
              {pwMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={pwLoading || !currentPw || !newPw || !confirmPw}
            style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (pwLoading || !currentPw || !newPw || !confirmPw) ? 0.5 : 1, alignSelf: 'flex-start' }}
          >
            {pwLoading ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => window.location.href = hubUrl}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--surface-raised)', border: '1px solid var(--shell-border)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}
        >
          <ArrowLeft size={14} /> Volver al Hub
        </button>
        <button
          onClick={signOut}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(251,82,82,0.08)', border: '1px solid rgba(251,82,82,0.25)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--danger)', cursor: 'pointer' }}
        >
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
    <div style={{ color: 'var(--muted)', marginTop: 1 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-h)', fontWeight: 500 }}>{value}</div>
    </div>
  </div>
);

const PwField: React.FC<{ label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void }> = ({ label, value, onChange, show, onToggle }) => (
  <div>
    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '9px 36px 9px 12px', border: '1px solid var(--shell-border)', borderRadius: 8, background: 'var(--shell-panel-strong)', color: 'var(--text-h)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
      />
      <button
        type="button"
        onClick={onToggle}
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, display: 'flex' }}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  </div>
);
