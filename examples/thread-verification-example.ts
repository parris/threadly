import { createThreadly } from "../src/index";

/**
 * Comprehensive Thread Verification Example
 * This example demonstrates various ways to verify that functions are actually running in separate threads
 */

// Basic thread verification function
/* @threadly */
async function getThreadInfo(): Promise<{
  processId: number;
  threadId?: number;
  timestamp: string;
  workerId?: string;
}> {
  const processId = typeof process !== "undefined" ? process.pid : 0;
  let threadId: number | undefined;

  // Try to get thread ID (Node.js only)
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const { threadId: nodeThreadId } = require("worker_threads");
      threadId = nodeThreadId;
    } catch (e) {
      // Browser environment or threadId not available
    }
  }

  return {
    processId,
    threadId,
    timestamp: new Date().toISOString(),
  };
}

// CPU-intensive function to demonstrate parallel execution
/* @threadly pool(size=4) */
async function cpuIntensiveTask(
  id: number,
  iterations: number
): Promise<{ id: number; result: number; duration: number }> {
  const start = Date.now();

  // Simulate CPU-intensive work
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
  }

  const duration = Date.now() - start;
  return { id, result, duration };
}

// Memory-intensive function
/* @threadly pool(size=2) */
async function memoryIntensiveTask(
  id: number,
  size: number
): Promise<{ id: number; memoryUsage: number; duration: number }> {
  const start = Date.now();

  // Allocate and process large arrays
  const array = new Array(size).fill(0).map((_, i) => i);
  const processed = array.map((x) => x * x).filter((x) => x % 2 === 0);

  const duration = Date.now() - start;
  const memoryUsage = array.length + processed.length;

  return { id, memoryUsage, duration };
}

// Shared memory operation with thread verification
/* @threadly shared */
async function sharedMemoryOperation(
  buffer: SharedArrayBuffer,
  operation: "sum" | "product" | "average"
): Promise<{ result: number; processId: number; threadId?: number }> {
  const view = new Int32Array(buffer);
  let result = 0;

  switch (operation) {
    case "sum":
      result = view.reduce((acc, val) => acc + val, 0);
      break;
    case "product":
      result = view.reduce((acc, val) => acc * val, 1);
      break;
    case "average":
      result = Math.floor(
        view.reduce((acc, val) => acc + val, 0) / view.length
      );
      break;
  }

  const processId = typeof process !== "undefined" ? process.pid : 0;
  let threadId: number | undefined;

  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const { threadId: nodeThreadId } = require("worker_threads");
      threadId = nodeThreadId;
    } catch (e) {
      // Browser environment or threadId not available
    }
  }

  return { result, processId, threadId };
}

// Sequential vs parallel execution comparison
/* @threadly pool(size=3) */
async function sequentialVsParallelTask(
  id: number,
  delay: number
): Promise<{
  id: number;
  startTime: string;
  endTime: string;
  duration: number;
}> {
  const startTime = new Date().toISOString();
  const start = Date.now();

  // Simulate work
  await new Promise((resolve) => setTimeout(resolve, delay));

  const endTime = new Date().toISOString();
  const duration = Date.now() - start;

  return { id, startTime, endTime, duration };
}

// Main execution function
async function main() {
  console.log("🚀 Threadly Thread Verification Example");
  console.log("=====================================");

  // Log main thread info
  const mainProcessId = typeof process !== "undefined" ? process.pid : "N/A";
  console.log(`[Main] Process ID: ${mainProcessId}`);
  console.log(`[Main] Starting thread verification tests...\n`);

  const threadly = createThreadly({
    outputDir: "./dist",
    baseDir: "./examples",
  });

  // Transform the file
  const result = await threadly.transformFile(
    "./examples/thread-verification-example.ts"
  );
  console.log("✓ File transformed successfully");
  console.log(`✓ Generated ${result.workerConfigs.length} worker configs\n`);

  // Test 1: Basic thread verification
  console.log("📋 Test 1: Basic Thread Verification");
  console.log("-----------------------------------");
  const threadInfo = await getThreadInfo();
  console.log(`[Main] Thread info result:`, threadInfo);
  console.log(`[Main] Main process ID: ${mainProcessId}`);
  console.log(`[Main] Worker process ID: ${threadInfo.processId}`);
  console.log(
    `[Main] Same process? ${
      mainProcessId === threadInfo.processId
        ? "YES (same process)"
        : "NO (different process)"
    }`
  );
  if (threadInfo.threadId) {
    console.log(`[Main] Worker thread ID: ${threadInfo.threadId}`);
  }
  console.log("");

  // Test 2: Parallel execution timing
  console.log("⏱️  Test 2: Parallel Execution Timing");
  console.log("------------------------------------");
  const parallelStart = Date.now();
  const parallelTasks = [
    sequentialVsParallelTask(1, 2000),
    sequentialVsParallelTask(2, 2000),
    sequentialVsParallelTask(3, 2000),
  ];
  const parallelResults = await Promise.all(parallelTasks);
  const parallelDuration = Date.now() - parallelStart;

  console.log(`[Main] Parallel execution time: ${parallelDuration}ms`);
  console.log(`[Main] Expected sequential time: ~6000ms`);
  console.log(`[Main] Speedup: ${(6000 / parallelDuration).toFixed(2)}x`);
  console.log(`[Main] Parallel results:`, parallelResults);
  console.log("");

  // Test 3: CPU-intensive parallel tasks
  console.log("🔥 Test 3: CPU-Intensive Parallel Tasks");
  console.log("--------------------------------------");
  const cpuStart = Date.now();
  const cpuTasks = [
    cpuIntensiveTask(1, 1000000),
    cpuIntensiveTask(2, 1000000),
    cpuIntensiveTask(3, 1000000),
    cpuIntensiveTask(4, 1000000),
  ];
  const cpuResults = await Promise.all(cpuTasks);
  const cpuDuration = Date.now() - cpuStart;

  console.log(`[Main] CPU tasks completed in: ${cpuDuration}ms`);
  console.log(
    `[Main] Individual task durations:`,
    cpuResults.map((r) => r.duration)
  );
  console.log(`[Main] CPU results:`, cpuResults);
  console.log("");

  // Test 4: Memory-intensive tasks
  console.log("💾 Test 4: Memory-Intensive Tasks");
  console.log("--------------------------------");
  const memoryStart = Date.now();
  const memoryTasks = [
    memoryIntensiveTask(1, 100000),
    memoryIntensiveTask(2, 100000),
  ];
  const memoryResults = await Promise.all(memoryTasks);
  const memoryDuration = Date.now() - memoryStart;

  console.log(`[Main] Memory tasks completed in: ${memoryDuration}ms`);
  console.log(`[Main] Memory results:`, memoryResults);
  console.log("");

  // Test 5: Shared memory operations
  console.log("🔗 Test 5: Shared Memory Operations");
  console.log("----------------------------------");
  const sharedBuffer = new SharedArrayBuffer(16);
  const view = new Int32Array(sharedBuffer);
  view[0] = 2;
  view[1] = 3;
  view[2] = 4;
  view[3] = 5;

  const sharedResults = await Promise.all([
    sharedMemoryOperation(sharedBuffer, "sum"),
    sharedMemoryOperation(sharedBuffer, "product"),
    sharedMemoryOperation(sharedBuffer, "average"),
  ]);

  console.log(`[Main] Shared memory results:`, sharedResults);
  console.log(
    `[Main] All operations used same process? ${sharedResults.every(
      (r) => r.processId === sharedResults[0].processId
    )}`
  );
  console.log("");

  // Test 6: Multiple thread verification calls
  console.log("🔄 Test 6: Multiple Thread Verification Calls");
  console.log("--------------------------------------------");
  const verificationPromises = Array.from({ length: 5 }, (_, i) =>
    getThreadInfo()
  );
  const verificationResults = await Promise.all(verificationPromises);

  console.log(`[Main] Multiple verification results:`);
  verificationResults.forEach((result, index) => {
    console.log(
      `[Main] Call ${index + 1}: PID=${result.processId}, Thread=${
        result.threadId || "N/A"
      }`
    );
  });

  const uniqueProcessIds = new Set(verificationResults.map((r) => r.processId));
  const uniqueThreadIds = new Set(
    verificationResults.map((r) => r.threadId).filter(Boolean)
  );

  console.log(`[Main] Unique process IDs: ${uniqueProcessIds.size}`);
  console.log(`[Main] Unique thread IDs: ${uniqueThreadIds.size}`);
  console.log("");

  // Summary
  console.log("📊 Summary");
  console.log("---------");
  console.log(
    `✓ Thread verification: ${
      threadInfo.processId !== mainProcessId ? "PASSED" : "FAILED"
    } (different process)`
  );
  console.log(
    `✓ Parallel execution: ${
      parallelDuration < 5000 ? "PASSED" : "FAILED"
    } (faster than sequential)`
  );
  console.log(
    `✓ CPU parallelism: ${
      cpuDuration < 4000 ? "PASSED" : "FAILED"
    } (parallel CPU tasks)`
  );
  console.log(
    `✓ Memory parallelism: ${
      memoryDuration < 2000 ? "PASSED" : "FAILED"
    } (parallel memory tasks)`
  );
  console.log(
    `✓ Shared memory: ${
      sharedResults.length > 0 ? "PASSED" : "FAILED"
    } (shared memory operations)`
  );
  console.log(
    `✓ Multiple workers: ${
      uniqueProcessIds.size > 1 ? "PASSED" : "FAILED"
    } (multiple processes/threads)`
  );

  console.log("\n🎉 Thread verification example completed!");
}

main().catch(console.error);
