#!/usr/bin/env node

const { execSync } = require("child_process");
const notifier = require("node-notifier");
const readline = require("readline");

function getStatusEmoji(status) {
  switch (status.toLowerCase()) {
    case "success":
    case "completed":
      return "✅";
    case "failure":
    case "failed":
      return "❌";
    case "pending":
    case "in_progress":
      return "🟡";
    case "cancelled":
      return "⚪";
    default:
      return "❓";
  }
}

function getOpenPRs() {
  try {
    console.log("Searching for open PRs...");
    const prs = JSON.parse(
      execSync(`gh pr list --state open --json number,title,url,author`, {
        encoding: "utf8",
      })
    );
    return prs;
  } catch (error) {
    console.error("Error fetching open PRs:", error.message);
    console.error(
      "Make sure you have gh CLI installed and authenticated, and you're in a git repository"
    );
    return [];
  }
}

function promptUserForPR(prs) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`\nFound ${prs.length} open PRs:`);
    console.log("==============================");
    prs.forEach((pr, index) => {
      console.log(`${index + 1}. PR #${pr.number} - ${pr.title}`);
      console.log(`   Author: ${pr.author.login}`);
      console.log(`   URL: ${pr.url}\n`);
    });

    rl.question(
      `Please select a PR (1-${prs.length}) or 'q' to quit: `,
      (answer) => {
        rl.close();

        if (answer.toLowerCase() === "q" || answer.toLowerCase() === "quit") {
          console.log("Exiting...");
          resolve(null);
          return;
        }

        const selection = parseInt(answer);
        if (isNaN(selection) || selection < 1 || selection > prs.length) {
          console.log(
            `Invalid selection '${answer}'. Please enter a number between 1-${prs.length} or 'q' to quit.`
          );
          console.log("Exiting...");
          process.exit(1);
        }

        const selectedPR = prs[selection - 1];
        console.log(
          `Selected PR #${selectedPR.number} - ${selectedPR.title}\n`
        );
        resolve(selectedPR.url);
      }
    );
  });
}

async function selectPR(prs) {
  if (prs.length === 0) {
    return await promptForPRUrl();
  }

  if (prs.length === 1) {
    console.log(`Found 1 open PR: #${prs[0].number} - ${prs[0].title}`);
    return prs[0].url;
  }

  return await promptUserForPR(prs);
}

function promptForPRUrl() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\nNo open PRs found in this repository.");
    console.log("Please provide a GitHub PR URL to monitor.");
    console.log("Example: https://github.com/owner/repo/pull/123\n");

    rl.question("Enter PR URL (or 'q' to quit): ", (answer) => {
      rl.close();

      if (answer.toLowerCase() === "q" || answer.toLowerCase() === "quit") {
        console.log("Exiting...");
        resolve(null);
        return;
      }

      if (!answer.trim()) {
        console.log("No URL provided. Exiting...");
        resolve(null);
        return;
      }

      // Basic validation for GitHub PR URL format
      if (!answer.match(/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/)) {
        console.log(
          "Invalid PR URL format. Expected: https://github.com/owner/repo/pull/123"
        );
        console.log("Exiting...");
        resolve(null);
        return;
      }

      console.log(`Using PR URL: ${answer}\n`);
      resolve(answer);
    });
  });
}

async function checkAllChecksStatus(prUrl, showOutput = true, verbose = false) {
  try {
    if (!prUrl) {
      // Try to find open PRs automatically
      const openPRs = getOpenPRs();

      if (openPRs.length === 0) {
        // No PRs found, ask for URL
        prUrl = await promptForPRUrl();
        if (!prUrl) {
          return { error: true };
        }
      } else {
        prUrl = await selectPR(openPRs);
        if (!prUrl) {
          return { error: true };
        }
      }
    }

    // Extract PR number from URL
    const match = prUrl.match(/\/pull\/(\d+)/);
    if (!match) {
      console.error(
        "Invalid PR URL format. Expected format: https://github.com/owner/repo/pull/123"
      );
      return { error: true };
    }
    const prNumber = match[1];

    if (showOutput) {
      console.log(`Checking all checks status for PR #${prNumber}...`);
    }

    // Get all checks for the current PR
    const checks = JSON.parse(
      execSync(`gh pr checks ${prUrl} --json name,state,description,link`, {
        encoding: "utf8",
      })
    );

    if (checks.length === 0) {
      if (showOutput) {
        console.log("No checks found for this PR");
      }
      return { error: true };
    }

    let allCompleted = true;
    let hasFailures = false;
    let pendingChecks = [];
    let completedChecks = [];
    let failedChecks = [];

    if (showOutput) {
      console.log("\nAll Checks Status:");
      console.log("==================");
    }

    checks.forEach((check) => {
      const status = check.state || "unknown";
      const context = check.name || "Unknown Check";
      const statusEmoji = getStatusEmoji(status);

      if (showOutput) {
        console.log(`${statusEmoji} ${context}: ${status.toUpperCase()}`);

        if (verbose) {
          if (check.description) {
            console.log(`  Description: ${check.description}`);
          }

          if (check.link) {
            console.log(`  Details: ${check.link}`);
          }

          console.log("");
        }
      }

      // Categorize checks
      if (["pending", "in_progress"].includes(status.toLowerCase())) {
        allCompleted = false;
        pendingChecks.push(context);
      } else if (
        ["failure", "failed", "cancelled"].includes(status.toLowerCase())
      ) {
        hasFailures = true;
        failedChecks.push(context);
      } else if (["success", "completed"].includes(status.toLowerCase())) {
        completedChecks.push(context);
      }
    });

    return {
      completed: allCompleted,
      hasFailures: hasFailures,
      checks: checks,
      prNumber: prNumber,
      summary: {
        total: checks.length,
        pending: pendingChecks,
        completed: completedChecks,
        failed: failedChecks,
      },
    };
  } catch (error) {
    console.error("Error checking status:", error.message);
    console.error("Make sure you have gh CLI installed and authenticated");
    return { error: true };
  }
}

function sendNotification(message, type = "success") {
  let title;
  switch (type) {
    case "success":
      title = "All Checks Complete ✅";
      break;
    case "failure":
      title = "Checks Failed ❌";
      break;
    case "repeat":
      title = "PR Status Update 🔔";
      break;
    default:
      title = "PR Monitor";
  }

  notifier.notify({
    title: title,
    message: message,
    sound: true,
    wait: false,
    timeout: 10,
  });
}

function formatDuration(startTime, endTime) {
  const durationMs = endTime - startTime;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

async function startContinuousNotifications(
  result,
  completionDuration,
  completionType
) {
  let notificationCount = 0;

  while (true) {
    notificationCount++;

    const currentTime = new Date().toLocaleTimeString();
    console.log(`🔔 Notification #${notificationCount} sent at ${currentTime}`);

    let message =
      completionType === "success"
        ? `All checks completed successfully for PR #${result.prNumber}`
        : `All checks completed with failures for PR #${result.prNumber}`;

    message += `\nCompleted in ${completionDuration}`;

    if (result.summary.failed.length > 0) {
      message += `\n❌ Failed: ${result.summary.failed.join(", ")}`;
    }

    sendNotification(message, "repeat");
    await new Promise((resolve) => setTimeout(resolve, 20000));
  }
}

async function monitorAllChecksStatus(prUrl, verbose = false) {
  const startTime = new Date();

  console.log("Starting PR checks monitoring...");
  console.log("Checking every 20 seconds until all checks complete");
  console.log(`Started at: ${startTime.toLocaleTimeString()}`);
  console.log("Press Ctrl+C to stop\n");

  let checkCount = 0;

  while (true) {
    checkCount++;
    console.log(
      `\n--- Check #${checkCount} (${new Date().toLocaleTimeString()}) ---`
    );

    const result = await checkAllChecksStatus(prUrl, true, verbose);

    if (result.error) {
      console.log("Error occurred", result.error);
      process.exit(1);
    } else if (result.completed) {
      const endTime = new Date();
      const duration = formatDuration(startTime, endTime);

      // Display summary
      console.log(`\n📊 Summary:`);
      console.log(`   Total checks: ${result.summary.total}`);
      if (result.summary.completed.length > 0) {
        console.log(`   ✅ Completed: ${result.summary.completed.length}`);
      }
      if (result.summary.failed.length > 0) {
        console.log(`   ❌ Failed: ${result.summary.failed.length}`);
      }

      if (result.hasFailures) {
        const message = `All checks completed with failures for PR #${result.prNumber}`;
        console.log(`\n🚨 ${message}`);
        console.log(`⏱️  Total time: ${duration} (${checkCount} checks)`);
        if (result.summary.failed.length > 0) {
          console.log(`❌ Failed checks: ${result.summary.failed.join(", ")}`);
        }
        sendNotification(`${message}\nCompleted in ${duration}`, "failure");

        // Continue sending notifications every 20 seconds
        console.log(
          `\n🔔 Checks completed! Now sending notifications every 20 seconds until you close the program...`
        );
        console.log("Press Ctrl+C to stop\n");

        await startContinuousNotifications(result, duration, "failure");
      } else {
        const message = `All checks completed successfully for PR #${result.prNumber}`;
        console.log(`\n🎉 ${message}`);
        console.log(`⏱️  Total time: ${duration} (${checkCount} checks)`);
        sendNotification(`${message}\nCompleted in ${duration}`, "success");

        // Continue sending notifications every 20 seconds
        console.log(
          `\n🔔 Checks completed! Now sending notifications every 20 seconds until you close the program...`
        );
        console.log("Press Ctrl+C to stop\n");

        await startContinuousNotifications(result, duration, "success");
      }
      break;
    } else {
      // Show current status summary
      console.log(
        `📊 Progress: ${result.summary.completed.length}/${result.summary.total} checks complete`
      );
      if (result.summary.pending.length > 0) {
        console.log(`🟡 Still pending: ${result.summary.pending.join(", ")}`);
      }
      if (result.summary.failed.length > 0) {
        console.log(`❌ Failed: ${result.summary.failed.join(", ")}`);
      }
    }

    console.log("Waiting 20 seconds before next check...");
    await new Promise((resolve) => setTimeout(resolve, 20000));
  }
}

// Get PR URL from command line argument
const prUrl = process.argv[2];

// Check command line options
const singleCheck = process.argv.includes("--single");
const verbose = process.argv.includes("--verbose");
const help = process.argv.includes("--help") || process.argv.includes("-h");

if (help) {
  console.log(
    "GitHub PR Monitor - Monitor GitHub PR checks with notifications"
  );
  console.log("");
  console.log("Usage:");
  console.log("  node github-pr-monitor.js [PR_URL] [OPTIONS]");
  console.log("");
  console.log("Arguments:");
  console.log(
    "  PR_URL    Optional. GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)"
  );
  console.log(
    "            If not provided, will search for open PRs in the current repository"
  );
  console.log("");
  console.log("Options:");
  console.log(
    "  --single    Run a single check instead of continuous monitoring"
  );
  console.log("  --verbose   Show detailed information about each check");
  console.log("  --help, -h  Show this help message");
  console.log("");
  console.log("Examples:");
  console.log("  node github-pr-monitor.js");
  console.log("  node github-pr-monitor.js --single");
  console.log(
    "  node github-pr-monitor.js https://github.com/owner/repo/pull/123"
  );
  console.log(
    "  node github-pr-monitor.js https://github.com/owner/repo/pull/123 --verbose"
  );
  process.exit(0);
}

async function main() {
  if (singleCheck) {
    // Run single check (original behavior)
    await checkAllChecksStatus(prUrl, true, verbose);
  } else {
    // Run continuous monitoring
    await monitorAllChecksStatus(prUrl, verbose);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
