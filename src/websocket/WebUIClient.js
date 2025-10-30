import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

/**
 * WebSocket client for Web UI
 * Sends: State updates for visual feedback (send-only)
 * Receives: Nothing (one-way communication)
 */
export class WebUIClient extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity;
    this.reconnectInterval = 5000;
    this.reconnectTimer = null;
  }

  /**
   * Connect to Web UI WebSocket
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Connecting to Web UI at ${this.url}`);

        this.ws = new WebSocket(this.url);

        const connectTimeout = setTimeout(() => {
          if (!this.connected) {
            this.ws.terminate();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

        this.ws.on('open', () => {
          clearTimeout(connectTimeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.reconnectInterval = 5000;

          logger.info('Connected to Web UI');
          this.emit('connected');

          resolve();
        });

        this.ws.on('message', (data) => {
          // Web UI connection is send-only, but handle messages if any
          try {
            const message = JSON.parse(data.toString());
            this.emit('message', message);
          } catch (error) {
            logger.error('Failed to parse Web UI message', {
              error: error.message,
              data: data.toString()
            });
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          logger.warn('Disconnected from Web UI');
          this.emit('disconnected');

          this._scheduleReconnect();
        });

        this.ws.on('error', (error) => {
          logger.error('Web UI WebSocket error', {
            error: error.message
          });

          if (!this.connected) {
            clearTimeout(connectTimeout);
            reject(error);
          } else {
            this.emit('error', error);
          }
        });
      } catch (error) {
        logger.error('Failed to create Web UI WebSocket', {
          error: error.message
        });
        reject(error);
      }
    });
  }

  /**
   * Send state update to Web UI
   * @param {object} data - State data
   * @returns {Promise<boolean>} Success status
   */
  async send(data) {
    if (!this.connected || !this.ws) {
      logger.warn('Cannot send to Web UI: not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error('Failed to send to Web UI', {
        error: error.message,
        data
      });
      return false;
    }
  }

  /**
   * Schedule reconnection attempt
   * @private
   */
  _scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached for Web UI');
      return;
    }

    this.reconnectAttempts++;

    const delay = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1), 60000);

    logger.info(`Reconnecting to Web UI in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(error => {
        logger.error('Reconnection failed', { error: error.message });
      });
    }, delay);
  }

  /**
   * Disconnect from Web UI
   */
  async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    logger.info('Disconnected from Web UI');
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }
}

export default WebUIClient;
