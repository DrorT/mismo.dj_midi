import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

/**
 * Routes actions to Audio Engine, App Server, or Web UI
 * Handles priority queuing for time-critical actions
 */
export class ActionRouter extends EventEmitter {
  constructor(wsClients) {
    super();

    this.audioClient = wsClients.audio;
    this.appClient = wsClients.app;
    this.uiClient = wsClients.ui;

    this.criticalQueue = []; // Jog wheels - bypass queue, send immediately
    this.highQueue = []; // Transport controls
    this.normalQueue = []; // Everything else

    this.isProcessing = false;
    this.maxQueueSize = 1000; // Prevent memory overflow

    // Stats
    this.stats = {
      totalActions: 0,
      droppedActions: 0,
      actionsByPriority: {
        critical: 0,
        high: 0,
        normal: 0
      },
      actionsByTarget: {
        audio: 0,
        app: 0,
        ui: 0
      }
    };

    // Start processing queues
    this._startProcessing();
  }

  /**
   * Route action based on target and priority
   * @param {object} action - Action object
   * @returns {Promise<boolean>} Success status
   */
  async route(action) {
    if (!action || !action.target || !action.priority) {
      logger.warn('Invalid action received', { action });
      return false;
    }

    this.stats.totalActions++;
    this.stats.actionsByPriority[action.priority]++;
    this.stats.actionsByTarget[action.target]++;

    // Critical actions bypass queue and send immediately
    if (action.priority === 'critical') {
      return await this._sendAction(action);
    }

    // Add to appropriate queue
    const queue = action.priority === 'high' ? this.highQueue : this.normalQueue;

    // Check queue size
    if (queue.length >= this.maxQueueSize) {
      logger.warn(`Queue overflow (${action.priority}), dropping action`, {
        queueSize: queue.length,
        action: action.type
      });

      this.stats.droppedActions++;
      return false;
    }

    queue.push(action);

    if (process.env.DEBUG === 'true') {
      this.emit('route', action);
      logger.debug('Action queued', {
        priority: action.priority,
        target: action.target,
        type: action.type,
        queueSize: queue.length
      });
    }

    return true;
  }

  /**
   * Send action to appropriate WebSocket client
   * @private
   */
  async _sendAction(action) {
    let client;

    switch (action.target) {
      case 'audio':
        client = this.audioClient;
        break;

      case 'app':
        client = this.appClient;
        break;

      case 'ui':
        client = this.uiClient;
        break;

      default:
        logger.warn(`Unknown action target: ${action.target}`);
        return false;
    }

    if (!client) {
      logger.warn(`No client available for target: ${action.target}`);
      return false;
    }

    try {
      const success = await client.send({
        type: 'action',
        priority: action.priority,
        timestamp: action.timestamp || Date.now(),
        action: {
          type: action.type,
          deck: action.deck,
          command: action.command,
          value: action.value,
          delta: action.delta,
          direction: action.direction
        }
      });

      if (process.env.DEBUG === 'true') {
        logger.debug('Action sent', {
          target: action.target,
          type: action.type,
          command: action.command,
          success
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to send action', {
        target: action.target,
        error: error.message,
        action
      });
      return false;
    }
  }

  /**
   * Start queue processing loop
   * @private
   */
  _startProcessing() {
    // Process queues continuously
    setImmediate(async () => {
      await this._processQueues();
      this._startProcessing(); // Schedule next iteration
    });
  }

  /**
   * Process queues with priority
   * @private
   */
  async _processQueues() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process high priority queue first
      if (this.highQueue.length > 0) {
        const action = this.highQueue.shift();
        await this._sendAction(action);
      }
      // Then process normal queue
      else if (this.normalQueue.length > 0) {
        const action = this.normalQueue.shift();
        await this._sendAction(action);
      }
    } catch (error) {
      logger.error('Error processing queue', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get queue statistics
   * @returns {object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      queueSizes: {
        high: this.highQueue.length,
        normal: this.normalQueue.length
      }
    };
  }

  /**
   * Clear all queues
   */
  clearQueues() {
    const cleared = {
      high: this.highQueue.length,
      normal: this.normalQueue.length
    };

    this.highQueue = [];
    this.normalQueue = [];

    logger.info('Queues cleared', cleared);

    return cleared;
  }

  /**
   * Pause queue processing
   */
  pause() {
    this.isProcessing = true; // Prevent processing
    logger.info('Action router paused');
  }

  /**
   * Resume queue processing
   */
  resume() {
    this.isProcessing = false;
    logger.info('Action router resumed');
  }

  /**
   * Get queue status
   * @returns {object} Queue status
   */
  getQueueStatus() {
    return {
      high: {
        length: this.highQueue.length,
        maxSize: this.maxQueueSize
      },
      normal: {
        length: this.normalQueue.length,
        maxSize: this.maxQueueSize
      },
      isProcessing: this.isProcessing
    };
  }
}

export default ActionRouter;
