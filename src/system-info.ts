import { execSync } from "node:child_process";
import { freemem, totalmem } from "node:os";

/**
 * Native system information collector that replaces systeminformation package.
 * Detects OS and runs native commands to gather CPU, memory, and disk metrics.
 */

export interface CpuLoad {
  currentLoadUser: number;
  currentLoadSystem: number;
}

export interface MemoryInfo {
  active: number;
  available: number;
}

export interface DiskInfo {
  fs: string;
  mount: string;
  size: number;
  used: number;
  available: number;
}

/**
 * Get current CPU load percentages.
 * Returns user and system CPU usage as percentages (0-100).
 */
export async function currentLoad(): Promise<CpuLoad> {
  const platform = process.platform;

  if (platform === "linux") {
    return getLinuxCpuLoad();
  } else if (platform === "darwin") {
    return getMacOsCpuLoad();
  } else if (platform === "win32") {
    return getWindowsCpuLoad();
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Get memory information.
 * Returns active (used) and available memory in bytes.
 * Uses platform-specific commands for accurate memory reporting.
 * - Linux: Uses /proc/meminfo for MemAvailable and Active memory
 * - macOS: Uses Node.js os module (freemem/totalmem for simplicity and reliability)
 * - Windows: Uses Node.js os module (no WMI call needed for better performance)
 */
export async function mem(): Promise<MemoryInfo> {
  const platform = process.platform;

  if (platform === "linux") {
    return getLinuxMemory();
  } else if (platform === "darwin") {
    return getMacOsMemory();
  } else if (platform === "win32") {
    return getWindowsMemory();
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Get filesystem size information.
 * Returns an array of disk mount points with their usage statistics.
 */
export async function fsSize(): Promise<DiskInfo[]> {
  const platform = process.platform;

  if (platform === "linux") {
    return getLinuxDiskInfo();
  } else if (platform === "darwin") {
    return getMacOsDiskInfo();
  } else if (platform === "win32") {
    return getWindowsDiskInfo();
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

// Platform-specific memory implementations

function getLinuxMemory(): MemoryInfo {
  // Read /proc/meminfo for accurate memory statistics
  const meminfo = execSync("cat /proc/meminfo", { encoding: "utf-8" });

  let memTotal = 0;
  let memAvailable = 0;
  let memActive = 0;

  for (const line of meminfo.split("\n")) {
    if (line.startsWith("MemTotal:")) {
      memTotal = parseInt(line.split(/\s+/)[1], 10) * 1024; // Convert KB to bytes
    } else if (line.startsWith("MemAvailable:")) {
      memAvailable = parseInt(line.split(/\s+/)[1], 10) * 1024; // Convert KB to bytes
    } else if (line.startsWith("Active:")) {
      memActive = parseInt(line.split(/\s+/)[1], 10) * 1024; // Convert KB to bytes
    }
  }

  return { active: memActive, available: memAvailable };
}

function getMacOsMemory(): MemoryInfo {
  // Use Node.js os module for macOS (fast and reliable)
  const available = freemem();
  const total = totalmem();
  const active = total - available;

  return { active, available };
}

function getWindowsMemory(): MemoryInfo {
  // Use Node.js os module for Windows (fast and reliable)
  const available = freemem();
  const total = totalmem();
  const active = total - available;

  return { active, available };
}

// Linux implementations

function getLinuxCpuLoad(): CpuLoad {
  // Read /proc/stat for CPU times
  const stat = execSync("cat /proc/stat | head -1", { encoding: "utf-8" });
  const values = stat.split(/\s+/).slice(1).map(Number);

  // CPU times: user, nice, system, idle, iowait, irq, softirq, steal
  const user = values[0] + values[1]; // user + nice
  const system = values[2]; // system
  const idle = values[3]; // idle
  const iowait = values[4] || 0;

  const total = user + system + idle + iowait;

  // Convert to percentages
  const currentLoadUser = total > 0 ? (user / total) * 100 : 0;
  const currentLoadSystem = total > 0 ? (system / total) * 100 : 0;

  return { currentLoadUser, currentLoadSystem };
}

function getLinuxDiskInfo(): DiskInfo[] {
  // Use df to get disk information
  const output = execSync("df -k", { encoding: "utf-8" });
  const lines = output.split("\n").slice(1); // Skip header

  const disks: DiskInfo[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;

    const fs = parts[0];
    const size = parseInt(parts[1], 10) * 1024; // Convert KB to bytes
    const used = parseInt(parts[2], 10) * 1024; // Convert KB to bytes
    const available = parseInt(parts[3], 10) * 1024; // Convert KB to bytes
    const mount = parts[5];

    disks.push({ fs, mount, size, used, available });
  }

  return disks;
}

// macOS implementations

function getMacOsCpuLoad(): CpuLoad {
  // Use top to get CPU usage on macOS
  const output = execSync("top -l 1 -n 0 | grep 'CPU usage'", { encoding: "utf-8" });
  // Example: "CPU usage: 5.10% user, 10.20% sys, 84.69% idle"

  const userMatch = output.match(/(\d+\.\d+)%\s+user/);
  const sysMatch = output.match(/(\d+\.\d+)%\s+sys/);

  const currentLoadUser = userMatch ? parseFloat(userMatch[1]) : 0;
  const currentLoadSystem = sysMatch ? parseFloat(sysMatch[1]) : 0;

  return { currentLoadUser, currentLoadSystem };
}

function getMacOsDiskInfo(): DiskInfo[] {
  // Use df to get disk information
  const output = execSync("df -k", { encoding: "utf-8" });
  const lines = output.split("\n").slice(1); // Skip header

  const disks: DiskInfo[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split(/\s+/);
    // macOS df output format: Filesystem 1K-blocks Used Available Capacity iused ifree %iused Mounted
    // Total of 9 columns, but the last column (mount point) can contain spaces
    if (parts.length < 9) continue;

    const fs = parts[0];
    const size = parseInt(parts[1], 10) * 1024; // Convert KB to bytes
    const used = parseInt(parts[2], 10) * 1024; // Convert KB to bytes
    const available = parseInt(parts[3], 10) * 1024; // Convert KB to bytes
    // Mount point is the last element (column 9, index 8)
    const mount = parts[8];

    disks.push({ fs, mount, size, used, available });
  }

  return disks;
}

// Windows implementations

function getWindowsCpuLoad(): CpuLoad {
  // Use PowerShell Get-CimInstance to get CPU usage on Windows
  // wmic is deprecated and not available on Windows Server 2025
  try {
    const output = execSync(
      'powershell -Command "Get-CimInstance -ClassName Win32_Processor | Select-Object -ExpandProperty LoadPercentage"',
      { encoding: "utf-8" }
    );
    const load = parseInt(output.trim(), 10);
    if (!isNaN(load)) {
      // Windows doesn't provide user/system split easily, so we'll split it 70/30
      const currentLoadUser = load * 0.7;
      const currentLoadSystem = load * 0.3;
      return { currentLoadUser, currentLoadSystem };
    }
  } catch (error) {
    console.warn("Failed to get CPU load on Windows:", error);
  }

  return { currentLoadUser: 0, currentLoadSystem: 0 };
}

function getWindowsDiskInfo(): DiskInfo[] {
  // Use PowerShell Get-CimInstance to get disk information on Windows
  // wmic is deprecated and not available on Windows Server 2025
  try {
    const output = execSync(
      'powershell -Command "Get-CimInstance -ClassName Win32_LogicalDisk -Filter \\"DriveType=3\\" | ' +
      'Select-Object DeviceID, Size, FreeSpace | ' +
      'ForEach-Object { \\"{0}|{1}|{2}\\" -f $_.DeviceID, $_.Size, $_.FreeSpace }"',
      { encoding: "utf-8" }
    );

    const lines = output.split("\n");
    const disks: DiskInfo[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.trim().split("|");
      if (parts.length < 3) continue;

      const mount = parts[0];
      const size = parseInt(parts[1], 10);
      const freeSpace = parseInt(parts[2], 10);
      const used = size - freeSpace;

      if (!isNaN(size) && !isNaN(freeSpace)) {
        disks.push({
          fs: mount,
          mount,
          size,
          used,
          available: freeSpace,
        });
      }
    }

    return disks;
  } catch (error) {
    console.warn("Failed to get disk info on Windows:", error);
  }

  return [];
}
