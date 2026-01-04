const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { AppError } = require('../middleware/errorHandler');

/**
 * Register a new user
 * @route POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return next(new AppError('User with this email already exists', 400));
    }

    // Validate role if provided
    if (role && !['viewer', 'editor', 'admin'].includes(role)) {
      return next(new AppError('Invalid role specified', 400));
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'viewer', // Default to viewer if no role specified
    });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return next(new AppError(messages.join(', '), 400));
    }
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // Find user and include password
    const user = await User.findByEmail(email).select('+password');

    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AppError('Account is deactivated', 403));
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Generate token
    const token = generateToken(user);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 * @route GET /api/auth/me
 */
const getCurrentUser = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          tenantId: req.user.tenantId,
          createdAt: req.user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 * @route POST /api/auth/refresh
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: refreshTokenFromBody } = req.body;

    if (!refreshTokenFromBody) {
      return next(new AppError('Refresh token is required', 400));
    }

    // Verify refresh token
    const { verifyToken, generateToken } = require('../utils/jwt');
    let decoded;
    try {
      decoded = verifyToken(refreshTokenFromBody);
    } catch (error) {
      return next(new AppError('Invalid or expired refresh token', 401));
    }

    // Check if it's a refresh token
    if (decoded.type !== 'refresh') {
      return next(new AppError('Invalid token type', 401));
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return next(new AppError('User not found or inactive', 401));
    }

    // Generate new access token
    const newAccessToken = generateToken(user);

    res.status(200).json({
      success: true,
      data: {
        token: newAccessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search users
 * @route GET /api/auth/users
 * Only accessible by editors and admins
 */
const searchUsers = async (req, res, next) => {
  try {
    const { email, role } = req.query;

    const query = { isActive: true };

    if (email) {
      query.email = { $regex: email, $options: 'i' };
    }

    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('_id name email role createdAt')
      .limit(20)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        users,
        count: users.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  refreshToken,
  searchUsers,
};
