import { z } from "zod";
import { execSync } from "node:child_process";
import { totalmem } from "node:os";

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

export const cpuLoadPercentageSchema = z.object({
  unixTimeMs: z.number(),
  user: z.number().nonnegative().max(100),
  system: z.number().nonnegative().max(100),
});
export const cpuLoadPercentagesSchema = z.array(cpuLoadPercentageSchema);
export const memoryUsageMBSchema = z.object({
  unixTimeMs: z.number(),
  used: z.number().nonnegative(),
  free: z.number().nonnegative(),
});
export const memoryUsageMBsSchema = z.array(memoryUsageMBSchema);
export const diskUsageGBSchema = z.object({
  unixTimeMs: z.number(),
  used: z.number().nonnegative(),
  available: z.number().nonnegative(),
  size: z.number().nonnegative(),
});
export const diskUsageGBsSchema = z.array(diskUsageGBSchema);
export const stepMarkerSchema = z.object({
  unixTimeMs: z.number(),
  stepName: z.string(),
  status: z.enum(["start", "end"]),
});
export const stepMarkersSchema = z.array(stepMarkerSchema);
export const metricsDataSchema = z.object({
  cpuLoadPercentages: cpuLoadPercentagesSchema,
  memoryUsageMBs: memoryUsageMBsSchema,
  diskUsageGBs: diskUsageGBsSchema,
  stepMarkers: stepMarkersSchema,
});

export const alertSchema = z.object({
  type: z.enum(["memory", "cpu", "disk"]),
  message: z.string(),
  timespan: z.number().optional(), // Single timestamp when alert occurred
  timespans: z.array(z.number()).optional(), // Multiple timestamps for sustained alerts
  value: z.number(),
  threshold: z.number(),
});

export type Alert = z.infer<typeof alertSchema>;

export interface MemoryInfo {
  active: number;
  available: number;
}

/**
 * Parse macOS vm_stat output to calculate accurate memory values.
 *
 * On macOS, memory is categorized as free, active, inactive, speculative,
 * wired, purgeable, and compressed. Available memory includes pages that
 * can be reclaimed without swapping: free + inactive + purgeable + speculative.
 */
export function parseMacOsVmStat(vmStatOutput: string, totalMemory: number): MemoryInfo {
  const lines = vmStatOutput.split('\n');

  const pageSizeMatch = lines[0]?.match(/page size of (\d+) bytes/);
  const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384;

  const getPageCount = (key: string): number => {
    const line = lines.find(l => l.trimStart().startsWith(key));
    if (!line) return 0;
    const match = line.match(/:\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const pagesFree = getPageCount('Pages free');
  const pagesInactive = getPageCount('Pages inactive');
  const pagesPurgeable = getPageCount('Pages purgeable');
  const pagesSpeculative = getPageCount('Pages speculative');

  const available = Math.min(
    (pagesFree + pagesInactive + pagesPurgeable + pagesSpeculative) * pageSize,
    totalMemory,
  );

  return { active: totalMemory - available, available };
}

/**
 * Get macOS memory info by parsing vm_stat output.
 * Falls back to os.totalmem()/2 split if vm_stat fails.
 */
export function getMacOsMemory(): MemoryInfo {
  const total = totalmem();
  try {
    const vmStatOutput = execSync('vm_stat', { encoding: 'utf-8', timeout: 5000 });
    return parseMacOsVmStat(vmStatOutput, total);
  } catch {
    return { active: total, available: 0 };
  }
}
