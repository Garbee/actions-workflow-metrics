import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { Renderer } from "./renderer.ts";

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

  it("should return only header for empty metricsInfo", () => {
    const renderer: Renderer = new Renderer();

    assert.strictEqual(
      renderer.render(
        [
          {
            title: "Test",
            metricsInfoList: [],
            times: [],
            yAxis: {
              title: "Units",
            },
          },
        ],
        testMetricsID,
      ),
      `## Workflow Metrics\n\n### Metrics ID\n\n${testMetricsID}\n\n`,
    );
  });

  it("should render with single metric", () => {
    const renderer: Renderer = new Renderer();
    const result: string = renderer.render(
      [
        {
          title: "CPU Usage",
          metricsInfoList: [
            {
              color: "Red",
              name: "User CPU",
              data: [10, 20, 30],
            },
          ],
          times: [new Date("2024-01-01T00:00:00Z")],
          yAxis: {
            title: "Percentage",
            range: "0 --> 100",
          },
        },
      ],
      testMetricsID,
      defaultStepMarkers,
    );

    assert.ok(result);
    assert.ok(result.length > 0);

    // Verify title is included
    assert.ok(result.includes("### CPU Usage"));

    // Verify Mermaid block is included
    assert.ok(result.includes("```mermaid"));
    assert.ok(result.includes("xychart"));

    // Verify color palette is set correctly
    assert.ok(result.includes('"plotColorPalette": "Red"'));

    // Verify axis settings are included (now shows "Workflow Steps" instead of "Time")
    assert.ok(result.includes('x-axis "Workflow Steps"'));
    assert.ok(result.includes('y-axis "Percentage" 0 --> 100'));

    // Verify bar chart is included
    assert.ok(result.includes("bar"));

    // Verify legend is included
    assert.ok(result.includes("#### Legends"));
    assert.ok(result.includes("Red: User CPU"));
  });

  it("should render with multiple metrics", () => {
    const renderer: Renderer = new Renderer();
    const result: string = renderer.render(
      [
        {
          title: "System Metrics",
          metricsInfoList: [
            {
              color: "Red",
              name: "User CPU",
              data: [10, 20, 30],
            },
            {
              color: "Orange",
              name: "System CPU",
              data: [5, 10, 15],
            },
          ],
          times: [
            new Date("2024-01-01T00:00:00Z"),
            new Date("2024-01-01T00:00:05Z"),
            new Date("2024-01-01T00:00:10Z"),
          ],
          yAxis: {
            title: "%",
            range: "0 --> 100",
          },
        },
      ],
      testMetricsID,
      defaultStepMarkers,
    );

    assert.ok(result);
    assert.ok(result.length > 0);

    // Verify title is included
    assert.ok(result.includes("### System Metrics"));

    // Verify multiple colors are set in color palette
    assert.ok(result.includes('"plotColorPalette": "Red, Orange"'));

    // X-axis now shows step names instead of time values
    assert.ok(result.includes('x-axis "Workflow Steps"'));
    assert.ok(result.includes("Test Step"));

    // Verify axis settings are included
    assert.ok(result.includes('y-axis "%" 0 --> 100'));

    // Verify legends for both metrics are included
    assert.ok(result.includes("Red: User CPU"));
    assert.ok(result.includes("Orange: System CPU"));

    // Verify 2 bar charts are included (for stacking)
    const barMatches: RegExpMatchArray | null = result.match(/bar \[/g);
    assert.ok(barMatches !== null);
    assert.strictEqual(barMatches?.length, 2);
  });

  it("should handle yAxis without range", () => {
    const renderer: Renderer = new Renderer();
    const result: string = renderer.render(
      [
        {
          title: "Memory Usage",
          metricsInfoList: [
            {
              color: "Blue",
              name: "Used Memory",
              data: [100, 200, 300],
            },
          ],
          times: [new Date()],
          yAxis: {
            title: "MB",
          },
        },
      ],
      testMetricsID,
      defaultStepMarkers,
    );

    assert.ok(result);
    assert.ok(result.length > 0);

    // Verify title is included
    assert.ok(result.includes("### Memory Usage"));

    // Verify y-axis includes only title, not range
    assert.ok(result.includes('y-axis "MB"'));
    assert.ok(!result.includes('y-axis "MB" 0 -->'));

    // Verify legend is included
    assert.ok(result.includes("Blue: Used Memory"));
  });

  it("should correctly extract colors from metricsInfo", () => {
    const renderer: Renderer = new Renderer();
    const result: string = renderer.render(
      [
        {
          title: "Test",
          metricsInfoList: [
            {
              color: "Red",
              name: "Metric 1",
              data: [1],
            },
            {
              color: "Blue",
              name: "Metric 2",
              data: [2],
            },
            {
              color: "Green",
              name: "Metric 3",
              data: [3],
            },
          ],
          times: [new Date()],
          yAxis: {
            title: "Units",
          },
        },
      ],
      testMetricsID,
      defaultStepMarkers,
    );

    assert.ok(result);
    assert.ok(result.length > 0);

    // Verify all colors are included in color palette
    assert.ok(result.includes('"plotColorPalette": "Red, Blue, Green"'));

    // Verify each color is included in legend
    assert.ok(result.includes("Red: Metric 1"));
    assert.ok(result.includes("Blue: Metric 2"));
    assert.ok(result.includes("Green: Metric 3"));
  });

  it("should calculate stacked data correctly", () => {
    const renderer: Renderer = new Renderer();

    // Test data: two metrics with known values
    // Metric 1: [10, 20, 30]
    // Metric 2: [5, 10, 15]
    // Stacked should be:
    // - Base (Metric 1): [0, 0, 0] + [10, 20, 30] = [10, 20, 30]
    // - Stacked (Metric 2): [10, 20, 30] + [5, 10, 15] = [15, 30, 45]

    const result: string = renderer.render(
      [
        {
          title: "Stacked Test",
          metricsInfoList: [
            {
              color: "Red",
              name: "Base Metric",
              data: [10, 20, 30],
            },
            {
              color: "Blue",
              name: "Stacked Metric",
              data: [5, 10, 15],
            },
          ],
          times: [
            new Date("2024-01-01T00:00:00Z"),
            new Date("2024-01-01T00:00:05Z"),
            new Date("2024-01-01T00:00:10Z"),
          ],
          yAxis: {
            title: "Value",
          },
        },
      ],
      testMetricsID,
      defaultStepMarkers,
    );

    // The result should be a valid-rendered template
    assert.ok(result);
    assert.ok(result.length > 0);
    assert.ok(result.includes("### Stacked Test"));

    // Verify stacked data is calculated correctly
    // First bar is topmost stack (cumulative): [10+5, 20+10, 30+15] = [15, 30, 45]
    assert.ok(result.includes("bar [15,30,45]"));
    // Second bar is lower layer (Blue Metric only): [5, 10, 15]
    assert.ok(result.includes("bar [5,10,15]"));

    // Verify legends for both metrics are included
    assert.ok(result.includes("Red: Base Metric"));
    assert.ok(result.includes("Blue: Stacked Metric"));
  });

  it("should handle three or more metrics in stack", () => {
    const renderer: Renderer = new Renderer();
    const result: string = renderer.render(
      [
        {
          title: "Multi-layer Stack",
          metricsInfoList: [
            {
              color: "Red",
              name: "Layer 1",
              data: [10, 20],
            },
            {
              color: "Orange",
              name: "Layer 2",
              data: [5, 10],
            },
            {
              color: "Yellow",
              name: "Layer 3",
              data: [3, 6],
            },
          ],
          times: [
            new Date("2024-01-01T00:00:00Z"),
            new Date("2024-01-01T00:00:05Z"),
          ],
          yAxis: {
            title: "Units",
          },
        },
      ],
      testMetricsID,
      defaultStepMarkers,
    );

    assert.ok(result);
    assert.ok(result.length > 0);

    // Verify title is included
    assert.ok(result.includes("### Multi-layer Stack"));

    // Verify 3 colors are set in color palette
    assert.ok(result.includes('"plotColorPalette": "Red, Orange, Yellow"'));

    // Verify stacked data is calculated correctly
    // Layer 1: [10, 20]
    // Layer 2: [5, 10]
    // Layer 3: [3, 6]
    // Topmost stack (all layers cumulative): [3+5+10, 6+10+20] = [18, 36]
    assert.ok(result.includes("bar [18,36]"));
    // Middle stack (Layer 3 + Layer 2): [3+5, 6+10] = [8, 16]
    assert.ok(result.includes("bar [8,16]"));
    // Bottom layer (Layer 3 only): [3, 6]
    assert.ok(result.includes("bar [3,6]"));

    // Verify legends for all layers are included
    assert.ok(result.includes("Red: Layer 1"));
    assert.ok(result.includes("Orange: Layer 2"));
    assert.ok(result.includes("Yellow: Layer 3"));

    // Verify 3 bar charts are included
    const barMatches: RegExpMatchArray | null = result.match(/bar \[/g);
    assert.ok(barMatches !== null);
    assert.strictEqual(barMatches?.length, 3);
  });

  it("should throw error when no step markers provided", () => {
    const renderer: Renderer = new Renderer();
    
    // Since github-token is required, step markers should always be present
    // If they're not, it should throw an error
    assert.throws(
      () => {
        renderer.render(
          [
            {
              title: "Time Format Test",
              metricsInfoList: [
                {
                  color: "Blue",
                  name: "Test Metric",
                  data: [10, 20, 30],
                },
              ],
              times: [
                new Date("2024-01-01T09:15:30Z"),
                new Date("2024-01-01T14:30:45Z"),
                new Date("2024-01-01T23:59:59Z"),
              ],
              yAxis: {
                title: "Value",
              },
            },
          ],
          testMetricsID,
        );
      },
      {
        name: 'Error',
        message: /Step markers are required/,
      }
    );
  });

  it("should include complete Mermaid chart structure", () => {
    const renderer: Renderer = new Renderer();
    const result: string = renderer.render(
      [
        {
          title: "Structure Test",
          metricsInfoList: [
            {
              color: "Green",
              name: "Test",
              data: [100],
            },
          ],
          times: [new Date()],
          yAxis: {
            title: "Units",
            range: "0 --> 200",
          },
        },
      ],
      testMetricsID,
      defaultStepMarkers,
    );

    // Verify Mermaid block start and end are included
    assert.ok(result.includes("```mermaid"));
    assert.ok(result.includes("```"));

    // Verify theme settings are included
    assert.ok(result.includes("%%{"));
    assert.ok(result.includes('"themeVariables"'));
    assert.ok(result.includes('"xyChart"'));
    assert.ok(result.includes("}%%"));

    // Verify xychart definition is included
    assert.ok(result.includes("xychart"));

    // Verify legends section is included
    assert.ok(result.includes("#### Legends"));

    // Verify LaTeX format legend is included
    assert.ok(result.includes("$$"));
    assert.ok(result.includes("\\color{"));
    assert.ok(result.includes("\\verb|"));
  });

  it("should handle single data point", () => {
    const renderer: Renderer = new Renderer();
    const result: string = renderer.render(
      [
        {
          title: "Single Point",
          metricsInfoList: [
            {
              color: "Purple",
              name: "Single Metric",
              data: [42],
            },
          ],
          times: [new Date("2024-01-01T12:00:00Z")],
          yAxis: {
            title: "Value",
          },
        },
      ],
      testMetricsID,
      defaultStepMarkers,
    );

    assert.ok(result);
    assert.ok(result.includes("### Single Point"));
    assert.ok(result.includes("bar [42]"));
    assert.ok(result.includes("12:00:00"));
    assert.ok(result.includes("Purple: Single Metric"));
  });

  it("should render step summary when step markers are provided", () => {
    const renderer: Renderer = new Renderer();
    const result: string = renderer.render(
      [
        {
          title: "CPU Usage",
          metricsInfoList: [
            {
              color: "Red",
              name: "User CPU",
              data: [10, 20, 30],
            },
          ],
          times: [
            new Date("2024-01-01T00:00:00Z"),
            new Date("2024-01-01T00:00:05Z"),
            new Date("2024-01-01T00:00:10Z"),
          ],
          yAxis: {
            title: "Percentage",
            range: "0 --> 100",
          },
        },
      ],
      testMetricsID,
      [
        {
          unixTimeMs: new Date("2024-01-01T00:00:00Z").getTime(),
          stepName: "Build",
          status: "start" as const,
        },
        {
          unixTimeMs: new Date("2024-01-01T00:00:10Z").getTime(),
          stepName: "Build",
          status: "end" as const,
        },
      ],
    );

    assert.ok(result.includes("### Workflow Steps"));
    assert.ok(
      result.includes("| Step Name | Start Time | End Time | Duration |"),
    );
    assert.ok(result.includes("| Build |"));
    assert.ok(result.includes("10.0s"));
  });

  it("should render step timeline annotations", () => {
    const renderer: Renderer = new Renderer();
    const result: string = renderer.render(
      [
        {
          title: "CPU Usage",
          metricsInfoList: [
            {
              color: "Red",
              name: "User CPU",
              data: [10],
            },
          ],
          times: [new Date("2024-01-01T00:00:00Z")],
          yAxis: {
            title: "Percentage",
          },
        },
      ],
      testMetricsID,
      [
        {
          unixTimeMs: new Date("2024-01-01T00:00:00Z").getTime(),
          stepName: "Build",
          status: "start" as const,
        },
      ],
    );

    assert.ok(result.includes("#### Step Timeline"));
    assert.ok(result.includes("▶ **Build** start"));
  });

  it("should not render step sections when no markers provided", () => {
    const renderer: Renderer = new Renderer();
    
    // This test should now throw an error since step markers are required
    assert.throws(
      () => {
        renderer.render(
          [
            {
              title: "CPU Usage",
              metricsInfoList: [
                {
                  color: "Red",
                  name: "User CPU",
                  data: [10],
                },
              ],
              times: [new Date("2024-01-01T00:00:00Z")],
              yAxis: {
                title: "Percentage",
              },
            },
          ],
          testMetricsID,
          [],
        );
      },
      {
        name: 'Error',
        message: /Step markers are required/,
      }
    );
  });

  it("should use step names in x-axis when step markers provided", () => {
    const renderer: Renderer = new Renderer();
    const result: string = renderer.render(
      [
        {
          title: "CPU Usage",
          metricsInfoList: [
            {
              color: "Red",
              name: "User CPU",
              data: [10, 20, 30, 40],
            },
          ],
          times: [
            new Date("2024-01-01T00:00:00Z"),
            new Date("2024-01-01T00:00:05Z"),
            new Date("2024-01-01T00:00:10Z"),
            new Date("2024-01-01T00:00:15Z"),
          ],
          yAxis: {
            title: "Percentage",
          },
        },
      ],
      testMetricsID,
      [
        {
          unixTimeMs: new Date("2024-01-01T00:00:03Z").getTime(),
          stepName: "Build",
          status: "start" as const,
        },
        {
          unixTimeMs: new Date("2024-01-01T00:00:08Z").getTime(),
          stepName: "Build",
          status: "end" as const,
        },
        {
          unixTimeMs: new Date("2024-01-01T00:00:10Z").getTime(),
          stepName: "Test",
          status: "start" as const,
        },
        {
          unixTimeMs: new Date("2024-01-01T00:00:14Z").getTime(),
          stepName: "Test",
          status: "end" as const,
        },
      ],
    );

    // Verify x-axis uses "Workflow Steps"
    assert.ok(result.includes('x-axis "Workflow Steps"'));
    
    // Verify step names appear in the chart labels
    assert.ok(result.includes("Build"));
    assert.ok(result.includes("Test"));
  });
});
