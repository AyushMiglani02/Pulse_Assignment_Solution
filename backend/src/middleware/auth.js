const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const { AppError } = require('./errorHandler');

/**
 * Authentication middleware - verifies JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('No token provided, authorization denied', 401));
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (!user.isActive) {
      return next(new AppError('User account is deactivated', 403));
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.message === 'Invalid or expired token') {
      return next(new AppError('Invalid or expired token', 401));
    }
    next(new AppError('Authentication failed', 401));
  }
};

/**
 * RBAC middleware - checks if user has required role
 * @param {...String} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(`Access denied. Required role: ${roles.join(' or ')}`, 403)
      );
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id).select('-password');

      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // Silently fail for optional auth
  }

  next();
};

/**
 * Stream authentication - accepts token from Authorization header or query parameter
 * Used for video streaming since HTML5 video element can't send custom headers
 */
const authenticateStream = async (req, res, next) => {
  try {
    let token = null;

    // Try to get token from Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // If no header token, try query parameter
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return next(new AppError('No token provided, authorization denied', 401));
    }

    // Verify token
    const decoded = verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (!user.isActive) {
      return next(new AppError('User account is deactivated', 403));
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.message === 'Invalid or expired token') {
      return next(new AppError('Invalid or expired token', 401));
    }
    next(new AppError('Authentication failed', 401));
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  authenticateStream,
};
