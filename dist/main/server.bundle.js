// src/main/server.ts
import { createServer } from "node:http";
import { setFailed as setFailed2 } from "@actions/core";

// src/main/metrics.ts
import { setFailed } from "@actions/core";
import { currentLoad, mem } from "systeminformation";
var Metrics = class {
  constructor() {
    this.data = { cpuLoadPercentages: [], memoryUsageMBs: [], stepMarkers: [] };
    this.intervalMs = 5 * 1e3;
    const intervalSecondsInput = process.env.METRICS_INTERVAL_SECONDS;
    if (intervalSecondsInput) {
      const intervalSecondsVal = parseInt(intervalSecondsInput, 10);
      if (Number.isInteger(intervalSecondsVal)) {
        this.intervalMs = intervalSecondsVal * 1e3;
      }
    }
    this.append(Date.now()).catch(setFailed);
  }
  get() {
    return JSON.stringify(this.data);
  }
  markStep(stepName, status) {
    this.data.stepMarkers.push({
      unixTimeMs: Date.now(),
      stepName,
      status
    });
  }
  async append(unixTimeMs) {
    try {
      const {
        currentLoadUser,
        currentLoadSystem
      } = await currentLoad();
      this.data.cpuLoadPercentages.push({
        unixTimeMs,
        user: currentLoadUser,
        system: currentLoadSystem
      });
      const bytesPerMB = 1024 * 1024;
      const { active, available } = await mem();
      this.data.memoryUsageMBs.push({
        unixTimeMs,
        used: active / bytesPerMB,
        free: available / bytesPerMB
      });
    } catch (error) {
      setFailed(error);
    } finally {
      const nextUNIXTimeMs = unixTimeMs + this.intervalMs;
      setTimeout(
        () => this.append(nextUNIXTimeMs).catch(setFailed),
        Math.max(0, nextUNIXTimeMs - Date.now())
      );
    }
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

// src/main/server.ts
async function server() {
  const metrics = new Metrics();
  const server2 = createServer(
    (request, response) => {
      try {
        switch (request.url) {
          case "/metrics":
            response.setHeader("Content-Type", "application/json");
            response.setHeader("Access-Control-Allow-Origin", "*");
            response.statusCode = 200;
            response.end(metrics.get());
            break;
          case "/mark-step":
            if (request.method === "POST") {
              let body = "";
              request.on("data", (chunk) => {
                body += chunk.toString();
              });
              request.on("end", () => {
                try {
                  const { stepName, status } = JSON.parse(body);
                  if (typeof stepName === "string" && (status === "start" || status === "end")) {
                    metrics.markStep(stepName, status);
                    response.statusCode = 200;
                    response.end();
                  } else {
                    response.statusCode = 400;
                    response.setHeader("Content-Type", "application/json");
                    response.end(
                      JSON.stringify({
                        error: "Invalid request body"
                      })
                    );
                  }
                } catch (error) {
                  response.statusCode = 400;
                  response.setHeader("Content-Type", "application/json");
                  response.end(
                    JSON.stringify({
                      error: "Invalid JSON"
                    })
                  );
                }
              });
            } else {
              response.statusCode = 405;
              response.setHeader("Content-Type", "application/json");
              response.end(
                JSON.stringify({
                  error: "Method not allowed"
                })
              );
            }
            break;
          case "/finish":
            response.statusCode = 200;
            response.end();
            server2.close(() => process.exit(0));
            break;
        }
      } catch (error) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: "Internal server error" }));
        setFailed2(error);
      }
    }
  );
  server2.on("error", setFailed2);
  server2.listen(serverPort);
}
await server();
//# sourceMappingURL=server.bundle.js.map
