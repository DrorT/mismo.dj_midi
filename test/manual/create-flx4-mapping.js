#!/usr/bin/env node

/**
 * Interactive tool to create a DDJ-FLX4 mapping
 * Captures MIDI events and generates a device config
 */

import easymidi from 'easymidi';
import fs from 'fs/promises';
import readline from 'readline';

const deviceName = 'DDJ-FLX4:DDJ-FLX4 MIDI 1 28:0';
const mappings = {};
const highResCCs = new Map(); // Track MSB/LSB pairs

console.log('='.repeat(70));
console.log('🎛️  DDJ-FLX4 Mapping Creator');
console.log('='.repeat(70));
console.log('');
console.log('This tool will help you create a custom mapping for your DDJ-FLX4');
console.log('');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

const controlsToMap = [
  { name: 'play_a', desc: 'Play button (Deck A)', type: 'button' },
  { name: 'play_b', desc: 'Play button (Deck B)', type: 'button' },
  { name: 'cue_a', desc: 'Cue button (Deck A)', type: 'button' },
  { name: 'cue_b', desc: 'Cue button (Deck B)', type: 'button' },
  { name: 'sync_a', desc: 'Sync button (Deck A)', type: 'button' },
  { name: 'sync_b', desc: 'Sync button (Deck B)', type: 'button' },
  { name: 'load_a', desc: 'Load button (Deck A)', type: 'button' },
  { name: 'load_b', desc: 'Load button (Deck B)', type: 'button' },
  { name: 'volume_a', desc: 'Volume fader (Deck A)', type: 'fader', highRes: true },
  { name: 'volume_b', desc: 'Volume fader (Deck B)', type: 'fader', highRes: true },
  { name: 'crossfader', desc: 'Crossfader', type: 'fader', highRes: true },
  { name: 'browse', desc: 'Browse encoder', type: 'encoder' }
];

let input;
let capturedEvents = [];

async function captureControl(control) {
  console.log('');
  console.log('─'.repeat(70));
  console.log(`📍 ${control.desc}`);
  console.log('─'.repeat(70));

  if (control.type === 'button') {
    console.log('   Press and release the button now...');
  } else if (control.type === 'fader') {
    console.log('   Move the fader from bottom to top slowly...');
  } else if (control.type === 'encoder') {
    console.log('   Turn the encoder left and right...');
  }

  capturedEvents = [];

  // Wait for events
  await new Promise(resolve => setTimeout(resolve, 3000));

  if (capturedEvents.length === 0) {
    console.log('   ⚠️  No events captured. Skipping...');
    return null;
  }

  // Analyze captured events
  const event = capturedEvents[0];
  console.log(`   ✅ Captured: ${JSON.stringify(event)}`);

  if (control.highRes && capturedEvents.length > 1) {
    // Check if this is a high-res CC pair
    const msb = capturedEvents.find(e => e.type === 'cc');
    const lsb = capturedEvents.find(e => e.type === 'cc' && e.controller === msb.controller + 32);

    if (msb && lsb) {
      console.log(`   ℹ️  Detected 14-bit CC: MSB=${msb.controller}, LSB=${lsb.controller}`);
      return { ...event, highRes: true, lsb: lsb.controller };
    }
  }

  return event;
}

async function createMapping() {
  console.log('Opening MIDI connection...');

  try {
    input = new easymidi.Input(deviceName);

    // Set up event listeners
    input.on('noteon', (msg) => {
      capturedEvents.push({ type: 'noteon', ...msg });
    });

    input.on('noteoff', (msg) => {
      capturedEvents.push({ type: 'noteoff', ...msg });
    });

    input.on('cc', (msg) => {
      capturedEvents.push({ type: 'cc', ...msg });
    });

    console.log('✅ Connected!\n');
    console.log('We will now map each control one by one.');
    console.log('For each control, press/move it when prompted.\n');

    await question('Press ENTER to start...');

    // Capture each control
    for (const control of controlsToMap) {
      const event = await captureControl(control);

      if (event) {
        mappings[control.name] = {
          event,
          control
        };
      }
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('✅ Mapping complete!');
    console.log('='.repeat(70));
    console.log('');

    // Generate config file
    const config = generateConfig(mappings);

    // Save to file
    const outputPath = 'config/devices/ddj-flx4.json';
    await fs.writeFile(outputPath, JSON.stringify(config, null, 2));

    console.log(`📁 Saved to: ${outputPath}`);
    console.log('');
    console.log('🎉 Your DDJ-FLX4 is now fully mapped!');
    console.log('   Restart the server to use the new mapping.');
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (input) {
      input.close();
    }
    rl.close();
  }
}

function generateConfig(mappings) {
  const config = {
    device: {
      name: 'Pioneer DDJ-FLX4',
      protocol: 'midi',
      vendor: 'Pioneer',
      product: 'DDJ-FLX4'
    },
    mappings: {}
  };

  // Generate mappings
  for (const [name, data] of Object.entries(mappings)) {
    const { event, control } = data;

    const mapping = {
      midi: {},
      action: getActionForControl(name),
      target: getTargetForControl(name),
      priority: getPriorityForControl(name)
    };

    if (event.type === 'noteon') {
      mapping.midi = {
        type: 'noteon',
        channel: event.channel,
        note: event.note
      };
    } else if (event.type === 'cc') {
      mapping.midi = {
        type: 'cc',
        channel: event.channel,
        controller: event.controller
      };

      if (event.highRes) {
        mapping.midi.highRes = true;
        mapping.midi.lsb = event.lsb;
      }
    }

    // Add feedback for buttons
    if (control.type === 'button') {
      mapping.feedback = {
        type: 'led',
        midiOut: mapping.midi,
        stateMap: getStateMappingForControl(name)
      };
    }

    // Add value expression for faders
    if (control.type === 'fader' && event.highRes) {
      mapping.action.valueExpression = '((value * 128) + lsb) / 16383';
    } else if (control.type === 'fader') {
      mapping.action.valueExpression = 'value / 127';
    }

    config.mappings[name] = mapping;
  }

  return config;
}

function getActionForControl(name) {
  const actions = {
    play_a: { type: 'transport', command: 'play', deck: 'A' },
    play_b: { type: 'transport', command: 'play', deck: 'B' },
    cue_a: { type: 'transport', command: 'cue', deck: 'A' },
    cue_b: { type: 'transport', command: 'cue', deck: 'B' },
    sync_a: { type: 'transport', command: 'sync', deck: 'A' },
    sync_b: { type: 'transport', command: 'sync', deck: 'B' },
    load_a: { type: 'library', command: 'loadTrack', deck: 'A' },
    load_b: { type: 'library', command: 'loadTrack', deck: 'B' },
    volume_a: { type: 'mixer', command: 'volume', deck: 'A' },
    volume_b: { type: 'mixer', command: 'volume', deck: 'B' },
    crossfader: { type: 'mixer', command: 'crossfader' },
    browse: { type: 'library', command: 'browse', direction: "value > 64 ? 'down' : 'up'" }
  };

  return actions[name];
}

function getTargetForControl(name) {
  if (name.startsWith('load_') || name === 'browse') {
    return 'app';
  }
  return 'audio';
}

function getPriorityForControl(name) {
  if (name.startsWith('play_') || name.startsWith('cue_') || name.startsWith('sync_')) {
    return 'high';
  }
  return 'normal';
}

function getStateMappingForControl(name) {
  if (name.startsWith('play_')) {
    return { playing: 127, stopped: 0 };
  } else if (name.startsWith('cue_')) {
    return { cued: 127, stopped: 0 };
  } else if (name.startsWith('sync_')) {
    return { locked: 127, enabled: 64, disabled: 0 };
  }
  return {};
}

// Run the mapping creator
createMapping();
