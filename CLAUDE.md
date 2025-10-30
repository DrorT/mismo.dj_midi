# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mismo DJ Controller Server** - A Node.js microservice that handles physical DJ controller input (MIDI and HID devices) for the Mismo DJ system. This server translates hardware inputs into application actions and provides bidirectional communication for LED feedback, displays, and VU meters.

**Repository**: `mismo.dj_midi`
**Primary Language**: JavaScript (ES Modules)
**Node Version**: 24.0.0+

## Project Status

This repository is currently in the **planning phase**. The implementation plan is documented in [docs/CONTROLLER_SERVER_IMPLEMENTATION_PLAN.md](docs/CONTROLLER_SERVER_IMPLEMENTATION_PLAN.md). Implementation will follow a 4-phase approach:

1. **Phase 1**: Basic MIDI support and project setup (1-2 days)
2. **Phase 2**: HID device support for jog wheels and displays (2-3 days)
3. **Phase 3**: Bidirectional feedback system (2-3 days)
4. **Phase 4**: Production readiness and advanced features (2-3 days)

## Architecture Overview

The Controller Server acts as a bridge between physical DJ controllers and three downstream services:

```
Physical Controllers (MIDI/HID)
    ↓
Controller Server (this repo)
    ├─→ Audio Engine (WebSocket) - Transport, jog, effects
    ├─→ App Server (WebSocket) - Library, playlist actions
    └─→ Web UI (WebSocket) - Visual state updates
    ↑
State feedback (LEDs, displays, VU meters)
```

### Core Components (Planned)

- **Managers** (`src/managers/`): Device connection and event handling
  - `MIDIManager.js` - MIDI device lifecycle, event normalization
  - `HIDManager.js` - HID device polling (125Hz for jog wheels), state diffing

- **Translators** (`src/translators/`): Protocol-specific parsing
  - `MIDITranslator.js` - MIDI messages → semantic actions
  - `HIDTranslator.js` - HID state deltas → semantic actions

- **Mapping** (`src/mapping/`): Configuration-based action routing
  - `ActionMapper.js` - Load device configs from `config/devices/`
  - `ActionRouter.js` - Priority-based routing (critical/high/normal queues)

- **WebSocket Clients** (`src/websocket/`): Downstream service communication
  - `AudioEngineClient.js` - Bidirectional: commands out, state/VU in
  - `AppServerClient.js` - Bidirectional: commands out, library state in
  - `WebUIClient.js` - Send-only: state updates for visual feedback

- **Feedback** (`src/feedback/`): Hardware output management
  - `FeedbackManager.js` - Aggregate state from services, push to LEDs/displays

### Configuration System

Device mappings are JSON files in `config/devices/` that define:
- MIDI/HID input parsing (note numbers, CC, HID report structure)
- Action translation (what each input does)
- Routing targets (audio/app/ui)
- Priority levels (critical for jog wheels, normal for browsing)
- Feedback definitions (LED states, display formats)

## Performance Requirements

**Critical latency targets** (these are non-negotiable):
- Jog wheel (scratch): <3ms target, 5ms max
- Transport (play/cue): <10ms target, 20ms max
- LED feedback: <20ms target, 50ms max
- VU meter updates: 16ms (60Hz) target, 33ms max

**Implementation notes**:
- Jog wheels bypass normal action queue for minimum latency
- HID jog wheels require 8ms polling (125Hz)
- VU meter updates must be throttled to 60Hz to avoid USB saturation
- Use `performance.now()` for latency measurements in critical paths

## Key Technical Decisions

### Protocol Handling
- **MIDI**: Event-driven, low latency, 7-bit resolution
- **HID**: Polling-based, state diffing required, high resolution (10-bit, 14-bit)
- Both protocols normalized to common action format before routing

### Priority Queue System
Three priority levels for action routing:
1. **Critical**: Jog wheels - bypass queue, send immediately
2. **High**: Transport controls - head of queue
3. **Normal**: Library browsing, effects - standard queue

### State Management
- Controller Server is **stateless** for actions (pass-through)
- FeedbackManager maintains **cached state** from Audio/App servers
- State cache used to sync LEDs when new controller connects

### WebSocket Communication
- Auto-reconnect with exponential backoff on connection loss
- Action queuing during connection outage (with overflow protection)
- Subscribe to specific state events to reduce bandwidth

## Development Workflow (To Be Established)

Once implementation begins, typical workflow will be:

```bash
# Install dependencies
npm install

# Development with auto-reload
npm run dev

# Run tests
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:watch         # Watch mode

# Linting
npm run lint
npm run lint:fix

# Production build (if applicable)
npm start
```

## Testing Strategy

### Unit Tests
Focus on isolated component logic:
- MIDI/HID message parsing and normalization
- Action translation accuracy
- State diffing algorithms
- LED/display encoding

### Integration Tests
Test component interactions:
- End-to-end: MIDI input → WebSocket output
- Feedback loop: WebSocket state → LED output
- Multi-device scenarios

### Performance Tests
Verify latency requirements:
- Jog latency measurement (<5ms)
- Sustained event rates (1000+ events/sec)
- Memory leak detection (long-running tests)

### Manual Testing Tools
- `test/manual/phase1-midi-test.html` - Web UI for monitoring actions
- `test/manual/virtual-midi-device.js` - Simulate MIDI input without hardware

## Important Constraints

1. **USB Bandwidth**: Feedback updates must be throttled to avoid overwhelming USB bus. Batch LED updates when possible.

2. **Jog Wheel Latency**: The most critical requirement. Any change affecting jog wheel path should be performance-tested immediately.

3. **Node.js Native Modules**: `easymidi` and `node-hid` require native compilation. Docker container needs build tools and USB device access (`privileged: true`).

4. **Hot-Plug Support**: Controllers may be connected/disconnected during operation. Device watchers must handle this gracefully.

5. **Configuration Errors**: Invalid device mappings should fail gracefully with clear error messages, not crash the server.

## WebSocket API Contracts

### Actions (Controller → Services)
```javascript
{
  type: "action",
  priority: "critical" | "high" | "normal",
  timestamp: number,
  action: {
    type: "transport" | "jog" | "effect" | "mixer" | "library",
    deck: "A" | "B",
    command: string,
    value?: number,
    delta?: number  // For jog wheels
  }
}
```

### State Updates (Services → Controller)
```javascript
{
  type: "state",
  timestamp: number,
  deck?: "A" | "B",
  playback?: { playing: boolean, paused: boolean, cued: boolean },
  position?: { currentTime: number, duration: number },
  vuMeter?: { peak: number, rms: number },
  sync?: { enabled: boolean, locked: boolean }
}
```

Detailed API specification is in the implementation plan document.

## Adding New Device Support

To add a new MIDI/HID controller:

1. Create device config in `config/devices/<device-name>.json`
2. For MIDI: Use MIDI monitor to identify note/CC numbers
3. For HID: Use USB sniffing (Wireshark) to reverse-engineer report structure
4. Define mappings for each control
5. Define feedback outputs (LEDs, displays)
6. Test with manual test tools before integration testing

See implementation plan for detailed mapping config format.

## Docker Deployment Notes

Controller Server requires USB device access:
- Must run with `privileged: true` or specific device mounts
- Needs `libusb-dev` and `eudev-dev` for native modules
- Consider using `--device /dev/bus/usb` for more secure alternative to privileged mode

## Related Repositories

- **Audio Engine**: Handles audio playback, effects, mixing (WebSocket server)
- **App Server**: Manages music library, playlists, metadata (WebSocket server)
- **Web UI**: Browser-based DJ interface (WebSocket server)

This Controller Server communicates with all three as a WebSocket **client**.
