import { setFailed } from "@actions/core";
import { currentLoad, mem, fsSize } from "systeminformation";
import { writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import { metricsDataSchema, bytesPerMB, bytesPerGB } from "../lib.ts";

export class Metrics {
  private readonly data: z.TypeOf<typeof metricsDataSchema>;
  private readonly intervalMs: number;
  private readonly stateFile: string;
  private readonly writeInterval: number; // How many collections before writing to disk
  private timeoutId: NodeJS.Timeout | null = null;
  private stopped: boolean = false;
  private collectionsSinceWrite: number = 0;

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

    this.intervalMs = 5 * 1000;
    const intervalSecondsInput: string | undefined =
      process.env.METRICS_INTERVAL_SECONDS;

    if (intervalSecondsInput) {
      const intervalSecondsVal: number = parseInt(intervalSecondsInput, 10);
      if (Number.isInteger(intervalSecondsVal)) {
        this.intervalMs = intervalSecondsVal * 1000;
      }
    }

    // Write to disk every 5 collections minimum (reduces I/O by 5x)
    // This prevents I/O thrashing when interval is set to 1 second
    this.writeInterval = 5;

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
      const rootDisk = disks.find(disk => disk.mount === '/');
      if (rootDisk) {
        this.data.diskUsageGBs.push({
          unixTimeMs,
          used: rootDisk.used / bytesPerGB,
          available: rootDisk.available / bytesPerGB,
          size: rootDisk.size / bytesPerGB,
        });
      } else {
        console.warn('Root filesystem not found in disk list. Disk metrics will be incomplete.');
      }

      // Increment collections counter
      this.collectionsSinceWrite++;

      // Only write to disk every N collections to reduce I/O
      if (this.collectionsSinceWrite >= this.writeInterval) {
        this.saveState();
        this.collectionsSinceWrite = 0;
      }
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
