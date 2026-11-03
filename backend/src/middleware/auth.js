const jwt = require('jsonwebtoken');
const { getAdminById } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'minecraft_portal_dev_jwt_secret_change_in_production';

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

    const admin = getAdminById(decoded.adminId);
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Administrator account no longer exists.'
      });
    }

    req.admin = {
      id: admin.id,
      username: admin.username
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
    { expiresIn: '7d' }
  );
}

module.exports = {
  requireAdminAuth,
  generateAdminToken
};
