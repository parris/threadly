import { ThreadlyTransformer } from "../src/transformer";
import * as fs from "fs";
import * as path from "path";

describe("ThreadlyTransformer", () => {
  let transformer: ThreadlyTransformer;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    transformer = new ThreadlyTransformer({
      outputDir: tempDir,
      baseDir: __dirname,
      target: "es2020",
      module: "commonjs",
    });
  });

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("transform", () => {
    it("should transform basic function with @threadly annotation", () => {
      const sourceCode = `
/* @threadly */
async function testFunction(a: number, b: number): Promise<number> {
  return a + b;
}
      `;

      const sourceFile = path.join(tempDir, "test.ts");
      fs.writeFileSync(sourceFile, sourceCode);

      const result = transformer.transform(sourceFile);

      expect(result.workerConfigs).toHaveLength(1);
      expect(result.workerConfigs[0].functionName).toBe("testFunction");
      expect(result.workerConfigs[0].annotation.type).toBe("basic");
      expect(result.modifiedSource).toContain("import");
    });

    it("should transform function with pool annotation", () => {
      const sourceCode = `
/* @threadly pool(size=4) */
async function processArray(arr: number[]): Promise<number[]> {
  return arr.map(x => x * 2);
}
      `;

      const sourceFile = path.join(tempDir, "test.ts");
      fs.writeFileSync(sourceFile, sourceCode);

      const result = transformer.transform(sourceFile);

      expect(result.workerConfigs).toHaveLength(1);
      expect(result.workerConfigs[0].functionName).toBe("processArray");
      expect(result.workerConfigs[0].annotation.type).toBe("pool");
      expect(result.workerConfigs[0].annotation.poolSize).toBe(4);
    });

    it("should transform arrow function with annotation", () => {
      const sourceCode = `
/* @threadly */
const arrowFunction = async (a: number, b: number): Promise<number> => {
  return a * b;
};
      `;

      const sourceFile = path.join(tempDir, "test.ts");
      fs.writeFileSync(sourceFile, sourceCode);

      const result = transformer.transform(sourceFile);

      expect(result.workerConfigs).toHaveLength(1);
      expect(result.workerConfigs[0].functionName).toBe("arrowFunction");
    });

    it("should handle multiple annotated functions", () => {
      const sourceCode = `
/* @threadly */
async function func1(a: number): Promise<number> {
  return a * 2;
}

/* @threadly */
async function func2(b: string): Promise<string> {
  return b.toUpperCase();
}
      `;

      const sourceFile = path.join(tempDir, "test.ts");
      fs.writeFileSync(sourceFile, sourceCode);

      const result = transformer.transform(sourceFile);

      expect(result.workerConfigs).toHaveLength(2);
      expect(result.workerConfigs[0].functionName).toBe("func1");
      expect(result.workerConfigs[1].functionName).toBe("func2");
    });

    it("should ignore functions without annotations", () => {
      const sourceCode = `
function regularFunction(a: number): number {
  return a + 1;
}

/* @threadly */
async function annotatedFunction(b: number): Promise<number> {
  return b * 2;
}
      `;

      const sourceFile = path.join(tempDir, "test.ts");
      fs.writeFileSync(sourceFile, sourceCode);

      const result = transformer.transform(sourceFile);

      expect(result.workerConfigs).toHaveLength(1);
      expect(result.workerConfigs[0].functionName).toBe("annotatedFunction");
    });

    it("should throw error for non-async function declaration", () => {
      const sourceCode = `
/* @threadly */
function nonAsyncFunction(a: number): number {
  return a + 1;
}
      `;

      const sourceFile = path.join(tempDir, "test.ts");
      fs.writeFileSync(sourceFile, sourceCode);

      expect(() => {
        transformer.transform(sourceFile);
      }).toThrow(/must be async/);
    });

    it("should throw error for non-async arrow function", () => {
      const sourceCode = `
/* @threadly */
const nonAsyncArrow = (a: number): number => {
  return a + 1;
};
      `;

      const sourceFile = path.join(tempDir, "test.ts");
      fs.writeFileSync(sourceFile, sourceCode);

      expect(() => {
        transformer.transform(sourceFile);
      }).toThrow(/must be async/);
    });
  });

  describe("compileWorkers", () => {
    it("should compile worker files", () => {
      const workerConfigs = [
        {
          id: "test_worker",
          filePath: path.join(tempDir, "test_worker.js"),
          functionName: "testFunction",
          annotation: { type: "basic" as const },
          sourceCode: "function testFunction(a, b) { return a + b; }",
        },
      ];

      transformer.compileWorkers(workerConfigs);

      const workerDir = path.join(tempDir, "workers");
      expect(fs.existsSync(workerDir)).toBe(true);

      const workerFile = path.join(workerDir, "test_worker.worker.ts");
      expect(fs.existsSync(workerFile)).toBe(true);

      const workerCode = fs.readFileSync(workerFile, "utf-8");
      expect(workerCode).toContain("import { expose } from 'comlink'");
      expect(workerCode).toContain(
        "function testFunction(a, b) { return a + b; }"
      );
      expect(workerCode).toContain("expose(testFunction)");
    });

    it("should compile worker files for any function type", () => {
      const workerConfigs = [
        {
          id: "async_worker",
          filePath: path.join(tempDir, "async_worker.js"),
          functionName: "asyncFunction",
          annotation: { type: "basic" as const },
          sourceCode:
            "async function asyncFunction(url) { return await fetch(url); }",
        },
      ];

      transformer.compileWorkers(workerConfigs);

      const workerFile = path.join(
        tempDir,
        "workers",
        "async_worker.worker.ts"
      );
      const workerCode = fs.readFileSync(workerFile, "utf-8");
      expect(workerCode).toContain("expose(asyncFunction)");
    });
  });
});
