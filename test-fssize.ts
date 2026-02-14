import { fsSize } from 'systeminformation';

const disks = await fsSize();
console.log('Disk data from systeminformation:');
console.log(JSON.stringify(disks, null, 2));

const totalUsed = disks.reduce((sum, disk) => sum + disk.used, 0);
const totalAvailable = disks.reduce((sum, disk) => sum + disk.available, 0);

console.log('\nTotals:');
console.log('Total Used:', totalUsed);
console.log('Total Available:', totalAvailable);

// Convert as current code does
const bytesPerGB = 1024 * 1024 * 1024;
console.log('\nConverted to GB (current code):');
console.log('Used GB:', totalUsed / bytesPerGB);
console.log('Available GB:', totalAvailable / bytesPerGB);

// Check if values are already in bytes or in KB
console.log('\nIf values are in KB (divide by 1024*1024):');
console.log('Used GB:', totalUsed / (1024 * 1024));
console.log('Available GB:', totalAvailable / (1024 * 1024));
