#!/usr/bin/env node

/**
 * Quick utility to list all connected MIDI devices
 * Usage: node list-midi-devices.js
 */

import easymidi from 'easymidi';

console.log('\n🎹 MIDI Devices Detection\n');
console.log('═══════════════════════════════════════\n');

try {
  const inputs = easymidi.getInputs();
  const outputs = easymidi.getOutputs();

  console.log('📥 MIDI Input Devices:');
  if (inputs.length === 0) {
    console.log('   (none detected)');
  } else {
    inputs.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device}`);
    });
  }

  console.log('\n📤 MIDI Output Devices:');
  if (outputs.length === 0) {
    console.log('   (none detected)');
  } else {
    outputs.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device}`);
    });
  }

  console.log('\n═══════════════════════════════════════\n');

  if (inputs.length > 0 || outputs.length > 0) {
    console.log('✅ Total devices found:', inputs.length + outputs.length);
  } else {
    console.log('⚠️  No MIDI devices detected');
    console.log('   Make sure your device is connected and powered on.');
  }
  console.log('');

} catch (error) {
  console.error('❌ Error detecting MIDI devices:', error.message);
  process.exit(1);
}
