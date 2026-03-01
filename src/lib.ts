export const bytesPerMB: number = 1024 * 1024;
export const bytesPerGB: number = 1024 * 1024 * 1024;

/**
 * Get the root mount point for the current OS.
 * @returns The mount point to track for disk metrics
 */
export function getRootMountPoint(): string {
  const platform = process.platform;

  if (platform === 'win32') {
    return 'C:';
  } else if (platform === 'darwin') {
    return '/System/Volumes/Data';
  } else {
    // Linux and other Unix-like systems
    return '/';
  }
}

export interface CpuLoadPercentage {
  unixTimeMs: number;
  user: number;
  system: number;
}

export interface MemoryUsageMB {
  unixTimeMs: number;
  used: number;
  free: number;
}

export interface DiskUsageGB {
  unixTimeMs: number;
  used: number;
  available: number;
  size: number;
}

export interface StepMarker {
  unixTimeMs: number;
  stepName: string;
  status: "start" | "end";
}

export interface MetricsData {
  cpuLoadPercentages: CpuLoadPercentage[];
  memoryUsageMBs: MemoryUsageMB[];
  diskUsageGBs: DiskUsageGB[];
  stepMarkers: StepMarker[];
}

export interface Alert {
  type: "memory" | "cpu" | "disk";
  message: string;
  timespan?: number; // Single timestamp when alert occurred
  timespans?: number[]; // Multiple timestamps for sustained alerts
  value: number;
  threshold: number;
}
