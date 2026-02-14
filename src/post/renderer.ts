import type { z } from "zod";
import type {
  renderParamsListSchema,
  renderParamsSchema,
  metricsInfoListSchema,
  metricsInfoSchema,
} from "./lib.js";
import type { stepMarkerSchema } from "../lib.js";

export class Renderer {
  render(
    renderParamsList: z.TypeOf<typeof renderParamsListSchema>,
    metricsID: string,
    stepMarkers: z.TypeOf<typeof stepMarkerSchema>[] = [],
  ): string {
    const stepSummary = this.generateStepSummary(stepMarkers);
    return `## Workflow Metrics

### Metrics ID

${metricsID}

${stepSummary}${renderParamsList
      .filter(
        ({
          metricsInfoList,
        }: {
          metricsInfoList: z.TypeOf<typeof metricsInfoListSchema>;
        }): boolean => metricsInfoList.length > 0,
      )
      .map((p: z.TypeOf<typeof renderParamsSchema>): string => {
        const colors: string[] = p.metricsInfoList.map(
          ({ color }: { color: string }): string => color,
        );
        const stackedDatum: number[][] = p.metricsInfoList
          .toReversed()
          .reduce(
            (
              prev: number[][],
              { data }: { data: number[] },
              i: number,
            ): number[][] => {
              prev.push(
                data.map((d: number, j: number): number => d + prev[i][j]),
              );
              return prev;
            },
            [p.metricsInfoList[0].data.map((): number => 0)],
          )
          .slice(1)
          .toReversed();

        const stepAnnotations = this.generateStepAnnotations(
          stepMarkers,
          p.times,
        );
        
        // Generate X-axis labels based on step markers
        const xAxisLabels = this.generateXAxisLabels(stepMarkers, p.times);

        return `### ${p.title}

#### Legends

${p.metricsInfoList
  .map(
    (i: z.TypeOf<typeof metricsInfoSchema>): string =>
      `* $\${\\color{${i.color}} \\verb|${i.color}: ${i.name}|}$$`,
  )
  .join("\n")}

#### Chart

\`\`\`mermaid
%%{
  init: {
    "themeVariables": {
      "xyChart": {
        "plotColorPalette": "${colors.join(", ")}"
      }
    }
  }
}%%
xychart

x-axis "Workflow Steps" ${JSON.stringify(xAxisLabels)}
y-axis "${p.yAxis.title}"${p.yAxis.range ? ` ${p.yAxis.range}` : ""}
${stackedDatum.map((d: number[]): string => `bar ${JSON.stringify(d)}`).join("\n")}
\`\`\`
${stepAnnotations}`;
      })
      .join("\n\n")}`;
  }

  private generateStepSummary(
    stepMarkers: z.TypeOf<typeof stepMarkerSchema>[],
  ): string {
    if (stepMarkers.length === 0) {
      return "";
    }

    // Group markers by step name and calculate duration
    const stepMap = new Map<
      string,
      { start?: number; end?: number; duration?: number }
    >();

    for (const marker of stepMarkers) {
      if (!stepMap.has(marker.stepName)) {
        stepMap.set(marker.stepName, {});
      }
      const step = stepMap.get(marker.stepName)!;
      if (marker.status === "start") {
        step.start = marker.unixTimeMs;
      } else if (marker.status === "end") {
        step.end = marker.unixTimeMs;
      }
      if (step.start && step.end) {
        step.duration = step.end - step.start;
      }
    }

    const rows = Array.from(stepMap.entries())
      .map(([name, { start, end, duration }]) => {
        const startTime = start
          ? new Date(start).toLocaleTimeString("en-GB", { hour12: false })
          : "N/A";
        const endTime = end
          ? new Date(end).toLocaleTimeString("en-GB", { hour12: false })
          : "N/A";
        const durationStr = duration
          ? `${(duration / 1000).toFixed(1)}s`
          : "N/A";
        return `| ${name} | ${startTime} | ${endTime} | ${durationStr} |`;
      })
      .join("\n");

    return `### Workflow Steps

| Step Name | Start Time | End Time | Duration |
|-----------|------------|----------|----------|
${rows}

`;
  }

  private generateXAxisLabels(
    stepMarkers: z.TypeOf<typeof stepMarkerSchema>[],
    chartTimes: Date[],
  ): string[] {
    // Step markers are required (github-token is required)
    if (stepMarkers.length === 0) {
      throw new Error("Step markers are required for rendering. Ensure github-token is provided.");
    }

    const chartTimesMs = chartTimes.map((t) => t.getTime());
    const labels: string[] = [];

    // Create a map of time ranges for each step
    const stepRanges: { start: number; end: number; name: string }[] = [];
    const stepStarts = new Map<string, number>();
    const stepEnds = new Map<string, number>();

    for (const marker of stepMarkers) {
      if (marker.status === "start") {
        stepStarts.set(marker.stepName, marker.unixTimeMs);
      } else if (marker.status === "end") {
        stepEnds.set(marker.stepName, marker.unixTimeMs);
      }
    }

    // Build step ranges
    for (const [stepName, startTime] of stepStarts.entries()) {
      const endTime = stepEnds.get(stepName);
      if (endTime) {
        stepRanges.push({ start: startTime, end: endTime, name: stepName });
      }
    }

    // Sort step ranges by start time
    stepRanges.sort((a, b) => a.start - b.start);

    // For each chart time, find which step it belongs to
    for (const timeMs of chartTimesMs) {
      let label = "Pre-workflow";
      
      for (const range of stepRanges) {
        if (timeMs >= range.start && timeMs <= range.end) {
          label = range.name;
          break;
        } else if (timeMs > range.end) {
          label = "Post-" + range.name;
        }
      }

      labels.push(label);
    }

    return labels;
  }

  private generateStepAnnotations(
    stepMarkers: z.TypeOf<typeof stepMarkerSchema>[],
    chartTimes: Date[],
  ): string {
    if (stepMarkers.length === 0 || chartTimes.length === 0) {
      return "";
    }

    // Find step boundaries that align with chart times
    const annotations: string[] = [];
    const chartTimesMs = chartTimes.map((t) => t.getTime());

    for (const marker of stepMarkers) {
      // Find the closest chart time to this marker
      const closestIndex = chartTimesMs.reduce((prev, curr, idx) => {
        return Math.abs(curr - marker.unixTimeMs) <
          Math.abs(chartTimesMs[prev] - marker.unixTimeMs)
          ? idx
          : prev;
      }, 0);

      const timeStr = chartTimes[closestIndex].toLocaleTimeString("en-GB", {
        hour12: false,
      });
      const prefix = marker.status === "start" ? "▶" : "◼";
      annotations.push(
        `* ${prefix} **${marker.stepName}** ${marker.status} at ${timeStr}`,
      );
    }

    return `\n#### Step Timeline\n\n${annotations.join("\n")}`;
  }
}
