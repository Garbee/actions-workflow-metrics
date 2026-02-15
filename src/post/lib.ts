import { z } from "zod";
import { getInput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { currentLoad, mem, fsSize } from "systeminformation";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Renderer } from "./renderer.ts";
import { metricsDataSchema, stepMarkerSchema, bytesPerMB, bytesPerGB, getRootMountPoint, type Alert } from "../lib.ts";

export async function getMetricsData(): Promise<
  z.TypeOf<typeof metricsDataSchema>
> {
  try {
    // Read from state file in GitHub state directory
    const githubStateFile = process.env.GITHUB_STATE;
    const runId = process.env.GITHUB_RUN_ID || "local";
    const job = process.env.GITHUB_JOB || "default";
    
    let stateFile: string;
    if (githubStateFile) {
      // Use the directory containing the GitHub state file
      const stateDir = join(githubStateFile, '..');
      stateFile = join(stateDir, `metrics-state-${runId}-${job}.json`);
    } else {
      // Fallback for local testing
      const runnerTemp = process.env.RUNNER_TEMP || process.env.TMPDIR || '/tmp';
      stateFile = join(runnerTemp, `metrics-state-${runId}-${job}.json`);
    }
    
    const content = await readFile(stateFile, "utf-8");
    return metricsDataSchema.parse(JSON.parse(content));
  } catch (error) {
    throw new Error(
      `Failed to read metrics from state file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function collectFinalMetrics(): Promise<z.TypeOf<typeof metricsDataSchema>> {
  try {
    // Read existing metrics from state
    const metricsData = await getMetricsData();
    
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

    const { active, available }: { active: number; available: number } =
      await mem();
    metricsData.memoryUsageMBs.push({
      unixTimeMs,
      used: active / bytesPerMB,
      free: available / bytesPerMB,
    });
    
    const disks = await fsSize();
    // Track only the root filesystem where workflows run
    const rootMountPoint = getRootMountPoint();
    const rootDisk = disks.find(disk => disk.mount === rootMountPoint);
    if (rootDisk) {
      metricsData.diskUsageGBs.push({
        unixTimeMs,
        used: rootDisk.used / bytesPerGB,
        available: rootDisk.available / bytesPerGB,
        size: rootDisk.size / bytesPerGB,
      });
    } else {
      console.warn(`Root filesystem (${rootMountPoint}) not found in final metrics collection. Disk metrics will be incomplete.`);
    }
    
    return metricsData;
  } catch (error) {
    // If we can't collect final metrics, log but don't fail
    // The action should still work with the metrics collected so far
    console.warn(`Failed to collect final metrics: ${error instanceof Error ? error.message : String(error)}`);
    // Return existing data without final metrics
    return getMetricsData();
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

/**
 * Detects threshold violations in metrics data and generates alerts.
 */
export function detectAlerts(
  metricsData: z.TypeOf<typeof metricsDataSchema>,
): Alert[] {
  const alerts: Alert[] = [];

  // Get thresholds from inputs (as percentages)
  const memoryThreshold = parseFloat(getInput("memory_alert_threshold") || "80");
  const cpuThreshold = parseFloat(getInput("cpu_alert_threshold") || "85");
  const cpuDuration = parseFloat(getInput("cpu_alert_duration") || "60") * 1000; // Convert to ms
  const diskThreshold = parseFloat(getInput("disk_alert_threshold") || "90");

  // Helper to find step name for a given timestamp
  const getStepForTime = (timeMs: number): string | undefined => {
    const stepRanges: { start: number; end: number; name: string }[] = [];
    const stepStarts = new Map<string, number>();
    const stepEnds = new Map<string, number>();

    for (const marker of metricsData.stepMarkers) {
      if (marker.status === "start") {
        stepStarts.set(marker.stepName, marker.unixTimeMs);
      } else if (marker.status === "end") {
        stepEnds.set(marker.stepName, marker.unixTimeMs);
      }
    }

    for (const [stepName, startTime] of stepStarts.entries()) {
      const endTime = stepEnds.get(stepName);
      if (endTime) {
        stepRanges.push({ start: startTime, end: endTime, name: stepName });
      }
    }

    for (const range of stepRanges) {
      if (timeMs >= range.start && timeMs < range.end) {
        return range.name;
      }
    }

    return undefined;
  };

  // Check memory utilization (used / (used + free) * 100)
  for (const memory of metricsData.memoryUsageMBs) {
    const total = memory.used + memory.free;
    const utilizationPercent = (memory.used / total) * 100;

    if (utilizationPercent > memoryThreshold) {
      const step = getStepForTime(memory.unixTimeMs);
      alerts.push({
        type: "memory",
        message: `Memory utilization exceeded ${memoryThreshold.toFixed(0)}%`,
        step,
        value: utilizationPercent,
        threshold: memoryThreshold,
      });
      // Only report the first occurrence
      break;
    }
  }

  // Check sustained CPU usage (user + system combined)
  // Find periods where CPU is sustained above threshold for the specified duration
  const sustainedCpuSteps = new Set<string>();
  let sustainedStartTime: number | null = null;
  const stepsInSustainedPeriod = new Set<string>();

  for (let i = 0; i < metricsData.cpuLoadPercentages.length; i++) {
    const cpu = metricsData.cpuLoadPercentages[i];
    const totalCpu = cpu.user + cpu.system;
    const currentStep = getStepForTime(cpu.unixTimeMs);

    if (totalCpu > cpuThreshold) {
      if (sustainedStartTime === null) {
        sustainedStartTime = cpu.unixTimeMs;
        stepsInSustainedPeriod.clear();
      }

      // Track all steps during sustained period
      if (currentStep) {
        stepsInSustainedPeriod.add(currentStep);
      }

      const duration = cpu.unixTimeMs - sustainedStartTime;
      if (duration >= cpuDuration) {
        // Sustained threshold met - add all steps seen during this period
        for (const step of stepsInSustainedPeriod) {
          sustainedCpuSteps.add(step);
        }
      }
    } else {
      // Reset if CPU drops below threshold
      sustainedStartTime = null;
      stepsInSustainedPeriod.clear();
    }
  }

  if (sustainedCpuSteps.size > 0) {
    const maxCpu = Math.max(
      ...metricsData.cpuLoadPercentages.map(cpu => cpu.user + cpu.system)
    );
    alerts.push({
      type: "cpu",
      message: `Sustained CPU usage above ${cpuThreshold.toFixed(0)}% for more than ${(cpuDuration / 1000).toFixed(0)} seconds`,
      steps: Array.from(sustainedCpuSteps),
      value: maxCpu,
      threshold: cpuThreshold,
    });
  }

  // Check disk usage (used / (used + available) * 100)
  for (const disk of metricsData.diskUsageGBs) {
    const total = disk.used + disk.available;
    const utilizationPercent = (disk.used / total) * 100;

    if (utilizationPercent > diskThreshold) {
      const step = getStepForTime(disk.unixTimeMs);
      alerts.push({
        type: "disk",
        message: `Disk usage exceeded ${diskThreshold.toFixed(0)}%`,
        step,
        value: utilizationPercent,
        threshold: diskThreshold,
      });
      // Only report the first occurrence
      break;
    }
  }

  return alerts;
}

export function render(
  metricsData: z.TypeOf<typeof metricsDataSchema>,
  alerts: Alert[] = [],
): string {
  // Get thresholds from inputs
  const cpuThreshold = parseFloat(getInput("cpu_alert_threshold") || "85");
  const memoryThreshold = parseFloat(getInput("memory_alert_threshold") || "80");
  const diskThreshold = parseFloat(getInput("disk_alert_threshold") || "90");

  const renderer: Renderer = new Renderer();
  return renderer.render(
    metricsData.stepMarkers,
    alerts,
    metricsData.cpuLoadPercentages,
    metricsData.memoryUsageMBs,
    metricsData.diskUsageGBs,
    { cpu: cpuThreshold, memory: memoryThreshold, disk: diskThreshold },
  );
}
