# Quick Reference

Fast lookup for common tasks and configurations.

## Basic Setup

### Minimal Configuration

```yaml
steps:
  - name: Start Workflow Telemetry
    uses: garbee/runner-resource-usage@v1
```

### With Custom Thresholds

```yaml
steps:
  - name: Start Workflow Telemetry
    uses: garbee/runner-resource-usage@v1
    with:
      memory_alert_threshold: "85"
      cpu_alert_threshold: "90"
      cpu_alert_duration: "120"
      disk_alert_threshold: "90"
```

### Debug Mode Only

```yaml
steps:
  - name: Start Workflow Telemetry
    if: ${{ runner.debug == '1' }}
    uses: garbee/runner-resource-usage@v1
```

## Configuration Options

| Input | Description | Default | Range |
|-------|-------------|---------|-------|
| `interval_seconds` | Collection interval | `5` | 1-300 |
| `memory_alert_threshold` | Memory alert percentage | `80` | 0-100 |
| `cpu_alert_threshold` | CPU alert percentage | `85` | 0-100 |
| `cpu_alert_duration` | CPU sustained duration (seconds) | `60` | 1-3600 |
| `disk_alert_threshold` | Disk alert percentage | `90` | 0-100 |

## Common Scenarios

### Scenario: Build Optimization

```yaml
- uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "5"
    memory_alert_threshold: "85"
    cpu_alert_threshold: "90"
    cpu_alert_duration: "120"
```

**Why**: Builds are CPU-intensive and may legitimately use high CPU for extended periods.

### Scenario: Memory-Intensive Processing

```yaml
- uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "5"
    memory_alert_threshold: "90"
    cpu_alert_threshold: "85"
```

**Why**: Data processing or ML workloads need high memory; alert only when approaching limits.

### Scenario: Long-Running Tests

```yaml
- uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "10"
    cpu_alert_duration: "300"
```

**Why**: Longer interval reduces overhead; longer duration avoids false alerts during test suites.

### Scenario: Disk-Heavy Workflows

```yaml
- uses: garbee/runner-resource-usage@v1
  with:
    disk_alert_threshold: "85"
```

**Why**: Build artifacts or Docker images can quickly consume disk space.

### Scenario: Debugging Performance Issues

```yaml
- uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "3"
    memory_alert_threshold: "70"
    cpu_alert_threshold: "75"
    cpu_alert_duration: "30"
```

**Why**: More granular data and sensitive alerts help pinpoint issues quickly.

## Alert Interpretation

### CPU Alert

> 🔥 Sustained CPU usage above 90% for more than 60 seconds (92.0%)

**Meaning**: CPU was at or above threshold for the specified duration.

**Actions**:
- Review metrics to identify which step caused high CPU
- Consider parallelization or optimization
- Evaluate if larger runner is needed

### Memory Alert

> ⚠️ Memory utilization exceeded 85% (86.8%)

**Meaning**: Memory usage reached or exceeded threshold at some point.

**Actions**:
- Check for memory leaks
- Reduce memory usage in builds/tests
- Consider larger runner if legitimately needed

### Disk Alert

> 💾 Disk usage exceeded 90% (91.2%)

**Meaning**: Disk space consumed exceeded threshold.

**Actions**:
- Clean up temporary files between steps
- Remove large artifacts after use
- Use Docker layer caching more effectively
- Consider runner with more disk space

## Threshold Selection Guide

### Conservative (Early Warning)

```yaml
memory_alert_threshold: "70"
cpu_alert_threshold: "75"
cpu_alert_duration: "30"
disk_alert_threshold: "75"
```

**Use when**: Establishing baseline, debugging issues

### Balanced (Default)

```yaml
memory_alert_threshold: "80"
cpu_alert_threshold: "85"
cpu_alert_duration: "60"
disk_alert_threshold: "90"
```

**Use when**: Normal monitoring

### Permissive (Avoid False Positives)

```yaml
memory_alert_threshold: "90"
cpu_alert_threshold: "95"
cpu_alert_duration: "180"
disk_alert_threshold: "95"
```

**Use when**: Resource-intensive workflows with known high usage

## Metric Correlation Guide

### Step 1: View Workflow Timeline

In GitHub Actions UI:
1. Open workflow run
2. Click on job name
3. Note start/end times of each step

### Step 2: Check Job Summary

Scroll to bottom of job logs to see:
- CPU Usage table
- Memory Usage table
- Disk Usage table
- Alert section (if any)

### Step 3: Match Timestamps

Compare metric timestamps with step times:

**Example**:
```
Workflow:
├─ 10:30:00 Checkout (5s)
├─ 10:30:05 Build (120s)
└─ 10:32:05 Test (60s)

Metrics:
├─ 10:30:00 CPU: 15%  → Checkout
├─ 10:30:45 CPU: 90%  → Build (peak)
└─ 10:32:15 CPU: 60%  → Test
```

### Step 4: Identify Patterns

Look for:
- **Spikes**: Sudden resource increases
- **Sustained high usage**: Extended periods near limits
- **Gradual growth**: Memory leaks or accumulation
- **Drops**: Step completion or cleanup

## Platform-Specific Notes

### Linux Runners

**Mount Point**: `/`

**Standard Setup**:
```yaml
runs-on: ubuntu-24.04
steps:
  - uses: garbee/runner-resource-usage@v1
```

**Typical Resources**:
- 2 cores, 7 GB RAM, 14 GB disk (standard)
- 4 cores, 16 GB RAM, 150 GB disk (4-core)

### macOS Runners

**Mount Point**: `/System/Volumes/Data`

**Standard Setup**:
```yaml
runs-on: macos-24
steps:
  - uses: garbee/runner-resource-usage@v1
```

**Typical Resources**:
- 3 cores, 14 GB RAM, 14 GB disk

**Note**: macOS runners have less available memory; adjust thresholds accordingly.

### Windows Runners

**Mount Point**: `C:`

**Standard Setup**:
```yaml
runs-on: windows-2025
steps:
  - uses: garbee/runner-resource-usage@v1
```

**Typical Resources**:
- 2 cores, 7 GB RAM, 14 GB disk (standard)

**Note**: Windows runners may show higher baseline memory usage due to OS overhead.

## Troubleshooting Quick Fixes

### Problem: No Metrics Appear

```yaml
# Add debug step
- name: Check State Directory
  if: always()
  run: |
    echo "State dir: $GITHUB_STATE"
    ls -la "$(dirname "$GITHUB_STATE")" || true
```

### Problem: Too Many Alerts

```yaml
# Increase thresholds
- uses: garbee/runner-resource-usage@v1
  with:
    memory_alert_threshold: "90"
    cpu_alert_threshold: "95"
```

### Problem: Missing Resource Spikes

```yaml
# Decrease interval
- uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "3"
```

### Problem: High Overhead

```yaml
# Increase interval
- uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "10"
```

## Version Pinning

### Floating Major Version (Recommended)

```yaml
uses: garbee/runner-resource-usage@v1
```

**Pros**: Automatic updates for bug fixes and features
**Cons**: May receive breaking changes within major version

### Pinned Specific Version

```yaml
uses: garbee/runner-resource-usage@v1.2.3
```

**Pros**: Guaranteed stability
**Cons**: Must manually update for fixes

### Pinned to Commit SHA

```yaml
uses: garbee/runner-resource-usage@abc123def456...
```

**Pros**: Maximum security and stability
**Cons**: No automatic updates, more maintenance

## Performance Impact

| Interval | CPU Overhead | Memory | Disk I/O | Use Case |
|----------|--------------|---------|----------|----------|
| 3s | ~1% | ~1MB | 3KB/s | Debugging |
| 5s (default) | <1% | ~1MB | 2KB/s | General use |
| 10s | <0.5% | ~500KB | 1KB/s | Long workflows |
| 30s | <0.2% | ~300KB | 0.3KB/s | Minimal overhead |

## Related Documentation

- [README](../README.md) - Main documentation
- [FAQ](./faq.md) - Frequently asked questions
- [Troubleshooting](./troubleshooting.md) - Common issues
- [Examples](./examples/) - Real-world scenarios
- [Architecture](./architecture.md) - Technical details
