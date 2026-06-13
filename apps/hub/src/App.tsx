import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CreateBusiness } from './pages/CreateBusiness';
import { SetupOwner } from './pages/SetupOwner';
import { Onboarding } from './pages/Onboarding';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import apiClient from './services/api';
import './index.css';

import Support from './pages/Support';
import Billing from './pages/Billing';
import { UpgradePlan } from './pages/UpgradePlan';
import Notifications from './pages/Notifications';
import ChatHub from './pages/ChatHub';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOwners from './pages/admin/AdminOwners';
import AdminAudit from './pages/admin/AdminAudit';
import AdminBilling from './pages/admin/AdminBilling';
import { AdminGuard } from './pages/admin/AdminGuard';

const AppRoutes = () => {
  const { session } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/login" replace />} />
      <Route path="/setup-owner" element={session ? <SetupOwner /> : <Navigate to="/login" replace />} />
      <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" replace />} />
      <Route path="/create-business" element={session ? <CreateBusiness /> : <Navigate to="/login" replace />} />
      <Route path="/support" element={session ? <Support /> : <Navigate to="/login" replace />} />
      <Route path="/billing" element={session ? <Billing /> : <Navigate to="/login" replace />} />
      <Route path="/upgrade" element={session ? <UpgradePlan /> : <Navigate to="/login" replace />} />
      <Route path="/notifications" element={session ? <Notifications /> : <Navigate to="/login" replace />} />
      <Route path="/chat" element={session ? <ChatHub /> : <Navigate to="/login" replace />} />
      <Route path="/admin" element={session ? <AdminGuard><AdminDashboard /></AdminGuard> : <Navigate to="/login" replace />} />
      <Route path="/admin/owners" element={session ? <AdminGuard><AdminOwners /></AdminGuard> : <Navigate to="/login" replace />} />
      <Route path="/admin/billing" element={session ? <AdminGuard><AdminBilling /></AdminGuard> : <Navigate to="/login" replace />} />
      <Route path="/admin/audit" element={session ? <AdminGuard><AdminAudit /></AdminGuard> : <Navigate to="/login" replace />} />
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
