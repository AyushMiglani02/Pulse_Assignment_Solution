const request = require('supertest');
const app = require('../src/app');

describe('Health Check Endpoint', () => {
  describe('GET /api/health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status', 'OK');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('environment');
      expect(response.body.data).toHaveProperty('database');
      expect(response.body.data).toHaveProperty('memory');
    });

    it('should return database connection status', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body.data.database).toHaveProperty('status');
      expect(response.body.data.database).toHaveProperty('name');
      expect(['connected', 'disconnected']).toContain(response.body.data.database.status);
    });

    it('should return memory usage information', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body.data.memory).toHaveProperty('used');
      expect(response.body.data.memory).toHaveProperty('total');
      expect(response.body.data.memory).toHaveProperty('unit', 'MB');
      expect(typeof response.body.data.memory.used).toBe('number');
      expect(typeof response.body.data.memory.total).toBe('number');
    });

    it('should return environment information', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body.data.environment).toBe('test');
    });

    it('should have valid timestamp format', async () => {
      const response = await request(app).get('/api/health').expect(200);

      const timestamp = response.body.data.timestamp;
      expect(timestamp).toBeDefined();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should return uptime as a positive number', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(typeof response.body.data.uptime).toBe('number');
      expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET / (root route)', () => {
    it('should return API welcome message', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('documentation');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/non-existent-route').expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Route not found');
    });
  });
});
