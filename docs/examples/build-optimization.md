# Build Optimization Example

This example demonstrates how to use resource metrics to identify and resolve build performance bottlenecks.

## Use Case

Your Docker build process is slow, taking 8-10 minutes. You want to understand which parts of the build consume the most resources and optimize accordingly.

## Initial Workflow

```yaml
name: Docker Build

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
  build:
    name: Build Docker Image
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      # Enable metrics collection with optimized settings for builds
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
        with:
          interval_seconds: "5"
          memory_alert_threshold: "85"  # Docker builds can use significant memory
          cpu_alert_threshold: "90"      # Compilation is CPU-intensive
          cpu_alert_duration: "120"      # Allow sustained high CPU during build
          disk_alert_threshold: "85"     # Docker layers can consume disk space
      
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Build Image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: myapp:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Step 1: Collect Baseline Metrics

Run the workflow and examine the metrics in the job summary.

### Example Baseline Results

**CPU Usage Pattern**:
```
10:00:00 - 15%   (Checkout)
10:00:05 - 20%   (Setup Buildx)
10:00:10 - 85%   (Build - dependency installation)
10:00:30 - 95%   (Build - compilation)
10:05:00 - 90%   (Build - asset processing)
10:08:00 - 25%   (Build - finalizing layers)
```

**Memory Usage Pattern**:
```
10:00:00 - 500 MB    (Checkout)
10:00:05 - 800 MB    (Setup Buildx)
10:00:10 - 3.5 GB    (Build - dependencies)
10:00:30 - 5.2 GB    (Build - compilation)
10:05:00 - 6.8 GB    (Build - assets)
10:08:00 - 4.1 GB    (Build - cleanup)
```

**Disk Usage Pattern**:
```
10:00:00 - 45 GB     (Initial)
10:00:10 - 52 GB     (Docker layers)
10:00:30 - 58 GB     (Build cache)
10:08:00 - 62 GB     (Final image)
```

### Key Insights

1. **CPU**: Consistently high (85-95%) during build phases
2. **Memory**: Peaks at 6.8 GB during asset processing
3. **Disk**: Grows by 17 GB during build
4. **Duration**: Total 8 minutes

## Step 2: Identify Bottlenecks

Based on metrics, identify what's limiting performance:

### Is it CPU-bound?

**Indicators**:
- ✅ CPU usage 85-95% for extended periods
- ✅ Build phase takes longest (5+ minutes)
- ✅ Memory and disk have capacity remaining

**Conclusion**: Primary bottleneck is CPU

### Optimization Strategy for CPU-bound Builds

1. **Enable parallelization** in build tools
2. **Use layer caching** effectively
3. **Consider larger runner** with more cores
4. **Optimize compilation settings**

## Step 3: Apply Optimizations

### Optimization 1: Multi-stage Build with Caching

```dockerfile
# Before: Single-stage build
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["npm", "start"]

# After: Multi-stage build with better caching
FROM node:20 AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./
CMD ["npm", "start"]
```

### Optimization 2: Build Arguments for Parallelization

```yaml
- name: Build Image
  uses: docker/build-push-action@v5
  with:
    context: .
    push: false
    tags: myapp:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
    build-args: |
      NODE_OPTIONS=--max-old-space-size=4096
      JOBS=4  # Parallel compilation if supported
```

### Optimization 3: Larger Runner (if budget allows)

```yaml
jobs:
  build:
    runs-on: ubuntu-24.04-4-core  # Larger runner with 4 cores
    # More cores = faster parallel compilation
```

## Step 4: Measure Impact

Run the optimized workflow with metrics collection:

### After Optimization Results

**CPU Usage Pattern**:
```
10:00:00 - 15%   (Checkout)
10:00:05 - 20%   (Setup Buildx)
10:00:10 - 75%   (Build - cached dependencies) ⬇️ Improved
10:00:20 - 85%   (Build - compilation)         ⬇️ Shorter
10:02:00 - 80%   (Build - assets)               ⬇️ Shorter
10:03:30 - 25%   (Build - finalizing)
```

**Duration Comparison**:
- Before: 8 minutes
- After: 3.5 minutes
- **Improvement: 56% faster** 🎉

**Resource Changes**:
- Peak CPU: 95% → 85% (better distribution)
- Peak Memory: 6.8 GB → 5.2 GB (eliminated waste)
- Disk Usage: +17 GB → +12 GB (better layer caching)

## Step 5: Set Appropriate Alerts

Now that you know the optimized baseline, set thresholds to catch regressions:

```yaml
- name: Start Workflow Telemetry
  uses: garbee/runner-resource-usage@v1
  with:
    interval_seconds: "5"
    memory_alert_threshold: "90"    # Alert if exceeds optimized usage
    cpu_alert_threshold: "95"       # Alert if maxing out CPU
    cpu_alert_duration: "90"        # Alert if sustained beyond expected
    disk_alert_threshold: "85"      # Alert if approaching limits
```

These thresholds will alert you if:
- A code change introduces memory inefficiency
- Build process starts taking longer (CPU sustained beyond 90s)
- Docker layers grow unexpectedly large

## Common Build Optimization Patterns

### Pattern 1: Memory-Bound Build

**Symptoms**:
- Memory consistently near limit
- CPU under 70%
- Swap usage (if visible in system metrics)

**Solutions**:
```yaml
# Increase Node.js heap size
build-args: |
  NODE_OPTIONS=--max-old-space-size=8192

# Or use larger runner
runs-on: ubuntu-24.04-16gb
```

### Pattern 2: Disk I/O-Bound Build

**Symptoms**:
- Moderate CPU (40-60%)
- Disk usage growing slowly but steadily
- Long pauses between build steps

**Solutions**:
```yaml
# Use aggressive caching
- name: Cache Dependencies
  uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
      .next/cache
    key: ${{ runner.os }}-build-${{ hashFiles('**/package-lock.json') }}

# Or use faster storage runners
runs-on: ubuntu-24.04-ssd
```

### Pattern 3: Network-Bound Build

**Symptoms**:
- Low CPU during dependency installation
- Long "Installing dependencies" step
- Disk not growing during this time

**Solutions**:
```yaml
# Pre-cache dependencies
- name: Cache Dependencies
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}

# Or use NPM registry mirrors
- name: Configure NPM Mirror
  run: npm config set registry https://registry.npmjs.org/
```

## Advanced: Parallel Matrix Builds

If building for multiple platforms:

```yaml
jobs:
  build:
    strategy:
      matrix:
        platform: [linux/amd64, linux/arm64]
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
      
      - name: Build for ${{ matrix.platform }}
        uses: docker/build-push-action@v5
        with:
          platforms: ${{ matrix.platform }}
```

Compare metrics across matrix builds to identify platform-specific issues.

## Tracking Progress Over Time

Create a performance tracking workflow:

```yaml
name: Performance Tracking

on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday

jobs:
  baseline:
    runs-on: ubuntu-24.04
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
      
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Build
        run: npm run build
      
      - name: Record Duration
        run: echo "Build completed - check metrics in summary"
```

Review weekly metrics to catch performance regressions early.

## Related Examples

- [Basic Monitoring](./basic-monitoring.md) - Understanding metrics fundamentals
- [Memory-Intensive Workflows](./memory-intensive.md) - Handling high memory usage
- [Multi-Job Workflows](./multi-job.md) - Comparing metrics across jobs

## Further Reading

- [Docker Build Best Practices](https://docs.docker.com/build/building/best-practices/)
- [GitHub Actions: Larger Runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-larger-runners)
- [Optimizing Node.js Builds](https://nodejs.org/en/docs/guides/simple-profiling/)
