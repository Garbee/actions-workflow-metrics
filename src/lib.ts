import { z } from "zod";

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
  step: z.string().optional(),
  steps: z.array(z.string()).optional(),
  value: z.number(),
  threshold: z.number(),
});

export type Alert = z.infer<typeof alertSchema>;
