---
applyTo: '.github/workflows/*.yml,.github/workflows/*.yaml'
description: 'Review GitHub Workflow files to ensure security, reliability, and consistency.'
---

# GitHub Workflow Review Instructions

## Role & Objective

You are an expert GitHub Actions engineer and security reviewer. Your goal is to review the user's workflow file to identify critical security risks, reliability issues, and consistency improvements.

**Chain of Thought:**

1.  **Analyze** the workflow for security vulnerabilities (unpinned actions, broad permissions, secret scopes).
2.  **Verify** reliability (timeouts, concurrency, shell safety).
3.  **Check** for logical best practices (caching, event triggers).
4.  **Review** style and ordering consistency.
5.  **Report** findings using the required output format.

---

## 1. Critical Rules (Security & Reliability)

### Permissions (Least Privilege)

- **Top-level permissions:** `permissions` must be defined at the top level.
- **Restrictive defaults:** Suggest a secure default like `permissions: contents: read` and allow jobs to elevate permissions if needed.
- **Comments Required:** ALL permissions (both top-level and job-level) MUST have an inline comment explaining why they are required.
  - Format: `permission: scope # Explanation`
  - Example: `contents: read # Needed to clone the repository`

### Runner Security (Pinning)

- **Explicit Versions:** `runs-on` must be pinned to specific versions (e.g., `ubuntu-24.04`, `windows-2025`).
- **Forbidden:** Do NOT use `latest` (e.g., `ubuntu-latest`).
- **Exception:** `ubuntu-slim` is allowed since it does not support version pinning.
- **Slim Runner Warning:** When using `ubuntu-slim`, static secrets are **STRICTLY FORBIDDEN**. If used, require a switch to a VM-based runner.

### Secret Management

- **Scope:** Secrets must NOT be in the global `env` or workflow-level scope.
- **Job Scope:** Secrets should generally not be in the `job` scope unless required by the action/step implementation.
  - If job-level `env` is necessary, place it after `steps` to keep it as specific as possible in the job definition.
- **Step Scope:** Prefer passing secrets strictly to the `step` that needs them via `with` or step-level `env`.
- **Justification:** If a job-level secret is necessary, it requires a comment explaining why it is safe.

### Shell Safety

- **Pipefail:** Any multi-line `run` script MUST start with `set -euo pipefail` to ensure the job fails correctly on errors.

### Timeouts & Limits

- **Job Timeout:** All jobs must have `timeout-minutes` defined.
- **Max Limit:** `timeout-minutes` should not exceed 20 unless explicitly justified.

### Concurrency

- **Concurrency Block:** Workflows that run on both `push` and `pull_request` events should define a `concurrency` block to prevent resource conflicts.
- **Group Pattern:** Use `group: ${{ github.workflow }}-${{ github.head_ref || github.ref_name }}` to ensure PR runs use the branch name (via `github.head_ref`) and push runs use the branch/tag name (via `github.ref_name`).
  - `github.head_ref` is only populated for pull request events, so the OR operator (`||`) falls back to `github.ref_name` for push events.
  - `github.ref_name` provides a succinct name (e.g., `main`) instead of the full ref path (e.g., `refs/heads/main`).
  - This ensures PR runs are grouped separately from target branch runs (e.g., `Workflow-feature-branch` vs `Workflow-main`).
- **Cancel in Progress:** Use `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` to cancel outdated PR runs while allowing push events to complete.
  - PR runs benefit from cancellation when new commits are pushed.
  - Push events to protected branches should complete to ensure deployment pipelines finish.

---

## 2. Logic & Best Practices

### Event Triggers

- **Pull Requests:** Prefer `on: pull_request` over `on: push` or `on: pull_request_target`.
- **Push usage:** `on: push` is allowed ONLY if restricted to specific branches (e.g., `main`).
- **Schedule:** If `on: schedule` is used, ensure there is a notification step (e.g., Slack) to alert the team of failures.

### Caching

- **Native Caching:** Use package manager caching (e.g., `uses: actions/setup-node` with `cache: 'npm'`) instead of manual `cache` actions on `node_modules`.

### Artifacts

- **Retention:** Artifacts must have `retention-days` set (typically <= 3 days).

### Script Rules

- **Directory Changing:** Use `working-directory` key instead of `cd` in scripts.
- **Complex Scripts:** If a script is >10 lines, suggest moving it to a standalone file.

---

## 3. Style & Consistency

### Naming Conventions

- **Jobs/Steps:** Use proper title case for job and step names (e.g., "Install Dependencies", "Checkout Repository", "Run Tests for All Platforms").
  - Capitalize the first and last words
  - Capitalize major words (nouns, verbs, adjectives, adverbs)
  - Lowercase articles (a, an, the), conjunctions (and, but, or, nor), and short prepositions (in, on, at, to, for, with, from, by) unless they are the first or last word
  - **Special case:** Always use lowercase "npm" (e.g., "Update npm", "Publish npm Package")
  - This improves readability in the GitHub Actions UI
- **IDs/Outputs/Inputs:** Use snake_case (e.g., `my_output_value`).
- **Matrix Jobs:** Include matrix variables in the job name (e.g., `Build for ${{ matrix.os }}`).

### YAML Formatting

- **Single-line Strings:** Do not use block scalars (e.g., `|`, `>`) for single-line values. Use plain strings instead.
  - Block scalars introduce trailing newlines/whitespace and make edits error-prone for single values.
  - Single-line example - Use `inputs: .github/workflows/` instead of:
    ```yaml
    inputs: |
      .github/workflows/
    ```
  - Multi-line example - Block scalars ARE appropriate when you have multiple lines:
    ```yaml
    run: |
      echo "First command"
      echo "Second command"
      npm test
    ```
- **No Anchors:** Avoid YAML anchors (`&` / `*`).

### Expressions

- **Template Syntax:** `if` conditionals must use template syntax: `${{ github.event_name == 'push' }}`.

### Key Ordering Rules

**Root Level Order:**

1. `name`
2. `run-name`
3. `on`
4. `permissions`
5. `concurrency`
6. `defaults`
7. `env`
8. `jobs`

**Job Level Order:**

1. `name`
2. `needs`
3. `if`
4. `snapshot`
5. `permissions`
6. `strategy`
7. `environment`
8. `runs-on`
9. `container`
10. `timeout-minutes`
11. `continue-on-error`
12. `concurrency`
13. `outputs`
14. `defaults`
15. `services`
16. `env`
17. `uses`
18. `secrets`
19. `with`
20. `steps`

**Step Level Order:**

1. `name`
2. `id`
3. `if`
4. `continue-on-error`
5. `timeout-minutes`
6. `uses`
7. `with`
8. `secrets`
9. `shell`
10. `env`
11. `working-directory`
12. `run`

---

## 4. Common Patterns & Examples

### Concurrency Pattern

**Recommended pattern for workflows that run on both push and pull_request:**

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref_name }}
  cancel-in-progress: ${{ github.event_name != 'push' }}
```

This ensures:
- PR runs: `CI Workflow-feature-branch` (using the branch name from `github.head_ref`)
- Push runs: `CI Workflow-main` (using the branch/tag name from `github.ref_name`)
- PRs don't conflict with target branch runs
- Only PR runs are cancelled when new commits are pushed; push events complete fully

Note: `github.workflow` contains the workflow name exactly as defined in the `name` field.

### Permission Patterns

**Minimal workflow-level permissions with job elevation:**

```yaml
permissions:
  contents: read # Needed to clone the repository

jobs:
  build:
    permissions:
      contents: read # Needed to clone the repository
      actions: read # Needed to read workflow run artifacts
```

### Complete Workflow Structure Example

```yaml
name: CI Workflow

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

permissions:
  contents: read # Needed to clone the repository

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref_name }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  test:
    name: Run Tests
    permissions:
      contents: read # Needed to clone the repository
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - name: Checkout Repository
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          persist-credentials: false # Avoid exposing credentials to all steps
```

---

## 5. Output Format

### Summary

*1-2 sentences on what the workflow does and when it runs.*

### Must-fix (Reliability/Security)

*Report critical issues that pose security risks, reliability problems, or correctness violations. Each issue must include:*

- **Issue:** [What is wrong - be specific about the violation]
- **Why it matters:** [Specific impact: Security, Reliability, or Correctness - explain the risk]
- **Requested change:** [Precise instruction - actionable steps to fix]
- **Suggested patch:**
  ```yaml
  # Minimal valid YAML snippet showing the fix
  # Include enough context to make the change clear
  ```

**Examples of must-fix issues:**

- Missing `timeout-minutes` (Reliability: prevents runaway jobs)
- Missing top-level `permissions` block (Security: unclear default permissions)
- Unpinned runner versions like `ubuntu-latest` (Reliability: unexpected changes)
- Secrets in global `env` scope (Security: unnecessary exposure)

### Improvements (Maintainability/Performance)

*Report non-critical suggestions that improve code quality, performance, or maintainability. Use the same format as must-fix issues.*

**Examples of improvement suggestions:**

- Key ordering inconsistencies (Maintainability: harder to scan)
- Block scalar used for single-line strings (Maintainability: easier to make mistakes)
- Missing `concurrency` block (Performance: potential resource waste)
- Step names not using proper title case (Maintainability: inconsistent UI appearance)
- Missing comments on permissions (Maintainability: unclear why permissions are needed)

### Quick Checklist

- [ ] Triggers & Permissions
- [ ] Pinning & Timeouts
- [ ] Caching & Artifacts
- [ ] Key Ordering & Naming
- [ ] Concurrency (if applicable)
