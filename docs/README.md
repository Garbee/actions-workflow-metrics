# Documentation Index

Complete guide to the runner-resource-usage action documentation.

## Quick Start

New to this action? Start here:

1. **[README](../README.md)** - Overview, features, and basic usage
2. **[Quick Reference](./quick-reference.md)** - Common configurations at a glance
3. **[Basic Monitoring Example](./examples/basic-monitoring.md)** - Your first workflow with metrics

## User Guides

### Getting Started

- **[README](../README.md)** - Main documentation with installation and usage
- **[Quick Reference](./quick-reference.md)** - Fast lookup for configurations and scenarios
- **[Examples Index](./examples/README.md)** - Overview of all available examples

### Understanding Metrics

- **[FAQ](./faq.md)** - Frequently asked questions
  - What does this action do?
  - How do I read the metrics?
  - How do I correlate metrics with workflow steps?
  - What are the alert thresholds?
  - How much overhead does this add?

### Solving Problems

- **[Troubleshooting Guide](./troubleshooting.md)** - Common issues and solutions
  - No metrics displayed
  - High resource usage
  - False positive alerts
  - Platform-specific issues
  - Performance problems

## Examples by Use Case

### By Experience Level

**Beginner**:
- [Basic Monitoring](./examples/basic-monitoring.md) - Simple setup and interpretation

**Intermediate**:
- [Debug Mode Only](./examples/debug-mode.md) - Conditional metrics collection
- [Build Optimization](./examples/build-optimization.md) - Using metrics to improve performance

**Advanced**:
- [Memory-Intensive Workflows](./examples/memory-intensive.md) - Data processing and ML
- [Multi-Job Workflows](./examples/multi-job.md) - Cross-job analysis

### By Workflow Type

**General CI/CD**:
- [Basic Monitoring](./examples/basic-monitoring.md) - Standard build/test workflows
- [Multi-Job Workflows](./examples/multi-job.md) - Multiple jobs in one workflow

**Performance Optimization**:
- [Build Optimization](./examples/build-optimization.md) - Identifying bottlenecks
- [Memory-Intensive Workflows](./examples/memory-intensive.md) - High memory usage

**Debugging & Investigation**:
- [Debug Mode Only](./examples/debug-mode.md) - On-demand metrics collection
- [Build Optimization](./examples/build-optimization.md) - Performance analysis

### By Technology

**Node.js / JavaScript**:
- [Basic Monitoring](./examples/basic-monitoring.md)
- [Build Optimization](./examples/build-optimization.md)

**Python / Data Science**:
- [Memory-Intensive Workflows](./examples/memory-intensive.md)

**Docker**:
- [Build Optimization](./examples/build-optimization.md)

**Cross-Platform**:
- [Multi-Job Workflows](./examples/multi-job.md)

## Technical Documentation

### Architecture & Design

- **[Architecture](./architecture.md)** - Technical implementation details
  - Execution flow
  - Data collection mechanism
  - Storage architecture
  - Performance considerations
  - Security model

### Configuration Reference

- **[Quick Reference](./quick-reference.md)** - All configuration options
  - Input parameters
  - Default values
  - Threshold recommendations
  - Platform-specific notes

## Documentation by Topic

### Resource Monitoring

| Topic | Documents |
|-------|-----------|
| Basic setup | [README](../README.md), [Basic Monitoring](./examples/basic-monitoring.md) |
| CPU metrics | [FAQ](./faq.md), [Build Optimization](./examples/build-optimization.md) |
| Memory metrics | [FAQ](./faq.md), [Memory-Intensive](./examples/memory-intensive.md) |
| Disk metrics | [FAQ](./faq.md), [Build Optimization](./examples/build-optimization.md) |

### Configuration & Tuning

| Topic | Documents |
|-------|-----------|
| Alert thresholds | [Quick Reference](./quick-reference.md), [FAQ](./faq.md) |
| Collection interval | [Quick Reference](./quick-reference.md), [FAQ](./faq.md) |
| Conditional execution | [Debug Mode](./examples/debug-mode.md) |
| Platform-specific | [Quick Reference](./quick-reference.md), [Multi-Job](./examples/multi-job.md) |

### Problem Solving

| Issue Type | Documents |
|------------|-----------|
| No metrics showing | [Troubleshooting](./troubleshooting.md) |
| Performance problems | [Troubleshooting](./troubleshooting.md), [Build Optimization](./examples/build-optimization.md) |
| Memory issues | [Troubleshooting](./troubleshooting.md), [Memory-Intensive](./examples/memory-intensive.md) |
| False alerts | [Troubleshooting](./troubleshooting.md), [FAQ](./faq.md) |

## Learning Paths

### Path 1: Quick Start

For users who want to get started immediately:

1. Read [README](../README.md) → Understand what the action does
2. Follow [Basic Monitoring](./examples/basic-monitoring.md) → Add to your workflow
3. Check [Quick Reference](./quick-reference.md) → Adjust settings if needed

**Time required**: 15 minutes

### Path 2: Performance Optimization

For users investigating slow workflows:

1. Add action using [Basic Monitoring](./examples/basic-monitoring.md)
2. Collect baseline metrics (run workflow 2-3 times)
3. Follow [Build Optimization](./examples/build-optimization.md)
4. Check [Troubleshooting](./troubleshooting.md) for specific issues

**Time required**: 1-2 hours

### Path 3: Advanced Usage

For users with complex workflows:

1. Start with [Basic Monitoring](./examples/basic-monitoring.md)
2. Read [Architecture](./architecture.md) → Understand how it works
3. Review [Multi-Job Workflows](./examples/multi-job.md)
4. Check [Memory-Intensive](./examples/memory-intensive.md) if applicable
5. Set up [Debug Mode](./examples/debug-mode.md) for production

**Time required**: 2-3 hours

### Path 4: Troubleshooting

For users experiencing issues:

1. Check [Troubleshooting Guide](./troubleshooting.md) → Find your issue
2. Review [FAQ](./faq.md) → Common questions
3. Check relevant example for your use case
4. Read [Architecture](./architecture.md) if needed for deeper understanding

**Time required**: 30 minutes - 1 hour

## Contributing Documentation

Have suggestions for improving documentation?

1. Open an issue describing the improvement
2. Submit a PR with documentation changes
3. Follow the style and format of existing docs

Good documentation contributions:
- Fix errors or unclear explanations
- Add missing examples or use cases
- Update outdated information
- Improve navigation or organization

## Getting Help

Can't find what you need?

1. **Search existing documentation**: Use browser search (Ctrl/Cmd+F) in this index
2. **Check the FAQ**: [FAQ.md](./faq.md) covers many common questions
3. **Search issues**: [GitHub Issues](https://github.com/Garbee/runner-resource-usage/issues)
4. **Ask a question**: Open a new issue with the "question" label

---

**Last Updated**: 2026-02-16

**Documentation Version**: 1.0
