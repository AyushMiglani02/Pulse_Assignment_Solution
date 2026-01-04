import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  /**
   * Connect to Socket.io server with authentication
   * @param {string} token - JWT authentication token
   * @returns {Promise<void>}
   */
  connect(token) {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        console.log('Socket already connected');
        return resolve();
      }

      const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      this.socket = io(serverUrl, {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket.id);
        resolve();
      });

      this.socket.on('connect_error', error => {
        console.error('Socket connection error:', error.message);
        reject(error);
      });

      this.socket.on('disconnect', reason => {
        console.log('Socket disconnected:', reason);
      });

      this.socket.on('error', error => {
        console.error('Socket error:', error);
      });
    });
  }

  /**
   * Disconnect from Socket.io server
   */
  disconnect() {
    if (this.socket) {
      // Remove all listeners
      this.listeners.forEach((_, event) => {
        this.socket.off(event);
      });
      this.listeners.clear();

      this.socket.disconnect();
      this.socket = null;
      console.log('Socket disconnected');
    }
  }

  /**
   * Subscribe to processing progress events
   * @param {Function} callback - Callback function (videoId, percent, timestamp)
   */
  onProcessingProgress(callback) {
    if (!this.socket) {
      console.warn('Socket not connected');
      return;
    }

    const handler = payload => {
      callback(payload.videoId, payload.percent, payload.timestamp);
    };

    this.socket.on('processing:progress', handler);
    this.listeners.set('processing:progress', handler);
  }

  /**
   * Subscribe to processing status change events
   * @param {Function} callback - Callback function (videoId, status, sensitivity, sensitivityFlags, timestamp)
   */
  onProcessingStatus(callback) {
    if (!this.socket) {
      console.warn('Socket not connected');
      return;
    }

    const handler = payload => {
      callback(
        payload.videoId,
        payload.status,
        payload.sensitivity,
        payload.sensitivityFlags,
        payload.timestamp,
      );
    };

    this.socket.on('processing:status', handler);
    this.listeners.set('processing:status', handler);
  }

  /**
   * Subscribe to processing error events
   * @param {Function} callback - Callback function (videoId, error, timestamp)
   */
  onProcessingError(callback) {
    if (!this.socket) {
      console.warn('Socket not connected');
      return;
    }

    const handler = payload => {
      callback(payload.videoId, payload.error, payload.timestamp);
    };

    this.socket.on('processing:error', handler);
    this.listeners.set('processing:error', handler);
  }

  /**
   * Unsubscribe from specific event
   * @param {string} event - Event name
   */
  off(event) {
    if (!this.socket) return;

    const handler = this.listeners.get(event);
    if (handler) {
      this.socket.off(event, handler);
      this.listeners.delete(event);
    }
  }

  /**
   * Check if socket is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export default new SocketService();
