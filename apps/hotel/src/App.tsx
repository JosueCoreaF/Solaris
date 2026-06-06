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
import { EmpresasPanel } from './features/bookings/EmpresasPanel';
import { ClienteDetalle } from './features/clients/ClienteDetalle';
import { AuditPanel } from './features/admin/AuditPanel';
import { ImportadorReservasPage } from './features/bookings/ImportadorReservasPage';
import { MantenimientoPanel } from './features/mantenimiento/MantenimientoPanel';
import { Housekeeping } from './features/housekeeping/Housekeeping';
import { ToastProvider } from './components/Toast';
import ChatOperativo from './components/ChatOperativo';
import { FinanceAIProvider, FloatingAIProgressWidget } from './context/FinanceAIContext';
import apiClient from './services/api';
import { ROUTE_ROLES } from './config/rbac';

// Shorthand para no repetir <RoleGuard requiredRoles={ROUTE_ROLES[path]}>
const Guarded: React.FC<{ path: string; children: React.ReactNode }> = ({ path, children }) => (
  <RoleGuard requiredRoles={ROUTE_ROLES[path] ?? ['PROPIETARIO']}>
    {children}
  </RoleGuard>
);

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
                {/* Rutas públicas */}
                <Route path="/login"    element={<GuestGuard><Login /></GuestGuard>} />
                <Route path="/register" element={<GuestGuard><Register /></GuestGuard>} />

                {/* Rutas protegidas */}
                <Route element={<AuthGuard><Layout /></AuthGuard>}>

                  <Route path="/" element={
                    <Guarded path="/"><Dashboard /></Guarded>
                  } />
                  <Route path="/perfil" element={
                    <Guarded path="/perfil"><PerfilUsuario /></Guarded>
                  } />
                  <Route path="/habitaciones" element={
                    <Guarded path="/habitaciones"><HabitacionesPanel /></Guarded>
                  } />
                  <Route path="/housekeeping" element={
                    <Guarded path="/housekeeping"><Housekeeping /></Guarded>
                  } />
                  <Route path="/mantenimiento" element={
                    <Guarded path="/mantenimiento"><MantenimientoPanel /></Guarded>
                  } />
                  <Route path="/reservas" element={
                    <Guarded path="/reservas"><Bookings /></Guarded>
                  } />
                  <Route path="/pagos" element={
                    <Guarded path="/pagos"><Pagos /></Guarded>
                  } />
                  <Route path="/clientes" element={
                    <Guarded path="/clientes"><Clients /></Guarded>
                  } />
                  <Route path="/empresas" element={
                    <Guarded path="/empresas"><EmpresasPanel /></Guarded>
                  } />
                  <Route path="/clientes/:id" element={
                    <Guarded path="/clientes"><ClienteDetalle /></Guarded>
                  } />
                  <Route path="/estado-cuenta" element={
                    <Guarded path="/estado-cuenta"><EstadoCuenta /></Guarded>
                  } />
                  <Route path="/chat" element={
                    <Guarded path="/chat"><ChatOperativo /></Guarded>
                  } />
                  <Route path="/finanzas" element={
                    <Guarded path="/finanzas"><Finance /></Guarded>
                  } />
                  <Route path="/tarifas" element={
                    <Guarded path="/tarifas"><Tarifas /></Guarded>
                  } />
                  <Route path="/exportar" element={
                    <Guarded path="/exportar"><ExportadorDatos /></Guarded>
                  } />
                  <Route path="/importar-reservas" element={
                    <Guarded path="/importar-reservas"><ImportadorReservasPage /></Guarded>
                  } />
                  <Route path="/config" element={
                    <Guarded path="/config"><Config /></Guarded>
                  } />
                  <Route path="/gestionar-roles" element={
                    <Guarded path="/gestionar-roles"><RoleManagement /></Guarded>
                  } />
                  <Route path="/auditoria" element={
                    <Guarded path="/auditoria"><AuditPanel /></Guarded>
                  } />
                  <Route path="/reportes" element={
                    <Guarded path="/reportes"><Reportes /></Guarded>
                  } />

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
