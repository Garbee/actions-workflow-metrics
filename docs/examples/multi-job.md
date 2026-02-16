# Multi-Job Workflows Example

This example demonstrates how to collect and compare metrics across multiple jobs in a workflow.

## Use Case

You have a workflow with multiple jobs (lint, build, test, deploy) running in parallel or sequence. You want to understand resource consumption across all jobs to identify bottlenecks and optimize the overall pipeline.

## Workflow Configuration

```yaml
name: CI/CD Pipeline

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
  lint:
    name: Lint Code
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
        with:
          interval_seconds: "5"
          cpu_alert_threshold: "90"
      
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Run ESLint
        run: npm run lint
      
      - name: Run Prettier
        run: npm run format:check

  test:
    name: Test (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-24.04, windows-2025, macos-24]
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
        with:
          interval_seconds: "5"
          memory_alert_threshold: "85"
          cpu_alert_threshold: "90"
      
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Run Unit Tests
        run: npm run test:unit
      
      - name: Run Integration Tests
        run: npm run test:integration

  build:
    name: Build
    needs: [lint, test]
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
        with:
          interval_seconds: "5"
          cpu_alert_threshold: "90"
          cpu_alert_duration: "120"  # Build can sustain high CPU
      
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Build Application
        run: npm run build
      
      - name: Upload Build Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 1

  deploy:
    name: Deploy
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    permissions:
      contents: read
      id-token: write  # For OIDC authentication
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
      
      - name: Download Build Artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist
      
      - name: Deploy to Production
        run: |
          # Deployment logic here
          echo "Deploying to production..."
```

## Analyzing Multi-Job Metrics

### Job Summary Structure

After the workflow completes, each job will have its own metrics in its job summary:

```
Workflow Run: CI/CD Pipeline #123
├─ Job: Lint Code
│  └─ Summary: CPU, Memory, Disk tables
├─ Job: Test (ubuntu-24.04)
│  └─ Summary: CPU, Memory, Disk tables
├─ Job: Test (windows-2025)
│  └─ Summary: CPU, Memory, Disk tables
├─ Job: Test (macos-24)
│  └─ Summary: CPU, Memory, Disk tables
├─ Job: Build
│  └─ Summary: CPU, Memory, Disk tables
└─ Job: Deploy
   └─ Summary: CPU, Memory, Disk tables
```

### Comparing Metrics Across Jobs

#### Example Comparison: Test Job Across Platforms

**Ubuntu-24.04**:
```
Duration: 5 minutes
Peak CPU: 85%
Peak Memory: 3.2 GB
Peak Disk: 52 GB
```

**Windows-2025**:
```
Duration: 7 minutes
Peak CPU: 78%
Peak Memory: 4.1 GB
Peak Disk: 58 GB
```

**macOS-24**:
```
Duration: 6 minutes
Peak CPU: 70%
Peak Memory: 3.8 GB
Peak Disk: 55 GB
```

**Insights**:
- Windows tests run 40% slower
- Windows uses more memory (OS overhead)
- All platforms have similar CPU patterns
- **Action**: Investigate Windows-specific performance issues

## Common Patterns and Optimizations

### Pattern 1: Fast Parallel Jobs

**Lint Job** (Low resource usage):
```
Duration: 2 minutes
CPU: 30-50% (lightweight checks)
Memory: 1.5 GB (minimal)
Disk: 45 GB (code + dependencies)
```

**Optimization**: None needed - already efficient

### Pattern 2: Resource-Intensive Parallel Jobs

**Test Job** (High resource usage):
```
Duration: 8 minutes
CPU: 85-95% (test execution)
Memory: 4-6 GB (test fixtures + app)
Disk: 52 GB (test data + coverage)
```

**Optimization**: Consider parallel test execution

```yaml
- name: Run Tests in Parallel
  run: npm run test -- --parallel --max-workers=4
```

### Pattern 3: Sequential Bottleneck

If build job waits for slow test jobs:

**Problem**:
```
Lint:  2 min ✓
Test:  15 min ← Bottleneck
Build: 5 min (waits for Test)
Total: 22 minutes
```

**Solution 1: Parallelize Tests**
```yaml
test:
  strategy:
    matrix:
      shard: [1, 2, 3, 4]
  steps:
    - run: npm run test -- --shard=${{ matrix.shard }}/4
```

**Result**:
```
Lint:  2 min ✓
Test:  4 min (4 shards × 4 min each, parallel)
Build: 5 min
Total: 11 minutes (50% faster)
```

**Solution 2: Remove Build Dependency on Test**
```yaml
build:
  needs: [lint]  # Only wait for lint, not tests
```

**Result**:
```
Lint:  2 min ✓
Test:  15 min (running in parallel with build)
Build: 5 min (starts after lint)
Deploy: 2 min
Total: 15 minutes (vs 22 minutes)
```

## Platform-Specific Insights

### Comparing Cross-Platform Resource Usage

Use matrix jobs to understand platform differences:

```yaml
jobs:
  analyze-platforms:
    strategy:
      matrix:
        os: [ubuntu-24.04, windows-2025, macos-24]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
      
      - name: Identical Workload
        run: |
          # Run the same task on all platforms
          npm ci
          npm run build
          npm test
```

#### Example Platform Comparison Results

**Build Performance**:
| Platform | Duration | Peak CPU | Peak Memory |
|----------|----------|----------|-------------|
| Ubuntu   | 3m 45s   | 92%      | 2.8 GB      |
| Windows  | 5m 12s   | 85%      | 3.6 GB      |
| macOS    | 4m 20s   | 78%      | 3.2 GB      |

**Insights**:
- Ubuntu is fastest (best for CI)
- Windows has higher memory overhead
- macOS has lower CPU utilization (fewer cores?)

**Decision**: Use ubuntu-24.04 for CI, test on other platforms only occasionally

### Resource-Aware Runner Selection

Choose runners based on job requirements:

```yaml
jobs:
  # Lightweight job - use standard runner
  lint:
    runs-on: ubuntu-24.04  # 2 cores, 7 GB RAM
  
  # CPU-intensive - use larger runner
  build:
    runs-on: ubuntu-24.04-4-core  # 4 cores, 16 GB RAM
  
  # Memory-intensive - use memory-optimized runner
  test-e2e:
    runs-on: ubuntu-24.04-16gb  # 2 cores, 16 GB RAM
```

Monitor with metrics to validate choices.

## Advanced: Dynamic Job Adjustment

### Conditional Metrics Collection

Collect metrics only where useful:

```yaml
jobs:
  # Always collect for resource-intensive jobs
  build:
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
  
  # Conditionally collect for debugging
  lint:
    steps:
      - name: Start Workflow Telemetry
        if: ${{ runner.debug == '1' }}
        uses: garbee/runner-resource-usage@v1
```

### Job-Specific Thresholds

Adjust thresholds based on job characteristics:

```yaml
jobs:
  lint:
    steps:
      - uses: garbee/runner-resource-usage@v1
        with:
          cpu_alert_threshold: "70"     # Linting shouldn't max CPU
          memory_alert_threshold: "80"
  
  build:
    steps:
      - uses: garbee/runner-resource-usage@v1
        with:
          cpu_alert_threshold: "95"     # Build can max CPU
          cpu_alert_duration: "180"
          memory_alert_threshold: "85"
  
  test:
    steps:
      - uses: garbee/runner-resource-usage@v1
        with:
          cpu_alert_threshold: "90"
          memory_alert_threshold: "90"  # Tests may use lots of memory
```

## Real-World Optimization Story

### Before Optimization

```yaml
jobs:
  test:
    runs-on: ubuntu-24.04
    # Single job runs all tests
    steps:
      - uses: garbee/runner-resource-usage@v1
      - run: npm test  # 20 minutes

  build:
    needs: test
    runs-on: ubuntu-24.04
    steps:
      - uses: garbee/runner-resource-usage@v1
      - run: npm run build  # 5 minutes

# Total time: 25 minutes
```

**Metrics showed**:
- Test CPU at 55% (single-threaded)
- Build waiting 20 minutes doing nothing
- Memory and disk had plenty of capacity

### After Optimization

```yaml
jobs:
  test:
    runs-on: ubuntu-24.04-4-core
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: garbee/runner-resource-usage@v1
      - run: npm test -- --shard=${{ matrix.shard }}/4
      # 6 minutes per shard

  build:
    runs-on: ubuntu-24.04
    # No longer waits for test
    steps:
      - uses: garbee/runner-resource-usage@v1
      - run: npm run build  # 5 minutes

# Total time: 6 minutes (test shards run in parallel)
```

**Metrics showed**:
- Test CPU now at 85% (better utilization)
- Build completes independently
- Total workflow 76% faster

**Result**: Saved 19 minutes per workflow run

## Troubleshooting Multi-Job Issues

### Problem: Job A Faster Than Job B

**Investigate**:
1. Compare metrics between jobs
2. Look for resource bottlenecks
3. Check for different workloads

**Example**:
- Job A: CPU 90%, finishes in 3 min
- Job B: CPU 40%, finishes in 8 min

**Conclusion**: Job B is I/O or network bound, not CPU bound

**Solutions**:
- Add caching to reduce I/O
- Parallelize I/O operations
- Use faster storage runners

### Problem: Matrix Jobs Have Inconsistent Duration

**Example Matrix Execution**:
```
Job (ubuntu-24.04):  5 min
Job (windows-2025):  12 min ← Much slower
Job (macos-24):      6 min
```

**Investigation Steps**:
1. Compare metrics across matrix jobs
2. Identify where time is spent differently
3. Look for platform-specific issues

**Common Causes**:
- Windows antivirus scanning (CPU spikes)
- Platform-specific dependency installation (network/disk)
- Different test behavior on platforms

### Problem: Jobs Fail After Adding Metrics

**Symptom**: Jobs that previously passed now fail with resource exhaustion.

**Cause**: Jobs were already close to limits; metrics pushed over edge.

**Solution**: Not a real problem with the action—workflow was already fragile. Address the underlying resource issue:

```yaml
# Before (marginal)
runs-on: ubuntu-24.04  # 7 GB RAM, using 6.8 GB

# After (headroom)
runs-on: ubuntu-24.04-16gb  # 16 GB RAM, comfortable margin
```

## Best Practices

### 1. Always Collect on Resource-Intensive Jobs

```yaml
jobs:
  lint:
    # Optional - lightweight job
    steps:
      - uses: garbee/runner-resource-usage@v1
        if: ${{ runner.debug == '1' }}
  
  build:
    # Always - resource-intensive
    steps:
      - uses: garbee/runner-resource-usage@v1
  
  test:
    # Always - resource-intensive
    steps:
      - uses: garbee/runner-resource-usage@v1
```

### 2. Use Consistent Configuration for Comparison

```yaml
# Define as YAML anchor for consistency
.metrics: &metrics
  uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "5"
    memory_alert_threshold: "85"
    cpu_alert_threshold: "90"

jobs:
  test:
    steps:
      - <<: *metrics
  build:
    steps:
      - <<: *metrics
```

Or use a reusable workflow:

```yaml
# .github/workflows/with-metrics.yml
name: Reusable with Metrics

on:
  workflow_call:

jobs:
  run:
    steps:
      - uses: garbee/runner-resource-usage@v1
      # ... other steps
```

### 3. Document Expected Resource Usage

Add comments to help team understand normal patterns:

```yaml
jobs:
  build:
    # Expected resources: CPU 85%, Memory 4GB, Duration 5min
    steps:
      - uses: garbee/runner-resource-usage@v1
      - run: npm run build
```

## Related Examples

- [Basic Monitoring](./basic-monitoring.md) - Understanding single-job metrics
- [Build Optimization](./build-optimization.md) - Optimizing specific jobs
- [CI/CD Pipeline](./cicd-pipeline.md) - Complete pipeline example

## Further Reading

- [GitHub Actions: Matrix Strategy](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs)
- [Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)
- [Job Dependencies](https://docs.github.com/en/actions/using-jobs/using-jobs-in-a-workflow#defining-prerequisite-jobs)
