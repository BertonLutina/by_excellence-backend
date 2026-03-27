const nodemailer = require('nodemailer');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false') === 'true';
const SMTP_FROM = process.env.SMTP_FROM || '';

const hasSmtpCredentials = () =>
  Boolean(SMTP_USER && SMTP_PASS);

const transporter = hasSmtpCredentials()
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

const sendMail = async ({ to, subject, html }) => {
  if (!transporter) {
    console.warn('[Mail] SMTP_USER/SMTP_PASS not set — skipping send. Set them in .env to enable email.');
    return;
  }
  const from = SMTP_FROM || `"By Excellence" <${SMTP_USER}>`;
  await transporter.sendMail({ from, to, subject, html });
};

module.exports = { sendMail };
