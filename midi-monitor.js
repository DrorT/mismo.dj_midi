#!/usr/bin/env node

/**
 * MIDI Monitor - Real-time MIDI message logger
 * Usage: node midi-monitor.js [device-name-pattern]
 * Example: node midi-monitor.js "Traktor"
 */

import easymidi from 'easymidi';

const devicePattern = process.argv[2]?.toLowerCase() || null;

console.log('\n🎹 MIDI Monitor - Real-time Message Logger\n');
console.log('═'.repeat(80));

// List all MIDI inputs
const inputs = easymidi.getInputs();

console.log('\nAvailable MIDI Input Devices:\n');
inputs.forEach((name, i) => {
  console.log(`${i + 1}. ${name}`);
});

// Filter devices if pattern provided
let targetDevices = inputs;
if (devicePattern) {
  targetDevices = inputs.filter(name => name.toLowerCase().includes(devicePattern));
  console.log(`\n🔍 Filtering for devices matching: "${devicePattern}"`);
}

if (targetDevices.length === 0) {
  console.log('\n❌ No matching MIDI devices found');
  process.exit(1);
}

console.log('\n📡 Monitoring MIDI devices:\n');
targetDevices.forEach((name, i) => {
  console.log(`${i + 1}. ${name}`);
});

console.log('\n═'.repeat(80));
console.log('\n🎧 Listening for MIDI messages... (Press Ctrl+C to exit)\n');

// Message type labels for clarity
const messageTypeLabels = {
  'noteon': 'Note On',
  'noteoff': 'Note Off',
  'cc': 'Control Change',
  'program': 'Program Change',
  'pitch': 'Pitch Bend',
  'poly aftertouch': 'Poly Aftertouch',
  'channel aftertouch': 'Channel Aftertouch',
  'sysex': 'System Exclusive'
};

// Track message counts
const messageCounts = {};
const recentMessages = new Map(); // Track recent values to detect changes

// Connect to all target devices
const connections = targetDevices.map(deviceName => {
  const input = new easymidi.Input(deviceName);

  // Listen to all message types
  const messageTypes = [
    'noteon', 'noteoff', 'cc', 'program', 'pitch',
    'poly aftertouch', 'channel aftertouch', 'sysex'
  ];

  messageTypes.forEach(msgType => {
    input.on(msgType, (msg) => {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      const typeLabel = messageTypeLabels[msgType] || msgType;

      // Count messages
      const key = `${deviceName}:${msgType}`;
      messageCounts[key] = (messageCounts[key] || 0) + 1;

      // Build message display
      let msgDisplay = `[${timestamp}] ${deviceName} - ${typeLabel}`;

      // Format message data based on type
      if (msgType === 'noteon' || msgType === 'noteoff') {
        msgDisplay += ` | Note: ${msg.note} (0x${msg.note.toString(16).padStart(2, '0')})`;
        msgDisplay += ` | Velocity: ${msg.velocity}`;
        msgDisplay += ` | Channel: ${msg.channel}`;
      } else if (msgType === 'cc') {
        msgDisplay += ` | CC: ${msg.controller} (0x${msg.controller.toString(16).padStart(2, '0')})`;
        msgDisplay += ` | Value: ${msg.value}`;
        msgDisplay += ` | Channel: ${msg.channel}`;

        // Detect value changes for CC messages
        const ccKey = `${deviceName}:cc:${msg.controller}`;
        const lastValue = recentMessages.get(ccKey);
        if (lastValue !== undefined && lastValue !== msg.value) {
          const delta = msg.value - lastValue;
          msgDisplay += ` | Δ: ${delta > 0 ? '+' : ''}${delta}`;
        }
        recentMessages.set(ccKey, msg.value);
      } else if (msgType === 'program') {
        msgDisplay += ` | Program: ${msg.number}`;
        msgDisplay += ` | Channel: ${msg.channel}`;
      } else if (msgType === 'pitch') {
        msgDisplay += ` | Value: ${msg.value}`;
        msgDisplay += ` | Channel: ${msg.channel}`;
      } else if (msgType === 'sysex') {
        msgDisplay += ` | Bytes: ${msg.bytes?.length || 0}`;
        if (msg.bytes && msg.bytes.length > 0) {
          const hex = msg.bytes.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join(' ');
          msgDisplay += ` | Data: ${hex}${msg.bytes.length > 16 ? '...' : ''}`;
        }
      } else {
        msgDisplay += ` | ${JSON.stringify(msg)}`;
      }

      console.log(msgDisplay);
    });
  });

  return { deviceName, input };
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n📊 Message Statistics:\n');

  const stats = Object.entries(messageCounts).sort((a, b) => b[1] - a[1]);
  stats.forEach(([key, count]) => {
    const [device, type] = key.split(':');
    console.log(`  ${messageTypeLabels[type] || type} (${device}): ${count} messages`);
  });

  console.log('\n👋 Closing connections...');
  connections.forEach(({ input, deviceName }) => {
    input.close();
    console.log(`  ✓ Closed: ${deviceName}`);
  });
  console.log('Goodbye!\n');
  process.exit(0);
});

// Keep process alive
setInterval(() => {}, 1000);
