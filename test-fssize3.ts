import { fsSize } from 'systeminformation';

const disks = await fsSize();
const mainDisk = disks.find(d => d.mount === '/');

if (mainDisk) {
  console.log('Main disk raw values:');
  console.log('  size:', mainDisk.size);
  console.log('  used:', mainDisk.used);
  console.log('  available:', mainDisk.available);
  
  console.log('\nConverting size value:');
  console.log('  Treating as bytes, divide by 1024^3:', (mainDisk.size / (1024**3)).toFixed(2), 'GB');
  console.log('  Treating as KB, divide by 1024^2:', (mainDisk.size / (1024**2)).toFixed(2), 'GB');
  console.log('  Treating as MB, divide by 1024:', (mainDisk.size / 1024).toFixed(2), 'GB');
  console.log('  Treating as already GB:', (mainDisk.size).toFixed(2), 'GB');
  
  console.log('\nIf the correct total is ~14GB:');
  console.log('  Then the raw value would be:', 14 * (1024**3), 'bytes');
  console.log('  Actual raw value is:', mainDisk.size);
  console.log('  Ratio:', mainDisk.size / (14 * (1024**3)));
}
