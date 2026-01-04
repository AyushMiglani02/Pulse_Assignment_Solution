const mongoose = require('mongoose');
const { initializeGridFS } = require('../services/gridfsStorage');

let isConnected = false;

const connectDatabase = async () => {
  if (isConnected) {
    console.info('Using existing database connection');
    return;
  }

  try {
    const mongoUri =
      process.env.NODE_ENV === 'test'
        ? process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/video-platform-test'
        : process.env.MONGODB_URI || 'mongodb://localhost:27017/video-platform-dev';

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(mongoUri, options);
    isConnected = true;
    console.info(`✅ MongoDB connected: ${mongoose.connection.name}`);
    
    // Initialize GridFS after successful connection
    initializeGridFS();
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

const disconnectDatabase = async () => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.info('MongoDB disconnected');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
};

const clearDatabase = async () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('clearDatabase should only be used in test environment');
  }

  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
  clearDatabase,
};
