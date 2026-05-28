import { Resend } from 'resend';
import { config_env as config } from '../config/supabase.js';

// Solo inicializamos si existe la clave en el entorno
const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export interface BookingEmailData {
  guestName: string;
  guestEmail: string;
  bookingId: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  currency: string;
  hotelName: string;
  hotelContact?: string;
  roomType?: string;
  adults?: number;
  children?: number;
  services?: string[];
}

/**
 * Envía un correo de confirmación de reserva al huésped usando Resend.
 */
export async function sendBookingConfirmation(data: BookingEmailData) {
  if (!resend) {
    console.warn('⚠️ No se ha configurado RESEND_API_KEY. El correo de confirmación no será enviado.');
    return;
  }

  // Prevenimos envíos a correos placeholder del sistema
  if (data.guestEmail.includes('@partnercentral.local')) {
    console.log(`Bypass email for placeholder address: ${data.guestEmail}`);
    return;
  }

  // Sanitizamos el nombre del hotel para que quede bien en el "Remitente"
  const senderName = data.hotelName.replace(/[^a-zA-Z0-9\s]/g, '').trim();

  try {
    const { data: responseData, error } = await resend.emails.send({
      from: `${senderName} <reservas@solarys.uk>`,
      to: [data.guestEmail],
      subject: `Confirmación de Reserva - ${data.hotelName}`,
      html: getBookingConfirmationTemplate(data)
    });

    if (error) {
      console.error('Error enviando correo de confirmación con Resend:', error);
      return { success: false, error };
    }

    console.log(`✅ Correo de confirmación enviado exitosamente a ${data.guestEmail}`, responseData);
    return { success: true, data: responseData };
  } catch (err) {
    console.error('Exception enviando correo:', err);
    return { success: false, error: err };
  }
}

/**
 * Plantilla HTML para la confirmación de la reserva.
 */
function getBookingConfirmationTemplate(data: BookingEmailData): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: data.currency || 'HNL'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const guestsText = `${data.adults || 1} Adultos${data.children ? `, ${data.children} Niños` : ''}`;
  const servicesList = data.services && data.services.length > 0 
    ? data.services.map(s => `<li>✔️ ${s}</li>`).join('') 
    : '<li>✔️ Alojamiento estándar</li>';

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Inter', Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #1e293b;
        background-color: #f1f5f9;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 10px 25px rgba(0,0,0,0.05);
      }
      .header {
        background-color: #0f172a;
        background-image: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: #ffffff;
        padding: 40px;
        text-align: center;
      }
      .logo {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.5px;
        margin: 0;
        text-transform: uppercase;
        color: #f8fafc;
      }
      .header-subtitle {
        color: #94a3b8;
        font-size: 14px;
        margin-top: 8px;
      }
      .content {
        padding: 40px;
      }
      .greeting {
        font-size: 20px;
        color: #0f172a;
        margin-bottom: 24px;
        font-weight: 600;
      }
      .greeting-sub {
        color: #475569;
        font-weight: 400;
        font-size: 16px;
      }
      .details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 24px;
      }
      .detail-card {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
      }
      .detail-label {
        font-size: 12px;
        text-transform: uppercase;
        color: #64748b;
        font-weight: 600;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }
      .detail-value {
        font-size: 15px;
        font-weight: 600;
        color: #0f172a;
      }
      .services-box {
        background-color: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
      }
      .services-title {
        color: #166534;
        font-weight: 600;
        margin-bottom: 12px;
        font-size: 15px;
      }
      .services-list {
        list-style: none;
        padding: 0;
        margin: 0;
        color: #15803d;
        font-size: 14px;
      }
      .services-list li {
        margin-bottom: 6px;
      }
      .policy-box {
        background-color: #fff8f1;
        border: 1px solid #ffedd5;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 30px;
      }
      .policy-title {
        color: #c2410c;
        font-weight: 600;
        margin-bottom: 8px;
        font-size: 14px;
      }
      .policy-text {
        color: #9a3412;
        font-size: 13px;
        margin: 0;
      }
      .total-row {
        background-color: #f1f5f9;
        padding: 20px;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        border-left: 4px solid #3b82f6;
      }
      .total-label {
        font-weight: 600;
        font-size: 16px;
        color: #334155;
      }
      .total-value {
        font-weight: 700;
        font-size: 24px;
        color: #2563eb;
      }
      .action-container {
        text-align: center;
        margin-bottom: 10px;
      }
      .btn {
        display: inline-block;
        background-color: #3b82f6;
        color: #ffffff;
        text-decoration: none;
        padding: 14px 28px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 15px;
        transition: background-color 0.2s;
        box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);
      }
      .footer {
        text-align: center;
        padding: 30px;
        background-color: #f8fafc;
        border-top: 1px solid #e2e8f0;
      }
      .footer-social {
        margin-bottom: 16px;
      }
      .footer-social a {
        color: #64748b;
        text-decoration: none;
        margin: 0 10px;
        font-size: 14px;
        font-weight: 500;
      }
      .footer-text {
        color: #94a3b8;
        font-size: 13px;
        margin: 0;
      }
      /* Responsive */
      @media only screen and (max-width: 600px) {
        .details-grid {
          grid-template-columns: 1fr;
        }
        .container {
          margin: 0;
          border-radius: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 class="logo">${data.hotelName}</h1>
        <div class="header-subtitle">Confirmación de Reserva #${data.bookingId.split('-')[0].toUpperCase()}</div>
      </div>
      <div class="content">
        <div class="greeting">
          Hola ${data.guestName},<br>
          <span class="greeting-sub">Tu reserva está lista y confirmada.</span>
        </div>
        
        <div class="details-grid">
          <div class="detail-card">
            <div class="detail-label">Check-in</div>
            <div class="detail-value">${formatDate(data.checkIn)}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Desde las 15:00</div>
          </div>
          <div class="detail-card">
            <div class="detail-label">Check-out</div>
            <div class="detail-value">${formatDate(data.checkOut)}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Hasta las 12:00</div>
          </div>
          <div class="detail-card">
            <div class="detail-label">Habitación</div>
            <div class="detail-value">${data.roomType || 'Habitación Estándar'}</div>
          </div>
          <div class="detail-card">
            <div class="detail-label">Huéspedes</div>
            <div class="detail-value">${guestsText}</div>
          </div>
        </div>

        <div class="services-box">
          <div class="services-title">Servicios Incluidos</div>
          <ul class="services-list">
            ${servicesList}
          </ul>
        </div>

        <div class="total-row">
          <span class="total-label">Total a pagar</span>
          <span class="total-value">${formatCurrency(data.totalAmount)}</span>
        </div>

        <div class="policy-box">
          <div class="policy-title">Política de Cancelación</div>
          <p class="policy-text">Las cancelaciones o modificaciones gratuitas deben realizarse con al menos 48 horas de anticipación a su fecha de Check-in. En caso de cancelaciones tardías o no show, se cobrará la primera noche como penalidad.</p>
        </div>

        <div class="action-container">
          <!-- Placeholder URL, idealmente podrías poner el enlace real al portal del cliente -->
          <a href="#" class="btn" style="color: white !important;">Gestionar mi Reserva</a>
        </div>
      </div>
      
      <div class="footer">
        <div class="footer-social">
          <a href="#">Facebook</a> | <a href="#">Instagram</a> | <a href="#">Sitio Web</a>
        </div>
        <p class="footer-text">
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 24px;
      }
      .detail-card {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
      }
      .detail-label {
        font-size: 12px;
        text-transform: uppercase;
        color: #64748b;
        font-weight: 600;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }
      .detail-value {
        font-size: 15px;
        font-weight: 600;
        color: #0f172a;
      }
      .services-box {
        background-color: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
      }
      .services-title {
        color: #166534;
        font-weight: 600;
        margin-bottom: 12px;
        font-size: 15px;
      }
      .services-list {
        list-style: none;
        padding: 0;
        margin: 0;
        color: #15803d;
        font-size: 14px;
      }
      .services-list li {
        margin-bottom: 6px;
      }
      .policy-box {
        background-color: #fff8f1;
        border: 1px solid #ffedd5;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 30px;
      }
      .policy-title {
        color: #c2410c;
        font-weight: 600;
        margin-bottom: 8px;
        font-size: 14px;
      }
      .policy-text {
        color: #9a3412;
        font-size: 13px;
        margin: 0;
      }
      .total-row {
        background-color: #f1f5f9;
        padding: 20px;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        border-left: 4px solid #3b82f6;
      }
      .total-label {
        font-weight: 600;
        font-size: 16px;
        color: #334155;
      }
      .total-value {
        font-weight: 700;
        font-size: 24px;
        color: #2563eb;
      }
      .action-container {
        text-align: center;
        margin-bottom: 10px;
      }
      .btn {
        display: inline-block;
        background-color: #3b82f6;
        color: #ffffff;
        text-decoration: none;
        padding: 14px 28px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 15px;
        transition: background-color 0.2s;
        box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);
      }
      .footer {
        text-align: center;
        padding: 30px;
        background-color: #f8fafc;
        border-top: 1px solid #e2e8f0;
      }
      .footer-social {
        margin-bottom: 16px;
      }
      .footer-social a {
        color: #64748b;
        text-decoration: none;
        margin: 0 10px;
        font-size: 14px;
        font-weight: 500;
      }
      .footer-text {
        color: #94a3b8;
        font-size: 13px;
        margin: 0;
      }
      /* Responsive */
      @media only screen and (max-width: 600px) {
        .details-grid {
          grid-template-columns: 1fr;
        }
        .container {
          margin: 0;
          border-radius: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 class="logo">${data.hotelName}</h1>
        <div class="header-subtitle">Confirmación de Reserva #${data.bookingId.split('-')[0].toUpperCase()}</div>
      </div>
      <div class="content">
        <div class="greeting">
          Hola ${data.guestName},<br>
          <span class="greeting-sub">Tu reserva está lista y confirmada.</span>
        </div>
        
        <div class="details-grid">
          <div class="detail-card">
            <div class="detail-label">Check-in</div>
            <div class="detail-value">${formatDate(data.checkIn)}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Desde las 15:00</div>
          </div>
          <div class="detail-card">
            <div class="detail-label">Check-out</div>
            <div class="detail-value">${formatDate(data.checkOut)}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Hasta las 12:00</div>
          </div>
          <div class="detail-card">
            <div class="detail-label">Habitación</div>
            <div class="detail-value">${data.roomType || 'Habitación Estándar'}</div>
          </div>
          <div class="detail-card">
            <div class="detail-label">Huéspedes</div>
            <div class="detail-value">${guestsText}</div>
          </div>
        </div>

        <div class="services-box">
          <div class="services-title">Servicios Incluidos</div>
          <ul class="services-list">
            ${servicesList}
          </ul>
        </div>

        <div class="total-row">
          <span class="total-label">Total a pagar</span>
          <span class="total-value">${formatCurrency(data.totalAmount)}</span>
        </div>

        <div class="policy-box">
          <div class="policy-title">Política de Cancelación</div>
          <p class="policy-text">Las cancelaciones o modificaciones gratuitas deben realizarse con al menos 48 horas de anticipación a su fecha de Check-in. En caso de cancelaciones tardías o no show, se cobrará la primera noche como penalidad.</p>
        </div>

        <div class="action-container">
          <!-- Placeholder URL, idealmente podrías poner el enlace real al portal del cliente -->
          <a href="#" class="btn" style="color: white !important;">Gestionar mi Reserva</a>
        </div>
      </div>
      
      <div class="footer">
        <div class="footer-social">
          <a href="#">Facebook</a> | <a href="#">Instagram</a> | <a href="#">Sitio Web</a>
        </div>
        <p class="footer-text">
          ¿Tienes dudas? Contáctanos al hotel o responde a este correo.<br><br>
          &copy; ${new Date().getFullYear()} ${data.hotelName}. Todos los derechos reservados.<br>
          Este es un correo automático generado por el sistema de reservas Solaris.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Envía un correo de notificación al hotel cuando se recibe una nueva reserva.
 */
export async function sendHotelNotificationEmail(data: BookingEmailData, hotelContactEmail: string) {
  if (!resend) {
    console.warn('⚠️ No se ha configurado RESEND_API_KEY. El correo de notificación al hotel no será enviado.');
    return;
  }

  // Prevenimos envíos a correos placeholder del sistema
  if (hotelContactEmail.includes('@partnercentral.local')) {
    console.log(`Bypass email for placeholder address: ${hotelContactEmail}`);
    return;
  }

  const senderName = data.hotelName.replace(/[^a-zA-Z0-9\s]/g, '').trim();

  try {
    const { data: responseData, error } = await resend.emails.send({
      from: `${senderName} <reservas@solarys.uk>`,
      to: [hotelContactEmail],
      subject: `Nueva Reserva Recibida - ${data.guestName}`,
      html: getHotelNotificationTemplate(data)
    });

    if (error) {
      console.error('Error enviando correo de notificación al hotel:', error);
      return { success: false, error };
    }

    console.log(`✅ Correo de notificación enviado al hotel exitosamente a ${hotelContactEmail}`, responseData);
    return { success: true, data: responseData };
  } catch (err) {
    console.error('Exception enviando correo al hotel:', err);
    return { success: false, error: err };
  }
}

/**
 * Plantilla HTML para la notificación al hotel.
 */
function getHotelNotificationTemplate(data: BookingEmailData): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: data.currency || 'HNL'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const guestsText = `${data.adults || 1} Adultos${data.children ? `, ${data.children} Niños` : ''}`;
  const servicesList = data.services && data.services.length > 0 
    ? data.services.map(s => `<li>✔️ ${s}</li>`).join('') 
    : '<li>Ninguno extra</li>';

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Inter', Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #1e293b;
        background-color: #f1f5f9;
        margin: 0;
        padding: 40px 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 10px 25px rgba(0,0,0,0.05);
        border-top: 6px solid #2563eb;
      }
      .header {
        padding: 30px 40px;
        border-bottom: 1px solid #e2e8f0;
        background-color: #f8fafc;
      }
      .title {
        font-size: 22px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
      }
      .content {
        padding: 40px;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }
      .data-table th, .data-table td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
      }
      .data-table th {
        background-color: #f8fafc;
        color: #64748b;
        font-weight: 600;
        font-size: 13px;
        text-transform: uppercase;
        width: 35%;
      }
      .data-table td {
        color: #0f172a;
        font-weight: 500;
      }
      .highlight {
        color: #2563eb;
        font-weight: 700;
        font-size: 18px;
      }
      .services-box {
        background-color: #f1f5f9;
        border-radius: 8px;
        padding: 20px;
        margin-top: 30px;
      }
      .services-title {
        color: #334155;
        font-weight: 600;
        margin-bottom: 10px;
        font-size: 15px;
      }
      .services-list {
        list-style: none;
        padding: 0;
        margin: 0;
        color: #475569;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 class="title">🔔 Nueva Reserva Recibida</h1>
      </div>
      <div class="content">
        <p style="margin-top: 0;">Se ha registrado una nueva reserva en el sistema para <strong>${data.hotelName}</strong>.</p>
        
        <table class="data-table">
          <tr>
            <th>Nº Reserva</th>
            <td style="font-family: monospace;">${data.bookingId.split('-')[0].toUpperCase()}</td>
          </tr>
          <tr>
            <th>Huésped</th>
            <td>${data.guestName} <br><span style="font-size: 13px; color: #64748b;">${data.guestEmail}</span></td>
          </tr>
          <tr>
            <th>Habitación</th>
            <td>${data.roomType || 'Habitación Estándar'}</td>
          </tr>
          <tr>
            <th>Ocupación</th>
            <td>${guestsText}</td>
          </tr>
          <tr>
            <th>Check-in</th>
            <td>${formatDate(data.checkIn)}</td>
          </tr>
          <tr>
            <th>Check-out</th>
            <td>${formatDate(data.checkOut)}</td>
          </tr>
          <tr>
            <th>Total Reserva</th>
            <td class="highlight">${formatCurrency(data.totalAmount)}</td>
          </tr>
        </table>

        <div class="services-box">
          <div class="services-title">Servicios Extra Solicitados:</div>
          <ul class="services-list">
            ${servicesList}
          </ul>
        </div>
        
        <p style="margin-top: 30px; color: #64748b; font-size: 14px; text-align: center;">
          Puedes revisar más detalles ingresando al panel de administración de Solaris.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;
}
