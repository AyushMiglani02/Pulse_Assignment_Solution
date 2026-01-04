const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

/**
 * Initialize Socket.io server with authentication
 * @param {Object} httpServer - HTTP server instance
 * @returns {Object} - Socket.io server instance
 */
function initializeSocket(httpServer) {
  // Support multiple origins for CORS
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user info to socket
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      socket.tenantId = decoded.tenantId;

      console.log(`Socket authenticated for user: ${socket.userId}`);
      next();
    } catch (error) {
      console.error('Socket authentication failed:', error.message);
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userRoom = `user:${userId}`;

    // Join user-specific room
    socket.join(userRoom);
    console.log(`User ${userId} joined room: ${userRoom}`);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected from room: ${userRoom}`);
    });

    // Optional: Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${userId}:`, error);
    });
  });

  return io;
}

/**
 * Emit processing progress event to user
 * @param {Object} io - Socket.io server instance
 * @param {String} userId - User ID
 * @param {String} videoId - Video ID
 * @param {Number} percent - Progress percentage (0-100)
 */
function emitProcessingProgress(io, userId, videoId, percent) {
  if (!io) {
    console.warn('Socket.io not initialized, skipping progress emission');
    return;
  }

  const userRoom = `user:${userId}`;
  const payload = {
    videoId,
    percent: Math.round(percent),
    timestamp: new Date().toISOString(),
  };

  io.to(userRoom).emit('processing:progress', payload);
  console.log(`Emitted progress to ${userRoom}:`, payload);
}

/**
 * Emit processing status change event to user
 * @param {Object} io - Socket.io server instance
 * @param {String} userId - User ID
 * @param {String} videoId - Video ID
 * @param {String} status - Video status (uploaded, processing, ready, failed)
 * @param {String} sensitivity - Sensitivity level (safe, unknown, flagged)
 * @param {Array} sensitivityFlags - Array of sensitivity flags
 */
function emitProcessingStatus(io, userId, videoId, status, sensitivity = null, sensitivityFlags = []) {
  if (!io) {
    console.warn('Socket.io not initialized, skipping status emission');
    return;
  }

  const userRoom = `user:${userId}`;
  const payload = {
    videoId,
    status,
    sensitivity,
    sensitivityFlags,
    timestamp: new Date().toISOString(),
  };

  io.to(userRoom).emit('processing:status', payload);
  console.log(`Emitted status to ${userRoom}:`, payload);
}

/**
 * Emit processing error event to user
 * @param {Object} io - Socket.io server instance
 * @param {String} userId - User ID
 * @param {String} videoId - Video ID
 * @param {String} error - Error message
 */
function emitProcessingError(io, userId, videoId, error) {
  if (!io) {
    console.warn('Socket.io not initialized, skipping error emission');
    return;
  }

  const userRoom = `user:${userId}`;
  const payload = {
    videoId,
    error,
    timestamp: new Date().toISOString(),
  };

  io.to(userRoom).emit('processing:error', payload);
  console.log(`Emitted error to ${userRoom}:`, payload);
}

module.exports = {
  initializeSocket,
  emitProcessingProgress,
  emitProcessingStatus,
  emitProcessingError,
};
