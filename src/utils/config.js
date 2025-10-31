import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

/**
 * Load configuration from environment and config files
 * @returns {Promise<object>} Configuration object
 */
export async function loadConfig() {
  const configPath = path.join(__dirname, '../../config/server.json');

  let serverConfig = {};
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    serverConfig = JSON.parse(data);
  } catch (error) {
    // If config file doesn't exist, use defaults
    console.warn(`Config file not found at ${configPath}, using defaults`);
  }

  // Merge environment variables with file config
  // Environment variables take precedence
  const config = {
    // Single connection point to Audio Engine
    audioEngineUrl: process.env.AUDIO_ENGINE_URL || serverConfig.audioEngineUrl || 'ws://localhost:8080',

    logLevel: process.env.LOG_LEVEL || serverConfig.logLevel || 'info',
    debug: process.env.DEBUG === 'true' || serverConfig.debug || false,

    mappingsPath: path.join(__dirname, '../../config/devices'),

    // HID polling intervals
    hidJogPollInterval: parseInt(process.env.HID_JOG_POLL_INTERVAL) || serverConfig.hidJogPollInterval || 8,
    hidButtonPollInterval: parseInt(process.env.HID_BUTTON_POLL_INTERVAL) || serverConfig.hidButtonPollInterval || 16,
    hidFaderPollInterval: parseInt(process.env.HID_FADER_POLL_INTERVAL) || serverConfig.hidFaderPollInterval || 16,

    // Performance monitoring
    enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING === 'true' || serverConfig.enablePerformanceMonitoring || false
  };

  return config;
}

/**
 * Load a device mapping configuration
 * @param {string} deviceName - Name of the device (e.g., 'generic-midi')
 * @returns {Promise<object>} Device mapping configuration
 */
export async function loadDeviceMapping(deviceName) {
  const mappingPath = path.join(__dirname, '../../config/devices', `${deviceName}.json`);

  try {
    const data = await fs.readFile(mappingPath, 'utf-8');
    const mapping = JSON.parse(data);
    return mapping;
  } catch (error) {
    throw new Error(`Failed to load device mapping for ${deviceName}: ${error.message}`);
  }
}

/**
 * Validate device mapping configuration
 * @param {object} mapping - Device mapping configuration
 * @throws {Error} If configuration is invalid
 */
export function validateDeviceMapping(mapping) {
  if (!mapping.device) {
    throw new Error('Device mapping must include "device" section');
  }

  if (!mapping.device.name) {
    throw new Error('Device mapping must include "device.name"');
  }

  if (!mapping.device.protocol || !['midi', 'hid'].includes(mapping.device.protocol)) {
    throw new Error('Device mapping must include "device.protocol" (midi or hid)');
  }

  if (!mapping.mappings || typeof mapping.mappings !== 'object') {
    throw new Error('Device mapping must include "mappings" object');
  }

  // Validate each mapping (skip meta-fields starting with _)
  for (const [key, map] of Object.entries(mapping.mappings)) {
    // Skip comment fields and other meta-fields
    if (key.startsWith('_')) {
      continue;
    }

    if (!map.action) {
      throw new Error(`Mapping "${key}" must include "action" section`);
    }

    if (!map.target || !['audio', 'app', 'ui'].includes(map.target)) {
      throw new Error(`Mapping "${key}" must include "target" (audio, app, or ui)`);
    }

    if (!map.priority || !['critical', 'high', 'normal'].includes(map.priority)) {
      throw new Error(`Mapping "${key}" must include "priority" (critical, high, or normal)`);
    }
  }
}

export default { loadConfig, loadDeviceMapping, validateDeviceMapping };
