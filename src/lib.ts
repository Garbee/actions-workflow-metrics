import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const bytesPerMB: number = 1024 * 1024;

// Disk metrics scaling configuration
// GitHub documents runners with 14GB storage, but actual VM disks are ~145GB.
// This creates a ~10.36x ratio. We use 10x as a round approximation because:
// 1. VM sizes can vary slightly between runner instances
// 2. The 3.6% precision loss is acceptable for monitoring purposes
// 3. Round numbers are easier to reason about in charts
// This scaling ensures charts show the documented 14GB storage users expect,
// rather than the underlying VM infrastructure size.
const DISK_SCALING_FACTOR = 10;
export const bytesPerGB: number = 1024 * 1024 * 1024 * DISK_SCALING_FACTOR;

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
  free: z.number().nonnegative(),
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

/**
 * Gets the path to the metrics file in the temporary directory.
 * Uses GITHUB_RUN_ID and GITHUB_JOB to ensure uniqueness across runs and jobs.
 */
export function getMetricsFilePath(): string {
  const runId = process.env.GITHUB_RUN_ID || "local";
  const job = process.env.GITHUB_JOB || "default";
  return join(tmpdir(), `metrics-${runId}-${job}.json`);
}
