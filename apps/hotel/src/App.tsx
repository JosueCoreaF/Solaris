import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { AuthGuard, GuestGuard } from './components/AuthGuard';
import { RoleGuard } from './components/RoleGuard';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Login } from './features/auth/Login';
import { Register } from './features/auth/Register';
import { Bookings } from './features/bookings/Bookings';
import { HabitacionesPanel } from './features/habitaciones/HabitacionesPanel';
import { Pagos } from './features/bookings/Pagos';
import { Finance } from './features/finance/Finance';
import { Config } from './features/admin/Config';
import { Tarifas } from './features/admin/Tarifas';
import { RoleManagement } from './features/admin/RoleManagement';
import { Reportes } from './features/admin/Reportes';
import { ExportadorDatos } from './features/admin/ExportadorDatos';
import { PerfilUsuario } from './features/profile/PerfilUsuario';
import { EstadoCuenta } from './features/bookings/EstadoCuenta';
import { Clients } from './features/clients/Clients';
import { ClienteDetalle } from './features/clients/ClienteDetalle';
import { ToastProvider } from './components/Toast';
import ChatOperativo from './components/ChatOperativo';
import PortalCliente from './components/PortalCliente';
import { FinanceAIProvider, FloatingAIProgressWidget } from './context/FinanceAIContext';
import apiClient from './services/api';

export const App: React.FC = () => {
  useEffect(() => {
    apiClient.get('/health-check')
      .then(res => console.log('[Health Check]:', res))
      .catch(err => console.error('[Health Check Error]:', err));
  }, []);

  return (
    <AuthProvider>
      <SyncProvider>
        <FinanceAIProvider>
          <ToastProvider>
            <Router>
            <Routes>
              {/* Rutas públicas (solo accesibles sin sesión) */}
              <Route
                path="/login"
                element={
                  <GuestGuard>
                    <Login />
                  </GuestGuard>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestGuard>
                    <Register />
                  </GuestGuard>
                }
              />

              {/* Portal público para clientes (sin auth requerida) */}
              <Route path="/portal" element={<PortalCliente />} />

              {/* Rutas protegidas */}
              <Route
                element={
                  <AuthGuard>
                    <Layout />
                  </AuthGuard>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/perfil" element={<PerfilUsuario />} />
                <Route path="/reservas" element={<Bookings />} />
                <Route path="/habitaciones" element={<HabitacionesPanel />} />
                <Route path="/pagos" element={<Pagos />} />
                <Route path="/estado-cuenta" element={<EstadoCuenta />} />
                <Route path="/clientes" element={<Clients />} />
                <Route path="/clientes/:id" element={<ClienteDetalle />} />
                <Route path="/chat" element={<ChatOperativo />} />
                <Route
                  path="/finanzas"
                  element={
                    <RoleGuard requiredRoles={['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR']}>
                      <Finance />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/tarifas"
                  element={
                    <RoleGuard requiredRoles={['PROPIETARIO', 'ADMIN']}>
                      <Tarifas />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/gestionar-roles"
                  element={
                    <RoleGuard requiredRoles="PROPIETARIO">
                      <RoleManagement />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/config"
                  element={
                    <RoleGuard requiredRoles={['PROPIETARIO', 'ADMIN']}>
                      <Config />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/reportes"
                  element={
                    <RoleGuard requiredRoles={['PROPIETARIO', 'ADMIN', 'CONTADOR']}>
                      <Reportes />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/exportar"
                  element={
                    <RoleGuard requiredRoles={['PROPIETARIO', 'ADMIN', 'CONTADOR']}>
                      <ExportadorDatos />
                    </RoleGuard>
                  }
                />
              </Route>
            </Routes>
            <FloatingAIProgressWidget />
          </Router>
        </ToastProvider>
      </FinanceAIProvider>
      </SyncProvider>
    </AuthProvider>
  );
};
