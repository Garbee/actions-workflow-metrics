import { setFailed } from "@actions/core";
import { Metrics } from "./metrics.js";

async function collector(): Promise<void> {
  let metrics: Metrics | null = null;
  try {
    // Create metrics collector - it will run in background and keep data in memory
    metrics = new Metrics();

    // Keep process alive - it will be terminated by the post action
    // or when the workflow completes
    process.on("SIGTERM", () => {
      metrics?.stop();
      process.exit(0);
    });
    process.on("SIGINT", () => {
      metrics?.stop();
      process.exit(0);
    });
    process.on("beforeExit", () => {
      // Ensure state is saved before process exits
      metrics?.stop();
    });
  } catch (error) {
    setFailed(error);
    process.exit(1);
  }
}

await collector();
