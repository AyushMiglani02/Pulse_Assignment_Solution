const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

// Connect to test database before all tests
beforeAll(async () => {
  try {
    // Create in-memory MongoDB server for testing
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '6.0.12', // Use a specific stable version
      },
    });

    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    // Allow tests to continue without database for tests that don't need it
  }
}, 120000); // Increase timeout to 2 minutes for Windows

// Cleanup after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Cleanup after all tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});
