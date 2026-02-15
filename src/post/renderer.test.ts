import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { Renderer } from "./renderer.ts";
import type { Alert } from "../lib.ts";

describe("Renderer", () => {
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
      [],
      [],
      [],
      [],
      [],
    );
    
    assert.ok(result.includes("## Workflow Metrics"));
    assert.ok(!result.includes("### Metrics ID"));
  });

  it("should render CPU usage table", () => {
    const renderer: Renderer = new Renderer();
    const cpuData = [
      { unixTimeMs: new Date("2024-01-01T00:00:00Z").getTime(), user: 10, system: 5 },
      { unixTimeMs: new Date("2024-01-01T00:00:01Z").getTime(), user: 20, system: 10 },
    ];
    
    const result = renderer.render(
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

  describe("findMetricForStep behavior", () => {
    it("should return first metric when multiple metrics are within step range", () => {
      const renderer: Renderer = new Renderer();
      const stepMarkers = [
        {
          unixTimeMs: 1000,
          stepName: "Test Step",
          status: "start" as const,
        },
        {
          unixTimeMs: 5000,
          stepName: "Test Step",
          status: "end" as const,
        },
      ];

      // Metrics at 1500, 2000, 3000, 4000 - all within step range [1000, 5000]
      const cpuData = [
        { unixTimeMs: 1500, user: 10, system: 5 },
        { unixTimeMs: 2000, user: 20, system: 10 },
        { unixTimeMs: 3000, user: 30, system: 15 },
        { unixTimeMs: 4000, user: 40, system: 20 },
      ];

      const result = renderer.render(
        stepMarkers,
        [],
        cpuData,
        [],
        [],
        { cpu: 85, memory: 80, disk: 90 },
      );

      // For CPU (uses 'first' strategy), should show first metric (10 + 5 = 15%)
      assert.ok(result.includes("### CPU Usage"));
      assert.ok(result.includes("| Test Step |"));
      assert.ok(result.includes("15.00%")); // First metric: 10 + 5 = 15%
    });

    it("should return last metric for disk when multiple metrics are within step range", () => {
      const renderer: Renderer = new Renderer();
      const stepMarkers = [
        {
          unixTimeMs: 1000,
          stepName: "Test Step",
          status: "start" as const,
        },
        {
          unixTimeMs: 5000,
          stepName: "Test Step",
          status: "end" as const,
        },
      ];

      // Disk metrics at different times, all within step range
      const diskData = [
        { unixTimeMs: 1500, used: 50, available: 100, size: 150 },
        { unixTimeMs: 2000, used: 55, available: 95, size: 150 },
        { unixTimeMs: 3000, used: 60, available: 90, size: 150 },
        { unixTimeMs: 4000, used: 65, available: 85, size: 150 }, // Last one
      ];

      const result = renderer.render(
        stepMarkers,
        [],
        [],
        [],
        diskData,
        { cpu: 85, memory: 80, disk: 90 },
      );

      // For Disk (uses 'last' strategy), should show last metric
      assert.ok(result.includes("### Disk Usage"));
      assert.ok(result.includes("| Test Step |"));
      assert.ok(result.includes("65.00 GB")); // Last metric: 65 GB used
      assert.ok(result.includes("85.00 GB")); // Last metric: 85 GB available
    });

    it("should fallback to closest metric when no metrics fall within step range", () => {
      const renderer: Renderer = new Renderer();
      const stepMarkers = [
        {
          unixTimeMs: 10000,
          stepName: "Test Step",
          status: "start" as const,
        },
        {
          unixTimeMs: 12000,
          stepName: "Test Step",
          status: "end" as const,
        },
      ];

      // Metrics before (5000) and after (15000) the step, none within [10000, 12000]
      // Step midpoint is 11000
      // Distance from 5000 to 11000 = 6000
      // Distance from 15000 to 11000 = 4000 (closer!)
      const cpuData = [
        { unixTimeMs: 5000, user: 10, system: 5 },
        { unixTimeMs: 15000, user: 20, system: 10 },
      ];

      const result = renderer.render(
        stepMarkers,
        [],
        cpuData,
        [],
        [],
        { cpu: 85, memory: 80, disk: 90 },
      );

      // Should use the metric at 15000 (closer to midpoint)
      assert.ok(result.includes("### CPU Usage"));
      assert.ok(result.includes("| Test Step |"));
      assert.ok(result.includes("30.00%")); // Second metric: 20 + 10 = 30%
    });

    it("should handle empty metrics array", () => {
      const renderer: Renderer = new Renderer();
      const stepMarkers = [
        {
          unixTimeMs: 1000,
          stepName: "Test Step",
          status: "start" as const,
        },
        {
          unixTimeMs: 5000,
          stepName: "Test Step",
          status: "end" as const,
        },
      ];

      // Empty CPU data
      const result = renderer.render(
        stepMarkers,
        [],
        [],
        [],
        [],
        { cpu: 85, memory: 80, disk: 90 },
      );

      // Should not render CPU section when no metrics available
      assert.ok(!result.includes("### CPU Usage"));
      assert.ok(!result.includes("| Test Step |"));
    });

    it("should handle single metric", () => {
      const renderer: Renderer = new Renderer();
      const stepMarkers = [
        {
          unixTimeMs: 1000,
          stepName: "Test Step",
          status: "start" as const,
        },
        {
          unixTimeMs: 5000,
          stepName: "Test Step",
          status: "end" as const,
        },
      ];

      // Single metric outside step range
      const cpuData = [
        { unixTimeMs: 10000, user: 25, system: 15 },
      ];

      const result = renderer.render(
        stepMarkers,
        [],
        cpuData,
        [],
        [],
        { cpu: 85, memory: 80, disk: 90 },
      );

      // Should use the only available metric as fallback
      assert.ok(result.includes("### CPU Usage"));
      assert.ok(result.includes("| Test Step |"));
      assert.ok(result.includes("40.00%")); // 25 + 15 = 40%
    });

    it("should correctly identify closest metric among multiple options", () => {
      const renderer: Renderer = new Renderer();
      const stepMarkers = [
        {
          unixTimeMs: 10000,
          stepName: "Test Step",
          status: "start" as const,
        },
        {
          unixTimeMs: 14000,
          stepName: "Test Step",
          status: "end" as const,
        },
      ];

      // Step midpoint is 12000
      // Metrics at: 5000 (distance: 7000), 8000 (distance: 4000), 
      //             16000 (distance: 4000), 20000 (distance: 8000)
      // Should pick 8000 or 16000 (both equidistant), likely 8000 (first encountered)
      const memoryData = [
        { unixTimeMs: 5000, used: 1000, free: 3000 },
        { unixTimeMs: 8000, used: 2000, free: 2000 }, // Distance 4000
        { unixTimeMs: 16000, used: 3000, free: 1000 }, // Distance 4000
        { unixTimeMs: 20000, used: 4000, free: 0 },
      ];

      const result = renderer.render(
        stepMarkers,
        [],
        [],
        memoryData,
        [],
        { cpu: 85, memory: 80, disk: 90 },
      );

      // Should use the first equally-close metric at 8000
      assert.ok(result.includes("### Memory Usage"));
      assert.ok(result.includes("| Test Step |"));
      assert.ok(result.includes("2000.00 MB")); // Metric at 8000: 2000 MB used
    });

    it("should handle metrics at step boundaries", () => {
      const renderer: Renderer = new Renderer();
      const stepMarkers = [
        {
          unixTimeMs: 1000,
          stepName: "Test Step",
          status: "start" as const,
        },
        {
          unixTimeMs: 5000,
          stepName: "Test Step",
          status: "end" as const,
        },
      ];

      // Metrics exactly at step start and end boundaries
      const cpuData = [
        { unixTimeMs: 1000, user: 10, system: 5 }, // At start
        { unixTimeMs: 5000, user: 20, system: 10 }, // At end
      ];

      const result = renderer.render(
        stepMarkers,
        [],
        cpuData,
        [],
        [],
        { cpu: 85, memory: 80, disk: 90 },
      );

      // Should include both metrics as they're within range (inclusive)
      // 'first' strategy should return the one at step start
      assert.ok(result.includes("### CPU Usage"));
      assert.ok(result.includes("| Test Step |"));
      assert.ok(result.includes("15.00%")); // First metric: 10 + 5 = 15%
    });

    it("should order steps chronologically by start time", () => {
      const renderer: Renderer = new Renderer();
      
      // Steps with non-sequential start times (simulating interleaved jobs)
      const stepMarkers = [
        { unixTimeMs: 1000, stepName: "Step A", status: "start" as const },
        { unixTimeMs: 3000, stepName: "Step A", status: "end" as const },
        { unixTimeMs: 2000, stepName: "Step C", status: "start" as const },
        { unixTimeMs: 5000, stepName: "Step C", status: "end" as const },
        { unixTimeMs: 500, stepName: "Step B", status: "start" as const },
        { unixTimeMs: 1500, stepName: "Step B", status: "end" as const },
      ];

      // Metrics for all steps
      const cpuData = [
        { unixTimeMs: 600, user: 5, system: 5 },   // For Step B
        { unixTimeMs: 1100, user: 10, system: 10 }, // For Step A
        { unixTimeMs: 2100, user: 15, system: 15 }, // For Step C
      ];

      const result = renderer.render(
        stepMarkers,
        [],
        cpuData,
        [],
        [],
        { cpu: 85, memory: 80, disk: 90 },
      );

      // Steps should appear in chronological order: B (500), A (1000), C (2000)
      const cpuSection = result.split("### CPU Usage")[1].split("###")[0];
      const stepBIndex = cpuSection.indexOf("| Step B |");
      const stepAIndex = cpuSection.indexOf("| Step A |");
      const stepCIndex = cpuSection.indexOf("| Step C |");

      assert.ok(stepBIndex > 0, "Step B should appear");
      assert.ok(stepAIndex > 0, "Step A should appear");
      assert.ok(stepCIndex > 0, "Step C should appear");
      assert.ok(stepBIndex < stepAIndex, "Step B should appear before Step A");
      assert.ok(stepAIndex < stepCIndex, "Step A should appear before Step C");
    });
  });
});
