import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SyncProvider } from './context/SyncContext';
import { ToastProvider } from './components/Toast';
import { AccountBlockedScreen } from './components/AccountBlockedScreen';
import { AuthGuard, GuestGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Login } from './features/auth/Login';
import { Register } from './features/auth/Register';
import { Miembros } from './features/miembros/Miembros';
import { Inscripciones } from './features/inscripciones/Inscripciones';
import { Clases } from './features/clases/Clases';
import { Pagos } from './features/pagos/Pagos';
import { Reportes } from './features/reportes/Reportes';
import { Config } from './features/config/Config';

const AppContent: React.FC = () => {
  const { accountBlocked, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-inner">
          <div className="auth-loading-badge">GYM</div>
          <div className="auth-loading-spinner" />
        </div>
      </div>
    );
  }

  if (accountBlocked) {
    return <AccountBlockedScreen reason={accountBlocked} onSignOut={signOut} />;
  }

  return (
    <SyncProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<GuestGuard><Login /></GuestGuard>} />
            <Route path="/register" element={<GuestGuard><Register /></GuestGuard>} />
            <Route element={<AuthGuard><Layout /></AuthGuard>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/miembros" element={<Miembros />} />
              <Route path="/inscripciones" element={<Inscripciones />} />
              <Route path="/clases" element={<Clases />} />
              <Route path="/pagos" element={<Pagos />} />
              <Route path="/reportes" element={<Reportes />} />
              <Route path="/config" element={<Config />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </SyncProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
