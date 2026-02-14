import { describe, it, before, after, mock, beforeEach } from "node:test";
import * as assert from "node:assert/strict";
import { join } from "node:path";
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

// Shared state for mocking
const fileReads: Map<string, string> = new Map();
let render;
let getMetricsData;

before(async () => {
  // Mock @actions/core module once for all tests
  mock.module("@actions/core", {
    namedExports: {
      getInput: () => "",
    },
  });

  // Mock node:fs/promises module
  mock.module("node:fs/promises", {
    namedExports: {
      readFile: async (path: string): Promise<string> => {
        const content = fileReads.get(path);
        if (content) {
          return Promise.resolve(content);
        }
        throw new Error("ENOENT: no such file or directory");
      },
    },
  });

  // Import after mocking
  const lib = await import("./lib.ts");
  render = lib.render;
  getMetricsData = lib.getMetricsData;
});

beforeEach(() => {
  // Clear file reads between tests
  fileReads.clear();
});

describe("render", () => {
  const testMetricsID: string = "1234567890";

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
  it("should read metrics data from state file", async () => {
    // Compute the same path that the implementation would use
    const githubStateFile = process.env.GITHUB_STATE;
    const runId = process.env.GITHUB_RUN_ID || "local";
    const job = process.env.GITHUB_JOB || "default";
    
    let stateFile: string;
    if (githubStateFile) {
      const stateDir = join(githubStateFile, '..');
      stateFile = join(stateDir, `metrics-state-${runId}-${job}.json`);
    } else {
      const runnerTemp = process.env.RUNNER_TEMP || process.env.TMPDIR || '/tmp';
      stateFile = join(runnerTemp, `metrics-state-${runId}-${job}.json`);
    }
    
    fileReads.set(stateFile, JSON.stringify(sampleMetricsData));

    const result = await getMetricsData();

    assert.deepStrictEqual(result, sampleMetricsData);
  });

  it("should throw error for invalid metrics data", async () => {
    // Compute the same path that the implementation would use
    const githubStateFile = process.env.GITHUB_STATE;
    const runId = process.env.GITHUB_RUN_ID || "local";
    const job = process.env.GITHUB_JOB || "default";
    
    let stateFile: string;
    if (githubStateFile) {
      const stateDir = join(githubStateFile, '..');
      stateFile = join(stateDir, `metrics-state-${runId}-${job}.json`);
    } else {
      const runnerTemp = process.env.RUNNER_TEMP || process.env.TMPDIR || '/tmp';
      stateFile = join(runnerTemp, `metrics-state-${runId}-${job}.json`);
    }
    
    fileReads.set(stateFile, JSON.stringify({
      cpuLoadPercentages: "not an array",
      memoryUsageMBs: [],
    }));

    await assert.rejects(getMetricsData());
  });

  it("should throw error when state file doesn't exist", async () => {
    // Clear file reads
    fileReads.clear();

    await assert.rejects(getMetricsData(), { 
      message: /Failed to read metrics from state file/
    });
  });

  it("should throw error when JSON is invalid", async () => {
    // Compute the same path that the implementation would use
    const githubStateFile = process.env.GITHUB_STATE;
    const runId = process.env.GITHUB_RUN_ID || "local";
    const job = process.env.GITHUB_JOB || "default";
    
    let stateFile: string;
    if (githubStateFile) {
      const stateDir = join(githubStateFile, '..');
      stateFile = join(stateDir, `metrics-state-${runId}-${job}.json`);
    } else {
      const runnerTemp = process.env.RUNNER_TEMP || process.env.TMPDIR || '/tmp';
      stateFile = join(runnerTemp, `metrics-state-${runId}-${job}.json`);
    }
    
    fileReads.set(stateFile, "invalid json{");

    await assert.rejects(getMetricsData(), {
      message: /Failed to read metrics from state file/
    });
  });
});
