const Provider = require('../models/Provider');
const User = require('../models/User');
const { sendMail } = require('../utils/mailer');
const { FRONTEND_ORIGIN } = require('../../constants/constant');

/**
 * Email the provider asking them to complete VAT / BCE on their account.
 * @returns {{ ok: true, emailed: boolean } | { ok: false, code: number, error: string }}
 */
async function sendProviderVatReminder(providerId) {
  const provider = await Provider.findById(providerId);
  if (!provider) return { ok: false, code: 404, error: 'Provider not found' };

  const user = provider.user_id ? await User.findById(provider.user_id) : null;
  if (!user?.email) return { ok: false, code: 400, error: 'Provider has no email' };

  const missing = [];
  if (!String(provider.vat_number || '').trim()) missing.push('numéro de TVA');
  if (!String(provider.siret || '').trim()) missing.push('numéro BCE/KBO');
  if (missing.length === 0) {
    return { ok: false, code: 400, error: 'Provider already has VAT and BCE numbers' };
  }

  const settingsUrl = `${String(FRONTEND_ORIGIN || '').replace(/\/$/, '')}/providersettings`;
  const name = provider.display_name || user.full_name || 'Prestataire';
  const missingLabel = missing.join(' et ');

  await sendMail({
    to: user.email,
    subject: 'By Excellence AS — Complétez votre numéro de TVA / BCE',
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#323232;line-height:1.5">
        <p>Bonjour ${name},</p>
        <p>
          Votre profil By Excellence AS est enregistré, mais il manque encore votre
          <strong>${missingLabel}</strong>.
        </p>
        <p>
          Sans ces informations, votre compte <strong>ne peut pas être activé</strong>
          et vous ne pouvez pas encore prester via la plateforme.
        </p>
        <p>
          Merci de les renseigner dans vos paramètres&nbsp;:
          <a href="${settingsUrl}">${settingsUrl}</a>
        </p>
        <p style="color:#6b6b6b;font-size:12px">By Excellence AS — Nieuwstraat 19, 9552 Borsbeke (Herzele)</p>
      </div>
    `,
  });

  return { ok: true, emailed: true, missing };
}

module.exports = { sendProviderVatReminder };
