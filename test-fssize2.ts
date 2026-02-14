import { fsSize } from 'systeminformation';

const disks = await fsSize();
console.log('All disks:');
disks.forEach((disk, i) => {
  console.log(`\n${i}. ${disk.fs} (${disk.type}) mounted at ${disk.mount}`);
  console.log(`   Size: ${(disk.size / (1024**3)).toFixed(2)} GB`);
  console.log(`   Used: ${(disk.used / (1024**3)).toFixed(2)} GB`);
  console.log(`   Available: ${(disk.available / (1024**3)).toFixed(2)} GB`);
  console.log(`   Total (used+available): ${((disk.used + disk.available) / (1024**3)).toFixed(2)} GB`);
});

const totalUsed = disks.reduce((sum, disk) => sum + disk.used, 0);
const totalAvailable = disks.reduce((sum, disk) => sum + disk.available, 0);

console.log('\n=== CURRENT TOTALS (summing all disks) ===');
console.log('Total Used:', (totalUsed / (1024**3)).toFixed(2), 'GB');
console.log('Total Available:', (totalAvailable / (1024**3)).toFixed(2), 'GB');
console.log('Total (used+available):', ((totalUsed + totalAvailable) / (1024**3)).toFixed(2), 'GB');

// Only sum the main disk (/)
const mainDisk = disks.find(d => d.mount === '/');
if (mainDisk) {
  console.log('\n=== MAIN DISK ONLY (/) ===');
  console.log('Used:', (mainDisk.used / (1024**3)).toFixed(2), 'GB');
  console.log('Available:', (mainDisk.available / (1024**3)).toFixed(2), 'GB');
  console.log('Total (used+available):', ((mainDisk.used + mainDisk.available) / (1024**3)).toFixed(2), 'GB');
}
