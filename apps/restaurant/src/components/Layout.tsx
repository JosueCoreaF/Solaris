    // src/components/LayoutRestaurante.jsx
    import React, { useState } from 'react';
    import Sidebar from './Sidebar';
    import Topbar from './Topbar';

    export const Layout = ({ children }: { children: React.ReactNode }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50">
        {sidebarOpen && <Sidebar />}
        
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-2">
            <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 bg-amber-500 text-white rounded-lg"
            >
                ☰ Menú
            </button>
            </div>
            
            {/* 👇 Agrega este botón para cerrar el sidebar */}
            {sidebarOpen && (
            <div className="p-2">
                <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 bg-red-500 text-white rounded-lg"
                >
                ✕ Cerrar
                </button>
            </div>
            )}
            
            <Topbar />
            <main className="flex-1 overflow-y-auto p-6">
            {children}
            </main>
        </div>
        </div>
    );
    };