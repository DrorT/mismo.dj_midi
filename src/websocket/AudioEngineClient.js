import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

/**
 * WebSocket client for Audio Engine
 * Sends: Transport, jog, effect commands
 * Receives: Playback state, VU meters, waveform data
 */
export class AudioEngineClient extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity;
    this.reconnectInterval = 5000; // Start with 5 seconds
    this.reconnectTimer = null;
  }

  /**
   * Connect to Audio Engine WebSocket
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Connecting to Audio Engine at ${this.url}`);

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

          logger.info('Connected to Audio Engine');
          this.emit('connected');

          // Subscribe to state updates
          this._subscribe();

          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this._handleMessage(message);
          } catch (error) {
            logger.error('Failed to parse Audio Engine message', {
              error: error.message,
              data: data.toString()
            });
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          logger.warn('Disconnected from Audio Engine');
          this.emit('disconnected');

          this._scheduleReconnect();
        });

        this.ws.on('error', (error) => {
          logger.error('Audio Engine WebSocket error', {
            error: error.message
          });

          // If not yet connected, reject the promise
          if (!this.connected) {
            clearTimeout(connectTimeout);
            reject(error);
          } else {
            this.emit('error', error);
          }
        });
      } catch (error) {
        logger.error('Failed to create Audio Engine WebSocket', {
          error: error.message
        });
        reject(error);
      }
    });
  }

  /**
   * Send action to Audio Engine
   * @param {object} data - Action data
   * @returns {Promise<boolean>} Success status
   */
  async send(data) {
    if (!this.connected || !this.ws) {
      logger.warn('Cannot send to Audio Engine: not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error('Failed to send to Audio Engine', {
        error: error.message,
        data
      });
      return false;
    }
  }

  /**
   * Send critical-priority action (bypasses normal flow)
   * Used for jog wheels where latency is critical
   * @param {object} action - Action data
   * @returns {boolean} Success status
   */
  sendCritical(action) {
    if (!this.connected || !this.ws) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'action',
        priority: 'critical',
        timestamp: action.timestamp || Date.now(),
        action
      }));
      return true;
    } catch (error) {
      logger.error('Failed to send critical action', { error: error.message });
      return false;
    }
  }

  /**
   * Subscribe to state updates from Audio Engine
   * @private
   */
  _subscribe() {
    this.send({
      type: 'subscribe',
      events: [
        'playback', // Play/pause state
        'position', // Track position (throttled to 30Hz)
        'vuMeter', // VU levels (60Hz)
        'sync', // Sync/beatmatch state
        'effects', // Effect on/off states
        'tempo' // Tempo/pitch values
      ]
    });

    logger.debug('Subscribed to Audio Engine state updates');
  }

  /**
   * Handle incoming message from Audio Engine
   * @private
   */
  _handleMessage(message) {
    if (message.type === 'state') {
      this.emit('state', message);
    } else if (message.type === 'error') {
      logger.error('Audio Engine error', { error: message.error });
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
      return; // Already scheduled
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached for Audio Engine');
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff with max of 60 seconds
    const delay = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1), 60000);

    logger.info(`Reconnecting to Audio Engine in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(error => {
        logger.error('Reconnection failed', { error: error.message });
      });
    }, delay);
  }

  /**
   * Disconnect from Audio Engine
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
    logger.info('Disconnected from Audio Engine');
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }
}

export default AudioEngineClient;
