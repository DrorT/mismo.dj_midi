import { logger } from '../utils/logger.js';

/**
 * Translates raw MIDI events into semantic actions
 *
 * Example:
 * Input:  { type: 'noteon', channel: 0, note: 0x10, velocity: 127 }
 * Output: { action: 'play', deck: 'A', value: true, target: 'audio', priority: 'high' }
 */
export class MIDITranslator {
  constructor(mapping) {
    this.mapping = mapping;
    this.deviceName = mapping?.device?.name || 'Unknown';

    // Build reverse lookup: MIDI event -> mapping key
    this.lookupTable = this._buildLookupTable();
  }

  /**
   * Translate MIDI event to action
   * @param {object} midiEvent - Normalized MIDI event from MIDIManager
   * @returns {object|null} Action object or null if no mapping found
   */
  translate(midiEvent) {
    const key = this._createLookupKey(midiEvent);
    const mappingKey = this.lookupTable.get(key);

    if (!mappingKey) {
      // No mapping found for this MIDI event
      if (process.env.DEBUG === 'true') {
        logger.debug('No mapping found for MIDI event', {
          device: this.deviceName,
          type: midiEvent.type,
          channel: midiEvent.channel,
          note: midiEvent.note,
          controller: midiEvent.controller
        });
      }
      return null;
    }

    const mapping = this.mapping.mappings[mappingKey];

    try {
      const action = this._buildAction(midiEvent, mapping);
      return action;
    } catch (error) {
      logger.error('Failed to translate MIDI event', {
        device: this.deviceName,
        mappingKey,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Translate action to MIDI message (for feedback)
   * @param {object} action - Action object
   * @param {string} state - State value (e.g., 'playing', 'stopped')
   * @returns {object|null} MIDI message or null
   */
  actionToMIDI(action, state) {
    // Find mapping that matches this action
    for (const [key, mapping] of Object.entries(this.mapping.mappings)) {
      if (!mapping.feedback) continue;

      // Check if action matches this mapping
      if (this._actionMatches(action, mapping.action)) {
        const feedbackConfig = mapping.feedback;

        if (feedbackConfig.type === 'led' && feedbackConfig.midiOut) {
          // Map state to MIDI value
          let value = feedbackConfig.stateMap?.[state];

          if (value === undefined) {
            // Default: binary on/off
            value = state ? 127 : 0;
          }

          return {
            type: feedbackConfig.midiOut.type,
            channel: feedbackConfig.midiOut.channel,
            note: feedbackConfig.midiOut.note,
            controller: feedbackConfig.midiOut.controller,
            velocity: value,
            value: value
          };
        }
      }
    }

    return null;
  }

  /**
   * Build lookup table for fast MIDI event to mapping resolution
   * @private
   */
  _buildLookupTable() {
    const table = new Map();

    for (const [key, mapping] of Object.entries(this.mapping.mappings)) {
      if (!mapping.midi) continue;

      const lookupKey = this._createLookupKeyFromConfig(mapping.midi);
      table.set(lookupKey, key);
    }

    logger.debug(`Built lookup table for ${this.deviceName}`, {
      entries: table.size
    });

    return table;
  }

  /**
   * Create lookup key from MIDI event
   * @private
   */
  _createLookupKey(midiEvent) {
    const parts = [midiEvent.type, midiEvent.channel];

    if (midiEvent.note !== undefined) {
      parts.push('note', midiEvent.note);
    } else if (midiEvent.controller !== undefined) {
      parts.push('cc', midiEvent.controller);
    }

    return parts.join(':');
  }

  /**
   * Create lookup key from mapping config
   * @private
   */
  _createLookupKeyFromConfig(midiConfig) {
    const parts = [midiConfig.type, midiConfig.channel];

    if (midiConfig.note !== undefined) {
      parts.push('note', midiConfig.note);
    } else if (midiConfig.controller !== undefined) {
      parts.push('cc', midiConfig.controller);
    }

    return parts.join(':');
  }

  /**
   * Build action object from MIDI event and mapping
   * @private
   */
  _buildAction(midiEvent, mapping) {
    const action = {
      type: mapping.action.type,
      command: mapping.action.command,
      target: mapping.target,
      priority: mapping.priority,
      timestamp: midiEvent.timestamp,
      deviceId: midiEvent.deviceId
    };

    // Add deck if specified
    if (mapping.action.deck) {
      action.deck = mapping.action.deck;
    }

    // Add value/delta based on mapping
    if (mapping.action.value !== undefined) {
      // Static value from config
      action.value = mapping.action.value;
    } else if (mapping.action.valueExpression) {
      // Dynamic value from expression
      action.value = this._evaluateExpression(mapping.action.valueExpression, midiEvent);
    } else {
      // Use raw MIDI value or normalized 14-bit value
      if (midiEvent.highRes && midiEvent.normalized !== undefined) {
        // Use pre-normalized 14-bit value (0.0 - 1.0)
        action.value = midiEvent.normalized;
      } else {
        // Standard 7-bit MIDI (normalize to 0.0 - 1.0 for faders)
        const rawValue = midiEvent.velocity || midiEvent.value;
        // For CC messages, normalize to 0-1
        if (midiEvent.type === 'cc') {
          action.value = rawValue / 127;
        } else {
          action.value = rawValue;
        }
      }
    }

    // Handle special cases
    if (mapping.action.direction) {
      // For encoders: determine direction from value
      action.direction = this._evaluateExpression(mapping.action.direction, midiEvent);
    }

    // Normalize button values to boolean
    if (mapping.action.type === 'transport' && midiEvent.type === 'noteon') {
      action.value = midiEvent.velocity > 0;
    }

    return action;
  }

  /**
   * Evaluate simple expression with MIDI event values
   * @private
   */
  _evaluateExpression(expression, midiEvent) {
    // Simple expression evaluator
    // Supports: value > 64 ? 'down' : 'up'
    const value = midiEvent.value || midiEvent.velocity || 0;
    const velocity = midiEvent.velocity || 0;

    try {
      // Use Function constructor for safe evaluation
      // This is safer than eval() but still limited
      const fn = new Function('value', 'velocity', `return ${expression}`);
      return fn(value, velocity);
    } catch (error) {
      logger.warn('Failed to evaluate expression', {
        expression,
        error: error.message
      });
      return value;
    }
  }

  /**
   * Check if action matches mapping action config
   * @private
   */
  _actionMatches(action, mappingAction) {
    if (action.type !== mappingAction.type) return false;
    if (action.command !== mappingAction.command) return false;

    if (mappingAction.deck && action.deck !== mappingAction.deck) {
      return false;
    }

    return true;
  }

  /**
   * Get device name
   */
  getDeviceName() {
    return this.deviceName;
  }

  /**
   * Get mapping configuration
   */
  getMapping() {
    return this.mapping;
  }
}

export default MIDITranslator;
