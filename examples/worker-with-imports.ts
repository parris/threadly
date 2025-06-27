import { createThreadly } from "../src/index";
import * as math from "mathjs";

// Example functions that need imports in their workers

/* @threadly */
async function calculateStandardDeviation(values: number[]): Promise<number> {
  // This function needs the mathjs library for statistical calculations
  return Number(math.std(values));
}

/* @threadly */
async function calculateMatrixDeterminant(matrix: number[][]): Promise<number> {
  // This function needs mathjs for matrix operations
  return Number(math.det(matrix));
}

/* @threadly pool(size=2) */
async function processMultipleDatasets(
  datasets: number[][]
): Promise<number[]> {
  // This function needs mathjs for batch processing
  return datasets.map((dataset) => Number(math.mean(dataset)));
}

/* @threadly shared */
async function processSharedBuffer(buffer: SharedArrayBuffer): Promise<number> {
  // This function needs mathjs for complex calculations on shared memory
  const view = new Int32Array(buffer);
  const values = Array.from(view);

  // Calculate both mean and standard deviation
  const mean = Number(math.mean(values));
  const std = Number(math.std(values));

  return mean + std;
}

/* @threadly pool(size=3) */
async function complexMathOperation(
  id: number,
  data: number[]
): Promise<{ id: number; mean: number; std: number; variance: number }> {
  // Simulate complex mathematical operations
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const mean = Number(math.mean(data));
  const std = Number(math.std(data));
  const variance = Number(math.variance(data));

  return { id, mean, std, variance };
}

/* @threadly */
async function verifyThreadWithImports(): Promise<{
  processId: number;
  threadId?: number;
  mathjsVersion: string;
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
    mathjsVersion: math.version,
    timestamp: new Date().toISOString(),
  };
}

// Main execution
async function main() {
  console.log(
    `[Main] Process ID: ${typeof process !== "undefined" ? process.pid : "N/A"}`
  );
  console.log(`[Main] MathJS version: ${math.version}`);
  console.log(
    `[Main] Starting Threadly example with imports and thread verification...\n`
  );

  const threadly = createThreadly({
    outputDir: "./dist",
    baseDir: "./examples",
  });

  // Transform the file
  const result = await threadly.transformFile(
    "./examples/worker-with-imports.ts"
  );
  console.log("Transformed source:", result.modifiedSource);
  console.log("Worker configs:", result.workerConfigs);
  console.log("");

  // Test thread verification with imports
  console.log("=== Thread Verification with Imports Test ===");
  const threadInfo = await verifyThreadWithImports();
  console.log(`[Main] Thread verification result:`, threadInfo);
  console.log("");

  // Test parallel complex math operations
  console.log("=== Parallel Complex Math Operations Test ===");
  const start = Date.now();
  const mathPromises = [
    complexMathOperation(1, [1, 2, 3, 4, 5]),
    complexMathOperation(2, [6, 7, 8, 9, 10]),
    complexMathOperation(3, [11, 12, 13, 14, 15]),
  ];
  const mathResults = await Promise.all(mathPromises);
  const totalTime = Date.now() - start;
  console.log(
    `[Main] All math operations completed in ${totalTime}ms (should be ~1000ms if truly parallel)`
  );
  console.log(`[Main] Math results:`, mathResults);
  console.log("");

  // Test the functions
  console.log("=== Function Tests ===");
  console.log(
    "Standard deviation:",
    await calculateStandardDeviation([1, 2, 3, 4, 5])
  );
  console.log(
    "Matrix determinant:",
    await calculateMatrixDeterminant([
      [1, 2],
      [3, 4],
    ])
  );
  console.log(
    "Multiple datasets:",
    await processMultipleDatasets([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ])
  );

  // Test shared memory with math operations
  console.log("=== Shared Memory Math Test ===");
  const sharedBuffer = new SharedArrayBuffer(20);
  const view = new Int32Array(sharedBuffer);
  view[0] = 1;
  view[1] = 2;
  view[2] = 3;
  view[3] = 4;
  view[4] = 5;

  console.log(
    "Shared buffer processing:",
    await processSharedBuffer(sharedBuffer)
  );
}

main().catch(console.error);
