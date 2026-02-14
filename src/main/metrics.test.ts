import { setTimeout } from "node:timers/promises";
import { describe, it, beforeEach, mock, before, after } from "node:test";
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

  before(async () => {
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

    ({ Metrics } = await import("./metrics.ts"));
  })

  beforeEach(() => {
    mock.restoreAll();
  });

  after(() => {
    mockModule.restore();
  })

  it("should return JSON string from get()", () => {
    const metrics = new Metrics();
    const result: string = metrics.get();

    assert.strictEqual(typeof result, "string");
    assert.doesNotThrow(() => {
      JSON.parse(result);
    });
  });

  it("should initialize with empty data arrays", () => {
    const metrics = new Metrics();
    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    assert.ok(data.cpuLoadPercentages);
    assert.ok(data.memoryUsageMBs);
    assert.ok(data.stepMarkers);
    assert.strictEqual(Array.isArray(data.cpuLoadPercentages), true);
    assert.strictEqual(Array.isArray(data.memoryUsageMBs), true);
    assert.strictEqual(Array.isArray(data.stepMarkers), true);
  });

  it("should collect initial metrics on construction", async () => {
    const metrics = new Metrics();

    // Wait for async processing to complete
    await setTimeout(100);

    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    // Verify CPU metrics are collected
    assert.ok(data.cpuLoadPercentages.length > 0);
    assert.ok(data.cpuLoadPercentages[0].unixTimeMs);
    assert.ok(data.cpuLoadPercentages[0].user !== undefined);
    assert.ok(data.cpuLoadPercentages[0].system !== undefined);

    // Verify memory metrics are collected
    assert.ok(data.memoryUsageMBs.length > 0);
    assert.ok(data.memoryUsageMBs[0].unixTimeMs);
    assert.ok(data.memoryUsageMBs[0].used !== undefined);
    assert.ok(data.memoryUsageMBs[0].free !== undefined);
  });

  it("should have correct CPU metrics format", async () => {
    const metrics = new Metrics();

    // Wait for async processing to complete
    await setTimeout(100);

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
    const metrics = new Metrics();

    // Wait for async processing to complete
    await setTimeout(100);

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
    const metrics = new Metrics();

    // Wait for initial data collection
    await setTimeout(100);

    const initialData: z.TypeOf<typeof metricsDataSchema> = JSON.parse(
      metrics.get(),
    );
    const initialCpuCount: number = initialData.cpuLoadPercentages.length;
    const initialMemCount: number = initialData.memoryUsageMBs.length;

    // Verify at least one data point exists initially
    assert.ok(initialCpuCount > 0);
    assert.ok(initialMemCount > 0);

    // Verify new data points are added after 5 seconds
    // append is called at 5-second intervals
    await setTimeout(5100);

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
    const metrics = new Metrics();

    // Wait for initial data collection
    await setTimeout(100);

    // Wait for second data point to be added after 5 seconds
    await setTimeout(5100);

    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    // Verify at least 2 data points exist
    assert.ok(data.cpuLoadPercentages.length >= 2);
    assert.ok(data.memoryUsageMBs.length >= 2);

    // Verify timestamp interval is approximately 5 seconds (5000ms)
    const cpuTimeDiff: number =
      data.cpuLoadPercentages[1].unixTimeMs -
      data.cpuLoadPercentages[0].unixTimeMs;
    const memTimeDiff: number =
      data.memoryUsageMBs[1].unixTimeMs - data.memoryUsageMBs[0].unixTimeMs;

    // Verify close to 5 seconds (5000ms) with ±200ms tolerance
    assert.ok(cpuTimeDiff >= 4800);
    assert.ok(cpuTimeDiff <= 5200);
    assert.ok(memTimeDiff >= 4800);
    assert.ok(memTimeDiff <= 5200);
  });

  it("should continue accumulating data for multiple intervals", async () => {
    const metrics = new Metrics();

    // Wait for initial data collection
    await setTimeout(100);

    const initialCount: number = JSON.parse(metrics.get()).cpuLoadPercentages
      .length;

    // Verify data increases after 10 seconds (2 append calls)
    await setTimeout(10100);

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

  it("should add step markers when markStep is called", () => {
    const metrics = new Metrics();

    metrics.markStep("Build", "start");
    metrics.markStep("Test", "start");
    metrics.markStep("Build", "end");

    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    assert.strictEqual(data.stepMarkers.length, 3);
    assert.strictEqual(data.stepMarkers[0].stepName, "Build");
    assert.strictEqual(data.stepMarkers[0].status, "start");
    assert.strictEqual(data.stepMarkers[1].stepName, "Test");
    assert.strictEqual(data.stepMarkers[1].status, "start");
    assert.strictEqual(data.stepMarkers[2].stepName, "Build");
    assert.strictEqual(data.stepMarkers[2].status, "end");
  });

  it("should include timestamp for step markers", () => {
    const metrics = new Metrics();
    const beforeTime = Date.now();

    metrics.markStep("Deploy", "start");

    const afterTime = Date.now();
    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    assert.strictEqual(data.stepMarkers.length, 1);
    assert.ok(data.stepMarkers[0].unixTimeMs >= beforeTime);
    assert.ok(data.stepMarkers[0].unixTimeMs <= afterTime);
  });
});
