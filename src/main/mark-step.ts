#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { getMetricsFilePath, metricsDataSchema } from "../lib.js";

/**
 * Marks a workflow step in the metrics file.
 * 
 * Note: This script has a race condition with concurrent writes.
 * Manual step markers are deprecated in favor of automatic step detection
 * via GitHub API. This is provided for backward compatibility only.
 */
async function markStep(stepName: string, status: "start" | "end"): Promise<void> {
  const filePath = getMetricsFilePath();
  
  try {
    // Read current data
    const content = await readFile(filePath, "utf-8");
    const data = metricsDataSchema.parse(JSON.parse(content));
    
    // Add step marker
    data.stepMarkers.push({
      unixTimeMs: Date.now(),
      stepName,
      status,
    });
    
    // Write back
    await writeFile(filePath, JSON.stringify(data), "utf-8");
  } catch (error) {
    console.error("Failed to mark step:", error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("Usage: mark-step <step-name> <start|end>");
  process.exit(1);
}

const [stepName, status] = args;
if (status !== "start" && status !== "end") {
  console.error("Status must be 'start' or 'end'");
  process.exit(1);
}

await markStep(stepName, status);
