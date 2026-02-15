import type { z } from "zod";
import type { stepMarkerSchema, Alert, diskUsageGBSchema } from "../lib.js";

export class Renderer {
  render(
    stepMarkers: z.TypeOf<typeof stepMarkerSchema>[] = [],
    alerts: Alert[] = [],
    cpuLoadPercentages: Array<{ unixTimeMs: number; user: number; system: number }> = [],
    memoryUsageMBs: Array<{ unixTimeMs: number; used: number; free: number }> = [],
    diskUsageGBs: z.TypeOf<typeof diskUsageGBSchema>[] = [],
    thresholds: { cpu: number; memory: number; disk: number } = { cpu: 85, memory: 80, disk: 90 },
  ): string {
    const alertsSection = this.generateAlertsSection(alerts);
    const cpuUsageSection = this.generateCPUUsageSection(cpuLoadPercentages, stepMarkers, alerts, thresholds.cpu);
    const memoryUsageSection = this.generateMemoryUsageSection(memoryUsageMBs, stepMarkers, alerts, thresholds.memory);
    const diskUsageSection = this.generateDiskUsageSection(diskUsageGBs, stepMarkers, alerts, thresholds.disk);

    return `## Workflow Metrics

${alertsSection}${cpuUsageSection}${memoryUsageSection}${diskUsageSection}`;
  }

  /**
   * Find the metric that best represents a step's execution.
   * Prefers metrics collected during the step, falls back to closest available.
   * 
   * @param strategy - 'first': earliest metric in range (default for CPU/memory)
   *                   'last': latest metric in range (better for disk, captures end state)
   */
  private findMetricForStep<T extends { unixTimeMs: number }>(
    metrics: T[],
    stepStart: number,
    stepEnd: number,
    strategy: 'first' | 'last' = 'first',
  ): T | undefined {
    if (metrics.length === 0) {
      return undefined;
    }

    // Collect all metrics within the step's time range
    const metricsInRange: T[] = [];
    for (const metric of metrics) {
      if (metric.unixTimeMs >= stepStart && metric.unixTimeMs <= stepEnd) {
        metricsInRange.push(metric);
      }
    }

    // If we found metrics within the step, return based on strategy
    if (metricsInRange.length > 0) {
      return strategy === 'last' 
        ? metricsInRange[metricsInRange.length - 1]
        : metricsInRange[0];
    }

    // If no metric falls within the step, find the closest one
    let closest = metrics[0];
    let minDistance = Math.abs(metrics[0].unixTimeMs - stepStart);

    for (const metric of metrics) {
      // Calculate distance from metric to step's midpoint
      const stepMidpoint = (stepStart + stepEnd) / 2;
      const distance = Math.abs(metric.unixTimeMs - stepMidpoint);
      
      if (distance < minDistance) {
        minDistance = distance;
        closest = metric;
      }
    }

    return closest;
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
    
    // Add rows for ALL steps, using closest metric if needed
    for (const range of stepRanges) {
      const cpu = this.findMetricForStep(cpuLoadPercentages, range.start, range.end);
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
    
    // Add rows for ALL steps, using closest metric if needed
    for (const range of stepRanges) {
      const memory = this.findMetricForStep(memoryUsageMBs, range.start, range.end);
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
    
    // Add rows for ALL steps, using last metric in range (better captures disk growth)
    for (const range of stepRanges) {
      const disk = this.findMetricForStep(diskUsageGBs, range.start, range.end, 'last');
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
