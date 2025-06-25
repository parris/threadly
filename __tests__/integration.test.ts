import { Threadly, createThreadly } from "../src/index";
import * as fs from "fs";
import * as path from "path";

describe("Threadly Integration", () => {
  let threadly: Threadly;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    threadly = createThreadly({
      outputDir: tempDir,
      baseDir: __dirname,
    });
  });

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Complete workflow", () => {
    it("should transform file and create workers", async () => {
      const sourceCode = `
/* @threadly */
async function add(a: number, b: number): Promise<number> {
  return a + b;
}

/* @threadly */
async function multiply(a: number, b: number): Promise<number> {
  return a * b;
}

/* @threadly pool(size=2) */
async function processData(data: number[]): Promise<number[]> {
  return data.map(x => x * 2);
}
      `;

      const sourceFile = path.join(tempDir, "test.ts");
      fs.writeFileSync(sourceFile, sourceCode);

      const result = await threadly.transformFile(sourceFile);

      expect(result.workerConfigs).toHaveLength(3);
      expect(result.modifiedSource).toContain("import");

      // Check that worker files were created
      const workersDir = path.join(tempDir, "workers");
      expect(fs.existsSync(workersDir)).toBe(true);

      const workerFiles = fs.readdirSync(workersDir);
      expect(workerFiles.length).toBeGreaterThan(0);
    });

    it("should handle different annotation types correctly", async () => {
      const sourceCode = `
/* @threadly */
async function basicFunction(x: number): Promise<number> {
  return x + 1;
}

/* @threadly */
async function asyncFunction(x: number): Promise<number> {
  return x * 2;
}

/* @threadly pool(size=3) */
async function poolFunction(x: number): Promise<number> {
  return x ** 2;
}

/* @threadly shared */
async function sharedFunction(x: number): Promise<number> {
  return x / 2;
}
      `;

      const sourceFile = path.join(tempDir, "test.ts");
      fs.writeFileSync(sourceFile, sourceCode);

      const result = await threadly.transformFile(sourceFile);

      const configs = result.workerConfigs;
      expect(configs).toHaveLength(4);

      // Check basic function
      const basicConfig = configs.find(
        (c) => c.functionName === "basicFunction"
      );
      expect(basicConfig?.annotation.type).toBe("basic");

      // Check async function
      const asyncConfig = configs.find(
        (c) => c.functionName === "asyncFunction"
      );
      expect(asyncConfig?.annotation.type).toBe("basic");

      // Check pool function
      const poolConfig = configs.find((c) => c.functionName === "poolFunction");
      expect(poolConfig?.annotation.type).toBe("pool");
      expect(poolConfig?.annotation.poolSize).toBe(3);

      // Check shared function
      const sharedConfig = configs.find(
        (c) => c.functionName === "sharedFunction"
      );
      expect(sharedConfig?.annotation.type).toBe("shared");
      expect(sharedConfig?.annotation.shared).toBe(true);
    });
  });

  describe("Worker management", () => {
    it("should create and manage workers", async () => {
      const worker = await threadly.createWorker("/path/to/worker.js");
      expect(worker).toBeDefined();

      const pool = await threadly.createWorkerPool("/path/to/worker.js", 2);
      expect(pool.maxSize).toBe(2);

      await threadly.terminateAll();
    });

    it("should maintain context across operations", () => {
      const context = threadly.getContext();
      expect(context).toBeDefined();
      expect(context.baseDir).toBe(__dirname);
    });
  });

  describe("Error handling", () => {
    it("should handle non-existent files gracefully", async () => {
      const nonExistentFile = path.join(tempDir, "nonexistent.ts");

      await expect(threadly.transformFile(nonExistentFile)).rejects.toThrow();
    });

    it("should handle files without annotations", async () => {
      const sourceCode = `
function regularFunction(x: number): number {
  return x + 1;
}
      `;

      const sourceFile = path.join(tempDir, "test.ts");
      fs.writeFileSync(sourceFile, sourceCode);

      const result = await threadly.transformFile(sourceFile);
      expect(result.workerConfigs).toHaveLength(0);
    });
  });

  describe("createThreadly function", () => {
    it("should create Threadly instance with default options", () => {
      const instance = createThreadly({
        outputDir: tempDir,
        baseDir: __dirname,
      });

      expect(instance).toBeInstanceOf(Threadly);
    });

    it("should create Threadly instance with custom options", () => {
      const instance = createThreadly({
        outputDir: tempDir,
        baseDir: __dirname,
        target: "es2015",
        module: "esnext",
        sourceMap: true,
      });

      expect(instance).toBeInstanceOf(Threadly);
    });
  });
});
