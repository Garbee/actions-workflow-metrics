# Memory-Intensive Workflows Example

This example shows how to monitor and optimize workflows with high memory usage, such as data processing, machine learning, or large-scale builds.

## Use Case

You're running a Python data science workflow that processes large datasets and trains machine learning models. Memory usage is unpredictable and sometimes causes out-of-memory errors.

## Workflow Configuration

```yaml
name: ML Pipeline

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
  train:
    name: Train Model
    runs-on: ubuntu-24.04-16gb  # Larger runner with 16GB RAM
    timeout-minutes: 60
    steps:
      # Configure for memory-intensive workflow
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
        with:
          interval_seconds: "5"
          memory_alert_threshold: "90"  # High threshold for legitimate usage
          cpu_alert_threshold: "85"
          cpu_alert_duration: "300"     # ML training uses CPU for extended periods
          disk_alert_threshold: "85"    # Large datasets and models
      
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install Dependencies
        run: |
          pip install --upgrade pip
          pip install -r requirements.txt
      
      - name: Download Dataset
        run: |
          python scripts/download_data.py --size large
      
      - name: Preprocess Data
        run: |
          python scripts/preprocess.py --chunk-size 10000
      
      - name: Train Model
        run: |
          python scripts/train.py --epochs 100 --batch-size 64
      
      - name: Evaluate Model
        run: |
          python scripts/evaluate.py
      
      - name: Cleanup Datasets
        if: always()
        run: |
          rm -rf data/raw data/processed
```

## Expected Memory Pattern

### Typical Memory Usage Timeline

```
00:00 - Checkout:            500 MB   (baseline)
00:05 - Setup Python:        800 MB   (Python runtime)
00:10 - Install Deps:        1.2 GB   (packages loaded)
00:15 - Download Dataset:    1.5 GB   (network buffer)
00:25 - Preprocess Data:     8.5 GB   (dataset in memory)
01:00 - Train Model:         12.0 GB  (model + dataset + gradients)
01:45 - Evaluate Model:      6.0 GB   (model + test data)
02:00 - Cleanup:             1.0 GB   (returning to baseline)
```

## Common Memory Issues and Solutions

### Issue 1: Out-of-Memory During Training

**Symptoms in Metrics**:
- Memory steadily increases during training
- Reaches 100% or close to it
- Workflow fails with OOM error

**Example Metrics**:
```
10:30:00 - 4.5 GB
10:30:30 - 8.2 GB
10:31:00 - 11.8 GB
10:31:30 - 14.9 GB  ← Approaching limit
10:32:00 - [WORKFLOW FAILED]
```

**Solutions**:

1. **Reduce Batch Size**
```python
# Before: batch_size=128
python scripts/train.py --batch-size 64  # or 32

# Or use dynamic batch sizing
python scripts/train.py --auto-batch-size
```

2. **Use Gradient Accumulation**
```python
# Simulates larger batch size without memory spike
python scripts/train.py --batch-size 32 --gradient-accumulation-steps 4
# Effective batch size: 32 × 4 = 128
```

3. **Process Data in Chunks**
```python
# Instead of loading entire dataset
for chunk in pd.read_csv('data.csv', chunksize=10000):
    process(chunk)
```

4. **Use Memory-Mapped Files**
```python
# Load data without fully loading into RAM
import numpy as np
data = np.memmap('data.npy', dtype='float32', mode='r')
```

### Issue 2: Memory Leak in Preprocessing

**Symptoms in Metrics**:
- Memory increases linearly during preprocessing
- Never decreases between chunks
- Growth rate consistent

**Example Metrics**:
```
10:00:00 - 2.0 GB  (start preprocessing)
10:05:00 - 4.5 GB  (chunk 1)
10:10:00 - 7.0 GB  (chunk 2)
10:15:00 - 9.5 GB  (chunk 3)
10:20:00 - 12.0 GB (chunk 4) ← Should plateau, but keeps growing
```

**Solutions**:

1. **Explicitly Free Memory**
```python
import gc

for chunk in data_chunks:
    processed = process_chunk(chunk)
    save_chunk(processed)
    
    # Explicitly free memory
    del chunk, processed
    gc.collect()
```

2. **Use Context Managers**
```python
def process_in_context():
    with open('data.csv') as f:
        for chunk in pd.read_csv(f, chunksize=1000):
            yield process(chunk)
    # Memory automatically freed when exiting context
```

3. **Monitor Python Memory**
```python
import tracemalloc

tracemalloc.start()
# ... your code ...
snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics('lineno')
for stat in top_stats[:10]:
    print(stat)
```

### Issue 3: Dataset Too Large for Runner

**Symptoms in Metrics**:
- Memory maxes out during data loading
- Disk usage also high (swap usage)
- System becomes unresponsive

**Example Metrics**:
```
10:15:00 - Memory: 14.5 GB (96% of 15GB)
10:15:05 - Disk: 65 GB (45%) ← Swap file growing
10:15:10 - Memory: 14.9 GB (99%)
10:15:15 - [TIMEOUT or FAILURE]
```

**Solutions**:

1. **Use Larger Runner**
```yaml
jobs:
  train:
    runs-on: ubuntu-24.04-32gb  # Upgrade to 32GB RAM
```

2. **Stream Data Instead of Loading**
```python
# Before: Load entire dataset
data = pd.read_csv('large_file.csv')  # 20GB file → OOM

# After: Stream processing
for chunk in pd.read_csv('large_file.csv', chunksize=5000):
    results = model.predict(chunk)
    save_results(results)
```

3. **Use Data Sampling for CI**
```yaml
- name: Download Dataset
  run: |
    if [ "$GITHUB_EVENT_NAME" == "pull_request" ]; then
      # Use smaller sample for PRs
      python scripts/download_data.py --size small
    else
      # Full dataset for main branch
      python scripts/download_data.py --size large
    fi
```

## Best Practices for Memory-Intensive Workflows

### 1. Establish Memory Budget

Know your limits before you hit them:

```yaml
# Document expected memory usage
- name: Train Model
  run: |
    # Expected memory: ~12GB peak
    # Allocation: Model (4GB) + Data (6GB) + Gradients (2GB)
    python scripts/train.py
```

Use metrics to validate your assumptions.

### 2. Implement Cleanup Steps

Always clean up after memory-intensive steps:

```yaml
- name: Preprocess Data
  run: python scripts/preprocess.py

- name: Cleanup Preprocessed Data
  if: always()
  run: |
    rm -rf data/processed/*.tmp
    rm -rf data/cache/

- name: Train Model
  run: python scripts/train.py
```

### 3. Use Memory-Efficient Libraries

Choose libraries designed for large data:

**Data Processing**:
- **Polars** instead of Pandas (more memory-efficient)
- **Dask** for distributed computing
- **Vaex** for out-of-core dataframes

**Machine Learning**:
- **TensorFlow/PyTorch with mixed precision** (FP16 uses less memory)
- **ONNX Runtime** for inference (smaller than training)
- **Model quantization** (reduce model size)

### 4. Monitor Peak Memory Usage

Add logging to track memory:

```python
import psutil
import os

def log_memory():
    process = psutil.Process(os.getpid())
    mem_gb = process.memory_info().rss / 1024 / 1024 / 1024
    print(f"Current memory: {mem_gb:.2f} GB")

# Log at key points
log_memory()  # After data loading
train_model()
log_memory()  # After training
```

Compare with metrics from the action to understand total system memory.

### 5. Use Appropriate Alert Thresholds

For memory-intensive workflows, adjust thresholds to avoid false alerts:

```yaml
# Conservative - catch issues early
memory_alert_threshold: "85"

# Balanced - for expected high memory usage
memory_alert_threshold: "90"

# Permissive - only alert at critical levels
memory_alert_threshold: "95"
```

## Advanced Configuration

### Matrix Strategy for Different Dataset Sizes

```yaml
jobs:
  train:
    strategy:
      matrix:
        dataset: [small, medium, large]
        include:
          - dataset: small
            runner: ubuntu-24.04
            memory_threshold: "80"
          - dataset: medium
            runner: ubuntu-24.04-16gb
            memory_threshold: "85"
          - dataset: large
            runner: ubuntu-24.04-32gb
            memory_threshold: "90"
    
    runs-on: ${{ matrix.runner }}
    
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
        with:
          memory_alert_threshold: ${{ matrix.memory_threshold }}
      
      - name: Train
        run: python train.py --dataset ${{ matrix.dataset }}
```

### Conditional Cleanup Based on Memory Usage

While you can't directly read metrics during workflow, you can add defensive cleanup:

```yaml
- name: Aggressive Cleanup Before Memory-Intensive Step
  run: |
    # Remove unnecessary files
    rm -rf ~/.cache/pip
    docker system prune -af || true
    
    # Clear system caches (if sudo available)
    sync && echo 3 | sudo tee /proc/sys/vm/drop_caches || true

- name: Memory-Intensive Step
  run: python scripts/process_large_data.py
```

## Real-World Example: Image Processing Pipeline

```yaml
name: Image Processing

jobs:
  process:
    runs-on: ubuntu-24.04-16gb
    steps:
      - name: Start Workflow Telemetry
        uses: garbee/runner-resource-usage@v1
        with:
          interval_seconds: "5"
          memory_alert_threshold: "90"
      
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Process Images in Batches
        run: |
          # Process 100 images at a time to limit memory
          python scripts/process_images.py \
            --input data/images/ \
            --output data/processed/ \
            --batch-size 100 \
            --workers 4
      
      - name: Generate Thumbnails
        run: |
          # Parallel processing with memory limit per worker
          python scripts/thumbnails.py \
            --workers 4 \
            --memory-per-worker 2G
      
      - name: Cleanup
        if: always()
        run: |
          rm -rf data/processed/
```

Expected metrics show controlled memory usage:
- Never exceeds 14GB (well below 16GB limit)
- Memory returns to baseline between batches
- No alert triggers

## Troubleshooting Memory Issues

### Step 1: Identify the Problem Step

Check metrics to see when memory spikes occur:
1. Look for timestamps when memory increases sharply
2. Correlate with workflow step times
3. Focus optimization on that step

### Step 2: Reproduce Locally

Run the problematic step locally with monitoring:

```bash
# Monitor memory usage
python -m memory_profiler scripts/problematic_step.py

# Or use py-spy for live monitoring
py-spy top --pid <process_id>
```

### Step 3: Implement Fix and Verify

Make changes, then verify with metrics:
1. Update code to reduce memory usage
2. Run workflow with metrics collection
3. Compare before/after metrics
4. Ensure memory stays below threshold

## Related Examples

- [Basic Monitoring](./basic-monitoring.md) - Understanding metrics fundamentals
- [Build Optimization](./build-optimization.md) - General optimization techniques
- [Multi-Job Workflows](./multi-job.md) - Comparing metrics across jobs

## Further Reading

- [Python Memory Management](https://docs.python.org/3/c-api/memory.html)
- [PyTorch Memory Management](https://pytorch.org/docs/stable/notes/cuda.html#memory-management)
- [Dask for Large Datasets](https://docs.dask.org/)
- [GitHub Actions: Larger Runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-larger-runners)
