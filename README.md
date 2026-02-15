# actions-workflow-metrics

A GitHub Action for collecting system metrics during workflows.

> **Note**: This is a fork of [dev-hato/actions-workflow-metrics](https://github.com/dev-hato/actions-workflow-metrics) with improvements focused on accessibility and reliability. This fork improves accessibility by presenting data in clear tables instead of relying on Mermaid graphs to convey information. It also improves handling by not running a server in the background, making it less likely to conflict with operations under examination.

## Features

- **System Metrics Collection**: Collects CPU load, memory usage, and disk usage in real-time during workflow execution
- **Step-Level Visualization**: Track and visualize metrics for individual workflow steps
- **Table Display**: Displays collected metrics as clear, easy-to-read tables with step-by-step breakdown
- **Threshold Alerts**: Automatically detects and highlights when resource usage exceeds configurable thresholds
- **Job Summary Output**: Automatically displays tables and alerts in GitHub Actions job summary

## Why Use This Action?

GitHub Actions runners have fixed resource limits. When workflows run slow or fail unexpectedly, it's often unclear whether you're hitting CPU, memory, or disk constraints. This action gives you immediate visibility into resource usage patterns during your workflow execution.

**What you'll learn:**

- **Identify bottlenecks**: See which steps consume the most CPU, memory, or disk space
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

The action outputs the following tables:

### CPU Usage

Shows CPU utilization for each workflow step with threshold exceeded indicators.

| Step | Total | Used | Available | Available % | Threshold Exceeded |
|------|-------|------|-----------|-------------|-------------------|
| Initialization | 100.00% | 3.22% | 96.78% | 96.78% |  |
| CPU and Storage Intensive Activity | 100.00% | 3.22% | 96.78% | 96.78% | Yes |
| Memory Intensive Activity | 100.00% | 27.00% | 73.00% | 73.00% | Yes |

### Memory Usage

Shows memory utilization for each workflow step with threshold exceeded indicators.

| Step | Total | Used | Available | Available % | Threshold Exceeded |
|------|-------|------|-----------|-------------|-------------------|
| Initialization | 15990.48 MB | 917.74 MB | 15072.74 MB | 94.26% | Yes |
| CPU and Storage Intensive Activity | 15990.48 MB | 917.74 MB | 15072.74 MB | 94.26% | Yes |
| Memory Intensive Activity | 15990.48 MB | 5064.51 MB | 10925.97 MB | 68.33% |  |

### Disk Usage

Shows disk usage for each workflow step with threshold exceeded indicators.

| Step | Total Size | Used | Available | Available % | Threshold Exceeded |
|------|------------|------|-----------|-------------|-------------------|
| Initialization | 144.26 GB | 57.73 GB | 86.51 GB | 59.97% | Yes |
| CPU and Storage Intensive Activity | 144.26 GB | 57.73 GB | 86.51 GB | 59.97% | Yes |
| Memory Intensive Activity | 144.26 GB | 52.81 GB | 91.43 GB | 63.38% |  |

## Usage

This action is designed to be executed at the **beginning** of a workflow.

### Basic Usage

A GitHub token is required to automatically track workflow steps and correlate metrics with each step.

```yaml
name: Example Workflow

on: [push]

jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      # Run actions-workflow-metrics at the beginning of the workflow
      - name: Start Workflow Telemetry
        uses: garbee/actions-workflow-metrics@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}

      # Subsequent regular steps
      - name: Checkout
        uses: actions/checkout@v6

      - name: Run tests
        run: npm test

      # ... other steps
```

The action will automatically:

- Collect CPU load, memory usage, and disk usage metrics
- Fetch workflow step information from the GitHub API
- Correlate metrics with workflow steps
- Generate step summary table with start/end times and durations
- Display metrics in clear tables with threshold exceeded indicators
- Generate alerts for threshold violations

### Configuration Options

| Input              | Description                                         | Required | Default |
| ------------------ | --------------------------------------------------- | -------- | ------- |
| `interval_seconds` | Interval between metrics collection in seconds      | No       | `5`     |
| `github-token`     | GitHub token for fetching workflow step information | Yes      | -       |
| `memory_alert_threshold` | Memory utilization threshold percentage (0-100) | No | `80` |
| `cpu_alert_threshold` | Sustained CPU usage threshold percentage (0-100) | No | `85` |
| `cpu_alert_duration` | Duration in seconds CPU must be sustained above threshold | No | `60` |
| `disk_alert_threshold` | Disk usage threshold percentage (0-100) | No | `90` |

### Execution Flow

1. **main** (workflow start): Starts metrics collection as a background process that stores metrics in memory
2. **Workflow steps**: Execute normally while metrics are collected in the background
3. **post** (workflow end): Collector saves state to GitHub Actions, post action reads metrics from state, fetches step information (if token provided), renders metrics as tables with threshold indicators, and outputs to job summary

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
