import { describe, it, beforeEach, mock } from "node:test";
import * as assert from "node:assert/strict";
import { getMetricsData, render } from "./lib.ts";
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
  stepMarkers: [],
};

/**
 * Creates a mock fetch function that returns the given metrics data.
 */
function createMockFetch(
  data: z.TypeOf<typeof metricsDataSchema>,
): typeof fetch {
  return async (): Promise<Response> =>
    ({
      ok: true,
      json: (): Promise<z.TypeOf<typeof metricsDataSchema>> =>
        Promise.resolve(data),
    }) as Response;
}

describe("render", () => {
  const testMetricsID: string = "1234567890";

  it("should render charts with valid metrics data", () => {
    const result: string = render(sampleMetricsData, testMetricsID);

    assert.strictEqual(typeof result, "string");
    assert.ok(result.length > 0);

    // Verify rendered result contains expected content
    assert.ok(result.includes("CPU Loads"));
    assert.ok(result.includes("Memory Usages"));
  });

  it("should handle empty metrics data", () => {
    const metricsData: z.TypeOf<typeof metricsDataSchema> = {
      cpuLoadPercentages: [],
      memoryUsageMBs: [],
      stepMarkers: [],
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
      stepMarkers: [],
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
      stepMarkers: [],
    };

    const result: string = render(metricsData, testMetricsID);

    assert.ok(result);
    assert.ok(result.length > 0);
  });
});

describe("getMetricsData", () => {
  beforeEach(() => mock.restoreAll());

  it("should fetch metrics data from server", async () => {
    globalThis.fetch = createMockFetch(sampleMetricsData);

    const result = await getMetricsData();

    assert.deepStrictEqual(result, sampleMetricsData);
  });

  it("should throw error for invalid metrics data", async () => {
    globalThis.fetch = async (): Promise<Response> =>
      ({
        ok: true,
        json: () =>
          Promise.resolve({
            cpuLoadPercentages: "not an array",
            memoryUsageMBs: [],
          }),
      }) as Response;

    await assert.rejects(getMetricsData());
  });

  it("should throw error when fetch fails", async () => {
    globalThis.fetch = () => Promise.reject(new Error("Network error"));

    await assert.rejects(getMetricsData(), { message: "Network error" });
  });

  it("should throw error when response is not ok", async () => {
    globalThis.fetch = async (): Promise<Response> =>
      ({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      }) as Response;

    await assert.rejects(getMetricsData(), {
      message: "Failed to fetch metrics: 500 Internal Server Error",
    });
  });
});
