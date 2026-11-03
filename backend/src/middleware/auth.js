const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'minecraft_portal_dev_jwt_secret_change_in_production';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.warn('[SECURITY WARNING] In production, JWT_SECRET should be a strong random secret with at least 32 characters.');
}

async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication token is required.'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or expired session token.'
      });
    }

    // Verify admin still exists in database
    const adminResult = await query('SELECT id, username, created_at FROM admins WHERE id = $1', [decoded.adminId]);
    if (adminResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Administrator account no longer exists.'
      });
    }

    req.admin = {
      id: adminResult.rows[0].id,
      username: adminResult.rows[0].username
    };

    next();
  } catch (err) {
    console.error('[AUTH] Error verifying admin auth:', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication verification failure.'
    });
  }
}

function generateAdminToken(admin) {
  return jwt.sign(
    {
      adminId: admin.id,
      username: admin.username
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = {
  requireAdminAuth,
  generateAdminToken
};
