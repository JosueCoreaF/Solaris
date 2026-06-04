// src/components/Topvar.jsx - El mismo que ya funciona
import React from 'react';

export default function Topvar() {
  return (
    <div className="bg-white shadow-sm p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Reportes de restaurante</h1>
          <p className="text-gray-500 text-sm mt-1">Bienvenido, aqui podra ver los reportes de tu restaurante</p>
        </div>
        
        <input 
          type="text" 
          placeholder="Buscar..." 
          className="border border-blue-300 rounded-lg px-4 py-2 w-64 bg-gray-50"
        />
      </div>
    </div>
  );
}