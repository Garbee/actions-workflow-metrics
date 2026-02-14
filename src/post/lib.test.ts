import { describe, it, before, after, mock } from "node:test";
import * as assert from "node:assert/strict";
import type { z } from "zod";
import type { metricsDataSchema } from "../lib.js";

/**
 * Sample metrics data for testing.
 */
const sampleMetricsData: z.TypeOf<typeof metricsDataSchema> = {
  cpuLoadPercentages: [
    { unixTimeMs: 1704067200000, user: 25.5, system: 10.3 },
    { unixTimeMs: 1704067205000, user: 30.2, system: 12.1 },
  ],
  memoryUsageMBs: [
    { unixTimeMs: 1704067200000, used: 4096, free: 8192 },
    { unixTimeMs: 1704067205000, used: 4200, free: 8000 },
  ],
  diskUsageGBs: [
    { unixTimeMs: 1704067200000, used: 50, available: 100, size: 150 },
    { unixTimeMs: 1704067205000, used: 55, available: 95, size: 150 },
  ],
  stepMarkers: [
    { unixTimeMs: 1704067199000, stepName: "Test Step", status: "start" as const },
    { unixTimeMs: 1704067206000, stepName: "Test Step", status: "end" as const },
  ],
};

describe("render", () => {
  let render;
  const testMetricsID: string = "1234567890";

  before(async () => {
    // Mock @actions/core module for render function
    mock.module("@actions/core", {
      namedExports: {
        getInput: () => "",
        getState: () => "",
      },
    });

    // Import after mocking
    const lib = await import("./lib.ts");
    render = lib.render;
  });

  it("should render charts with valid metrics data", () => {
    const result: string = render(sampleMetricsData, testMetricsID);

    assert.strictEqual(typeof result, "string");
    assert.ok(result.length > 0);

    // Verify rendered result contains expected content
    assert.ok(result.includes("CPU Usage"));
    assert.ok(result.includes("Memory Usage"));
    assert.ok(result.includes("Disk Usage"));
  });

  it("should handle empty metrics data", () => {
    const metricsData: z.TypeOf<typeof metricsDataSchema> = {
      cpuLoadPercentages: [],
      memoryUsageMBs: [],
      diskUsageGBs: [],
      stepMarkers: [
        { unixTimeMs: 1704067199000, stepName: "Test Step", status: "start" as const },
        { unixTimeMs: 1704067206000, stepName: "Test Step", status: "end" as const },
      ],
    };

    const result: string = render(metricsData, testMetricsID);

    // Empty data results in empty string (no charts to render)
    assert.strictEqual(typeof result, "string");
  });

  it("should correctly map CPU load percentages", () => {
    const metricsData: z.TypeOf<typeof metricsDataSchema> = {
      cpuLoadPercentages: [
        { unixTimeMs: 1704067200000, user: 20, system: 10 },
        { unixTimeMs: 1704067205000, user: 25, system: 15 },
      ],
      memoryUsageMBs: [
        { unixTimeMs: 1704067200000, used: 4000, free: 8000 },
        { unixTimeMs: 1704067205000, used: 4100, free: 7900 },
      ],
      diskUsageGBs: [
        { unixTimeMs: 1704067200000, used: 50, available: 100, size: 150 },
        { unixTimeMs: 1704067205000, used: 55, available: 95, size: 150 },
      ],
      stepMarkers: [
        { unixTimeMs: 1704067199000, stepName: "Test Step", status: "start" as const },
        { unixTimeMs: 1704067206000, stepName: "Test Step", status: "end" as const },
      ],
    };

    const result: string = render(metricsData, testMetricsID);

    assert.ok(result);
    assert.ok(result.length > 0);
  });

  it("should correctly map memory usage data", () => {
    const metricsData: z.TypeOf<typeof metricsDataSchema> = {
      cpuLoadPercentages: [{ unixTimeMs: 1704067200000, user: 20, system: 10 }],
      memoryUsageMBs: [
        { unixTimeMs: 1704067200000, used: 5000, free: 10000 },
        { unixTimeMs: 1704067205000, used: 5500, free: 9500 },
      ],
      diskUsageGBs: [
        { unixTimeMs: 1704067200000, used: 60, available: 90, size: 150 },
      ],
      stepMarkers: [
        { unixTimeMs: 1704067199000, stepName: "Test Step", status: "start" as const },
        { unixTimeMs: 1704067206000, stepName: "Test Step", status: "end" as const },
      ],
    };

    const result: string = render(metricsData, testMetricsID);

    assert.ok(result);
    assert.ok(result.length > 0);
  });
});

describe("getMetricsData", () => {
  let mockCoreModule;
  let getMetricsData;
  const savedStates: Map<string, string> = new Map();

  before(async () => {
    // Mock @actions/core module BEFORE importing
    mockCoreModule = mock.module("@actions/core", {
      namedExports: {
        getState: (name: string) => {
          return savedStates.get(name) || "";
        },
        getInput: () => "",
      },
    });

    // Import after mocking
    const lib = await import("./lib.ts");
    getMetricsData = lib.getMetricsData;
  });

  after(() => {
    mockCoreModule.restore();
  });

  it("should read metrics data from state", async () => {
    // Set test data in state
    savedStates.set("metrics_data", JSON.stringify(sampleMetricsData));

    const result = await getMetricsData();

    assert.deepStrictEqual(result, sampleMetricsData);
  });

  it("should throw error for invalid metrics data", async () => {
    // Set invalid data
    savedStates.set("metrics_data", JSON.stringify({
      cpuLoadPercentages: "not an array",
      memoryUsageMBs: [],
    }));

    await assert.rejects(getMetricsData());
  });

  it("should throw error when state is empty", async () => {
    // Clear state
    savedStates.clear();

    await assert.rejects(getMetricsData(), { 
      message: /Failed to read metrics from state/
    });
  });

  it("should throw error when JSON is invalid", async () => {
    // Set invalid JSON
    savedStates.set("metrics_data", "invalid json{");

    await assert.rejects(getMetricsData(), {
      message: /Failed to read metrics from state/
    });
  });
});
