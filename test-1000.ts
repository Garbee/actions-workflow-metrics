import { fsSize } from 'systeminformation';

const disks = await fsSize();
const mainDisk = disks[0];

console.log('fsSize() raw values:');
console.log('  used:', mainDisk.used);
console.log('  available:', mainDisk.available);

console.log('\n=== Current code (divide by 1024^3) ===');
console.log('  used GB:', (mainDisk.used / (1024**3)).toFixed(2));
console.log('  available GB:', (mainDisk.available / (1024**3)).toFixed(2));

console.log('\n=== If values are in units of 1000 bytes (divide by 1000^3) ===');
console.log('  used GB:', (mainDisk.used / (1000**3)).toFixed(2));
console.log('  available GB:', (mainDisk.available / (1000**3)).toFixed(2));

console.log('\n=== If we should divide by (1024 * 1000^2) ===');
console.log('  used GB:', (mainDisk.used / (1024 * 1000 * 1000)).toFixed(2));
console.log('  available GB:', (mainDisk.available / (1024 * 1000 * 1000)).toFixed(2));
