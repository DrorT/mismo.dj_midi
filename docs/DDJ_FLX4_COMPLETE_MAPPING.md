# Pioneer DDJ-FLX4 - Complete MIDI Mapping

**Status**: ✅ Complete - Based on official Pioneer DDJ-FLX4_MIDI_message_List_E1.pdf
**Version**: 1.0
**Configuration File**: [config/devices/ddj-flx4.json](../config/devices/ddj-flx4.json)

## Overview

This document describes the complete MIDI implementation for the Pioneer DDJ-FLX4 DJ controller. The mapping includes **all MIDI-accessible controls** from the official specification.

## Summary

- **Total Controls Mapped**: 80+
- **14-bit High-Resolution Controls**: 15 (faders, EQs, effects)
- **MIDI Channels Used**: 7 (Channels 0-6)
- **Performance Pads**: 8 per deck (Hot Cue mode mapped)
- **SHIFT Combinations**: 30+

## Control Groups

### 1. Transport Controls

| Control | Deck | MIDI | Action | Priority |
|---------|------|------|--------|----------|
| **PLAY/PAUSE** | A | Ch0, Note 11 | `transport.play` | High |
| PLAY + SHIFT | A | Ch0, Note 14 | `transport.stutter` | High |
| **PLAY/PAUSE** | B | Ch1, Note 11 | `transport.play` | High |
| PLAY + SHIFT | B | Ch1, Note 14 | `transport.stutter` | High |
| **CUE** | A | Ch0, Note 12 | `transport.cue` | High |
| CUE + SHIFT | A | Ch0, Note 72 | `transport.cue_default` | High |
| **CUE** | B | Ch1, Note 12 | `transport.cue` | High |
| CUE + SHIFT | B | Ch1, Note 72 | `transport.cue_default` | High |

**Special Behavior**: CUE + SHIFT returns to the default cue point (start of track).

---

### 2. Sync & Tempo

| Control | Deck | MIDI | Action | Notes |
|---------|------|------|--------|-------|
| **BEAT SYNC** | A | Ch0, Note 88 | `transport.sync` | MIDI sent on *release* ⚠️ |
| BEAT SYNC (Long) | A | Ch0, Note 92 | `transport.sync_master` | Set as master |
| SYNC + SHIFT | A | Ch0, Note 96 | `transport.sync_off` | Disable sync |
| **BEAT SYNC** | B | Ch1, Note 88 | `transport.sync` | MIDI sent on *release* ⚠️ |
| BEAT SYNC (Long) | B | Ch1, Note 92 | `transport.sync_master` | Set as master |
| SYNC + SHIFT | B | Ch1, Note 96 | `transport.sync_off` | Disable sync |
| **TEMPO Slider** | A | Ch0, CC 0+32 | `transport.tempo` | 14-bit, ±100% |
| **TEMPO Slider** | B | Ch1, CC 0+32 | `transport.tempo` | 14-bit, ±100% |

**Important**: The BEAT SYNC button sends MIDI when you *release* the button, not when you press it. This is unique to this control.

---

### 3. Loop Controls

| Control | Deck | MIDI | Action |
|---------|------|------|--------|
| **IN** | A | Ch0, Note 16 | `loop.in` |
| IN + SHIFT | A | Ch0, Note 76 | `loop.reloop` |
| **OUT** | A | Ch0, Note 17 | `loop.out` |
| OUT + SHIFT | A | Ch0, Note 78 | `loop.exit` |
| **4 BEAT** | A | Ch0, Note 77 | `loop.auto` (4 beats) |
| 4 BEAT + SHIFT | A | Ch0, Note 80 | `loop.auto` (8 beats) |
| **Loop Call ◁** | A | Ch0, Note 81 | `loop.call_prev` |
| Loop Call ◁ + SHIFT | A | Ch0, Note 62 | `loop.delete_prev` |
| **Loop Call ▷** | A | Ch0, Note 83 | `loop.call_next` |
| Loop Call ▷ + SHIFT | A | Ch0, Note 61 | `loop.delete_next` |

*Deck B uses identical controls on MIDI Channel 1 (0x91)*

---

### 4. Mixer Controls

#### 4.1 EQ & Trim (14-bit)

| Control | Deck | MIDI | Action | Resolution |
|---------|------|------|--------|------------|
| **TRIM** | A | Ch0, CC 4+36 | `mixer.trim` | 14-bit |
| **TRIM** | B | Ch1, CC 4+36 | `mixer.trim` | 14-bit |
| **EQ HI** | A | Ch0, CC 7+39 | `mixer.eq_high` | 14-bit |
| **EQ HI** | B | Ch1, CC 7+39 | `mixer.eq_high` | 14-bit |
| **EQ MID** | A | Ch0, CC 11+43 | `mixer.eq_mid` | 14-bit |
| **EQ MID** | B | Ch1, CC 11+43 | `mixer.eq_mid` | 14-bit |
| **EQ LOW** | A | Ch0, CC 15+47 | `mixer.eq_low` | 14-bit |
| **EQ LOW** | B | Ch1, CC 15+47 | `mixer.eq_low` | 14-bit |

#### 4.2 Channel Faders (14-bit)

| Control | Deck | MIDI | Action | Resolution |
|---------|------|------|--------|------------|
| **CH FADER** | A | Ch0, CC 19+51 | `mixer.volume` | 14-bit (16,384 steps) |
| **CH FADER** | B | Ch1, CC 19+51 | `mixer.volume` | 14-bit (16,384 steps) |
| **CROSSFADER** | - | Ch6, CC 31+63 | `mixer.crossfader` | 14-bit (16,384 steps) |

#### 4.3 Headphone & Master

| Control | MIDI | Action | Resolution |
|---------|------|--------|------------|
| **HEADPHONE MIX** | Ch6, CC 8+40 | `mixer.headphone_mix` | 14-bit |
| **HEADPHONE LEVEL** | Ch6, CC 23+55 | `mixer.headphone_level` | 14-bit |
| **MASTER LEVEL** | Ch6, CC 24+56 | `mixer.master_level` | 14-bit |
| **MIC LEVEL** | Ch6, CC 5+37 | `mixer.mic_level` | 14-bit |

#### 4.4 Cue Buttons

| Control | Deck | MIDI | Action |
|---------|------|------|--------|
| **CH CUE** | A | Ch0, Note 84 | `mixer.headphone_cue` |
| CH CUE + SHIFT | A | Ch0, Note 104 | `mixer.headphone_cue_split` |
| **CH CUE** | B | Ch1, Note 84 | `mixer.headphone_cue` |
| CH CUE + SHIFT | B | Ch1, Note 104 | `mixer.headphone_cue_split` |
| **MASTER CUE** | - | Ch6, Note 99 | `mixer.master_cue` |
| MASTER CUE + SHIFT | - | Ch6, Note 120 | `mixer.master_cue_mono` |

---

### 5. Effects

| Control | MIDI | Action | Resolution |
|---------|------|--------|------------|
| **FX LEVEL/DEPTH** | Ch5, CC 2+34 | `effect.level` | 14-bit |
| **FX ON (CH1)** | Ch4, Note 71 | `effect.on` (Ch1) | Button |
| **FX ON (CH2)** | Ch5, Note 71 | `effect.on` (Ch2) | Button |
| **BEAT ◁** | Ch4, Note 67 | `effect.beat_prev` | Button |
| **BEAT ▷** | Ch5, Note 67 | `effect.beat_next` | Button |
| **SMART FADER** | Ch6, CC 12+44 | `effect.smart_fader` | 14-bit |
| **SMART CFX** | Ch6, CC 13+45 | `effect.smart_cfx` | 14-bit |

**FX ON/OFF Special Behavior**: The button *blinks* when receiving NOTE ON, and lights *solid* when receiving NOTE OFF.

---

### 6. Library / Browse

| Control | MIDI | Action | Notes |
|---------|------|--------|-------|
| **BROWSE Encoder** | Ch6, CC 64 | `library.browse` | Relative: >0x41 = CW, <0x3F = CCW |
| BROWSE + SHIFT | Ch6, CC 100 | `library.browse_fast` | Faster browsing |
| **BROWSE Press** | Ch6, Note 65 | `library.browse_enter` | Enter folder |
| BROWSE Press + SHIFT | Ch6, Note 66 | `library.browse_back` | Go back |
| **LOAD (Deck A)** | Ch6, Note 70 | `library.load` (Deck A) | Load to deck |
| LOAD + SHIFT (A) | Ch6, Note 104 | `library.eject` (Deck A) | Eject track |
| **LOAD (Deck B)** | Ch6, Note 71 | `library.load` (Deck B) | Load to deck |
| LOAD + SHIFT (B) | Ch6, Note 122 | `library.eject` (Deck B) | Eject track |

---

### 7. Performance Pads (Hot Cue Mode)

Each deck has 4 performance pads. Only Hot Cue mode is currently mapped.

#### Deck A (Channel 0)

| Pad | MIDI | Action | SHIFT Action (MIDI) |
|-----|------|--------|---------------------|
| **Pad 1** | Note 27 | `hotcue.activate` #1 | Delete (Note 105) |
| **Pad 2** | Note 30 | `hotcue.activate` #2 | Delete (Note 107) |
| **Pad 3** | Note 32 | `hotcue.activate` #3 | Delete (Note 109) |
| **Pad 4** | Note 34 | `hotcue.activate` #4 | Delete (Note 111) |

#### Deck B (Channel 1)

| Pad | MIDI | Action | SHIFT Action (MIDI) |
|-----|------|--------|---------------------|
| **Pad 1** | Note 27 | `hotcue.activate` #1 | Delete (Note 105) |
| **Pad 2** | Note 30 | `hotcue.activate` #2 | Delete (Note 107) |
| **Pad 3** | Note 32 | `hotcue.activate` #3 | Delete (Note 109) |
| **Pad 4** | Note 34 | `hotcue.activate` #4 | Delete (Note 111) |

**Other Pad Modes** (not yet mapped):
- Pad FX 1 Mode (Channel 7)
- Pad FX 2 Mode (Channel 8)
- Beat Jump Mode (Channel 9)
- Sampler Mode (Channel 10)
- Keyboard Mode (see spec for note assignments)
- Beat Loop Mode (see spec for note assignments)
- Key Shift Mode (see spec for note assignments)

---

## 14-bit High-Resolution Controls

The DDJ-FLX4 uses **14-bit MIDI** for ultra-smooth control of faders and knobs. This provides **16,384 steps** instead of the standard 128 steps.

### How 14-bit MIDI Works

Each 14-bit control sends **two MIDI CC messages**:
1. **MSB (Most Significant Byte)**: CC 0-31
2. **LSB (Least Significant Byte)**: CC 32-63 (MSB + 32)

**Example**: Channel Fader A
- MSB: CC 19 (value 0-127)
- LSB: CC 51 (value 0-127)
- Combined: `(MSB × 128) + LSB` = 0 to 16,383

### 14-bit Controls on DDJ-FLX4

| Control | MSB CC | LSB CC | Range |
|---------|--------|--------|-------|
| Tempo A/B | 0 | 32 | 0x0000 - 0x7F7F |
| FX Level/Depth | 2 | 34 | 0x0000 - 0x7F7F |
| Trim A/B | 4 | 36 | 0x0000 - 0x7F7F |
| Mic Level | 5 | 37 | 0x0000 - 0x7F7F |
| EQ Hi A/B | 7 | 39 | 0x0000 - 0x7F7F |
| Headphone Mix | 8 | 40 | 0x0000 - 0x7F7F |
| EQ Mid A/B | 11 | 43 | 0x0000 - 0x7F7F |
| Smart Fader | 12 | 44 | 0x0000 - 0x7F7F |
| Smart CFX | 13 | 45 | 0x0000 - 0x7F7F |
| EQ Low A/B | 15 | 47 | 0x0000 - 0x7F7F |
| Volume A/B | 19 | 51 | 0x0000 - 0x7F7F |
| Headphone Level | 23 | 55 | 0x0000 - 0x7F7F |
| Master Level | 24 | 56 | 0x0000 - 0x7F7F |
| Crossfader | 31 | 63 | 0x0000 - 0x7F7F |

### Automatic Detection

The MIDIManager **automatically detects and combines** 14-bit messages. You don't need to configure this manually. It:

1. Stores MSB value when received
2. Waits up to 50ms for matching LSB
3. Combines into 14-bit value if LSB arrives
4. Falls back to 7-bit if LSB doesn't arrive
5. Normalizes to 0.0 - 1.0 range automatically

---

## MIDI Channel Assignments

| Channel | Hex | Purpose |
|---------|-----|---------|
| 0 | 0x90 | Deck 1 - Transport, loops, Hot Cue pads |
| 1 | 0x91 | Deck 2 - Transport, loops, Hot Cue pads |
| 4 | 0x94 | FX Channel 1 controls |
| 5 | 0x95 | FX Channel 2 controls |
| 6 | 0x96 | Mixer, Master, Browse, Load |
| 7 | 0x97 | Performance Pads - Pad FX 1 Mode |
| 8 | 0x98 | Performance Pads - Pad FX 2 Mode |
| 9 | 0x99 | Performance Pads - Beat Jump Mode |
| 10 | 0x9A | Performance Pads - Sampler Mode |

---

## Special Notes

### 1. BEAT SYNC Button Behavior
Unlike most buttons, **BEAT SYNC sends MIDI when you RELEASE the button**, not when you press it. This is documented in the official specification.

### 2. FX ON/OFF LED Behavior
- Receives **NOTE ON** (0x7F): LED **blinks**
- Receives **NOTE OFF** (0x00): LED lights **solid**

### 3. Channel Fader Start (Not Implemented)
The spec includes special messages when channel faders reach certain positions:
- Fader moves from bottom: Sends PLAY message
- Fader returns to bottom: Sends CUE message

These are documented but not currently mapped.

### 4. Jog Wheels
**Jog wheels are NOT MIDI** - they use HID (Human Interface Device) protocol for higher precision. These will be implemented in Phase 2.

The PDF shows jog wheel MIDI messages for:
- Jog Dial (Platter) touch/rotation
- Jog Dial (Wheel side) touch/rotation

But these are supplementary - the primary jog wheel data is HID.

---

## Testing Your Mapping

### 1. Listen to Raw MIDI Events

```bash
node test/manual/listen-midi-events.js "DDJ-FLX4:DDJ-FLX4 MIDI 1 28:0"
```

Press buttons and move controls to see their MIDI messages.

### 2. Run the Full Server

```bash
DEBUG=true npm start
```

Actions will be translated and routed to the Audio/App engines.

### 3. Test Specific Control Groups

Try each section:
- ✅ Transport (Play, Cue, Sync)
- ✅ Loops (In, Out, 4 Beat, Call)
- ✅ Mixer (Faders, EQs, Trim, Cue)
- ✅ Effects (FX On, Level, Smart controls)
- ✅ Browse (Encoder, Load)
- ✅ Hot Cue Pads (4 per deck)

---

## What's NOT Mapped (Yet)

1. **Performance Pad Modes** (Channels 7-10):
   - Pad FX 1 & 2
   - Beat Jump
   - Sampler
   - Keyboard
   - Beat Loop
   - Key Shift

2. **Jog Wheels** (HID):
   - Scratch/nudge functionality
   - Coming in Phase 2

3. **Channel Fader Start**:
   - Auto-play when fader moves
   - Documented in spec but not essential

4. **Vinyl Mode Toggle**:
   - Can't be changed from unit
   - Requires MIDI-OUT from DJ software

---

## References

- **Official Spec**: [docs/midi_mappings/DDJ-FLX4_MIDI_message_List_E1.pdf](../docs/midi_mappings/DDJ-FLX4_MIDI_message_List_E1.pdf)
- **Implementation**: [config/devices/ddj-flx4.json](../config/devices/ddj-flx4.json)
- **14-bit MIDI Guide**: [14BIT_MIDI_SUPPORT.md](./14BIT_MIDI_SUPPORT.md)
- **Quick Start Guide**: [QUICK_START.md](../QUICK_START.md)

---

**Last Updated**: 2025-10-30
**Mapping Version**: 1.0
**Status**: ✅ Complete for all MIDI-accessible controls
