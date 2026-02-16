# GitHub Copilot Instructions

This file provides guidance for GitHub Copilot agents working on this repository.

## PR Title Format

**REQUIRED**: All PR titles MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>
```

### Type

The type must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries
- **ci**: Changes to CI configuration files and scripts
- **build**: Changes that affect the build system or external dependencies

### Scope

The scope is optional but recommended. It should indicate the area of the codebase affected:

- **metrics**: Changes to metrics collection logic
- **renderer**: Changes to chart rendering
- **collector**: Changes to the background collector process
- **post**: Changes to post-action logic
- **main**: Changes to main action logic
- **lib**: Changes to shared utilities
- **tests**: Changes to test infrastructure
- **docs**: Changes to documentation
- **workflow**: Changes to GitHub Actions workflows
- **deps**: Changes to dependencies

### Description

- Use imperative, present tense: "add" not "added" nor "adds"
- Don't capitalize the first letter
- No period (.) at the end
- Keep it concise but descriptive (ideally under 72 characters)

### Examples

**Good PR titles:**

```
feat(metrics): add memory pressure tracking
fix(collector): prevent memory leak in long-running processes
docs(readme): update installation instructions
refactor(renderer): simplify chart generation logic
test(metrics): add tests for drift compensation
refactor(metrics): replace systeminformation with native OS commands
ci(workflow): add Node.js 24 to test matrix
perf(post): optimize metrics file reading
```

**Bad PR titles:**

```
❌ Update README
❌ Fixed bug
❌ feat: Added new feature.
❌ Feature/add metrics
❌ Various improvements
```

### Breaking Changes

For breaking changes, add `!` after the type/scope and include `BREAKING CHANGE:` in the PR description:

```
feat(metrics)!: change metrics file format to JSON
```

## Additional Guidelines

- Keep changes focused and atomic
- Write clear, descriptive commit messages
- Ensure all tests pass before creating a PR
- Update documentation when changing functionality
- Follow the existing code style and patterns

## Resources

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Angular Commit Message Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
