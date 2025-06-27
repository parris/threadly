#!/usr/bin/env ts-node

/**
 * Thread Verification Runner
 * This script runs the thread verification examples to demonstrate thread execution
 */

import { createThreadly } from "../src/index";

async function runThreadVerification() {
  console.log("🧪 Running Threadly Thread Verification Examples");
  console.log("==============================================\n");

  const threadly = createThreadly({
    outputDir: "./dist",
    baseDir: "./examples",
  });

  try {
    // Run the comprehensive thread verification example
    console.log("📋 Running comprehensive thread verification example...");
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    const result = await execAsync(
      "npx ts-node examples/thread-verification-example.ts"
    );
    console.log(result.stdout);

    if (result.stderr) {
      console.error("Errors:", result.stderr);
    }
  } catch (error) {
    console.error("Error running thread verification:", error);
  }
}

// Also run basic examples
async function runBasicExamples() {
  console.log("\n🔧 Running basic examples with thread verification...");

  try {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    console.log("\n1. Basic Example:");
    const basicResult = await execAsync(
      "npx ts-node examples/basic-example.ts"
    );
    console.log(basicResult.stdout);

    console.log("\n2. Worker with Imports Example:");
    const importsResult = await execAsync(
      "npx ts-node examples/worker-with-imports.ts"
    );
    console.log(importsResult.stdout);
  } catch (error) {
    console.error("Error running basic examples:", error);
  }
}

async function main() {
  await runThreadVerification();
  await runBasicExamples();

  console.log("\n✅ Thread verification examples completed!");
  console.log("\n💡 Key things to look for:");
  console.log("   - Different process IDs between main thread and workers");
  console.log("   - Different thread IDs in Node.js environments");
  console.log("   - Parallel execution timing (faster than sequential)");
  console.log("   - Worker-specific console logs with thread information");
}

main().catch(console.error);
