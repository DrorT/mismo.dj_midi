#!/usr/bin/env node

/**
 * HID Sniffer - Raw HID data logger
 * Usage: node hid-sniffer.js [vendorId] [productId]
 * Example: node hid-sniffer.js 0x17cc 0x1210
 */

import HID from 'node-hid';

const vendorId = process.argv[2] ? parseInt(process.argv[2], 16) : null;
const productId = process.argv[3] ? parseInt(process.argv[3], 16) : null;

console.log('\n🔍 HID Sniffer - Raw Data Logger\n');
console.log('═'.repeat(80));

// List all HID devices
const allDevices = HID.devices();

// Filter for DJ controllers or specific vendor/product
let targetDevices = allDevices;

if (vendorId && productId) {
  targetDevices = allDevices.filter(d =>
    d.vendorId === vendorId && d.productId === productId
  );
  console.log(`\nFiltering for VendorID: 0x${vendorId.toString(16)}, ProductID: 0x${productId.toString(16)}\n`);
} else {
  // Show known DJ controller vendors
  const knownVendors = [
    0x17cc, // Native Instruments
    0x2b73, // Pioneer DJ
    0x06f8, // Guillemot (Hercules)
  ];

  targetDevices = allDevices.filter(d => knownVendors.includes(d.vendorId));
  console.log('\nAuto-detected DJ controllers:\n');
}

if (targetDevices.length === 0) {
  console.log('❌ No matching HID devices found');
  console.log('\nAvailable HID devices:');
  allDevices.slice(0, 10).forEach((d, i) => {
    console.log(`${i + 1}. ${d.manufacturer} ${d.product} (${d.vendorId}:${d.productId})`);
  });
  process.exit(1);
}

console.log('Found devices:\n');
targetDevices.forEach((d, i) => {
  console.log(`${i + 1}. ${d.manufacturer} ${d.product}`);
  console.log(`   VendorID: 0x${d.vendorId?.toString(16)}, ProductID: 0x${d.productId?.toString(16)}`);
  console.log(`   Path: ${d.path}`);
  console.log(`   Interface: ${d.interface}`);
  console.log('');
});

// Connect to first matching device
const deviceInfo = targetDevices[0];

console.log('═'.repeat(80));
console.log(`\n📡 Connecting to: ${deviceInfo.manufacturer} ${deviceInfo.product}`);
console.log(`   Path: ${deviceInfo.path}\n`);

let device;
try {
  device = new HID.HID(deviceInfo.path);
  console.log('✅ Connected successfully!\n');
} catch (error) {
  console.error('❌ Failed to connect:', error.message);
  console.log('\n💡 You may need to run with sudo for USB access\n');
  process.exit(1);
}

console.log('═'.repeat(80));
console.log('\n🎧 Listening for HID data... (Press Ctrl+C to exit)\n');
console.log('Move controls on the device to see data:\n');

let lastData = null;
let sameCount = 0;

// Listen for data
device.on('data', (data) => {
  const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];

  // Check if data changed
  const dataStr = hex;
  if (dataStr === lastData) {
    sameCount++;
    return; // Skip duplicate data
  }

  if (sameCount > 0) {
    console.log(`   (same data repeated ${sameCount} times)`);
  }

  lastData = dataStr;
  sameCount = 0;

  console.log(`[${timestamp}] Length: ${data.length} bytes`);
  console.log(`HEX: ${hex}`);

  // Show byte-by-byte with indices
  const byteBreakdown = Array.from(data).map((b, i) => {
    const idx = `[${i.toString().padStart(2, ' ')}]`;
    const val = b.toString(16).padStart(2, '0');
    const dec = `(${b.toString().padStart(3, ' ')})`;
    return `${idx}:${val}${dec}`;
  });

  // Show in groups of 8 for readability
  for (let i = 0; i < byteBreakdown.length; i += 8) {
    console.log(`  ${byteBreakdown.slice(i, i + 8).join(' ')}`);
  }

  // Highlight changed bytes from previous
  console.log('');
});

device.on('error', (error) => {
  console.error('\n❌ Device error:', error.message);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Closing connection...');
  device.close();
  console.log('Goodbye!\n');
  process.exit(0);
});

// Keep process alive
setInterval(() => {}, 1000);
