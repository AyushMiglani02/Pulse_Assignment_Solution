const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const videoRoutes = require('./video.routes');

const router = express.Router();

// Health check routes
router.use('/health', healthRoutes);

// Authentication routes
router.use('/auth', authRoutes);

// Video routes
router.use('/videos', videoRoutes);

module.exports = router;
