import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

/**
 * Centralized feedback management
 *
 * Responsibilities:
 * - Subscribe to Audio Engine state (playback, VU, sync, etc.)
 * - Subscribe to App Server state (playlist, selected track, etc.)
 * - Maintain controller state model
 * - Push LED/display updates to controllers
 * - Throttle updates to avoid overwhelming controllers
 */
export class FeedbackManager extends EventEmitter {
  constructor(midiManager, hidManager, wsClients) {
    super();

    this.midiManager = midiManager;
    this.hidManager = hidManager; // Will be null in Phase 1
    this.audioClient = wsClients.audio;
    this.appClient = wsClients.app;

    // State cache
    this.state = {
      deckA: {
        playback: { playing: false, paused: false, cued: false },
        position: { currentTime: 0, duration: 0 },
        vuMeter: { peak: 0, rms: 0 },
        sync: { enabled: false, locked: false },
        tempo: { bpm: 120, pitch: 0 }
      },
      deckB: {
        playback: { playing: false, paused: false, cued: false },
        position: { currentTime: 0, duration: 0 },
        vuMeter: { peak: 0, rms: 0 },
        sync: { enabled: false, locked: false },
        tempo: { bpm: 120, pitch: 0 }
      },
      mixer: {},
      library: {
        selectedTrack: null,
        playlist: null
      }
    };

    // Throttle tracking
    this.lastUpdate = new Map(); // control key -> timestamp
    this.updateThrottles = new Map(); // control type -> interval (ms)

    // Set default throttles
    this.updateThrottles.set('led', 20); // 20ms = 50Hz
    this.updateThrottles.set('vuMeter', 16); // 16ms = 60Hz
    this.updateThrottles.set('display', 100); // 100ms = 10Hz
  }

  /**
   * Initialize: Subscribe to state updates
   * @returns {Promise<void>}
   */
  async initialize() {
    // Subscribe to Audio Engine state updates
    this.audioClient.on('state', (message) => {
      this._onAudioState(message);
    });

    // Subscribe to App Server state updates
    this.appClient.on('state', (message) => {
      this._onAppState(message);
    });

    logger.info('FeedbackManager initialized');
  }

  /**
   * Handle audio engine state updates
   * @private
   */
  _onAudioState(state) {
    const deck = state.deck?.toLowerCase() || 'a';
    const deckKey = `deck${deck.toUpperCase()}`;

    if (!this.state[deckKey]) {
      logger.warn(`Unknown deck in state update: ${deck}`);
      return;
    }

    // Update state cache
    if (state.playback) {
      this.state[deckKey].playback = { ...this.state[deckKey].playback, ...state.playback };
      this._updatePlaybackFeedback(deck, state.playback);
    }

    if (state.position) {
      this.state[deckKey].position = { ...this.state[deckKey].position, ...state.position };
    }

    if (state.vuMeter) {
      this.state[deckKey].vuMeter = state.vuMeter;
      this._updateVUMeterFeedback(deck, state.vuMeter);
    }

    if (state.sync) {
      this.state[deckKey].sync = { ...this.state[deckKey].sync, ...state.sync };
      this._updateSyncFeedback(deck, state.sync);
    }

    if (state.tempo) {
      this.state[deckKey].tempo = { ...this.state[deckKey].tempo, ...state.tempo };
    }

    this.emit('state:audio', { deck, state });
  }

  /**
   * Handle app server state updates
   * @private
   */
  _onAppState(state) {
    if (state.selectedTrack) {
      this.state.library.selectedTrack = state.selectedTrack;
      this._updateTrackInfoFeedback(state.selectedTrack);
    }

    if (state.playlist) {
      this.state.library.playlist = state.playlist;
    }

    this.emit('state:app', state);
  }

  /**
   * Update playback feedback (play/cue LEDs)
   * @private
   */
  _updatePlaybackFeedback(deck, playback) {
    const devices = this.midiManager.getConnectedDevices();

    for (const device of devices) {
      // Play button LED
      if (playback.playing !== undefined) {
        this._updateLED(device.deviceId, `play_${deck}`, playback.playing ? 'playing' : 'stopped');
      }

      // Cue button LED
      if (playback.cued !== undefined) {
        this._updateLED(device.deviceId, `cue_${deck}`, playback.cued ? 'cued' : 'stopped');
      }
    }
  }

  /**
   * Update sync feedback (sync LED)
   * @private
   */
  _updateSyncFeedback(deck, sync) {
    const devices = this.midiManager.getConnectedDevices();

    for (const device of devices) {
      const state = sync.enabled && sync.locked ? 'locked' : sync.enabled ? 'enabled' : 'disabled';
      this._updateLED(device.deviceId, `sync_${deck}`, state);
    }
  }

  /**
   * Update VU meter feedback
   * @private
   */
  _updateVUMeterFeedback(deck, vuMeter) {
    // Throttle VU meter updates to 60Hz
    const key = `vu_${deck}`;

    if (!this._shouldUpdate(key, this.updateThrottles.get('vuMeter'))) {
      return;
    }

    const devices = this.midiManager.getConnectedDevices();

    for (const device of devices) {
      // For MIDI, VU meter is typically not available
      // For HID (Phase 2), this will send actual VU meter data
      if (this.hidManager && device.config.protocol === 'hid') {
        // TODO: Implement HID VU meter in Phase 2
      }
    }

    this.lastUpdate.set(key, Date.now());
  }

  /**
   * Update track info feedback (displays)
   * @private
   */
  _updateTrackInfoFeedback(track) {
    // Throttle display updates to 10Hz
    const key = 'trackInfo';

    if (!this._shouldUpdate(key, this.updateThrottles.get('display'))) {
      return;
    }

    const devices = this.midiManager.getConnectedDevices();

    for (const device of devices) {
      // For HID devices with displays (Phase 2)
      if (this.hidManager && device.config.protocol === 'hid') {
        // TODO: Implement HID display updates in Phase 2
      }
    }

    this.lastUpdate.set(key, Date.now());
  }

  /**
   * Update LED on device
   * @private
   */
  _updateLED(deviceId, controlId, state) {
    const key = `${deviceId}:${controlId}`;

    // Throttle LED updates
    if (!this._shouldUpdate(key, this.updateThrottles.get('led'))) {
      return;
    }

    // Get translator for device
    // TODO: We need access to mapper/translator here
    // For now, this is a placeholder

    if (process.env.DEBUG === 'true') {
      logger.debug('LED update', { deviceId, controlId, state });
    }

    this.lastUpdate.set(key, Date.now());
  }

  /**
   * Check if update should be sent (throttling)
   * @private
   */
  _shouldUpdate(key, intervalMs) {
    const last = this.lastUpdate.get(key);

    if (!last) {
      return true; // First update
    }

    const elapsed = Date.now() - last;
    return elapsed >= intervalMs;
  }

  /**
   * Get current state for a deck
   * @param {string} deck - Deck identifier ('A' or 'B')
   * @returns {object} Deck state
   */
  getDeckState(deck) {
    const deckKey = `deck${deck.toUpperCase()}`;
    return this.state[deckKey];
  }

  /**
   * Get library state
   * @returns {object} Library state
   */
  getLibraryState() {
    return this.state.library;
  }

  /**
   * Get full state
   * @returns {object} Complete state
   */
  getState() {
    return this.state;
  }

  /**
   * Sync all feedback to current state
   * Called when a new controller connects
   * @param {string} deviceId - Device ID
   */
  async syncDevice(deviceId) {
    logger.info(`Syncing feedback for device ${deviceId}`);

    // Sync deck A state
    await this._syncDeckState(deviceId, 'a', this.state.deckA);

    // Sync deck B state
    await this._syncDeckState(deviceId, 'b', this.state.deckB);

    // Sync track info
    if (this.state.library.selectedTrack) {
      this._updateTrackInfoFeedback(this.state.library.selectedTrack);
    }
  }

  /**
   * Sync deck state to device
   * @private
   */
  async _syncDeckState(deviceId, deck, deckState) {
    // Sync playback LEDs
    this._updateLED(deviceId, `play_${deck}`, deckState.playback.playing ? 'playing' : 'stopped');
    this._updateLED(deviceId, `cue_${deck}`, deckState.playback.cued ? 'cued' : 'stopped');

    // Sync sync LED
    const syncState = deckState.sync.enabled && deckState.sync.locked ? 'locked' :
      deckState.sync.enabled ? 'enabled' : 'disabled';
    this._updateLED(deviceId, `sync_${deck}`, syncState);
  }
}

export default FeedbackManager;
