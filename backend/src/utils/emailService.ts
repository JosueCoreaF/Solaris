import { Resend } from 'resend';
import { config_env as config, supabaseAdmin, supabase } from '../config/supabase.js';

// Solo inicializamos si existe la clave en el entorno
const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;
const db = () => supabaseAdmin ?? supabase;

interface TemplateStyles {
  color_cabecera?: string;
  fuente?: string;
  tamano_letra?: string;
  logo_url?: string;
  firma?: string;
}

export async function getCustomTemplate(id_hotel: string, tipo: string) {
  try {
    const { data } = await db()
      .from('plantillas_correo')
      .select('asunto, cuerpo_personalizado, estilos')
      .eq('id_hotel', id_hotel)
      .eq('tipo_plantilla', tipo)
      .maybeSingle();
    return data;
  } catch (err) {
    console.error('Error al cargar plantilla de correo personalizada:', err);
    return null;
  }
}

function generateEmailFromBlocks(
  estilos: TemplateStyles & { bloques?: any[] },
  blocksHtml: string,
  hotelName: string,
  appendHtml: string = ''
): string {
  const headerColor = estilos.color_cabecera || '#0f172a';
  const font = estilos.fuente || 'Arial, sans-serif';
  const fontSize = estilos.tamano_letra || '14px';

  const logoHtml = estilos.logo_url
    ? `<img src="${estilos.logo_url}" style="max-height: 48px; object-fit: contain; display: block; margin: 0 auto;" alt="${hotelName}" />`
    : `<h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; font-family: ${font}; letter-spacing: -0.3px;">${hotelName}</h1>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: ${font}; font-size: ${fontSize}; -webkit-font-smoothing: antialiased;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 32px 16px; border-collapse: collapse;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" bgcolor="${headerColor}" style="background-color: ${headerColor}; border-radius: 12px 12px 0 0; padding: 28px 32px; text-align: center;">
              ${logoHtml}
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color: #ffffff; padding: 36px 36px 28px; border-radius: 0 0 12px 12px;">
              ${blocksHtml}${appendHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 16px; font-family: ${font}; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.6;">
              Este correo fue enviado por <strong>${hotelName}</strong>.<br />
              Por favor no respondas directamente a este correo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function compileCustomTemplate(
  defaultHtml: string,
  defaultSubject: string,
  customTemplate: any,
  variables: Record<string, string>
) {
  let subject = defaultSubject;
  let html = defaultHtml;

  if (customTemplate) {
    if (customTemplate.asunto) {
      subject = customTemplate.asunto;
    }

    const estilos: TemplateStyles & { bloques?: any[] } = customTemplate.estilos || {};
    
    // 1. Reemplazar variables en el asunto
    for (const [k, v] of Object.entries(variables)) {
      subject = subject.replace(new RegExp(`{{${k}}}`, 'g'), v);
    }

    // Compile blocks if present
    let blocksHtml = '';
    if (Array.isArray(estilos.bloques) && estilos.bloques.length > 0) {
      for (const block of estilos.bloques) {
        let blockHtml = '';
        const replaceVars = (str: string = '') => {
          let res = str;
          for (const [k, v] of Object.entries(variables)) {
            res = res.replace(new RegExp(`{{${k}}}`, 'g'), v);
          }
          return res;
        };

        if (block.type === 'texto') {
          const bodyText = replaceVars(block.cuerpo || block.texto || '');
          blockHtml = `<p class="msg" style="font-size: ${estilos.tamano_letra || '14px'}; font-family: ${estilos.fuente || 'inherit'}; line-height: 1.7; color: #475569; margin: 0 0 20px;">${bodyText.replace(/\n/g, '<br>')}</p>`;
        } 
        else if (block.type === 'divisor') {
          blockHtml = `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />`;
        } 
        else if (block.type === 'upselling') {
          const titulo = replaceVars(block.titulo || '');
          const desc = replaceVars(block.descripcion || '');
          const precio = replaceVars(block.precio || '');
          const cta = replaceVars(block.cta_texto || '');
          const bg = block.color_fondo || '#f8fafc';
          
          blockHtml = `
            <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="background-color: ${bg}; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; font-family: ${estilos.fuente || 'inherit'}; text-align: left;">
                  <div style="font-weight: 700; font-size: 15px; color: #0f172a; margin-bottom: 4px;">${titulo}</div>
                  <div style="font-size: 13px; color: #475569; margin-bottom: 12px; line-height: 1.5;">${desc}</div>
                  <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                    <tr>
                      <td style="font-weight: 700; color: #10b981; font-size: 16px; font-family: ${estilos.fuente || 'inherit'};">${precio}</td>
                      ${cta ? `
                      <td align="right">
                        <a href="#" style="background: ${estilos.color_cabecera || '#0f172a'}; color: #ffffff !important; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block; font-family: ${estilos.fuente || 'inherit'};">${cta}</a>
                      </td>` : ''}
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          `;
        } 
        else if (block.type === 'cta') {
          const text = replaceVars(block.texto || '');
          const url = replaceVars(block.url || '#');
          blockHtml = `
            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0; border-collapse: collapse;">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                    <tr>
                      <td align="center" bgcolor="${estilos.color_cabecera || '#0f172a'}" style="border-radius: 8px;">
                        <a href="${url}" target="_blank" style="display: inline-block; padding: 13px 28px; font-family: ${estilos.fuente || 'inherit'}; font-size: 13px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px; letter-spacing: 0.3px;">${text}</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          `;
        } 
        else if (block.type === 'firma') {
          const firmaText = replaceVars(block.firma_texto || block.texto || '');
          blockHtml = `
            <div style="margin-top: 24px; font-size: 13px; color: #475569; font-family: ${estilos.fuente || 'inherit'}; line-height: 1.6;">
              Atentamente,<br><strong>${firmaText.replace(/\n/g, '<br>')}</strong>
            </div>
          `;
        }
        else if (block.type === 'booking_details') {
          const checkInVal = replaceVars('{{check_in}}');
          const checkOutVal = replaceVars('{{check_out}}');
          const roomVal = replaceVars('{{habitacion}}');
          const totalVal = replaceVars('{{total}}');
          
          blockHtml = `
            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; font-family: ${estilos.fuente || 'inherit'};">
              <tr bgcolor="${estilos.color_cabecera || '#0f172a'}">
                <td colspan="2" style="padding: 12px 16px; color: #ffffff; font-weight: 700; font-size: 14px; font-family: ${estilos.fuente || 'inherit'};">
                  Resumen de la Estadía
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; vertical-align: top; font-family: ${estilos.fuente || 'inherit'};">
                  <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">Check-in</div>
                  <div style="font-size: 13px; font-weight: 600; color: #0f172a;">${checkInVal}</div>
                </td>
                <td width="50%" style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-family: ${estilos.fuente || 'inherit'};">
                  <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">Check-out</div>
                  <div style="font-size: 13px; font-weight: 600; color: #0f172a;">${checkOutVal}</div>
                </td>
              </tr>
              <tr>
                <td style="padding: 14px 16px; border-right: 1px solid #e2e8f0; vertical-align: top; font-family: ${estilos.fuente || 'inherit'};">
                  <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">Habitación</div>
                  <div style="font-size: 13px; font-weight: 600; color: #0f172a;">${roomVal}</div>
                </td>
                <td style="padding: 14px 16px; vertical-align: top; font-family: ${estilos.fuente || 'inherit'};">
                  <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">Monto Estimado</div>
                  <div style="font-size: 15px; font-weight: 700; color: #10b981;">${totalVal}</div>
                </td>
              </tr>
            </table>
          `;
        }
        else if (block.type === 'preparacion_viaje') {
          const checkinTime = block.checkin_time || '3:00 PM';
          const checkoutTime = block.checkout_time || '12:00 PM';
          const extraRules = replaceVars(block.politicas_extras || 'Recuerda presentar tu documento de identidad oficial al ingresar.');
          
          blockHtml = `
            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; border-collapse: collapse; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-family: ${estilos.fuente || 'inherit'};">
              <tr>
                <td style="padding: 18px 20px; text-align: left; vertical-align: top; font-family: ${estilos.fuente || 'inherit'};">
                  <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 8px;">🛎️ Preparando tu Viaje</div>
                  <div style="font-size: 12px; color: #475569; line-height: 1.6;">
                    • <strong>Check-in:</strong> A partir de las ${checkinTime}<br />
                    • <strong>Check-out:</strong> Hasta las ${checkoutTime}<br />
                    • <strong>Mascotas:</strong> No permitidas (excepto animales de servicio)<br />
                    • <strong>Estacionamiento:</strong> Gratis para huéspedes en nuestras instalaciones.<br />
                    • <strong>Políticas:</strong> ${extraRules}
                  </div>
                </td>
              </tr>
            </table>
          `;
        }
        else if (block.type === 'codigo_qr') {
          const bookingIdVar = replaceVars('{{bookingId}}');
          blockHtml = `
            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0; border-collapse: collapse; border: 2px dashed #cbd5e1; border-radius: 12px; font-family: ${estilos.fuente || 'inherit'};">
              <tr>
                <td align="center" style="padding: 24px 16px; vertical-align: top; font-family: ${estilos.fuente || 'inherit'};">
                  <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 6px; font-family: ${estilos.fuente || 'inherit'};">Check-in Express (Código QR)</div>
                  <div style="font-size: 12px; color: #64748b; margin-bottom: 16px; font-family: ${estilos.fuente || 'inherit'};">Muestra este código en recepción al llegar para agilizar tu registro.</div>
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${bookingIdVar}" width="150" height="150" alt="Check-in QR" style="border: 4px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.08); display: block;" />
                  <div style="margin-top: 10px; font-size: 11px; font-weight: 700; color: #4f46e5; letter-spacing: 0.5px; text-transform: uppercase; font-family: ${estilos.fuente || 'inherit'};">ID: ${bookingIdVar}</div>
                </td>
              </tr>
            </table>
          `;
        }
        
        blocksHtml += blockHtml;
      }
    }

    // 2. Si hay bloques, siempre generar el email desde cero para todos los tipos
    if (blocksHtml) {
      // Para cotizaciones: extraer y preservar los botones aceptar/rechazar del template por defecto
      const acceptMatch = html.match(/href="([^"]+)"\s+class="btn-accept"/);
      const rejectMatch = html.match(/href="([^"]+)"\s+class="btn-reject"/);
      let appendHtml = '';
      if (acceptMatch && rejectMatch) {
        const hc = estilos.color_cabecera || '#0f172a';
        appendHtml = `
<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
  <p style="font-weight: 600; font-size: 14px; color: #0f172a; margin: 0 0 4px; font-family: ${estilos.fuente || 'Arial, sans-serif'};">Confirmación de la cotización</p>
  <p style="font-size: 13px; color: #64748b; margin: 0 0 20px; line-height: 1.6; font-family: ${estilos.fuente || 'Arial, sans-serif'};">Revise el documento PDF adjunto y seleccione una opción a continuación.</p>
  <a href="${acceptMatch[1]}" style="display: inline-block; background-color: ${hc}; color: #ffffff !important; text-decoration: none; padding: 13px 28px; border-radius: 6px; font-weight: 600; font-size: 13px; margin: 4px 6px; font-family: ${estilos.fuente || 'Arial, sans-serif'};">Aceptar cotización</a>
  <a href="${rejectMatch[1]}" style="display: inline-block; background-color: #ffffff; color: #475569 !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 13px; margin: 4px 6px; border: 1px solid #cbd5e1; font-family: ${estilos.fuente || 'Arial, sans-serif'};">Rechazar cotización</a>
</div>`;
      }
      return { subject, html: generateEmailFromBlocks(estilos, blocksHtml, variables.hotel || 'Hotel', appendHtml) };
    }

    // 3. Si no hay bloques pero sí cuerpo personalizado, inyectar en template por defecto
    if (customTemplate.cuerpo_personalizado) {
      let customBody = customTemplate.cuerpo_personalizado;
      for (const [k, v] of Object.entries(variables)) {
        customBody = customBody.replace(new RegExp(`{{${k}}}`, 'g'), v);
      }

      if (html.includes('class="msg"')) {
        html = html.replace(/<p class="msg">[\s\S]*?<\/p>/, `<p class="msg">${customBody.replace(/\n/g, '<br>')}</p>`);
      } else if (html.includes('class="greeting"') && html.includes('class="section-label"')) {
        html = html.replace(/<\/div>\s*<p class="section-label">/i, `</div><p class="msg">${customBody.replace(/\n/g, '<br>')}</p><p class="section-label">`);
      }
    }

    // 3. Aplicar estilos personalizados
    if (estilos.color_cabecera) {
      html = html.replace(/background:\s*#0f172a/g, `background: ${estilos.color_cabecera}`);
      html = html.replace(/background-color:\s*#0f172a/g, `background-color: ${estilos.color_cabecera}`);
      html = html.replace(/border-top:\s*5px solid\s*#[0-9a-fA-F]+/g, `border-top: 5px solid ${estilos.color_cabecera}`);
      html = html.replace(/border-top:\s*5px solid\s*#ef4444/g, `border-top: 5px solid ${estilos.color_cabecera}`);
      html = html.replace(/border-top:\s*5px solid\s*#3b82f6/g, `border-top: 5px solid ${estilos.color_cabecera}`);
    }

    if (estilos.fuente) {
      html = html.replace(/font-family:[^;]+/g, `font-family: ${estilos.fuente}`);
    }

    if (estilos.tamano_letra) {
      html = html.replace(/font-size:\s*14px/g, `font-size: ${estilos.tamano_letra}`);
    }

    if (estilos.logo_url) {
      html = html.replace(/<h1>[\s\S]*?<\/h1>/i, `<img src="${estilos.logo_url}" style="max-height: 48px; object-fit: contain; margin-bottom: 8px;" />`);
      html = html.replace(/<h1 class="logo">[\s\S]*?<\/h1>/i, `<img src="${estilos.logo_url}" class="logo" style="max-height: 48px; object-fit: contain;" />`);
    }

    // Solo agregar firma tradicional si no hay un bloque de firma en el diseño actual
    const hasFirmaBlock = Array.isArray(estilos.bloques) && estilos.bloques.some(b => b.type === 'firma');
    if (estilos.firma && !hasFirmaBlock) {
      let customFirma = estilos.firma;
      for (const [k, v] of Object.entries(variables)) {
        customFirma = customFirma.replace(new RegExp(`{{${k}}}`, 'g'), v);
      }
      if (html.includes('Atentamente,')) {
        html = html.replace(/Atentamente,[\s\S]*?<\/p>/, `Atentamente,<br><strong>${customFirma.replace(/\n/g, '<br>')}</strong></p>`);
      } else {
        html = html.replace(/<div class="footer">/i, `<div style="margin-top: 24px; font-size: 13px; color: #475569;">Atentamente,<br><strong>${customFirma.replace(/\n/g, '<br>')}</strong></div><div class="footer">`);
      }
    }
  }

  // En cualquier caso, siempre reemplazar variables básicas en todo el HTML
  for (const [k, v] of Object.entries(variables)) {
    html = html.replace(new RegExp(`{{${k}}}`, 'g'), v);
  }

  return { subject, html };
}

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
  id_hotel?: string;
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
    const formatDate = (dateStr: string) => {
      try {
        if (!dateStr) return '';
        const clean = dateStr.substring(0, 10);
        return new Date(clean).toLocaleDateString('es-ES', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        });
      } catch { return dateStr; }
    };
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('es-HN', { style: 'currency', currency: data.currency || 'HNL' }).format(amount);
    };

    let subject = `Confirmación de Reserva - ${data.hotelName}`;
    let html = getBookingConfirmationTemplate(data);

    if (data.id_hotel) {
      const customTemplate = await getCustomTemplate(data.id_hotel, 'confirmacion');
      if (customTemplate) {
        const compiled = compileCustomTemplate(
          html,
          subject,
          customTemplate,
          {
            huesped: data.guestName,
            hotel: data.hotelName,
            check_in: formatDate(data.checkIn),
            check_out: formatDate(data.checkOut),
            habitacion: data.roomType || 'Habitación',
            total: formatCurrency(data.totalAmount),
            moneda: data.currency || 'HNL',
            bookingId: data.bookingId || '',
          }
        );
        subject = compiled.subject;
        html = compiled.html;
      }
    }

    const { data: responseData, error } = await resend.emails.send({
      from: `${senderName} <reservas@solarys.uk>`,
      to: [data.guestEmail],
      subject,
      html
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
export function getBookingConfirmationTemplate(data: BookingEmailData): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: data.currency || 'HNL'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      const clean = dateStr.substring(0, 10);
      return new Date(clean).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
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
      if (!dateStr) return '';
      const clean = dateStr.substring(0, 10);
      return new Date(clean).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
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

// ─── Invitation & Booking Event Emails ───────────────────────────────────────

export interface InvitationEmailData {
  recipientEmail: string;
  hotelName: string;
  codigoInvitacion: string;
  rolSugerido: string;
  senderName?: string;
}

export async function sendInvitationEmail(data: InvitationEmailData) {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY no configurado. Correo de invitación no enviado.');
    return { success: false };
  }
  if (data.recipientEmail.includes('@partnercentral.local')) return { success: true };
  try {
    const sender = (data.senderName ?? data.hotelName).replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const { data: rd, error } = await resend.emails.send({
      from: `${sender} <notificaciones@solarys.uk>`,
      to: [data.recipientEmail],
      subject: `Invitación para unirte a ${data.hotelName} — Solaris`,
      html: getInvitationTemplate(data),
    });
    if (error) { console.error('Error correo invitación:', error); return { success: false, error }; }
    console.log(`✅ Correo invitación → ${data.recipientEmail}`);
    return { success: true, data: rd };
  } catch (err) { return { success: false, error: err }; }
}

export interface BookingCancelledEmailData {
  guestEmail: string;
  guestName: string;
  bookingId: string;
  checkIn: string;
  checkOut: string;
  hotelName: string;
  roomName?: string;
  totalAmount?: number;
  currency?: string;
  id_hotel?: string;
}

export async function sendBookingCancelledEmail(data: BookingCancelledEmailData) {
  if (!resend) return { success: false };
  if (data.guestEmail.includes('@partnercentral.local')) return { success: true };
  try {
    const sender = data.hotelName.replace(/[^a-zA-Z0-9\s]/g, '').trim();

    let subject = `Reserva cancelada — ${data.hotelName}`;
    let html = getBookingCancelledTemplate(data);

    if (data.id_hotel) {
      const customTemplate = await getCustomTemplate(data.id_hotel, 'cancelacion');
      if (customTemplate) {
        const fmt = (d: string) => {
          try {
            if (!d) return '';
            const clean = d.substring(0, 10);
            return new Date(clean).toLocaleDateString('es-ES', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
            });
          } catch { return d; }
        };
        const curr = (n: number) => new Intl.NumberFormat('es-HN', { style: 'currency', currency: data.currency || 'HNL' }).format(n);

        const compiled = compileCustomTemplate(
          html,
          subject,
          customTemplate,
          {
            huesped: data.guestName,
            hotel: data.hotelName,
            check_in: fmt(data.checkIn),
            check_out: fmt(data.checkOut),
            habitacion: data.roomName || 'Habitación',
            total: data.totalAmount ? curr(data.totalAmount) : '',
            moneda: data.currency || 'HNL',
            bookingId: data.bookingId || '',
          }
        );
        subject = compiled.subject;
        html = compiled.html;
      }
    }

    const { data: rd, error } = await resend.emails.send({
      from: `${sender} <reservas@solarys.uk>`,
      to: [data.guestEmail],
      subject,
      html,
    });
    if (error) { console.error('Error correo cancelación:', error); return { success: false, error }; }
    console.log(`✅ Correo cancelación reserva → ${data.guestEmail}`);
    return { success: true, data: rd };
  } catch (err) { return { success: false, error: err }; }
}

export interface BookingUpdatedEmailData {
  guestEmail: string;
  guestName: string;
  bookingId: string;
  checkIn: string;
  checkOut: string;
  hotelName: string;
  roomName?: string;
  changes: string[];
  id_hotel?: string;
  totalAmount?: number;
  currency?: string;
}

export async function sendBookingUpdatedEmail(data: BookingUpdatedEmailData) {
  if (!resend) return { success: false };
  if (data.guestEmail.includes('@partnercentral.local')) return { success: true };
  try {
    const sender = data.hotelName.replace(/[^a-zA-Z0-9\s]/g, '').trim();

    let subject = `Reserva actualizada — ${data.hotelName}`;
    let html = getBookingUpdatedTemplate(data);

    if (data.id_hotel) {
      const customTemplate = await getCustomTemplate(data.id_hotel, 'actualizacion');
      if (customTemplate) {
        const fmt = (d: string) => {
          try {
            if (!d) return '';
            const clean = d.substring(0, 10);
            return new Date(clean).toLocaleDateString('es-ES', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
            });
          } catch { return d; }
        };
        const curr = (n: number) => new Intl.NumberFormat('es-HN', { style: 'currency', currency: data.currency || 'HNL' }).format(n);

        const compiled = compileCustomTemplate(
          html,
          subject,
          customTemplate,
          {
            huesped: data.guestName,
            hotel: data.hotelName,
            check_in: fmt(data.checkIn),
            check_out: fmt(data.checkOut),
            habitacion: data.roomName || 'Habitación',
            total: data.totalAmount ? curr(data.totalAmount) : '',
            moneda: data.currency || 'HNL',
            bookingId: data.bookingId || '',
          }
        );
        subject = compiled.subject;
        html = compiled.html;
      }
    }

    const { data: rd, error } = await resend.emails.send({
      from: `${sender} <reservas@solarys.uk>`,
      to: [data.guestEmail],
      subject,
      html,
    });
    if (error) { console.error('Error correo actualización reserva:', error); return { success: false, error }; }
    console.log(`✅ Correo actualización reserva → ${data.guestEmail}`);
    return { success: true, data: rd };
  } catch (err) { return { success: false, error: err }; }
}

function rolLabel(rol: string): string {
  const map: Record<string, string> = {
    RECEPCIONISTA: 'Recepcionista',
    ADMIN:         'Administrador',
    CONTADOR:      'Contador',
    MANTENIMIENTO: 'Mantenimiento',
    PROPIETARIO:   'Propietario',
  };
  return map[rol?.toUpperCase()] ?? rol;
}

function getInvitationTemplate(data: InvitationEmailData): string {
  const rolStr = rolLabel(data.rolSugerido);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:Helvetica,Arial,sans-serif;line-height:1.6;color:#1e293b;background:#f1f5f9;margin:0;padding:0}
    .wrap{max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.07);border-top:5px solid #7c3aed}
    .hdr{background:#0f172a;padding:32px 40px;color:#fff}
    .hdr h1{margin:0;font-size:20px;font-weight:700;color:#c4b5fd}
    .hdr p{margin:6px 0 0;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px}
    .body{padding:36px 40px}
    .greeting{font-size:16px;font-weight:600;color:#0f172a;margin:0 0 18px}
    .msg{font-size:14px;color:#475569;line-height:1.7;margin:0 0 24px}
    .code-box{background:#f5f3ff;border:2px dashed #7c3aed;border-radius:10px;padding:24px;text-align:center;margin:24px 0}
    .code-label{font-size:12px;text-transform:uppercase;color:#6d28d9;letter-spacing:1px;font-weight:600;margin-bottom:10px}
    .code{font-size:32px;font-weight:800;letter-spacing:6px;color:#4c1d95;font-family:monospace}
    .details{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:14px;color:#475569}
    .details strong{color:#0f172a}
    .note{font-size:12px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:16px}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center}
    .footer p{color:#94a3b8;font-size:12px;margin:0;line-height:1.7}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>Invitación al equipo</h1><p>${data.hotelName}</p></div>
    <div class="body">
      <p class="greeting">¡Hola!</p>
      <p class="msg">Has sido invitado(a) a unirte al equipo de <strong>${data.hotelName}</strong> en la plataforma Solaris como <strong>${rolStr}</strong>. Para activar tu acceso, usa el código a continuación al registrarte.</p>
      <div class="code-box">
        <div class="code-label">Tu código de invitación</div>
        <div class="code">${data.codigoInvitacion}</div>
      </div>
      <div class="details">
        <strong>Hotel:</strong> ${data.hotelName}<br>
        <strong>Rol asignado:</strong> ${rolStr}
      </div>
      <p class="note">Este código es de un solo uso y tiene una vigencia de 7 días. Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} ${data.hotelName}. Notificación generada por el sistema Solaris.</p></div>
  </div></body></html>`;
}

export function getBookingCancelledTemplate(data: BookingCancelledEmailData): string {
  const fmt = (d: string) => {
    try {
      if (!d) return '';
      const clean = d.substring(0, 10);
      return new Date(clean).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch {
      return d;
    }
  };
  const curr = (n: number) => new Intl.NumberFormat('es-HN', { style: 'currency', currency: data.currency || 'HNL' }).format(n);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:Helvetica,Arial,sans-serif;line-height:1.6;color:#1e293b;background:#f1f5f9;margin:0;padding:0}
    .wrap{max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.07);border-top:5px solid #ef4444}
    .hdr{background:#0f172a;padding:32px 40px;color:#fff}
    .hdr h1{margin:0;font-size:20px;font-weight:700;color:#fca5a5}
    .hdr p{margin:6px 0 0;font-size:13px;color:#94a3b8;letter-spacing:.5px}
    .body{padding:36px 40px}
    .greeting{font-size:16px;font-weight:600;color:#0f172a;margin:0 0 16px}
    .msg{font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px}
    .card-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
    .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px}
    .card-label{font-size:11px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:.5px;margin-bottom:3px}
    .card-value{font-size:14px;font-weight:600;color:#0f172a}
    .alert{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;font-size:13px;color:#991b1b;margin:20px 0}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center}
    .footer p{color:#94a3b8;font-size:12px;margin:0;line-height:1.7}
    @media(max-width:500px){.card-grid{grid-template-columns:1fr}}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>Reserva Cancelada</h1><p>${data.hotelName} · Referencia #${data.bookingId.split('-')[0].toUpperCase()}</p></div>
    <div class="body">
      <p class="greeting">Hola ${data.guestName},</p>
      <p class="msg">Te confirmamos que tu reserva en <strong>${data.hotelName}</strong> ha sido <strong>cancelada</strong>. A continuación el resumen de la reserva afectada.</p>
      <div class="card-grid">
        <div class="card"><div class="card-label">Check-in</div><div class="card-value">${fmt(data.checkIn)}</div></div>
        <div class="card"><div class="card-label">Check-out</div><div class="card-value">${fmt(data.checkOut)}</div></div>
        ${data.roomName ? `<div class="card"><div class="card-label">Habitación</div><div class="card-value">${data.roomName}</div></div>` : ''}
        ${data.totalAmount ? `<div class="card"><div class="card-label">Total</div><div class="card-value">${curr(data.totalAmount)}</div></div>` : ''}
      </div>
      <div class="alert">Si no solicitaste esta cancelación o tienes alguna duda, contáctanos directamente al hotel.</div>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} ${data.hotelName}. Todos los derechos reservados.<br>Este es un mensaje automático del sistema de reservas Solaris.</p></div>
  </div></body></html>`;
}

export function getBookingUpdatedTemplate(data: BookingUpdatedEmailData): string {
  const fmt = (d: string) => {
    try {
      if (!d) return '';
      const clean = d.substring(0, 10);
      return new Date(clean).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch {
      return d;
    }
  };
  const changeItems = data.changes.map(c => `<li style="margin-bottom:6px">✔ ${c}</li>`).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:Helvetica,Arial,sans-serif;line-height:1.6;color:#1e293b;background:#f1f5f9;margin:0;padding:0}
    .wrap{max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.07);border-top:5px solid #3b82f6}
    .hdr{background:#0f172a;padding:32px 40px;color:#fff}
    .hdr h1{margin:0;font-size:20px;font-weight:700;color:#93c5fd}
    .hdr p{margin:6px 0 0;font-size:13px;color:#94a3b8;letter-spacing:.5px}
    .body{padding:36px 40px}
    .greeting{font-size:16px;font-weight:600;color:#0f172a;margin:0 0 16px}
    .msg{font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px}
    .card-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
    .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px}
    .card-label{font-size:11px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:.5px;margin-bottom:3px}
    .card-value{font-size:14px;font-weight:600;color:#0f172a}
    .changes-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:18px 20px;margin:20px 0}
    .changes-title{font-size:13px;font-weight:700;color:#1d4ed8;margin:0 0 10px}
    .changes-list{list-style:none;padding:0;margin:0;color:#1e40af;font-size:14px}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center}
    .footer p{color:#94a3b8;font-size:12px;margin:0;line-height:1.7}
    @media(max-width:500px){.card-grid{grid-template-columns:1fr}}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>Reserva Actualizada</h1><p>${data.hotelName} · Referencia #${data.bookingId.split('-')[0].toUpperCase()}</p></div>
    <div class="body">
      <p class="greeting">Hola ${data.guestName},</p>
      <p class="msg">Tu reserva en <strong>${data.hotelName}</strong> ha sido <strong>actualizada</strong>. A continuación los datos vigentes.</p>
      <div class="card-grid">
        <div class="card"><div class="card-label">Check-in</div><div class="card-value">${fmt(data.checkIn)}</div></div>
        <div class="card"><div class="card-label">Check-out</div><div class="card-value">${fmt(data.checkOut)}</div></div>
        ${data.roomName ? `<div class="card" style="grid-column:span 2"><div class="card-label">Habitación</div><div class="card-value">${data.roomName}</div></div>` : ''}
      </div>
      <div class="changes-box">
        <p class="changes-title">Cambios realizados</p>
        <ul class="changes-list">${changeItems}</ul>
      </div>
      <p style="font-size:13px;color:#64748b">Si tienes alguna pregunta sobre esta modificación, no dudes en contactarnos directamente.</p>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} ${data.hotelName}. Todos los derechos reservados.<br>Este es un mensaje automático del sistema de reservas Solaris.</p></div>
  </div></body></html>`;
}

// ─── Admin Notification Emails ───────────────────────────────────────────────

function moduleTypeLabel(type: string): string {
  const map: Record<string, string> = { hotel: 'Hotel', gym: 'Gimnasio', restaurant: 'Restaurante' };
  return map[type?.toLowerCase()] ?? type;
}

function formatDateEs(dateStr: string): string {
  try {
    if (!dateStr) return '';
    const clean = dateStr.substring(0, 10);
    return new Date(clean).toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'UTC'
    });
  } catch { return dateStr; }
}

export interface ModuleSuspendedEmailData {
  ownerEmail: string;
  ownerName: string;
  moduleType: string;
  moduleName?: string;
}

export async function sendModuleSuspendedEmail(data: ModuleSuspendedEmailData) {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY no configurado. Correo de suspensión no enviado.');
    return { success: false };
  }
  if (data.ownerEmail.includes('@partnercentral.local')) return { success: true };
  try {
    const label = data.moduleName ?? moduleTypeLabel(data.moduleType);
    const { data: rd, error } = await resend.emails.send({
      from: 'Solaris <notificaciones@solarys.uk>',
      to: [data.ownerEmail],
      subject: `Módulo suspendido: ${label} — Solaris`,
      html: getModuleSuspendedTemplate(data),
    });
    if (error) { console.error('Error correo suspensión módulo:', error); return { success: false, error }; }
    console.log(`✅ Correo suspensión módulo → ${data.ownerEmail}`);
    return { success: true, data: rd };
  } catch (err) { return { success: false, error: err }; }
}

export interface SubscriptionNotifEmailData {
  ownerEmail: string;
  ownerName: string;
  planName?: string;
  trialEnd?: string;
  daysLeft?: number;
  reason?: 'cancelada' | 'impaga' | 'inactiva' | 'cuenta_desactivada';
}

export async function sendSubscriptionConfirmationEmail(data: SubscriptionNotifEmailData) {
  if (!resend) return { success: false };
  if (data.ownerEmail.includes('@partnercentral.local')) return { success: true };
  try {
    const { data: rd, error } = await resend.emails.send({
      from: 'Solaris <notificaciones@solarys.uk>',
      to: [data.ownerEmail],
      subject: 'Membresía activada — Solaris',
      html: getSubscriptionConfirmationTemplate(data),
    });
    if (error) { console.error('Error correo confirmación membresía:', error); return { success: false, error }; }
    console.log(`✅ Correo confirmación membresía → ${data.ownerEmail}`);
    return { success: true, data: rd };
  } catch (err) { return { success: false, error: err }; }
}

export async function sendSubscriptionExpiredEmail(data: SubscriptionNotifEmailData) {
  if (!resend) return { success: false };
  if (data.ownerEmail.includes('@partnercentral.local')) return { success: true };
  try {
    const isDeactivated = data.reason === 'cuenta_desactivada';
    const subject = isDeactivated ? 'Cuenta desactivada — Solaris' : 'Membresía cancelada — Solaris';
    const { data: rd, error } = await resend.emails.send({
      from: 'Solaris <notificaciones@solarys.uk>',
      to: [data.ownerEmail],
      subject,
      html: getSubscriptionExpiredTemplate(data),
    });
    if (error) { console.error('Error correo membresía cancelada:', error); return { success: false, error }; }
    console.log(`✅ Correo membresía cancelada → ${data.ownerEmail}`);
    return { success: true, data: rd };
  } catch (err) { return { success: false, error: err }; }
}

export async function sendSubscriptionExpiringEmail(data: SubscriptionNotifEmailData) {
  if (!resend) return { success: false };
  if (data.ownerEmail.includes('@partnercentral.local')) return { success: true };
  try {
    const days = data.daysLeft ?? 0;
    const { data: rd, error } = await resend.emails.send({
      from: 'Solaris <notificaciones@solarys.uk>',
      to: [data.ownerEmail],
      subject: `Tu membresía vence en ${days} día${days === 1 ? '' : 's'} — Solaris`,
      html: getSubscriptionExpiringTemplate(data),
    });
    if (error) { console.error('Error correo membresía por vencer:', error); return { success: false, error }; }
    console.log(`✅ Correo membresía por vencer → ${data.ownerEmail}`);
    return { success: true, data: rd };
  } catch (err) { return { success: false, error: err }; }
}

function getModuleSuspendedTemplate(data: ModuleSuspendedEmailData): string {
  const label = data.moduleName ?? moduleTypeLabel(data.moduleType);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:Helvetica,Arial,sans-serif;line-height:1.6;color:#1e293b;background:#f1f5f9;margin:0;padding:0}
    .wrap{max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.07);border-top:5px solid #f59e0b}
    .hdr{background:#0f172a;padding:32px 40px;color:#fff}
    .hdr h1{margin:0;font-size:20px;font-weight:700;color:#fbbf24}
    .hdr p{margin:6px 0 0;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px}
    .body{padding:36px 40px}
    .greeting{font-size:16px;font-weight:600;color:#0f172a;margin:0 0 18px}
    .card{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:20px 24px;margin:20px 0}
    .card-label{font-size:11px;text-transform:uppercase;color:#92400e;letter-spacing:.7px;font-weight:600;margin-bottom:4px}
    .card-value{font-size:15px;font-weight:700;color:#78350f}
    .msg{font-size:14px;color:#475569;line-height:1.7;margin:20px 0}
    .contact{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;font-size:13px;color:#475569;margin-top:24px}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center}
    .footer p{color:#94a3b8;font-size:12px;margin:0;line-height:1.7}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>Módulo Suspendido</h1><p>Notificación de plataforma Solaris</p></div>
    <div class="body">
      <p class="greeting">Estimado(a) ${data.ownerName},</p>
      <p class="msg">Te informamos que uno de tus módulos ha sido <strong>suspendido temporalmente</strong> por el equipo de administración de Solaris.</p>
      <div class="card">
        <div class="card-label">Módulo afectado</div>
        <div class="card-value">${label}</div>
      </div>
      <p class="msg">Mientras el módulo esté suspendido, tu equipo no podrá acceder a las funciones del mismo. Los datos se conservan íntegros y se restaurarán al reactivar.</p>
      <div class="contact">Si crees que esto es un error o deseas más información, responde a este correo o contáctanos directamente al equipo de soporte de Solaris.</div>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} Solaris Platform. Todos los derechos reservados.<br>Este es un mensaje automático de administración del sistema.</p></div>
  </div></body></html>`;
}

function getSubscriptionConfirmationTemplate(data: SubscriptionNotifEmailData): string {
  const planStr = data.planName ? `Plan <strong>${data.planName}</strong>` : 'tu membresía';
  const endStr = data.trialEnd
    ? `<div class="card"><div class="card-label">Vigencia de prueba hasta</div><div class="card-value">${formatDateEs(data.trialEnd)}</div></div>`
    : '';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:Helvetica,Arial,sans-serif;line-height:1.6;color:#1e293b;background:#f1f5f9;margin:0;padding:0}
    .wrap{max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.07);border-top:5px solid #10b981}
    .hdr{background:#0f172a;padding:32px 40px;color:#fff}
    .hdr h1{margin:0;font-size:20px;font-weight:700;color:#34d399}
    .hdr p{margin:6px 0 0;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px}
    .body{padding:36px 40px}
    .greeting{font-size:16px;font-weight:600;color:#0f172a;margin:0 0 18px}
    .card{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px 24px;margin:20px 0}
    .card-label{font-size:11px;text-transform:uppercase;color:#166534;letter-spacing:.7px;font-weight:600;margin-bottom:4px}
    .card-value{font-size:15px;font-weight:700;color:#15803d}
    .badge{display:inline-block;background:#dcfce7;color:#166534;font-size:13px;font-weight:700;padding:6px 16px;border-radius:20px;margin:4px 0}
    .msg{font-size:14px;color:#475569;line-height:1.7;margin:20px 0}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center}
    .footer p{color:#94a3b8;font-size:12px;margin:0;line-height:1.7}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>Membresía Activada</h1><p>Confirmación de contrato — Solaris</p></div>
    <div class="body">
      <p class="greeting">Estimado(a) ${data.ownerName},</p>
      <p class="msg">Nos complace confirmar que ${planStr} ha sido <span class="badge">✔ Activada</span> exitosamente en la plataforma Solaris.</p>
      <div class="card"><div class="card-label">Estado de membresía</div><div class="card-value">Activa</div></div>
      ${endStr}
      <p class="msg">Ya puedes acceder a todos los módulos y funciones incluidos en tu plan. Si tienes alguna pregunta sobre tu membresía, no dudes en contactarnos.</p>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} Solaris Platform. Todos los derechos reservados.<br>Este es un mensaje automático de administración del sistema.</p></div>
  </div></body></html>`;
}

function getSubscriptionExpiredTemplate(data: SubscriptionNotifEmailData): string {
  const isDeactivated = data.reason === 'cuenta_desactivada';
  const title = isDeactivated ? 'Cuenta Desactivada' : 'Membresía Cancelada';
  const bodyMsg = isDeactivated
    ? `Lamentamos informarte que tu cuenta en Solaris ha sido <strong>desactivada</strong>. Todos tus módulos han sido suspendidos y tu membresía cancelada.`
    : `Te informamos que tu membresía${data.planName ? ` del plan <strong>${data.planName}</strong>` : ''} ha sido <strong>cancelada</strong>${data.reason === 'impaga' ? ' por falta de pago' : ''}.`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:Helvetica,Arial,sans-serif;line-height:1.6;color:#1e293b;background:#f1f5f9;margin:0;padding:0}
    .wrap{max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.07);border-top:5px solid #ef4444}
    .hdr{background:#0f172a;padding:32px 40px;color:#fff}
    .hdr h1{margin:0;font-size:20px;font-weight:700;color:#fca5a5}
    .hdr p{margin:6px 0 0;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px}
    .body{padding:36px 40px}
    .greeting{font-size:16px;font-weight:600;color:#0f172a;margin:0 0 18px}
    .card{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px 24px;margin:20px 0}
    .card-label{font-size:11px;text-transform:uppercase;color:#991b1b;letter-spacing:.7px;font-weight:600;margin-bottom:4px}
    .card-value{font-size:15px;font-weight:700;color:#7f1d1d}
    .msg{font-size:14px;color:#475569;line-height:1.7;margin:20px 0}
    .contact{background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #ef4444;border-radius:6px;padding:16px 20px;font-size:13px;color:#475569;margin-top:24px}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center}
    .footer p{color:#94a3b8;font-size:12px;margin:0;line-height:1.7}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>${title}</h1><p>Notificación de cuenta — Solaris</p></div>
    <div class="body">
      <p class="greeting">Estimado(a) ${data.ownerName},</p>
      <p class="msg">${bodyMsg}</p>
      <div class="card"><div class="card-label">Estado actual</div><div class="card-value">${isDeactivated ? 'Cuenta inactiva' : 'Membresía cancelada'}</div></div>
      <p class="msg">Para reactivar tu cuenta o conocer más sobre nuestros planes, comunícate con el equipo de Solaris.</p>
      <div class="contact">Responde a este correo o contacta directamente al soporte de Solaris para gestionar la reactivación de tu cuenta.</div>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} Solaris Platform. Todos los derechos reservados.<br>Este es un mensaje automático de administración del sistema.</p></div>
  </div></body></html>`;
}

function getSubscriptionExpiringTemplate(data: SubscriptionNotifEmailData): string {
  const days = data.daysLeft ?? 0;
  const endStr = data.trialEnd ? formatDateEs(data.trialEnd) : '';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:Helvetica,Arial,sans-serif;line-height:1.6;color:#1e293b;background:#f1f5f9;margin:0;padding:0}
    .wrap{max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.07);border-top:5px solid #f59e0b}
    .hdr{background:#0f172a;padding:32px 40px;color:#fff}
    .hdr h1{margin:0;font-size:20px;font-weight:700;color:#fbbf24}
    .hdr p{margin:6px 0 0;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px}
    .body{padding:36px 40px}
    .greeting{font-size:16px;font-weight:600;color:#0f172a;margin:0 0 18px}
    .card{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:20px 24px;margin:20px 0}
    .card-label{font-size:11px;text-transform:uppercase;color:#92400e;letter-spacing:.7px;font-weight:600;margin-bottom:4px}
    .card-value{font-size:15px;font-weight:700;color:#78350f}
    .badge{display:inline-block;background:#fef3c7;color:#92400e;font-size:13px;font-weight:700;padding:6px 16px;border-radius:20px;margin:4px 0}
    .msg{font-size:14px;color:#475569;line-height:1.7;margin:20px 0}
    .contact{background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #f59e0b;border-radius:6px;padding:16px 20px;font-size:13px;color:#475569;margin-top:24px}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center}
    .footer p{color:#94a3b8;font-size:12px;margin:0;line-height:1.7}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>Membresía por Vencer</h1><p>Aviso de renovación — Solaris</p></div>
    <div class="body">
      <p class="greeting">Estimado(a) ${data.ownerName},</p>
      <p class="msg">Te avisamos que tu membresía${data.planName ? ` del plan <strong>${data.planName}</strong>` : ''} vencerá próximamente. <span class="badge">⏳ ${days} día${days === 1 ? '' : 's'} restante${days === 1 ? '' : 's'}</span></p>
      ${endStr ? `<div class="card"><div class="card-label">Fecha de vencimiento</div><div class="card-value">${endStr}</div></div>` : ''}
      <p class="msg">Para evitar interrupciones en el servicio, te recomendamos contactar al equipo de Solaris con anticipación para gestionar la renovación de tu membresía.</p>
      <div class="contact">Responde a este correo o contacta directamente al soporte de Solaris para renovar tu plan y mantener tu negocio operando sin interrupciones.</div>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} Solaris Platform. Todos los derechos reservados.<br>Este es un mensaje automático de administración del sistema.</p></div>
  </div></body></html>`;
}

export interface QuoteEmailData {
  guestName: string;
  guestEmail: string;
  quoteNumber: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  currency: string;
  hotelName: string;
  acceptUrl: string;
  rejectUrl: string;
  pdfBase64?: string;
  id_hotel?: string;
}

/**
 * Envía una cotización al correo del cliente usando Resend.
 */
export async function sendQuoteEmail(data: QuoteEmailData) {
  if (!resend) {
    console.warn('⚠️ No se ha configurado RESEND_API_KEY. El correo de cotización no será enviado.');
    return { success: false, error: 'Resend API Key not configured' };
  }

  if (data.guestEmail.includes('@partnercentral.local')) {
    console.log(`Bypass email for placeholder address: ${data.guestEmail}`);
    return { success: true, message: 'Bypassed placeholder email' };
  }

  const senderName = data.hotelName.replace(/[^a-zA-Z0-9\s]/g, '').trim();

  try {
    const formatDate = (dateStr: string) => {
      try {
        if (!dateStr) return '';
        const clean = dateStr.substring(0, 10);
        return new Date(clean).toLocaleDateString('es-ES', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        });
      } catch { return dateStr; }
    };
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('es-HN', { style: 'currency', currency: data.currency || 'HNL' }).format(amount);
    };

    let subject = `Cotización de Hospedaje ${data.quoteNumber} - ${data.hotelName}`;
    let html = getQuoteEmailTemplate(data);

    if (data.id_hotel) {
      const customTemplate = await getCustomTemplate(data.id_hotel, 'cotizacion');
      if (customTemplate) {
        const compiled = compileCustomTemplate(
          html,
          subject,
          customTemplate,
          {
            huesped: data.guestName,
            hotel: data.hotelName,
            check_in: formatDate(data.checkIn),
            check_out: formatDate(data.checkOut),
            habitacion: 'Habitaciones cotizadas',
            total: formatCurrency(data.totalAmount),
            moneda: data.currency || 'HNL'
          }
        );
        subject = compiled.subject;
        html = compiled.html;
      }
    }

    const emailPayload: any = {
      from: `${senderName} <reservas@solarys.uk>`,
      to: [data.guestEmail],
      subject,
      html
    };

    if (data.pdfBase64) {
      const base64Content = data.pdfBase64.includes(';base64,')
        ? data.pdfBase64.split(';base64,')[1]
        : data.pdfBase64;

      emailPayload.attachments = [
        {
          filename: `Cotizacion_${data.quoteNumber}.pdf`,
          content: Buffer.from(base64Content, 'base64')
        }
      ];
    }

    const { data: responseData, error } = await resend.emails.send(emailPayload);
    if (error) {
      console.error('Error enviando correo de cotización con Resend:', error);
      return { success: false, error };
    }

    console.log(`✅ Correo de cotización enviado exitosamente a ${data.guestEmail}`, responseData);
    return { success: true, data: responseData };
  } catch (err) {
    console.error('Exception enviando cotización:', err);
    return { success: false, error: err };
  }
}

/**
 * Plantilla HTML para la cotización.
 */
export function getQuoteEmailTemplate(data: QuoteEmailData): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: data.currency || 'HNL'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      const clean = dateStr.substring(0, 10);
      return new Date(clean).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
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
        color: #ffffff;
        padding: 36px 40px;
        text-align: left;
        border-bottom: 3px solid #1d4ed8;
      }
      .logo {
        font-size: 21px;
        font-weight: 700;
        letter-spacing: 0.3px;
        margin: 0;
        color: #f8fafc;
      }
      .header-subtitle {
        color: #94a3b8;
        font-size: 12px;
        margin-top: 6px;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      .content {
        padding: 40px;
      }
      .greeting {
        font-size: 17px;
        color: #0f172a;
        margin-bottom: 28px;
        font-weight: 600;
      }
      .greeting-sub {
        display: block;
        color: #475569;
        font-weight: 400;
        font-size: 14px;
        margin-top: 6px;
      }
      .section-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #94a3b8;
        font-weight: 600;
        margin: 0 0 12px;
      }
      .details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px;
        margin-bottom: 28px;
        background-color: #e2e8f0;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        overflow: hidden;
      }
      .detail-card {
        background-color: #ffffff;
        padding: 16px 18px;
      }
      .detail-label {
        font-size: 11px;
        text-transform: uppercase;
        color: #94a3b8;
        font-weight: 600;
        letter-spacing: 0.6px;
        margin-bottom: 6px;
      }
      .detail-value {
        font-size: 14px;
        font-weight: 600;
        color: #0f172a;
      }
      .total-row {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-top: 3px solid #1d4ed8;
        padding: 20px 22px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 28px;
        border-radius: 6px;
      }
      .total-label {
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        color: #64748b;
      }
      .total-value {
        font-weight: 700;
        font-size: 22px;
        color: #0f172a;
      }
      .decision-box {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 26px;
        text-align: center;
        margin: 28px 0 10px;
      }
      .decision-title {
        font-weight: 600;
        font-size: 14px;
        color: #0f172a;
        margin: 0 0 4px;
      }
      .decision-sub {
        font-size: 13px;
        color: #64748b;
        margin: 0 0 20px;
        line-height: 1.6;
      }
      .btn-accept {
        display: inline-block;
        background-color: #0f172a;
        color: #ffffff !important;
        text-decoration: none;
        padding: 13px 28px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.3px;
        margin: 4px 6px;
      }
      .btn-reject {
        display: inline-block;
        background-color: #ffffff;
        color: #475569 !important;
        text-decoration: none;
        padding: 12px 28px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.3px;
        margin: 4px 6px;
        border: 1px solid #cbd5e1;
      }
      .attachment-note {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-left: 3px solid #1d4ed8;
        border-radius: 4px;
        padding: 14px 18px;
        margin-bottom: 24px;
        font-size: 13px;
        color: #475569;
      }
      .attachment-note strong {
        color: #0f172a;
      }
      .footer {
        text-align: center;
        padding: 28px;
        background-color: #f8fafc;
        border-top: 1px solid #e2e8f0;
      }
      .footer-text {
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.7;
        margin: 0;
      }
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
        <div class="header-subtitle">Cotización N.&deg; ${data.quoteNumber}</div>
      </div>
      <div class="content">
        <div class="greeting">
          Estimado(a) ${data.guestName}:
          <span class="greeting-sub">A continuación encontrará el detalle de la cotización de hospedaje solicitada.</span>
        </div>

        <p class="section-label">Periodo de estadía</p>
        <div class="details-grid">
          <div class="detail-card">
            <div class="detail-label">Check-in</div>
            <div class="detail-value">${formatDate(data.checkIn)}</div>
          </div>
          <div class="detail-card">
            <div class="detail-label">Check-out</div>
            <div class="detail-value">${formatDate(data.checkOut)}</div>
          </div>
        </div>

        <div class="total-row">
          <span class="total-label"> Monto estimado    </span>
          <span class="total-value">${formatCurrency(data.totalAmount)}</span>
        </div>

        ${data.pdfBase64 ? `
        <div class="attachment-note">
          Adjuntamos el documento de la cotización en formato <strong>PDF</strong> con el desglose completo. Le recomendamos conservarlo como referencia.
        </div>
        ` : ''}

        <div class="decision-box">
          <p class="decision-title">Confirmación de la cotización</p>
          <p class="decision-sub">Revise el documento PDF adjunto con el detalle completo y seleccione una opción a continuación. Su decisión quedará registrada de inmediato, sin necesidad de crear una cuenta.</p>
          <a href="${data.acceptUrl}" class="btn-accept">Aceptar cotización</a>
          <a href="${data.rejectUrl}" class="btn-reject">Rechazar cotización</a>
        </div>
      </div>

      <div class="footer">
        <p class="footer-text">
          Esta cotización tiene una vigencia limitada y no constituye una reserva garantizada hasta la confirmación del pago correspondiente.<br>
          &copy; ${new Date().getFullYear()} ${data.hotelName}. Todos los derechos reservados.<br>
          Notificación generada por el sistema de gestión Solaris.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;
}

export interface CustomEmailData {
  to: string;
  subject: string;
  html: string;
  hotelName: string;
}

export async function sendCustomEmail(data: CustomEmailData) {
  if (!resend) {
    console.warn('⚠️ No se ha configurado RESEND_API_KEY. El correo personalizado no será enviado.');
    return { success: false, error: 'Resend API key not configured' };
  }
  // Bypass placeholder emails
  if (data.to.includes('@partnercentral.local')) {
    console.log(`Bypass email for placeholder address: ${data.to}`);
    return { success: true, data: { bypass: true } };
  }
  try {
    const senderName = data.hotelName.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Solaris';
    const { data: responseData, error } = await resend.emails.send({
      from: `${senderName} <reservas@solarys.uk>`,
      to: [data.to],
      subject: data.subject,
      html: data.html
    });

    if (error) {
      console.error('Error enviando correo personalizado con Resend:', error);
      return { success: false, error };
    }
    console.log(`✅ Correo personalizado enviado exitosamente a ${data.to}`);
    return { success: true, data: responseData };
  } catch (err) {
    console.error('Exception enviando correo personalizado:', err);
    return { success: false, error: err };
  }
}
