import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { getInput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { currentLoad, mem } from "systeminformation";
import { Renderer } from "./renderer.ts";
import { metricsDataSchema, getMetricsFilePath, stepMarkerSchema } from "../lib.ts";

export const metricsInfoSchema = z.object({
  color: z.string(),
  name: z.string(),
  data: z.array(z.number()),
});
export const metricsInfoListSchema = z.array(metricsInfoSchema);
export const renderParamsSchema = z.object({
  title: z.string(),
  metricsInfoList: metricsInfoListSchema,
  times: z.array(z.coerce.date()),
  yAxis: z.object({
    title: z.string(),
    range: z.string().optional(),
  }),
});
export const renderParamsListSchema = z.array(renderParamsSchema);

export async function getMetricsData(): Promise<
  z.TypeOf<typeof metricsDataSchema>
> {
  const filePath = getMetricsFilePath();
  
  try {
    const content = await readFile(filePath, "utf-8");
    return metricsDataSchema.parse(JSON.parse(content));
  } catch (error) {
    throw new Error(
      `Failed to read metrics file at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function collectFinalMetrics(): Promise<void> {
  const filePath = getMetricsFilePath();
  
  try {
    // Read existing metrics
    const content = await readFile(filePath, "utf-8");
    const metricsData = metricsDataSchema.parse(JSON.parse(content));
    
    // Collect one final set of metrics
    const unixTimeMs = Date.now();
    
    const {
      currentLoadUser,
      currentLoadSystem,
    }: { currentLoadUser: number; currentLoadSystem: number } =
      await currentLoad();
    metricsData.cpuLoadPercentages.push({
      unixTimeMs,
      user: currentLoadUser,
      system: currentLoadSystem,
    });

    const bytesPerMB: number = 1024 * 1024;
    const { active, available }: { active: number; available: number } =
      await mem();
    metricsData.memoryUsageMBs.push({
      unixTimeMs,
      used: active / bytesPerMB,
      free: available / bytesPerMB,
    });
    
    // Write updated metrics back to file
    await writeFile(filePath, JSON.stringify(metricsData, null, 2), "utf-8");
  } catch (error) {
    // If we can't collect final metrics, log but don't fail
    // The action should still work with the metrics collected so far
    console.warn(`Failed to collect final metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function fetchWorkflowSteps(): Promise<
  z.TypeOf<typeof stepMarkerSchema>[]
> {
  const token = getInput("github-token");
  if (!token) {
    throw new Error("GitHub token is required for workflow step tracking");
  }

  try {
    const octokit = getOctokit(token);
    const { owner, repo } = context.repo;
    const runId = context.runId;

    const { data: jobs } = await octokit.rest.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });

    const stepMarkers: z.TypeOf<typeof stepMarkerSchema>[] = [];

    for (const job of jobs.jobs) {
      for (const step of job.steps || []) {
        if (step.started_at) {
          stepMarkers.push({
            unixTimeMs: new Date(step.started_at).getTime(),
            stepName: step.name,
            status: "start" as const,
          });
        }
        if (step.completed_at) {
          stepMarkers.push({
            unixTimeMs: new Date(step.completed_at).getTime(),
            stepName: step.name,
            status: "end" as const,
          });
        }
      }
    }

    return stepMarkers.sort((a, b) => a.unixTimeMs - b.unixTimeMs);
  } catch (error) {
    throw new Error(
      `Failed to fetch workflow steps: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function render(
  metricsData: z.TypeOf<typeof metricsDataSchema>,
  metricsID: string,
): string {
  const renderer: Renderer = new Renderer();
  return renderer.render(
    renderParamsListSchema.parse([
      {
        title: "CPU Loads",
        metricsInfoList: [
          {
            color: "Orange",
            name: "System",
            data: metricsData.cpuLoadPercentages.map(
              ({ system }: { system: number }): number => system,
            ),
          },
          {
            color: "Red",
            name: "User",
            data: metricsData.cpuLoadPercentages.map(
              ({ user }: { user: number }): number => user,
            ),
          },
        ],
        times: metricsData.cpuLoadPercentages.map(
          ({ unixTimeMs }: { unixTimeMs: number }): number => unixTimeMs,
        ),
        yAxis: {
          title: "%",
          range: "0 --> 100",
        },
      },
      {
        title: "Memory Usages",
        metricsInfoList: [
          {
            color: "Green",
            name: "Free",
            data: metricsData.memoryUsageMBs.map(
              ({ free }: { free: number }): number => free,
            ),
          },
          {
            color: "Blue",
            name: "Used",
            data: metricsData.memoryUsageMBs.map(
              ({ used }: { used: number }): number => used,
            ),
          },
        ],
        times: metricsData.memoryUsageMBs.map(
          ({ unixTimeMs }: { unixTimeMs: number }): number => unixTimeMs,
        ),
        yAxis: {
          title: "MB",
        },
      },
    ]),
    metricsID,
    metricsData.stepMarkers,
  );
}
