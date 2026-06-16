import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RestaurantProvider, useRestaurant } from './context/RestaurantContext';
import { MainLayout } from './layouts/MainLayout';
import { RestaurantSelector } from './components/RestaurantSelector';

import { Login }       from './pages/Login';
import { Dashboard }   from './pages/Dashboard';
import { Platillos }   from './pages/Platillos';
import { Menus }       from './pages/Menus';
import { Mesas }       from './pages/Mesas';
import { Pedidos }     from './pages/Pedidos';
import { Clientes }    from './pages/Clientes';
import { Empleados }   from './pages/Empleados';
import { Inventario }  from './pages/Inventario';
import { Reservas }    from './pages/Reservas';
import { Proveedores } from './pages/Proveedores';
import { Facturas }    from './pages/Facturas';
import { Gastos }      from './pages/Gastos';
import { Usuarios }    from './pages/Usuarios';

// ── Guards ───────────────────────────────────────────────────────────────────

const Spinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="auth-loading-screen">
    <div className="auth-loading-inner">
      <div className="auth-loading-badge">RS</div>
      <div className="auth-loading-spinner" />
      {label && <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>}
    </div>
  </div>
);

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();
  if (loading) return <Spinner label="Verificando sesión..." />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const GuestGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();
  if (loading) return <Spinner />;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const TenantGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { modulesLoading, modules, needsSelector, restaurantLoading } = useRestaurant();

  if (modulesLoading) return <Spinner label="Cargando restaurantes..." />;

  if (modules.length === 0) {
    return (
      <div className="auth-loading-screen">
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 12, background: 'rgba(251,82,82,0.10)',
            border: '1px solid rgba(251,82,82,0.20)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 20px', color: 'var(--danger)',
          }}>
            <UtensilsCrossed size={28} />
          </div>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 20, color: 'var(--text-h)', textTransform: 'uppercase', marginBottom: 10 }}>Sin acceso</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            Tu cuenta no tiene acceso a ningún restaurante activo en Solaris.
            Contacta al administrador del sistema.
          </p>
        </div>
      </div>
    );
  }

  if (needsSelector) return <RestaurantSelector />;
  if (restaurantLoading) return <Spinner label="Cargando restaurante..." />;

  return <>{children}</>;
};

// ── Layout protegido ──────────────────────────────────────────────────────────
const ProtectedLayout: React.FC = () => (
  <AuthGuard>
    <RestaurantProvider>
      <TenantGuard>
        <MainLayout />
      </TenantGuard>
    </RestaurantProvider>
  </AuthGuard>
);

// ── Router ────────────────────────────────────────────────────────────────────
const AppContent: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<GuestGuard><Login /></GuestGuard>} />
      <Route element={<ProtectedLayout />}>
        <Route path="/"            element={<Dashboard />} />
        <Route path="/platillos"   element={<Platillos />} />
        <Route path="/menus"       element={<Menus />} />
        <Route path="/mesas"       element={<Mesas />} />
        <Route path="/pedidos"     element={<Pedidos />} />
        <Route path="/clientes"    element={<Clientes />} />
        <Route path="/empleados"   element={<Empleados />} />
        <Route path="/inventario"  element={<Inventario />} />
        <Route path="/reservas"    element={<Reservas />} />
        <Route path="/proveedores" element={<Proveedores />} />
        <Route path="/facturas"    element={<Facturas />} />
        <Route path="/gastos"      element={<Gastos />} />
        <Route path="/usuarios"    element={<Usuarios />} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
