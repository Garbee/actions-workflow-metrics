import { setFailed, saveState } from "@actions/core";
import { currentLoad, mem, fsSize } from "systeminformation";
import type { z } from "zod";
import { metricsDataSchema, bytesPerMB, bytesPerGB } from "../lib.ts";

export class Metrics {
  private readonly data: z.TypeOf<typeof metricsDataSchema>;
  private readonly intervalMs: number;
  private timeoutId: NodeJS.Timeout | null = null;
  private stopped: boolean = false;

  constructor() {
    this.data = { cpuLoadPercentages: [], memoryUsageMBs: [], diskUsageGBs: [], stepMarkers: [] };

    this.intervalMs = 5 * 1000;
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
    // Save final state to GitHub Actions state for post action
    try {
      saveState("metrics_data", JSON.stringify(this.data));
    } catch (error) {
      console.warn("Failed to save metrics state:", error);
    }
  }

  get(): string {
    return JSON.stringify(this.data);
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
