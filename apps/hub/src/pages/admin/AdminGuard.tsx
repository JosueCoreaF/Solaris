import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) { setAllowed(false); return; }
    apiClient.get('/hub/admin/stats')
      .then(() => setAllowed(true))
      .catch(() => setAllowed(false));
  }, [session]);

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
