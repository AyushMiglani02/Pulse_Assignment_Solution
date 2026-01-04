const request = require('supertest');
const express = require('express');
const { authenticate, authorize } = require('../src/middleware/auth');
const User = require('../src/models/User');
const { generateToken } = require('../src/utils/jwt');
const { errorHandler } = require('../src/middleware/errorHandler');

// Create a test app with protected routes
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Test route that requires authentication
  app.get('/protected', authenticate, (req, res) => {
    res.json({ success: true, userId: req.user._id.toString() });
  });

  // Test route that requires viewer role
  app.get('/viewer-only', authenticate, authorize('viewer', 'editor', 'admin'), (req, res) => {
    res.json({ success: true, role: req.user.role });
  });

  // Test route that requires editor role
  app.get('/editor-only', authenticate, authorize('editor', 'admin'), (req, res) => {
    res.json({ success: true, role: req.user.role });
  });

  // Test route that requires admin role
  app.get('/admin-only', authenticate, authorize('admin'), (req, res) => {
    res.json({ success: true, role: req.user.role });
  });

  app.use(errorHandler);
  return app;
};

describe('Authentication Middleware', () => {
  let testApp;
  let viewerUser;
  let editorUser;
  let adminUser;
  let viewerToken;
  let editorToken;
  let adminToken;

  beforeEach(async () => {
    testApp = createTestApp();

    // Create test users
    viewerUser = await User.create({
      name: 'Viewer User',
      email: 'viewer@example.com',
      password: 'Password123',
      role: 'viewer',
    });

    editorUser = await User.create({
      name: 'Editor User',
      email: 'editor@example.com',
      password: 'Password123',
      role: 'editor',
    });

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'Password123',
      role: 'admin',
    });

    // Generate tokens
    viewerToken = generateToken(viewerUser);
    editorToken = generateToken(editorUser);
    adminToken = generateToken(adminUser);
  });

  describe('authenticate middleware', () => {
    it('should allow access with valid token', async () => {
      const response = await request(testApp)
        .get('/protected')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe(viewerUser._id.toString());
    });

    it('should deny access without token', async () => {
      const response = await request(testApp).get('/protected').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No token');
    });

    it('should deny access with invalid token', async () => {
      const response = await request(testApp)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should deny access for deactivated user', async () => {
      viewerUser.isActive = false;
      await viewerUser.save();

      const response = await request(testApp)
        .get('/protected')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('deactivated');
    });
  });

  describe('authorize middleware - RBAC', () => {
    describe('Viewer-level access (viewer, editor, admin allowed)', () => {
      it('should allow viewer access', async () => {
        const response = await request(testApp)
          .get('/viewer-only')
          .set('Authorization', `Bearer ${viewerToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.role).toBe('viewer');
      });

      it('should allow editor access', async () => {
        const response = await request(testApp)
          .get('/viewer-only')
          .set('Authorization', `Bearer ${editorToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.role).toBe('editor');
      });

      it('should allow admin access', async () => {
        const response = await request(testApp)
          .get('/viewer-only')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.role).toBe('admin');
      });
    });

    describe('Editor-level access (editor, admin allowed)', () => {
      it('should deny viewer access', async () => {
        const response = await request(testApp)
          .get('/editor-only')
          .set('Authorization', `Bearer ${viewerToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Access denied');
      });

      it('should allow editor access', async () => {
        const response = await request(testApp)
          .get('/editor-only')
          .set('Authorization', `Bearer ${editorToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.role).toBe('editor');
      });

      it('should allow admin access', async () => {
        const response = await request(testApp)
          .get('/editor-only')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.role).toBe('admin');
      });
    });

    describe('Admin-level access (admin only)', () => {
      it('should deny viewer access', async () => {
        const response = await request(testApp)
          .get('/admin-only')
          .set('Authorization', `Bearer ${viewerToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Access denied');
      });

      it('should deny editor access', async () => {
        const response = await request(testApp)
          .get('/admin-only')
          .set('Authorization', `Bearer ${editorToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Access denied');
      });

      it('should allow admin access', async () => {
        const response = await request(testApp)
          .get('/admin-only')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.role).toBe('admin');
      });
    });
  });
});
