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

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #333333;
        background-color: #f9fafa;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
      }
      .header {
        background-color: #0f172a;
        color: #ffffff;
        padding: 30px 40px;
        text-align: center;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
        letter-spacing: 0.5px;
      }
      .content {
        padding: 40px;
      }
      .greeting {
        font-size: 18px;
        margin-bottom: 24px;
      }
      .details-box {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 24px;
        margin-bottom: 30px;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 12px;
      }
      .detail-row:last-child {
        margin-bottom: 0;
        border-bottom: none;
        padding-bottom: 0;
      }
      .detail-label {
        font-weight: 600;
        color: #64748b;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .detail-value {
        font-weight: 500;
        color: #0f172a;
      }
      .total-row {
        background-color: #f1f5f9;
        padding: 16px;
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
      }
      .total-label {
        font-weight: 600;
        font-size: 16px;
      }
      .total-value {
        font-weight: 700;
        font-size: 20px;
        color: #2563eb;
      }
      .footer {
        text-align: center;
        padding: 30px;
        color: #64748b;
        font-size: 14px;
        background-color: #f8fafc;
        border-top: 1px solid #e2e8f0;
      }
      .btn {
        display: inline-block;
        background-color: #2563eb;
        color: #ffffff;
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-weight: 500;
        margin-top: 20px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${data.hotelName}</h1>
      </div>
      <div class="content">
        <div class="greeting">
          Hola <strong>${data.guestName}</strong>,<br>
          ¡Tu reserva ha sido confirmada con éxito!
        </div>
        
        <p>Estamos emocionados de recibirte. A continuación, encontrarás los detalles de tu estadía:</p>
        
        <div class="details-box">
          <div class="detail-row">
            <span class="detail-label">Nº de Reserva</span>
            <span class="detail-value" style="font-family: monospace;">${data.bookingId.split('-')[0].toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Check-in</span>
            <span class="detail-value">${formatDate(data.checkIn)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Check-out</span>
            <span class="detail-value">${formatDate(data.checkOut)}</span>
          </div>
        </div>

        <div class="total-row">
          <span class="total-label">Total a pagar:</span>
          <span class="total-value">${formatCurrency(data.totalAmount)}</span>
        </div>

        <p>Si tienes alguna pregunta o necesitas modificar tu reserva, no dudes en contactarnos respondiendo a este correo.</p>
        
        <p>¡Te esperamos pronto!</p>
        <p><strong>El equipo de ${data.hotelName}</strong></p>
      </div>
      <div class="footer">
        Este es un correo automático generado por el sistema de reservas Solaris.
        <br><br>
        &copy; ${new Date().getFullYear()} ${data.hotelName}. Todos los derechos reservados.
      </div>
    </div>
  </body>
  </html>
  `;
}
