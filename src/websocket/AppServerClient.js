import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

/**
 * WebSocket client for App Server
 * Sends: Library, playlist commands
 * Receives: Library state, selected track info
 */
export class AppServerClient extends EventEmitter {
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
   * Connect to App Server WebSocket
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Connecting to App Server at ${this.url}`);

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

          logger.info('Connected to App Server');
          this.emit('connected');

          this._subscribe();

          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this._handleMessage(message);
          } catch (error) {
            logger.error('Failed to parse App Server message', {
              error: error.message,
              data: data.toString()
            });
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          logger.warn('Disconnected from App Server');
          this.emit('disconnected');

          this._scheduleReconnect();
        });

        this.ws.on('error', (error) => {
          logger.error('App Server WebSocket error', {
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
        logger.error('Failed to create App Server WebSocket', {
          error: error.message
        });
        reject(error);
      }
    });
  }

  /**
   * Send action to App Server
   * @param {object} data - Action data
   * @returns {Promise<boolean>} Success status
   */
  async send(data) {
    if (!this.connected || !this.ws) {
      logger.warn('Cannot send to App Server: not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error('Failed to send to App Server', {
        error: error.message,
        data
      });
      return false;
    }
  }

  /**
   * Subscribe to state updates from App Server
   * @private
   */
  _subscribe() {
    this.send({
      type: 'subscribe',
      events: [
        'selectedTrack',
        'playlist',
        'browser'
      ]
    });

    logger.debug('Subscribed to App Server state updates');
  }

  /**
   * Handle incoming message from App Server
   * @private
   */
  _handleMessage(message) {
    if (message.type === 'state') {
      this.emit('state', message);
    } else if (message.type === 'error') {
      logger.error('App Server error', { error: message.error });
      this.emit('error', new Error(message.error));
    } else {
      this.emit('message', message);
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
      logger.error('Max reconnection attempts reached for App Server');
      return;
    }

    this.reconnectAttempts++;

    const delay = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1), 60000);

    logger.info(`Reconnecting to App Server in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(error => {
        logger.error('Reconnection failed', { error: error.message });
      });
    }, delay);
  }

  /**
   * Disconnect from App Server
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
    logger.info('Disconnected from App Server');
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }
}

export default AppServerClient;
