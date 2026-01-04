const processingQueue = require('../src/services/processingQueue');
const { processVideo } = require('../src/services/videoProcessing');
const Video = require('../src/models/Video');

// Mock the processVideo function
jest.mock('../src/services/videoProcessing', () => ({
  processVideo: jest.fn(),
}));

// Mock Video model
jest.mock('../src/models/Video', () => ({
  findById: jest.fn(),
}));

describe('Video Processing Queue', () => {
  beforeEach(() => {
    // Stop queue first
    processingQueue.stop();
    // Clear queue state
    processingQueue.clear();
    // Remove all event listeners to prevent contamination
    processingQueue.removeAllListeners();
    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Stop queue
    processingQueue.stop();
    // Clear state
    processingQueue.clear();
    // Remove listeners
    processingQueue.removeAllListeners();
  });

  describe('enqueue', () => {
    test('should add video to queue', () => {
      // Stop queue to prevent immediate processing
      processingQueue.stop();
      processingQueue.clear();
      
      const videoId = '123456789';
      processingQueue.enqueue(videoId);

      expect(processingQueue.queue).toContain(videoId);
    });

    test('should not add duplicate videos', () => {
      // Stop queue to prevent immediate processing
      processingQueue.stop();
      processingQueue.clear();
      
      const videoId = '123456789';
      processingQueue.enqueue(videoId);
      processingQueue.enqueue(videoId);

      expect(processingQueue.queue.filter(id => id === videoId)).toHaveLength(1);
    });

    test('should emit enqueued event', done => {
      // Stop queue to prevent immediate processing
      processingQueue.stop();
      processingQueue.clear();
      
      const videoId = '123456789';

      processingQueue.on('enqueued', id => {
        expect(id).toBe(videoId);
        done();
      });

      processingQueue.enqueue(videoId);
    });
  });

  describe('start/stop', () => {
    test('should start the queue', () => {
      expect(processingQueue.isRunning).toBe(false);
      processingQueue.start();
      expect(processingQueue.isRunning).toBe(true);
    });

    test('should stop the queue', () => {
      processingQueue.start();
      expect(processingQueue.isRunning).toBe(true);
      processingQueue.stop();
      expect(processingQueue.isRunning).toBe(false);
    });

    test('should emit started event', done => {
      processingQueue.on('started', () => {
        expect(processingQueue.isRunning).toBe(true);
        done();
      });

      processingQueue.start();
    });

    test('should emit stopped event', done => {
      processingQueue.on('stopped', () => {
        expect(processingQueue.isRunning).toBe(false);
        done();
      });

      processingQueue.start();
      processingQueue.stop();
    });
  });

  describe('processJob', () => {
    test('should process video successfully', async () => {
      const videoId = '507f1f77bcf86cd799439011';
      const mockVideo = {
        _id: videoId,
        title: 'Test Video',
        description: 'Test Description',
        status: 'uploaded',
        save: jest.fn().mockResolvedValue(true),
      };

      Video.findById.mockResolvedValue(mockVideo);
      processVideo.mockResolvedValue({
        success: true,
        metadata: {
          duration: 120,
          resolution: { width: 1920, height: 1080 },
          codec: 'h264',
          format: 'mp4',
        },
        thumbnailPath: 'thumbnail.jpg',
        sensitivity: 'safe',
        flags: [],
      });

      await processingQueue.processJob(videoId);

      expect(mockVideo.status).toBe('ready');
      expect(mockVideo.duration).toBe(120);
      expect(mockVideo.save).toHaveBeenCalled();
    });

    test('should handle processing failure', async () => {
      const videoId = '507f1f77bcf86cd799439011';
      const mockVideo = {
        _id: videoId,
        title: 'Test Video',
        status: 'processing',
        save: jest.fn().mockResolvedValue(true),
      };

      Video.findById.mockResolvedValue(mockVideo);
      processVideo.mockResolvedValue({
        success: false,
        error: 'Processing failed',
      });

      await processingQueue.processJob(videoId);

      expect(mockVideo.status).toBe('failed');
      expect(mockVideo.processingError).toBe('Processing failed');
      expect(mockVideo.save).toHaveBeenCalled();
    });

    test('should handle video not found', async () => {
      const videoId = '507f1f77bcf86cd799439011';
      Video.findById.mockResolvedValue(null);

      await processingQueue.processJob(videoId);

      expect(processVideo).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      const videoId = '507f1f77bcf86cd799439011';
      Video.findById.mockRejectedValue(new Error('Database error'));

      // Add error event listener to prevent unhandled error
      const errorHandler = jest.fn();
      processingQueue.on('error', errorHandler);

      await processingQueue.processJob(videoId);

      expect(processVideo).not.toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalled();
      
      // Clean up event listener
      processingQueue.removeListener('error', errorHandler);
    });
  });

  describe('getStats', () => {
    test('should return queue statistics', () => {
      // Stop queue to prevent immediate processing
      processingQueue.stop();
      processingQueue.clear();
      
      processingQueue.enqueue('video1');
      processingQueue.enqueue('video2');
      processingQueue.enqueue('video3');

      const stats = processingQueue.getStats();

      expect(stats.queued).toBe(3);
      expect(stats.processing).toBe(0);
      expect(stats.maxConcurrent).toBeDefined();
      expect(stats.isRunning).toBe(false);
    });
  });

  describe('clear', () => {
    test('should clear queue and processing set', () => {
      // Stop queue to prevent immediate processing
      processingQueue.stop();
      processingQueue.clear();
      
      processingQueue.enqueue('video1');
      processingQueue.enqueue('video2');

      processingQueue.clear();

      const stats = processingQueue.getStats();
      expect(stats.queued).toBe(0);
      expect(stats.processing).toBe(0);
    });

    test('should emit cleared event', done => {
      // Stop queue to prevent immediate processing
      processingQueue.stop();
      processingQueue.clear();
      
      processingQueue.on('cleared', () => {
        done();
      });

      processingQueue.enqueue('video1');
      processingQueue.clear();
    });
  });
});
