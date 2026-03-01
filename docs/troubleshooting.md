# Troubleshooting Guide

This guide helps you resolve common issues when using the runner-resource-usage action.

## Common Issues

### No Metrics Displayed in Job Summary

**Symptom**: The action runs successfully, but no metrics appear in the job summary.

**Possible Causes and Solutions**:

1. **Collector process terminated prematurely**
   - Check if your workflow has resource constraints or timeout issues
   - Verify that the collector process has permission to write to the state directory
   - Look for error messages in the action logs

2. **State file not persisted**
   - Ensure the `GITHUB_STATE` environment variable is set (GitHub Actions provides this automatically)
   - Check that the runner has write permissions to the state directory
   - Review action logs for file I/O errors

3. **Post action failed**
   - Check the post-action logs for error messages
   - Ensure metrics were collected (check main action logs)
   - Verify the state file exists and contains valid JSON data

**Debug Steps**:
```yaml
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1
  
# Add this after your workflow to check state
- name: Debug State File
  if: always()
  run: |
    echo "GITHUB_STATE directory: $GITHUB_STATE"
    ls -la "$(dirname "$GITHUB_STATE")" || true
```

### High Resource Usage During Collection

**Symptom**: The action itself consumes significant CPU or memory.

**Solution**: Increase the collection interval to reduce overhead.

```yaml
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "10"  # Collect every 10 seconds instead of 5
```

**Performance Impact**:
- Default (5 seconds): < 1% CPU, ~1MB memory
- 10 seconds: < 0.5% CPU, ~500KB memory
- Trade-off: Longer intervals mean less granular data

### False Positive Alerts

**Symptom**: Alerts trigger for normal workflow operations.

**Solution**: Adjust thresholds based on your workflow's resource profile.

```yaml
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1
  with:
    memory_alert_threshold: "90"  # Increase from default 80%
    cpu_alert_threshold: "95"     # Increase from default 85%
    cpu_alert_duration: "120"     # Require 2 minutes instead of 60 seconds
    disk_alert_threshold: "95"    # Increase from default 90%
```

**Threshold Selection Guidelines**:
- **Memory**: Set to 90-95% for workflows that legitimately use high memory
- **CPU**: Set to 90-95% for compute-intensive operations (builds, tests)
- **CPU Duration**: Increase to 120-300 seconds for expected sustained CPU usage
- **Disk**: Set to 95% if workflow creates large artifacts or build outputs

### Missing Alerts for Resource Issues

**Symptom**: Workflow experiences resource problems, but no alerts are generated.

**Possible Causes**:

1. **Thresholds too high**
   - Lower thresholds to catch issues earlier
   - Review typical resource usage in successful runs first

2. **Spike occurs between collection intervals**
   - Decrease `interval_seconds` for more granular monitoring
   - Note: More frequent collection = slightly higher overhead

3. **Resource issue affects action itself**
   - If the system is completely resource-starved, the collector may not run
   - Check runner system logs for out-of-memory or disk full errors

**Solution**: Start with conservative thresholds and adjust based on baseline usage.

```yaml
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "3"         # More granular data
    memory_alert_threshold: "70"  # Catch issues earlier
    cpu_alert_threshold: "75"
    cpu_alert_duration: "30"      # Shorter duration
    disk_alert_threshold: "80"
```

### Metrics Not Correlating with Workflow Steps

**Symptom**: Timestamps in metrics don't align with expected workflow step execution.

**Explanation**: This is expected behavior. The action displays metrics with ISO 8601 timestamps for manual correlation.

**How to Correlate Metrics**:

1. **View workflow run timeline**: In GitHub Actions UI, click on a workflow run to see step start/end times
2. **Match timestamps**: Compare metric timestamps with step execution times
3. **Identify patterns**: Look for resource spikes during specific steps

**Example Correlation**:

Workflow step timeline:
```
11:25:30 - Checkout (completed in 5s)
11:25:35 - Build (completed in 30s)
11:26:05 - Test (completed in 20s)
```

Metrics table shows:
```
11:25:32 - CPU: 15%  (during Checkout)
11:25:45 - CPU: 85%  (during Build - high as expected)
11:26:10 - CPU: 45%  (during Test)
```

This manual correlation allows you to understand which steps consume the most resources.

### Action Fails on Self-Hosted Runners

**Symptom**: Action works on GitHub-hosted runners but fails on self-hosted runners.

**Possible Causes**:

1. **Node.js version mismatch**
   - This action requires Node.js 24+
   - Check: `node --version` on your self-hosted runner
   - Solution: Upgrade Node.js to version 24 or later

2. **Missing system utilities**
   - The `systeminformation` library requires certain OS utilities
   - Linux: Ensure `/proc` filesystem is accessible
   - macOS: Ensure standard system commands are available
   - Windows: Ensure PowerShell and system commands are available

3. **Permission issues**
   - Runner must have permission to:
     - Read system metrics
     - Write to state directory
     - Fork processes
   - Solution: Review runner service permissions

**Debug Steps**:
```yaml
- name: Check Node Version
  run: node --version

- name: Check System Access
  run: |
    # Linux/macOS
    ls -la /proc 2>/dev/null || echo "No /proc access"
    
    # Test systeminformation
    node -e "import('systeminformation').then(si => si.currentLoad()).then(console.log)"
```

### Workflow Becomes Slower After Adding Action

**Symptom**: Workflow execution time increases noticeably after adding metrics collection.

**Analysis**: The action's overhead is typically < 1% CPU and minimal memory. If you observe significant slowdown:

**Possible Causes**:

1. **Very short collection interval**
   - Solution: Use default 5 seconds or increase to 10 seconds
   - Avoid intervals < 3 seconds unless necessary

2. **Resource-constrained runner**
   - If runner is already at capacity, any additional process can impact performance
   - Solution: Consider larger runner or optimize existing workflow steps

3. **Disk I/O contention**
   - On slow disks, frequent state writes might impact performance
   - Solution: Increase collection interval

**Measure Impact**:
```yaml
# Run workflow without action
- name: Benchmark Step
  run: time npm test

# Then run with action and compare
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1
  
- name: Benchmark Step
  run: time npm test
```

### Windows-Specific Issues

**Symptom**: Action fails or behaves unexpectedly on Windows runners.

**Common Issues**:

1. **Path separators**
   - The action handles Windows paths automatically
   - No action needed from users

2. **Disk metrics showing drive C:**
   - Expected behavior: Windows uses `C:` as root mount point
   - Linux uses `/`, macOS uses `/System/Volumes/Data`

3. **PowerShell vs CMD**
   - Action works with both shells
   - Use `shell: bash` for cross-platform scripts

**Example Windows Configuration**:
```yaml
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1
  # Works on windows-latest, windows-2022, windows-2019
```

## Getting Help

If you encounter issues not covered here:

1. **Check Action Logs**: Review both main and post-action logs for error messages
2. **Search Issues**: Check [GitHub Issues](https://github.com/Garbee/runner-resource-usage/issues) for similar problems
3. **Create Issue**: Open a new issue with:
   - Your workflow configuration
   - Runner OS and version
   - Complete error messages
   - Steps to reproduce
   - Expected vs actual behavior

## Additional Resources

- [README](../README.md) - Main documentation and usage examples
- [Architecture](./architecture.md) - Technical implementation details
- [Examples](./examples/) - Real-world usage scenarios
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
