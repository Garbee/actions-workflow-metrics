# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code).
It helps when working with code in this repository.

## Project Overview

A custom GitHub Action for workflow telemetry collection.
Periodically collects CPU load and memory usage during workflow execution.
Visualizes them as Mermaid charts and outputs to GitHub Actions summary.

## PR Title Format

**REQUIRED**: All PR titles MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `style`

Examples:
- `feat(metrics): add memory pressure tracking`
- `fix(collector): prevent memory leak in long-running processes`
- `docs(readme): update installation instructions`
- `chore(deps): update systeminformation to v5.22.0`

See `.github/copilot-instructions.md` for complete guidelines.

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
   └─ Spawns collector as detached process and exits immediately
       └─ dist/main/collector.js (runs in background)
           └─ Creates Metrics instance, collects metrics every 5 seconds
           └─ Writes metrics to temporary file in system temp directory

2. Other workflow steps execute
   (Collector continues running in background, writing metrics every 5 seconds)

3. post execution: dist/post/index.js (after all steps complete)
   └─ Reads metrics from temporary file, renders Mermaid chart, outputs to summary
```

### Key Components

- **src/lib.ts**: Shared utilities including `getMetricsFilePath()` which generates unique temp file paths using GITHUB_RUN_ID and GITHUB_JOB.
- **src/main/metrics.ts**: Collects CPU (user/system 0-100%) and memory (active/available in MB).
  Uses `systeminformation`. Starts collection in constructor with drift-compensated `setTimeout`. 
  Writes data to file after each collection cycle.
- **src/main/collector.ts**: Simple background process that creates a Metrics instance and keeps running.
- **src/post/renderer.ts**: Generates Mermaid stacked bar charts using template literals. Converts time series to cumulative values with `toReversed()` and `reduce()`.
- **src/post/lib.ts**: Reads metrics from file, fetches workflow steps from GitHub API, and renders charts.

### Build Process

Entry points: `src/main/index.ts`, `src/main/collector.ts`, `src/post/index.ts` → bundled to `dist/`

**Critical**: dist/ directory must be committed. All dependencies are bundled into dist files.

## Writing Tests

Uses Node.js native test runner (node:test) with experimental module mocking and timer mocking enabled via `--experimental-test-module-mocks`. Timer mocking speeds up tests from 21+ seconds to ~400ms.

```typescript
import { describe, it, beforeEach, mock } from "node:test";
import * as assert from "node:assert/strict";

describe("MyTest", () => {
  beforeEach(() => mock.restoreAll());
  // tests...
});
```

### Mock Patterns

**Timer mocking**: Enable before module import for tests involving timers:

```typescript
before(async () => {
  // Enable timer mocking BEFORE importing the module
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });

  // Mock other modules
  mockModule = mock.module("systeminformation", { /* ... */ });

  // Import after mocking
  ({ Metrics } = await import("./metrics.ts"));
});

// In tests, advance time and flush microtasks
await mock.timers.tick(5000);  // Advance time by 5 seconds
for (let i = 0; i < 5; i++) {
  await new Promise(resolve => queueMicrotask(resolve));  // Flush promises
}
```

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

**Important notes**:
- Module mocking requires Node.js 24+ with `--experimental-test-module-mocks` flag
- Timer mocking must be enabled BEFORE importing modules that use timers
- Use `queueMicrotask()` to flush promise microtasks after `tick()`
- With mocked Date, timestamps start at 0 and advance with `tick()`

## Implementation Notes

- **Immediate async start**: `Metrics` class starts async collection in constructor without `await`.
  Uses `.catch()` for error handling.
- **File-based storage**: Metrics are written to temporary file after each collection cycle. File path is unique per workflow run/job using GITHUB_RUN_ID and GITHUB_JOB.
- **Drift-compensated timers**: Uses `Math.max(0, nextUNIXTimeMs - Date.now())` for precise intervals.
- **Node.js compatibility**: Uses `import.meta.url` with `dirname(fileURLToPath())`.
  Avoids Bun-specific `import.meta.dir`.
