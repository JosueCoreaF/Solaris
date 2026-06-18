import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { RightSidebarChat } from '../components/RightSidebarChat';
import { useRestaurant } from '../context/RestaurantContext';

export const MainLayout: React.FC = () => {
  const { plan } = useRestaurant();
  const hasAI = (plan?.feature_flags ?? []).includes('ai_asistente');

  return (
    <div className="dashboard-root">
      <Sidebar />
      <main className="dashboard-shell">
        <div className="dashboard-route-stage">
          <Outlet />
        </div>
      </main>
      {hasAI && <RightSidebarChat />}
    </div>
  );
};
