# Generic MIDI Mapping - Action Reference

This shows what actions are sent to the Audio Engine when using the **generic-midi** mapping.

## 📊 Current Generic Mapping (config/devices/generic-midi.json)

### Transport Controls → Audio Engine

| Button | MIDI Note | Action Command | Deck | Priority | Description |
|--------|-----------|----------------|------|----------|-------------|
| Play A | Note 11 (0x0B) | `play` | A | high | Start/stop playback on deck A |
| Play B | Note 12 (0x0C) | `play` | B | high | Start/stop playback on deck B |
| Cue A | Note 13 (0x0D) | `cue` | A | high | Jump to cue point deck A |
| Cue B | Note 14 (0x0E) | `cue` | B | high | Jump to cue point deck B |
| Sync A | Note 15 (0x0F) | `sync` | A | high | Enable sync on deck A |
| Sync B | Note 16 (0x10) | `sync` | B | high | Enable sync on deck B |

### Mixer Controls → Audio Engine

| Control | MIDI CC | Action Command | Value Range | Priority | Description |
|---------|---------|----------------|-------------|----------|-------------|
| Crossfader | CC 8 (0x08) | `crossfader` | 0.0 - 1.0 | normal | Mix between deck A and B |
| Volume A | CC 9 (0x09) | `volume` (deck A) | 0.0 - 1.0 | normal | Channel fader for deck A |
| Volume B | CC 10 (0x0A) | `volume` (deck B) | 0.0 - 1.0 | normal | Channel fader for deck B |
| Tempo A | Pitch Bend | `tempo` (deck A) | -1.0 to 1.0 | high | Pitch/tempo adjustment |

### Library Controls → App Server

| Control | MIDI | Action Command | Priority | Description |
|---------|------|----------------|----------|-------------|
| Browse Encoder | CC 22 (0x16) | `browse` | normal | Navigate track library |
| Load A | Note 17 (0x11) | `loadTrack` (deck A) | normal | Load selected track to deck A |
| Load B | Note 18 (0x12) | `loadTrack` (deck B) | normal | Load selected track to deck B |

## 📤 WebSocket Message Format

When you press a button, the server sends a WebSocket message to the appropriate service:

### Example: Play Button Pressed

**MIDI Input:**
```
Type: Note On
Channel: 0
Note: 11 (0x0B)
Velocity: 127
```

**Translated Action:**
```json
{
  "type": "action",
  "priority": "high",
  "timestamp": 1729950000000,
  "action": {
    "type": "transport",
    "deck": "A",
    "command": "play",
    "value": true
  }
}
```

**Sent to:** Audio Engine WebSocket (`ws://localhost:8080`)

### Example: Crossfader Moved

**MIDI Input:**
```
Type: Control Change (CC)
Channel: 0
Controller: 8
Value: 64
```

**Translated Action:**
```json
{
  "type": "action",
  "priority": "normal",
  "timestamp": 1729950000000,
  "action": {
    "type": "mixer",
    "command": "crossfader",
    "value": 0.50
  }
}
```

**Sent to:** Audio Engine WebSocket (`ws://localhost:8080`)

### Example: Browse Library

**MIDI Input:**
```
Type: Control Change (CC)
Channel: 0
Controller: 22
Value: 65 (turned right)
```

**Translated Action:**
```json
{
  "type": "action",
  "priority": "normal",
  "timestamp": 1729950000000,
  "action": {
    "type": "library",
    "command": "browse",
    "direction": "down"
  }
}
```

**Sent to:** App Server WebSocket (`ws://localhost:3000`)

## 🎛️ DDJ-FLX4 Specific Notes

The Pioneer DDJ-FLX4 uses **different MIDI note numbers** than the generic mapping. To see what YOUR controller sends:

```bash
# Run this and press buttons to see the actual MIDI values
node test/manual/listen-midi-events.js "DDJ-FLX4:DDJ-FLX4 MIDI 1 28:0"
```

Then create a custom mapping file `config/devices/ddj-flx4.json` with the correct values.

## ⚠️ Current Limitation

**Without Audio Engine running**, you'll see:
```
warn: Cannot send to Audio Engine: not connected
```

This is normal! The actions are being generated correctly, but there's nowhere to send them yet. Once the Audio Engine is running and connected, commands will flow through automatically.

## 🔍 What Happens When Audio Engine IS Connected

1. **Button pressed** → MIDI event received
2. **Action translated** → Command + deck + value
3. **Action routed** → Sent via WebSocket
4. **Audio Engine responds** → Playback state changes
5. **Feedback sent** → LED on controller lights up

Currently you're seeing steps 1-2, and step 3 is queued waiting for connection!

## 📝 Debugging Tips

To see the full flow with debug output:

```bash
DEBUG=true npm start
```

Then press buttons and look for:
- `MIDI input` - Raw MIDI received
- `Action translated` - What command was created
- `Action queued` or `Action sent` - Routing status
