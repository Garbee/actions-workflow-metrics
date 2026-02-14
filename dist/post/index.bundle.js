// src/post/index.ts
import { promises as fs } from "node:fs";
import { DefaultArtifactClient } from "@actions/artifact";
import { info, setFailed, summary } from "@actions/core";

// src/post/lib.ts
import { z as z2 } from "zod";
import { getInput } from "@actions/core";
import { context, getOctokit } from "@actions/github";

// src/post/renderer.ts
var Renderer = class {
  render(renderParamsList, metricsID, stepMarkers = []) {
    const stepSummary = this.generateStepSummary(stepMarkers);
    return `## Workflow Metrics

### Metrics ID

${metricsID}

${stepSummary}${renderParamsList.filter(
      ({
        metricsInfoList
      }) => metricsInfoList.length > 0
    ).map((p) => {
      const colors = p.metricsInfoList.map(
        ({ color }) => color
      );
      const stackedDatum = p.metricsInfoList.toReversed().reduce(
        (prev, { data }, i) => {
          prev.push(
            data.map((d, j) => d + prev[i][j])
          );
          return prev;
        },
        [p.metricsInfoList[0].data.map(() => 0)]
      ).slice(1).toReversed();
      const stepAnnotations = this.generateStepAnnotations(
        stepMarkers,
        p.times
      );
      return `### ${p.title}

#### Legends

${p.metricsInfoList.map(
        (i) => `* $\${\\color{${i.color}} \\verb|${i.color}: ${i.name}|}$$`
      ).join("\n")}

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

x-axis "Time" ${JSON.stringify(
        p.times.map(
          (d) => d.toLocaleTimeString("en-GB", { hour12: false })
        )
      )}
y-axis "${p.yAxis.title}"${p.yAxis.range ? ` ${p.yAxis.range}` : ""}
${stackedDatum.map((d) => `bar ${JSON.stringify(d)}`).join("\n")}
\`\`\`
${stepAnnotations}`;
    }).join("\n\n")}`;
  }
  generateStepSummary(stepMarkers) {
    if (stepMarkers.length === 0) {
      return "";
    }
    const stepMap = /* @__PURE__ */ new Map();
    for (const marker of stepMarkers) {
      if (!stepMap.has(marker.stepName)) {
        stepMap.set(marker.stepName, {});
      }
      const step = stepMap.get(marker.stepName);
      if (marker.status === "start") {
        step.start = marker.unixTimeMs;
      } else if (marker.status === "end") {
        step.end = marker.unixTimeMs;
      }
      if (step.start && step.end) {
        step.duration = step.end - step.start;
      }
    }
    const rows = Array.from(stepMap.entries()).map(([name, { start, end, duration }]) => {
      const startTime = start ? new Date(start).toLocaleTimeString("en-GB", { hour12: false }) : "N/A";
      const endTime = end ? new Date(end).toLocaleTimeString("en-GB", { hour12: false }) : "N/A";
      const durationStr = duration ? `${(duration / 1e3).toFixed(1)}s` : "N/A";
      return `| ${name} | ${startTime} | ${endTime} | ${durationStr} |`;
    }).join("\n");
    return `### Workflow Steps

| Step Name | Start Time | End Time | Duration |
|-----------|------------|----------|----------|
${rows}

`;
  }
  generateStepAnnotations(stepMarkers, chartTimes) {
    if (stepMarkers.length === 0) {
      return "";
    }
    const annotations = [];
    const chartTimesMs = chartTimes.map((t) => t.getTime());
    for (const marker of stepMarkers) {
      const closestIndex = chartTimesMs.reduce((prev, curr, idx) => {
        return Math.abs(curr - marker.unixTimeMs) < Math.abs(chartTimesMs[prev] - marker.unixTimeMs) ? idx : prev;
      }, 0);
      const timeStr = chartTimes[closestIndex].toLocaleTimeString("en-GB", {
        hour12: false
      });
      const prefix = marker.status === "start" ? "\u25B6" : "\u25FC";
      annotations.push(
        `* ${prefix} **${marker.stepName}** ${marker.status} at ${timeStr}`
      );
    }
    return `
#### Step Timeline

${annotations.join("\n")}`;
  }
};

// src/lib.ts
import { z } from "zod";
var cpuLoadPercentageSchema = z.object({
  unixTimeMs: z.number(),
  user: z.number().nonnegative().max(100),
  system: z.number().nonnegative().max(100)
});
var cpuLoadPercentagesSchema = z.array(cpuLoadPercentageSchema);
var memoryUsageMBSchema = z.object({
  unixTimeMs: z.number(),
  used: z.number().nonnegative(),
  free: z.number().nonnegative()
});
var memoryUsageMBsSchema = z.array(memoryUsageMBSchema);
var stepMarkerSchema = z.object({
  unixTimeMs: z.number(),
  stepName: z.string(),
  status: z.enum(["start", "end"])
});
var stepMarkersSchema = z.array(stepMarkerSchema);
var metricsDataSchema = z.object({
  cpuLoadPercentages: cpuLoadPercentagesSchema,
  memoryUsageMBs: memoryUsageMBsSchema,
  stepMarkers: stepMarkersSchema
});
var serverPort = 7777;

// src/post/lib.ts
var metricsInfoSchema = z2.object({
  color: z2.string(),
  name: z2.string(),
  data: z2.array(z2.number())
});
var metricsInfoListSchema = z2.array(metricsInfoSchema);
var renderParamsSchema = z2.object({
  title: z2.string(),
  metricsInfoList: metricsInfoListSchema,
  times: z2.array(z2.coerce.date()),
  yAxis: z2.object({
    title: z2.string(),
    range: z2.string().optional()
  })
});
var renderParamsListSchema = z2.array(renderParamsSchema);
async function getMetricsData() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10 * 1e3);
  try {
    const res = await fetch(
      `http://localhost:${serverPort}/metrics`,
      {
        signal: controller.signal
      }
    );
    if (!res.ok) {
      throw new Error(
        `Failed to fetch metrics: ${res.status} ${res.statusText}`
      );
    }
    return metricsDataSchema.parse(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
async function fetchWorkflowSteps() {
  const token = getInput("github-token");
  if (!token) {
    return [];
  }
  try {
    const octokit = getOctokit(token);
    const { owner, repo } = context.repo;
    const runId = context.runId;
    const { data: jobs } = await octokit.rest.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId
    });
    const stepMarkers = [];
    for (const job of jobs.jobs) {
      for (const step of job.steps || []) {
        if (step.started_at) {
          stepMarkers.push({
            unixTimeMs: new Date(step.started_at).getTime(),
            stepName: step.name,
            status: "start"
          });
        }
        if (step.completed_at) {
          stepMarkers.push({
            unixTimeMs: new Date(step.completed_at).getTime(),
            stepName: step.name,
            status: "end"
          });
        }
      }
    }
    return stepMarkers.sort((a, b) => a.unixTimeMs - b.unixTimeMs);
  } catch (error) {
    return [];
  }
}
function render(metricsData, metricsID) {
  const renderer = new Renderer();
  return renderer.render(
    renderParamsListSchema.parse([
      {
        title: "CPU Loads",
        metricsInfoList: [
          {
            color: "Orange",
            name: "System",
            data: metricsData.cpuLoadPercentages.map(
              ({ system }) => system
            )
          },
          {
            color: "Red",
            name: "User",
            data: metricsData.cpuLoadPercentages.map(
              ({ user }) => user
            )
          }
        ],
        times: metricsData.cpuLoadPercentages.map(
          ({ unixTimeMs }) => unixTimeMs
        ),
        yAxis: {
          title: "%",
          range: "0 --> 100"
        }
      },
      {
        title: "Memory Usages",
        metricsInfoList: [
          {
            color: "Green",
            name: "Free",
            data: metricsData.memoryUsageMBs.map(
              ({ free }) => free
            )
          },
          {
            color: "Blue",
            name: "Used",
            data: metricsData.memoryUsageMBs.map(
              ({ used }) => used
            )
          }
        ],
        times: metricsData.memoryUsageMBs.map(
          ({ unixTimeMs }) => unixTimeMs
        ),
        yAxis: {
          title: "MB"
        }
      }
    ]),
    metricsID,
    metricsData.stepMarkers
  );
}

// src/post/index.ts
async function index() {
  const maxRetryCount = 10;
  let metricsData;
  for (let i = 0; i < maxRetryCount; i++) {
    try {
      metricsData = await getMetricsData();
      break;
    } catch (error) {
      if (maxRetryCount - 2 < i || !(error instanceof TypeError) || error.message !== "fetch failed") {
        setFailed(error);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1e3));
  }
  try {
    const apiSteps = await fetchWorkflowSteps();
    if (apiSteps.length > 0 && metricsData.stepMarkers.length === 0) {
      metricsData.stepMarkers = apiSteps;
    }
    const fileBaseName = "workflow_metrics";
    const fileName = `${fileBaseName}.json`;
    await fs.writeFile(fileName, JSON.stringify(metricsData));
    let metricsID = "";
    for (let i = 0; i < maxRetryCount; i++) {
      metricsID = (/* @__PURE__ */ new Date()).getTime().toString();
      try {
        const client = new DefaultArtifactClient();
        await client.uploadArtifact(
          [fileBaseName, metricsID].join("_"),
          [fileName],
          "."
        );
        break;
      } catch (error) {
        if (maxRetryCount - 2 < i || !(error instanceof Error) || !error.message.includes(
          "Failed request: (409) Conflict: an artifact with this name already exists on the workflow run"
        )) {
          setFailed(error);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
    await summary.addRaw(render(metricsData, metricsID)).write();
  } catch (error) {
    setFailed(error);
  } finally {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      10 * 1e3
    );
    try {
      const res = await fetch(
        `http://localhost:${serverPort}/finish`,
        {
          signal: controller.signal
        }
      );
      if (res.ok) {
        info("Server finished");
      } else {
        setFailed(`Failed to finish server: ${res.status} ${res.statusText}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
await index();
//# sourceMappingURL=index.bundle.js.map
