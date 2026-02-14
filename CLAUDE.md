# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code).
It helps when working with code in this repository.

## Project Overview

A custom GitHub Action for workflow telemetry collection.
Periodically collects CPU load and memory usage during workflow execution.
Visualizes them as Mermaid charts and outputs to GitHub Actions summary.

## Documentation

**Important**: README.md's description (line 5) must match action.yml's `description` field.
When updating one, update the other accordingly. Note that action.yml's description should not have a trailing period.

## Development Commands

Requires Node.js 24.x.

```bash
npm ci                         # Install dependencies
npm test                       # Run all tests
```

## Architecture

### GitHub Actions Custom Action Flow

```text
1. main execution: dist/main/index.js
   └─ Spawns server as detached process and exits immediately
       └─ dist/main/server.js (runs in background)
           └─ Creates Metrics instance, collects metrics every 5 seconds
           └─ Exposes JSON API via HTTP server (localhost:7777)

2. Other workflow steps execute
   (Server continues running in background, collecting metrics every 5 seconds)

3. post execution: dist/post/index.js (after all steps complete)
   └─ Fetches metrics from server, renders Mermaid chart, outputs to summary
```

### Key Components

- **src/main/metrics.ts**: Collects CPU (user/system 0-100%) and memory (active/available in MB).
  Uses `systeminformation`. Starts collection in constructor with drift-compensated `setTimeout`.
- **src/post/renderer.ts**: Generates Mermaid stacked bar charts using template literals. Converts time series to cumulative values with `toReversed()` and `reduce()`.
- **src/lib.ts**: Zod schema for metrics validation and server port constant (7777).

### Build Process

Entry points: `src/main/index.ts`, `src/main/server.ts`, `src/post/index.ts` → bundled to `dist/`

**Critical**: dist/ directory must be committed. All dependencies are bundled into dist files.

## Writing Tests

Uses Node.js native test runner (node:test) with experimental module mocking enabled via `--experimental-test-module-mocks`. Call `mock.restoreAll()` in `beforeEach` for test isolation.

```typescript
import { describe, it, beforeEach, mock } from "node:test";
import * as assert from "node:assert/strict";

describe("MyTest", () => {
  beforeEach(() => mock.restoreAll());
  // tests...
});
```

### Mock Patterns

**Module mocking with mock.module()**: Mock ES modules before importing them:

```typescript
// Mock the module before importing
mock.module("systeminformation", {
  namedExports: {
    currentLoad: async () =>
      Promise.resolve({
        currentLoadUser: 25.5,
        currentLoadSystem: 10.3,
      }),
    mem: async () =>
      Promise.resolve({
        active: 4096 * 1024 * 1024,
        available: 8192 * 1024 * 1024,
      }),
  },
});

// Import after mocking
const { Metrics } = await import("./metrics.js");
```

**globalThis functions**: Mock using simple function assignment:

```typescript
globalThis.fetch = async (): Promise<Response> =>
  ({
    ok: true,
    json: () => Promise.resolve({}),
  }) as Response;
```

**Note**: Module mocking requires Node.js 24+ with `--experimental-test-module-mocks` flag and TypeScript execution via tsx/esm loader.

## Implementation Notes

- **Immediate async start**: `Metrics` class starts async collection in constructor without `await`.
  Uses `.catch()` for error handling.
- **Drift-compensated timers**: Uses `Math.max(0, nextUNIXTimeMs - Date.now())` for precise intervals.
- **AbortController timeout**: 10-second timeout for metrics fetch in post execution.
- **Node.js compatibility**: Uses `import.meta.url` with `dirname(fileURLToPath())`.
  Avoids Bun-specific `import.meta.dir`.
