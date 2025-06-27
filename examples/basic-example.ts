import { createThreadly } from "../src/index";

// Example functions with Threadly annotations

/* @threadly */
async function fibonacci(n: number): Promise<number> {
  if (n <= 1) return n;
  return (await fibonacci(n - 1)) + (await fibonacci(n - 2));
}

/* @threadly */
async function fetchData(url: string): Promise<any> {
  const response = await fetch(url);
  return response.json();
}

/* @threadly pool(size=4) */
async function processArray(arr: number[]): Promise<number[]> {
  return arr.map((x) => x * 2).filter((x) => x > 10);
}

/* @threadly shared */
async function sharedMemoryOperation(data: SharedArrayBuffer): Promise<number> {
  const view = new Int32Array(data);
  let sum = 0;
  for (let i = 0; i < view.length; i++) {
    sum += view[i];
  }
  return sum;
}

/* @threadly pool(size=3) */
async function slowFunction(id: number): Promise<string> {
  // Simulate work that takes time
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return `Task ${id} completed`;
}

/* @threadly */
async function verifyThreadExecution(): Promise<{
  processId: number;
  threadId?: number;
  timestamp: string;
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

// Main execution
async function main() {
  console.log(
    `[Main] Process ID: ${typeof process !== "undefined" ? process.pid : "N/A"}`
  );
  console.log(`[Main] Starting Threadly example with thread verification...\n`);

  const threadly = createThreadly({
    outputDir: "./dist",
    baseDir: "./examples",
  });

  // Transform the file
  const result = await threadly.transformFile("./examples/basic-example.ts");
  console.log("Transformed source:", result.modifiedSource);
  console.log("Worker configs:", result.workerConfigs);
  console.log("");

  // Test thread verification
  console.log("=== Thread Verification Test ===");
  const threadInfo = await verifyThreadExecution();
  console.log(`[Main] Thread verification result:`, threadInfo);
  console.log("");

  // Test parallel execution timing
  console.log("=== Parallel Execution Test ===");
  const start = Date.now();
  const promises = [slowFunction(1), slowFunction(2), slowFunction(3)];
  const results = await Promise.all(promises);
  const totalTime = Date.now() - start;
  console.log(
    `[Main] All tasks completed in ${totalTime}ms (should be ~2000ms if truly parallel)`
  );
  console.log(`[Main] Results:`, results);
  console.log("");

  // Test the other functions
  console.log("=== Function Tests ===");
  console.log("Fibonacci(10):", await fibonacci(10));
  console.log(
    "Process array:",
    await processArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  );

  // Test shared memory
  const sharedBuffer = new SharedArrayBuffer(16);
  const view = new Int32Array(sharedBuffer);
  view[0] = 10;
  view[1] = 20;
  view[2] = 30;
  view[3] = 40;

  console.log("Shared memory sum:", await sharedMemoryOperation(sharedBuffer));
}

main().catch(console.error);
