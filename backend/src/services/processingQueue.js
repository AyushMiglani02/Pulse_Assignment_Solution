const EventEmitter = require('events');
const { processVideo } = require('./videoProcessing');
const Video = require('../models/Video');
const path = require('path');
const { emitProcessingProgress, emitProcessingStatus, emitProcessingError } = require('../socket');

/**
 * Simple in-memory queue for video processing
 * In production, this should be replaced with Redis Queue, Bull, or similar
 */
class VideoProcessingQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.processing = new Set();
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_PROCESSING || '2', 10);
    this.isRunning = false;
    this.uploadsDir = path.join(__dirname, '../../uploads');
    this.io = null; // Socket.io instance
  }

  /**
   * Set Socket.io instance for real-time updates
   * @param {Object} io - Socket.io server instance
   */
  setSocketIO(io) {
    this.io = io;
    console.log('Socket.io instance attached to processing queue');
  }

  /**
   * Add a video to the processing queue
   * @param {String} videoId - Video document ID
   */
  enqueue(videoId) {
    if (!this.queue.includes(videoId) && !this.processing.has(videoId)) {
      this.queue.push(videoId);
      this.emit('enqueued', videoId);
      console.log(`Video ${videoId} enqueued for processing`);

      // Start processing if not already running
      if (!this.isRunning) {
        this.start();
      }
    }
  }

  /**
   * Start the queue processor
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit('started');
    console.log('Video processing queue started');

    // Process jobs continuously
    this.processNext();
  }

  /**
   * Stop the queue processor
   */
  stop() {
    this.isRunning = false;
    this.emit('stopped');
    console.log('Video processing queue stopped');
  }

  /**
   * Process next job in queue
   */
  async processNext() {
    if (!this.isRunning) return;

    // Check if we can process more
    if (this.processing.size >= this.maxConcurrent) {
      // Check again after a delay
      setTimeout(() => this.processNext(), 1000);
      return;
    }

    // Get next job
    const videoId = this.queue.shift();

    if (!videoId) {
      // Queue empty, check again after a delay
      setTimeout(() => this.processNext(), 1000);
      return;
    }

    // Mark as processing
    this.processing.add(videoId);
    this.emit('processing', videoId);

    try {
      await this.processJob(videoId);
    } catch (error) {
      console.error(`Error processing video ${videoId}:`, error);
    } finally {
      // Remove from processing set
      this.processing.delete(videoId);
      this.emit('completed', videoId);

      // Process next immediately
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Process a single video job
   * @param {String} videoId - Video document ID
   */
  async processJob(videoId) {
    console.log(`Processing video ${videoId}...`);

    try {
      // Get video from database
      const video = await Video.findById(videoId);

      if (!video) {
        console.error(`Video ${videoId} not found in database`);
        return;
      }

      const userId = video.ownerUserId.toString();

      // Update status to processing
      video.status = 'processing';
      await video.save();

      // Emit status change to user
      emitProcessingStatus(this.io, userId, videoId, 'processing');

      // Emit initial progress
      emitProcessingProgress(this.io, userId, videoId, 0);

      // Process the video (simulating progress updates)
      // In real implementation, processVideo would emit progress internally
      emitProcessingProgress(this.io, userId, videoId, 25);

      const result = await processVideo(video, this.uploadsDir);

      emitProcessingProgress(this.io, userId, videoId, 75);

      if (result.success) {
        // Update video with processing results
        video.duration = result.metadata.duration;
        video.resolution = result.metadata.resolution;
        video.codec = result.metadata.codec;
        video.format = result.metadata.format;
        video.thumbnailFilename = result.thumbnail;
        video.sensitivity = result.sensitivity;
        video.sensitivityFlags = result.sensitivityFlags;
        video.status = 'ready';

        await video.save();

        // Emit completion progress
        emitProcessingProgress(this.io, userId, videoId, 100);

        // Emit final status with sensitivity info
        emitProcessingStatus(
          this.io,
          userId,
          videoId,
          'ready',
          result.sensitivity,
          result.sensitivityFlags,
        );

        console.log(`Video ${videoId} processed successfully`);
        this.emit('success', videoId, result);
      } else {
        // Processing failed
        video.status = 'failed';
        video.processingError = result.error;
        await video.save();

        // Emit error to user
        emitProcessingError(this.io, userId, videoId, result.error);
        emitProcessingStatus(this.io, userId, videoId, 'failed');

        console.error(`Video ${videoId} processing failed:`, result.error);
        this.emit('failed', videoId, result.error);
      }
    } catch (error) {
      console.error(`Fatal error processing video ${videoId}:`, error);

      // Try to update video status
      try {
        const video = await Video.findById(videoId);
        if (video) {
          video.status = 'failed';
          video.processingError = error.message;
          await video.save();

          // Emit error to user
          const userId = video.ownerUserId.toString();
          emitProcessingError(this.io, userId, videoId, error.message);
          emitProcessingStatus(this.io, userId, videoId, 'failed');
        }
      } catch (updateError) {
        console.error(`Failed to update video status:`, updateError);
      }

      this.emit('error', videoId, error);
    }
  }

  /**
   * Get queue statistics
   * @returns {Object} - Queue stats
   */
  getStats() {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      maxConcurrent: this.maxConcurrent,
      isRunning: this.isRunning,
    };
  }

  /**
   * Clear the queue (for testing)
   */
  clear() {
    this.queue = [];
    this.processing.clear();
    this.emit('cleared');
  }
}

// Create singleton instance
const processingQueue = new VideoProcessingQueue();

// Auto-start queue in non-test environments
if (process.env.NODE_ENV !== 'test') {
  processingQueue.start();
}

module.exports = processingQueue;
