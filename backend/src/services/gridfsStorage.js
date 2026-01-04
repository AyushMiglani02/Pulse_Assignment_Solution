const mongoose = require('mongoose');
const { Readable } = require('stream');

/**
 * GridFS Storage Service
 * Handles storing and retrieving files from MongoDB GridFS
 */

let gridFSBucket;

/**
 * Initialize GridFS bucket
 */
const initializeGridFS = () => {
  if (!gridFSBucket) {
    gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'videos', // Collection prefix: videos.files and videos.chunks
    });
    console.log('GridFS bucket initialized');
  }
  return gridFSBucket;
};

/**
 * Upload a file to GridFS from a buffer
 * @param {Buffer} buffer - File buffer
 * @param {String} filename - Filename to store
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} - Upload result with fileId
 */
const uploadToGridFS = (buffer, filename, metadata = {}) => {
  return new Promise((resolve, reject) => {
    const bucket = initializeGridFS();
    
    // Create a readable stream from buffer
    const readStream = Readable.from(buffer);
    
    // Create upload stream
    const uploadStream = bucket.openUploadStream(filename, {
      metadata,
    });

    // Handle events
    uploadStream.on('error', (error) => {
      reject(new Error(`GridFS upload failed: ${error.message}`));
    });

    uploadStream.on('finish', () => {
      resolve({
        fileId: uploadStream.id,
        filename: uploadStream.filename,
        length: uploadStream.length,
      });
    });

    // Pipe buffer to GridFS
    readStream.pipe(uploadStream);
  });
};

/**
 * Download a file from GridFS
 * @param {String|ObjectId} fileId - GridFS file ID
 * @returns {Stream} - Download stream
 */
const downloadFromGridFS = (fileId) => {
  const bucket = initializeGridFS();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  return bucket.openDownloadStream(objectId);
};

/**
 * Get file metadata from GridFS
 * @param {String|ObjectId} fileId - GridFS file ID
 * @returns {Promise<Object>} - File metadata
 */
const getFileMetadata = async (fileId) => {
  const bucket = initializeGridFS();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  
  const files = await bucket.find({ _id: objectId }).toArray();
  
  if (files.length === 0) {
    throw new Error('File not found in GridFS');
  }
  
  return files[0];
};

/**
 * Delete a file from GridFS
 * @param {String|ObjectId} fileId - GridFS file ID
 * @returns {Promise<void>}
 */
const deleteFromGridFS = async (fileId) => {
  const bucket = initializeGridFS();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  
  try {
    await bucket.delete(objectId);
  } catch (error) {
    // Ignore error if file doesn't exist
    if (error.message.includes('FileNotFound')) {
      console.warn(`GridFS file not found: ${fileId}`);
    } else {
      throw error;
    }
  }
};

/**
 * Download file to a temporary buffer (for processing)
 * @param {String|ObjectId} fileId - GridFS file ID
 * @returns {Promise<Buffer>} - File buffer
 */
const downloadToBuffer = (fileId) => {
  return new Promise((resolve, reject) => {
    const downloadStream = downloadFromGridFS(fileId);
    const chunks = [];

    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on('error', (error) => {
      reject(new Error(`Failed to download from GridFS: ${error.message}`));
    });

    downloadStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
};

/**
 * Check if a file exists in GridFS
 * @param {String|ObjectId} fileId - GridFS file ID
 * @returns {Promise<Boolean>}
 */
const fileExists = async (fileId) => {
  try {
    await getFileMetadata(fileId);
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  initializeGridFS,
  uploadToGridFS,
  downloadFromGridFS,
  getFileMetadata,
  deleteFromGridFS,
  downloadToBuffer,
  fileExists,
};
