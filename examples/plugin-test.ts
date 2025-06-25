import { transformWithThreadly } from "../src/transformer-plugin";

/* @threadly */
async function testFunction(x: number): Promise<number> {
  return x * 2;
}

/* @threadly pool(size=3) */
async function testPoolFunction(data: number[]): Promise<number[]> {
  return data.map((x) => x * 3);
}

async function main() {
  console.log("Testing Threadly transformer plugin...");

  try {
    const result = transformWithThreadly("./examples/plugin-test.ts", {
      outputDir: "./dist/test-workers",
      baseDir: "./examples",
    });

    console.log("✓ Transformation successful");
    console.log(`Generated ${result.workerConfigs.length} workers:`);
    result.workerConfigs.forEach((config) => {
      console.log(`  - ${config.filePath}`);
    });

    console.log("\nTransformed source preview:");
    console.log(result.modifiedSource.substring(0, 200) + "...");
  } catch (error) {
    console.error("✗ Transformation failed:", error);
  }
}

main().catch(console.error);
