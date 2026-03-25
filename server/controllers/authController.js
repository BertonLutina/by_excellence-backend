const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendMail } = require('../utils/mailer');
const { verificationEmail, resetPasswordEmail } = require('../utils/emailTemplates');
const Client = require('../models/Client');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');

const ID_TO_ROLE = { 1: 'client', 2: 'provider', 3: 'admin' };
const roleString = (user) => (user && user.role != null ? ID_TO_ROLE[user.role] ?? String(user.role) : undefined);

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: roleString(user), full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

exports.register = async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const existing = await User.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password_hash, full_name, role });

    // Send verification email (non-blocking)
    sendMail({
      to: email,
      subject: 'Vérifiez votre adresse email — By Excellence',
      html: verificationEmail({ full_name, token: user.verification_token }),
    }).catch((err) => console.error('[Mail] verification send failed:', err.message));

    const { verification_token, ...safeUser } = user;
    safeUser.role = roleString(user);
    const token = signToken(safeUser);
    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await User.findByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const client = await Client.findByUserId(user.id);
    const provider = await Provider.findByUserId(user.id);
    const admin = await Admin.findByUserId(user.id);


    const safeUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role_id: user.role,
      role: roleString(user),
      is_email_verified: !!user.is_email_verified
    };

    if (client) {
      safeUser.client = client;
    }
    if (provider) {
      safeUser.provider = provider;
    }
    if (admin) {
      safeUser.admin = admin;
    }

    const token = signToken(safeUser);
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ...user, role: roleString(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const user = await User.findByVerificationToken(token);
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification token' });
    if (user.is_email_verified) return res.json({ message: 'Email already verified' });
    await User.setEmailVerified(user.id);
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = await User.findByEmail(email);
    if (!user) return res.json({ message: 'If that email exists, a verification link has been sent.' });
    if (user.is_email_verified) return res.status(400).json({ error: 'Email already verified' });
    const token = await User.setNewVerificationToken(user.id);
    sendMail({
      to: email,
      subject: 'Vérifiez votre adresse email — By Excellence',
      html: verificationEmail({ full_name: user.full_name, token }),
    }).catch((err) => console.error('[Mail] resend failed:', err.message));
    res.json({ message: 'Verification email sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = await User.findByEmail(email);
    // Always return success to avoid user enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });
    const token = await User.setResetToken(user.id);
    sendMail({
      to: email,
      subject: 'Réinitialisation de mot de passe — By Excellence',
      html: resetPasswordEmail({ full_name: user.full_name, token }),
    }).catch((err) => console.error('[Mail] reset send failed:', err.message));
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'Token and new password required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const user = await User.findByResetToken(token);
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });
    const hash = await bcrypt.hash(new_password, 10);
    await User.updatePassword(user.id, hash);
    await User.clearResetToken(user.id);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
    const user = await User.findByEmail(req.user.email);
    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const hash = await bcrypt.hash(new_password, 10);
    await User.updatePassword(req.user.id, hash);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
