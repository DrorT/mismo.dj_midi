# WebSocket Commands Reference

Complete reference of all commands supported by the MismoDJ audio server WebSocket API.

**Server Address:** `ws://localhost:8765`

All commands are sent as JSON messages with a `command` field.

---

## Table of Contents

1. [Deck Playback Control](#deck-playback-control)
2. [Deck Audio Control](#deck-audio-control)
3. [Deck EQ Control](#deck-eq-control)
4. [Tempo & Sync Control](#tempo--sync-control)
5. [Nudge Control](#nudge-control)
6. [Mixer Control](#mixer-control)
7. [Audio Device Management](#audio-device-management)
8. [PFL (Pre-Fader Listen / Headphones)](#pfl-pre-fader-listen--headphones)
9. [Master Clock Control](#master-clock-control)
10. [Cue Points](#cue-points)
11. [Looping](#looping)
12. [Beat Jump](#beat-jump)
13. [Color FX (Per-Channel Effects)](#color-fx-per-channel-effects)
14. [FX Bus (Multi-Effect Routing)](#fx-bus-multi-effect-routing)
15. [Stem Control](#stem-control)
16. [State Queries](#state-queries)

---

## Deck Playback Control

### deck.loadById
Load a track by ID from the app server's library.

```json
{
  "command": "deck.loadById",
  "deck": "A",
  "trackId": "track_12345",
  "force": false
}
```

**Parameters:**
- `deck` (string): Deck identifier ("A", "B", etc.)
- `trackId` (string): Track ID from app server
- `force` (boolean, optional): Force load even if deck is playing. Default: `false`

---

### deck.unload
Unload the current track from a deck.

```json
{
  "command": "deck.unload",
  "deck": "A"
}
```

---

### deck.play
Start playback on a deck.

```json
{
  "command": "deck.play",
  "deck": "A"
}
```

---

### deck.pause
Pause playback (maintains position).

```json
{
  "command": "deck.pause",
  "deck": "A"
}
```

---

### deck.stop
Stop playback and reset to beginning (or cue point if set).

```json
{
  "command": "deck.stop",
  "deck": "A"
}
```

---

### deck.seek
Seek to a specific position in the track.

```json
{
  "command": "deck.seek",
  "deck": "A",
  "position": 45.5
}
```

**Parameters:**
- `position` (number): Position in seconds

---

## Deck Audio Control

### deck.setGain
Set deck channel gain/trim.

```json
{
  "command": "deck.setGain",
  "deck": "A",
  "gain": 0.8
}
```

**Parameters:**
- `gain` (number): Gain level, 0.0 to 1.0

---

### deck.setTrackGain
Set per-track gain adjustment.

```json
{
  "command": "deck.setTrackGain",
  "deck": "A",
  "gain": 1.2
}
```

**Parameters:**
- `gain` (number): Gain multiplier, 0.0 to 2.0

---

## Deck EQ Control

### deck.setEQEnabled
Enable or disable EQ for a deck.

```json
{
  "command": "deck.setEQEnabled",
  "deck": "A",
  "enabled": true
}
```

---

### deck.setEQBandCount
Set the number of EQ bands (3-band or 4-band).

```json
{
  "command": "deck.setEQBandCount",
  "deck": "A",
  "bandCount": 3
}
```

**Parameters:**
- `bandCount` (number): 3 or 4

---

### deck.setEQGain
Set gain for a specific EQ band.

```json
{
  "command": "deck.setEQGain",
  "deck": "A",
  "band": "mid",
  "gain": 0.5
}
```

**Parameters:**
- `band` (string): "low", "mid", "high", or "high_mid" (4-band only)
- `gain` (number): 0.0 to 1.0 (0.5 = neutral)

---

### deck.setEQKill
Toggle kill switch for an EQ band.

```json
{
  "command": "deck.setEQKill",
  "deck": "A",
  "band": "low",
  "kill": true
}
```

---

### deck.setEQLowMidFrequency
Set crossover frequency between low and mid bands.

```json
{
  "command": "deck.setEQLowMidFrequency",
  "deck": "A",
  "frequency": 250.0
}
```

**Parameters:**
- `frequency` (number): Frequency in Hz (100 - 500)

---

### deck.setEQMidHighFrequency
Set crossover frequency between mid and high bands.

```json
{
  "command": "deck.setEQMidHighFrequency",
  "deck": "A",
  "frequency": 2500.0
}
```

**Parameters:**
- `frequency` (number): Frequency in Hz (1000 - 8000)

---

### deck.setEQLowMidHighMidFrequency
Set crossover frequency between low-mid and high-mid (4-band EQ only).

```json
{
  "command": "deck.setEQLowMidHighMidFrequency",
  "deck": "A",
  "frequency": 1000.0
}
```

---

## Tempo & Sync Control

### deck.setTempo
Set tempo adjustment ratio.

```json
{
  "command": "deck.setTempo",
  "deck": "A",
  "tempo": 1.05
}
```

**Parameters:**
- `tempo` (number): Tempo multiplier (1.0 = 100%, 1.1 = +10%, 0.9 = -10%)
- Limited by tempo range setting unless sync bypass is active

---

### deck.setMasterTempo
Enable/disable master tempo (keylock).

```json
{
  "command": "deck.setMasterTempo",
  "deck": "A",
  "enabled": true
}
```

---

### deck.setTempoRange
Set the tempo range limit.

```json
{
  "command": "deck.setTempoRange",
  "deck": "A",
  "range": 1
}
```

**Parameters:**
- `range` (number):
  - `0` = ±6%
  - `1` = ±10%
  - `2` = ±16%
  - `3` = Wide (±50% to +100%)

---

### deck.setSyncBPM
Enable/disable BPM sync to master clock.

```json
{
  "command": "deck.setSyncBPM",
  "deck": "A",
  "enabled": true
}
```

**Note:** When enabled, deck's tempo will automatically match the master clock's BPM, bypassing tempo range limits if necessary.

---

### deck.setSyncBeat
Set beat synchronization mode.

```json
{
  "command": "deck.setSyncBeat",
  "deck": "A",
  "mode": "beat"
}
```

**Parameters:**
- `mode` (string):
  - `"none"` = No beat sync
  - `"beat"` = Sync to beat
  - `"downbeat"` = Sync to downbeat (phrase)

---

### deck.disableSync
Disable all sync for a deck.

```json
{
  "command": "deck.disableSync",
  "deck": "A"
}
```

---

### deck.getSyncState
Get current sync state for a deck.

```json
{
  "command": "deck.getSyncState",
  "deck": "A"
}
```

**Response:**
```json
{
  "event": "syncStateChanged",
  "deck": "A",
  "syncBPM": true,
  "syncBeat": "beat",
  "isActive": true
}
```

---

## Nudge Control

### deck.nudgeStart
Start nudge mode (scrubbing when paused, tempo bend when playing).

```json
{
  "command": "deck.nudgeStart",
  "deck": "A"
}
```

---

### deck.nudge
Apply nudge adjustment.

```json
{
  "command": "deck.nudge",
  "deck": "A",
  "delta": 0.05
}
```

**Parameters:**
- `delta` (number):
  - When paused: position offset in seconds
  - When playing: tempo adjustment multiplier

---

### deck.nudgeEnd
End nudge mode and restore normal playback.

```json
{
  "command": "deck.nudgeEnd",
  "deck": "A"
}
```

---

## Mixer Control

### mixer.setChannelGain
Set channel trim/gain for a deck.

```json
{
  "command": "mixer.setChannelGain",
  "deck": "A",
  "gain": 0.8
}
```

---

### mixer.setChannelFader
Set channel fader level.

```json
{
  "command": "mixer.setChannelFader",
  "deck": "A",
  "level": 1.0
}
```

**Parameters:**
- `level` (number): 0.0 to 1.0

---

### mixer.setCrossfader
Set crossfader position.

```json
{
  "command": "mixer.setCrossfader",
  "position": 0.0
}
```

**Parameters:**
- `position` (number): -1.0 (full left) to +1.0 (full right), 0.0 = center

---

### mixer.setCrossfaderEnabled
Enable/disable crossfader.

```json
{
  "command": "mixer.setCrossfaderEnabled",
  "enabled": true
}
```

---

### mixer.setMasterGain
Set master output gain.

```json
{
  "command": "mixer.setMasterGain",
  "gain": 0.8
}
```

---

### mixer.setLimiter
Enable/disable master limiter.

```json
{
  "command": "mixer.setLimiter",
  "enabled": true
}
```

---

### mixer.setCrossfaderCurve
Set crossfader curve type.

```json
{
  "command": "mixer.setCrossfaderCurve",
  "curve": "linear"
}
```

**Parameters:**
- `curve` (string): "linear", "logarithmic", or "constant_power"

---

### mixer.setCrossfaderAssignment
Assign a deck to crossfader side.

```json
{
  "command": "mixer.setCrossfaderAssignment",
  "deck": "A",
  "assignment": "left"
}
```

**Parameters:**
- `assignment` (string): "left", "center", or "right"

---

### mixer.addDeck
Add a new deck to the mixer.

```json
{
  "command": "mixer.addDeck",
  "deck": "C",
  "type": "main"
}
```

**Parameters:**
- `type` (string): "main" or "sample"

---

### mixer.removeDeck
Remove a deck from the mixer.

```json
{
  "command": "mixer.removeDeck",
  "deck": "C"
}
```

---

### mixer.setDeckLoadPolicy
Set policy for loading tracks while playing.

```json
{
  "command": "mixer.setDeckLoadPolicy",
  "policy": 1
}
```

**Parameters:**
- `policy` (number):
  - `0` = Allow (load immediately)
  - `1` = Confirm (ask user)
  - `2` = Reject (prevent loading)

---

## Audio Device Management

### audio.refreshDevices
Refresh the list of available audio output devices.

```json
{
  "command": "audio.refreshDevices"
}
```

---

### audio.getDevices
Get list of available audio output devices.

```json
{
  "command": "audio.getDevices"
}
```

---

### audio.setDevice
Set the audio output device.

```json
{
  "command": "audio.setDevice",
  "deviceName": "USB Audio Device"
}
```

---

### audio.getCurrentDevice
Get current audio output device info.

```json
{
  "command": "audio.getCurrentDevice"
}
```

---

## PFL (Pre-Fader Listen / Headphones)

### pfl.setDeck
Enable/disable PFL for a deck.

```json
{
  "command": "pfl.setDeck",
  "deck": "A",
  "enabled": true
}
```

---

### pfl.setVolume
Set headphone output volume.

```json
{
  "command": "pfl.setVolume",
  "volume": 0.7
}
```

**Parameters:**
- `volume` (number): 0.0 to 1.0

---

### pfl.setCueMix
Set cue/mix balance in headphones.

```json
{
  "command": "pfl.setCueMix",
  "mix": 0.5
}
```

**Parameters:**
- `mix` (number): 0.0 (full cue) to 1.0 (full master mix)

---

### pfl.refreshDevices
Refresh list of available headphone devices.

```json
{
  "command": "pfl.refreshDevices"
}
```

---

### pfl.getDevices
Get list of available headphone devices.

```json
{
  "command": "pfl.getDevices"
}
```

---

### pfl.setDevice
Set headphone output device.

```json
{
  "command": "pfl.setDevice",
  "deviceName": "USB Headphones"
}
```

---

### pfl.getCurrentDevice
Get current headphone device info.

```json
{
  "command": "pfl.getCurrentDevice"
}
```

---

### pfl.setAutoEnabled
Enable/disable auto-PFL on track load.

```json
{
  "command": "pfl.setAutoEnabled",
  "enabled": true
}
```

---

## Master Clock Control

### clock.getState
Get current master clock state.

```json
{
  "command": "clock.getState"
}
```

**Response:**
```json
{
  "event": "clockState",
  "bpm": 128.0,
  "phase": 24.5,
  "masterDeck": "A",
  "ghostActive": false,
  "isValid": true
}
```

---

### clock.setMasterDeck
Manually set a specific deck as master.

```json
{
  "command": "clock.setMasterDeck",
  "deck": "A"
}
```

**Note:** Disables auto-master mode.

---

### clock.clearMasterDeck
Clear manual master and re-enable auto-master mode.

```json
{
  "command": "clock.clearMasterDeck"
}
```

---

### clock.startGhost
Start ghost clock with specified BPM.

```json
{
  "command": "clock.startGhost",
  "bpm": 128.0,
  "phase": 0.0
}
```

**Parameters:**
- `bpm` (number): Tempo in BPM
- `phase` (number, optional): Initial beat phase. Default: 0.0

---

### clock.stopGhost
Stop ghost clock.

```json
{
  "command": "clock.stopGhost"
}
```

---

### clock.setGhostBPM
Adjust ghost clock tempo.

```json
{
  "command": "clock.setGhostBPM",
  "bpm": 130.0
}
```

---

## Cue Points

### deck.setCue
Set a cue point.

```json
{
  "command": "deck.setCue",
  "deck": "A",
  "index": 0,
  "position": 45.5
}
```

**Parameters:**
- `index` (number): Cue point index (0-7)
- `position` (number): Position in seconds

---

### deck.removeCue
Remove a cue point.

```json
{
  "command": "deck.removeCue",
  "deck": "A",
  "index": 0
}
```

---

### deck.seekToCue
Seek to a cue point.

```json
{
  "command": "deck.seekToCue",
  "deck": "A",
  "index": 0
}
```

---

### deck.cuePlay
Play from cue point with mode-dependent behavior.

```json
{
  "command": "deck.cuePlay",
  "deck": "A",
  "index": 0
}
```

---

### deck.cueStop
Stop at current position and set as temporary cue.

```json
{
  "command": "deck.cueStop",
  "deck": "A"
}
```

---

### deck.setCueQuantize
Set cue point quantization mode.

```json
{
  "command": "deck.setCueQuantize",
  "deck": "A",
  "mode": "beat"
}
```

**Parameters:**
- `mode` (string): "none", "beat", or "downbeat"

---

### deck.setCuePlayMode
Set cue play behavior mode.

```json
{
  "command": "deck.setCuePlayMode",
  "deck": "A",
  "mode": "trigger"
}
```

**Parameters:**
- `mode` (string): "trigger" or "hold"

---

### deck.setCueQuantizeTarget
Set quantization target for cue points.

```json
{
  "command": "deck.setCueQuantizeTarget",
  "deck": "A",
  "target": "nearest"
}
```

**Parameters:**
- `target` (string): "nearest", "forward", or "backward"

---

### deck.getCuePoints
Get all cue points for a deck.

```json
{
  "command": "deck.getCuePoints",
  "deck": "A"
}
```

---

## Looping

### deck.setLoopIn
Set loop in point at current position.

```json
{
  "command": "deck.setLoopIn",
  "deck": "A",
  "position": 30.0
}
```

---

### deck.setLoopOut
Set loop out point at current position.

```json
{
  "command": "deck.setLoopOut",
  "deck": "A",
  "position": 60.0
}
```

---

### deck.createAutoLoop
Create an automatic loop of specified length.

```json
{
  "command": "deck.createAutoLoop",
  "deck": "A",
  "bars": 4
}
```

**Parameters:**
- `bars` (number): Loop length in bars (0.5, 1, 2, 4, 8, 16, 32)

---

### deck.toggleLoop
Toggle loop on/off.

```json
{
  "command": "deck.toggleLoop",
  "deck": "A"
}
```

---

### deck.setLoopEnabled
Enable/disable active loop.

```json
{
  "command": "deck.setLoopEnabled",
  "deck": "A",
  "enabled": true
}
```

---

### deck.clearLoop
Clear the current loop.

```json
{
  "command": "deck.clearLoop",
  "deck": "A"
}
```

---

### deck.loopHalve
Halve the loop length.

```json
{
  "command": "deck.loopHalve",
  "deck": "A"
}
```

---

### deck.loopDouble
Double the loop length.

```json
{
  "command": "deck.loopDouble",
  "deck": "A"
}
```

---

### deck.loopMove
Move the loop forward or backward.

```json
{
  "command": "deck.loopMove",
  "deck": "A",
  "beats": 4
}
```

**Parameters:**
- `beats` (number): Number of beats to move (negative = backward)

---

### deck.reloop
Jump back to loop start and activate loop.

```json
{
  "command": "deck.reloop",
  "deck": "A"
}
```

---

### deck.adjustLoopIn
Nudge loop in point.

```json
{
  "command": "deck.adjustLoopIn",
  "deck": "A",
  "beats": -0.25
}
```

---

### deck.adjustLoopOut
Nudge loop out point.

```json
{
  "command": "deck.adjustLoopOut",
  "deck": "A",
  "beats": 0.5
}
```

---

### deck.setLoopCrossfadeEnabled
Enable/disable loop crossfade.

```json
{
  "command": "deck.setLoopCrossfadeEnabled",
  "deck": "A",
  "enabled": true
}
```

---

### deck.setLoopCrossfadeDuration
Set loop crossfade duration.

```json
{
  "command": "deck.setLoopCrossfadeDuration",
  "deck": "A",
  "beats": 0.5
}
```

---

### deck.setLoopQuantizeEnabled
Enable/disable loop quantization.

```json
{
  "command": "deck.setLoopQuantizeEnabled",
  "deck": "A",
  "enabled": true
}
```

---

### deck.getLoopState
Get current loop state.

```json
{
  "command": "deck.getLoopState",
  "deck": "A"
}
```

---

## Beat Jump

### deck.beatJump
Jump forward or backward by beats.

```json
{
  "command": "deck.beatJump",
  "deck": "A",
  "beats": 16,
  "quantize": true
}
```

**Parameters:**
- `beats` (number): Number of beats to jump (negative = backward)
- `quantize` (boolean, optional): Enable quantization. Default: `false`

---

### deck.setBeatJumpQuantization
Set beat jump quantization mode.

```json
{
  "command": "deck.setBeatJumpQuantization",
  "deck": "A",
  "mode": "beat"
}
```

**Parameters:**
- `mode` (string): "none", "beat", or "downbeat"

---

## Color FX (Per-Channel Effects)

### deck.setColorFX
Set the color FX type for a deck.

```json
{
  "command": "deck.setColorFX",
  "deck": "A",
  "effect": "filter"
}
```

**Parameters:**
- `effect` (string): "filter", "delay", or "none"

---

### deck.setColorFXEnabled
Enable/disable color FX.

```json
{
  "command": "deck.setColorFXEnabled",
  "deck": "A",
  "enabled": true
}
```

---

### deck.setColorFXParam
Set color FX parameter.

```json
{
  "command": "deck.setColorFXParam",
  "deck": "A",
  "param": "cutoff",
  "value": 0.7
}
```

---

### deck.setColorFXFilterType
Set filter type for color FX.

```json
{
  "command": "deck.setColorFXFilterType",
  "deck": "A",
  "filterType": "lowpass"
}
```

**Parameters:**
- `filterType` (string): "lowpass", "highpass", or "bandpass"

---

### deck.setColorFXPreset
Set delay preset for color FX.

```json
{
  "command": "deck.setColorFXPreset",
  "deck": "A",
  "preset": "echo"
}
```

**Parameters:**
- `preset` (string): "shortdelay", "pingpong", "echo", "dubecho", "tape", "digital"

---

## FX Bus (Multi-Effect Routing)

### fx.busEnable
Enable/disable an FX bus.

```json
{
  "command": "fx.busEnable",
  "bus": 0,
  "enabled": true
}
```

**Parameters:**
- `bus` (number): Bus number (0-3)

---

### fx.busMode
Set FX bus mode.

```json
{
  "command": "fx.busMode",
  "bus": 0,
  "mode": "send_return"
}
```

**Parameters:**
- `mode` (string): "insert" or "send_return"

---

### fx.busWetDry
Set wet/dry mix for FX bus.

```json
{
  "command": "fx.busWetDry",
  "bus": 0,
  "wetDry": 0.5
}
```

**Parameters:**
- `wetDry` (number): 0.0 (dry) to 1.0 (wet)

---

### fx.route
Route a deck to an FX bus.

```json
{
  "command": "fx.route",
  "deck": "A",
  "bus": 0,
  "enabled": true
}
```

---

### fx.addEffect
Add an effect to an FX bus.

```json
{
  "command": "fx.addEffect",
  "bus": 0,
  "effect": "delay"
}
```

**Parameters:**
- `effect` (string): "filter", "delay", "reverb", "bitcrusher"

---

### fx.removeEffect
Remove a specific effect from an FX bus.

```json
{
  "command": "fx.removeEffect",
  "bus": 0,
  "effectId": "effect_123"
}
```

---

### fx.clearEffects
Clear all effects from an FX bus.

```json
{
  "command": "fx.clearEffects",
  "bus": 0
}
```

---

### fx.setEffectParam
Set a parameter on an effect in an FX bus.

```json
{
  "command": "fx.setEffectParam",
  "bus": 0,
  "effectId": "delay",
  "param": "time",
  "value": 0.5
}
```

---

## Stem Control

### deck.setStemVolume
Set volume for an individual stem.

```json
{
  "command": "deck.setStemVolume",
  "deck": "A",
  "stem": "vocals",
  "volume": 0.8
}
```

**Parameters:**
- `stem` (string): "vocals", "drums", "bass", or "other"
- `volume` (number): 0.0 to 1.0

---

### deck.getStemState
Query stem state for a deck.

```json
{
  "command": "deck.getStemState",
  "deck": "A"
}
```

---

### deck.setStemFXSend
Route a specific stem to an FX bus.

```json
{
  "command": "deck.setStemFXSend",
  "deck": "A",
  "stem": "vocals",
  "bus": 0,
  "enabled": true
}
```

---

## State Queries

### getState
Get complete mixer/deck state.

```json
{
  "command": "getState"
}
```

**Response:** Returns comprehensive state including all decks, mixer settings, and playback information.

---

## Event Messages

The server sends event messages to notify clients of state changes. These are **not** commands you send, but messages you **receive**.

### Common Events:

**deckLoaded**
```json
{
  "event": "deckLoaded",
  "deck": "A",
  "trackInfo": { ... }
}
```

**deckUnloaded**
```json
{
  "event": "deckUnloaded",
  "deck": "A"
}
```

**deckPlayStateChanged**
```json
{
  "event": "deckPlayStateChanged",
  "deck": "A",
  "isPlaying": true,
  "isPaused": false
}
```

**deckPositionChanged**
```json
{
  "event": "deckPositionChanged",
  "deck": "A",
  "position": 45.2,
  "duration": 180.0
}
```

**deckTempoChanged**
```json
{
  "event": "deckTempoChanged",
  "deck": "A",
  "tempo": 1.05,
  "tempoPercent": 5.0,
  "effectiveBPM": 126.0
}
```

**syncStateChanged**
```json
{
  "event": "syncStateChanged",
  "deck": "A",
  "syncBPM": true,
  "syncBeat": "beat",
  "isActive": true
}
```

**clockStateChanged**
```json
{
  "event": "clockStateChanged",
  "bpm": 128.0,
  "masterDeck": "A",
  "ghostActive": false
}
```

---

## Notes

1. **Deck Identifiers:** Typically "A", "B", etc. Additional decks can be added dynamically.

2. **Command Queueing:** Commands are queued and processed by the audio thread. High-priority commands (play/pause) are processed immediately.

3. **Rate Limiting:** The server implements rate limiting. Excessive commands will receive:
   ```json
   {
     "error": "Rate limit exceeded",
     "message": "Too many commands too quickly. Please slow down."
   }
   ```

4. **Error Responses:** Failed commands return error messages:
   ```json
   {
     "event": "commandFailed",
     "command": "deck.play",
     "error": "Deck not found"
   }
   ```

5. **Sync Bypass:** When `deck.setSyncBPM` is enabled, tempo changes bypass the tempo range limit to maintain perfect sync with the master clock.

6. **firstBeatOffset:** All beat/phase calculations properly account for tracks where the first beat doesn't occur at position 0.0.

---

## Example Usage Session

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8765');

// Load tracks
ws.send(JSON.stringify({
  command: 'deck.loadById',
  deck: 'A',
  trackId: 'track_001'
}));

ws.send(JSON.stringify({
  command: 'deck.loadById',
  deck: 'B',
  trackId: 'track_002'
}));

// Set up sync
ws.send(JSON.stringify({
  command: 'deck.setSyncBPM',
  deck: 'B',
  enabled: true
}));

// Start playback
ws.send(JSON.stringify({
  command: 'deck.play',
  deck: 'A'
}));

ws.send(JSON.stringify({
  command: 'deck.play',
  deck: 'B'
}));

// Adjust tempo on master (deck B will follow)
ws.send(JSON.stringify({
  command: 'deck.setTempo',
  deck: 'A',
  tempo: 1.08
}));

// Listen for events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```
