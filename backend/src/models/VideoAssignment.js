const mongoose = require('mongoose');

/**
 * VideoAssignment Schema
 * Tracks which videos are assigned/shared with which viewers
 */
const videoAssignmentSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate assignments
videoAssignmentSchema.index({ videoId: 1, userId: 1 }, { unique: true });

// Instance method to check if assignment is expired
videoAssignmentSchema.methods.isExpired = function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// Static method to get all videos assigned to a user
videoAssignmentSchema.statics.getAssignedVideos = async function (userId) {
  const assignments = await this.find({
    userId,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).populate('videoId');

  return assignments.map(a => a.videoId).filter(v => v !== null);
};

// Static method to get all users assigned to a video
videoAssignmentSchema.statics.getAssignedUsers = async function (videoId) {
  const assignments = await this.find({
    videoId,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).populate('userId', 'name email');

  return assignments.map(a => a.userId).filter(u => u !== null);
};

const VideoAssignment = mongoose.model('VideoAssignment', videoAssignmentSchema);

module.exports = VideoAssignment;
