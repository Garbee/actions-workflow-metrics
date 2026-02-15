import { describe, it, beforeEach, mock, before, after, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import type { Systeminformation } from "systeminformation";
import type { z } from "zod";
import {
  type cpuLoadPercentageSchema,
  metricsDataSchema,
  type memoryUsageMBSchema,
  type diskUsageGBSchema,
} from "../lib.ts";

describe("Metrics", () => {
  let Metrics;
  let mockModule;
  let mockFsModule;
  let mockFsSyncModule;
  const metricsInstances: any[] = [];
  const fileWrites: Map<string, string> = new Map();
  let writeCount = 0; // Track total number of writes

  before(async () => {
    // Enable timer mocking BEFORE importing the module
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });

    // Determine the mount point based on the current platform
    const platform = process.platform;
    let rootMountPoint: string;
    if (platform === 'win32') {
      rootMountPoint = 'C:';
    } else if (platform === 'darwin') {
      rootMountPoint = '/System/Volumes/Data';
    } else {
      rootMountPoint = '/';
    }

    // Mock systeminformation module
    mockModule = mock.module("systeminformation", {
      namedExports: {
        currentLoad: async (): Promise<Systeminformation.CurrentLoadData> =>
          Promise.resolve({
            currentLoadUser: 25.5,
            currentLoadSystem: 10.3,
          } as Systeminformation.CurrentLoadData),
        mem: async (): Promise<Systeminformation.MemData> =>
          Promise.resolve({
            active: 4096 * 1024 * 1024, // 4096 MB in bytes
            available: 8192 * 1024 * 1024, // 8192 MB in bytes
          } as Systeminformation.MemData),
        fsSize: async (): Promise<Systeminformation.FsSizeData[]> =>
          Promise.resolve([
            {
              fs: "/dev/root",
              type: "ext4",
              size: 100 * 1024 * 1024 * 1024, // 100 GB
              used: 30 * 1024 * 1024 * 1024, // 30 GB
              available: 70 * 1024 * 1024 * 1024, // 70 GB
              use: 30,
              mount: rootMountPoint,
              rw: true,
            },
            {
              fs: "/dev/sda1",
              type: "ext4",
              size: 50 * 1024 * 1024 * 1024, // 50 GB
              used: 20 * 1024 * 1024 * 1024, // 20 GB
              available: 30 * 1024 * 1024 * 1024, // 30 GB
              use: 40,
              mount: "/data",
              rw: true,
            },
          ] as Systeminformation.FsSizeData[]),
      },
    });

    // Mock node:fs/promises module
    mockFsModule = mock.module("node:fs/promises", {
      namedExports: {
        writeFile: async (path: string, content: string): Promise<void> => {
          fileWrites.set(path, content);
          writeCount++; // Increment write counter
          return Promise.resolve();
        },
        readFile: async (path: string): Promise<string> => {
          const content = fileWrites.get(path);
          if (content) {
            return Promise.resolve(content);
          }
          throw new Error("ENOENT: no such file or directory");
        },
      },
    });

    // Mock node:fs module for synchronous operations
    mockFsSyncModule = mock.module("node:fs", {
      namedExports: {
        writeFileSync: (path: string, content: string): void => {
          fileWrites.set(path, content);
          writeCount++; // Increment write counter
        },
        constants: {
          F_OK: 0,
          R_OK: 4,
          W_OK: 2,
          X_OK: 1,
        },
        promises: {
          writeFile: async (path: string, content: string): Promise<void> => {
            fileWrites.set(path, content);
            writeCount++;
            return Promise.resolve();
          },
        },
      },
    });

    ({ Metrics } = await import("./metrics.ts"));
  })

  beforeEach(() => {
    // Clear file writes between tests
    fileWrites.clear();
    writeCount = 0; // Reset write count
  });

  afterEach(() => {
    // Clean up all Metrics instances to prevent hanging
    for (const instance of metricsInstances) {
      instance.stop();
    }
    metricsInstances.length = 0;
  });

  after(() => {
    mockModule.restore();
    mockFsModule.restore();
    mockFsSyncModule.restore();
    mock.timers.reset();
  })

  // Helper function to create and track Metrics instances
  function createMetrics() {
    const instance = new Metrics();
    metricsInstances.push(instance);
    return instance;
  }

  it("should return JSON string from get()", () => {
    const metrics = createMetrics();
    const result: string = metrics.get();

    assert.strictEqual(typeof result, "string");
    assert.doesNotThrow(() => {
      JSON.parse(result);
    });
  });

  it("should initialize with empty data arrays", () => {
    const metrics = createMetrics();
    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    assert.ok(data.cpuLoadPercentages);
    assert.ok(data.memoryUsageMBs);
    assert.ok(data.diskUsageGBs);
    assert.ok(data.stepMarkers);
    assert.strictEqual(Array.isArray(data.cpuLoadPercentages), true);
    assert.strictEqual(Array.isArray(data.memoryUsageMBs), true);
    assert.strictEqual(Array.isArray(data.diskUsageGBs), true);
    assert.strictEqual(Array.isArray(data.stepMarkers), true);
  });

  it("should collect initial metrics on construction", async () => {
    const metrics = createMetrics();

    // Wait for the async append() and file write to complete
    // Need to flush microtask queue for promises to resolve
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    // Verify CPU metrics are collected
    assert.ok(data.cpuLoadPercentages.length > 0);
    assert.strictEqual(typeof data.cpuLoadPercentages[0].unixTimeMs, "number");
    assert.ok(data.cpuLoadPercentages[0].user !== undefined);
    assert.ok(data.cpuLoadPercentages[0].system !== undefined);

    // Verify memory metrics are collected
    assert.ok(data.memoryUsageMBs.length > 0);
    assert.strictEqual(typeof data.memoryUsageMBs[0].unixTimeMs, "number");
    assert.ok(data.memoryUsageMBs[0].used !== undefined);
    assert.ok(data.memoryUsageMBs[0].free !== undefined);

    // Verify disk metrics are collected
    assert.ok(data.diskUsageGBs.length > 0);
    assert.strictEqual(typeof data.diskUsageGBs[0].unixTimeMs, "number");
    assert.ok(data.diskUsageGBs[0].used !== undefined);
    assert.ok(data.diskUsageGBs[0].available !== undefined);
    assert.ok(data.diskUsageGBs[0].size !== undefined);
  });

  it("should have correct CPU metrics format", async () => {
    const metrics = createMetrics();

    // Wait for async processing to complete
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    const cpuData: z.TypeOf<typeof cpuLoadPercentageSchema> = JSON.parse(
      metrics.get(),
    ).cpuLoadPercentages[0];

    assert.strictEqual(typeof cpuData.unixTimeMs, "number");
    assert.strictEqual(typeof cpuData.user, "number");
    assert.strictEqual(typeof cpuData.system, "number");
    // With mocks, we can assert specific values
    assert.strictEqual(cpuData.user, 25.5);
    assert.strictEqual(cpuData.system, 10.3);
  });

  it("should have correct memory metrics format and conversion", async () => {
    const metrics = createMetrics();

    // Wait for async processing to complete
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    const memData: z.TypeOf<typeof memoryUsageMBSchema> = JSON.parse(
      metrics.get(),
    ).memoryUsageMBs[0];

    assert.strictEqual(typeof memData.unixTimeMs, "number");
    assert.strictEqual(typeof memData.used, "number");
    assert.strictEqual(typeof memData.free, "number");

    // Bytes to MB conversion check (4096 MB active, 8192 MB available)
    assert.strictEqual(memData.used, 4096);
    assert.strictEqual(memData.free, 8192);
  });

  it("should have correct disk metrics format and conversion", async () => {
    const metrics = createMetrics();

    // Wait for async processing to complete
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    const diskData: z.TypeOf<typeof diskUsageGBSchema> = JSON.parse(
      metrics.get(),
    ).diskUsageGBs[0];

    assert.strictEqual(typeof diskData.unixTimeMs, "number");
    assert.strictEqual(typeof diskData.used, "number");
    assert.strictEqual(typeof diskData.available, "number");
    assert.strictEqual(typeof diskData.size, "number");

    // Bytes to GB conversion check (no scaling factor)
    // Root filesystem (mount="/"): 30 GB used, 70 GB available, 100 GB size
    assert.strictEqual(diskData.used, 30);
    assert.strictEqual(diskData.available, 70);
    assert.strictEqual(diskData.size, 100);
  });

  it("should accumulate metrics data over time", async () => {
    const metrics = createMetrics();

    // Wait for initial data collection
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    const initialData: z.TypeOf<typeof metricsDataSchema> = JSON.parse(
      metrics.get(),
    );
    const initialCpuCount: number = initialData.cpuLoadPercentages.length;
    const initialMemCount: number = initialData.memoryUsageMBs.length;
    const initialDiskCount: number = initialData.diskUsageGBs.length;

    // Verify at least one data point exists initially
    assert.ok(initialCpuCount > 0);
    assert.ok(initialMemCount > 0);
    assert.ok(initialDiskCount > 0);

    // Advance time by 5 seconds to trigger next append
    await mock.timers.tick(1000);
    // Wait for promises to resolve
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    const updatedData: z.TypeOf<typeof metricsDataSchema> = JSON.parse(
      metrics.get(),
    );
    const updatedCpuCount: number = updatedData.cpuLoadPercentages.length;
    const updatedMemCount: number = updatedData.memoryUsageMBs.length;
    const updatedDiskCount: number = updatedData.diskUsageGBs.length;

    // Verify data points have increased
    assert.ok(updatedCpuCount > initialCpuCount);
    assert.ok(updatedMemCount > initialMemCount);
    assert.ok(updatedDiskCount > initialDiskCount);
    assert.strictEqual(updatedCpuCount, initialCpuCount + 1);
    assert.strictEqual(updatedMemCount, initialMemCount + 1);
    assert.strictEqual(updatedDiskCount, initialDiskCount + 1);
  });

  it("should maintain correct time intervals between data points", async () => {
    const metrics = createMetrics();

    // Wait for initial data collection
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    // Advance time by 1 second to trigger second data point
    await mock.timers.tick(1000);
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    // Verify at least 2 data points exist
    assert.ok(data.cpuLoadPercentages.length >= 2);
    assert.ok(data.memoryUsageMBs.length >= 2);
    assert.ok(data.diskUsageGBs.length >= 2);

    // Verify timestamp interval is exactly 1 second (1000ms) with mocked timers
    const cpuTimeDiff: number =
      data.cpuLoadPercentages[1].unixTimeMs -
      data.cpuLoadPercentages[0].unixTimeMs;
    const memTimeDiff: number =
      data.memoryUsageMBs[1].unixTimeMs - data.memoryUsageMBs[0].unixTimeMs;
    const diskTimeDiff: number =
      data.diskUsageGBs[1].unixTimeMs - data.diskUsageGBs[0].unixTimeMs;

    // With mocked timers and Date, we get exactly 1000ms
    assert.strictEqual(cpuTimeDiff, 1000);
    assert.strictEqual(memTimeDiff, 1000);
    assert.strictEqual(diskTimeDiff, 1000);
  });

  it("should continue accumulating data for multiple intervals", async () => {
    const metrics = createMetrics();

    // Wait for initial data collection
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    const initialCount: number = JSON.parse(metrics.get()).cpuLoadPercentages
      .length;

    // Advance time by 10 seconds (2 intervals)
    await mock.timers.tick(1000);
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }
    await mock.timers.tick(1000);
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    const finalData: z.TypeOf<typeof metricsDataSchema> = JSON.parse(
      metrics.get(),
    );

    // Verify 2 data points have been added
    assert.strictEqual(finalData.cpuLoadPercentages.length, initialCount + 2);

    // Verify all timestamps are in ascending order
    for (let i = 1; i < finalData.cpuLoadPercentages.length; i++) {
      assert.ok(
        finalData.cpuLoadPercentages[i].unixTimeMs >
          finalData.cpuLoadPercentages[i - 1].unixTimeMs,
      );
    }

    for (let i = 1; i < finalData.memoryUsageMBs.length; i++) {
      assert.ok(
        finalData.memoryUsageMBs[i].unixTimeMs >
          finalData.memoryUsageMBs[i - 1].unixTimeMs,
      );
    }

    for (let i = 1; i < finalData.diskUsageGBs.length; i++) {
      assert.ok(
        finalData.diskUsageGBs[i].unixTimeMs >
          finalData.diskUsageGBs[i - 1].unixTimeMs,
      );
    }
  });

  it("should write to disk after every collection", async () => {
    const metrics = createMetrics();

    // Wait for initial data collection
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    // First collection should write
    assert.strictEqual(writeCount, 1, "First collection should write");

    // Advance time by 5 seconds (2nd collection)
    await mock.timers.tick(1000);
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    assert.strictEqual(writeCount, 2, "Second collection should write");

    // Advance time by 5 seconds (3rd collection)
    await mock.timers.tick(1000);
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    assert.strictEqual(writeCount, 3, "Third collection should write");

    // Advance time by 5 seconds (4th collection)
    await mock.timers.tick(1000);
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    assert.strictEqual(writeCount, 4, "Fourth collection should write");

    // Advance time by 5 seconds (5th collection)
    await mock.timers.tick(1000);
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    assert.strictEqual(writeCount, 5, "Fifth collection should write");

    // Verify data is collected correctly with immediate writes
    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());
    assert.strictEqual(data.cpuLoadPercentages.length, 5, "Should have 5 CPU data points");
    assert.strictEqual(data.memoryUsageMBs.length, 5, "Should have 5 memory data points");
    assert.strictEqual(data.diskUsageGBs.length, 5, "Should have 5 disk data points");
  });

  it("should write to disk on stop", async () => {
    const metrics = createMetrics();

    // Wait for initial data collection
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    // First collection should have written
    assert.strictEqual(writeCount, 1, "First collection should write");

    // Stop the metrics - should force another write
    metrics.stop();

    // Wait for file write to complete
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    // Should have written on stop
    assert.strictEqual(writeCount, 2, "Should write on stop to ensure final data is saved");

    // Verify the written data contains our metrics
    const stateFilePath = Array.from(fileWrites.keys())[0];
    const writtenContent = fileWrites.get(stateFilePath);
    assert.ok(writtenContent, "Should have written content");

    const writtenData: z.TypeOf<typeof metricsDataSchema> = JSON.parse(writtenContent);
    assert.strictEqual(writtenData.cpuLoadPercentages.length, 1, "Written data should have 1 CPU data point");
  });

  it("should write after multiple collections", async () => {
    const metrics = createMetrics();

    // Wait for initial data collection
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    // First collection writes
    assert.strictEqual(writeCount, 1, "Should have 1 write after first collection");

    // Collect 4 more times (each should write)
    for (let j = 0; j < 4; j++) {
      await mock.timers.tick(1000);
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => queueMicrotask(resolve));
      }
    }

    assert.strictEqual(writeCount, 5, "Should have 5 writes after 5 collections");

    // Collect 5 more times (each should write)
    for (let j = 0; j < 5; j++) {
      await mock.timers.tick(1000);
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => queueMicrotask(resolve));
      }
    }

    assert.strictEqual(writeCount, 10, "Should have 10 writes after 10 collections");

    // Verify all 10 data points are in memory
    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());
    assert.strictEqual(data.cpuLoadPercentages.length, 10, "Should have 10 CPU data points");
  });

  describe("OS-specific mount point handling", () => {
    it("should use correct mount point for the current platform", async () => {
      const metrics = createMetrics();

      // Wait for first collection
      await mock.timers.tick(1000);
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => queueMicrotask(resolve));
      }

      const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());
      
      // Should have disk data from the root mount point for the current platform
      assert.ok(data.diskUsageGBs.length > 0, "Should have disk data");
      assert.strictEqual(data.diskUsageGBs[0].used, 30, "Should use disk data from root mount");
      assert.strictEqual(data.diskUsageGBs[0].available, 70, "Should use disk data from root mount");
      assert.strictEqual(data.diskUsageGBs[0].size, 100, "Should use disk data from root mount");
    });
  });
});
