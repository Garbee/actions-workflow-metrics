import { fsSize } from 'systeminformation';

const disks = await fsSize();
const mainDisk = disks[0];

// Actual value from df -kP
const dfSizeKB = 151263856;

console.log('df -kP reports size:', dfSizeKB, 'KB');
console.log('fsSize reports size:', mainDisk.size);

console.log('\nIf fsSize is in BYTES (as documented):');
console.log('  fsSize / 1024 =', Math.round(mainDisk.size / 1024), 'KB');
console.log('  Matches df KB?', Math.abs((mainDisk.size / 1024) - dfSizeKB) < 1000);

console.log('\nIf fsSize is in KB (documentation wrong):');
console.log('  fsSize =', mainDisk.size, 'KB');
console.log('  Matches df KB?', Math.abs(mainDisk.size - dfSizeKB) < 1000);

console.log('\nConclusion:');
if (Math.abs((mainDisk.size / 1024) - dfSizeKB) < 1000) {
  console.log('fsSize returns BYTES (divide by 1024^3 for GB)');
} else if (Math.abs(mainDisk.size - dfSizeKB) < 1000) {
  console.log('fsSize returns KB (divide by 1024^2 for GB) - DOCUMENTATION IS WRONG!');
}
