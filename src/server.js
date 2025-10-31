import { MIDIManager } from './managers/MIDIManager.js';
import { HIDManager } from './managers/HIDManager.js';
import { ActionMapper } from './mapping/ActionMapper.js';
import { ActionRouter } from './mapping/ActionRouter.js';
import { AudioEngineClient } from './websocket/AudioEngineClient.js';
import { FeedbackManager } from './feedback/FeedbackManager.js';
import { logger } from './utils/logger.js';
import { loadConfig } from './utils/config.js';

/**
 * Mismo DJ Controller Server
 * Handles physical DJ controller input (MIDI and HID devices)
 */
class ControllerServer {
  constructor() {
    this.config = null;
    this.midiManager = null;
    this.hidManager = null;
    this.mapper = null;
    this.router = null;
    this.audioClient = null;
    this.feedbackManager = null;
    this.running = false;
  }

  /**
   * Start the Controller Server
   */
  async start() {
    try {
      logger.info('='.repeat(60));
      logger.info('Starting Mismo DJ Controller Server...');
      logger.info('='.repeat(60));

      // Load configuration
      this.config = await loadConfig();
      logger.info('Configuration loaded', {
        audioEngineUrl: this.config.audioEngineUrl,
        debug: this.config.debug
      });

      // Initialize WebSocket client (single connection to Audio Engine)
      logger.info('Initializing Audio Engine WebSocket client...');

      this.audioClient = new AudioEngineClient(this.config.audioEngineUrl);

      // Connect to Audio Engine (with error handling)
      await this.audioClient.connect().catch(error => {
        logger.warn('Failed to connect to Audio Engine (will retry)', { error: error.message });
        return null;
      });

      // Initialize routing (all actions route through Audio Engine)
      logger.info('Initializing action router...');
      this.router = new ActionRouter({
        audio: this.audioClient
      });

      // Initialize MIDI
      logger.info('Initializing MIDI manager...');
      this.midiManager = new MIDIManager();

      // Initialize HID
      logger.info('Initializing HID manager...');
      this.hidManager = new HIDManager();

      // Initialize action mapper
      logger.info('Loading device mappings...');
      this.mapper = new ActionMapper(this.config.mappingsPath);

      try {
        await this.mapper.loadAllMappings();
      } catch (error) {
        logger.warn('Failed to load device mappings', { error: error.message });
      }

      // Connect MIDI input to router
      this.midiManager.on('input', async (event) => {
        await this._handleMIDIInput(event);
      });

      // Handle device connections
      this.midiManager.on('device:connected', async (info) => {
        logger.info('MIDI device connected', info);

        // Sync feedback to new device
        if (this.feedbackManager) {
          await this.feedbackManager.syncDevice(info.deviceId);
        }
      });

      this.midiManager.on('device:disconnected', (info) => {
        logger.info('MIDI device disconnected', info);

        // Clean up translator
        this.mapper.removeTranslator(info.deviceId);
      });

      // Connect HID input to router
      this.hidManager.on('input', async (event) => {
        await this._handleHIDInput(event);
      });

      // Handle HID device connections
      this.hidManager.on('device:connected', async (info) => {
        logger.info('HID device connected', info);

        // Sync feedback to new device
        if (this.feedbackManager) {
          await this.feedbackManager.syncDevice(info.deviceId);
        }
      });

      this.hidManager.on('device:disconnected', (info) => {
        logger.info('HID device disconnected', info);

        // Clean up translator
        this.mapper.removeTranslator(info.deviceId);
      });

      // Initialize feedback manager
      logger.info('Initializing feedback manager...');
      this.feedbackManager = new FeedbackManager(
        this.midiManager,
        this.hidManager,
        {
          audio: this.audioClient
        }
      );

      await this.feedbackManager.initialize();

      // Scan and connect MIDI devices
      logger.info('Scanning for MIDI devices...');
      const devices = await this.midiManager.scanDevices();

      if (devices.inputs.length === 0 && devices.outputs.length === 0) {
        logger.warn('No MIDI devices found');
      } else {
        // Auto-connect to available devices
        for (const deviceName of devices.inputs) {
          try {
            // Try to find matching mapping
            const mapping = this.mapper.findMatchingMapping(deviceName);

            if (mapping) {
              logger.info(`Found mapping for ${deviceName}: ${mapping.device.name}`);
              await this.midiManager.connectDevice(deviceName, mapping);
            } else {
              // Try connecting with generic mapping
              logger.info(`Using generic mapping for ${deviceName}`);
              const genericMapping = await this.mapper.loadMapping('generic-midi').catch(() => null);

              if (genericMapping) {
                await this.midiManager.connectDevice(deviceName, genericMapping);
              } else {
                logger.warn(`No mapping available for ${deviceName}, skipping`);
              }
            }
          } catch (error) {
            logger.error(`Failed to connect to ${deviceName}`, { error: error.message });
          }
        }
      }

      // Scan and connect HID devices
      logger.info('Scanning for HID devices...');
      const hidDevices = await this.hidManager.scanDevices();

      if (hidDevices.length === 0) {
        logger.warn('No HID devices found');
      } else {
        // Auto-connect to available HID devices
        for (const hidDevice of hidDevices) {
          try {
            // Try to find matching mapping by vendor/product ID
            const vendorId = `0x${hidDevice.vendorId?.toString(16)}`;
            const productId = `0x${hidDevice.productId?.toString(16)}`;

            const mapping = this.mapper.findMatchingMapping(
              hidDevice.product || 'Unknown',
              vendorId,
              productId
            );

            if (mapping) {
              logger.info(`Found mapping for ${hidDevice.manufacturer} ${hidDevice.product}: ${mapping.device.name}`);
              await this.hidManager.connectDevice(hidDevice.path, mapping);
            } else {
              logger.warn(`No mapping available for ${hidDevice.manufacturer} ${hidDevice.product} (${vendorId}:${productId}), skipping`);
            }
          } catch (error) {
            logger.error(`Failed to connect to ${hidDevice.product}`, { error: error.message });
          }
        }
      }

      // Set up graceful shutdown
      this._setupShutdownHandlers();

      this.running = true;

      logger.info('='.repeat(60));
      logger.info('Controller Server started successfully');
      logger.info('Connected MIDI devices:', this.midiManager.getConnectedDevices().length);
      logger.info('Connected HID devices:', this.hidManager.getConnectedDevices().length);
      logger.info('Available mappings:', this.mapper.getAvailableMappings().length);
      logger.info('WebSocket connection:');
      logger.info(`  - Audio Engine: ${this.audioClient.isConnected() ? 'Connected' : 'Disconnected'}`);
      logger.info('='.repeat(60));

      // Log stats periodically
      if (this.config.debug) {
        this._startStatsLogging();
      }
    } catch (error) {
      logger.error('Failed to start Controller Server', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle MIDI input event
   * @private
   */
  async _handleMIDIInput(event) {
    try {
      // Get device info
      const devices = this.midiManager.getConnectedDevices();
      const device = devices.find(d => d.deviceId === event.deviceId);

      if (!device) {
        logger.warn('Received input from unknown device', { deviceId: event.deviceId });
        return;
      }

      // Get or create translator
      const translator = await this.mapper.getTranslator(event.deviceId, device.name);

      // Translate MIDI event to action
      const action = translator.translate(event);

      if (!action) {
        // No mapping for this input
        return;
      }

      if (this.config.debug) {
        logger.debug('Action translated', {
          device: device.name,
          action: action.type,
          command: action.command,
          deck: action.deck,
          target: action.target,
          priority: action.priority
        });
      }

      // Route action (Audio Engine will forward to App/UI as needed)
      await this.router.route(action);
    } catch (error) {
      logger.error('Error handling MIDI input', {
        error: error.message,
        event
      });
    }
  }

  /**
   * Handle HID input event
   * @private
   */
  async _handleHIDInput(event) {
    try {
      // Get device info
      const devices = this.hidManager.getConnectedDevices();
      const device = devices.find(d => d.deviceId === event.deviceId);

      if (!device) {
        logger.warn('Received input from unknown HID device', { deviceId: event.deviceId });
        return;
      }

      // Get or create translator
      const translator = await this.mapper.getTranslator(event.deviceId, device.product);

      // Translate HID event to action
      const action = translator.translate(event);

      if (!action) {
        // No mapping for this input
        return;
      }

      if (this.config.debug) {
        logger.debug('Action translated', {
          device: device.product,
          action: action.type,
          command: action.command,
          deck: action.deck,
          target: action.target,
          priority: action.priority
        });
      }

      // Route action (Audio Engine will forward to App/UI as needed)
      await this.router.route(action);
    } catch (error) {
      logger.error('Error handling HID input', {
        error: error.message,
        event
      });
    }
  }

  /**
   * Set up graceful shutdown handlers
   * @private
   */
  _setupShutdownHandlers() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      await this.stop();

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Start periodic stats logging
   * @private
   */
  _startStatsLogging() {
    setInterval(() => {
      const stats = this.router.getStats();
      const queueStatus = this.router.getQueueStatus();

      logger.info('Router stats', {
        totalActions: stats.totalActions,
        droppedActions: stats.droppedActions,
        queueSizes: queueStatus
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop the Controller Server
   */
  async stop() {
    if (!this.running) {
      return;
    }

    logger.info('Stopping Controller Server...');

    this.running = false;

    // Disconnect all MIDI devices
    if (this.midiManager) {
      await this.midiManager.disconnectAll();
    }

    // Disconnect all HID devices
    if (this.hidManager) {
      await this.hidManager.disconnectAll();
    }

    // Disconnect WebSocket client
    if (this.audioClient) {
      await this.audioClient.disconnect();
    }

    logger.info('Controller Server stopped');
  }
}

// Start server
const server = new ControllerServer();

server.start().catch(error => {
  logger.error('Failed to start server:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

export default ControllerServer;
