const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('./errorHandler');

// Use /tmp directory for Render (persistent across request, cleared on restart)
const uploadDir = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'uploads', 'videos')
  : path.join(__dirname, '../../uploads/videos');

// Ensure uploads directory exists
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Created upload directory: ${uploadDir}`);
  }
} catch (error) {
  console.error('Failed to create upload directory:', error);
}

// Configure storage
const storage = multer.diskStorage({
  destination (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename (_req, file, cb) {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    // Sanitize filename: remove special characters
    const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, sanitized + '-' + uniqueSuffix + ext);
  },
});

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
  uploadDir,
};
