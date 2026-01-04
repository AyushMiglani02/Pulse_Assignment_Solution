const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const gridfsStorage = require('./gridfsStorage');

// Set FFmpeg and FFprobe paths (use installed binary in production, mock in tests)
if (process.env.NODE_ENV !== 'test') {
  try {
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    const ffprobePath = require('@ffprobe-installer/ffprobe').path;
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
    console.log('FFmpeg and FFprobe paths configured successfully');
  } catch (error) {
    console.warn('FFmpeg/FFprobe not installed, video processing will fail:', error.message);
  }
}

/**
 * Extract video metadata using FFmpeg
 * @param {String} videoPath - Path to video file
 * @returns {Promise<Object>} - Video metadata
 */
const extractMetadata = videoPath => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Failed to extract metadata: ${err.message}`));
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

      if (!videoStream) {
        return reject(new Error('No video stream found'));
      }

      resolve({
        duration: metadata.format.duration,
        size: metadata.format.size,
        bitRate: metadata.format.bit_rate,
        format: metadata.format.format_name,
        video: {
          codec: videoStream.codec_name,
          width: videoStream.width,
          height: videoStream.height,
          frameRate: eval(videoStream.r_frame_rate), // Convert fraction to number
          bitRate: videoStream.bit_rate,
        },
        audio: audioStream
          ? {
              codec: audioStream.codec_name,
              sampleRate: audioStream.sample_rate,
              channels: audioStream.channels,
            }
          : null,
      });
    });
  });
};

/**
 * Generate thumbnail from video
 * @param {String} videoPath - Path to video file
 * @param {String} outputPath - Path to save thumbnail
 * @param {Number} timestamp - Timestamp in seconds (default: 1)
 * @returns {Promise<String>} - Path to generated thumbnail
 */
const generateThumbnail = (videoPath, outputPath, timestamp = 1) => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [timestamp],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '320x240',
      })
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', err => {
        reject(new Error(`Failed to generate thumbnail: ${err.message}`));
      });
  });
};

/**
 * Analyze video content for sensitivity
 * Rule-based analysis (can be replaced with ML model in future)
 * @param {Object} metadata - Video metadata
 * @param {String} title - Video title
 * @param {String} description - Video description
 * @returns {Object} - Sensitivity analysis result
 */
const analyzeSensitivity = (metadata, title = '', description = '') => {
  const flags = [];
  let sensitivity = 'safe';

  // Rule 1: Check video duration (flag very short or very long videos)
  if (metadata.duration < 5) {
    flags.push('Very short duration (< 5 seconds)');
  } else if (metadata.duration > 3600) {
    // > 1 hour
    flags.push('Very long duration (> 1 hour)');
  }

  // Rule 2: Check video resolution (flag unusual resolutions)
  const width = metadata.video?.width || 0;
  const height = metadata.video?.height || 0;
  if (width > 0 && height > 0) {
    const aspectRatio = width / height;
    if (aspectRatio < 0.5 || aspectRatio > 3) {
      flags.push('Unusual aspect ratio');
    }
  }

  // Rule 3: Check for sensitive keywords in title/description
  const sensitiveKeywords = [
    'explicit',
    'nsfw',
    'adult',
    '18+',
    'mature',
    'violence',
    'graphic',
  ];
  const textToCheck = `${title} ${description}`.toLowerCase();

  for (const keyword of sensitiveKeywords) {
    if (textToCheck.includes(keyword)) {
      flags.push(`Contains sensitive keyword: ${keyword}`);
      sensitivity = 'flagged';
      break;
    }
  }

  // Rule 4: Check file size relative to duration (detect potential quality issues)
  if (metadata.duration > 0) {
    const sizePerSecond = metadata.size / metadata.duration;
    if (sizePerSecond < 10000) {
      // < 10KB/sec is very low quality
      flags.push('Unusually low bitrate/quality');
    }
  }

  // Rule 5: No audio stream might indicate screen recording or suspicious content
  if (!metadata.audio && metadata.duration > 30) {
    flags.push('No audio stream in video > 30s');
  }

  // If multiple flags, mark as flagged
  if (flags.length >= 3 && sensitivity !== 'flagged') {
    sensitivity = 'flagged';
  }

  // If no flags, mark as safe; if some flags but not flagged, keep as unknown
  if (flags.length === 0) {
    sensitivity = 'safe';
  } else if (sensitivity !== 'flagged') {
    sensitivity = 'unknown';
  }

  return {
    sensitivity,
    flags,
    analyzedAt: new Date(),
  };
};

/**
 * Process a video file - extract metadata, generate thumbnail, analyze sensitivity
 * @param {Object} video - Video document from database
 * @returns {Promise<Object>} - Processing result
 */
const processVideo = async (video) => {
  let tempVideoPath = null;
  let tempThumbnailPath = null;

  try {
    // Create temporary file paths
    const tempDir = os.tmpdir();
    const ext = path.extname(video.storedFilename);
    tempVideoPath = path.join(tempDir, `video-${Date.now()}${ext}`);
    tempThumbnailPath = path.join(tempDir, `thumb-${Date.now()}.jpg`);

    // Download video from GridFS to temporary file
    console.log(`Downloading video from GridFS: ${video.gridFsFileId}`);
    const videoBuffer = await gridfsStorage.downloadToBuffer(video.gridFsFileId);
    await fs.writeFile(tempVideoPath, videoBuffer);

    // Extract metadata
    const metadata = await extractMetadata(tempVideoPath);

    // Generate thumbnail
    await generateThumbnail(tempVideoPath, tempThumbnailPath, Math.min(1, metadata.duration / 2));

    // Read thumbnail and upload to GridFS
    const thumbnailBuffer = await fs.readFile(tempThumbnailPath);
    const thumbnailFilename = `thumb-${video.storedFilename.replace(/\.[^.]+$/, '.jpg')}`;
    
    const thumbnailUploadResult = await gridfsStorage.uploadToGridFS(
      thumbnailBuffer,
      thumbnailFilename,
      {
        videoId: video._id.toString(),
        mimeType: 'image/jpeg',
        type: 'thumbnail',
      }
    );

    // Analyze sensitivity
    const sensitivityAnalysis = analyzeSensitivity(metadata, video.title, video.description);

    // Clean up temporary files
    try {
      await fs.unlink(tempVideoPath);
      await fs.unlink(tempThumbnailPath);
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary files:', cleanupError.message);
    }

    return {
      success: true,
      metadata: {
        duration: Math.round(metadata.duration),
        resolution: {
          width: metadata.video.width,
          height: metadata.video.height,
        },
        codec: metadata.video.codec,
        format: metadata.format,
        bitRate: metadata.bitRate,
        hasAudio: !!metadata.audio,
      },
      thumbnail: thumbnailFilename,
      thumbnailGridFsFileId: thumbnailUploadResult.fileId,
      sensitivity: sensitivityAnalysis.sensitivity,
      sensitivityFlags: sensitivityAnalysis.flags,
    };
  } catch (error) {
    console.error('Video processing error:', error);
    
    // Clean up temporary files on error
    if (tempVideoPath) {
      try {
        await fs.unlink(tempVideoPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (tempThumbnailPath) {
      try {
        await fs.unlink(tempThumbnailPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  extractMetadata,
  generateThumbnail,
  analyzeSensitivity,
  processVideo,
};
