import { fsSize } from 'systeminformation';

const disks = await fsSize();
const mainDisk = disks[0];

// From df: 151263856 KB size, 56206696 KB used, 95040776 KB available
const dfSizeKB = 151263856;
const dfUsedKB = 56206696;
const dfAvailKB = 95040776;

console.log('Checking if fsSize fields are in bytes:');
console.log('size: fsSize/1024 =', Math.round(mainDisk.size/1024), 'vs df =', dfSizeKB, '- Match?', Math.abs((mainDisk.size/1024) - dfSizeKB) < 1000);
console.log('used: fsSize/1024 =', Math.round(mainDisk.used/1024), 'vs df =', dfUsedKB, '- Match?', Math.abs((mainDisk.used/1024) - dfUsedKB) < 1000);
console.log('avail: fsSize/1024 =', Math.round(mainDisk.available/1024), 'vs df =', dfAvailKB, '- Match?', Math.abs((mainDisk.available/1024) - dfAvailKB) < 1000);

console.log('\nAll fields are in BYTES ✓');
