const ServiceRequest = require('../models/ServiceRequest');
const Provider = require('../models/Provider');
const User = require('../models/User');
const { sendMail } = require('../utils/mailer');
const { FRONTEND_ORIGIN } = require('../../constants/constant');

const STATUS_CONFIG = {
  request_sent: { label: "Demande reçue", emoji: '📩', client: true, provider: true, admin: false },
  in_review: { label: "Demande en cours d'examen", emoji: '🔍', client: true, provider: false, admin: false },
  offer_preparation: { label: 'Offre en préparation', emoji: '✍️', client: true, provider: true, admin: false },
  offer_sent: { label: 'Offre envoyée', emoji: '📨', client: true, provider: false, admin: false },
  offer_accepted: { label: 'Offre acceptée par le client', emoji: '✅', client: true, provider: true, admin: true },
  deposit_paid: { label: 'Acompte reçu', emoji: '💳', client: true, provider: true, admin: true },
  date_confirmed: { label: 'Date de prestation confirmée', emoji: '📅', client: true, provider: true, admin: false },
  final_payment_pending: { label: 'Solde final à régler', emoji: '⏳', client: true, provider: false, admin: false },
  completed: { label: 'Prestation terminée', emoji: '🎉', client: true, provider: true, admin: true },
  cancelled: { label: 'Demande annulée', emoji: '❌', client: true, provider: true, admin: true },
};

const emailTemplate = (title, body, ctaUrl, ctaLabel) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #3d4263; padding: 28px 32px; text-align: center;">
      <h1 style="color: #d4a848; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 1px;">By Excellence</h1>
      <p style="color: #ffffff80; margin: 4px 0 0; font-size: 13px;">African Services</p>
    </div>
    <div style="padding: 32px; color: #333; font-size: 15px; line-height: 1.7;">
      <h2 style="color: #3d4263; font-size: 18px; margin-top: 0;">${title}</h2>
      ${body}
      ${
        ctaUrl
          ? `
        <div style="text-align: center; margin-top: 28px;">
          <a href="${ctaUrl}" style="background: #d4a848; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            ${ctaLabel || 'Voir les détails'}
          </a>
        </div>
      `
          : ''
      }
    </div>
    <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #999;">
      Notification automatique · By Excellence African Services
    </div>
  </div>
`;

/**
 * @param {{ request_id: string|number, new_status: string }} input
 */
async function sendStatusNotification(input) {
  const { request_id, new_status } = input;
  if (!request_id || !new_status) {
    return { ok: false, code: 400, error: 'Missing request_id or new_status' };
  }

  const cfg = STATUS_CONFIG[new_status];
  if (!cfg) {
    return { ok: false, code: 400, error: 'Unknown status' };
  }

  const request = await ServiceRequest.findById(request_id);
  if (!request) {
    return { ok: false, code: 404, error: 'Request not found' };
  }

  let providerEmail = null;
  if (request.provider_id) {
    const provider = await Provider.findById(request.provider_id);
    if (provider?.user_id) {
      const u = await User.findById(provider.user_id);
      providerEmail = u?.email || null;
    }
  }

  const admins = await User.findAll({ role: 'admin' });
  const appUrl = FRONTEND_ORIGIN.replace(/\/$/, '');
  const title = `${cfg.emoji} ${cfg.label}`;
  const emailsSent = [];
  const shortId = String(request_id).slice(-6);

  if (cfg.client && request.client_email) {
    const body = `
        <p>Bonjour <strong>${request.client_name || 'Client'}</strong>,</p>
        <p>Le statut de votre demande de prestation avec <strong>${request.provider_name || 'le prestataire'}</strong> vient d'être mis à jour :</p>
        <div style="background: #f0f4ff; border-left: 4px solid #3d4263; padding: 14px 18px; border-radius: 8px; margin: 20px 0;">
          <strong style="font-size: 16px;">${cfg.emoji} ${cfg.label}</strong>
        </div>
        <p style="color: #666; font-size: 13px;">Connectez-vous à votre espace client pour plus de détails.</p>
      `;
    await sendMail({
      to: request.client_email,
      subject: `[By Excellence] ${title} — demande #${shortId}`,
      html: emailTemplate(
        title,
        body,
        `${appUrl}/ClientRequestDetail?id=${request_id}`,
        'Voir ma demande'
      ),
    });
    emailsSent.push({ role: 'client', email: request.client_email });
  }

  if (cfg.provider && providerEmail) {
    const body = `
        <p>Bonjour,</p>
        <p>La demande de <strong>${request.client_name || 'votre client'}</strong> a un nouveau statut :</p>
        <div style="background: #f0f4ff; border-left: 4px solid #3d4263; padding: 14px 18px; border-radius: 8px; margin: 20px 0;">
          <strong style="font-size: 16px;">${cfg.emoji} ${cfg.label}</strong>
        </div>
      `;
    await sendMail({
      to: providerEmail,
      subject: `[By Excellence] ${title} — client ${request.client_name}`,
      html: emailTemplate(title, body, `${appUrl}/ProviderDashboard`, 'Voir mes demandes'),
    });
    emailsSent.push({ role: 'provider', email: providerEmail });
  }

  if (cfg.admin && admins.length > 0) {
    for (const admin of admins) {
      if (!admin.email) continue;
      const body = `
          <p>Bonjour <strong>${admin.full_name || 'Admin'}</strong>,</p>
          <p>La demande <strong>#${shortId}</strong> (${request.client_name} / ${request.provider_name}) a changé de statut :</p>
          <div style="background: #f0f4ff; border-left: 4px solid #3d4263; padding: 14px 18px; border-radius: 8px; margin: 20px 0;">
            <strong style="font-size: 16px;">${cfg.emoji} ${cfg.label}</strong>
          </div>
        `;
      await sendMail({
        to: admin.email,
        subject: `[By Excellence Admin] ${title} — #${shortId}`,
        html: emailTemplate(
          title,
          body,
          `${appUrl}/AdminRequestDetail?id=${request_id}`,
          'Voir la demande'
        ),
      });
      emailsSent.push({ role: 'admin', email: admin.email });
    }
  }

  return { ok: true, success: true, emails_sent: emailsSent };
}

module.exports = { sendStatusNotification, STATUS_CONFIG };
