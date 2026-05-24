import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CreateBusiness } from './pages/CreateBusiness';
import { SetupOwner } from './pages/SetupOwner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import apiClient from './services/api';
import './index.css';

const AppRoutes = () => {
  const { session } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/login" replace />} />
      <Route path="/setup-owner" element={session ? <SetupOwner /> : <Navigate to="/login" replace />} />
      <Route path="/create-business" element={session ? <CreateBusiness /> : <Navigate to="/login" replace />} />
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
