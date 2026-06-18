import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { RightSidebarChat } from './RightSidebarChat';
import { useSync } from '../context/SyncContext';

export const Layout: React.FC = () => {
  const { gimnasio } = useSync();
  const hasAI = ((gimnasio?.plan?.feature_flags as string[] | undefined) ?? []).includes('ai_asistente');

  return (
    <div className="dashboard-root">
      <Sidebar />
      <div className="dashboard-shell">
        <div className="dashboard-route-stage">
          <Outlet />
        </div>
      </div>
      {hasAI && <RightSidebarChat />}
    </div>
  );
};
