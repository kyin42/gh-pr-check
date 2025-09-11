# GitHub PR Check Monitor

Monitor GitHub Pull Request checks with system notifications. Get notified when all your PR checks complete.

## Prerequisites

**GitHub CLI (gh)** - Required and must be authenticated

```bash
# Install GitHub CLI
brew install gh                    # macOS
winget install --id GitHub.cli     # Windows
sudo apt install gh               # Linux

# Authenticate
gh auth login
```

## Installation

### Option 1: Global Install

```bash
npm install -g gh-pr-check
```

### Option 2: Use with npx (no install)

```bash
npx gh-pr-check
```

## Usage

### Auto-Discover PRs (No URL needed)

Run from any git repository to automatically find and monitor open PRs:

```bash
gh-check
# or
npx gh-pr-check
```

**Behavior:**

- **No open PRs**: Exits with message
- **1 open PR**: Automatically monitors that PR
- **Multiple PRs**: Prompts you to select which PR to monitor

```
Found 3 open PRs:
==============================
1. PR #123 - Fix authentication bug
   Author: john.doe
   URL: https://github.com/owner/repo/pull/123

2. PR #124 - Add new feature
   Author: jane.smith
   URL: https://github.com/owner/repo/pull/124

3. PR #125 - Update documentation
   Author: bob.wilson
   URL: https://github.com/owner/repo/pull/125

Please select a PR (1-3) or 'q' to quit: 2
```

### Monitor Specific PR

Provide a PR URL to monitor a specific PR:

```bash
gh-check https://github.com/owner/repo/pull/123
# or
npx gh-pr-check https://github.com/owner/repo/pull/123
```

### Options

#### Single Check (no continuous monitoring)

```bash
gh-check --single
gh-check https://github.com/owner/repo/pull/123 --single
```

#### Verbose Mode (detailed check information)

```bash
gh-check --verbose
gh-check https://github.com/owner/repo/pull/123 --verbose
```

#### Help

```bash
gh-check --help
```

## Example Output

```
Starting PR checks monitoring...
Checking every 20 seconds until all checks complete
Started at: 2:30:15 PM

--- Check #1 (2:30:15 PM) ---
All Checks Status:
==================
✅ unit_tests: SUCCESS
🟡 ESLint: PENDING
🟡 TypeScript: PENDING

📊 Progress: 1/3 checks complete
🟡 Still pending: ESLint, TypeScript

--- Check #2 (2:30:35 PM) ---
All Checks Status:
==================
✅ unit_tests: SUCCESS
✅ ESLint: SUCCESS
✅ TypeScript: SUCCESS

🎉 All checks completed successfully for PR #123
⏱️  Total time: 1m 20s (2 checks)
```

**Status Icons:** ✅ Success | ❌ Failed | 🟡 Pending | ⚪ Cancelled
