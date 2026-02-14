// src/main/index.ts
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getInput, info } from "@actions/core";
var __dirname = dirname(fileURLToPath(import.meta.url));
async function index() {
  const serverProcess = spawn(
    "node",
    [join(__dirname, "server.js")],
    {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        METRICS_INTERVAL_SECONDS: getInput("interval_seconds") || "5"
      }
    }
  );
  serverProcess.unref();
  info(`Server started with PID: ${serverProcess.pid}`);
}
await index();
//# sourceMappingURL=index.bundle.js.map
