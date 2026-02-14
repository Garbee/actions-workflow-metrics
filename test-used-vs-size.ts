import { fsSize } from 'systeminformation';

const disks = await fsSize();
const mainDisk = disks[0];

console.log('Main disk raw values:');
console.log('  size:', mainDisk.size);
console.log('  used:', mainDisk.used);
console.log('  available:', mainDisk.available);

console.log('\ndf -kP shows:');
