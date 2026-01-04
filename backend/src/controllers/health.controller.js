const mongoose = require('mongoose');

/**
 * Health check controller
 * Returns the current status of the API and database connection
 */
const getHealthStatus = async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    const healthData = {
      success: true,
      data: {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        database: {
          status: dbStatus,
          name: mongoose.connection.name || 'N/A',
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
      },
    };

    res.status(200).json(healthData);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Service unavailable',
      details: error.message,
    });
  }
};

module.exports = {
  getHealthStatus,
};
