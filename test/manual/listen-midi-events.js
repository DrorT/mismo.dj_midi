#!/usr/bin/env node

/**
 * MIDI Event Listener - Press buttons on your controller to see events
 */

import easymidi from 'easymidi';

const deviceName = process.argv[2] || 'DDJ-FLX4:DDJ-FLX4 MIDI 1 28:0';

console.log('='.repeat(70));
console.log('🎹 MIDI Event Listener');
console.log('='.repeat(70));
console.log('');
console.log(`Connecting to: ${deviceName}`);
console.log('');
console.log('👉 Press buttons, turn knobs, and move faders on your controller');
console.log('📊 All MIDI events will be displayed below');
console.log('🛑 Press Ctrl+C to stop');
console.log('');
console.log('='.repeat(70));
console.log('');

try {
  const input = new easymidi.Input(deviceName);

  // Note On events (buttons pressed)
  input.on('noteon', (msg) => {
    console.log(`🔵 NOTE ON  | Channel: ${msg.channel} | Note: ${msg.note.toString().padStart(3)} (0x${msg.note.toString(16).toUpperCase().padStart(2, '0')}) | Velocity: ${msg.velocity}`);
  });

  // Note Off events (buttons released)
  input.on('noteoff', (msg) => {
    console.log(`⚪ NOTE OFF | Channel: ${msg.channel} | Note: ${msg.note.toString().padStart(3)} (0x${msg.note.toString(16).toUpperCase().padStart(2, '0')}) | Velocity: ${msg.velocity}`);
  });

  // Control Change (knobs, faders, encoders)
  input.on('cc', (msg) => {
    console.log(`🎚️  CC      | Channel: ${msg.channel} | Controller: ${msg.controller.toString().padStart(3)} (0x${msg.controller.toString(16).toUpperCase().padStart(2, '0')}) | Value: ${msg.value.toString().padStart(3)}`);
  });

  // Pitch Bend
  input.on('pitch', (msg) => {
    console.log(`🎛️  PITCH   | Channel: ${msg.channel} | Value: ${msg.value}`);
  });

  // Program Change
  input.on('program', (msg) => {
    console.log(`📻 PROGRAM | Channel: ${msg.channel} | Number: ${msg.number}`);
  });

  console.log('✅ Connected and listening...\n');

  // Keep alive
  process.on('SIGINT', () => {
    console.log('\n\n👋 Closing MIDI connection...');
    input.close();
    console.log('✅ Done!');
    process.exit(0);
  });

} catch (error) {
  console.error(`\n❌ Error: ${error.message}\n`);
  console.log('Available devices:');
  console.log('Inputs:', easymidi.getInputs());
  console.log('');
  console.log('Usage: node listen-midi-events.js "Device Name"');
  process.exit(1);
}
