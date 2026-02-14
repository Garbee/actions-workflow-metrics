import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { setFailed } from "@actions/core";
import { currentLoad, mem, fsSize } from "systeminformation";
import type { z } from "zod";
import { metricsDataSchema, getMetricsFilePath, bytesPerMB, bytesPerGB } from "../lib.ts";

export class Metrics {
  private readonly data: z.TypeOf<typeof metricsDataSchema>;
  private readonly intervalMs: number;
  private readonly filePath: string;
  private timeoutId: NodeJS.Timeout | null = null;
  private stopped: boolean = false;

  constructor() {
    this.data = { cpuLoadPercentages: [], memoryUsageMBs: [], diskUsageGBs: [], stepMarkers: [] };
    this.filePath = getMetricsFilePath();

    this.intervalMs = 5 * 1000;
    const intervalSecondsInput: string | undefined =
      process.env.METRICS_INTERVAL_SECONDS;

    if (intervalSecondsInput) {
      const intervalSecondsVal: number = parseInt(intervalSecondsInput, 10);
      if (Number.isInteger(intervalSecondsVal)) {
        this.intervalMs = intervalSecondsVal * 1000;
      }
    }

    // Ensure directory exists and start async processing
    this.initialize().catch(setFailed);
  }

  private async initialize(): Promise<void> {
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await this.writeData();
    } catch (error) {
      setFailed(error);
    }
    // Start collection after initialization
    this.append(Date.now()).catch(setFailed);
  }

  stop(): void {
    this.stopped = true;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  get(): string {
    return JSON.stringify(this.data);
  }

  private async writeData(): Promise<void> {
    const content = JSON.stringify(this.data);
    await writeFile(this.filePath, content, "utf-8");
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
          free: rootDisk.available / bytesPerGB,
        });
      } else {
        console.warn('Root filesystem not found in disk list. Disk metrics will be incomplete.');
      }

      // Write to file after collecting metrics
      await this.writeData();
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
