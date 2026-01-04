const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner user ID is required'],
      index: true,
    },
    tenantId: {
      type: String,
      default: 'default',
      index: true,
    },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'ready', 'failed'],
      default: 'uploaded',
      required: true,
    },
    sensitivity: {
      type: String,
      enum: ['unknown', 'safe', 'flagged'],
      default: 'unknown',
      required: true,
    },
    originalFilename: {
      type: String,
      required: [true, 'Original filename is required'],
    },
    storedFilename: {
      type: String,
      required: [true, 'Stored filename is required'],
      unique: true,
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size must be positive'],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      validate: {
        validator (v) {
          // Validate video MIME types
          const allowedTypes = [
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo',
            'video/x-matroska',
            'video/webm',
          ];
          return allowedTypes.includes(v);
        },
        message: 'Invalid video MIME type',
      },
    },
    duration: {
      type: Number, // in seconds
      min: [0, 'Duration must be positive'],
    },
    resolution: {
      width: Number,
      height: Number,
    },
    codec: {
      type: String, // Video codec (e.g., h264, vp9)
    },
    format: {
      type: String, // Container format (e.g., mp4, webm)
    },
    thumbnailFilename: {
      type: String, // Generated thumbnail filename
    },
    sensitivityFlags: {
      type: [String], // Array of flags from sensitivity analysis
      default: [],
    },
    processingError: {
      type: String, // Error message if processing failed
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  },
);

// Compound index for tenant-based queries
videoSchema.index({ tenantId: 1, ownerUserId: 1 });
videoSchema.index({ tenantId: 1, status: 1 });
videoSchema.index({ tenantId: 1, sensitivity: 1 });

// Virtual for formatted file size
videoSchema.virtual('fileSizeFormatted').get(function () {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (this.fileSize === 0) return '0 Bytes';
  const i = Math.floor(Math.log(this.fileSize) / Math.log(1024));
  return Math.round(this.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Virtual for formatted duration
videoSchema.virtual('durationFormatted').get(function () {
  if (!this.duration) return 'Unknown';
  const minutes = Math.floor(this.duration / 60);
  const seconds = Math.floor(this.duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Method to check if user can access this video
videoSchema.methods.canAccess = function (userId, userRole) {
  // Owner can always access
  if (this.ownerUserId.toString() === userId.toString()) {
    return true;
  }
  // Admin can access all
  if (userRole === 'admin') {
    return true;
  }
  // For now, viewers and editors can only access their own videos
  // Future: implement sharing/permissions
  return false;
};

// Method to check if user can edit this video
videoSchema.methods.canEdit = function (userId, userRole) {
  // Only owner or admin can edit
  return (
    this.ownerUserId.toString() === userId.toString() || userRole === 'admin'
  );
};

// Static method to find videos by owner
videoSchema.statics.findByOwner = function (userId, tenantId = 'default') {
  return this.find({ ownerUserId: userId, tenantId });
};

// Static method to find videos by status
videoSchema.statics.findByStatus = function (status, tenantId = 'default') {
  return this.find({ status, tenantId });
};

// Ensure virtuals are included in JSON
videoSchema.set('toJSON', {
  virtuals: true,
  transform (_doc, ret) {
    // Remove internal fields
    delete ret.__v;
    return ret;
  },
});

const Video = mongoose.model('Video', videoSchema);

module.exports = Video;
