import { createServer } from "node:http";
import { setFailed } from "@actions/core";
import { Metrics } from "./metrics";
import { serverPort } from "../lib";
import type { ServerResponse, IncomingMessage } from "node:http";

async function server(): Promise<void> {
  const metrics: Metrics = new Metrics();
  const server = createServer(
    (request: IncomingMessage, response: ServerResponse) => {
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
                  if (
                    typeof stepName === "string" &&
                    (status === "start" || status === "end")
                  ) {
                    metrics.markStep(stepName, status);
                    response.statusCode = 200;
                    response.end();
                  } else {
                    response.statusCode = 400;
                    response.setHeader("Content-Type", "application/json");
                    response.end(
                      JSON.stringify({
                        error: "Invalid request body",
                      }),
                    );
                  }
                } catch (error) {
                  response.statusCode = 400;
                  response.setHeader("Content-Type", "application/json");
                  response.end(
                    JSON.stringify({
                      error: "Invalid JSON",
                    }),
                  );
                }
              });
            } else {
              response.statusCode = 405;
              response.setHeader("Content-Type", "application/json");
              response.end(
                JSON.stringify({
                  error: "Method not allowed",
                }),
              );
            }
            break;
          case "/finish":
            response.statusCode = 200;
            response.end();
            server.close(() => process.exit(0));
            break;
        }
      } catch (error) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: "Internal server error" }));
        setFailed(error);
      }
    },
  );

  server.on("error", setFailed);
  server.listen(serverPort);
}

await server();
