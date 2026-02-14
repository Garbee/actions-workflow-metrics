import { describe, expect, it, beforeEach, vi } from "vitest";
import { Metrics } from "./metrics";
import type { Systeminformation } from "systeminformation";
import type { z } from "zod";
import type {
  cpuLoadPercentageSchema,
  metricsDataSchema,
  memoryUsageMBSchema,
} from "../lib";

// Mock systeminformation
vi.mock("systeminformation", () => ({
  currentLoad: vi.fn(
    async (): Promise<Systeminformation.CurrentLoadData> =>
      Promise.resolve({
        currentLoadUser: 25.5,
        currentLoadSystem: 10.3,
      } as Systeminformation.CurrentLoadData),
  ),
  mem: vi.fn(
    async (): Promise<Systeminformation.MemData> =>
      Promise.resolve({
        active: 4096 * 1024 * 1024, // 4096 MB in bytes
        available: 8192 * 1024 * 1024, // 8192 MB in bytes
      } as Systeminformation.MemData),
  ),
}));

describe("Metrics", () => {
  // Clear timers
  beforeEach(() => vi.restoreAllMocks());

  it("should return JSON string from get()", () => {
    const metrics: Metrics = new Metrics();
    const result: string = metrics.get();

    expect(typeof result).toBe("string");
    expect(
      (): z.TypeOf<typeof metricsDataSchema> => JSON.parse(result),
    ).not.toThrow();
  });

  it("should initialize with empty data arrays", () => {
    const metrics: Metrics = new Metrics();
    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    expect(data).toHaveProperty("cpuLoadPercentages");
    expect(data).toHaveProperty("memoryUsageMBs");
    expect(data).toHaveProperty("stepMarkers");
    expect(Array.isArray(data.cpuLoadPercentages)).toBe(true);
    expect(Array.isArray(data.memoryUsageMBs)).toBe(true);
    expect(Array.isArray(data.stepMarkers)).toBe(true);
  });

  it("should collect initial metrics on construction", async () => {
    const metrics: Metrics = new Metrics();

    // Wait for async processing to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    // Verify CPU metrics are collected
    expect(data.cpuLoadPercentages.length).toBeGreaterThan(0);
    expect(data.cpuLoadPercentages[0]).toHaveProperty("unixTimeMs");
    expect(data.cpuLoadPercentages[0]).toHaveProperty("user");
    expect(data.cpuLoadPercentages[0]).toHaveProperty("system");

    // Verify memory metrics are collected
    expect(data.memoryUsageMBs.length).toBeGreaterThan(0);
    expect(data.memoryUsageMBs[0]).toHaveProperty("unixTimeMs");
    expect(data.memoryUsageMBs[0]).toHaveProperty("used");
    expect(data.memoryUsageMBs[0]).toHaveProperty("free");
  });

  it("should have correct CPU metrics format", async () => {
    const metrics: Metrics = new Metrics();

    // Wait for async processing to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const cpuData: z.TypeOf<typeof cpuLoadPercentageSchema> = JSON.parse(
      metrics.get(),
    ).cpuLoadPercentages[0];

    expect(typeof cpuData.unixTimeMs).toBe("number");
    expect(typeof cpuData.user).toBe("number");
    expect(typeof cpuData.system).toBe("number");
    expect(cpuData.user).toBe(25.5);
    expect(cpuData.system).toBe(10.3);
  });

  it("should have correct memory metrics format and conversion", async () => {
    const metrics: Metrics = new Metrics();

    // Wait for async processing to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const memData: z.TypeOf<typeof memoryUsageMBSchema> = JSON.parse(
      metrics.get(),
    ).memoryUsageMBs[0];

    expect(typeof memData.unixTimeMs).toBe("number");
    expect(typeof memData.used).toBe("number");
    expect(typeof memData.free).toBe("number");

    // Bytes to MB conversion check (4096 MB active, 8192 MB available)
    expect(memData.used).toBe(4096);
    expect(memData.free).toBe(8192);
  });

  it("should accumulate metrics data over time", async () => {
    const metrics: Metrics = new Metrics();

    // Wait for initial data collection
    await new Promise((resolve) => setTimeout(resolve, 100));

    const initialData: z.TypeOf<typeof metricsDataSchema> = JSON.parse(
      metrics.get(),
    );
    const initialCpuCount: number = initialData.cpuLoadPercentages.length;
    const initialMemCount: number = initialData.memoryUsageMBs.length;

    // Verify at least one data point exists initially
    expect(initialCpuCount).toBeGreaterThan(0);
    expect(initialMemCount).toBeGreaterThan(0);

    // Verify new data points are added after 5 seconds
    // append is called at 5-second intervals
    await new Promise((resolve) => setTimeout(resolve, 5100));

    const updatedData: z.TypeOf<typeof metricsDataSchema> = JSON.parse(
      metrics.get(),
    );
    const updatedCpuCount: number = updatedData.cpuLoadPercentages.length;
    const updatedMemCount: number = updatedData.memoryUsageMBs.length;

    // Verify data points have increased
    expect(updatedCpuCount).toBeGreaterThan(initialCpuCount);
    expect(updatedMemCount).toBeGreaterThan(initialMemCount);
    expect(updatedCpuCount).toBe(initialCpuCount + 1);
    expect(updatedMemCount).toBe(initialMemCount + 1);
  }, 10000); // Set test timeout to 10 seconds

  it("should maintain correct time intervals between data points", async () => {
    const metrics: Metrics = new Metrics();

    // Wait for initial data collection
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Wait for second data point to be added after 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5100));

    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    // Verify at least 2 data points exist
    expect(data.cpuLoadPercentages.length).toBeGreaterThanOrEqual(2);
    expect(data.memoryUsageMBs.length).toBeGreaterThanOrEqual(2);

    // Verify timestamp interval is approximately 5 seconds (5000ms)
    const cpuTimeDiff: number =
      data.cpuLoadPercentages[1].unixTimeMs -
      data.cpuLoadPercentages[0].unixTimeMs;
    const memTimeDiff: number =
      data.memoryUsageMBs[1].unixTimeMs - data.memoryUsageMBs[0].unixTimeMs;

    // Verify close to 5 seconds (5000ms) with ±200ms tolerance
    expect(cpuTimeDiff).toBeGreaterThanOrEqual(4800);
    expect(cpuTimeDiff).toBeLessThanOrEqual(5200);
    expect(memTimeDiff).toBeGreaterThanOrEqual(4800);
    expect(memTimeDiff).toBeLessThanOrEqual(5200);
  }, 10000); // Set test timeout to 10 seconds

  it("should continue accumulating data for multiple intervals", async () => {
    const metrics: Metrics = new Metrics();

    // Wait for initial data collection
    await new Promise((resolve) => setTimeout(resolve, 100));

    const initialCount: number = JSON.parse(metrics.get()).cpuLoadPercentages
      .length;

    // Verify data increases after 10 seconds (2 append calls)
    await new Promise((resolve) => setTimeout(resolve, 10100));

    const finalData: z.TypeOf<typeof metricsDataSchema> = JSON.parse(
      metrics.get(),
    );

    // Verify 2 data points have been added
    expect(finalData.cpuLoadPercentages.length).toBe(initialCount + 2);

    // Verify all timestamps are in ascending order
    for (let i = 1; i < finalData.cpuLoadPercentages.length; i++) {
      expect(finalData.cpuLoadPercentages[i].unixTimeMs).toBeGreaterThan(
        finalData.cpuLoadPercentages[i - 1].unixTimeMs,
      );
    }

    for (let i = 1; i < finalData.memoryUsageMBs.length; i++) {
      expect(finalData.memoryUsageMBs[i].unixTimeMs).toBeGreaterThan(
        finalData.memoryUsageMBs[i - 1].unixTimeMs,
      );
    }
  }, 15000); // Set test timeout to 15 seconds

  it("should add step markers when markStep is called", () => {
    const metrics: Metrics = new Metrics();

    metrics.markStep("Build", "start");
    metrics.markStep("Test", "start");
    metrics.markStep("Build", "end");

    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    expect(data.stepMarkers.length).toBe(3);
    expect(data.stepMarkers[0].stepName).toBe("Build");
    expect(data.stepMarkers[0].status).toBe("start");
    expect(data.stepMarkers[1].stepName).toBe("Test");
    expect(data.stepMarkers[1].status).toBe("start");
    expect(data.stepMarkers[2].stepName).toBe("Build");
    expect(data.stepMarkers[2].status).toBe("end");
  });

  it("should include timestamp for step markers", () => {
    const metrics: Metrics = new Metrics();
    const beforeTime = Date.now();

    metrics.markStep("Deploy", "start");

    const afterTime = Date.now();
    const data: z.TypeOf<typeof metricsDataSchema> = JSON.parse(metrics.get());

    expect(data.stepMarkers.length).toBe(1);
    expect(data.stepMarkers[0].unixTimeMs).toBeGreaterThanOrEqual(beforeTime);
    expect(data.stepMarkers[0].unixTimeMs).toBeLessThanOrEqual(afterTime);
  });
});
