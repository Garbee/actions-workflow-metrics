import { fsSize } from 'systeminformation';

const disks = await fsSize();
const mainDisk = disks[0];

console.log('fsSize() returns:');
console.log('  used:', mainDisk.used);

// From df -k, used is 56203552 KB
const dfUsedKB = 56203552;
console.log('\ndf -k shows used:', dfUsedKB, 'KB');

console.log('\nConverting df KB to bytes:');
const dfUsedBytes = dfUsedKB * 1024;
console.log('  df used in bytes:', dfUsedBytes);

console.log('\nComparing:');
console.log('  fsSize used:', mainDisk.used);
console.log('  df used (bytes):', dfUsedBytes);
console.log('  Ratio:', mainDisk.used / dfUsedBytes);

// Check if fs Size is giving us values in units of 1024 bytes (KB) instead of bytes
console.log('\nIf fsSize values are in KB (not bytes):');
console.log('  fsSize used (interpreted as KB):', mainDisk.used);
console.log('  df used (in KB):', dfUsedKB);
console.log('  Close match?', Math.abs(mainDisk.used - dfUsedKB) < 10000);
