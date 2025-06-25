import { createThreadly } from "../src/index";
import * as math from "mathjs";
import crypto from "crypto";
import { promisify } from "util";

// This function uses mathjs - should be removed from main script
/* @threadly */
async function calculateStandardDeviation(values: number[]): Promise<number> {
  return Number(math.std(values));
}

// This function uses crypto - should be removed from main script
/* @threadly */
async function hashData(data: string): Promise<string> {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// This function uses both mathjs and promisify - should be removed from main script
/* @threadly */
async function compressAndHash(data: string): Promise<string> {
  const zlib = require("zlib");
  const gzip = promisify(zlib.gzip);
  const compressed = await gzip(Buffer.from(data, "utf8"));
  return crypto.createHash("md5").update(compressed).digest("hex");
}

// Main execution - uses createThreadly but not the other imports
async function main() {
  const threadly = createThreadly({
    outputDir: "./dist",
    baseDir: "./examples",
  });

  // Transform the file
  const result = await threadly.transformFile(
    "./examples/import-removal-test.ts"
  );
  console.log("Transformed source:", result.modifiedSource);
  console.log("Worker configs:", result.workerConfigs);

  // Test the functions
  console.log(
    "Standard deviation:",
    await calculateStandardDeviation([1, 2, 3, 4, 5])
  );
  console.log("Hash:", await hashData("Hello, Threadly!"));
  console.log("Compressed hash:", await compressAndHash("Test data"));
}

main().catch(console.error);
