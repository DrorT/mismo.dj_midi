import easymidi from 'easymidi';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

/**
 * Manages MIDI device connections and event handling
 *
 * Features:
 * - Auto-detect connected MIDI devices
 * - Hot-plug support (detect new devices)
 * - Event emission for normalized MIDI events
 * - Send MIDI output for LED feedback
 */
export class MIDIManager extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map(); // deviceId -> { input, output, config, name }
    this.knownDevices = new Set();

    // 14-bit CC tracking: deviceId -> { controller -> { msb, lsb, timestamp } }
    this.highResCCState = new Map();
    this.highResCCTimeout = 50; // ms - time window to pair MSB/LSB
  }

  /**
   * Scan for available MIDI devices
   * @returns {Promise<Array>} List of available device names
   */
  async scanDevices() {
    try {
      const inputs = easymidi.getInputs();
      const outputs = easymidi.getOutputs();

      logger.info('MIDI scan results', {
        inputs: inputs.length,
        outputs: outputs.length,
        inputNames: inputs,
        outputNames: outputs
      });

      return {
        inputs,
        outputs
      };
    } catch (error) {
      logger.error('Failed to scan MIDI devices', { error: error.message });
      throw error;
    }
  }

  /**
   * Connect to a specific MIDI device by name
   * @param {string} deviceName - MIDI device name
   * @param {object} config - Device configuration
   * @returns {Promise<string>} Device ID
   */
  async connectDevice(deviceName, config) {
    try {
      const deviceId = `midi-${deviceName}`;

      // Check if already connected
      if (this.devices.has(deviceId)) {
        logger.warn(`Device ${deviceName} already connected`);
        return deviceId;
      }

      // Try to open input and output
      let input = null;
      let output = null;

      try {
        const inputs = easymidi.getInputs();
        if (inputs.includes(deviceName)) {
          input = new easymidi.Input(deviceName);
          logger.info(`Opened MIDI input: ${deviceName}`);
        }
      } catch (error) {
        logger.warn(`Could not open MIDI input for ${deviceName}: ${error.message}`);
      }

      try {
        const outputs = easymidi.getOutputs();
        if (outputs.includes(deviceName)) {
          output = new easymidi.Output(deviceName);
          logger.info(`Opened MIDI output: ${deviceName}`);
        }
      } catch (error) {
        logger.warn(`Could not open MIDI output for ${deviceName}: ${error.message}`);
      }

      if (!input && !output) {
        throw new Error(`Could not open MIDI device ${deviceName} for input or output`);
      }

      // Store device info
      this.devices.set(deviceId, {
        input,
        output,
        config,
        name: deviceName
      });

      this.knownDevices.add(deviceName);

      // Set up event handlers for input
      if (input) {
        this._setupInputHandlers(deviceId, input);
      }

      this.emit('device:connected', { deviceId, name: deviceName, hasInput: !!input, hasOutput: !!output });
      logger.info(`MIDI device connected: ${deviceName} (ID: ${deviceId})`);

      return deviceId;
    } catch (error) {
      logger.error(`Failed to connect to MIDI device ${deviceName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Disconnect a MIDI device
   * @param {string} deviceId - Device ID
   */
  async disconnectDevice(deviceId) {
    const device = this.devices.get(deviceId);

    if (!device) {
      logger.warn(`Device ${deviceId} not found`);
      return;
    }

    try {
      if (device.input) {
        device.input.close();
      }

      if (device.output) {
        device.output.close();
      }

      this.devices.delete(deviceId);
      this.knownDevices.delete(device.name);

      this.emit('device:disconnected', { deviceId, name: device.name });
      logger.info(`MIDI device disconnected: ${device.name} (ID: ${deviceId})`);
    } catch (error) {
      logger.error(`Error disconnecting device ${deviceId}`, { error: error.message });
    }
  }

  /**
   * Send MIDI message to device
   * @param {string} deviceId - Device ID
   * @param {object} message - MIDI message { type, channel, note/controller, velocity/value }
   */
  sendMIDI(deviceId, message) {
    const device = this.devices.get(deviceId);

    if (!device || !device.output) {
      logger.warn(`Cannot send MIDI to ${deviceId}: device not found or no output`);
      return false;
    }

    try {
      device.output.send(message.type, {
        channel: message.channel,
        note: message.note,
        controller: message.controller,
        velocity: message.velocity,
        value: message.value
      });

      return true;
    } catch (error) {
      logger.error(`Failed to send MIDI message to ${deviceId}`, { error: error.message, message });
      return false;
    }
  }

  /**
   * Set up input event handlers for a device
   * @private
   */
  _setupInputHandlers(deviceId, input) {
    // Note On events
    input.on('noteon', (msg) => {
      logger.info('[MIDI IN] Note On', {
        deviceId,
        channel: msg.channel,
        note: msg.note,
        velocity: msg.velocity
      });
      const normalized = this._normalizeMIDIMessage(deviceId, 'noteon', msg);
      this.emit('input', normalized);
    });

    // Note Off events
    input.on('noteoff', (msg) => {
      logger.info('[MIDI IN] Note Off', {
        deviceId,
        channel: msg.channel,
        note: msg.note,
        velocity: msg.velocity
      });
      const normalized = this._normalizeMIDIMessage(deviceId, 'noteoff', msg);
      this.emit('input', normalized);
    });

    // Control Change events
    input.on('cc', (msg) => {
      logger.info('[MIDI IN] CC', {
        deviceId,
        channel: msg.channel,
        controller: msg.controller,
        value: msg.value
      });
      const normalized = this._normalizeMIDIMessage(deviceId, 'cc', msg);

      // Check if this might be part of a 14-bit CC message
      const processed = this._handle14BitCC(deviceId, normalized);

      if (processed) {
        // Emit the combined 14-bit message
        this.emit('input', processed);
      } else {
        // Emit as regular 7-bit CC (might be MSB waiting for LSB)
        this.emit('input', normalized);
      }
    });

    // Pitch Bend events
    input.on('pitch', (msg) => {
      logger.info('[MIDI IN] Pitch Bend', {
        deviceId,
        channel: msg.channel,
        value: msg.value
      });
      const normalized = this._normalizeMIDIMessage(deviceId, 'pitch', msg);
      this.emit('input', normalized);
    });

    // Program Change events
    input.on('program', (msg) => {
      logger.info('[MIDI IN] Program Change', {
        deviceId,
        channel: msg.channel,
        program: msg.number
      });
      const normalized = this._normalizeMIDIMessage(deviceId, 'program', msg);
      this.emit('input', normalized);
    });
  }

  /**
   * Normalize MIDI message to common format
   * @private
   */
  _normalizeMIDIMessage(deviceId, type, rawMessage) {
    const normalized = {
      deviceId,
      type,
      channel: rawMessage.channel,
      timestamp: Date.now(),
      rawMessage
    };

    // Add type-specific fields
    switch (type) {
      case 'noteon':
      case 'noteoff':
        normalized.note = rawMessage.note;
        normalized.velocity = rawMessage.velocity;
        break;

      case 'cc':
        normalized.controller = rawMessage.controller;
        normalized.value = rawMessage.value;
        break;

      case 'pitch':
        normalized.value = rawMessage.value;
        break;

      case 'program':
        normalized.program = rawMessage.number;
        break;
    }

    return normalized;
  }

  /**
   * Get all connected devices
   * @returns {Array} List of device info objects
   */
  getConnectedDevices() {
    return Array.from(this.devices.entries()).map(([deviceId, device]) => ({
      deviceId,
      name: device.name,
      hasInput: !!device.input,
      hasOutput: !!device.output,
      config: device.config
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

    logger.info('All MIDI devices disconnected');
  }

  /**
   * Handle 14-bit CC messages (MSB + LSB pairing)
   * @private
   * @param {string} deviceId - Device ID
   * @param {object} ccMessage - Normalized CC message
   * @returns {object|null} Combined 14-bit message or null if not ready
   */
  _handle14BitCC(deviceId, ccMessage) {
    if (ccMessage.type !== 'cc') {
      return null;
    }

    const controller = ccMessage.controller;
    const value = ccMessage.value;
    const channel = ccMessage.channel;

    // Initialize device state if needed
    if (!this.highResCCState.has(deviceId)) {
      this.highResCCState.set(deviceId, new Map());
    }

    const deviceState = this.highResCCState.get(deviceId);

    // Check if this is an LSB (controllers 32-63 are LSBs for 0-31)
    const isLSB = controller >= 32 && controller < 64;
    const msbController = isLSB ? controller - 32 : controller;
    const lsbController = msbController + 32;

    if (isLSB) {
      // This is an LSB - check if we have a recent MSB
      const key = `${channel}:${msbController}`;
      const msbData = deviceState.get(key);

      if (msbData && (Date.now() - msbData.timestamp < this.highResCCTimeout)) {
        // We have a matching MSB! Combine them
        const combinedValue = (msbData.value * 128) + value;

        // Clear the MSB from state
        deviceState.delete(key);

        // Return combined 14-bit message
        return {
          ...ccMessage,
          controller: msbController, // Use MSB controller number
          value: combinedValue,
          value14bit: combinedValue,
          maxValue: 16383,
          normalized: combinedValue / 16383,
          highRes: true,
          lsbController: lsbController,
          msb: msbData.value,
          lsb: value
        };
      }
    } else if (controller < 32) {
      // This might be an MSB - store it and wait for LSB
      const key = `${channel}:${controller}`;
      deviceState.set(key, {
        value: value,
        timestamp: Date.now(),
        channel: channel
      });

      // Clean up old entries (older than timeout)
      const now = Date.now();
      for (const [k, v] of deviceState.entries()) {
        if (now - v.timestamp > this.highResCCTimeout) {
          deviceState.delete(k);
        }
      }
    }

    // Not a 14-bit pair (yet) - return null to use as regular 7-bit
    return null;
  }
}

export default MIDIManager;
