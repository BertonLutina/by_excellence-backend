const nodemailer = require('nodemailer');

const hasSmtpCredentials = () =>
  Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = hasSmtpCredentials()
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

const sendMail = async ({ to, subject, html }) => {
  if (!transporter) {
    console.warn('[Mail] SMTP_USER/SMTP_PASS not set — skipping send. Set them in .env to enable email.');
    return;
  }
  const from = process.env.SMTP_FROM || `"By Excellence" <${process.env.SMTP_USER}>`;
  await transporter.sendMail({ from, to, subject, html });
};

module.exports = { sendMail };
