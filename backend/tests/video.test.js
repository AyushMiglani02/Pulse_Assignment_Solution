const path = require('path');
const fs = require('fs').promises;
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const jwt = require('jsonwebtoken');

// Create test video file
const createTestVideoFile = async (filename = 'test-video.mp4', size = 1024) => {
  const testFilePath = path.join(__dirname, filename);
  const buffer = Buffer.alloc(size);
  await fs.writeFile(testFilePath, buffer);
  return testFilePath;
};

// Clean up test files
const cleanupTestFiles = async (filenames = []) => {
  for (const filename of filenames) {
    try {
      await fs.unlink(path.join(__dirname, filename));
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  // Clean up uploaded files
  const uploadsDir = path.join(__dirname, '../uploads/videos');
  try {
    const files = await fs.readdir(uploadsDir);
    for (const file of files) {
      if (file.startsWith('test-') || file.includes('-test-')) {
        await fs.unlink(path.join(uploadsDir, file));
      }
    }
  } catch (error) {
    // Ignore if directory doesn't exist
  }
};

describe('Video Upload API', () => {
  let editorToken;
  let viewerToken;
  let adminToken;
  let editorUser;
  let viewerUser;
  let adminUser;

  // Create users before each test since afterEach clears all collections
  beforeEach(async () => {
    // Create test users
    editorUser = await User.create({
      name: 'Editor User',
      email: 'editor@test.com',
      password: 'Password123!',
      role: 'editor',
      isActive: true,
    });

    viewerUser = await User.create({
      name: 'Viewer User',
      email: 'viewer@test.com',
      password: 'Password123!',
      role: 'viewer',
      isActive: true,
    });

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'Password123!',
      role: 'admin',
      isActive: true,
    });

    // Generate tokens
    editorToken = jwt.sign({ id: editorUser._id }, process.env.JWT_SECRET || 'test-secret');
    viewerToken = jwt.sign({ id: viewerUser._id }, process.env.JWT_SECRET || 'test-secret');
    adminToken = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET || 'test-secret');
  });

  afterAll(async () => {
    await cleanupTestFiles(['test-video.mp4', 'test-large.mp4', 'test-doc.txt']);
  });

  describe('POST /api/videos/upload', () => {
    test('should upload video successfully with valid data (editor)', async () => {
      const testFile = await createTestVideoFile('test-video.mp4', 1024 * 1024); // 1MB

      const response = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${editorToken}`)
        .field('title', 'Test Video')
        .field('description', 'Test description')
        .attach('video', testFile);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.video).toMatchObject({
        title: 'Test Video',
        description: 'Test description',
        status: 'uploaded',
        sensitivity: 'unknown',
        originalFilename: 'test-video.mp4',
        mimeType: 'video/mp4',
      });
      expect(response.body.data.video._id).toBeDefined();
      expect(response.body.data.video.fileSizeFormatted).toBeDefined();

      // Verify in database
      const video = await Video.findById(response.body.data.video._id);
      expect(video).toBeTruthy();
      expect(video.ownerUserId.toString()).toBe(editorUser._id.toString());

      await cleanupTestFiles(['test-video.mp4']);
    });

    test('should upload video successfully with valid data (admin)', async () => {
      const testFile = await createTestVideoFile('test-video.mp4', 1024 * 512);

      const response = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Admin Test Video')
        .attach('video', testFile);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.video.title).toBe('Admin Test Video');

      await cleanupTestFiles(['test-video.mp4']);
    });

    test('should reject upload without authentication', async () => {
      const testFile = await createTestVideoFile('test-video.mp4', 1024);

      const response = await request(app)
        .post('/api/videos/upload')
        .field('title', 'Test Video')
        .attach('video', testFile);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      await cleanupTestFiles(['test-video.mp4']);
    });

    test('should reject upload from viewer role', async () => {
      const testFile = await createTestVideoFile('test-video.mp4', 1024);

      const response = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${viewerToken}`)
        .field('title', 'Test Video')
        .attach('video', testFile);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      await cleanupTestFiles(['test-video.mp4']);
    });

    test('should reject upload without video file', async () => {
      const response = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${editorToken}`)
        .field('title', 'Test Video');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No video file provided');
    });

    test('should reject upload without title', async () => {
      const testFile = await createTestVideoFile('test-video.mp4', 1024);

      const response = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${editorToken}`)
        .attach('video', testFile);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      await cleanupTestFiles(['test-video.mp4']);
    });

    test('should reject upload with empty title', async () => {
      const testFile = await createTestVideoFile('test-video.mp4', 1024);

      const response = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${editorToken}`)
        .field('title', '   ')
        .attach('video', testFile);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      await cleanupTestFiles(['test-video.mp4']);
    });

    test('should reject upload with title exceeding 200 characters', async () => {
      const testFile = await createTestVideoFile('test-video.mp4', 1024);
      const longTitle = 'a'.repeat(201);

      const response = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${editorToken}`)
        .field('title', longTitle)
        .attach('video', testFile);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      await cleanupTestFiles(['test-video.mp4']);
    });

    test('should reject upload with description exceeding 2000 characters', async () => {
      const testFile = await createTestVideoFile('test-video.mp4', 1024);
      const longDescription = 'a'.repeat(2001);

      const response = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${editorToken}`)
        .field('title', 'Test Video')
        .field('description', longDescription)
        .attach('video', testFile);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      await cleanupTestFiles(['test-video.mp4']);
    });

    test('should reject upload of non-video file', async () => {
      const testFile = path.join(__dirname, 'test-doc.txt');
      await fs.writeFile(testFile, 'This is not a video');

      const response = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${editorToken}`)
        .field('title', 'Test Video')
        .attach('video', testFile);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('video');

      await cleanupTestFiles(['test-doc.txt']);
    });

    test('should reject upload of oversized file', async () => {
      // Create a file larger than MAX_VIDEO_SIZE (default 100MB)
      const maxSize = parseInt(process.env.MAX_VIDEO_SIZE || '104857600', 10);
      const testFile = await createTestVideoFile('test-large.mp4', maxSize + 1024);

      const response = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${editorToken}`)
        .field('title', 'Test Video')
        .attach('video', testFile);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('too large');

      await cleanupTestFiles(['test-large.mp4']);
    });

    test('should trim whitespace from title and description', async () => {
      const testFile = await createTestVideoFile('test-video.mp4', 1024);

      const response = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${editorToken}`)
        .field('title', '  Test Video  ')
        .field('description', '  Test description  ')
        .attach('video', testFile);

      expect(response.status).toBe(201);
      expect(response.body.data.video.title).toBe('Test Video');
      expect(response.body.data.video.description).toBe('Test description');

      await cleanupTestFiles(['test-video.mp4']);
    });
  });

  describe('GET /api/videos', () => {
    beforeEach(async () => {
      // Create test videos for editor
      await Video.create([
        {
          title: 'Video 1',
          ownerUserId: editorUser._id,
          status: 'uploaded',
          sensitivity: 'unknown',
          originalFilename: 'video1.mp4',
          storedFilename: 'stored-video1.mp4',
          fileSize: 1024,
          mimeType: 'video/mp4',
        },
        {
          title: 'Video 2',
          ownerUserId: editorUser._id,
          status: 'ready',
          sensitivity: 'safe',
          originalFilename: 'video2.mp4',
          storedFilename: 'stored-video2.mp4',
          fileSize: 2048,
          mimeType: 'video/mp4',
        },
        {
          title: 'Video 3',
          ownerUserId: viewerUser._id,
          status: 'uploaded',
          sensitivity: 'unknown',
          originalFilename: 'video3.mp4',
          storedFilename: 'stored-video3.mp4',
          fileSize: 3072,
          mimeType: 'video/mp4',
        },
      ]);
    });

    test('should get all videos for authenticated user', async () => {
      const response = await request(app)
        .get('/api/videos')
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.videos).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    test('should filter videos by status', async () => {
      const response = await request(app)
        .get('/api/videos?status=ready')
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.videos).toHaveLength(1);
      expect(response.body.data.videos[0].status).toBe('ready');
    });

    test('should paginate results', async () => {
      const response = await request(app)
        .get('/api/videos?limit=1&skip=0')
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.videos).toHaveLength(1);
      expect(response.body.data.pagination.hasMore).toBe(true);
    });

    test('should reject without authentication', async () => {
      const response = await request(app).get('/api/videos');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/videos/:id', () => {
    let editorVideo;
    let viewerVideo;

    beforeEach(async () => {
      editorVideo = await Video.create({
        title: 'Editor Video',
        ownerUserId: editorUser._id,
        status: 'uploaded',
        sensitivity: 'unknown',
        originalFilename: 'editor-video.mp4',
        storedFilename: 'stored-editor-video.mp4',
        fileSize: 1024,
        mimeType: 'video/mp4',
      });

      viewerVideo = await Video.create({
        title: 'Viewer Video',
        ownerUserId: viewerUser._id,
        status: 'uploaded',
        sensitivity: 'unknown',
        originalFilename: 'viewer-video.mp4',
        storedFilename: 'stored-viewer-video.mp4',
        fileSize: 2048,
        mimeType: 'video/mp4',
      });
    });

    test('should get own video', async () => {
      const response = await request(app)
        .get(`/api/videos/${editorVideo._id}`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.video.title).toBe('Editor Video');
    });

    test('should allow admin to access any video', async () => {
      const response = await request(app)
        .get(`/api/videos/${editorVideo._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.video.title).toBe('Editor Video');
    });

    test('should reject access to other user video', async () => {
      const response = await request(app)
        .get(`/api/videos/${editorVideo._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('should return 404 for non-existent video', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/videos/${fakeId}`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/videos/:id', () => {
    let editorVideo;

    beforeEach(async () => {
      editorVideo = await Video.create({
        title: 'Original Title',
        description: 'Original Description',
        ownerUserId: editorUser._id,
        status: 'uploaded',
        sensitivity: 'unknown',
        originalFilename: 'video.mp4',
        storedFilename: 'stored-video.mp4',
        fileSize: 1024,
        mimeType: 'video/mp4',
      });
    });

    test('should update video title and description', async () => {
      const response = await request(app)
        .patch(`/api/videos/${editorVideo._id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          title: 'Updated Title',
          description: 'Updated Description',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.video.title).toBe('Updated Title');
      expect(response.body.data.video.description).toBe('Updated Description');
    });

    test('should allow admin to update status and sensitivity', async () => {
      const response = await request(app)
        .patch(`/api/videos/${editorVideo._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'ready',
          sensitivity: 'safe',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.video.status).toBe('ready');
      expect(response.body.data.video.sensitivity).toBe('safe');
    });

    test('should not allow non-admin to update status', async () => {
      const response = await request(app)
        .patch(`/api/videos/${editorVideo._id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          status: 'ready',
        });

      expect(response.status).toBe(200);
      // Status should not change
      const video = await Video.findById(editorVideo._id);
      expect(video.status).toBe('uploaded');
    });

    test('should reject update from non-owner', async () => {
      const response = await request(app)
        .patch(`/api/videos/${editorVideo._id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Hacked Title',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/videos/:id', () => {
    let editorVideo;

    beforeEach(async () => {
      editorVideo = await Video.create({
        title: 'Video to Delete',
        ownerUserId: editorUser._id,
        status: 'uploaded',
        sensitivity: 'unknown',
        originalFilename: 'delete-video.mp4',
        storedFilename: 'stored-delete-video.mp4',
        fileSize: 1024,
        mimeType: 'video/mp4',
      });
    });

    test('should delete own video', async () => {
      const response = await request(app)
        .delete(`/api/videos/${editorVideo._id}`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const video = await Video.findById(editorVideo._id);
      expect(video).toBeNull();
    });

    test('should allow admin to delete any video', async () => {
      const response = await request(app)
        .delete(`/api/videos/${editorVideo._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const video = await Video.findById(editorVideo._id);
      expect(video).toBeNull();
    });

    test('should reject delete from non-owner', async () => {
      const response = await request(app)
        .delete(`/api/videos/${editorVideo._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      const video = await Video.findById(editorVideo._id);
      expect(video).toBeTruthy();
    });
  });
});
