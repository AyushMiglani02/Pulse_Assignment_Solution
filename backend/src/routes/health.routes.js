const express = require('express');
const { getHealthStatus } = require('../controllers/health.controller');

const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    Get API health status
 * @access  Public
 */
router.get('/', getHealthStatus);

module.exports = router;
