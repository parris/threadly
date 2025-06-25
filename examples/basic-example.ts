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

// Main execution
async function main() {
  const threadly = createThreadly({
    outputDir: "./dist",
    baseDir: "./examples",
  });

  // Transform the file
  const result = await threadly.transformFile("./examples/basic-example.ts");
  console.log("Transformed source:", result.modifiedSource);
  console.log("Worker configs:", result.workerConfigs);

  // Test the functions
  console.log("Fibonacci(10):", await fibonacci(10));
  console.log(
    "Process array:",
    await processArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  );
}

main().catch(console.error);
