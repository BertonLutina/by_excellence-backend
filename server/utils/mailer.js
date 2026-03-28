const nodemailer = require('nodemailer');
const {
  SMTP_USER,
  SMTP_PASS,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_FROM,
} = require('../../constants/constant');

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
