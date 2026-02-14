import fs from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { DefaultArtifactClient } from "@actions/artifact";
import { info, setFailed, summary } from "@actions/core";
import { getMetricsData, render, fetchWorkflowSteps } from "./lib.ts";
import type { z } from "zod";
import type { metricsDataSchema } from "../lib.ts";

async function index(): Promise<void> {
  const maxRetryCount: number = 10;
  let metricsData: z.TypeOf<typeof metricsDataSchema>;

  for (let i = 0; i < maxRetryCount; i++) {
    try {
      metricsData = await getMetricsData();
      break;
    } catch (error) {
      if (
        maxRetryCount - 2 < i ||
        !(error instanceof Error) ||
        !error.message.includes("Failed to read metrics file")
      ) {
        setFailed(error);
      }
    }

    await setTimeout(1000);
  }

  try {
    // Fetch workflow steps from GitHub API (required)
    const apiSteps = await fetchWorkflowSteps();
    metricsData.stepMarkers = apiSteps;

    const fileBaseName: string = "workflow_metrics";
    const fileName: string = `${fileBaseName}.json`;
    await fs.writeFile(fileName, JSON.stringify(metricsData));
    let metricsID: string = "";

    for (let i = 0; i < maxRetryCount; i++) {
      metricsID = new Date().getTime().toString();

      try {
        const client: DefaultArtifactClient = new DefaultArtifactClient();
        await client.uploadArtifact(
          [fileBaseName, metricsID].join("_"),
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

    // Render metrics
    await summary.addRaw(render(metricsData, metricsID)).write();
    
    info("Metrics collection completed successfully");
  } catch (error) {
    setFailed(error);
  }
}

await index();
