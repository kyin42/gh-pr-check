#!/usr/bin/env node

const { execSync } = require("child_process");
const notifier = require("node-notifier");

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

function checkAllChecksStatus(prUrl, showOutput = true, verbose = false) {
  try {
    if (!prUrl) {
      console.error("Please provide a PR URL");
      console.log("Usage: node githubcheck2.js <PR_URL>");
      console.log(
        "Example: node githubcheck2.js https://github.com/owner/repo/pull/123"
      );
      return { error: true };
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
  const title =
    type === "success" ? "All Checks Complete ✅" : "Checks Failed ❌";

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
      console.log("Error occurred, will retry in 20 seconds...");
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
      } else {
        const message = `All checks completed successfully for PR #${result.prNumber}`;
        console.log(`\n🎉 ${message}`);
        console.log(`⏱️  Total time: ${duration} (${checkCount} checks)`);
        sendNotification(`${message}\nCompleted in ${duration}`, "success");
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

if (singleCheck) {
  // Run single check (original behavior)
  checkAllChecksStatus(prUrl, true, verbose);
} else {
  // Run continuous monitoring
  monitorAllChecksStatus(prUrl, verbose);
}
