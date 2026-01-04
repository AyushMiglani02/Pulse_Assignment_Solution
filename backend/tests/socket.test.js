const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');

describe('Socket.io Server', () => {
  let io, serverSocket, clientSocket, httpServer;
  const JWT_SECRET = 'test-secret';
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockTenantId = '507f1f77bcf86cd799439012';

  beforeAll(done => {
    // Create HTTP server
    httpServer = createServer();
    
    // Initialize Socket.io with test config
    io = new Server(httpServer, {
      cors: { origin: '*' },
    });

    // Apply authentication middleware
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication token required'));
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        socket.tenantId = decoded.tenantId;
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });

    // Connection handler
    io.on('connection', socket => {
      serverSocket = socket;
      const userRoom = `user:${socket.userId}`;
      socket.join(userRoom);
    });

    httpServer.listen(() => {
      done();
    });
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Authentication', () => {
    test('should reject connection without token', done => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`);

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });

    test('should reject connection with invalid token', done => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: 'invalid-token' },
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Invalid authentication token');
        done();
      });
    });

    test('should accept connection with valid token', done => {
      const token = jwt.sign(
        { userId: mockUserId, role: 'editor', tenantId: mockTenantId },
        JWT_SECRET,
        { expiresIn: '1h' },
      );

      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token },
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        expect(serverSocket.userId).toBe(mockUserId);
        expect(serverSocket.userRole).toBe('editor');
        expect(serverSocket.tenantId).toBe(mockTenantId);
        done();
      });
    });
  });

  describe('User Rooms', () => {
    beforeEach(done => {
      const token = jwt.sign(
        { userId: mockUserId, role: 'editor', tenantId: mockTenantId },
        JWT_SECRET,
        { expiresIn: '1h' },
      );

      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token },
      });

      clientSocket.on('connect', done);
    });

    test('should join user to user-specific room', () => {
      const userRoom = `user:${mockUserId}`;
      const rooms = Array.from(serverSocket.rooms);
      
      expect(rooms).toContain(userRoom);
    });

    test('should receive events sent to user room', done => {
      const userRoom = `user:${mockUserId}`;
      const testPayload = { message: 'test' };

      clientSocket.on('test-event', payload => {
        expect(payload).toEqual(testPayload);
        done();
      });

      io.to(userRoom).emit('test-event', testPayload);
    });

    test('should not receive events sent to different user room', done => {
      const differentUserId = '507f1f77bcf86cd799439099';
      const differentUserRoom = `user:${differentUserId}`;
      const testPayload = { message: 'test' };

      let receivedEvent = false;

      clientSocket.on('test-event', () => {
        receivedEvent = true;
      });

      io.to(differentUserRoom).emit('test-event', testPayload);

      // Wait 100ms to ensure event is not received
      setTimeout(() => {
        expect(receivedEvent).toBe(false);
        done();
      }, 100);
    });
  });

  describe('Processing Events', () => {
    beforeEach(done => {
      const token = jwt.sign(
        { userId: mockUserId, role: 'editor', tenantId: mockTenantId },
        JWT_SECRET,
        { expiresIn: '1h' },
      );

      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token },
      });

      clientSocket.on('connect', done);
    });

    test('should receive processing:progress event', done => {
      const videoId = '507f1f77bcf86cd799439013';
      const userRoom = `user:${mockUserId}`;

      clientSocket.on('processing:progress', payload => {
        expect(payload.videoId).toBe(videoId);
        expect(payload.percent).toBe(50);
        expect(payload.timestamp).toBeDefined();
        done();
      });

      io.to(userRoom).emit('processing:progress', {
        videoId,
        percent: 50,
        timestamp: new Date().toISOString(),
      });
    });

    test('should receive processing:status event', done => {
      const videoId = '507f1f77bcf86cd799439013';
      const userRoom = `user:${mockUserId}`;

      clientSocket.on('processing:status', payload => {
        expect(payload.videoId).toBe(videoId);
        expect(payload.status).toBe('ready');
        expect(payload.sensitivity).toBe('safe');
        expect(payload.sensitivityFlags).toEqual([]);
        expect(payload.timestamp).toBeDefined();
        done();
      });

      io.to(userRoom).emit('processing:status', {
        videoId,
        status: 'ready',
        sensitivity: 'safe',
        sensitivityFlags: [],
        timestamp: new Date().toISOString(),
      });
    });

    test('should receive processing:error event', done => {
      const videoId = '507f1f77bcf86cd799439013';
      const userRoom = `user:${mockUserId}`;

      clientSocket.on('processing:error', payload => {
        expect(payload.videoId).toBe(videoId);
        expect(payload.error).toBe('Processing failed');
        expect(payload.timestamp).toBeDefined();
        done();
      });

      io.to(userRoom).emit('processing:error', {
        videoId,
        error: 'Processing failed',
        timestamp: new Date().toISOString(),
      });
    });
  });

  describe('Socket Helper Functions', () => {
    const { emitProcessingProgress, emitProcessingStatus, emitProcessingError } = require('../src/socket');

    beforeEach(done => {
      const token = jwt.sign(
        { userId: mockUserId, role: 'editor', tenantId: mockTenantId },
        JWT_SECRET,
        { expiresIn: '1h' },
      );

      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token },
      });

      clientSocket.on('connect', done);
    });

    test('emitProcessingProgress should emit progress event', done => {
      const videoId = '507f1f77bcf86cd799439013';

      clientSocket.on('processing:progress', payload => {
        expect(payload.videoId).toBe(videoId);
        expect(payload.percent).toBe(75);
        done();
      });

      emitProcessingProgress(io, mockUserId, videoId, 75);
    });

    test('emitProcessingStatus should emit status event', done => {
      const videoId = '507f1f77bcf86cd799439013';

      clientSocket.on('processing:status', payload => {
        expect(payload.videoId).toBe(videoId);
        expect(payload.status).toBe('processing');
        done();
      });

      emitProcessingStatus(io, mockUserId, videoId, 'processing');
    });

    test('emitProcessingError should emit error event', done => {
      const videoId = '507f1f77bcf86cd799439013';

      clientSocket.on('processing:error', payload => {
        expect(payload.videoId).toBe(videoId);
        expect(payload.error).toBe('Test error');
        done();
      });

      emitProcessingError(io, mockUserId, videoId, 'Test error');
    });

    test('helper functions should handle null io gracefully', () => {
      // Should not throw
      expect(() => {
        emitProcessingProgress(null, mockUserId, 'video123', 50);
        emitProcessingStatus(null, mockUserId, 'video123', 'ready');
        emitProcessingError(null, mockUserId, 'video123', 'error');
      }).not.toThrow();
    });
  });
});
