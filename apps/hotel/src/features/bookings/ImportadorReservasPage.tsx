import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportadorReservas } from './ImportadorReservas';
import apiClient from '../../services/api';

export const ImportadorReservasPage: React.FC = () => {
  const navigate = useNavigate();
  const hotelId = localStorage.getItem('active_hotel_id') || '';
  const [hoteles, setHoteles] = useState<{ id_hotel: string; nombre_hotel: string }[]>([]);
  const [habitaciones, setHabitaciones] = useState<{ id_habitacion: string; nombre_habitacion: string; nombre_alias?: string }[]>([]);

  useEffect(() => {
    apiClient.get('/hotel/bookings/hoteles')
      .then(r => setHoteles(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
    apiClient.get('/hotel/habitaciones', { headers: { 'X-Hotel-ID': hotelId } })
      .then(r => setHabitaciones(r.data || []))
      .catch(() => {});
  }, [hotelId]);

  return (
    <ImportadorReservas
      onClose={() => navigate('/reservas')}
      hotelId={hotelId}
      hoteles={hoteles}
      habitaciones={habitaciones}
      onImportComplete={() => navigate('/reservas')}
    />
  );
};
