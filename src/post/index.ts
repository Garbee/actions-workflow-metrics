import fs from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { DefaultArtifactClient } from "@actions/artifact";
import { info, setFailed, summary } from "@actions/core";
import { context } from "@actions/github";
import { getMetricsData, render, fetchWorkflowSteps, collectFinalMetrics, detectAlerts } from "./lib.ts";
import type { z } from "zod";
import type { metricsDataSchema } from "../lib.ts";

async function index(): Promise<void> {
  const maxRetryCount: number = 10;
  let metricsData: z.TypeOf<typeof metricsDataSchema>;

  // Collect one final set of metrics and get the complete data
  metricsData = await collectFinalMetrics();

  try {
    // Fetch workflow steps from GitHub API (required)
    const apiSteps = await fetchWorkflowSteps();
    metricsData.stepMarkers = apiSteps;

    // Detect alerts based on threshold violations
    const alerts = detectAlerts(metricsData);

    const fileName: string = "workflow_metrics.json";
    await fs.writeFile(fileName, JSON.stringify(metricsData));

    // Generate meaningful artifact name using job name, run ID, and run attempt
    const jobName = process.env.GITHUB_JOB || "default";
    const runId = context.runId.toString();
    const runAttempt = process.env.GITHUB_RUN_ATTEMPT || "1";
    const baseArtifactName = `workflow_metrics_${jobName}_${runId}_${runAttempt}`;

    for (let i = 0; i < maxRetryCount; i++) {
      // Add retry suffix only if this is a retry attempt (upload failure, not workflow re-run)
      const artifactName = i === 0 
        ? baseArtifactName 
        : `${baseArtifactName}_retry${i}`;

      try {
        const client: DefaultArtifactClient = new DefaultArtifactClient();
        await client.uploadArtifact(
          artifactName,
          [fileName],
          ".",
        );
        break;
      } catch (error) {
        if (
          maxRetryCount - 2 < i ||
          !(error instanceof Error) ||
          !error.message.includes(
            "Failed request: (409) Conflict: an artifact with this name already exists on the workflow run",
          )
        ) {
          setFailed(error);
        }
      }

      await setTimeout(1000);
    }

    // Render metrics with alerts
    await summary.addRaw(render(metricsData, alerts)).write();

    info("Metrics collection completed successfully");
  } catch (error) {
    setFailed(error);
  }
}

await index();
