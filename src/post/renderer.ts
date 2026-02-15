import type { z } from "zod";
import type { Alert, diskUsageGBSchema } from "../lib.js";

export class Renderer {
  render(
    alerts: Alert[] = [],
    cpuLoadPercentages: Array<{ unixTimeMs: number; user: number; system: number }> = [],
    memoryUsageMBs: Array<{ unixTimeMs: number; used: number; free: number }> = [],
    diskUsageGBs: z.TypeOf<typeof diskUsageGBSchema>[] = [],
    thresholds: { cpu: number; memory: number; disk: number } = { cpu: 85, memory: 80, disk: 90 },
  ): string {
    const alertsSection = this.generateAlertsSection(alerts);
    const cpuUsageSection = this.generateCPUUsageSection(cpuLoadPercentages, thresholds.cpu);
    const memoryUsageSection = this.generateMemoryUsageSection(memoryUsageMBs, thresholds.memory);
    const diskUsageSection = this.generateDiskUsageSection(diskUsageGBs, thresholds.disk);

    return `## Resource Usage

${alertsSection}${cpuUsageSection}${memoryUsageSection}${diskUsageSection}`;
  }

  private formatTimestamp(unixTimeMs: number): string {
    const date = new Date(unixTimeMs);
    return date.toISOString();
  }

  private generateAlertsSection(alerts: Alert[]): string {
    if (alerts.length === 0) {
      return "";
    }

    const alertItems = alerts.map((alert) => {
      const icon = alert.type === "memory" ? "⚠️" : alert.type === "cpu" ? "🔥" : "💾";
      return `> ${icon} ${alert.message} (${alert.value.toFixed(1)}%)`;
    });

    return `### Alerts

> [!WARNING]
${alertItems.join("\n")}

`;
  }

  private generateCPUUsageSection(
    cpuLoadPercentages: Array<{ unixTimeMs: number; user: number; system: number }>,
    threshold: number,
  ): string {
    if (cpuLoadPercentages.length === 0) {
      return "";
    }

    // Generate table rows for ALL metrics
    const rows: string[] = [];
    
    for (const cpu of cpuLoadPercentages) {
      const timestamp = this.formatTimestamp(cpu.unixTimeMs);
      const total = 100;
      const used = cpu.user + cpu.system;
      const available = 100 - used;
      const availablePercent = available.toFixed(2);
      rows.push(`| ${timestamp} | ${total.toFixed(2)}% | ${used.toFixed(2)}% | ${available.toFixed(2)}% | ${availablePercent}% |`);
    }

    return `<details>
<summary><h3>CPU Usage</h3></summary>

| Timestamp | Total | Used | Available | Available % |
|-----------|-------|------|-----------|-------------|
${rows.join("\n")}

</details>

`;
  }

  private generateMemoryUsageSection(
    memoryUsageMBs: Array<{ unixTimeMs: number; used: number; free: number }>,
    threshold: number,
  ): string {
    if (memoryUsageMBs.length === 0) {
      return "";
    }

    // Generate table rows for ALL metrics
    const rows: string[] = [];
    
    for (const memory of memoryUsageMBs) {
      const timestamp = this.formatTimestamp(memory.unixTimeMs);
      const total = memory.used + memory.free;
      const availablePercent = (memory.free / total * 100).toFixed(2);
      rows.push(`| ${timestamp} | ${total.toFixed(2)} MB | ${memory.used.toFixed(2)} MB | ${memory.free.toFixed(2)} MB | ${availablePercent}% |`);
    }

    return `<details>
<summary><h3>Memory Usage</h3></summary>

| Timestamp | Total | Used | Available | Available % |
|-----------|-------|------|-----------|-------------|
${rows.join("\n")}

</details>

`;
  }

  private generateDiskUsageSection(
    diskUsageGBs: z.TypeOf<typeof diskUsageGBSchema>[],
    threshold: number,
  ): string {
    if (diskUsageGBs.length === 0) {
      return "";
    }

    // Generate table rows for ALL metrics
    const rows: string[] = [];
    
    for (const disk of diskUsageGBs) {
      const timestamp = this.formatTimestamp(disk.unixTimeMs);
      const availablePercent = (disk.available / disk.size * 100).toFixed(2);
      rows.push(`| ${timestamp} | ${disk.size.toFixed(2)} GB | ${disk.used.toFixed(2)} GB | ${disk.available.toFixed(2)} GB | ${availablePercent}% |`);
    }

    return `<details>
<summary><h3>Disk Usage</h3></summary>

| Timestamp | Total Size | Used | Available | Available % |
|-----------|------------|------|-----------|-------------|
${rows.join("\n")}

</details>

`;
  }
}
