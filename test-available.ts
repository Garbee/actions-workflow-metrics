import { fsSize } from 'systeminformation';

const disks = await fsSize();
const mainDisk = disks[0];

console.log('Disk values:');
console.log('  size:', mainDisk.size);
console.log('  used:', mainDisk.used);
console.log('  available:', mainDisk.available);

console.log('\nCalculations:');
console.log('  size - used:', mainDisk.size - mainDisk.used);
console.log('  available:', mainDisk.available);
console.log('  used + available:', mainDisk.used + mainDisk.available);
console.log('  size:', mainDisk.size);

console.log('\nDoes size == used + available?', mainDisk.size === (mainDisk.used + mainDisk.available));
console.log('Difference:', mainDisk.size - (mainDisk.used + mainDisk.available));

// The difference is typically reserved space for root
const bytesPerGB = 1024**3;
console.log('Difference in GB:', ((mainDisk.size - (mainDisk.used + mainDisk.available)) / bytesPerGB).toFixed(2));
