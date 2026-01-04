const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const Video = require('../src/models/Video');
const User = require('../src/models/User');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs').promises;

describe('Video Streaming API', () => {
  let adminUser, editorUser, viewerUser;
  let adminToken, viewerToken;
  let testVideo;
  const testVideoPath = path.join(__dirname, '../uploads/videos/test-video.mp4');
  const tenantId = new mongoose.Types.ObjectId();  // ObjectId for User model
  const differentTenantId = new mongoose.Types.ObjectId();
  const tenantIdStr = tenantId.toString();  // String for Video model

  beforeAll(async () => {
    // Create test users
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@streaming.test',
      password: 'Password123!',
      role: 'admin',
      tenantId,
    });

    editorUser = await User.create({
      name: 'Editor User',
      email: 'editor@streaming.test',
      password: 'Password123!',
      role: 'editor',
      tenantId,
    });

    viewerUser = await User.create({
      name: 'Viewer User',
      email: 'viewer@streaming.test',
      password: 'Password123!',
      role: 'viewer',
      tenantId: differentTenantId,
    });

    // Generate tokens
    adminToken = jwt.sign(
      { userId: adminUser._id, role: adminUser.role, tenantId: adminUser.tenantId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );

    editorToken = jwt.sign(
      { userId: editorUser._id, role: editorUser.role, tenantId: editorUser.tenantId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );

    viewerToken = jwt.sign(
      { userId: viewerUser._id, role: viewerUser.role, tenantId: viewerUser.tenantId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );

    // Create a test video file (small MP4)
    const uploadsDir = path.join(__dirname, '../uploads/videos');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Create a minimal valid MP4 file (just enough to test streaming)
    const minimalMp4 = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
      0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
      0x6d, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65,
    ]);
    await fs.writeFile(testVideoPath, minimalMp4);

    // Create a video record
    testVideo = await Video.create({
      title: 'Test Streaming Video',
      description: 'Video for streaming tests',
      ownerUserId: adminUser._id,
      tenantId: tenantIdStr,
      status: 'ready',
      sensitivity: 'safe',
      originalFilename: 'test-video.mp4',
      storedFilename: 'test-video.mp4',
      fileSize: minimalMp4.length,
      mimeType: 'video/mp4',
      duration: 10,
      resolution: { width: 1280, height: 720 },
      codec: 'h264',
    });
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({ email: /@streaming\.test$/ });
    await Video.deleteMany({ title: /streaming/i });
    
    // Delete test video file
    try {
      await fs.unlink(testVideoPath);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  });

  describe('GET /api/videos/:id/stream', () => {
    describe('Authentication & Authorization', () => {
      test('should return 401 if not authenticated', async () => {
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/authentication/i);
      });

      test('should return 403 if user from different tenant', async () => {
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${viewerToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/permission/i);
      });

      test('should allow access if user is admin from same tenant', async () => {
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.headers['content-type']).toMatch(/video/);
      });

      test('should allow access if user is owner', async () => {
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.headers['content-type']).toMatch(/video/);
      });
    });

    describe('Error Handling', () => {
      test('should return 404 if video not found', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const response = await request(app)
          .get(`/api/videos/${fakeId}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/not found/i);
      });

      test('should return 400 if video is not ready', async () => {
        const processingVideo = await Video.create({
          title: 'Processing Video',
          ownerUserId: adminUser._id,
          tenantId: tenantIdStr,
          status: 'processing',
          sensitivity: 'unknown',
          originalFilename: 'processing.mp4',
          storedFilename: 'processing.mp4',
          fileSize: 1000,
          mimeType: 'video/mp4',
        });

        const response = await request(app)
          .get(`/api/videos/${processingVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/not ready/i);

        await Video.findByIdAndDelete(processingVideo._id);
      });

      test('should return 400 with invalid video ID format', async () => {
        const response = await request(app)
          .get('/api/videos/invalid-id/stream')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Full Stream (No Range)', () => {
      test('should stream entire video without Range header', async () => {
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Check headers
        expect(response.headers['content-type']).toBe('video/mp4');
        expect(response.headers['accept-ranges']).toBe('bytes');
        expect(response.headers['content-length']).toBe(String(testVideo.fileSize));
        
        // Check that we got the file content
        expect(response.body).toBeDefined();
        expect(Buffer.byteLength(response.body)).toBe(testVideo.fileSize);
      });

      test('should set correct MIME type from video record', async () => {
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.headers['content-type']).toBe(testVideo.mimeType);
      });
    });

    describe('Partial Content (Range Requests)', () => {
      test('should return 206 with Range header', async () => {
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Range', 'bytes=0-10')
          .expect(206);

        expect(response.headers['content-range']).toBeDefined();
        expect(response.headers['accept-ranges']).toBe('bytes');
      });

      test('should return correct byte range for start-end request', async () => {
        const start = 0;
        const end = 10;
        
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Range', `bytes=${start}-${end}`)
          .expect(206);

        const expectedContentLength = end - start + 1;
        expect(response.headers['content-range']).toBe(
          `bytes ${start}-${end}/${testVideo.fileSize}`,
        );
        expect(response.headers['content-length']).toBe(String(expectedContentLength));
        expect(Buffer.byteLength(response.body)).toBe(expectedContentLength);
      });

      test('should handle range with only start position', async () => {
        const start = 5;
        
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Range', `bytes=${start}-`)
          .expect(206);

        const end = testVideo.fileSize - 1;
        expect(response.headers['content-range']).toBe(
          `bytes ${start}-${end}/${testVideo.fileSize}`,
        );
      });

      test('should handle middle range request', async () => {
        const start = 10;
        const end = 20;
        
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Range', `bytes=${start}-${end}`)
          .expect(206);

        expect(response.headers['content-range']).toBe(
          `bytes ${start}-${end}/${testVideo.fileSize}`,
        );
      });

      test('should return 416 for invalid range (start >= fileSize)', async () => {
        const invalidStart = testVideo.fileSize + 100;
        
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Range', `bytes=${invalidStart}-`)
          .expect(416);

        expect(response.headers['content-range']).toBe(`bytes */${testVideo.fileSize}`);
      });

      test('should return 416 for invalid range (end >= fileSize)', async () => {
        const invalidEnd = testVideo.fileSize + 100;
        
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Range', `bytes=0-${invalidEnd}`)
          .expect(416);

        expect(response.headers['content-range']).toBe(`bytes */${testVideo.fileSize}`);
      });
    });

    describe('Range Parsing', () => {
      test('should parse simple range correctly', async () => {
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Range', 'bytes=0-99')
          .expect(206);

        expect(response.headers['content-range']).toMatch(/^bytes 0-/);
      });

      test('should handle range at end of file', async () => {
        const start = testVideo.fileSize - 10;
        const end = testVideo.fileSize - 1;
        
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Range', `bytes=${start}-${end}`)
          .expect(206);

        expect(response.headers['content-range']).toBe(
          `bytes ${start}-${end}/${testVideo.fileSize}`,
        );
      });

      test('should cap end position to file size', async () => {
        const start = 0;
        // Request beyond file size
        const requestedEnd = testVideo.fileSize + 1000;
        
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Range', `bytes=${start}-${requestedEnd}`)
          .expect(416);

        // Should reject as invalid range
        expect(response.headers['content-range']).toBe(`bytes */${testVideo.fileSize}`);
      });
    });

    describe('Content Type', () => {
      test('should use video MIME type from database', async () => {
        const response = await request(app)
          .get(`/api/videos/${testVideo._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.headers['content-type']).toBe('video/mp4');
      });

      test('should default to video/mp4 if MIME type missing', async () => {
        const videoWithoutMime = await Video.create({
          title: 'Video Without MIME',
          ownerUserId: adminUser._id,
          tenantId: 'streaming-test',
          status: 'ready',
          sensitivity: 'safe',
          originalFilename: 'test.mp4',
          storedFilename: 'test-video.mp4',
          fileSize: testVideo.fileSize,
          // mimeType intentionally omitted
        });

        const response = await request(app)
          .get(`/api/videos/${videoWithoutMime._id}/stream`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.headers['content-type']).toBe('video/mp4');

        await Video.findByIdAndDelete(videoWithoutMime._id);
      });
    });
  });
});
