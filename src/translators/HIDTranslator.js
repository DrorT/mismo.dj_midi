import { logger } from '../utils/logger.js';

/**
 * Translates HID state changes to semantic actions
 *
 * Handles:
 * - Jog wheel deltas (scratch, bend)
 * - High-resolution faders (10-bit, 14-bit)
 * - Button states (with shift/modifier support)
 * - Encoder rotations
 */
export class HIDTranslator {
  constructor(mapping) {
    this.mapping = mapping;
    this.deviceName = mapping?.device?.name || 'Unknown';

    // Track modifier button states (shift, etc.)
    this.modifierState = {};

    // Build lookup table for fast translation
    this.lookupTable = this._buildLookupTable();
  }

  /**
   * Translate HID event to action
   * @param {object} hidEvent - HID event from HIDManager
   * @returns {object|null} Action object or null if no mapping found
   */
  translate(hidEvent) {
    const controlName = hidEvent.control;
    const mapping = this.mapping.mappings[controlName];

    if (!mapping) {
      // No mapping found for this control
      if (process.env.DEBUG === 'true') {
        logger.debug('No mapping found for HID control', {
          device: this.deviceName,
          control: controlName,
          type: hidEvent.type,
          value: hidEvent.value
        });
      }
      return null;
    }

    // Update modifier state if this is a modifier control
    const parsingConfig = this.mapping.parsing.controls[controlName];
    if (parsingConfig?.type === 'modifier') {
      this.modifierState[controlName] = hidEvent.value > 0;

      // Don't emit action for modifier changes (unless explicitly mapped)
      if (!mapping.action) {
        return null;
      }
    }

    try {
      const action = this._buildAction(hidEvent, mapping);

      if (action) {
        logger.info('[TRANSLATE] HID -> Action', {
          device: this.deviceName,
          hid: {
            control: controlName,
            type: hidEvent.type,
            value: hidEvent.value,
            delta: hidEvent.delta
          },
          action: {
            type: action.type,
            command: action.command,
            target: action.target,
            deck: action.deck,
            value: action.value,
            priority: action.priority
          }
        });
      }

      return action;
    } catch (error) {
      logger.error('Failed to translate HID event', {
        device: this.deviceName,
        control: controlName,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Translate action to HID output (for feedback)
   * @param {object} action - Action object
   * @param {string} state - State value (e.g., 'playing', 'stopped')
   * @returns {object|null} HID output config or null
   */
  actionToHID(action, state) {
    // Find mapping that matches this action
    for (const [controlName, mapping] of Object.entries(this.mapping.mappings)) {
      if (!mapping.feedback) continue;

      // Check if action matches this mapping
      if (this._actionMatches(action, mapping.action)) {
        const feedbackConfig = mapping.feedback;

        if (feedbackConfig.type === 'led' && feedbackConfig.hidOut) {
          // Return HID output configuration
          return {
            type: 'led',
            reportId: feedbackConfig.hidOut.reportId,
            byte: feedbackConfig.hidOut.byte,
            bit: feedbackConfig.hidOut.bit,
            state: state
          };
        } else if (feedbackConfig.type === 'display' && feedbackConfig.hidOut) {
          // Display output
          return {
            type: 'display',
            reportId: feedbackConfig.hidOut.reportId,
            data: state // State should contain display text/data
          };
        }
      }
    }

    return null;
  }

  /**
   * Build lookup table for fast control name resolution
   * @private
   */
  _buildLookupTable() {
    const table = new Map();

    for (const [controlName, mapping] of Object.entries(this.mapping.mappings)) {
      table.set(controlName, mapping);
    }

    logger.debug(`Built lookup table for ${this.deviceName}`, {
      entries: table.size
    });

    return table;
  }

  /**
   * Build action object from HID event and mapping
   * @private
   */
  _buildAction(hidEvent, mapping) {
    // Get control config from parsing section
    const controlConfig = this.mapping.parsing.controls[hidEvent.control];

    if (!controlConfig) {
      logger.warn('Control config not found', { control: hidEvent.control });
      return null;
    }

    // Base action
    const action = {
      type: mapping.action.type,
      command: mapping.action.command,
      target: mapping.action.target || 'audio',
      priority: mapping.action.priority || 'normal',
      timestamp: hidEvent.timestamp,
      deviceId: hidEvent.deviceId,
      from: this.deviceName
    };

    // Add deck if specified
    if (mapping.action.deck) {
      action.deck = mapping.action.deck;
    }

    // Handle value/delta based on control type
    if (controlConfig.type === 'delta') {
      // Jog wheel delta
      action.delta = hidEvent.delta;
      action.value = hidEvent.value;

      // Handle mode (scratch vs. bend) based on modifiers
      if (mapping.action.mode) {
        action.mode = this._evaluateExpression(mapping.action.mode, hidEvent, controlConfig);
      }
    } else if (controlConfig.type === 'button') {
      // Button press/release
      action.value = hidEvent.value > 0;

      // Skip button release events unless configured otherwise
      if (!action.value && !mapping.action.emitRelease) {
        return null;
      }
    } else if (controlConfig.type === 'absolute') {
      // Fader or knob - normalize to 0.0 - 1.0
      const min = controlConfig.min || 0;
      const max = controlConfig.max || ((1 << controlConfig.resolution) - 1);

      action.value = (hidEvent.value - min) / (max - min);
      action.rawValue = hidEvent.value;
    } else if (controlConfig.type === 'encoder') {
      // Rotary encoder - detect direction
      action.delta = hidEvent.delta;
      action.direction = hidEvent.delta > 0 ? 'up' : 'down';

      // Some mappings specify direction expression
      if (mapping.action.direction) {
        action.direction = this._evaluateExpression(mapping.action.direction, hidEvent, controlConfig);
      }
    }

    // Handle conditional mapping based on modifiers
    if (mapping.condition) {
      const conditionMet = this._evaluateCondition(mapping.condition);
      if (!conditionMet) {
        return null;
      }
    }

    // Apply value expression if specified
    if (mapping.action.valueExpression) {
      action.value = this._evaluateExpression(mapping.action.valueExpression, hidEvent, controlConfig);
    }

    return action;
  }

  /**
   * Evaluate expression with HID event context
   * @private
   */
  _evaluateExpression(expression, hidEvent, controlConfig) {
    // Context for expression evaluation
    const context = {
      value: hidEvent.value,
      delta: hidEvent.delta,
      state: this.modifierState,
      ...this.modifierState // Expose modifier states directly
    };

    try {
      // Create function with context variables
      const paramNames = Object.keys(context);
      const paramValues = Object.values(context);

      const fn = new Function(...paramNames, `return ${expression}`);
      return fn(...paramValues);
    } catch (error) {
      logger.warn('Failed to evaluate expression', {
        expression,
        error: error.message
      });
      return hidEvent.value;
    }
  }

  /**
   * Evaluate condition for conditional mappings
   * @private
   */
  _evaluateCondition(condition) {
    // Context includes modifier state
    const context = {
      state: this.modifierState,
      ...this.modifierState
    };

    try {
      const paramNames = Object.keys(context);
      const paramValues = Object.values(context);

      const fn = new Function(...paramNames, `return ${condition}`);
      return fn(...paramValues);
    } catch (error) {
      logger.warn('Failed to evaluate condition', {
        condition,
        error: error.message
      });
      return false;
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

  /**
   * Get current modifier state
   */
  getModifierState() {
    return { ...this.modifierState };
  }

  /**
   * Reset modifier state (useful when device reconnects)
   */
  resetModifierState() {
    this.modifierState = {};
  }
}

export default HIDTranslator;
