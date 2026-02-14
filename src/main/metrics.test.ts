import { describe, it, beforeEach, mock, before, after, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import type { Systeminformation } from "systeminformation";
import type { z } from "zod";
import {
  type cpuLoadPercentageSchema,
  metricsDataSchema,
  type memoryUsageMBSchema,
} from "../lib.ts";

describe("Metrics", () => {
  let Metrics;
  let mockModule;
  let mockFsModule;
  const metricsInstances: any[] = [];
  const fileWrites: string[] = [];

  before(async () => {
    // Enable timer mocking BEFORE importing the module
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });

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
      },
    });

    // Mock node:fs/promises module
    mockFsModule = mock.module("node:fs/promises", {
      namedExports: {
        writeFile: async (path: string, content: string): Promise<void> => {
          fileWrites.push(content);
          return Promise.resolve();
        },
        readFile: async (path: string): Promise<string> => {
          if (fileWrites.length > 0) {
            return Promise.resolve(fileWrites[fileWrites.length - 1]);
          }
          throw new Error("ENOENT: no such file or directory");
        },
        mkdir: async (): Promise<void> => Promise.resolve(),
      },
    });

    ({ Metrics } = await import("./metrics.ts"));
  })

  beforeEach(() => {
    // Clear file writes between tests
    fileWrites.length = 0;
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
    assert.ok(data.stepMarkers);
    assert.strictEqual(Array.isArray(data.cpuLoadPercentages), true);
    assert.strictEqual(Array.isArray(data.memoryUsageMBs), true);
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

    // Verify at least one data point exists initially
    assert.ok(initialCpuCount > 0);
    assert.ok(initialMemCount > 0);

    // Advance time by 5 seconds to trigger next append
    await mock.timers.tick(5000);
    // Wait for promises to resolve
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    const updatedData: z.TypeOf<typeof metricsDataSchema> = JSON.parse(
      metrics.get(),
    );
    const updatedCpuCount: number = updatedData.cpuLoadPercentages.length;
    const updatedMemCount: number = updatedData.memoryUsageMBs.length;

    // Verify data points have increased
    assert.ok(updatedCpuCount > initialCpuCount);
    assert.ok(updatedMemCount > initialMemCount);
    assert.strictEqual(updatedCpuCount, initialCpuCount + 1);
    assert.strictEqual(updatedMemCount, initialMemCount + 1);
  });

  it("should maintain correct time intervals between data points", async () => {
    const metrics = createMetrics();

    // Wait for initial data collection
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    // Advance time by 5 seconds to trigger second data point
    await mock.timers.tick(5000);
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }

    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    // Verify at least 2 data points exist
    assert.ok(data.cpuLoadPercentages.length >= 2);
    assert.ok(data.memoryUsageMBs.length >= 2);

    // Verify timestamp interval is exactly 5 seconds (5000ms) with mocked timers
    const cpuTimeDiff: number =
      data.cpuLoadPercentages[1].unixTimeMs -
      data.cpuLoadPercentages[0].unixTimeMs;
    const memTimeDiff: number =
      data.memoryUsageMBs[1].unixTimeMs - data.memoryUsageMBs[0].unixTimeMs;

    // With mocked timers and Date, we get exactly 5000ms
    assert.strictEqual(cpuTimeDiff, 5000);
    assert.strictEqual(memTimeDiff, 5000);
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
    await mock.timers.tick(5000);
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => queueMicrotask(resolve));
    }
    await mock.timers.tick(5000);
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
  });
});
