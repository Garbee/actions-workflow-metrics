import fs from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { DefaultArtifactClient } from "@actions/artifact";
import { info, setFailed, summary } from "@actions/core";
import { context } from "@actions/github";
import { getMetricsData, render, collectFinalMetrics, detectAlerts } from "./lib.ts";
import type { MetricsData } from "../lib.ts";

async function index(): Promise<void> {
  const maxRetryCount: number = 10;
  let metricsData: MetricsData;

  // Collect one final set of metrics and get the complete data
  metricsData = await collectFinalMetrics();

  try {
    // Detect alerts based on threshold violations
    const alerts = detectAlerts(metricsData);

    const fileBaseName: string = "workflow_metrics";
    const fileName: string = `${fileBaseName}.json`;
    await fs.writeFile(fileName, JSON.stringify(metricsData));

    // Build artifact name: workflow_metrics_{jobName}_{runId}_{runAttempt}_{runnerOS}_{runnerArch}
    // Prefer GitHub-provided env vars when present, but fall back to Node's platform/arch for reliability.
    const runnerOS = process.env.RUNNER_OS ?? process.platform;
    const runnerArch = process.env.RUNNER_ARCH ?? process.arch;
    const baseArtifactName = `workflow_metrics_${context.job}_${context.runId}_${context.runAttempt}_${runnerOS}_${runnerArch}`;

    for (let i = 0; i < maxRetryCount; i++) {
      // Add retry suffix if needed (retry1, retry2, etc.)
      const artifactName = i === 0 ? baseArtifactName : `${baseArtifactName}_retry${i}`;

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
