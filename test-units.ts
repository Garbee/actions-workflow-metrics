import { fsSize } from 'systeminformation';

const disks = await fsSize();
const mainDisk = disks[0];  // /dev/root

console.log('Raw value from fsSize():');
console.log('  used:', mainDisk.used);
console.log('  available:', mainDisk.available);

// According to the documentation, these should be in bytes
// But let's test if they're actually in KB
console.log('\n=== If values are in BYTES ===');
const bytesPerGB = 1024 * 1024 * 1024;
console.log('  used GB:', (mainDisk.used / bytesPerGB).toFixed(2));
console.log('  available GB:', (mainDisk.available / bytesPerGB).toFixed(2));

console.log('\n=== If values are in KILOBYTES ===');
const KBPerGB = 1024 * 1024;
console.log('  used GB:', (mainDisk.used / KBPerGB).toFixed(2));
console.log('  available GB:', (mainDisk.available / KBPerGB).toFixed(2));

// Compare with df command
console.log('\n=== What df -k shows (in KB) ===');
