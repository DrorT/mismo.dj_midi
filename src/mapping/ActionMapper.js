import { loadDeviceMapping, validateDeviceMapping } from '../utils/config.js';
import { MIDITranslator } from '../translators/MIDITranslator.js';
import { HIDTranslator } from '../translators/HIDTranslator.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Loads device mappings from config files
 * Provides lookup for MIDI/HID -> Action translation
 */
export class ActionMapper {
  constructor(configPath) {
    this.configPath = configPath;
    this.translators = new Map(); // deviceId -> translator
    this.deviceMappings = new Map(); // deviceName -> mapping config
  }

  /**
   * Load mapping config for a device by name
   * @param {string} deviceName - Device name (e.g., 'generic-midi')
   * @returns {Promise<object>} Mapping configuration
   */
  async loadMapping(deviceName) {
    try {
      const mapping = await loadDeviceMapping(deviceName);

      // Validate mapping
      validateDeviceMapping(mapping);

      // Cache the mapping
      this.deviceMappings.set(deviceName, mapping);

      logger.info(`Loaded mapping for ${deviceName}`, {
        mappingCount: Object.keys(mapping.mappings).length
      });

      return mapping;
    } catch (error) {
      logger.error(`Failed to load mapping for ${deviceName}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Load all device mappings from config directory
   * @returns {Promise<Array>} List of loaded device names
   */
  async loadAllMappings() {
    try {
      const files = await fs.readdir(this.configPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      const loaded = [];

      for (const file of jsonFiles) {
        const deviceName = path.basename(file, '.json');

        try {
          await this.loadMapping(deviceName);
          loaded.push(deviceName);
        } catch (error) {
          logger.warn(`Skipping invalid mapping file: ${file}`, {
            error: error.message
          });
        }
      }

      logger.info(`Loaded ${loaded.length} device mappings`, { devices: loaded });

      return loaded;
    } catch (error) {
      logger.error('Failed to load device mappings', {
        configPath: this.configPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get or create translator for a device
   * @param {string} deviceId - Device ID
   * @param {string} deviceName - Device name (for loading mapping)
   * @returns {Promise<MIDITranslator>} Translator instance
   */
  async getTranslator(deviceId, deviceName) {
    // Check if translator already exists
    if (this.translators.has(deviceId)) {
      return this.translators.get(deviceId);
    }

    // Try to find matching mapping from already-loaded mappings
    let mapping = this.findMatchingMapping(deviceName);

    if (!mapping) {
      // If no match found, try to load mapping file directly
      try {
        mapping = await this.loadMapping(deviceName);
      } catch (error) {
        // If specific mapping not found, try generic-midi
        logger.warn(`No specific mapping for ${deviceName}, trying generic-midi`);

        try {
          mapping = await this.loadMapping('generic-midi');
        } catch (genericError) {
          throw new Error(`No mapping found for ${deviceName} and generic-midi not available`);
        }
      }
    }

    // Create translator based on protocol
    let translator;

    if (mapping.device.protocol === 'midi') {
      translator = new MIDITranslator(mapping);
    } else if (mapping.device.protocol === 'hid') {
      translator = new HIDTranslator(mapping);
    } else {
      throw new Error(`Unknown protocol: ${mapping.device.protocol}`);
    }

    // Cache translator
    this.translators.set(deviceId, translator);

    logger.info(`Created translator for ${deviceName}`, { deviceId });

    return translator;
  }

  /**
   * Remove translator for a device
   * @param {string} deviceId - Device ID
   */
  removeTranslator(deviceId) {
    if (this.translators.has(deviceId)) {
      this.translators.delete(deviceId);
      logger.debug(`Removed translator for ${deviceId}`);
    }
  }

  /**
   * Reload a specific mapping configuration
   * @param {string} deviceName - Device name
   * @returns {Promise<void>}
   */
  async reloadMapping(deviceName) {
    logger.info(`Reloading mapping for ${deviceName}`);

    // Clear cached mapping
    this.deviceMappings.delete(deviceName);

    // Find all translators using this mapping
    const devicesToUpdate = [];

    for (const [deviceId, translator] of this.translators.entries()) {
      if (translator.getDeviceName() === deviceName) {
        devicesToUpdate.push(deviceId);
      }
    }

    // Load new mapping
    const mapping = await this.loadMapping(deviceName);

    // Update translators
    for (const deviceId of devicesToUpdate) {
      this.translators.delete(deviceId);

      // Create translator based on protocol
      const newTranslator = mapping.device.protocol === 'midi'
        ? new MIDITranslator(mapping)
        : new HIDTranslator(mapping);

      this.translators.set(deviceId, newTranslator);

      logger.info(`Updated translator for ${deviceId} with new mapping`);
    }
  }

  /**
   * Reload all mappings
   * @returns {Promise<void>}
   */
  async reloadAllMappings() {
    logger.info('Reloading all mappings');

    // Clear all caches
    this.deviceMappings.clear();
    this.translators.clear();

    // Reload all mappings
    await this.loadAllMappings();

    logger.info('All mappings reloaded');
  }

  /**
   * Get available device mappings
   * @returns {Array<object>} List of device info
   */
  getAvailableMappings() {
    return Array.from(this.deviceMappings.values()).map(mapping => ({
      name: mapping.device.name,
      protocol: mapping.device.protocol,
      vendor: mapping.device.vendor,
      product: mapping.device.product,
      mappingCount: Object.keys(mapping.mappings).length
    }));
  }

  /**
   * Find best matching mapping for a device
   * @param {string} deviceName - Device name
   * @param {string} vendor - Vendor ID (for HID)
   * @param {string} product - Product ID (for HID)
   * @returns {object|null} Matching mapping or null
   */
  findMatchingMapping(deviceName, vendor = null, product = null) {
    // First try exact name match
    if (this.deviceMappings.has(deviceName)) {
      return this.deviceMappings.get(deviceName);
    }

    // Try vendor/product match (for HID devices)
    if (vendor && product) {
      for (const mapping of this.deviceMappings.values()) {
        if (
          mapping.device.vendorId === vendor &&
          mapping.device.productId === product
        ) {
          return mapping;
        }
      }
    }

    // Try partial name match
    const lowerDeviceName = deviceName.toLowerCase();

    for (const [name, mapping] of this.deviceMappings.entries()) {
      const lowerName = name.toLowerCase();

      if (lowerDeviceName.includes(lowerName) || lowerName.includes(lowerDeviceName)) {
        logger.info(`Found partial match for ${deviceName}: ${name}`);
        return mapping;
      }
    }

    return null;
  }
}

export default ActionMapper;
