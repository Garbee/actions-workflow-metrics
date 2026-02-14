import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

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
export const stepMarkerSchema = z.object({
  unixTimeMs: z.number(),
  stepName: z.string(),
  status: z.enum(["start", "end"]),
});
export const stepMarkersSchema = z.array(stepMarkerSchema);
export const metricsDataSchema = z.object({
  cpuLoadPercentages: cpuLoadPercentagesSchema,
  memoryUsageMBs: memoryUsageMBsSchema,
  stepMarkers: stepMarkersSchema,
});

/**
 * Gets the path to the metrics file in the temporary directory.
 * Uses GITHUB_RUN_ID and GITHUB_JOB to ensure uniqueness across runs and jobs.
 */
export function getMetricsFilePath(): string {
  const runId = process.env.GITHUB_RUN_ID || "local";
  const job = process.env.GITHUB_JOB || "default";
  return join(tmpdir(), `metrics-${runId}-${job}.json`);
}
