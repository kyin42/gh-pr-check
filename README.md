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
npx gh-pr-check <PR_URL>
```

## Usage

### Monitor Mode (Default)

Checks every 20 seconds until all checks complete:

```bash
gh-check https://github.com/owner/repo/pull/123
# or
npx gh-pr-check https://github.com/owner/repo/pull/123
```

### Single Check

```bash
gh-check https://github.com/owner/repo/pull/123 --single
```

### Verbose Mode

```bash
gh-check https://github.com/owner/repo/pull/123 --verbose
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
