const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

describe('Auth Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.name).toBe(userData.name);
      expect(response.body.data.user.role).toBe('viewer');
    });

    it('should register user with specified role', async () => {
      const userData = {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'Password123',
        role: 'admin',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      expect(response.body.data.user.role).toBe('admin');
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      };

      await request(app).post('/api/auth/register').send(userData).expect(201);

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    it('should fail with invalid email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'Password123',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with short password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Pass1',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('8 characters');
    });

    it('should fail with weak password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail without name', async () => {
      const userData = {
        email: 'john@example.com',
        password: 'Password123',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid role', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
        role: 'superuser',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        role: 'editor',
      });
    });

    it('should login with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'Password123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(credentials.email);
      expect(response.body.data.user.role).toBe('editor');
    });

    it('should fail with incorrect password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should fail with non-existent email', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'Password123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should fail without email', async () => {
      const credentials = {
        password: 'Password123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail without password', async () => {
      const credentials = {
        email: 'test@example.com',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with deactivated account', async () => {
      const user = await User.findByEmail('test@example.com');
      user.isActive = false;
      await user.save();

      const credentials = {
        email: 'test@example.com',
        password: 'Password123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('deactivated');
    });
  });

  describe('GET /api/auth/me', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        role: 'editor',
      };

      const response = await request(app).post('/api/auth/register').send(userData);
      token = response.body.data.token;
      userId = response.body.data.user.id;
    });

    it('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.role).toBe('editor');
    });

    it('should fail without token', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No token');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', token)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
