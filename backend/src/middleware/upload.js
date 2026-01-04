const multer = require('multer');
const { AppError } = require('./errorHandler');

// Use memory storage - files will be stored in GridFS instead of disk
const storage = multer.memoryStorage();

// File filter - only allow video files
const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = [
    'video/mp4',
    'video/quicktime', // .mov
    'video/x-msvideo', // .avi
    'video/x-matroska', // .mkv
    'video/webm',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
        400,
      ),
      false,
    );
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_VIDEO_SIZE || 100 * 1024 * 1024), // Default 100MB
  },
});

// Error handling middleware for multer
const handleMulterError = (err, _req, _res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSize = parseInt(process.env.MAX_VIDEO_SIZE || 100 * 1024 * 1024);
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      return next(new AppError(`File too large. Maximum size is ${maxSizeMB}MB`, 400));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Unexpected field in upload', 400));
    }
    return next(new AppError(err.message, 400));
  }
  next(err);
};

module.exports = {
  upload,
  handleMulterError,
};
