import { execSync } from "node:child_process";

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

function getLinuxMemory(): MemoryInfo {
  // Read /proc/meminfo
  const meminfo = execSync("cat /proc/meminfo", { encoding: "utf-8" });
  const lines = meminfo.split("\n");

  let memTotal = 0;
  let memAvailable = 0;

  for (const line of lines) {
    if (line.startsWith("MemTotal:")) {
      memTotal = parseInt(line.split(/\s+/)[1], 10) * 1024; // Convert KB to bytes
    } else if (line.startsWith("MemAvailable:")) {
      memAvailable = parseInt(line.split(/\s+/)[1], 10) * 1024; // Convert KB to bytes
    }
  }

  const active = memTotal - memAvailable;

  return { active, available: memAvailable };
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

function getMacOsMemory(): MemoryInfo {
  // Use vm_stat to get memory information on macOS
  const output = execSync("vm_stat", { encoding: "utf-8" });
  const lines = output.split("\n");

  const pageSize = 4096; // macOS typically uses 4KB pages
  let pagesActive = 0;
  let pagesFree = 0;
  let pagesInactive = 0;
  let pagesWiredDown = 0;

  for (const line of lines) {
    if (line.includes("Pages active:")) {
      pagesActive = parseInt(line.split(":")[1].trim().replace(".", ""), 10);
    } else if (line.includes("Pages free:")) {
      pagesFree = parseInt(line.split(":")[1].trim().replace(".", ""), 10);
    } else if (line.includes("Pages inactive:")) {
      pagesInactive = parseInt(line.split(":")[1].trim().replace(".", ""), 10);
    } else if (line.includes("Pages wired down:")) {
      pagesWiredDown = parseInt(line.split(":")[1].trim().replace(".", ""), 10);
    }
  }

  const active = (pagesActive + pagesWiredDown) * pageSize;
  const available = (pagesFree + pagesInactive) * pageSize;

  return { active, available };
}

function getMacOsDiskInfo(): DiskInfo[] {
  // Use df to get disk information
  const output = execSync("df -k", { encoding: "utf-8" });
  const lines = output.split("\n").slice(1); // Skip header

  const disks: DiskInfo[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 9) continue;

    const fs = parts[0];
    const size = parseInt(parts[1], 10) * 1024; // Convert KB to bytes
    const used = parseInt(parts[2], 10) * 1024; // Convert KB to bytes
    const available = parseInt(parts[3], 10) * 1024; // Convert KB to bytes
    const mount = parts[8];

    disks.push({ fs, mount, size, used, available });
  }

  return disks;
}

// Windows implementations

function getWindowsCpuLoad(): CpuLoad {
  // Use wmic to get CPU usage on Windows
  try {
    const output = execSync("wmic cpu get loadpercentage", { encoding: "utf-8" });
    const lines = output.split("\n").filter(line => line.trim() && !line.includes("LoadPercentage"));

    if (lines.length > 0) {
      const load = parseInt(lines[0].trim(), 10);
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

function getWindowsMemory(): MemoryInfo {
  // Use wmic to get memory information on Windows
  try {
    const totalOutput = execSync("wmic computersystem get totalphysicalmemory", { encoding: "utf-8" });
    const freeOutput = execSync("wmic os get freephysicalmemory", { encoding: "utf-8" });

    const totalLines = totalOutput.split("\n").filter(line => line.trim() && !line.includes("TotalPhysicalMemory"));
    const freeLines = freeOutput.split("\n").filter(line => line.trim() && !line.includes("FreePhysicalMemory"));

    if (totalLines.length > 0 && freeLines.length > 0) {
      const total = parseInt(totalLines[0].trim(), 10);
      const freeKB = parseInt(freeLines[0].trim(), 10);
      const free = freeKB * 1024; // Convert KB to bytes

      const active = total - free;

      return { active, available: free };
    }
  } catch (error) {
    console.warn("Failed to get memory info on Windows:", error);
  }

  return { active: 0, available: 0 };
}

function getWindowsDiskInfo(): DiskInfo[] {
  // Use wmic to get disk information on Windows
  try {
    const output = execSync("wmic logicaldisk get caption,size,freespace", { encoding: "utf-8" });
    const lines = output.split("\n").slice(1); // Skip header

    const disks: DiskInfo[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;

      const mount = parts[0];
      const freeSpace = parseInt(parts[1], 10);
      const size = parseInt(parts[2], 10);
      const used = size - freeSpace;

      disks.push({
        fs: mount,
        mount,
        size,
        used,
        available: freeSpace,
      });
    }

    return disks;
  } catch (error) {
    console.warn("Failed to get disk info on Windows:", error);
  }

  return [];
}
