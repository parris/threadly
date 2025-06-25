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

// Main execution
async function main() {
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

  // Test the functions
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

  // For shared memory, we'd need a SharedArrayBuffer
  // const sharedBuffer = new SharedArrayBuffer(1024);
  // console.log("Shared buffer processing:", await processSharedBuffer(sharedBuffer));
}

main().catch(console.error);
