import type { Alert, DiskUsageGB } from "../lib.js";

export class Renderer {
  render(
    alerts: Alert[] = [],
    cpuLoadPercentages: Array<{ unixTimeMs: number; user: number; system: number }> = [],
    memoryUsageMBs: Array<{ unixTimeMs: number; used: number; free: number }> = [],
    diskUsageGBs: DiskUsageGB[] = [],
    thresholds: { cpu: number; memory: number; disk: number } = { cpu: 85, memory: 80, disk: 90 },
  ): string {
    const alertsSection = this.generateAlertsSection(alerts);
    const cpuUsageSection = this.generateCPUUsageSection(cpuLoadPercentages);
    const memoryUsageSection = this.generateMemoryUsageSection(memoryUsageMBs);
    const diskUsageSection = this.generateDiskUsageSection(diskUsageGBs);

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
  ): string {
    if (cpuLoadPercentages.length === 0) {
      return "";
    }

    // Generate table rows for ALL metrics
    const rows: string[] = [];
    
    for (const cpu of cpuLoadPercentages) {
      const timestamp = this.formatTimestamp(cpu.unixTimeMs);
      const used = cpu.user + cpu.system;
      const available = 100 - used;
      rows.push(`| ${timestamp} | ${used.toFixed(2)}% | ${available.toFixed(2)}% |`);
    }

    return `<details>
<summary><h3>CPU Usage</h3></summary>

| Timestamp | Used | Available |
|-----------|------|-----------|
${rows.join("\n")}

</details>

`;
  }

  private generateMemoryUsageSection(
    memoryUsageMBs: Array<{ unixTimeMs: number; used: number; free: number }>,
  ): string {
    if (memoryUsageMBs.length === 0) {
      return "";
    }

    // Get total from first metric (should be constant)
    const total = memoryUsageMBs[0].used + memoryUsageMBs[0].free;
    
    // Generate table rows for ALL metrics
    const rows: string[] = [];
    
    for (const memory of memoryUsageMBs) {
      const timestamp = this.formatTimestamp(memory.unixTimeMs);
      rows.push(`| ${timestamp} | ${memory.used.toFixed(2)} MB | ${memory.free.toFixed(2)} MB |`);
    }

    return `<details>
<summary><h3>Memory Usage</h3></summary>

**Total Memory:** ${total.toFixed(2)} MB

| Timestamp | Used | Available |
|-----------|------|-----------|
${rows.join("\n")}

</details>

`;
  }

  private generateDiskUsageSection(
    diskUsageGBs: DiskUsageGB[],
  ): string {
    if (diskUsageGBs.length === 0) {
      return "";
    }

    // Get total from first metric (should be constant)
    const totalSize = diskUsageGBs[0].size;
    
    // Generate table rows for ALL metrics
    const rows: string[] = [];
    
    for (const disk of diskUsageGBs) {
      const timestamp = this.formatTimestamp(disk.unixTimeMs);
      rows.push(`| ${timestamp} | ${disk.used.toFixed(2)} GB | ${disk.available.toFixed(2)} GB |`);
    }

    return `<details>
<summary><h3>Disk Usage</h3></summary>

**Total Disk Size:** ${totalSize.toFixed(2)} GB

| Timestamp | Used | Available |
|-----------|------|-----------|
${rows.join("\n")}

</details>

`;
  }
}
