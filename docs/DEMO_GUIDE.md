# Controller Server Demo Guide

## What You Should See When Running the Server

### Starting the Server

```bash
npm start
# or with debug mode
DEBUG=true npm start
```

### Expected Startup Output

```
============================================================
Starting Mismo DJ Controller Server...
============================================================
Configuration loaded {
  "audioEngineUrl":"ws://localhost:8080",
  "appServerUrl":"ws://localhost:3000",
  "webUIUrl":"ws://localhost:8081",
  "debug":false
}
Initializing WebSocket clients...
Connecting to Audio Engine at ws://localhost:8080
Connecting to App Server at ws://localhost:3000
Connecting to Web UI at ws://localhost:8081

[WebSocket connection attempts - will retry if services aren't running]

Initializing action router...
Initializing MIDI manager...
Loading device mappings...
Loaded mapping for generic-midi {"mappingCount":13}
Loaded 1 device mappings {"devices":["generic-midi"]}

Initializing feedback manager...
FeedbackManager initialized

Scanning for MIDI devices...
MIDI scan results {
  "inputs":1,
  "outputs":1,
  "inputNames":["Midi Through:Midi Through Port-0 14:0"],
  "outputNames":["Midi Through:Midi Through Port-0 14:0"]
}

Using generic mapping for Midi Through:Midi Through Port-0 14:0
Opened MIDI input: Midi Through:Midi Through Port-0 14:0
Opened MIDI output: Midi Through:Midi Through Port-0 14:0

MIDI device connected {
  "deviceId":"midi-Midi Through:Midi Through Port-0 14:0",
  "name":"Midi Through:Midi Through Port-0 14:0",
  "hasInput":true,
  "hasOutput":true
}

Syncing feedback for device midi-Midi Through:Midi Through Port-0 14:0

============================================================
Controller Server started successfully
Connected MIDI devices: 1
Available mappings: 1
WebSocket connections:
  - Audio Engine: Disconnected (will retry)
  - App Server: Disconnected (will retry)
  - Web UI: Disconnected (will retry)
============================================================
```

## What Happens When You Connect a MIDI Controller

### 1. Device Detection

When you plug in a MIDI controller, the server will automatically detect it on the next scan or restart:

```
MIDI scan results {
  "inputs":2,
  "outputs":2,
  "inputNames":[
    "Midi Through:Midi Through Port-0 14:0",
    "Your DJ Controller"
  ],
  ...
}
```

### 2. Device Connection

The server attempts to find a matching configuration:

```
Found mapping for Your DJ Controller: Pioneer DDJ-400
Loaded mapping for pioneer-ddj-400 {"mappingCount":25}
Opened MIDI input: Your DJ Controller
Opened MIDI output: Your DJ Controller
MIDI device connected {
  "deviceId":"midi-Your DJ Controller",
  "name":"Your DJ Controller",
  "hasInput":true,
  "hasOutput":true
}
```

### 3. Input Events (Debug Mode)

When you press buttons or move controls, you'll see (with `DEBUG=true`):

```
MIDI input {
  "device": "midi-Your DJ Controller",
  "type": "noteon",
  "note": 11,
  "velocity": 127,
  "channel": 0
}

Action translated {
  "device": "Your DJ Controller",
  "action": "transport",
  "command": "play",
  "deck": "A",
  "target": "audio",
  "priority": "high"
}

Action queued {
  "priority": "high",
  "target": "audio",
  "type": "transport",
  "queueSize": 1
}

Action sent {
  "target": "audio",
  "type": "transport",
  "command": "play",
  "success": true
}
```

### 4. Feedback Updates

When state changes from downstream services:

```
Audio Engine state update {
  "deck": "A",
  "playback": {
    "playing": true,
    "paused": false,
    "cued": false
  }
}

LED update {
  "deviceId": "midi-Your DJ Controller",
  "controlId": "play_a",
  "state": "playing"
}
```

## Testing Without Downstream Services

The server runs fine without the Audio Engine, App Server, or Web UI connected. It will:

1. ✅ Start successfully
2. ✅ Detect and connect to MIDI devices
3. ✅ Receive MIDI input events
4. ✅ Translate events to actions
5. ⚠️ Queue actions (but they won't be sent)
6. ⚠️ No feedback (no state updates from services)
7. 🔄 Auto-retry WebSocket connections every 5-60 seconds

## Testing With a Real MIDI Controller

### What to Try:

1. **Connect your DJ controller** via USB
2. **Restart the server** to detect it
3. **Press buttons** and watch the console for events
4. **Move faders/knobs** to see continuous events
5. **Check the mapping** in debug mode

### Expected Behavior:

#### Play Button Press
```
Input: Note On, channel 0, note 11, velocity 127
↓
Action: { type: "transport", command: "play", deck: "A" }
↓
Routed to: Audio Engine (high priority)
```

#### Crossfader Movement
```
Input: CC, channel 0, controller 8, value 64
↓
Action: { type: "mixer", command: "crossfader", value: 0.50 }
↓
Routed to: Audio Engine (normal priority)
```

#### Browse Encoder Turn
```
Input: CC, channel 0, controller 22, value 65
↓
Action: { type: "library", command: "browse", direction: "down" }
↓
Routed to: App Server (normal priority)
```

## Customizing Device Mappings

### Find Your Controller's MIDI Values

1. Enable debug mode: `DEBUG=true npm start`
2. Press each button and note the values shown:
   ```
   MIDI input { "type": "noteon", "channel": 0, "note": 42, ... }
   ```
3. Create a new file: `config/devices/your-controller.json`
4. Copy the generic mapping and update the note/CC numbers
5. Restart the server

### Example Custom Mapping

```json
{
  "device": {
    "name": "My Custom Controller",
    "protocol": "midi"
  },
  "mappings": {
    "play_a": {
      "midi": {
        "type": "noteon",
        "channel": 0,
        "note": 42  // ← Your controller's note number
      },
      "action": {
        "type": "transport",
        "command": "play",
        "deck": "A"
      },
      "target": "audio",
      "priority": "high"
    }
  }
}
```

## Simulating MIDI Input (Testing)

You can send MIDI messages to the server using command-line tools:

### Using amidi (Linux)
```bash
# List MIDI ports
amidi -l

# Send note on (play button)
amidi -p hw:1,0 -S '90 0B 7F'  # Channel 0, Note 11, Velocity 127

# Send note off
amidi -p hw:1,0 -S '80 0B 00'  # Channel 0, Note 11, Velocity 0

# Send CC (crossfader)
amidi -p hw:1,0 -S 'B0 08 40'  # Channel 0, CC 8, Value 64
```

### Using a Virtual MIDI Device

1. Create a virtual MIDI port
2. Send test messages
3. Watch the server respond

## Performance Monitoring

With debug mode enabled, you'll see periodic stats:

```
Router stats {
  "totalActions": 1523,
  "droppedActions": 0,
  "queueSizes": {
    "high": 0,
    "normal": 0
  }
}
```

## Log Files

All output is also logged to files:

- `logs/combined.log` - All log levels
- `logs/error.log` - Errors only

```bash
# Watch logs in real-time
tail -f logs/combined.log

# Filter for specific device
cat logs/combined.log | grep "Your DJ Controller"

# Show only errors
cat logs/error.log
```

## Troubleshooting

### "No MIDI devices found"

**Cause:** No MIDI devices connected or permissions issue

**Fix:**
```bash
# Check MIDI devices in system
aconnect -l  # or amidi -l

# Check permissions
ls -l /dev/snd/

# Add user to audio group if needed
sudo usermod -aG audio $USER
```

### "Failed to open MIDI device"

**Cause:** Device already in use by another application

**Fix:**
- Close other DJ software
- Restart the server
- Check for zombie processes: `pkill -f "node src/server.js"`

### "WebSocket connection failed"

**Cause:** Downstream services not running

**Fix:**
- This is normal! The server works without them
- WebSockets will auto-reconnect when services start
- Or update `.env` to point to correct URLs

### "Action queued but not sent"

**Cause:** Target WebSocket not connected

**Fix:**
- Actions are queued until connection is established
- Check WebSocket status in startup output
- Verify target service is running

## Next Steps

1. **Connect downstream services** to see full integration
2. **Create device-specific mappings** for your controllers
3. **Test feedback** by simulating state updates
4. **Implement HID support** (Phase 2) for jog wheels
5. **Add performance monitoring** for latency testing

## Demo Script

Want to show off the server? Here's a quick demo:

```bash
# 1. Start with debug mode
DEBUG=true npm start

# 2. Connect your DJ controller
# (Watch it auto-detect)

# 3. Press some buttons
# (Watch actions being translated and routed)

# 4. Show the logs
tail -20 logs/combined.log

# 5. Show the configuration
cat config/devices/generic-midi.json

# 6. Graceful shutdown
# (Press Ctrl+C - watch it disconnect cleanly)
```

That's it! You now have a working MIDI controller server for the Mismo DJ system.
