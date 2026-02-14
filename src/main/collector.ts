import { setFailed } from "@actions/core";
import { Metrics } from "./metrics.js";

async function collector(): Promise<void> {
  try {
    // Create metrics collector - it will run in background and write to file
    new Metrics();

    // Keep process alive - it will be terminated by the post action
    // or when the workflow completes
    process.on("SIGTERM", () => {
      process.exit(0);
    });
    process.on("SIGINT", () => {
      process.exit(0);
    });
  } catch (error) {
    setFailed(error);
    process.exit(1);
  }
}

await collector();
