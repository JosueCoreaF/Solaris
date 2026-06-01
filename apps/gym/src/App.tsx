import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { ToastProvider } from './components/Toast';
import { AuthGuard, GuestGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Login } from './features/auth/Login';
import { Miembros } from './features/miembros/Miembros';
import { Inscripciones } from './features/inscripciones/Inscripciones';
import { Clases } from './features/clases/Clases';
import { Pagos } from './features/pagos/Pagos';
import { Reportes } from './features/reportes/Reportes';
import { Config } from './features/config/Config';

function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <ToastProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<GuestGuard><Login /></GuestGuard>} />
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
    </AuthProvider>
  );
}

export default App;
