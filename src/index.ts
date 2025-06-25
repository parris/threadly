import { AnnotationParser } from "./parser";
import { ThreadlyTransformer } from "./transformer";
import { ThreadlyRuntime } from "./runtime";
export * from "./types";

export { AnnotationParser } from "./parser";
export { ThreadlyTransformer } from "./transformer";
export { ThreadlyRuntime } from "./runtime";

/**
 * Main Threadly class that provides a high-level API
 */
export class Threadly {
  private transformer: ThreadlyTransformer;
  private runtime: ThreadlyRuntime;

  constructor(options: {
    outputDir: string;
    baseDir: string;
    target?: "es2020" | "es2015" | "es5";
    module?: "commonjs" | "esnext";
    sourceMap?: boolean;
  }) {
    this.transformer = new ThreadlyTransformer({
      outputDir: options.outputDir,
      baseDir: options.baseDir,
      target: options.target || "es2020",
      module: options.module || "commonjs",
      sourceMap: options.sourceMap,
    });

    this.runtime = new ThreadlyRuntime(options.baseDir);
  }

  /**
   * Transforms a source file and compiles workers
   */
  async transformFile(sourceFile: string): Promise<{
    modifiedSource: string;
    workerConfigs: any[];
  }> {
    const result = this.transformer.transform(sourceFile);
    this.transformer.compileWorkers(result.workerConfigs);
    return result;
  }

  /**
   * Creates a worker for a specific function
   */
  async createWorker(workerId: string, options: any = {}): Promise<any> {
    return this.runtime.createWorker(workerId, options);
  }

  /**
   * Creates a worker pool
   */
  async createWorkerPool(
    workerId: string,
    poolSize: number,
    options: any = {}
  ): Promise<any> {
    return this.runtime.createWorkerPool(workerId, poolSize, options);
  }

  /**
   * Terminates all workers
   */
  async terminateAll(): Promise<void> {
    return this.runtime.terminateAll();
  }

  /**
   * Gets the runtime context
   */
  getContext(): any {
    return this.runtime.getContext();
  }
}

/**
 * Convenience function to create a Threadly instance
 */
export function createThreadly(options: {
  outputDir: string;
  baseDir: string;
  target?: "es2020" | "es2015" | "es5";
  module?: "commonjs" | "esnext";
  sourceMap?: boolean;
}): Threadly {
  return new Threadly(options);
}

// TypeScript transformer plugin
export {
  threadlyTransformer,
  createThreadlyTransformer,
  transformWithThreadly,
  ThreadlyTransformerOptions,
} from "./transformer-plugin";

// Webpack loader
export {
  default as threadlyLoader,
  createThreadlyLoader,
  ThreadlyLoaderOptions,
} from "./webpack-loader";

// Vite plugin
export {
  threadly as vitePlugin,
  createThreadlyPlugin,
  ThreadlyViteOptions,
} from "./vite-plugin";

// Re-export types
export type { WorkerConfig } from "./types";
