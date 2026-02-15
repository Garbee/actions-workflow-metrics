import { describe, it, beforeEach, mock } from "node:test";
import * as assert from "node:assert/strict";
import type { Alert } from "../lib.ts";

let detectAlerts: (metricsData: any) => Alert[];

describe("detectAlerts", () => {
  beforeEach(async () => {
    // Reset mocks
    mock.restoreAll();

    // Mock @actions/core getInput
    mock.module("@actions/core", {
      namedExports: {
        getInput: (name: string): string => {
          const defaults: Record<string, string> = {
            memory_alert_threshold: "80",
            cpu_alert_threshold: "85",
            cpu_alert_duration: "60",
            disk_alert_threshold: "90",
          };
          return defaults[name] || "";
        },
      },
    });

    // Import after mocking
    const lib = await import("./lib.ts");
    detectAlerts = lib.detectAlerts;
  });

  it("should return empty array when no thresholds are exceeded", () => {
    const metricsData = {
      cpuLoadPercentages: [
        { unixTimeMs: 1000, user: 30, system: 20 },
        { unixTimeMs: 6000, user: 35, system: 25 },
      ],
      memoryUsageMBs: [
        { unixTimeMs: 1000, used: 1000, free: 3000 }, // 25% usage
        { unixTimeMs: 6000, used: 1500, free: 2500 }, // 37.5% usage
      ],
      diskUsageGBs: [
        { unixTimeMs: 1000, used: 20, available: 80, size: 100 }, // 20% usage
        { unixTimeMs: 6000, used: 30, available: 70, size: 100 }, // 30% usage
      ],
      stepMarkers: [
        { unixTimeMs: 0, stepName: "Test Step", status: "start" },
        { unixTimeMs: 10000, stepName: "Test Step", status: "end" },
      ],
    };

    const alerts = detectAlerts(metricsData);
    assert.strictEqual(alerts.length, 0);
  });

  it("should detect memory threshold violation", () => {
    const metricsData = {
      cpuLoadPercentages: [{ unixTimeMs: 1000, user: 30, system: 20 }],
      memoryUsageMBs: [
        { unixTimeMs: 1000, used: 1000, free: 3000 }, // 25% usage - OK
        { unixTimeMs: 6000, used: 3500, free: 1000 }, // 77.8% usage - OK
        { unixTimeMs: 11000, used: 4100, free: 900 }, // 82% usage - Alert!
      ],
      diskUsageGBs: [{ unixTimeMs: 1000, used: 20, available: 80, size: 100 }],
      stepMarkers: [],
    };

    const alerts = detectAlerts(metricsData);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].type, "memory");
    assert.strictEqual(alerts[0].timespan, 11000);
    assert.strictEqual(alerts[0].threshold, 80);
    assert.ok(alerts[0].value > 80);
  });

  it("should detect disk threshold violation", () => {
    const metricsData = {
      cpuLoadPercentages: [{ unixTimeMs: 1000, user: 30, system: 20 }],
      memoryUsageMBs: [{ unixTimeMs: 1000, used: 1000, free: 3000 }],
      diskUsageGBs: [
        { unixTimeMs: 1000, used: 20, available: 80, size: 100 }, // 20% usage - OK
        { unixTimeMs: 6000, used: 92, available: 8, size: 100 }, // 92% usage - Alert!
      ],
      stepMarkers: [],
    };

    const alerts = detectAlerts(metricsData);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].type, "disk");
    assert.strictEqual(alerts[0].timespan, 6000);
    assert.strictEqual(alerts[0].threshold, 90);
    assert.ok(alerts[0].value > 90);
  });

  it("should detect sustained CPU threshold violation", () => {
    const metricsData = {
      cpuLoadPercentages: [
        { unixTimeMs: 1000, user: 50, system: 40 }, // 90% - sustained start
        { unixTimeMs: 6000, user: 55, system: 35 }, // 90% - still sustained
        { unixTimeMs: 11000, user: 50, system: 38 }, // 88% - still sustained
        { unixTimeMs: 16000, user: 60, system: 30 }, // 90% - still sustained
        { unixTimeMs: 21000, user: 55, system: 35 }, // 90% - still sustained
        { unixTimeMs: 26000, user: 52, system: 36 }, // 88% - still sustained
        { unixTimeMs: 31000, user: 50, system: 40 }, // 90% - still sustained
        { unixTimeMs: 36000, user: 55, system: 38 }, // 93% - still sustained
        { unixTimeMs: 41000, user: 51, system: 35 }, // 86% - still sustained
        { unixTimeMs: 46000, user: 52, system: 36 }, // 88% - still sustained
        { unixTimeMs: 51000, user: 55, system: 35 }, // 90% - still sustained
        { unixTimeMs: 56000, user: 50, system: 40 }, // 90% - still sustained
        { unixTimeMs: 61000, user: 52, system: 38 }, // 90% - sustained met at 60s
        { unixTimeMs: 66000, user: 30, system: 20 }, // 50% - drops
      ],
      memoryUsageMBs: [{ unixTimeMs: 1000, used: 1000, free: 3000 }],
      diskUsageGBs: [{ unixTimeMs: 1000, used: 20, available: 80, size: 100 }],
      stepMarkers: [],
    };

    const alerts = detectAlerts(metricsData);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].type, "cpu");
    assert.ok(alerts[0].timespans);
    assert.ok(alerts[0].timespans!.length >= 12); // Should have captured all sustained period
    assert.strictEqual(alerts[0].threshold, 85);
    assert.ok(alerts[0].value >= 85);
  });

  it("should detect sustained CPU violation across multiple steps", () => {
    const metricsData = {
      cpuLoadPercentages: [
        { unixTimeMs: 1000, user: 50, system: 40 }, // 90%
        { unixTimeMs: 6000, user: 55, system: 35 }, // 90%
        { unixTimeMs: 11000, user: 50, system: 38 }, // 88%
        { unixTimeMs: 16000, user: 60, system: 30 }, // 90%
        { unixTimeMs: 21000, user: 55, system: 35 }, // 90%
        { unixTimeMs: 26000, user: 52, system: 36 }, // 88%
        { unixTimeMs: 31000, user: 50, system: 40 }, // 90%
        { unixTimeMs: 36000, user: 55, system: 38 }, // 93%
        { unixTimeMs: 41000, user: 51, system: 35 }, // 86%
        { unixTimeMs: 46000, user: 52, system: 36 }, // 88%
        { unixTimeMs: 51000, user: 55, system: 35 }, // 90%
        { unixTimeMs: 56000, user: 50, system: 40 }, // 90%
        { unixTimeMs: 61000, user: 52, system: 38 }, // 90%
        { unixTimeMs: 66000, user: 30, system: 20 }, // 50%
      ],
      memoryUsageMBs: [{ unixTimeMs: 1000, used: 1000, free: 3000 }],
      diskUsageGBs: [{ unixTimeMs: 1000, used: 20, available: 80, size: 100 }],
      stepMarkers: [],
    };

    const alerts = detectAlerts(metricsData);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].type, "cpu");
    assert.ok(alerts[0].timespans);
    assert.ok(alerts[0].timespans!.length >= 12); // Should have captured all sustained period
  });

  it("should not trigger CPU alert if sustained duration is not met", () => {
    const metricsData = {
      cpuLoadPercentages: [
        { unixTimeMs: 1000, user: 50, system: 40 }, // 90%
        { unixTimeMs: 6000, user: 55, system: 35 }, // 90%
        { unixTimeMs: 11000, user: 50, system: 38 }, // 88%
        { unixTimeMs: 16000, user: 60, system: 30 }, // 90%
        { unixTimeMs: 21000, user: 30, system: 20 }, // 50% - drops before 60s
      ],
      memoryUsageMBs: [{ unixTimeMs: 1000, used: 1000, free: 3000 }],
      diskUsageGBs: [{ unixTimeMs: 1000, used: 20, available: 80, size: 100 }],
      stepMarkers: [],
    };

    const alerts = detectAlerts(metricsData);
    assert.strictEqual(alerts.length, 0);
  });

  it("should detect multiple alert types in same metrics", () => {
    const metricsData = {
      cpuLoadPercentages: [
        { unixTimeMs: 1000, user: 50, system: 40 }, // 90%
        { unixTimeMs: 6000, user: 55, system: 35 }, // 90%
        { unixTimeMs: 11000, user: 50, system: 38 }, // 88%
        { unixTimeMs: 16000, user: 60, system: 30 }, // 90%
        { unixTimeMs: 21000, user: 55, system: 35 }, // 90%
        { unixTimeMs: 26000, user: 52, system: 36 }, // 88%
        { unixTimeMs: 31000, user: 50, system: 40 }, // 90%
        { unixTimeMs: 36000, user: 55, system: 38 }, // 93%
        { unixTimeMs: 41000, user: 51, system: 35 }, // 86%
        { unixTimeMs: 46000, user: 52, system: 36 }, // 88%
        { unixTimeMs: 51000, user: 55, system: 35 }, // 90%
        { unixTimeMs: 56000, user: 50, system: 40 }, // 90%
        { unixTimeMs: 61000, user: 52, system: 38 }, // 90%
      ],
      memoryUsageMBs: [
        { unixTimeMs: 1000, used: 1000, free: 3000 }, // 25% - OK
        { unixTimeMs: 6000, used: 4100, free: 900 }, // 82% - Alert!
      ],
      diskUsageGBs: [
        { unixTimeMs: 1000, used: 20, available: 80, size: 100 }, // 20% - OK
        { unixTimeMs: 6000, used: 92, available: 8, size: 100 }, // 92% - Alert!
      ],
      stepMarkers: [],
    };

    const alerts = detectAlerts(metricsData);
    assert.strictEqual(alerts.length, 3);

    const memoryAlert = alerts.find((a) => a.type === "memory");
    assert.ok(memoryAlert);
    assert.strictEqual(memoryAlert.timespan, 6000);

    const cpuAlert = alerts.find((a) => a.type === "cpu");
    assert.ok(cpuAlert);
    assert.ok(cpuAlert.timespans!.length >= 12);

    const diskAlert = alerts.find((a) => a.type === "disk");
    assert.ok(diskAlert);
    assert.strictEqual(diskAlert.timespan, 6000);
  });

  it("should handle metrics without step markers", () => {
    const metricsData = {
      cpuLoadPercentages: [{ unixTimeMs: 1000, user: 50, system: 40 }],
      memoryUsageMBs: [{ unixTimeMs: 1000, used: 4100, free: 900 }], // 82%
      diskUsageGBs: [{ unixTimeMs: 1000, used: 20, available: 80, size: 100 }],
      stepMarkers: [],
    };

    const alerts = detectAlerts(metricsData);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].type, "memory");
    assert.strictEqual(alerts[0].step, undefined);
  });

  it("should only report first memory threshold violation", () => {
    const metricsData = {
      cpuLoadPercentages: [{ unixTimeMs: 1000, user: 30, system: 20 }],
      memoryUsageMBs: [
        { unixTimeMs: 1000, used: 4100, free: 900 }, // 82% - First alert
        { unixTimeMs: 6000, used: 4500, free: 500 }, // 90% - Should not create second alert
        { unixTimeMs: 11000, used: 4800, free: 200 }, // 96% - Should not create third alert
      ],
      diskUsageGBs: [{ unixTimeMs: 1000, used: 20, available: 80, size: 100 }],
      stepMarkers: [
        { unixTimeMs: 0, stepName: "Test", status: "start" },
        { unixTimeMs: 15000, stepName: "Test", status: "end" },
      ],
    };

    const alerts = detectAlerts(metricsData);
    const memoryAlerts = alerts.filter((a) => a.type === "memory");
    assert.strictEqual(memoryAlerts.length, 1);
  });

  it("should only report first disk threshold violation", () => {
    const metricsData = {
      cpuLoadPercentages: [{ unixTimeMs: 1000, user: 30, system: 20 }],
      memoryUsageMBs: [{ unixTimeMs: 1000, used: 1000, free: 3000 }],
      diskUsageGBs: [
        { unixTimeMs: 1000, used: 92, available: 8, size: 100 }, // 92% - First alert
        { unixTimeMs: 6000, used: 95, available: 5, size: 100 }, // 95% - Should not create second alert
        { unixTimeMs: 11000, used: 98, available: 2, size: 100 }, // 98% - Should not create third alert
      ],
      stepMarkers: [
        { unixTimeMs: 0, stepName: "Test", status: "start" },
        { unixTimeMs: 15000, stepName: "Test", status: "end" },
      ],
    };

    const alerts = detectAlerts(metricsData);
    const diskAlerts = alerts.filter((a) => a.type === "disk");
    assert.strictEqual(diskAlerts.length, 1);
  });
});
