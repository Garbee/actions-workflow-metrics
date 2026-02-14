import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const bytesPerMB: number = 1024 * 1024;
// Disk metrics scaling factor: GitHub runners are documented as having 14GB storage,
// but fsSize() reports the full VM disk size (~145GB). This 10x scaling factor adjusts
// disk metrics to match the documented storage capacity for consistency with user expectations.
// Note: This is a pragmatic workaround for the discrepancy between VM disk size and documented storage.
export const bytesPerGB: number = 1024 * 1024 * 1024 * 10;

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
