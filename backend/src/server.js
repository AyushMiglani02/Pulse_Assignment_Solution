require('dotenv').config();
const app = require('./app');
const { connectDatabase } = require('./config/database');
const { initializeSocket } = require('./socket');
const processingQueue = require('./services/processingQueue');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Start server
    const server = app.listen(PORT, () => {
      console.info(`🚀 Server running on port ${PORT}`);
      console.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.info(`🔗 API: http://localhost:${PORT}/api`);
    });

    // Initialize Socket.io
    const io = initializeSocket(server);
    app.set('io', io); // Make io accessible to routes/services
    
    // Attach Socket.io to processing queue for real-time updates
    processingQueue.setSocketIO(io);
    
    console.info(`🔌 Socket.io initialized`);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.info('SIGTERM received, shutting down gracefully');
      io.close(); // Close socket connections
      server.close(() => {
        console.info('Process terminated');
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
