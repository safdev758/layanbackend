const jwt = require('jsonwebtoken');
const { AppDataSource } = require('../config/data-source');

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

    req.user = decoded;
    req.token = token; // Capture token for logout
    next();
  });
}

// Role-based access control middleware
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required roles: ${roles.join(', ')}` 
      });
    }

    next();
  };
}

// Check if user owns resource or has admin role
function requireOwnershipOrAdmin(resourceUserIdField = 'userId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Admin can access everything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    if (req.user.id === resourceUserId) {
      return next();
    }

    return res.status(403).json({ message: 'Access denied. You can only access your own resources.' });
  };
}

// Optional authentication - doesn't fail if no token
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
    } else {
      req.user = decoded;
    }
    next();
  });
}

module.exports = {
  verifyToken,
  requireRole,
  requireOwnershipOrAdmin,
  optionalAuth
};