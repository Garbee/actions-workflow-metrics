# Frequently Asked Questions (FAQ)

## General Questions

### What does this action do?

This action collects system resource metrics (CPU, memory, and disk usage) throughout your workflow execution and displays them in clear tables in the job summary. It helps you identify performance bottlenecks, optimize resource usage, and prevent failures due to resource exhaustion.

### Do I need any special permissions?

No special permissions required. The action only needs `contents: read` (to clone the repository), which is typically already granted in most workflows.

### Does this work with self-hosted runners?

Yes, but self-hosted runners must have:
- Node.js 24 or later
- Access to system metrics (Linux: `/proc`, macOS/Windows: standard system utilities)
- Proper permissions for the runner process

### How much overhead does this add?

Minimal impact:
- **CPU**: < 1% typical usage
- **Memory**: ~1MB
- **Disk I/O**: Small writes every collection interval
- **Workflow Duration**: < 5 seconds added (startup + summary generation)

For most workflows, the overhead is negligible.

## Setup and Configuration

### Where should I place this action in my workflow?

Always place it as the **first step** in your job:

```yaml
steps:
  - name: Start Workflow Telemetry
    uses: garbee/runner-resource-usage@v1
  
  # All other steps follow
  - name: Checkout
    uses: actions/checkout@v4
```

This ensures metrics collection starts immediately and covers the entire workflow.

### Can I use this in multiple jobs?

Yes! Add the action to each job you want to monitor:

```yaml
jobs:
  build:
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
      # ... build steps
  
  test:
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
      # ... test steps
```

Each job will have its own metrics in its job summary.

### What collection interval should I use?

**Default (5 seconds)**: Good for most workflows
- Provides detailed visibility
- Minimal overhead
- Recommended starting point

**3 seconds**: For debugging specific issues
- More granular data
- Slightly higher overhead
- Use when investigating performance problems

**10+ seconds**: For long-running workflows
- Reduces overhead
- Less granular data
- Good for workflows > 30 minutes

```yaml
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "10"
```

### How do I adjust alert thresholds?

Set thresholds based on your workflow's normal resource usage:

```yaml
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1
  with:
    memory_alert_threshold: "85"   # Alert at 85% memory usage
    cpu_alert_threshold: "90"      # Alert at 90% CPU usage
    cpu_alert_duration: "120"      # Alert after 120 seconds of high CPU
    disk_alert_threshold: "90"     # Alert at 90% disk usage
```

**Tips**:
- Start with defaults and adjust based on actual usage
- Set thresholds 5-10% above your normal peak usage
- Use longer `cpu_alert_duration` for compile-heavy workflows

## Metrics and Interpretation

### How do I correlate metrics with workflow steps?

Metrics include ISO 8601 timestamps. To correlate:

1. Open your workflow run in GitHub Actions
2. Note the start/end times of steps in the timeline
3. Match these times with metric timestamps in the tables

**Example**:
```
Workflow Timeline:
- 10:30:00-10:30:05: Checkout
- 10:30:05-10:30:35: Build
- 10:30:35-10:31:00: Test

Metrics show high CPU at 10:30:15 → During Build step
```

### Why don't metrics show step names?

This is a deliberate design choice for simplicity and reliability:
- No external API calls required
- Works without additional permissions
- Timestamp-based correlation is straightforward
- Reduces complexity and potential failure points

### What do the alert emojis mean?

- ⚠️ **Warning sign**: Memory threshold exceeded
- 🔥 **Fire**: Sustained high CPU usage
- 💾 **Floppy disk**: Disk usage threshold exceeded

### How accurate are the metrics?

Metrics are accurate within the collection interval:
- **Collection interval**: 5 seconds (default)
- **Timestamp precision**: Milliseconds
- **Measurement accuracy**: Depends on OS utilities (systeminformation library)

Short-lived spikes between collections may be missed. Decrease interval for better granularity.

### What if I see no metrics in the summary?

Check these common causes:

1. **Action skipped**: If using `if` condition, ensure it evaluated to true
2. **Collector failed**: Check main action logs for errors
3. **Post action failed**: Check post-action logs for errors
4. **Permissions issue**: Ensure runner can write to state directory

See [Troubleshooting Guide](./troubleshooting.md#no-metrics-displayed-in-job-summary) for detailed debugging steps.

## Advanced Usage

### Can I collect metrics only sometimes?

Yes! Use conditional execution with debug mode:

```yaml
- name: Start Workflow Telemetry
  if: ${{ runner.debug == '1' }}
  uses: garbee/runner-resource-usage@v1
```

Enable by re-running the workflow with "Enable debug logging" checked.

See [Debug Mode Example](./examples/debug-mode.md) for details.

### Can I export metrics to external systems?

Not directly. The action outputs to GitHub Actions job summary only. 

To export metrics:
1. Access the state file created by the action
2. Parse the JSON data
3. Send to your monitoring system

The state file is located at:
```
$GITHUB_STATE_DIR/metrics-state-{runId}-{job}.json
```

### Can I use this with reusable workflows?

Yes! Add the action to your reusable workflow:

```yaml
# .github/workflows/reusable-build.yml
name: Reusable Build

on:
  workflow_call:

jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
      
      - name: Checkout
        uses: actions/checkout@v4
      # ... other steps
```

Call it from other workflows:

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    uses: ./.github/workflows/reusable-build.yml
```

### Can I disable specific metric types?

No, the action collects all three metrics (CPU, memory, disk). However, you can:
- Ignore specific sections in the output
- Set very high thresholds for metrics you don't care about
- Fork the action and modify it for your needs

## Troubleshooting

### The action slows down my workflow significantly

This is unexpected. Check:

1. **Collection interval**: Is it very frequent (< 3 seconds)?
   - Solution: Increase to 5+ seconds

2. **Runner resources**: Is the runner already at capacity?
   - Solution: Optimize workflow or use larger runner

3. **Disk I/O contention**: Slow disk on self-hosted runner?
   - Solution: Increase interval to reduce writes

See [Troubleshooting Guide](./troubleshooting.md#workflow-becomes-slower-after-adding-action) for details.

### I get alerts on every run

Your thresholds may be too low for your workflow's normal usage.

**Solution**: Establish a baseline first:

1. Run workflow with default settings
2. Note peak resource usage in normal runs
3. Set thresholds 5-10% above peaks

```yaml
# After observing typical peaks: CPU 75%, Memory 65%
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1
  with:
    memory_alert_threshold: "75"  # 10% above normal peak
    cpu_alert_threshold: "85"     # 10% above normal peak
```

### Metrics show unexpected patterns

**High baseline usage**: Runner may have other processes running
- Check runner system load before workflow
- Consider dedicated runners for accurate metrics

**Periodic spikes**: Normal for some operations
- Build tools often spike CPU
- Package installations spike disk I/O
- Test frameworks may spike memory

**Continuous growth**: Potential issues
- Memory leak in build/test code
- Accumulating temporary files
- Missing cleanup steps

## Comparison with Other Tools

### How does this compare to DataDog CI Visibility?

**This Action**:
- ✅ Free, built into GitHub Actions
- ✅ Zero configuration
- ✅ Immediate results in job summary
- ❌ No historical trending
- ❌ No cross-repository analysis
- ❌ Basic alerting only

**DataDog CI Visibility**:
- ✅ Rich historical analysis
- ✅ Cross-repository dashboards
- ✅ Advanced alerting and correlation
- ❌ Costs money
- ❌ Requires setup and integration
- ❌ External dependency

**Choose this action** for simple, immediate insights.
**Choose DataDog** for enterprise-wide CI/CD monitoring.

### Can I use both this action and other monitoring tools?

Absolutely! They serve complementary purposes:

```yaml
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1

- name: DataDog CI Setup
  uses: datadog/ci-action@v1
  # ... DataDog configuration
```

Use this action for immediate insights, external tools for long-term analysis.

## Contributing and Support

### How do I report a bug?

1. Check [existing issues](https://github.com/Garbee/runner-resource-usage/issues)
2. Create a new issue with:
   - Workflow configuration
   - Runner OS and version
   - Complete error messages
   - Steps to reproduce

### How do I request a feature?

Open an issue describing:
- The use case
- Expected behavior
- Why existing features don't suffice

### Can I contribute?

Yes! Pull requests are welcome. See [CONTRIBUTING.md](../CONTRIBUTING.md) if available, or open an issue to discuss your idea first.

## Related Resources

- [README](../README.md) - Main documentation
- [Architecture](./architecture.md) - Technical details
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
- [Examples](./examples/) - Real-world usage scenarios
