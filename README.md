# Mismo DJ Controller Server

A Node.js microservice that handles physical DJ controller input (MIDI and HID devices) for the Mismo DJ system. This server translates hardware inputs into application actions and provides bidirectional communication for LED feedback, displays, and VU meters.

## Status

**Phase 1 Complete+** - Basic MIDI support with 14-bit high-resolution enhancement!

- ✅ MIDI device detection and connection
- ✅ Configuration-based device mapping system
- ✅ Action translation and routing
- ✅ WebSocket client infrastructure
- ✅ Feedback management framework
- ✅ **14-bit MIDI support** (16,384-step resolution for pro controllers)
- ⏳ HID device support (Phase 2)
- ⏳ Advanced feedback features (Phase 3)
- ⏳ Production deployment (Phase 4)

## Architecture

```
Physical Controllers (MIDI/HID)
    ↓
Controller Server (Node.js)
    ├─→ Audio Engine (WebSocket) - Transport, jog, effects
    ├─→ App Server (WebSocket) - Library, playlist actions
    └─→ Web UI (WebSocket) - Visual state updates
    ↑
State feedback (LEDs, displays, VU meters)
```

## Quick Start

### Prerequisites

- Node.js 24.0.0 or higher
- MIDI controller (optional, for testing with real hardware)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env to configure WebSocket URLs if needed
# Default values work for local development
```

### Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Configuration

The server can be configured via environment variables (`.env`) or config files:

**Environment Variables** (`.env`):
```bash
AUDIO_ENGINE_URL=ws://localhost:8080
APP_SERVER_URL=ws://localhost:3000
WEB_UI_URL=ws://localhost:8081
LOG_LEVEL=info
DEBUG=false
```

**Server Config** ([config/server.json](config/server.json)):
```json
{
  "audioEngineUrl": "ws://localhost:8080",
  "appServerUrl": "ws://localhost:3000",
  "webUIUrl": "ws://localhost:8081",
  "logLevel": "info",
  "debug": false
}
```

Environment variables take precedence over config file values.

## MIDI Device Mapping

Device mappings are defined in JSON files under [config/devices/](config/devices/). The server includes a generic MIDI mapping that works with most controllers.

### Example Mapping

```json
{
  "device": {
    "name": "Generic MIDI Controller",
    "protocol": "midi"
  },
  "mappings": {
    "play_a": {
      "midi": {
        "type": "noteon",
        "channel": 0,
        "note": 11
      },
      "action": {
        "type": "transport",
        "command": "play",
        "deck": "A"
      },
      "target": "audio",
      "priority": "high",
      "feedback": {
        "type": "led",
        "midiOut": {
          "type": "noteon",
          "channel": 0,
          "note": 11
        },
        "stateMap": {
          "playing": 127,
          "stopped": 0
        }
      }
    }
  }
}
```

See [docs/CONTROLLER_SERVER_IMPLEMENTATION_PLAN.md](docs/CONTROLLER_SERVER_IMPLEMENTATION_PLAN.md) for detailed mapping documentation.

## Project Structure

```
midi/
├── src/
│   ├── server.js                 # Main entry point
│   ├── managers/
│   │   └── MIDIManager.js        # MIDI device management
│   ├── translators/
│   │   └── MIDITranslator.js     # MIDI → Action translation
│   ├── mapping/
│   │   ├── ActionMapper.js       # Configuration-based mapping
│   │   └── ActionRouter.js       # Route actions to targets
│   ├── websocket/
│   │   ├── AudioEngineClient.js  # WebSocket to Audio Engine
│   │   ├── AppServerClient.js    # WebSocket to App Server
│   │   └── WebUIClient.js        # WebSocket to Web UI
│   ├── feedback/
│   │   └── FeedbackManager.js    # State → Hardware feedback
│   └── utils/
│       ├── logger.js             # Logging utilities
│       └── config.js             # Configuration loader
├── config/
│   ├── devices/
│   │   └── generic-midi.json     # Generic MIDI mapping
│   └── server.json               # Server configuration
├── test/                         # Tests (to be added)
├── docs/                         # Documentation
└── logs/                         # Log files
```

## WebSocket API

### Actions (Controller → Services)

```json
{
  "type": "action",
  "priority": "critical" | "high" | "normal",
  "timestamp": 1729950000000,
  "action": {
    "type": "transport" | "jog" | "effect" | "mixer" | "library",
    "deck": "A" | "B",
    "command": "play" | "cue" | "sync" | ...,
    "value": 0.75,
    "delta": -150
  }
}
```

### State Updates (Services → Controller)

```json
{
  "type": "state",
  "timestamp": 1729950000000,
  "deck": "A",
  "playback": { "playing": true, "paused": false, "cued": false },
  "position": { "currentTime": 45.234, "duration": 180.5 },
  "vuMeter": { "peak": 0.85, "rms": 0.67 },
  "sync": { "enabled": true, "locked": true }
}
```

## Development

### Scripts

```bash
npm start          # Start server
npm run dev        # Development with auto-reload
npm test           # Run tests (Phase 1: not implemented yet)
npm run lint       # Lint code
npm run lint:fix   # Fix linting issues
```

### Debugging

Enable debug logging:

```bash
DEBUG=true npm start
```

Or set in `.env`:
```bash
DEBUG=true
```

### Adding a New Device

1. Create a new mapping file: `config/devices/your-device.json`
2. Define MIDI note/CC numbers for each control
3. Map controls to actions
4. Define feedback outputs (optional)
5. Restart the server

The server will automatically detect and use the new mapping.

## Features

### Phase 1 (Complete)

- ✅ MIDI device detection and hot-plug support
- ✅ Event-driven MIDI input handling
- ✅ Configuration-based device mapping
- ✅ Action translation (MIDI → semantic actions)
- ✅ Priority-based action routing
- ✅ WebSocket clients with auto-reconnect
- ✅ Feedback management infrastructure
- ✅ Comprehensive logging

### Phase 2 (Planned)

- ⏳ HID device support
- ⏳ High-frequency jog wheel polling (125Hz)
- ⏳ Display output (LCD/OLED)
- ⏳ VU meter output
- ⏳ Critical-priority routing for jog wheels

### Phase 3 (Planned)

- ⏳ Full bidirectional feedback
- ⏳ LED state synchronization
- ⏳ Display updates (track info)
- ⏳ Performance monitoring

### Phase 4 (Planned)

- ⏳ Hot-reload configuration
- ⏳ Docker deployment
- ⏳ Virtual controller for testing
- ⏳ Production-ready error handling

## Performance Targets

| Action Type | Target Latency | Maximum |
|-------------|----------------|---------|
| Jog wheel   | <3ms          | 5ms     |
| Transport   | <10ms         | 20ms    |
| Library     | <50ms         | 100ms   |

## Troubleshooting

### No MIDI devices detected

1. Check that your MIDI controller is connected
2. Verify the controller appears in system MIDI devices
3. Try restarting the server
4. Check logs in `logs/combined.log`

### WebSocket connection failed

The server will automatically retry connections. Ensure downstream services are running:
- Audio Engine on port 8080
- App Server on port 3000
- Web UI on port 8081

### Action not being triggered

1. Enable debug logging: `DEBUG=true npm start`
2. Check if MIDI input is being received
3. Verify mapping configuration for your device
4. Check target WebSocket is connected

## Contributing

This is part of the Mismo DJ project. See the main project documentation for contribution guidelines.

## License

[License TBD]

## Links

- [Implementation Plan](docs/CONTROLLER_SERVER_IMPLEMENTATION_PLAN.md) - Detailed technical roadmap
- [CLAUDE.md](CLAUDE.md) - Project overview for AI assistants
