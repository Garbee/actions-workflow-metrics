import { fsSize } from 'systeminformation';

const disks = await fsSize();
const mainDisk = disks[0];

// Get actual values from df
console.log('From df -k:');
