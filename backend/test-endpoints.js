import fetch from 'node-fetch';

async function test() {
  console.log('=== PRUEBA CREACIÓN DE BLOQUEO (TOGGLE) ===');
  try {
    const payload = {
      id_habitacion: '5d06e032-5770-4584-8a8a-605e2c590270', // Habitación de prueba
      fecha: '2026-06-15T00:00:00Z',
      motivo: 'Bloqueo por mantenimiento de aire'
    };

    const res = await fetch('http://localhost:4000/api/bookings/bloqueos/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hotel-ID': '450459b7-6278-44ad-b15d-64d907f4e446'
      },
      body: JSON.stringify(payload)
    });

    console.log('Status toggle bloqueo:', res.status);
    const data = await res.json();
    console.log('Respuesta de bloqueo:', data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
