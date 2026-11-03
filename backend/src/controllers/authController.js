const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { generateAdminToken } = require('../middleware/auth');

async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.'
      });
    }

    const result = await query('SELECT id, username, password_hash FROM admins WHERE username = $1', [username.trim()]);
    if (result.rows.length === 0) {
      // Timing attack protection: run dummy bcrypt compare
      await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr');
      return res.status(401).json({
        success: false,
        error: 'Invalid administrator credentials.'
      });
    }

    const admin = result.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid administrator credentials.'
      });
    }

    const token = generateAdminToken(admin);

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    });
  } catch (err) {
    console.error('[AUTH CONTROLLER] Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during login.'
    });
  }
}

async function getProfile(req, res) {
  try {
    return res.json({
      success: true,
      admin: {
        id: req.admin.id,
        username: req.admin.username
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile.'
    });
  }
}

async function updatePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required.'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long.'
      });
    }

    const adminResult = await query('SELECT id, password_hash FROM admins WHERE id = $1', [req.admin.id]);
    if (adminResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Administrator not found.' });
    }

    const admin = adminResult.rows[0];
    const isMatch = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Incorrect current password.' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, req.admin.id]);

    return res.json({
      success: true,
      message: 'Password successfully updated.'
    });
  } catch (err) {
    console.error('[AUTH CONTROLLER] Password update error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update administrator password.'
    });
  }
}

module.exports = {
  login,
  getProfile,
  updatePassword
};
