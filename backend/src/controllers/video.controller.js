const Video = require('../models/Video');
const VideoAssignment = require('../models/VideoAssignment');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const processingQueue = require('../services/processingQueue');
const fs = require('fs').promises;
const path = require('path');

/**
 * Upload a new video
 * POST /api/videos/upload
 * Requires authentication and editor/admin role
 */
exports.uploadVideo = async (req, res, next) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return next(new AppError('No video file provided', 400));
    }

    // Extract metadata from request body
    const { title, description } = req.body;

    // Validate required fields
    if (!title || title.trim().length === 0) {
      return next(new AppError('Title is required', 400));
    }

    // Create video record
    const video = await Video.create({
      title: title.trim(),
      description: description ? description.trim() : undefined,
      ownerUserId: req.user._id,
      tenantId: req.user.tenantId || 'default',
      status: 'uploaded',
      sensitivity: 'unknown',
      originalFilename: req.file.originalname,
      storedFilename: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    // Enqueue video for processing
    processingQueue.enqueue(video._id.toString());

    res.status(201).json({
      success: true,
      data: {
        video: {
          _id: video._id,
          title: video.title,
          description: video.description,
          status: video.status,
          sensitivity: video.sensitivity,
          originalFilename: video.originalFilename,
          fileSize: video.fileSize,
          fileSizeFormatted: video.fileSizeFormatted,
          mimeType: video.mimeType,
          createdAt: video.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all videos for current user
 * GET /api/videos
 * Requires authentication
 * 
 * Role-based filtering:
 * - Viewer: Only sees videos assigned to them
 * - Editor: Only sees their own uploaded videos
 * - Admin: Sees all videos in the system
 */
exports.getUserVideos = async (req, res, next) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const userRole = req.user.role;

    let videos;
    let total;

    if (userRole === 'viewer') {
      // Viewers only see videos assigned to them
      const assignments = await VideoAssignment.find({
        userId: req.user._id,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      }).select('videoId');

      const videoIds = assignments.map(a => a.videoId);

      const query = { _id: { $in: videoIds } };
      if (status) {
        query.status = status;
      }

      videos = await Video.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .select('-__v');

      total = await Video.countDocuments(query);

    } else if (userRole === 'editor') {
      // Editors only see their own videos
      const query = {
        ownerUserId: req.user._id,
      };

      if (status) {
        query.status = status;
      }

      videos = await Video.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .select('-__v');

      total = await Video.countDocuments(query);

    } else if (userRole === 'admin') {
      // Admins see all videos across all users
      const query = {};

      if (status) {
        query.status = status;
      }

      videos = await Video.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .select('-__v')
        .populate('ownerUserId', 'name email role');

      total = await Video.countDocuments(query);

    } else {
      return next(new AppError('Invalid user role', 403));
    }

    res.json({
      success: true,
      data: {
        videos,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: skip + videos.length < total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single video by ID
 * GET /api/videos/:id
 * Requires authentication
 * 
 * Authorization:
 * - Viewer: Can only access if video is assigned to them
 * - Editor: Can only access their own videos
 * - Admin: Can access any video
 */
exports.getVideoById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id).select('-__v').populate('ownerUserId', 'name email role');

    if (!video) {
      return next(new AppError('Video not found', 404));
    }

    const userRole = req.user.role;
    const userId = req.user._id.toString();
    const ownerId = video.ownerUserId._id.toString();

    // Check authorization based on role
    if (userRole === 'viewer') {
      // Viewers can only access assigned videos
      const assignment = await VideoAssignment.findOne({
        videoId: id,
        userId: req.user._id,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      });

      if (!assignment) {
        return next(new AppError('You do not have permission to access this video', 403));
      }
    } else if (userRole === 'editor') {
      // Editors can only access their own videos
      if (ownerId !== userId) {
        return next(new AppError('You do not have permission to access this video', 403));
      }
    }
    // Admins can access any video (no check needed)

    res.json({
      success: true,
      data: { video },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update video metadata
 * PATCH /api/videos/:id
 * Requires authentication
 * 
 * Authorization:
 * - Viewer: Cannot update any videos
 * - Editor: Can only update their own videos
 * - Admin: Can update any video
 */
exports.updateVideo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, status, sensitivity } = req.body;

    const video = await Video.findById(id);

    if (!video) {
      return next(new AppError('Video not found', 404));
    }

    const userRole = req.user.role;
    const userId = req.user._id.toString();
    const ownerId = video.ownerUserId.toString();

    // Check authorization
    if (userRole === 'viewer') {
      return next(new AppError('Viewers cannot update videos', 403));
    } else if (userRole === 'editor') {
      if (ownerId !== userId) {
        return next(new AppError('You can only update your own videos', 403));
      }
    }
    // Admins can update any video

    // Update fields
    if (title !== undefined) video.title = title;
    if (description !== undefined) video.description = description;
    if (status !== undefined) video.status = status;
    if (sensitivity !== undefined) video.sensitivity = sensitivity;

    await video.save();

    res.json({
      success: true,
      data: { video },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a video
 * DELETE /api/videos/:id
 * Requires authentication
 * 
 * Authorization:
 * - Viewer: Cannot delete any videos
 * - Editor: Can only delete their own videos
 * - Admin: Can delete any video
 */
exports.deleteVideo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id);

    if (!video) {
      return next(new AppError('Video not found', 404));
    }

    const userRole = req.user.role;
    const userId = req.user._id.toString();
    const ownerId = video.ownerUserId.toString();

    // Check authorization
    if (userRole === 'viewer') {
      return next(new AppError('Viewers cannot delete videos', 403));
    } else if (userRole === 'editor') {
      if (ownerId !== userId) {
        return next(new AppError('You can only delete your own videos', 403));
      }
    }
    // Admins can delete any video

    // Delete video file
    const videoPath = path.join(__dirname, '../../uploads/videos', video.storedFilename);
    try {
      await fs.unlink(videoPath);
    } catch (err) {
      console.error('Error deleting video file:', err);
    }

    // Delete thumbnail if exists
    if (video.thumbnailPath) {
      try {
        await fs.unlink(video.thumbnailPath);
      } catch (err) {
        console.error('Error deleting thumbnail:', err);
      }
    }

    // Delete video assignments
    await VideoAssignment.deleteMany({ videoId: id });

    // Delete video document
    await video.deleteOne();

    res.json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign video to viewers
 * POST /api/videos/:id/assign
 * Requires authentication (editor/admin)
 * 
 * Authorization:
 * - Editor: Can only assign their own videos
 * - Admin: Can assign any video
 */
exports.assignVideo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userIds, expiresAt } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return next(new AppError('Please provide at least one user ID', 400));
    }

    const video = await Video.findById(id);
    if (!video) {
      return next(new AppError('Video not found', 404));
    }

    const userRole = req.user.role;
    const userId = req.user._id.toString();
    const ownerId = video.ownerUserId.toString();

    // Check authorization
    if (userRole === 'editor' && ownerId !== userId) {
      return next(new AppError('You can only assign your own videos', 403));
    }

    // Verify all users are viewers
    const users = await User.find({ _id: { $in: userIds } });
    if (users.length !== userIds.length) {
      return next(new AppError('One or more users not found', 404));
    }

    const nonViewers = users.filter(u => u.role !== 'viewer');
    if (nonViewers.length > 0) {
      return next(new AppError('You can only assign videos to users with viewer role', 400));
    }

    // Create assignments
    const assignments = [];
    for (const viewerId of userIds) {
      try {
        const assignment = await VideoAssignment.findOneAndUpdate(
          { videoId: id, userId: viewerId },
          {
            videoId: id,
            userId: viewerId,
            assignedBy: req.user._id,
            assignedAt: new Date(),
            expiresAt: expiresAt || null,
          },
          { upsert: true, new: true }
        ).populate('userId', 'name email');
        assignments.push(assignment);
      } catch (error) {
        // Skip if duplicate
        if (error.code !== 11000) {
          throw error;
        }
      }
    }

    res.json({
      success: true,
      message: `Video assigned to ${assignments.length} viewer(s)`,
      data: { assignments },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke video access from a viewer
 * DELETE /api/videos/:id/assign/:userId
 * Requires authentication (editor/admin)
 */
exports.unassignVideo = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    const video = await Video.findById(id);
    if (!video) {
      return next(new AppError('Video not found', 404));
    }

    const userRole = req.user.role;
    const currentUserId = req.user._id.toString();
    const ownerId = video.ownerUserId.toString();

    // Check authorization
    if (userRole === 'editor' && ownerId !== currentUserId) {
      return next(new AppError('You can only unassign your own videos', 403));
    }

    const assignment = await VideoAssignment.findOneAndDelete({
      videoId: id,
      userId,
    });

    if (!assignment) {
      return next(new AppError('Assignment not found', 404));
    }

    res.json({
      success: true,
      message: 'Video access revoked successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all assignments for a video
 * GET /api/videos/:id/assignments
 * Requires authentication (editor/admin)
 */
exports.getVideoAssignments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id);
    if (!video) {
      return next(new AppError('Video not found', 404));
    }

    const userRole = req.user.role;
    const userId = req.user._id.toString();
    const ownerId = video.ownerUserId.toString();

    // Check authorization
    if (userRole === 'editor' && ownerId !== userId) {
      return next(new AppError('You can only view assignments for your own videos', 403));
    }

    const assignments = await VideoAssignment.find({
      videoId: id,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    })
      .populate('userId', 'name email')
      .populate('assignedBy', 'name email')
      .sort({ assignedAt: -1 });

    res.json({
      success: true,
      data: { assignments },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Stream a video with HTTP Range support
 * GET /api/videos/:id/stream
 * Requires authentication and proper permissions
 * 
 * Authorization:
 * - Viewer: Can only stream assigned videos
 * - Editor: Can only stream their own videos
 * - Admin: Can stream any video
 */
exports.streamVideo = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find video
    const video = await Video.findById(id);

    if (!video) {
      return next(new AppError('Video not found', 404));
    }

    const userRole = req.user.role;
    const userId = req.user._id.toString();
    const ownerId = video.ownerUserId.toString();

    // Check authorization based on role
    if (userRole === 'viewer') {
      // Viewers can only stream assigned videos
      const assignment = await VideoAssignment.findOne({
        videoId: id,
        userId: req.user._id,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      });

      if (!assignment) {
        return next(new AppError('You do not have permission to stream this video', 403));
      }
    } else if (userRole === 'editor') {
      // Editors can only stream their own videos
      if (ownerId !== userId) {
        return next(new AppError('You do not have permission to stream this video', 403));
      }
    }
    // Admins can stream any video (no check needed)

    // Check if video is ready for streaming
    if (video.status !== 'ready') {
      return next(new AppError(`Video is not ready for streaming (status: ${video.status})`, 400));
    }

    // Get video file path
    const videoPath = path.join(
      __dirname,
      '../../uploads/videos',
      video.storedFilename,
    );

    // Check if file exists
    let stat;
    try {
      stat = await fs.stat(videoPath);
    } catch (err) {
      console.error('Error reading video file:', err);
      return next(new AppError('Video file not found', 404));
    }

    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Parse Range header (e.g., "bytes=0-1023")
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validate range
      if (start >= fileSize || end >= fileSize) {
        res.status(416).set({
          'Content-Range': `bytes */${fileSize}`,
        });
        return res.end();
      }

      const chunksize = end - start + 1;

      // Create read stream for partial content
      const readStream = require('fs').createReadStream(videoPath, { start, end });

      // Set headers for partial content
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': video.mimeType || 'video/mp4',
      });

      // Pipe the stream to response
      readStream.pipe(res);
    } else {
      // No range requested, stream entire file
      res.status(200).set({
        'Content-Length': fileSize,
        'Content-Type': video.mimeType || 'video/mp4',
        'Accept-Ranges': 'bytes',
      });

      // Create read stream for entire file
      const readStream = require('fs').createReadStream(videoPath);
      readStream.pipe(res);
    }
  } catch (error) {
    next(error);
  }
};
