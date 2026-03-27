const BRAND_COLOR = '#0a0a5c';
const ACCENT = '#d4a848';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

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

module.exports = { verificationEmail, resetPasswordEmail };
