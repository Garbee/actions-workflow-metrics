import { setFailed } from "@actions/core";
import { currentLoad, mem, fsSize } from "systeminformation";
import { writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MetricsData } from "../lib.ts";
import { bytesPerMB, bytesPerGB, getRootMountPoint } from "../lib.ts";

export class Metrics {
  private readonly data: MetricsData;
  private readonly intervalMs: number;
  private readonly stateFile: string;
  private timeoutId: NodeJS.Timeout | null = null;
  private stopped: boolean = false;

  constructor() {
    this.data = { cpuLoadPercentages: [], memoryUsageMBs: [], diskUsageGBs: [], stepMarkers: [] };
    
    // Use GitHub state directory since it's less likely to be cleared
    // GITHUB_STATE points to a state file, so we use its directory
    const githubStateFile = process.env.GITHUB_STATE;
    const runId = process.env.GITHUB_RUN_ID || "local";
    const job = process.env.GITHUB_JOB || "default";
    
    if (githubStateFile) {
      // Use the directory containing the GitHub state file
      const stateDir = join(githubStateFile, '..');
      this.stateFile = join(stateDir, `metrics-state-${runId}-${job}.json`);
    } else {
      // Fallback for local testing
      const runnerTemp = process.env.RUNNER_TEMP || process.env.TMPDIR || '/tmp';
      this.stateFile = join(runnerTemp, `metrics-state-${runId}-${job}.json`);
    }

    // Fixed 1 second collection interval
    this.intervalMs = 1 * 1000;
    const intervalSecondsInput: string | undefined =
      process.env.METRICS_INTERVAL_SECONDS;

    if (intervalSecondsInput) {
      const intervalSecondsVal: number = parseInt(intervalSecondsInput, 10);
      if (Number.isInteger(intervalSecondsVal)) {
        this.intervalMs = intervalSecondsVal * 1000;
      }
    }

    // Start async processing
    this.initialize().catch(setFailed);
  }

  private async initialize(): Promise<void> {
    // Start collection
    this.append(Date.now()).catch(setFailed);
  }

  stop(): void {
    this.stopped = true;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    // Save final state to file for post action
    this.saveState();
  }

  get(): string {
    return JSON.stringify(this.data);
  }

  private saveState(): void {
    try {
      // Use synchronous write to ensure data is flushed before process exits
      writeFileSync(this.stateFile, JSON.stringify(this.data), "utf-8");
    } catch (error) {
      console.warn("Failed to save metrics state:", error);
    }
  }

  private async append(unixTimeMs: number): Promise<void> {
    try {
      const {
        currentLoadUser,
        currentLoadSystem,
      }: { currentLoadUser: number; currentLoadSystem: number } =
        await currentLoad();
      this.data.cpuLoadPercentages.push({
        unixTimeMs,
        user: currentLoadUser,
        system: currentLoadSystem,
      });

      const { active, available }: { active: number; available: number } =
        await mem();
      this.data.memoryUsageMBs.push({
        unixTimeMs,
        used: active / bytesPerMB,
        free: available / bytesPerMB,
      });

      const disks = await fsSize();
      // Track only the root filesystem where workflows run
      const rootMountPoint = getRootMountPoint();
      const rootDisk = disks.find(disk => disk.mount === rootMountPoint);
      if (rootDisk) {
        this.data.diskUsageGBs.push({
          unixTimeMs,
          used: rootDisk.used / bytesPerGB,
          available: rootDisk.available / bytesPerGB,
          size: rootDisk.size / bytesPerGB,
        });
      } else {
        console.warn(`Root filesystem (${rootMountPoint}) not found in disk list. Disk metrics will be incomplete.`);
      }

      // Write to disk after every collection
      this.saveState();
    } catch (error) {
      setFailed(error);
    } finally {
      if (!this.stopped) {
        const nextUNIXTimeMs: number = unixTimeMs + this.intervalMs;
        this.timeoutId = setTimeout(
          () => this.append(nextUNIXTimeMs).catch(setFailed),
          Math.max(0, nextUNIXTimeMs - Date.now()),
        );
      }
    }
  }
}
