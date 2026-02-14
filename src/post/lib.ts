import { readFile } from "node:fs/promises";
import { z } from "zod";
import { getInput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
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

export async function fetchWorkflowSteps(): Promise<
  z.TypeOf<typeof stepMarkerSchema>[]
> {
  const token = getInput("github-token");
  if (!token) {
    return [];
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
    // Silently fail if GitHub API is unavailable
    return [];
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
