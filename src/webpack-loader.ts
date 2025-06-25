import {
  transformWithThreadly,
  ThreadlyTransformerOptions,
} from "./transformer-plugin";
import * as path from "path";

export interface ThreadlyLoaderOptions extends ThreadlyTransformerOptions {
  // Webpack-specific options
  emitWorkerFiles?: boolean;
  workerOutputPath?: string;
}

/**
 * Webpack loader for Threadly
 * Usage: { test: /\.ts$/, use: 'threadly-loader' }
 */
export default function threadlyLoader(
  this: any,
  source: string,
  sourceMap?: any
) {
  const callback = this.async();
  const options: ThreadlyLoaderOptions = this.getOptions() || {};

  try {
    // Get the source file path
    const sourceFile = this.resourcePath;

    // Determine output directory relative to webpack output
    const outputDir =
      options.workerOutputPath ||
      path.join(path.dirname(this.resourcePath), "workers");

    // Transform the source file
    const result = transformWithThreadly(sourceFile, {
      outputDir,
      baseDir: path.dirname(sourceFile),
      target: options.target || "es2020",
      module: options.module || "commonjs",
      sourceMap: options.sourceMap || false,
    });

    // If we should emit worker files, add them to webpack's asset pipeline
    if (options.emitWorkerFiles !== false) {
      result.workerConfigs.forEach((config) => {
        // Add worker file to webpack's asset pipeline
        this.emitFile(
          path.relative(outputDir, config.filePath),
          config.sourceCode,
          sourceMap
        );
      });
    }

    // Return the transformed source
    callback(null, result.modifiedSource, sourceMap);
  } catch (error) {
    callback(error as Error);
  }
}

/**
 * Webpack loader with options
 */
export function createThreadlyLoader(options?: ThreadlyLoaderOptions) {
  return function (this: any, source: string, sourceMap?: any) {
    // Set options on the loader context
    this.getOptions = () => options || {};
    return threadlyLoader.call(this, source, sourceMap);
  };
}
