const { sendMail, isMailConfigured } = require('../utils/mailer');
const {
  CONTACT_INBOX_EMAIL,
  SMTP_USER,
} = require('../../constants/constant');

const inbox = () => (CONTACT_INBOX_EMAIL || SMTP_USER || '').trim();

const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

exports.getContactInfo = (req, res) => {
  const contactEmail = inbox() || null;
  res.json({
    contactEmail,
    formEnabled: isMailConfigured() && Boolean(contactEmail),
  });
};

exports.postContact = async (req, res) => {
  const to = inbox();
  if (!isMailConfigured() || !to) {
    return res.status(503).json({
      error: 'CONTACT_UNAVAILABLE',
      message: 'Contact form is not available.',
    });
  }

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!name || name.length > 120) {
    return res.status(400).json({ error: 'Invalid name' });
  }
  if (!emailOk(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (subject.length > 200) {
    return res.status(400).json({ error: 'Invalid subject' });
  }
  if (message.length < 10 || message.length > 8000) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  const subj = subject
    ? `[By Excellence — Contact] ${subject}`
    : `[By Excellence — Contact] Message de ${name}`;

  const html = `
    <p><strong>Nom</strong> ${escapeHtml(name)}</p>
    <p><strong>Email</strong> ${escapeHtml(email)}</p>
    <p><strong>Message</strong></p>
    <pre style="white-space:pre-wrap;font-family:sans-serif;">${escapeHtml(message)}</pre>
  `;

  try {
    await sendMail({
      to,
      subject: subj,
      html,
      replyTo: email,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Contact]', err);
    res.status(500).json({ error: 'Send failed' });
  }
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
