/**
 * Test SMTP config quickly.
 *
 * Usage:
 *   npm run mail:test
 *   npm run mail:test -- your@email.com
 *
 * Optional env:
 *   TEST_MAIL_TO=your@email.com npm run mail:test
 */
const nodemailer = require('nodemailer');
const {
  SMTP_USER,
  SMTP_PASS,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_FROM,
} = require('../../constants/constant');

function getRecipient() {
  const argvRecipient = process.argv[2];
  const envRecipient = process.env.TEST_MAIL_TO;
  return (argvRecipient || envRecipient || '').trim();
}

async function main() {
  if (!SMTP_USER || !SMTP_PASS) {
    console.error('Missing SMTP credentials. Set SMTP_USER and SMTP_PASS in your .env file.');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  console.log(`Checking SMTP connection to ${SMTP_HOST}:${SMTP_PORT} (secure=${SMTP_SECURE})...`);
  await transporter.verify();
  console.log('SMTP verification successful.');

  const to = getRecipient();
  if (!to) {
    console.log('No recipient provided; verification only.');
    console.log('To send a test email, run: npm run mail:test -- your@email.com');
    return;
  }

  const from = SMTP_FROM || `"By Excellence" <${SMTP_USER}>`;
  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Nodemailer test',
    text: `SMTP test successful at ${new Date().toISOString()}`,
    html: `<p>SMTP test successful at <strong>${new Date().toISOString()}</strong></p>`,
  });

  console.log(`Email sent. Message ID: ${info.messageId}`);
  if (Array.isArray(info.accepted) && info.accepted.length) {
    console.log(`Accepted by: ${info.accepted.join(', ')}`);
  }
  if (Array.isArray(info.rejected) && info.rejected.length) {
    console.log(`Rejected by: ${info.rejected.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('Nodemailer test failed:', err.message);
  process.exit(1);
});
