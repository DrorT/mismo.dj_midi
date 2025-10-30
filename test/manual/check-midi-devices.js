#!/usr/bin/env node

/**
 * MIDI Device Diagnostic Tool
 * Run this to check what MIDI devices are available
 */

import easymidi from 'easymidi';

console.log('='.repeat(60));
console.log('MIDI Device Diagnostic Tool');
console.log('='.repeat(60));
console.log('');

// Get inputs
const inputs = easymidi.getInputs();
console.log('📥 MIDI Inputs Found:', inputs.length);
if (inputs.length === 0) {
  console.log('   ⚠️  No MIDI input devices detected');
} else {
  inputs.forEach((input, i) => {
    console.log(`   ${i + 1}. ${input}`);
  });
}
console.log('');

// Get outputs
const outputs = easymidi.getOutputs();
console.log('📤 MIDI Outputs Found:', outputs.length);
if (outputs.length === 0) {
  console.log('   ⚠️  No MIDI output devices detected');
} else {
  outputs.forEach((output, i) => {
    console.log(`   ${i + 1}. ${output}`);
  });
}
console.log('');

console.log('='.repeat(60));
console.log('Troubleshooting Tips:');
console.log('='.repeat(60));

if (inputs.length === 0 && outputs.length === 0) {
  console.log(`
❌ No MIDI devices found!

Possible causes:

1. **Device not connected**
   → Check USB cable is plugged in
   → Try a different USB port
   → Ensure controller is powered on

2. **Driver issues**
   → Pioneer FLX4 may need specific drivers
   → Check if it appears in system settings
   → Try: lsusb | grep -i pioneer

3. **Permissions**
   → Your user may need to be in 'audio' group
   → Run: sudo usermod -aG audio $USER
   → Then log out and back in

4. **PipeWire/ALSA configuration**
   → Check: aconnect -l
   → Check: cat /proc/asound/cards
   → The device may appear as audio, not MIDI

5. **Pioneer FLX4 specific**
   → The FLX4 uses HID for jog wheels (Phase 2 feature)
   → But basic buttons should still show as MIDI
   → Try checking if it appears as a sound card
`);
} else if (inputs.length > 0) {
  console.log(`
✅ MIDI devices found!

If your Pioneer FLX4 is not in the list above:
1. It may not be connected or powered on
2. It may be in use by another application
3. It may appear with a different name
4. Check system sound settings for the device

If you see "Midi Through" only:
→ This is a system loopback port, not a real controller
`);
}

console.log('');
console.log('='.repeat(60));
