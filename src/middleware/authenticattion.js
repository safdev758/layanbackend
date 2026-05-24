const jwt = require('jsonwebtoken');
const { AppDataSource } = require('../config/data-source');
const { User } = require('../entities/User');

function isPartnerRole(role) {
  return role === 'SUPERMARKET' || role === 'DRIVER';
}

async function loadAndValidateUser(decoded) {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { id: decoded.id } });

  if (!user) {
    const err = new Error('User not found');
    err.status = 401;
    throw err;
  }

  if (user.role !== 'ADMIN') {
    if (user.phone && !user.phoneVerified) {
      const err = new Error('Phone verification required');
      err.status = 403;
      err.requiresPhoneVerification = true;
      throw err;
    }

    if (isPartnerRole(user.role) && user.status !== 'ACTIVE') {
      const err = new Error(
        'Your account is not activated yet. Please contact support to activate your account.'
      );
      err.status = 403;
      err.requiresAdminActivation = true;
      err.statusCode = user.status;
      throw err;
    }

    if (user.status === 'SUSPENDED') {
      const until = user.suspendedUntil ? new Date(user.suspendedUntil) : null;
      const now = new Date();
      if (until && until > now) {
        const err = new Error('Account disabled');
        err.status = 403;
        throw err;
      }
    }
  }

  return user;
}

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  const secret = process.env.SECRET_KEY;
  if (!secret) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });

    loadAndValidateUser(decoded)
      .then((user) => {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          status: user.status,
        };
        req.userRecord = user;
        req.token = token;
        next();
      })
      .catch((error) => {
        const status = error.status || 500;
        res.status(status).json({
          message: error.message || 'Authentication failed',
          requiresPhoneVerification: Boolean(error.requiresPhoneVerification),
          requiresAdminActivation: Boolean(error.requiresAdminActivation),
          accountStatus: error.statusCode || undefined,
        });
      });
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required roles: ${roles.join(', ')}`,
      });
    }

    next();
  };
}

function requireOwnershipOrAdmin(resourceUserIdField = 'userId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role === 'ADMIN') {
      return next();
    }

    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    if (req.user.id === resourceUserId) {
      return next();
    }

    return res.status(403).json({ message: 'Access denied. You can only access your own resources.' });
  };
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  const secret = process.env.SECRET_KEY;
  if (!secret) {
    req.user = null;
    return next();
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      req.user = null;
      return next();
    }

    loadAndValidateUser(decoded)
      .then((user) => {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          status: user.status,
        };
        req.userRecord = user;
        next();
      })
      .catch(() => {
        req.user = null;
        next();
      });
  });
}

module.exports = {
  verifyToken,
  requireRole,
  requireOwnershipOrAdmin,
  optionalAuth,
};
