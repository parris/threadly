import { Plugin } from "vite";
import {
  transformWithThreadly,
  ThreadlyTransformerOptions,
} from "./transformer-plugin";
import * as path from "path";
import * as fs from "fs";

export interface ThreadlyViteOptions extends ThreadlyTransformerOptions {
  // Vite-specific options
  include?: string | RegExp | (string | RegExp)[];
  exclude?: string | RegExp | (string | RegExp)[];
  emitWorkerFiles?: boolean;
  workerOutputPath?: string;
}

/**
 * Vite plugin for Threadly
 * Usage: plugins: [threadly()]
 */
export function threadly(options: ThreadlyViteOptions = {}): Plugin {
  const {
    include = /\.ts$/,
    exclude,
    emitWorkerFiles = true,
    workerOutputPath,
    ...transformerOptions
  } = options;

  // Helper to check if file should be processed
  function shouldProcess(id: string): boolean {
    if (exclude) {
      const excludePatterns = Array.isArray(exclude) ? exclude : [exclude];
      if (
        excludePatterns.some((pattern) =>
          typeof pattern === "string" ? id.includes(pattern) : pattern.test(id)
        )
      ) {
        return false;
      }
    }

    const includePatterns = Array.isArray(include) ? include : [include];
    return includePatterns.some((pattern) =>
      typeof pattern === "string" ? id.includes(pattern) : pattern.test(id)
    );
  }

  return {
    name: "threadly",

    // Transform TypeScript files
    async transform(code: string, id: string) {
      if (!shouldProcess(id)) {
        return null;
      }

      try {
        // Determine output directory
        const outputDir =
          workerOutputPath || path.join(path.dirname(id), "workers");

        // Transform the source
        const result = transformWithThreadly(id, {
          outputDir,
          baseDir: path.dirname(id),
          target: transformerOptions.target || "es2020",
          module: transformerOptions.module || "esnext",
          sourceMap: transformerOptions.sourceMap || false,
          ...transformerOptions,
        });

        // Emit worker files if requested
        if (emitWorkerFiles && result.workerConfigs.length > 0) {
          // Ensure output directory exists
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          // Write worker files
          for (const config of result.workerConfigs) {
            fs.writeFileSync(config.filePath, config.sourceCode);
          }
        }

        // Return transformed code
        return {
          code: result.modifiedSource,
          map: null, // Vite will handle source maps
        };
      } catch (error) {
        console.error(`Threadly transform error for ${id}:`, error);
        return null;
      }
    },

    // Handle worker file resolution
    resolveId(id: string) {
      if (id.endsWith(".worker.js") || id.endsWith(".worker.ts")) {
        return id;
      }
      return null;
    },

    // Load worker files
    load(id: string) {
      if (id.endsWith(".worker.js") || id.endsWith(".worker.ts")) {
        if (fs.existsSync(id)) {
          return fs.readFileSync(id, "utf-8");
        }
      }
      return null;
    },
  };
}

/**
 * Factory function for Vite plugin with options
 */
export function createThreadlyPlugin(options?: ThreadlyViteOptions): Plugin {
  return threadly(options);
}
