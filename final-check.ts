import { fsSize } from 'systeminformation';

const disks = await fsSize();
const mainDisk = disks[0];

// From df, used is 56204060 KB = 57553213440 bytes
const dfUsedBytes = 56204060 * 1024;

console.log('df used in bytes:', dfUsedBytes);
console.log('fsSize used:', mainDisk.used);
console.log('Difference:', mainDisk.used - dfUsedBytes, 'bytes');
console.log('Ratio:', mainDisk.used / dfUsedBytes);

// What if fs Size is returning values in units of 10 bytes?
console.log('\nIf fsSize is in units of 10 bytes:');
console.log('  fsSize * 10 / 1024^3 =', (mainDisk.used * 10) / (1024**3), 'GB');

// What if we should be dividing by 1024^2 instead of 1024^3?
console.log('\nIf we divide by 1024^2 (giving MB, not GB):');
console.log('  fsSize / 1024^2 =', (mainDisk.used / (1024**2)), 'MB');
console.log('  Which is', (mainDisk.used / (1024**2)) / 1024, 'GB');
