const { APP_URL } = require('../../constants/constant');
const BRAND_COLOR = '#0a0a5c';
const ACCENT = '#d4a848';

const base = (content) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>By Excellence</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="width:40px;height:40px;background:rgba(255,255,255,.15);border-radius:10px;display:inline-block;text-align:center;line-height:40px;">
                <span style="color:#fff;font-weight:700;font-size:16px;">BE</span>
              </div>
              <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-.3px;margin-left:10px;">By Excellence</span>
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fb;padding:24px 40px;border-top:1px solid #eef0f3;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} By Excellence African Services — Tous droits réservés</p>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">Si vous n'avez pas effectué cette action, ignorez cet email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const btn = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;margin:24px 0;">${label}</a>`;

const h1 = (text) => `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${BRAND_COLOR};">${text}</h1>`;
const p = (text) => `<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">${text}</p>`;

const verificationEmail = ({ full_name, token }) => {
  const link = `${APP_URL}/VerifyEmail?token=${token}`;
  return base(`
    ${h1('Vérifiez votre adresse email')}
    ${p(`Bonjour ${full_name || 'là'}, bienvenue sur By Excellence !`)}
    ${p('Cliquez sur le bouton ci-dessous pour vérifier votre adresse email et activer votre compte. Ce lien est valable <strong>24 heures</strong>.')}
    <div style="text-align:center;">${btn(link, 'Vérifier mon email')}</div>
    ${p(`Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/><a href="${link}" style="color:${ACCENT};word-break:break-all;">${link}</a>`)}
  `);
};

const resetPasswordEmail = ({ full_name, token }) => {
  const link = `${APP_URL}/ResetPassword?token=${token}`;
  return base(`
    ${h1('Réinitialisation de mot de passe')}
    ${p(`Bonjour ${full_name || 'là'},`)}
    ${p('Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.')}
    <div style="text-align:center;">${btn(link, 'Réinitialiser mon mot de passe')}</div>
    ${p(`Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/><a href="${link}" style="color:${ACCENT};word-break:break-all;">${link}</a>`)}
    ${p('Si vous n\'avez pas fait cette demande, ignorez cet email. Votre mot de passe ne sera pas modifié.')}
  `);
};

const AUTO_CLIENT_I18N = {
  fr: {
    title: 'Votre compte client a été créé',
    greeting: (name) => `Bonjour ${name || 'là'},`,
    intro:
      'Suite à votre demande de service sur By Excellence, un compte client a été créé automatiquement afin de suivre vos demandes et paiements.',
    emailLabel: 'Email',
    passwordLabel: 'Mot de passe temporaire',
    cta: 'Se connecter',
    security: 'Pour votre sécurité, changez ce mot de passe dès votre première connexion.',
    fallback: 'Si le bouton ne fonctionne pas, copiez ce lien :',
  },
  en: {
    title: 'Your client account has been created',
    greeting: (name) => `Hello ${name || 'there'},`,
    intro:
      'Following your service request on By Excellence, a client account was created automatically so you can track your requests and payments.',
    emailLabel: 'Email',
    passwordLabel: 'Temporary password',
    cta: 'Sign in',
    security: 'For your security, please change this password after your first login.',
    fallback: 'If the button does not work, copy this link:',
  },
  nl: {
    title: 'Uw klantaccount is aangemaakt',
    greeting: (name) => `Hallo ${name || 'daar'},`,
    intro:
      'Naar aanleiding van uw serviceaanvraag op By Excellence is automatisch een klantaccount aangemaakt zodat u uw aanvragen en betalingen kunt volgen.',
    emailLabel: 'E-mail',
    passwordLabel: 'Tijdelijk wachtwoord',
    cta: 'Inloggen',
    security: 'Voor uw veiligheid moet u dit wachtwoord wijzigen na uw eerste login.',
    fallback: 'Als de knop niet werkt, kopieer dan deze link:',
  },
};

const autoClientAccountEmail = ({ full_name, email, temp_password, locale = 'fr' }) => {
  const lang = AUTO_CLIENT_I18N[locale] ? locale : 'fr';
  const txt = AUTO_CLIENT_I18N[lang];
  const loginLink = `${APP_URL}/#/login`;
  return base(`
    ${h1(txt.title)}
    ${p(txt.greeting(full_name))}
    ${p(txt.intro)}
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:8px 0 18px;">
      <p style="margin:0 0 6px;font-size:14px;color:#111827;"><strong>${txt.emailLabel}:</strong> ${email}</p>
      <p style="margin:0;font-size:14px;color:#111827;"><strong>${txt.passwordLabel}:</strong> ${temp_password}</p>
    </div>
    <div style="text-align:center;">${btn(loginLink, txt.cta)}</div>
    ${p(txt.security)}
    ${p(`${txt.fallback}<br/><a href="${loginLink}" style="color:${ACCENT};word-break:break-all;">${loginLink}</a>`)}
  `);
};

module.exports = { verificationEmail, resetPasswordEmail, autoClientAccountEmail };
