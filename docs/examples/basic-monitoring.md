# Basic Monitoring Example

This example shows the simplest way to add resource monitoring to your workflow.

## Use Case

You have a standard Node.js project with build and test steps. You want to understand resource consumption patterns without any complex configuration.

## Workflow Configuration

```yaml
name: CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

permissions:
  contents: read # Required to clone repository

jobs:
  test:
    name: Build and Test
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      # Start metrics collection at the very beginning
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
      
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Test
        run: npm test
```

## What You Get

After the workflow completes, check the job summary to see:

### Metrics Tables

Three collapsible sections showing timestamped data:

**CPU Usage**:
```
| Timestamp                 | Used   | Available |
|---------------------------|--------|-----------|
| 2026-02-16T10:30:00.000Z | 12.5%  | 87.5%    |
| 2026-02-16T10:30:05.000Z | 78.3%  | 21.7%    |
| 2026-02-16T10:30:10.000Z | 15.2%  | 84.8%    |
```

**Memory Usage**:
```
| Timestamp                 | Used       | Available   |
|---------------------------|------------|-------------|
| 2026-02-16T10:30:00.000Z | 512.5 MB  | 15475.5 MB |
| 2026-02-16T10:30:05.000Z | 2048.3 MB | 13939.7 MB |
| 2026-02-16T10:30:10.000Z | 1024.8 MB | 14963.2 MB |
```

**Disk Usage**:
```
| Timestamp                 | Used     | Available |
|---------------------------|----------|-----------|
| 2026-02-16T10:30:00.000Z | 45.2 GB | 98.8 GB  |
| 2026-02-16T10:30:05.000Z | 48.5 GB | 95.5 GB  |
| 2026-02-16T10:30:10.000Z | 46.1 GB | 97.9 GB  |
```

### Alerts (if thresholds exceeded)

If any resource exceeds default thresholds, you'll see alerts:

> [!WARNING]
> 🔥 Sustained CPU usage above 85% for more than 60 seconds (92.0%)

## Interpreting Results

### 1. Correlate with Workflow Steps

Match metric timestamps with your workflow run timeline:

1. Open your workflow run in GitHub Actions
2. Note the start/end times of each step
3. Compare with metric timestamps

**Example**:
- Build step: 10:30:05 - 10:30:35 → High CPU usage expected
- Test step: 10:30:40 - 10:31:10 → High CPU and memory expected
- Idle periods: Low resource usage

### 2. Identify Resource Patterns

Look for:
- **Spikes**: Sudden increases indicating intensive operations
- **Plateaus**: Sustained high usage that might indicate inefficiency
- **Drops**: Completion of resource-intensive steps
- **Baseline**: Typical "idle" usage between steps

### 3. Common Patterns

**Normal Build Pattern**:
```
Checkout:     Low CPU (5-15%), Low Memory (500-1000 MB)
Install Deps: Medium CPU (30-50%), Medium Memory (1-2 GB)
Build:        High CPU (60-90%), Medium-High Memory (2-4 GB)
Test:         High CPU (70-95%), Variable Memory (1-8 GB)
```

**Potential Issues**:
- CPU consistently > 90%: Consider optimizing or larger runner
- Memory growing continuously: Possible memory leak in build/test
- Disk usage spiking: Large artifacts or insufficient cleanup

## Next Steps

Once you understand basic metrics:

1. **Optimize**: Use insights to improve slow steps
2. **Adjust Thresholds**: Customize based on your baseline (see [Build Optimization](./build-optimization.md))
3. **Debug Mode**: Enable only when needed (see [Debug Mode Only](./debug-mode.md))
4. **Advanced Scenarios**: Explore other examples for specific use cases

## Related Examples

- [Build Optimization](./build-optimization.md) - Deep dive into improving build performance
- [Debug Mode Only](./debug-mode.md) - Collect metrics on demand
- [Test Suite Performance](./test-performance.md) - Focus on test execution
