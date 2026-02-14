import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { setFailed } from "@actions/core";
import { currentLoad, mem } from "systeminformation";
import type { z } from "zod";
import { metricsDataSchema, getMetricsFilePath } from "../lib.ts";

export class Metrics {
  private readonly data: z.TypeOf<typeof metricsDataSchema>;
  private readonly intervalMs: number;
  private readonly filePath: string;
  private timeoutId: NodeJS.Timeout | null = null;
  private stopped: boolean = false;

  constructor() {
    this.data = { cpuLoadPercentages: [], memoryUsageMBs: [], stepMarkers: [] };
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

  async markStep(stepName: string, status: "start" | "end"): Promise<void> {
    // Note: This method has a race condition when called concurrently.
    // However, manual step markers are deprecated in favor of automatic
    // step detection via GitHub API. This method is kept for backward
    // compatibility but should not be used in production.
    
    // Read current data from file to get latest state
    await this.readData();
    
    this.data.stepMarkers.push({
      unixTimeMs: Date.now(),
      stepName,
      status,
    });
    
    // Write updated data back to file
    await this.writeData();
  }

  private async readData(): Promise<void> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      const parsed = metricsDataSchema.parse(JSON.parse(content));
      this.data.cpuLoadPercentages = parsed.cpuLoadPercentages;
      this.data.memoryUsageMBs = parsed.memoryUsageMBs;
      this.data.stepMarkers = parsed.stepMarkers;
    } catch (error) {
      // If file doesn't exist or is invalid, keep current data
    }
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

      const bytesPerMB: number = 1024 * 1024;
      const { active, available }: { active: number; available: number } =
        await mem();
      this.data.memoryUsageMBs.push({
        unixTimeMs,
        used: active / bytesPerMB,
        free: available / bytesPerMB,
      });

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
