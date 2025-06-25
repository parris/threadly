import * as ts from "typescript";
import { ThreadlyTransformer } from "./transformer";

export interface ThreadlyTransformerOptions {
  outputDir?: string;
  baseDir?: string;
  target?: "es2020" | "es2015" | "es5";
  module?: "commonjs" | "esnext";
  sourceMap?: boolean;
}

/**
 * TypeScript transformer plugin for Threadly
 * Can be used in tsconfig.json or programmatically
 */
export function threadlyTransformer(options: ThreadlyTransformerOptions = {}) {
  const defaultOptions = {
    outputDir: "./dist/workers",
    baseDir: "./src",
    target: "es2020" as const,
    module: "commonjs" as const,
    sourceMap: false,
    ...options,
  };

  const transformer = new ThreadlyTransformer(defaultOptions);

  return (context: ts.TransformationContext) => {
    return (rootNode: ts.SourceFile) => {
      // Transform the source file
      const result = transformer.transform(rootNode.fileName);

      // Compile workers
      transformer.compileWorkers(result.workerConfigs);

      // Return the transformed source
      return rootNode;
    };
  };
}

/**
 * Factory function for TypeScript compiler API
 */
export function createThreadlyTransformer(
  options?: ThreadlyTransformerOptions
) {
  return threadlyTransformer(options);
}

/**
 * Programmatic transformer for advanced use cases
 */
export function transformWithThreadly(
  sourceFile: string,
  options?: ThreadlyTransformerOptions
) {
  const transformer = new ThreadlyTransformer({
    outputDir: "./dist/workers",
    baseDir: "./src",
    target: "es2020",
    module: "commonjs",
    sourceMap: false,
    ...options,
  });

  return transformer.transform(sourceFile);
}
