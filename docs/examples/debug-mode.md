# Debug Mode Only Example

This example shows how to enable metrics collection on demand using GitHub Actions debug mode.

## Use Case

You have a workflow that runs frequently (on every push/PR). You don't need metrics on every run, but want them available when investigating performance issues or failures—without modifying the workflow file.

## Benefits

- **Zero Performance Impact**: No overhead on regular runs
- **Always Available**: Ready to use when needed
- **No Code Changes**: Enable via UI, not by editing workflow
- **Team Friendly**: Any team member can enable it

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
  contents: read

jobs:
  test:
    name: Build and Test
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      # Conditionally start metrics collection
      - name: Start Workflow Telemetry
        if: ${{ runner.debug == '1' }}
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

## How to Enable Metrics Collection

When you need to collect metrics:

### For a Completed Run

1. Navigate to the workflow run in GitHub Actions
2. Click **"Re-run jobs"** button (top-right)
3. Check **"Enable debug logging"** checkbox
4. Click **"Re-run jobs"**

The workflow will re-execute with metrics collection enabled.

### For a New Run

You can also manually trigger a workflow with debug mode:

1. Go to Actions tab
2. Select your workflow
3. Click **"Run workflow"** button
4. The debug option may be available depending on trigger type
5. Click **"Run workflow"**

## What Happens

### Without Debug Mode (Normal Run)

```
✓ Start Workflow Telemetry (skipped)
✓ Checkout (2s)
✓ Setup Node.js (1s)
✓ Install Dependencies (15s)
✓ Build (45s)
✓ Test (30s)
```

The telemetry step is skipped, no metrics are collected, zero overhead.

### With Debug Mode Enabled

```
✓ Start Workflow Telemetry (1s)
✓ Checkout (2s)
✓ Setup Node.js (1s)
✓ Install Dependencies (15s)
✓ Build (45s)
✓ Test (30s)

📊 Job Summary includes:
- CPU Usage metrics table
- Memory Usage metrics table
- Disk Usage metrics table
- Alerts (if thresholds exceeded)
```

Telemetry step runs, metrics are collected, results appear in job summary.

## Common Scenarios

### Investigating Slow Builds

**Problem**: Build suddenly takes 5 minutes instead of 2 minutes.

**Solution**:
1. Re-run with debug mode enabled
2. Check metrics to identify which resource is constrained
3. Look for patterns:
   - CPU maxed out → Compute-bound (optimize parallelization)
   - Memory high → Memory-bound (reduce memory usage or use larger runner)
   - Disk growing → I/O-bound (optimize disk operations)

### Debugging Test Failures

**Problem**: Tests occasionally fail with timeout or out-of-memory errors.

**Solution**:
1. Re-run failing test with debug mode
2. Observe resource patterns during test execution
3. Identify if specific tests correlate with resource spikes
4. Use timestamps to pinpoint problematic test suites

### Performance Regression Analysis

**Problem**: New PR causes workflow to run slower.

**Solution**:
1. Run main branch workflow with debug mode
2. Run PR branch workflow with debug mode
3. Compare metrics between runs
4. Identify which step(s) show increased resource usage

## Advanced: Custom Thresholds with Debug Mode

You can combine debug mode with custom thresholds for sensitive monitoring:

```yaml
- name: Start Workflow Telemetry
  if: ${{ runner.debug == '1' }}
  uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "3"         # More granular when debugging
    memory_alert_threshold: "70"  # More sensitive alerts
    cpu_alert_threshold: "75"
    cpu_alert_duration: "30"
    disk_alert_threshold: "80"
```

This gives you detailed metrics and early alerts only when actively investigating issues.

## Environment Variable Alternative

If you prefer environment-based control:

```yaml
env:
  ENABLE_METRICS: "false"  # Set to "true" to enable

jobs:
  test:
    steps:
      - name: Start Workflow Telemetry
        if: ${{ env.ENABLE_METRICS == 'true' || runner.debug == '1' }}
        uses: garbee/runner-resource-usage@v1
```

This allows enabling via:
- Repository secrets/variables
- Debug mode checkbox
- Manual workflow dispatch inputs

## Best Practices

### When to Use Debug Mode

✅ **Good for**:
- Workflows that run frequently (every commit)
- Production pipelines where overhead matters
- Teams with multiple contributors who may need metrics occasionally
- Troubleshooting intermittent issues

❌ **Not ideal for**:
- Continuous performance monitoring
- Automated performance regression detection
- When you need metrics on every run

### Alternative Approaches

If you need metrics more often:

**Option 1: Always On**
```yaml
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1
```

**Option 2: Scheduled Runs Only**
```yaml
- name: Start Workflow Telemetry
  if: ${{ github.event_name == 'schedule' }}
  uses: garbee/runner-resource-usage@v1
```

**Option 3: Main Branch Only**
```yaml
- name: Start Workflow Telemetry
  if: ${{ github.ref == 'refs/heads/main' }}
  uses: garbee/runner-resource-usage@v1
```

## Troubleshooting

### Debug Mode Not Working

**Symptom**: Checked "Enable debug logging" but no metrics appear.

**Checks**:
1. Verify the `if` condition uses `runner.debug == '1'` (string comparison)
2. Look for "Start Workflow Telemetry" step in logs - is it skipped?
3. Check post-action logs for errors

**Debug**:
```yaml
- name: Check Debug Mode
  run: echo "Debug mode is ${{ runner.debug }}"

- name: Start Workflow Telemetry
  if: ${{ runner.debug == '1' }}
  uses: garbee/runner-resource-usage@v1
```

### Want Metrics Without Full Debug Logging

Debug mode enables verbose logging across all actions. If you only want metrics:

```yaml
# Use a custom workflow input instead
workflow_dispatch:
  inputs:
    enable_metrics:
      description: 'Enable resource metrics collection'
      required: false
      default: 'false'
      type: choice
      options:
        - 'true'
        - 'false'

jobs:
  test:
    steps:
      - name: Start Workflow Telemetry
        if: ${{ inputs.enable_metrics == 'true' }}
        uses: garbee/runner-resource-usage@v1
```

## Related Examples

- [Basic Monitoring](./basic-monitoring.md) - Understanding metrics output
- [Build Optimization](./build-optimization.md) - Using metrics to improve performance
- [CI/CD Pipeline](./cicd-pipeline.md) - Selective metrics in complex pipelines

## Reference

- [GitHub Actions Contexts - runner.debug](https://docs.github.com/en/actions/learn-github-actions/contexts#runner-context)
- [Enabling Debug Logging](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging)
