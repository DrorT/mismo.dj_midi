#!/usr/bin/env node

/**
 * Quick utility to list all connected HID devices
 * Usage: node list-hid-devices.js
 */

import HID from 'node-hid';

console.log('\n🎮 HID Devices Detection\n');
console.log('═══════════════════════════════════════\n');

try {
  const devices = HID.devices();

  if (devices.length === 0) {
    console.log('⚠️  No HID devices detected');
  } else {
    console.log(`Found ${devices.length} HID device(s):\n`);

    devices.forEach((device, index) => {
      console.log(`${index + 1}. ${device.product || 'Unknown Product'}`);
      console.log(`   Manufacturer: ${device.manufacturer || 'Unknown'}`);
      console.log(`   VendorID: 0x${device.vendorId?.toString(16).padStart(4, '0')} (${device.vendorId})`);
      console.log(`   ProductID: 0x${device.productId?.toString(16).padStart(4, '0')} (${device.productId})`);
      console.log(`   Path: ${device.path}`);
      console.log(`   Interface: ${device.interface}`);
      if (device.serialNumber) {
        console.log(`   Serial: ${device.serialNumber}`);
      }
      console.log('');
    });

    // Highlight DJ controllers
    const djControllers = devices.filter(d =>
      d.manufacturer?.toLowerCase().includes('native') ||
      d.manufacturer?.toLowerCase().includes('pioneer') ||
      d.manufacturer?.toLowerCase().includes('traktor') ||
      d.product?.toLowerCase().includes('kontrol') ||
      d.product?.toLowerCase().includes('ddj')
    );

    if (djControllers.length > 0) {
      console.log('🎛️  DJ Controllers detected:');
      djControllers.forEach(d => {
        console.log(`   ✨ ${d.manufacturer} ${d.product}`);
      });
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════\n');

} catch (error) {
  console.error('❌ Error detecting HID devices:', error.message);
  console.error('\n💡 You may need to run with sudo or add udev rules for USB access.\n');
  process.exit(1);
}
