import { fsSize } from 'systeminformation';

const disks = await fsSize();
const mainDisk = disks[0];

// From df -kP, we know:
// 1024-blocks Used: 56204060 KB
const dfUsedKB = 56204060;

console.log('df reports used:', dfUsedKB, 'KB');
console.log('fsSize reports used:', mainDisk.used);

console.log('\nIf fsSize is in bytes:');
console.log('  fsSize / 1024 =', mainDisk.used / 1024, 'KB');
console.log('  Matches df?', Math.abs((mainDisk.used / 1024) - dfUsedKB) < 1000);

console.log('\nIf fsSize is in KB:');
console.log('  fsSize =', mainDisk.used, 'KB');
console.log('  Matches df?', Math.abs(mainDisk.used - dfUsedKB) < 1000);

// Calculate the actual ratio
console.log('\nActual ratio: fsSize / (df * 1024) =', mainDisk.used / (dfUsedKB * 1024));
