# runner-resource-usage

A GitHub Action for collecting system metrics during workflows.

> **Note**: This is a fork of [dev-hato/actions-workflow-metrics](https://github.com/dev-hato/actions-workflow-metrics) with improvements focused on accessibility and reliability. This fork improves accessibility by presenting data in clear tables instead of relying on Mermaid graphs to convey information. It also improves handling by not running a server in the background, making it less likely to conflict with operations under examination.

## Features

- **System Metrics Collection**: Collects CPU load, memory usage, and disk usage in real-time during workflow execution
- **Timestamp-Based Tables**: Displays all collected metrics with timestamps in clear, easy-to-read tables
- **Threshold Alerts**: Automatically detects and highlights when resource usage exceeds configurable thresholds
- **Job Summary Output**: Automatically displays tables and alerts in GitHub Actions job summary

## Why Use This Action?

GitHub Actions runners have fixed resource limits. When workflows run slow or fail unexpectedly, it's often unclear whether you're hitting CPU, memory, or disk constraints. This action gives you immediate visibility into resource usage patterns during your workflow execution.

**What you'll learn:**

- **Identify bottlenecks**: See resource consumption patterns over time during your workflow
- **Optimize efficiency**: Spot opportunities to reduce resource usage in your builds or tests
- **Make informed decisions**: Determine whether to optimize your workflow or upgrade to larger runners
- **Prevent failures**: Catch resource exhaustion before it causes workflow failures

The metrics are displayed directly in your GitHub Actions job summary—no external services or complex setup required. Your team can see the data immediately after each workflow run.

## When to Use This vs Alternatives

### Choose This Action When:

- **Your team manages the project**: The same engineers writing code are monitoring workflows
- **You need quick insights**: You want immediate feedback in GitHub Actions job summaries
- **Simplicity matters**: You prefer zero-configuration monitoring without external dependencies
- **Cost is a concern**: You want free, built-in monitoring without additional services

### Choose Alternatives When:

For comprehensive monitoring needs, consider enterprise solutions:

- **[DataDog CI Visibility](https://www.datadoghq.com/product/ci-cd-monitoring/)**: When you need centralized monitoring across multiple repositories, historical trend analysis, and correlation with production metrics
- **[OpenTelemetry](https://opentelemetry.io/)**: When you require standardized instrumentation, integration with existing observability platforms, or custom metrics collection

**If an external team monitors CI/CD performance** or **you need rich historical analysis and alerting**, these enterprise solutions are more appropriate. This action is designed for teams who want straightforward, in-context resource monitoring without the overhead of external systems.

## Output Example

The output rendered into a step summary contains the metrics collected and if any alerts were triggered those are rendered as well.

### Alerts

A line entry in the alert area is added for each resource that triggered an alert.
If no alerts were triggered, then this section is not rendered at all.

> [!WARNING]
> ⚠️ Memory utilization exceeded 85% (86.8%)
> 🔥 Sustained CPU usage above 90% for more than 10 seconds (92.0%)
> 💾 Disk usage exceeded 85% (85.2%)

#### Metrics

> [!NOTE]
> Metrics are displayed in collapsible sections.

#### CPU Usage

Shows CPU utilization over time with timestamps.

| Timestamp | Used | Available |
|-----------|------|-----------|
| 2026-02-16T11:25:30.123Z | 15.45% | 84.55% |
| 2026-02-16T11:25:35.456Z | 23.78% | 76.22% |
| 2026-02-16T11:25:40.789Z | 8.12% | 91.88% |

#### Memory Usage

Shows memory utilization over time with timestamps.

| Timestamp | Used | Available |
|-----------|------|-----------|
| 2026-02-16T11:25:30.123Z | 1024.50 MB | 14965.98 MB |
| 2026-02-16T11:25:35.456Z | 2048.75 MB | 13941.73 MB |
| 2026-02-16T11:25:40.789Z | 1536.25 MB | 14454.23 MB |

#### Disk Usage

Shows disk usage over time with timestamps.

| Timestamp | Used | Available |
|-----------|------|-----------|
| 2026-02-16T11:25:30.123Z | 57.73 GB | 86.51 GB |
| 2026-02-16T11:25:35.456Z | 62.85 GB | 81.39 GB |
| 2026-02-16T11:25:40.789Z | 58.12 GB | 86.12 GB |

## Usage

This action is designed to be executed at the **beginning** of a workflow.

### Basic Usage

```yaml
name: Example Workflow

on: [push]

jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      # Run runner-resource-usage at the beginning of the workflow
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1

      # Subsequent regular steps
      - name: Checkout
        uses: actions/checkout@v6

      - name: Run tests
        run: npm test

      # ... other steps
```

The action will automatically:

- Collect CPU load, memory usage, and disk usage metrics at regular intervals
- Display metrics with timestamps in clear tables
- Generate alerts for threshold violations

### Conditional Collection with Debug Mode

For teams that want metric collection available but not always running, you can conditionally enable the action using the `runner.debug` context. This allows you to leave the action in your workflow without incurring the performance overhead on every run.

```yaml
name: Example Workflow

on: [push]

jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      # Only collect metrics when debug mode is enabled
      - name: Start Workflow Telemetry
        if: ${{ runner.debug == '1' }}
        uses: garbee/runner-resource-usage@v1

      # Regular workflow steps
      - name: Checkout
        uses: actions/checkout@v6

      - name: Run tests
        run: npm test

      # ... other steps
```

**Enabling debug mode:**

When you need to collect metrics, enable debug mode by:

1. Go to your failed or completed workflow run
2. Click "Re-run jobs" in the top-right corner
3. Check the "Enable debug logging" checkbox
4. Click "Re-run jobs"

This approach provides several benefits:

- **No re-instrumentation needed**: The action stays in your workflow, ready to use when needed
- **Performance optimization**: Metrics collection only runs when you need it, avoiding overhead on regular runs
- **On-demand debugging**: Enable collection instantly when investigating slow builds or resource issues
- **Team flexibility**: Any team member can enable metrics collection without modifying the workflow file

The `runner.debug` context is documented in the [GitHub Actions contexts reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#runner-context).

### Configuration Options

| Input              | Description                                         | Required | Default |
| ------------------ | --------------------------------------------------- | -------- | ------- |
| `interval_seconds` | Interval between metrics collection in seconds      | No       | `5`     |
| `memory_alert_threshold` | Memory utilization threshold percentage (0-100) | No | `80` |
| `cpu_alert_threshold` | Sustained CPU usage threshold percentage (0-100) | No | `85` |
| `cpu_alert_duration` | Duration in seconds CPU must be sustained above threshold | No | `60` |
| `disk_alert_threshold` | Disk usage threshold percentage (0-100) | No | `90` |

### Execution Flow

1. **main** (workflow start): Starts metrics collection as a background process that stores metrics in memory
2. **Workflow steps**: Execute normally while metrics are collected in the background
3. **post** (workflow end): Collector saves state to GitHub Actions, post action reads metrics from state, renders metrics as tables with timestamps and threshold indicators, and outputs to job summary

> [!NOTE]
> Metrics are displayed with timestamps rather than correlated with specific workflow steps. You can manually correlate metrics with your workflow steps by matching timestamps with the execution times shown in your workflow run logs.

## Development Setup

### 1. Install Dependencies

```bash
npm ci
```

This automatically runs gitleaks on commit.
It checks for sensitive information like API keys or tokens.

## Development Commands

```bash
# Bundle for operation in a workflow
npm run build

# Run unit tests (Node test runner)
npm test
```

## Project Structure

```text
src/
├── lib.ts                 # Common schema and configuration
├── main/
│   ├── index.ts           # main entry point (collector startup)
│   ├── collector.ts       # Background metrics collection process
│   ├── metrics.ts         # Metrics class (metrics management)
│   └── metrics.test.ts    # Metrics class tests
└── post/
    ├── index.ts           # post entry point (job summary output)
    ├── lib.ts             # Metrics fetch, alert detection, and rendering
    ├── lib.test.ts        # Rendering logic tests
    ├── renderer.ts        # Table generation
    ├── renderer.test.ts   # Table generation tests
    └── alerts.test.ts     # Alert detection tests
```

## Architecture

### main Execution

1. `src/main/index.ts` is executed
2. Node.js spawns `src/main/collector.ts` as a detached background process
3. `Metrics` class collects CPU/memory/disk information every 5 seconds using `systeminformation` library
4. Metrics data is stored in memory only (no disk writes during collection)
5. On process termination (SIGTERM/SIGINT), metrics are saved to GitHub Actions state

### post Execution

1. `src/post/index.ts` is executed
2. Reads metrics data from GitHub Actions state via `getState()`
3. Fetches workflow step information from GitHub API (token required)
4. Detects threshold violations and generates alerts
5. `Renderer` class generates tables with step-by-step metrics and threshold indicators
6. Outputs to job summary using `@actions/core` `summary` API, including:
   - Alerts section for threshold violations
   - Step summary table with durations
   - CPU, Memory, and Disk usage tables with threshold exceeded indicators

## License

[MIT License](LICENSE)
