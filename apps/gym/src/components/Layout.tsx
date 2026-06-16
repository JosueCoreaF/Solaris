import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { RightSidebarChat } from './RightSidebarChat';

export const Layout: React.FC = () => (
  <div className="dashboard-root">
    <Sidebar />
    <div className="dashboard-shell">
      <div className="dashboard-route-stage">
        <Outlet />
      </div>
    </div>
    <RightSidebarChat />
  </div>
);
