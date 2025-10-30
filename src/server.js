import { MIDIManager } from './managers/MIDIManager.js';
import { ActionMapper } from './mapping/ActionMapper.js';
import { ActionRouter } from './mapping/ActionRouter.js';
import { AudioEngineClient } from './websocket/AudioEngineClient.js';
import { AppServerClient } from './websocket/AppServerClient.js';
import { WebUIClient } from './websocket/WebUIClient.js';
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
    this.mapper = null;
    this.router = null;
    this.audioClient = null;
    this.appClient = null;
    this.uiClient = null;
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
        appServerUrl: this.config.appServerUrl,
        webUIUrl: this.config.webUIUrl,
        debug: this.config.debug
      });

      // Initialize WebSocket clients
      logger.info('Initializing WebSocket clients...');

      this.audioClient = new AudioEngineClient(this.config.audioEngineUrl);
      this.appClient = new AppServerClient(this.config.appServerUrl);
      this.uiClient = new WebUIClient(this.config.webUIUrl);

      // Connect to downstream services (with error handling)
      const connections = [];

      connections.push(
        this.audioClient.connect().catch(error => {
          logger.warn('Failed to connect to Audio Engine (will retry)', { error: error.message });
          return null;
        })
      );

      connections.push(
        this.appClient.connect().catch(error => {
          logger.warn('Failed to connect to App Server (will retry)', { error: error.message });
          return null;
        })
      );

      connections.push(
        this.uiClient.connect().catch(error => {
          logger.warn('Failed to connect to Web UI (will retry)', { error: error.message });
          return null;
        })
      );

      await Promise.allSettled(connections);

      // Initialize routing
      logger.info('Initializing action router...');
      this.router = new ActionRouter({
        audio: this.audioClient,
        app: this.appClient,
        ui: this.uiClient
      });

      // Initialize MIDI
      logger.info('Initializing MIDI manager...');
      this.midiManager = new MIDIManager();

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

      // Initialize feedback manager
      logger.info('Initializing feedback manager...');
      this.feedbackManager = new FeedbackManager(
        this.midiManager,
        null, // HID manager will be added in Phase 2
        {
          audio: this.audioClient,
          app: this.appClient
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

      // Set up graceful shutdown
      this._setupShutdownHandlers();

      this.running = true;

      logger.info('='.repeat(60));
      logger.info('Controller Server started successfully');
      logger.info('Connected MIDI devices:', this.midiManager.getConnectedDevices().length);
      logger.info('Available mappings:', this.mapper.getAvailableMappings().length);
      logger.info('WebSocket connections:');
      logger.info(`  - Audio Engine: ${this.audioClient.isConnected() ? 'Connected' : 'Disconnected'}`);
      logger.info(`  - App Server: ${this.appClient.isConnected() ? 'Connected' : 'Disconnected'}`);
      logger.info(`  - Web UI: ${this.uiClient.isConnected() ? 'Connected' : 'Disconnected'}`);
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

      // Route action
      await this.router.route(action);

      // Also send to Web UI for visual feedback
      if (this.uiClient.isConnected()) {
        await this.uiClient.send({
          type: 'controller:action',
          device: device.name,
          action
        });
      }
    } catch (error) {
      logger.error('Error handling MIDI input', {
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

    // Disconnect WebSocket clients
    if (this.audioClient) {
      await this.audioClient.disconnect();
    }

    if (this.appClient) {
      await this.appClient.disconnect();
    }

    if (this.uiClient) {
      await this.uiClient.disconnect();
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
