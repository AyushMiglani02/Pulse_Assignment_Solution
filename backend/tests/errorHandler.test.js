const { AppError } = require('../src/middleware/errorHandler');

// errorHandler tests don't need database at all
describe('Error Handler Middleware', () => {
  describe('AppError class', () => {
    it('should create an error with message and status code', () => {
      const error = new AppError('Test error', 400);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error', 500);

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });

    it('should be instanceof Error', () => {
      const error = new AppError('Test error', 404);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });
  });
});
