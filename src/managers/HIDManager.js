import HID from 'node-hid';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

/**
 * Manages HID device connections and polling
 *
 * Features:
 * - Auto-detect HID DJ controllers
 * - High-frequency polling for jog wheels (125Hz+)
 * - State diffing to detect changes
 * - Output for displays and LEDs
 */
export class HIDManager extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map(); // deviceId -> { device, config, state, pollInterval, parser }
    this.pollingIntervals = new Map(); // deviceId -> intervalId
    this.knownDevices = new Set(); // Track known device paths to avoid duplicates
  }

  /**
   * Scan for available HID devices
   * @param {object} filters - Optional filters { vendorId, productId }
   * @returns {Promise<Array>} List of matching HID devices
   */
  async scanDevices(filters = {}) {
    try {
      const allDevices = HID.devices();

      // Filter for DJ controllers if no specific filters provided
      let devices = allDevices;

      if (filters.vendorId || filters.productId) {
        devices = allDevices.filter(d => {
          const vendorMatch = !filters.vendorId || d.vendorId === filters.vendorId;
          const productMatch = !filters.productId || d.productId === filters.productId;
          return vendorMatch && productMatch;
        });
      } else {
        // Auto-detect known DJ controller vendors
        const knownVendors = [
          0x17cc, // Native Instruments
          0x2b73, // Pioneer DJ
          0x06f8, // Guillemot (Hercules)
          0x0763, // M-Audio
          0x0944, // Korg
          0x09e8, // AKAI
        ];

        devices = allDevices.filter(d =>
          knownVendors.includes(d.vendorId) ||
          d.manufacturer?.toLowerCase().includes('native') ||
          d.manufacturer?.toLowerCase().includes('pioneer') ||
          d.product?.toLowerCase().includes('kontrol') ||
          d.product?.toLowerCase().includes('ddj') ||
          d.product?.toLowerCase().includes('traktor')
        );
      }

      logger.info('HID scan results', {
        total: allDevices.length,
        matched: devices.length,
        devices: devices.map(d => ({
          manufacturer: d.manufacturer,
          product: d.product,
          vendorId: `0x${d.vendorId?.toString(16)}`,
          productId: `0x${d.productId?.toString(16)}`,
          path: d.path,
          interface: d.interface
        }))
      });

      return devices;
    } catch (error) {
      logger.error('Failed to scan HID devices', { error: error.message });
      throw error;
    }
  }

  /**
   * Connect to a specific HID device
   * @param {string} path - HID device path
   * @param {object} config - Device configuration (mapping)
   * @returns {Promise<string>} Device ID
   */
  async connectDevice(path, config) {
    try {
      // Check if already connected
      if (this.knownDevices.has(path)) {
        logger.warn(`HID device at ${path} already connected`);
        return this._getDeviceIdByPath(path);
      }

      // Open HID device
      const device = new HID.HID(path);

      const deviceId = `hid-${config.device.name.toLowerCase().replace(/\s+/g, '-')}-${path.split('/').pop()}`;

      // Get device info
      const manufacturer = device.getDeviceInfo?.()?.manufacturer || config.device.vendor || 'Unknown';
      const product = device.getDeviceInfo?.()?.product || config.device.name || 'Unknown';

      logger.info(`Opened HID device: ${manufacturer} ${product}`, {
        deviceId,
        path
      });

      // Initialize state tracking
      const initialState = {};

      // Store device info
      this.devices.set(deviceId, {
        device,
        config,
        path,
        manufacturer,
        product,
        state: initialState,
        previousState: {},
        parser: this._createParser(config)
      });

      this.knownDevices.add(path);

      // Set up error handlers
      device.on('error', (error) => {
        logger.error(`HID device error: ${deviceId}`, { error: error.message });
        this._handleDeviceError(deviceId, error);
      });

      // Start polling based on config
      this._startPolling(deviceId);

      this.emit('device:connected', {
        deviceId,
        manufacturer,
        product,
        path,
        protocol: 'hid'
      });

      logger.info(`HID device connected: ${manufacturer} ${product} (ID: ${deviceId})`);

      return deviceId;
    } catch (error) {
      logger.error(`Failed to connect to HID device at ${path}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Disconnect an HID device
   * @param {string} deviceId - Device ID
   */
  async disconnectDevice(deviceId) {
    const deviceInfo = this.devices.get(deviceId);

    if (!deviceInfo) {
      logger.warn(`HID device ${deviceId} not found`);
      return;
    }

    try {
      // Stop polling
      this._stopPolling(deviceId);

      // Close device
      if (deviceInfo.device) {
        deviceInfo.device.close();
      }

      this.devices.delete(deviceId);
      this.knownDevices.delete(deviceInfo.path);

      this.emit('device:disconnected', {
        deviceId,
        manufacturer: deviceInfo.manufacturer,
        product: deviceInfo.product
      });

      logger.info(`HID device disconnected: ${deviceInfo.manufacturer} ${deviceInfo.product} (ID: ${deviceId})`);
    } catch (error) {
      logger.error(`Error disconnecting HID device ${deviceId}`, { error: error.message });
    }
  }

  /**
   * Send HID output report (LEDs, displays)
   * @param {string} deviceId - Device ID
   * @param {number} reportId - Report ID
   * @param {Buffer|Array} data - Output data
   */
  sendHID(deviceId, reportId, data) {
    const deviceInfo = this.devices.get(deviceId);

    if (!deviceInfo || !deviceInfo.device) {
      logger.warn(`Cannot send HID output to ${deviceId}: device not found`);
      return false;
    }

    try {
      // Ensure data is a Buffer
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

      // Prepend report ID if needed
      const outputData = [reportId, ...buffer];

      deviceInfo.device.write(outputData);

      return true;
    } catch (error) {
      logger.error(`Failed to send HID output to ${deviceId}`, {
        error: error.message,
        reportId
      });
      return false;
    }
  }

  /**
   * Start polling device at configured intervals
   * @private
   */
  _startPolling(deviceId) {
    const deviceInfo = this.devices.get(deviceId);
    if (!deviceInfo) return;

    const config = deviceInfo.config;

    // Determine polling interval
    // Use fastest interval specified in config (for jog wheels)
    const pollingConfig = config.device.polling || { default: 8 };
    const intervalMs = Math.min(
      pollingConfig.jogWheels || pollingConfig.default || 8,
      pollingConfig.buttons || pollingConfig.default || 16,
      pollingConfig.faders || pollingConfig.default || 16
    );

    logger.info(`Starting HID polling for ${deviceId}`, { intervalMs });

    // Start polling
    const intervalId = setInterval(() => {
      this._pollDevice(deviceId);
    }, intervalMs);

    this.pollingIntervals.set(deviceId, intervalId);
  }

  /**
   * Stop polling device
   * @private
   */
  _stopPolling(deviceId) {
    const intervalId = this.pollingIntervals.get(deviceId);

    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(deviceId);
      logger.debug(`Stopped polling for ${deviceId}`);
    }
  }

  /**
   * Poll device and compute state deltas
   * @private
   */
  _pollDevice(deviceId) {
    const deviceInfo = this.devices.get(deviceId);
    if (!deviceInfo) return;

    try {
      // Read data from device (non-blocking read with timeout)
      const data = deviceInfo.device.readTimeout(10); // 10ms timeout

      if (!data || data.length === 0) {
        // No data available
        return;
      }

      // Parse report into structured state
      const currentState = deviceInfo.parser(data);

      if (!currentState) {
        // Failed to parse
        return;
      }

      // Compute deltas from previous state
      const deltas = this._computeDeltas(deviceId, currentState);

      // Update state
      deviceInfo.previousState = deviceInfo.state;
      deviceInfo.state = currentState;

      // Emit input events for each change
      for (const delta of deltas) {
        const event = {
          deviceId,
          control: delta.control,
          type: delta.type,
          value: delta.value,
          delta: delta.delta,
          timestamp: Date.now(),
          rawState: currentState
        };

        this.emit('input', event);
      }
    } catch (error) {
      // Only log errors if not a timeout/no-data situation
      if (error.message && !error.message.includes('could not read') && !error.message.includes('EAGAIN')) {
        logger.error(`Error polling HID device ${deviceId}`, {
          error: error.message
        });
      }
    }
  }

  /**
   * Create parser function from device config
   * @private
   */
  _createParser(config) {
    const parsingConfig = config.parsing;

    return (data) => {
      try {
        const state = {};

        // Parse each control defined in config
        for (const [controlName, controlConfig] of Object.entries(parsingConfig.controls)) {
          let value;

          if (controlConfig.type === 'button') {
            // Single bit button
            const byte = data[controlConfig.byte];
            if (byte === undefined) continue;

            value = (byte >> controlConfig.bit) & 0x01;
          } else if (controlConfig.bytes) {
            // Multi-byte value (e.g., jog wheel, fader)
            let rawValue = 0;

            for (let i = 0; i < controlConfig.bytes.length; i++) {
              const byteIndex = controlConfig.bytes[i];
              const byte = data[byteIndex];

              if (byte === undefined) continue;

              // Build multi-byte value (assume little-endian unless specified)
              rawValue |= (byte << (i * 8));
            }

            // Handle signed values (for jog wheel deltas)
            if (controlConfig.signed && controlConfig.resolution) {
              const maxVal = 1 << controlConfig.resolution;
              if (rawValue >= maxVal / 2) {
                rawValue -= maxVal;
              }
            }

            value = rawValue;
          } else if (controlConfig.byte !== undefined) {
            // Single byte value
            value = data[controlConfig.byte];
          }

          state[controlName] = {
            value,
            type: controlConfig.type,
            config: controlConfig
          };
        }

        return state;
      } catch (error) {
        logger.error('Failed to parse HID report', {
          error: error.message,
          dataLength: data.length
        });
        return null;
      }
    };
  }

  /**
   * Compute deltas between current and previous state
   * @private
   */
  _computeDeltas(deviceId, currentState) {
    const deviceInfo = this.devices.get(deviceId);
    if (!deviceInfo) return [];

    const previousState = deviceInfo.previousState || {};
    const deltas = [];

    for (const [controlName, controlState] of Object.entries(currentState)) {
      const previousValue = previousState[controlName]?.value;
      const currentValue = controlState.value;

      // Check if value changed
      if (previousValue !== currentValue) {
        const delta = {
          control: controlName,
          type: controlState.type,
          value: currentValue,
          previousValue: previousValue
        };

        // For delta-type controls (jog wheels), compute the delta
        if (controlState.type === 'delta') {
          delta.delta = currentValue;
          delta.value = (previousState[controlName]?.absolutePosition || 0) + currentValue;

          // Store absolute position for next iteration
          controlState.absolutePosition = delta.value;
        } else {
          // For absolute controls, delta is the difference
          delta.delta = currentValue - (previousValue || 0);
        }

        deltas.push(delta);
      }
    }

    return deltas;
  }

  /**
   * Handle device errors (disconnection, etc.)
   * @private
   */
  _handleDeviceError(deviceId, error) {
    logger.warn(`HID device ${deviceId} error, attempting disconnect`, {
      error: error.message
    });

    // Disconnect device on error
    this.disconnectDevice(deviceId).catch(err => {
      logger.error(`Failed to disconnect errored device ${deviceId}`, {
        error: err.message
      });
    });
  }

  /**
   * Get device ID by path
   * @private
   */
  _getDeviceIdByPath(path) {
    for (const [deviceId, deviceInfo] of this.devices.entries()) {
      if (deviceInfo.path === path) {
        return deviceId;
      }
    }
    return null;
  }

  /**
   * Get all connected devices
   * @returns {Array} List of device info objects
   */
  getConnectedDevices() {
    return Array.from(this.devices.entries()).map(([deviceId, deviceInfo]) => ({
      deviceId,
      manufacturer: deviceInfo.manufacturer,
      product: deviceInfo.product,
      path: deviceInfo.path,
      protocol: 'hid',
      config: deviceInfo.config
    }));
  }

  /**
   * Disconnect all devices
   */
  async disconnectAll() {
    const deviceIds = Array.from(this.devices.keys());

    for (const deviceId of deviceIds) {
      await this.disconnectDevice(deviceId);
    }

    logger.info('All HID devices disconnected');
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId) {
    return this.devices.get(deviceId);
  }
}

export default HIDManager;
