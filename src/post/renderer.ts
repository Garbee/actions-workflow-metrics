import type { z } from "zod";
import type { stepMarkerSchema, Alert, diskUsageGBSchema } from "../lib.js";

export class Renderer {
  render(
    metricsID: string,
    stepMarkers: z.TypeOf<typeof stepMarkerSchema>[] = [],
    alerts: Alert[] = [],
    cpuLoadPercentages: Array<{ unixTimeMs: number; user: number; system: number }> = [],
    memoryUsageMBs: Array<{ unixTimeMs: number; used: number; free: number }> = [],
    diskUsageGBs: z.TypeOf<typeof diskUsageGBSchema>[] = [],
    thresholds: { cpu: number; memory: number; disk: number } = { cpu: 85, memory: 80, disk: 90 },
  ): string {
    const stepSummary = this.generateStepSummary(stepMarkers);
    const alertsSection = this.generateAlertsSection(alerts);
    const cpuUsageSection = this.generateCPUUsageSection(cpuLoadPercentages, stepMarkers, alerts, thresholds.cpu);
    const memoryUsageSection = this.generateMemoryUsageSection(memoryUsageMBs, stepMarkers, alerts, thresholds.memory);
    const diskUsageSection = this.generateDiskUsageSection(diskUsageGBs, stepMarkers, alerts, thresholds.disk);

    return `## Workflow Metrics

### Metrics ID

${metricsID}

${alertsSection}${stepSummary}${cpuUsageSection}${memoryUsageSection}${diskUsageSection}`;
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

  private generateAlertsSection(alerts: Alert[]): string {
    if (alerts.length === 0) {
      return "";
    }

    const alertItems = alerts.map((alert) => {
      let stepInfo = "";
      if (alert.step) {
        stepInfo = ` in step **${alert.step}**`;
      } else if (alert.steps && alert.steps.length > 0) {
        stepInfo = ` in steps: ${alert.steps.map(s => `**${s}**`).join(", ")}`;
      }

      const icon = alert.type === "memory" ? "⚠️" : alert.type === "cpu" ? "🔥" : "💾";
      return `> ${icon} ${alert.message}${stepInfo} (${alert.value.toFixed(1)}%)`;
    });

    return `### Alerts

> [!WARNING]
${alertItems.join("\n")}

`;
  }

  private generateCPUUsageSection(
    cpuLoadPercentages: Array<{ unixTimeMs: number; user: number; system: number }>,
    stepMarkers: z.TypeOf<typeof stepMarkerSchema>[],
    alerts: Alert[],
    threshold: number,
  ): string {
    if (cpuLoadPercentages.length === 0) {
      return "";
    }

    // Get initial CPU metrics
    const initialCPU = cpuLoadPercentages[0];
    
    // Create a map of step names to their CPU metrics
    const stepCPUMap = new Map<string, { unixTimeMs: number; user: number; system: number }>();
    
    // Build step ranges
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

    for (const [stepName, startTime] of stepStarts.entries()) {
      const endTime = stepEnds.get(stepName);
      if (endTime) {
        stepRanges.push({ start: startTime, end: endTime, name: stepName });
      }
    }

    // Map CPU metrics to steps
    for (const cpu of cpuLoadPercentages) {
      for (const range of stepRanges) {
        if (cpu.unixTimeMs >= range.start && cpu.unixTimeMs < range.end) {
          // Use the first metric that falls within the step
          if (!stepCPUMap.has(range.name)) {
            stepCPUMap.set(range.name, cpu);
          }
          break;
        }
      }
    }

    // Get CPU alert steps
    const cpuAlertSteps = new Set<string>();
    for (const alert of alerts) {
      if (alert.type === "cpu") {
        if (alert.steps && alert.steps.length > 0) {
          alert.steps.forEach(step => cpuAlertSteps.add(step));
        } else if (alert.step) {
          cpuAlertSteps.add(alert.step);
        }
      }
    }

    // Generate the CPU usage table
    const rows: string[] = [];
    
    // For CPU, total is always 100%, used is user+system, available is 100-(user+system)
    const initTotal = 100;
    const initUsed = initialCPU.user + initialCPU.system;
    const initAvailable = 100 - initUsed;
    const initAvailablePercent = initAvailable.toFixed(2);
    const initExceeded = initUsed > threshold ? "Yes" : "";
    rows.push(`| Initialization | ${initTotal.toFixed(2)}% | ${initUsed.toFixed(2)}% | ${initAvailable.toFixed(2)}% | ${initAvailablePercent}% | ${initExceeded} |`);
    
    // Add rows for each step that has CPU metrics
    for (const range of stepRanges) {
      const cpu = stepCPUMap.get(range.name);
      if (cpu) {
        const total = 100;
        const used = cpu.user + cpu.system;
        const available = 100 - used;
        const availablePercent = available.toFixed(2);
        const exceeded = cpuAlertSteps.has(range.name) ? "Yes" : "";
        rows.push(`| ${range.name} | ${total.toFixed(2)}% | ${used.toFixed(2)}% | ${available.toFixed(2)}% | ${availablePercent}% | ${exceeded} |`);
      }
    }

    return `### CPU Usage

| Step | Total | Used | Available | Available % | Threshold Exceeded |
|------|-------|------|-----------|-------------|-------------------|
${rows.join("\n")}

`;
  }

  private generateMemoryUsageSection(
    memoryUsageMBs: Array<{ unixTimeMs: number; used: number; free: number }>,
    stepMarkers: z.TypeOf<typeof stepMarkerSchema>[],
    alerts: Alert[],
    threshold: number,
  ): string {
    if (memoryUsageMBs.length === 0) {
      return "";
    }

    // Get initial memory metrics
    const initialMemory = memoryUsageMBs[0];
    
    // Create a map of step names to their memory metrics
    const stepMemoryMap = new Map<string, { unixTimeMs: number; used: number; free: number }>();
    
    // Build step ranges
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

    for (const [stepName, startTime] of stepStarts.entries()) {
      const endTime = stepEnds.get(stepName);
      if (endTime) {
        stepRanges.push({ start: startTime, end: endTime, name: stepName });
      }
    }

    // Map memory metrics to steps
    for (const memory of memoryUsageMBs) {
      for (const range of stepRanges) {
        if (memory.unixTimeMs >= range.start && memory.unixTimeMs < range.end) {
          // Use the first metric that falls within the step
          if (!stepMemoryMap.has(range.name)) {
            stepMemoryMap.set(range.name, memory);
          }
          break;
        }
      }
    }

    // Get memory alert step
    let memoryAlertStep: string | undefined;
    for (const alert of alerts) {
      if (alert.type === "memory" && alert.step) {
        memoryAlertStep = alert.step;
        break;
      }
    }

    // Generate the memory usage table
    const rows: string[] = [];
    
    // Add initialization row
    const initTotal = initialMemory.used + initialMemory.free;
    const initUtilization = (initialMemory.used / initTotal * 100);
    const initAvailablePercent = (initialMemory.free / initTotal * 100).toFixed(2);
    const initExceeded = initUtilization > threshold ? "Yes" : "";
    rows.push(`| Initialization | ${initTotal.toFixed(2)} MB | ${initialMemory.used.toFixed(2)} MB | ${initialMemory.free.toFixed(2)} MB | ${initAvailablePercent}% | ${initExceeded} |`);
    
    // Add rows for each step that has memory metrics
    for (const range of stepRanges) {
      const memory = stepMemoryMap.get(range.name);
      if (memory) {
        const total = memory.used + memory.free;
        const utilization = (memory.used / total * 100);
        const availablePercent = (memory.free / total * 100).toFixed(2);
        const exceeded = (memoryAlertStep === range.name) ? "Yes" : "";
        rows.push(`| ${range.name} | ${total.toFixed(2)} MB | ${memory.used.toFixed(2)} MB | ${memory.free.toFixed(2)} MB | ${availablePercent}% | ${exceeded} |`);
      }
    }

    return `### Memory Usage

| Step | Total | Used | Available | Available % | Threshold Exceeded |
|------|-------|------|-----------|-------------|-------------------|
${rows.join("\n")}

`;
  }

  private generateDiskUsageSection(
    diskUsageGBs: z.TypeOf<typeof diskUsageGBSchema>[],
    stepMarkers: z.TypeOf<typeof stepMarkerSchema>[],
    alerts: Alert[],
    threshold: number,
  ): string {
    if (diskUsageGBs.length === 0) {
      return "";
    }

    // Get initial disk metrics
    const initialDisk = diskUsageGBs[0];
    
    // Create a map of step names to their disk metrics
    const stepDiskMap = new Map<string, z.TypeOf<typeof diskUsageGBSchema>>();
    
    // Build step ranges
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

    for (const [stepName, startTime] of stepStarts.entries()) {
      const endTime = stepEnds.get(stepName);
      if (endTime) {
        stepRanges.push({ start: startTime, end: endTime, name: stepName });
      }
    }

    // Map disk metrics to steps
    for (const disk of diskUsageGBs) {
      for (const range of stepRanges) {
        if (disk.unixTimeMs >= range.start && disk.unixTimeMs < range.end) {
          // Use the first metric that falls within the step
          if (!stepDiskMap.has(range.name)) {
            stepDiskMap.set(range.name, disk);
          }
          break;
        }
      }
    }

    // Get disk alert step
    let diskAlertStep: string | undefined;
    for (const alert of alerts) {
      if (alert.type === "disk" && alert.step) {
        diskAlertStep = alert.step;
        break;
      }
    }

    // Generate the disk usage table
    const rows: string[] = [];
    
    // Add initialization row
    const initUtilization = (initialDisk.used / initialDisk.size * 100);
    const initAvailablePercent = (initialDisk.available / initialDisk.size * 100).toFixed(2);
    const initExceeded = initUtilization > threshold ? "Yes" : "";
    rows.push(`| Initialization | ${initialDisk.size.toFixed(2)} GB | ${initialDisk.used.toFixed(2)} GB | ${initialDisk.available.toFixed(2)} GB | ${initAvailablePercent}% | ${initExceeded} |`);
    
    // Add rows for each step that has disk metrics
    for (const range of stepRanges) {
      const disk = stepDiskMap.get(range.name);
      if (disk) {
        const utilization = (disk.used / disk.size * 100);
        const availablePercent = (disk.available / disk.size * 100).toFixed(2);
        const exceeded = (diskAlertStep === range.name) ? "Yes" : "";
        rows.push(`| ${range.name} | ${disk.size.toFixed(2)} GB | ${disk.used.toFixed(2)} GB | ${disk.available.toFixed(2)} GB | ${availablePercent}% | ${exceeded} |`);
      }
    }

    return `### Disk Usage

| Step | Total Size | Used | Available | Available % | Threshold Exceeded |
|------|------------|------|-----------|-------------|-------------------|
${rows.join("\n")}

`;
  }
}
