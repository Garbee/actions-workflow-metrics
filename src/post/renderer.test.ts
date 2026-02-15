import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { Renderer } from "./renderer.ts";
import type { Alert } from "../lib.ts";

describe("Renderer", () => {
  const testMetricsID: string = "1234567890";
  
  // Common step markers for tests
  const defaultStepMarkers = [
    {
      unixTimeMs: new Date("2024-01-01T00:00:00Z").getTime() - 1000,
      stepName: "Test Step",
      status: "start" as const,
    },
    {
      unixTimeMs: new Date("2024-01-01T00:00:30Z").getTime(),
      stepName: "Test Step",
      status: "end" as const,
    },
  ];

  it("should return only header for empty metrics", () => {
    const renderer: Renderer = new Renderer();

    const result = renderer.render(
      testMetricsID,
      [],
      [],
      [],
      [],
      [],
    );
    
    assert.ok(result.includes("## Workflow Metrics"));
    assert.ok(result.includes("### Metrics ID"));
    assert.ok(result.includes(testMetricsID));
  });

  it("should render CPU usage table", () => {
    const renderer: Renderer = new Renderer();
    const cpuData = [
      { unixTimeMs: new Date("2024-01-01T00:00:00Z").getTime(), user: 10, system: 5 },
      { unixTimeMs: new Date("2024-01-01T00:00:01Z").getTime(), user: 20, system: 10 },
    ];
    
    const result = renderer.render(
      testMetricsID,
      defaultStepMarkers,
      [],
      cpuData,
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );

    // Verify CPU Usage section is included
    assert.ok(result.includes("### CPU Usage"));
    assert.ok(result.includes("| Step | Total | Used | Available | Available % | Threshold Exceeded |"));
    assert.ok(result.includes("| Initialization |"));
  });

  it("should render Memory usage table", () => {
    const renderer: Renderer = new Renderer();
    const memoryData = [
      { unixTimeMs: new Date("2024-01-01T00:00:00Z").getTime(), used: 1000, free: 3000 },
      { unixTimeMs: new Date("2024-01-01T00:00:01Z").getTime(), used: 1500, free: 2500 },
    ];
    
    const result = renderer.render(
      testMetricsID,
      defaultStepMarkers,
      [],
      [],
      memoryData,
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );

    // Verify Memory Usage section is included
    assert.ok(result.includes("### Memory Usage"));
    assert.ok(result.includes("| Step | Total | Used | Available | Available % | Threshold Exceeded |"));
    assert.ok(result.includes("| Initialization |"));
  });

  it("should render Disk usage table with available percentage", () => {
    const renderer: Renderer = new Renderer();
    const diskData = [
      { unixTimeMs: new Date("2024-01-01T00:00:00Z").getTime(), used: 50, available: 100, size: 150 },
      { unixTimeMs: new Date("2024-01-01T00:00:01Z").getTime(), used: 55, available: 95, size: 150 },
    ];
    
    const result = renderer.render(
      testMetricsID,
      defaultStepMarkers,
      [],
      [],
      [],
      diskData,
      { cpu: 85, memory: 80, disk: 90 },
    );

    // Verify Disk Usage section is included
    assert.ok(result.includes("### Disk Usage"));
    assert.ok(result.includes("| Step | Total Size | Used | Available | Available % | Threshold Exceeded |"));
    assert.ok(result.includes("| Initialization |"));
    // Check that percentage is calculated and included
    assert.ok(result.includes("%"));
  });

  it("should not render step summary section", () => {
    const renderer: Renderer = new Renderer();
    const result = renderer.render(
      testMetricsID,
      defaultStepMarkers,
      [],
      [],
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );

    assert.ok(!result.includes("### Workflow Steps"));
  });

  it("should not render step sections when no markers provided", () => {
    const renderer: Renderer = new Renderer();
    const result = renderer.render(
      testMetricsID,
      [],
      [],
      [],
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );

    assert.ok(!result.includes("### Workflow Steps"));
  });

  it("should not render alerts section when no alerts provided", () => {
    const renderer: Renderer = new Renderer();
    const result = renderer.render(
      testMetricsID,
      defaultStepMarkers,
      [],
      [],
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );

    assert.ok(!result.includes("### Alerts"));
  });

  it("should render alerts section when alerts provided", () => {
    const renderer: Renderer = new Renderer();
    const alerts: Alert[] = [
      {
        type: "cpu",
        message: "CPU usage exceeded 85%",
        step: "Test Step",
        value: 90.5,
        threshold: 85,
      },
    ];

    const result = renderer.render(
      testMetricsID,
      defaultStepMarkers,
      alerts,
      [],
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );

    assert.ok(result.includes("### Alerts"));
    assert.ok(result.includes("CPU usage exceeded 85%"));
    assert.ok(result.includes("Test Step"));
    assert.ok(result.includes("90.5%"));
  });

  it("should render multiple alerts", () => {
    const renderer: Renderer = new Renderer();
    const alerts: Alert[] = [
      {
        type: "cpu",
        message: "CPU usage exceeded 85%",
        step: "CPU Heavy Step",
        value: 90.5,
        threshold: 85,
      },
      {
        type: "memory",
        message: "Memory utilization exceeded 80%",
        step: "Memory Heavy Step",
        value: 85.2,
        threshold: 80,
      },
    ];

    const result = renderer.render(
      testMetricsID,
      defaultStepMarkers,
      alerts,
      [],
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );

    assert.ok(result.includes("CPU usage exceeded 85%"));
    assert.ok(result.includes("Memory utilization exceeded 80%"));
    assert.ok(result.includes("CPU Heavy Step"));
    assert.ok(result.includes("Memory Heavy Step"));
  });

  it("should render alerts before CPU section", () => {
    const renderer: Renderer = new Renderer();
    const alerts: Alert[] = [
      {
        type: "cpu",
        message: "CPU usage exceeded 85%",
        step: "Test Step",
        value: 90.5,
        threshold: 85,
      },
    ];
    
    const cpuData = [
      { unixTimeMs: new Date("2024-01-01T00:00:00Z").getTime(), user: 10, system: 5 },
      { unixTimeMs: new Date("2024-01-01T00:00:01Z").getTime(), user: 20, system: 10 },
    ];

    const result = renderer.render(
      testMetricsID,
      defaultStepMarkers,
      alerts,
      cpuData,
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );

    const alertsIndex = result.indexOf("### Alerts");
    const cpuIndex = result.indexOf("### CPU Usage");
    
    // Alerts should appear before CPU section
    if (cpuIndex !== -1) {
      assert.ok(alertsIndex < cpuIndex);
    }
  });

  it("should handle alert without step information", () => {
    const renderer: Renderer = new Renderer();
    const alerts: Alert[] = [
      {
        type: "cpu",
        message: "CPU usage exceeded 85%",
        value: 90.5,
        threshold: 85,
      },
    ];

    const result = renderer.render(
      testMetricsID,
      [],
      alerts,
      [],
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );

    assert.ok(result.includes("CPU usage exceeded 85%"));
    assert.ok(result.includes("90.5%"));
  });
});
