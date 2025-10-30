# Quick Start - Pioneer DDJ-FLX4

## ✅ Your Controller is Connected!

The server successfully detected your **Pioneer DDJ-FLX4**:
- Device: `DDJ-FLX4:DDJ-FLX4 MIDI 1 28:0`
- Input: ✅ Available
- Output: ✅ Available

## 🚀 Test It Now!

### 1. Listen to Raw MIDI Events

**This shows you exactly what MIDI messages your controller sends:**

```bash
node test/manual/listen-midi-events.js "DDJ-FLX4:DDJ-FLX4 MIDI 1 28:0"
```

Now press buttons on your controller! You'll see:
- 🔵 **NOTE ON** when you press a button
- ⚪ **NOTE OFF** when you release it
- 🎚️ **CC** when you move faders or turn knobs

**Example output:**
```
🔵 NOTE ON  | Channel: 0 | Note:  11 (0x0B) | Velocity: 127
⚪ NOTE OFF | Channel: 0 | Note:  11 (0x0B) | Velocity: 0
🎚️  CC      | Channel: 0 | Controller:  08 (0x08) | Value:  64
```

Press **Ctrl+C** to stop.

---

### 2. Run the Full Server

**This processes MIDI and translates them to DJ actions:**

```bash
DEBUG=true npm start
```

Now press buttons and you'll see:
1. **MIDI Input detected**
2. **Action translated** (e.g., "play" command)
3. **Action routed** to Audio Engine

**Example output:**
```
MIDI input { "type": "noteon", "note": 11, "velocity": 127 }
Action translated { "action": "transport", "command": "play", "deck": "A" }
Action sent { "target": "audio", "success": true }
```

Press **Ctrl+C** to stop.

---

## 🎹 Creating a Custom Mapping for DDJ-FLX4

The generic mapping might not match your controller's button layout. Let's create a custom one!

### Step 1: Find Your Button Numbers

Run the listener and press each button you want to map:

```bash
node test/manual/listen-midi-events.js "DDJ-FLX4:DDJ-FLX4 MIDI 1 28:0"
```

Write down the note numbers for:
- Play A: Note __
- Play B: Note __
- Cue A: Note __
- Cue B: Note __
- Sync A: Note __
- Sync B: Note __
- Load A: Note __
- Load B: Note __
- Browse encoder: Controller __
- Crossfader: Controller __
- Volume A: Controller __
- Volume B: Controller __

### Step 2: Create DDJ-FLX4 Mapping File

```bash
cp config/devices/generic-midi.json config/devices/ddj-flx4.json
```

Then edit `config/devices/ddj-flx4.json` and update:
- Device name: `"name": "Pioneer DDJ-FLX4"`
- Note numbers to match what you found in Step 1

### Step 3: Restart Server

```bash
npm start
```

The server will automatically use your new DDJ-FLX4 mapping!

---

## 📊 Current Status

✅ **Working:**
- MIDI device detection
- Event processing
- Action translation
- WebSocket routing (to Audio Engine)
- Feedback system

⚠️ **Not Connected (but that's OK!):**
- App Server (for library browsing)
- Web UI (for visual feedback)

The server will automatically reconnect when these services start.

---

## 🎯 What to Expect

### When You Press PLAY Button:

1. **FLX4 sends:** MIDI Note On message
2. **Server receives:** Raw MIDI data
3. **Server translates:** "play" command for deck A
4. **Server routes:** Action to Audio Engine
5. **Audio Engine responds:** Playback state update
6. **Server sends back:** LED command to light up PLAY button

(Steps 4-6 require Audio Engine to be running)

---

## 🔧 Troubleshooting

### "No events when I press buttons"

1. Make sure the listener/server is running
2. Check the device name is exact: `"DDJ-FLX4:DDJ-FLX4 MIDI 1 28:0"`
3. Try unplugging and replugging the controller

### "Actions not being sent"

- This is normal! The Audio Engine isn't running yet
- Actions are queued and will be sent when services connect
- You'll see in the logs: "Cannot send to Audio Engine: not connected"

### "Want to see everything"

Enable full debug logging:
```bash
DEBUG=true npm start
```

Or watch the log file:
```bash
tail -f logs/combined.log
```

---

## 🎊 Next Steps

1. **Map all your buttons** - Create a complete DDJ-FLX4 config
2. **Start Audio Engine** - So commands actually execute
3. **Test feedback** - LEDs light up based on playback state
4. **Phase 2** - Add HID support for jog wheels and displays

---

## 💡 Tips

- The DDJ-FLX4's jog wheels use HID (not MIDI) - Phase 2 feature
- Basic buttons and faders work via MIDI right now
- You can have multiple device configs and the server picks the best match
- Hot-reload coming in Phase 4 (for now, restart to reload configs)

**Have fun! Your controller is working! 🎉**
