#!/usr/bin/env node

/**
 * Real-time MIDI monitor - listens to all MIDI inputs and logs messages
 * Usage: node monitor-midi.js [device-name]
 *
 * Press Ctrl+C to exit
 */

import easymidi from 'easymidi';

const deviceName = process.argv[2];

console.log('\n🎹 MIDI Monitor\n');
console.log('═══════════════════════════════════════\n');

const inputs = easymidi.getInputs();

if (inputs.length === 0) {
  console.log('❌ No MIDI input devices found');
  process.exit(1);
}

console.log('Available MIDI inputs:');
inputs.forEach((device, index) => {
  console.log(`   ${index + 1}. ${device}`);
});
console.log('');

// If no device specified, list them and exit
if (!deviceName) {
  console.log('Usage: node monitor-midi.js "<device-name>"');
  console.log('Example: node monitor-midi.js "Midi Through:Midi Through Port-0 14:0"');
  console.log('\nOr to monitor ALL devices, use: node monitor-midi.js all\n');
  process.exit(0);
}

const connections = [];

function createMonitor(name) {
  try {
    const input = new easymidi.Input(name);
    console.log(`✅ Monitoring: ${name}`);

    // Listen to all MIDI message types
    const messageTypes = [
      'noteon', 'noteoff', 'poly aftertouch', 'cc', 'program',
      'channel aftertouch', 'pitch', 'position', 'mtc', 'select',
      'clock', 'start', 'continue', 'stop', 'activesensing', 'reset'
    ];

    messageTypes.forEach(type => {
      input.on(type, msg => {
        console.log(`[${name}] ${type.toUpperCase()}:`, JSON.stringify(msg));
      });
    });

    connections.push(input);
  } catch (error) {
    console.error(`❌ Failed to connect to ${name}:`, error.message);
  }
}

if (deviceName.toLowerCase() === 'all') {
  console.log('Monitoring ALL MIDI input devices...\n');
  inputs.forEach(createMonitor);
} else {
  // Check if device exists
  if (!inputs.includes(deviceName)) {
    console.error(`❌ Device "${deviceName}" not found`);
    process.exit(1);
  }
  createMonitor(deviceName);
}

console.log('\n🎧 Listening for MIDI messages... (Press Ctrl+C to exit)\n');

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n\n👋 Closing MIDI connections...');
  connections.forEach(input => input.close());
  console.log('Goodbye!\n');
  process.exit(0);
});
