const express = require('express');
const router = express.Router();
const videoController = require('../controllers/video.controller');
const { authenticate, authorize, authenticateStream } = require('../middleware/auth');
const { upload, handleMulterError } = require('../middleware/upload');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');

/**
 * @route   POST /api/videos/upload
 * @desc    Upload a new video
 * @access  Private (editor, admin)
 */
router.post(
  '/upload',
  authenticate,
  authorize('editor', 'admin'),
  upload.single('video'),
  handleMulterError,
  [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 200 })
      .withMessage('Title cannot exceed 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Description cannot exceed 2000 characters'),
  ],
  validate,
  videoController.uploadVideo,
);

/**
 * @route   GET /api/videos
 * @desc    Get all videos for current user
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  [
    query('status')
      .optional()
      .isIn(['uploaded', 'processing', 'ready', 'failed'])
      .withMessage('Invalid status value'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('skip')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Skip must be a non-negative integer'),
  ],
  validate,
  videoController.getUserVideos,
);

/**
 * @route   GET /api/videos/:id
 * @desc    Get a single video by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isMongoId().withMessage('Invalid video ID')],
  validate,
  videoController.getVideoById,
);

/**
 * @route   PATCH /api/videos/:id
 * @desc    Update video metadata
 * @access  Private (owner or admin)
 */
router.patch(
  '/:id',
  authenticate,
  [
    param('id').isMongoId().withMessage('Invalid video ID'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Title cannot be empty')
      .isLength({ max: 200 })
      .withMessage('Title cannot exceed 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Description cannot exceed 2000 characters'),
    body('status')
      .optional()
      .isIn(['uploaded', 'processing', 'ready', 'failed'])
      .withMessage('Invalid status value'),
    body('sensitivity')
      .optional()
      .isIn(['unknown', 'safe', 'flagged'])
      .withMessage('Invalid sensitivity value'),
  ],
  validate,
  videoController.updateVideo,
);

/**
 * @route   DELETE /api/videos/:id
 * @desc    Delete a video
 * @access  Private (owner or admin)
 */
router.delete(
  '/:id',
  authenticate,
  [param('id').isMongoId().withMessage('Invalid video ID')],
  validate,
  videoController.deleteVideo,
);

/**
 * @route   POST /api/videos/:id/assign
 * @desc    Assign video to viewer(s)
 * @access  Private (editor for own videos, admin for all)
 */
router.post(
  '/:id/assign',
  authenticate,
  authorize('editor', 'admin'),
  [
    param('id').isMongoId().withMessage('Invalid video ID'),
    body('userIds')
      .isArray({ min: 1 })
      .withMessage('userIds must be a non-empty array'),
    body('userIds.*')
      .isMongoId()
      .withMessage('Each userId must be a valid MongoDB ID'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('expiresAt must be a valid ISO 8601 date'),
  ],
  validate,
  videoController.assignVideo,
);

/**
 * @route   DELETE /api/videos/:id/assign/:userId
 * @desc    Revoke video access from a viewer
 * @access  Private (editor for own videos, admin for all)
 */
router.delete(
  '/:id/assign/:userId',
  authenticate,
  authorize('editor', 'admin'),
  [
    param('id').isMongoId().withMessage('Invalid video ID'),
    param('userId').isMongoId().withMessage('Invalid user ID'),
  ],
  validate,
  videoController.unassignVideo,
);

/**
 * @route   GET /api/videos/:id/assignments
 * @desc    Get all assignments for a video
 * @access  Private (editor for own videos, admin for all)
 */
router.get(
  '/:id/assignments',
  authenticate,
  authorize('editor', 'admin'),
  [param('id').isMongoId().withMessage('Invalid video ID')],
  validate,
  videoController.getVideoAssignments,
);

/**
 * @route   GET /api/videos/:id/stream
 * @desc    Stream a video with HTTP Range support
 * @access  Private (must have access to video)
 */
router.get(
  '/:id/stream',
  authenticateStream,
  [param('id').isMongoId().withMessage('Invalid video ID')],
  validate,
  videoController.streamVideo,
);

module.exports = router;
