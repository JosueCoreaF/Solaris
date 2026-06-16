import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

export const MainLayout: React.FC = () => (
  <div className="dashboard-root">
    <Sidebar />
    <main className="dashboard-shell">
      <div className="dashboard-route-stage">
        <Outlet />
      </div>
    </main>
  </div>
);
