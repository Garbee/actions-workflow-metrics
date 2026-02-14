# actions-workflow-metrics

A GitHub Actions for collecting system metrics during workflows and outputting Mermaid charts.

## Features

- **System Metrics Collection**: Collects CPU load and memory usage in real-time during workflow execution
- **Step-Level Visualization**: Track and visualize metrics for individual workflow steps
- **Mermaid Chart Generation**: Visualizes collected metrics as Mermaid stacked bar charts with step annotations
- **Job Summary Output**: Automatically displays charts and step timeline in GitHub Actions job summary

## Output Example

The following charts and data are output.

### CPU Loads

Stacked bar chart of system/user CPU load.

![CPU Loads](images/metrics_example_cpu.png)

### Memory Usages

Stacked bar chart of active/available memory.

![Memory Usages](images/metrics_example_memory.png)

### Artifacts

JSON data of CPU Loads and Memory Usages.

![Artifacts](images/artifact_example.png)

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
      # Run actions-workflow-metrics at the beginning of the workflow
      - name: Start Workflow Telemetry
        uses: garbee/actions-workflow-metrics@v1

      # Subsequent regular steps
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run tests
        run: npm test

      # ... other steps
```

### Advanced Usage: Step-Level Tracking

#### Option 1: Automatic Step Detection (Recommended)

Provide a GitHub token to automatically fetch step information from the GitHub API:

```yaml
- name: Start Workflow Telemetry
  uses: garbee/actions-workflow-metrics@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

This will automatically correlate metrics with workflow steps and show:

- Step summary table with start/end times and durations
- Step timeline annotations on charts

#### Option 2: Manual Step Markers

Manual step markers require direct interaction with the metrics file. This is an advanced feature for users who need precise control over step boundaries:

```yaml
- name: Start Workflow Telemetry
  uses: garbee/actions-workflow-metrics@v1

- name: Build Project
  run: |
    # Manual marking requires file manipulation - advanced users only
    # For most use cases, use automatic step detection with github-token instead
    npm run build

- name: Run Tests
  run: |
    npm test
```

> **Note**: Manual step markers in the file-based architecture require direct file manipulation. For most use cases, we recommend using **automatic step detection** (Option 1) with a GitHub token instead.

### Configuration Options

| Input              | Description                                         | Required | Default |
| ------------------ | --------------------------------------------------- | -------- | ------- |
| `interval_seconds` | Interval between metrics collection in seconds      | No       | `5`     |
| `github-token`     | GitHub token for fetching workflow step information | No       | -       |

### Execution Flow

1. **main** (workflow start): Starts metrics collection as a background process that writes to a temporary file
2. **Workflow steps**: Execute normally while metrics are collected in the background
3. **post** (workflow end): Reads collected metrics from file, fetches step information (if token provided), renders metrics as Mermaid charts with step annotations, and outputs to job summary

## Tech Stack

- **Node.js**: 24.x
- **TypeScript**: 5
- **Package Manager**: Bun
- **Key Libraries**:
  - `systeminformation`: System metrics collection
  - `zod`: Schema validation
  - `@actions/core`: GitHub Actions integration
  - `@actions/github`: GitHub API integration for step information

## Development Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Setup pre-commit (Recommended)

For security, install [pre-commit](https://pre-commit.com/). It automatically checks for credentials on commit.

```bash
# macOS
brew install pre-commit

# or using pip
pip install pre-commit

# Install pre-commit hooks
pre-commit install
```

This automatically runs gitleaks on commit.
It checks for sensitive information like API keys or tokens.

## Development Commands

```bash
# Type check + bundle (outputs to dist/ directory)
bun run build

# Run unit tests (Bun test runner)
bun test

# Code formatting (Prettier)
bun run fix
```

## Project Structure

```text
src/
├── lib.ts                 # Common schema and server settings
├── main/
│   ├── index.ts           # main entry point (server startup)
│   ├── server.ts          # Metrics collection HTTP server
│   ├── metrics.ts         # Metrics class (metrics management)
│   └── metrics.test.ts    # Metrics class tests
└── post/
    ├── index.ts           # post entry point (job summary output)
    ├── lib.ts             # Metrics fetch and rendering
    ├── lib.test.ts        # Rendering logic tests
    ├── renderer.ts        # Mermaid chart generation
    └── renderer.test.ts   # Mermaid chart generation tests
```

## Architecture

### main Execution

1. `src/main/index.ts` is executed
2. Node.js spawns `src/main/collector.ts` as a detached background process
3. `Metrics` class collects CPU/memory information every 5 seconds using `systeminformation` library
4. Metrics data is continuously written to a temporary file in the system temp directory
5. File path is unique per workflow run and job using `GITHUB_RUN_ID` and `GITHUB_JOB` environment variables

### post Execution

1. `src/post/index.ts` is executed
2. Reads metrics data from the temporary file
3. Optionally fetches workflow step information from GitHub API (if token provided)
4. Merges API-based step information with any manual markers (manual markers take precedence)
5. `Renderer` class generates Mermaid charts with step annotations
6. Outputs to job summary using `@actions/core` `summary` API, including:
   - Step summary table with durations
   - CPU and Memory charts with step timeline annotations

## License

[MIT License](LICENSE)
