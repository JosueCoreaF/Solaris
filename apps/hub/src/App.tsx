import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CreateBusiness } from './pages/CreateBusiness';
import { SetupOwner } from './pages/SetupOwner';
import { Onboarding } from './pages/Onboarding';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DashboardLayout } from './components/DashboardLayout';
import apiClient from './services/api';
import './index.css';

import Support from './pages/Support';
import HotelLanding from './pages/landing/HotelLanding';
import GymLanding from './pages/landing/GymLanding';
import RestaurantLanding from './pages/landing/RestaurantLanding';
import Billing from './pages/Billing';
import { UpgradePlan } from './pages/UpgradePlan';
import { McpTokens } from './pages/McpTokens';
import Notifications from './pages/Notifications';
import ChatHub from './pages/ChatHub';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOwners from './pages/admin/AdminOwners';
import AdminAudit from './pages/admin/AdminAudit';
import AdminBilling from './pages/admin/AdminBilling';
import { AdminGuard } from './pages/admin/AdminGuard';

const ProtectedLayout = () => {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return <DashboardLayout />;
};

const AppRoutes = () => {
  const { session } = useAuth();

  return (
    <Routes>
      {/* Públicas */}
      <Route path="/landing/hotel" element={<HotelLanding />} />
      <Route path="/landing/gym" element={<GymLanding />} />
      <Route path="/landing/restaurant" element={<RestaurantLanding />} />
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />

      {/* Flujos sin layout de hub */}
      <Route path="/setup-owner" element={session ? <SetupOwner /> : <Navigate to="/login" replace />} />
      <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" replace />} />
      <Route path="/create-business" element={session ? <CreateBusiness /> : <Navigate to="/login" replace />} />

      {/* Admin */}
      <Route path="/admin" element={session ? <AdminGuard><AdminDashboard /></AdminGuard> : <Navigate to="/login" replace />} />
      <Route path="/admin/owners" element={session ? <AdminGuard><AdminOwners /></AdminGuard> : <Navigate to="/login" replace />} />
      <Route path="/admin/billing" element={session ? <AdminGuard><AdminBilling /></AdminGuard> : <Navigate to="/login" replace />} />
      <Route path="/admin/audit" element={session ? <AdminGuard><AdminAudit /></AdminGuard> : <Navigate to="/login" replace />} />

      {/* Layout compartido — DashboardLayout se monta UNA sola vez */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard"     element={<Dashboard />} />
        <Route path="/support"       element={<Support />} />
        <Route path="/billing"       element={<Billing />} />
        <Route path="/upgrade"       element={<UpgradePlan />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/chat"          element={<ChatHub />} />
        <Route path="/mcp"           element={<McpTokens />} />
      </Route>

      <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
};

function App() {
  useEffect(() => {
    apiClient.get('/health-check')
      .then(res => console.log('🏥 [Health Check]:', res))
      .catch(err => console.error('🏥 [Health Check Error]:', err));
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
