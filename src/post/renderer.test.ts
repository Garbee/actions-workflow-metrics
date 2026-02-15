import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { Renderer } from "./renderer.ts";

describe("Renderer", () => {
  it("should return only header for empty metrics", () => {
    const renderer = new Renderer();
    const result = renderer.render([], [], [], [], {
      cpu: 85,
      memory: 80,
      disk: 90,
    });
    assert.ok(result.includes("## Resource Usage"));
    assert.ok(!result.includes("###")); // No sections
  });

  it("should render CPU usage with collapsible details", () => {
    const renderer = new Renderer();
    const cpuData = [
      { unixTimeMs: 1000, user: 30, system: 20 },
      { unixTimeMs: 2000, user: 40, system: 25 },
    ];
    const result = renderer.render([], cpuData, [], [], {
      cpu: 85,
      memory: 80,
      disk: 90,
    });
    assert.ok(result.includes("<details>"));
    assert.ok(result.includes("<summary><h3>CPU Usage</h3></summary>"));
    assert.ok(result.includes("</details>"));
    assert.ok(result.includes("| Timestamp |"));
  });

  it("should render Memory usage with collapsible details", () => {
    const renderer = new Renderer();
    const memoryData = [
      { unixTimeMs: 1000, used: 1000, free: 3000 },
      { unixTimeMs: 2000, used: 1500, free: 2500 },
    ];
    const result = renderer.render([], [], memoryData, [], {
      cpu: 85,
      memory: 80,
      disk: 90,
    });
    assert.ok(result.includes("<details>"));
    assert.ok(result.includes("<summary><h3>Memory Usage</h3></summary>"));
    assert.ok(result.includes("</details>"));
    assert.ok(result.includes("| Timestamp |"));
  });

  it("should render Disk usage with collapsible details", () => {
    const renderer = new Renderer();
    const diskData = [
      { unixTimeMs: 1000, used: 20, available: 80, size: 100 },
      { unixTimeMs: 2000, used: 25, available: 75, size: 100 },
    ];
    const result = renderer.render([], [], [], diskData, {
      cpu: 85,
      memory: 80,
      disk: 90,
    });
    assert.ok(result.includes("<details>"));
    assert.ok(result.includes("<summary><h3>Disk Usage</h3></summary>"));
    assert.ok(result.includes("</details>"));
    assert.ok(result.includes("| Timestamp |"));
  });

  it("should not render alerts section when no alerts provided", () => {
    const renderer = new Renderer();
    const result = renderer.render(
      [],
      [{ unixTimeMs: 1000, user: 30, system: 20 }],
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );
    assert.ok(!result.includes("### Alerts"));
  });

  it("should render alerts section without timestamps", () => {
    const renderer = new Renderer();
    const alerts = [
      {
        type: "memory" as const,
        message: "Memory utilization exceeded 80%",
        timespan: 11000,
        value: 82,
        threshold: 80,
      },
    ];
    const result = renderer.render(
      alerts,
      [{ unixTimeMs: 1000, user: 30, system: 20 }],
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );
    assert.ok(result.includes("### Alerts"));
    assert.ok(result.includes("⚠️"));
    assert.ok(result.includes("Memory utilization exceeded 80%"));
    // Check that alert section doesn't contain "at" or "during" timestamp markers
    const alertsSection = result.substring(result.indexOf("### Alerts"), result.indexOf("</details>"));
    assert.ok(!alertsSection.includes(" at "));
    assert.ok(!alertsSection.includes(" during:"));
  });

  it("should render alerts without timestamp details", () => {
    const renderer = new Renderer();
    const alerts = [
      {
        type: "cpu" as const,
        message: "Sustained CPU usage above 85%",
        timespans: [1000, 6000, 11000],
        value: 90,
        threshold: 85,
      },
    ];
    const result = renderer.render(
      alerts,
      [{ unixTimeMs: 1000, user: 50, system: 40 }],
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );
    assert.ok(result.includes("### Alerts"));
    assert.ok(result.includes("🔥"));
    assert.ok(!result.includes("during:")); // No timestamp lists
  });

  it("should render multiple alerts", () => {
    const renderer = new Renderer();
    const alerts = [
      {
        type: "memory" as const,
        message: "Memory utilization exceeded 80%",
        timespan: 11000,
        value: 82,
        threshold: 80,
      },
      {
        type: "disk" as const,
        message: "Disk usage exceeded 90%",
        timespan: 6000,
        value: 92,
        threshold: 90,
      },
    ];
    const result = renderer.render(
      alerts,
      [{ unixTimeMs: 1000, user: 30, system: 20 }],
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );
    assert.ok(result.includes("⚠️"));
    assert.ok(result.includes("💾"));
    assert.ok(result.includes("Memory utilization exceeded 80%"));
    assert.ok(result.includes("Disk usage exceeded 90%"));
  });

  it("should render alerts before metric sections", () => {
    const renderer = new Renderer();
    const alerts = [
      {
        type: "memory" as const,
        message: "Memory utilization exceeded 80%",
        timespan: 11000,
        value: 82,
        threshold: 80,
      },
    ];
    const result = renderer.render(
      alerts,
      [{ unixTimeMs: 1000, user: 30, system: 20 }],
      [],
      [],
      { cpu: 85, memory: 80, disk: 90 },
    );
    const alertsIndex = result.indexOf("### Alerts");
    const cpuIndex = result.indexOf("<summary><h3>CPU Usage</h3></summary>");
    assert.ok(alertsIndex < cpuIndex);
  });
});
