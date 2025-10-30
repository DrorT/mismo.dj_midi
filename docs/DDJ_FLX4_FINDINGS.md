# Pioneer DDJ-FLX4 - MIDI Analysis

## 🎚️ High-Resolution Faders (14-bit MIDI)

The DDJ-FLX4 uses **14-bit MIDI** for its faders, providing ultra-smooth control with 16,384 steps instead of the standard 128.

### How It Works

Each fader sends **TWO** CC messages:

```
Deck A Volume:
  CC 19 (0x13) = MSB (coarse value, 0-127)
  CC 51 (0x33) = LSB (fine value, 0-127)

Deck B Volume:
  CC 51 (0x33) = MSB
  CC 83 (0x53) = LSB (probably - need to verify)
```

### The Pattern

MIDI uses **CC number + 32** for the LSB:
- CC 19 (MSB) → CC 51 (LSB) ✅ (19 + 32 = 51)
- CC 20 (MSB) → CC 52 (LSB)
- etc.

### Calculating the Real Value

```javascript
// Combine MSB and LSB
fullValue = (MSB * 128) + LSB

// Example from your log:
// MSB = 127, LSB = 127
fullValue = (127 * 128) + 127 = 16383

// Normalize to 0.0-1.0 for the audio engine
normalized = fullValue / 16383 = 1.0 (full volume)
```

### Why This Is Better

**7-bit (standard MIDI):**
- 128 steps (0-127)
- Noticeable stepping when moving faders slowly
- Fine enough for most uses

**14-bit (high-resolution MIDI):**
- 16,384 steps (0-16383)
- Buttery smooth, no stepping
- Professional-grade precision
- Perfect for volume faders, EQ, filters

## 🎛️ Your DDJ-FLX4 MIDI Map (So Far)

### Volume Faders

| Control | MSB (CC) | LSB (CC) | Notes |
|---------|----------|----------|-------|
| Volume A | 19 (0x13) | 51 (0x33) | ✅ Confirmed |
| Volume B | 51 (0x33) | 83 (0x53) | ⚠️ Need to verify |

**Wait... there's overlap!** CC 51 is both:
- LSB for Volume A
- MSB for Volume B

This is unusual. Let me check your log more carefully:

```
CC 19 Value: 126  ← Volume A MSB
CC 51 Value:  28  ← Volume A LSB or Volume B MSB?
```

### Two Possibilities:

**Option 1: You were moving BOTH faders**
- CC 19 = Volume A (MSB)
- CC 51 = Volume B (MSB)
- Missing LSB messages

**Option 2: FLX4 uses a different pairing**
- CC 19 + CC 51 = Volume A (14-bit)
- CC X + CC Y = Volume B (14-bit)

## 🔍 Next Steps: Complete Mapping

To create a full DDJ-FLX4 mapping, we need to identify:

### Buttons (likely Note On/Off)
- ❓ Play A
- ❓ Play B
- ❓ Cue A
- ❓ Cue B
- ❓ Sync A
- ❓ Sync B
- ❓ Load A
- ❓ Load B
- ❓ Hot Cue buttons
- ❓ FX buttons

### Faders & Knobs (likely CC messages)
- ✅ Volume A: CC 19 (MSB) + CC 51 (LSB)
- ❓ Volume B: CC ?? + CC ??
- ❓ Crossfader: CC ?? + CC ??
- ❓ EQ High A/B
- ❓ EQ Mid A/B
- ❓ EQ Low A/B
- ❓ Filter A/B
- ❓ Trim A/B

### Encoders & Switches
- ❓ Browse encoder
- ❓ Tempo faders
- ❓ Beat FX knobs

### Special Controls (might be HID, not MIDI)
- ⚠️ Jog wheels (these use HID - Phase 2)
- ⚠️ Touch sensors
- ⚠️ Displays (HID output)

## 🎯 How to Map Your FLX4

### Quick Method (Manual):

1. Run the listener:
   ```bash
   node test/manual/listen-midi-events.js "DDJ-FLX4:DDJ-FLX4 MIDI 1 28:0"
   ```

2. Press/move EACH control and write down the values

3. Create `config/devices/ddj-flx4.json` with those values

### Interactive Method (Guided):

```bash
# Coming soon - guided mapping tool
node test/manual/create-flx4-mapping.js
```

This will walk you through each control step-by-step!

## 💡 Why Generic Mapping Doesn't Work

The generic mapping expects:
- Volume A: CC 9
- Volume B: CC 10
- Crossfader: CC 8

But your FLX4 uses:
- Volume A: CC 19 + CC 51 (14-bit!)
- Volume B: CC 51 + CC ?? (14-bit!)
- Crossfader: CC ?? + CC ?? (probably 14-bit!)

**Result:** No volume control until we create a proper mapping! 🎛️

## 🚀 Action Items

1. **Map all controls** - Use the listener to find every button/fader/knob
2. **Create ddj-flx4.json** - Custom device configuration
3. **Update MIDITranslator** - Add support for 14-bit CC messages
4. **Test!** - Verify smooth fader movement and button responses
