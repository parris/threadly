#!/usr/bin/env node

import { Command } from "commander";
import {
  transformWithThreadly,
  ThreadlyTransformerOptions,
} from "./transformer-plugin";
import * as path from "path";
import * as fs from "fs";
import * as glob from "glob";

const program = new Command();

program
  .name("threadly")
  .description("Transform TypeScript files with Threadly annotations")
  .version("0.0.1");

program
  .command("transform")
  .description("Transform TypeScript files")
  .argument("<files>", "Files to transform (glob pattern)")
  .option(
    "-o, --output-dir <dir>",
    "Output directory for workers",
    "./dist/workers"
  )
  .option("-b, --base-dir <dir>", "Base directory for source files", "./src")
  .option("-t, --target <target>", "TypeScript target", "es2020")
  .option("-m, --module <module>", "Module system", "commonjs")
  .option("--source-map", "Generate source maps", false)
  .option(
    "--dry-run",
    "Show what would be transformed without writing files",
    false
  )
  .action(async (files: string, options: any) => {
    try {
      const transformerOptions: ThreadlyTransformerOptions = {
        outputDir: options.outputDir,
        baseDir: options.baseDir,
        target: options.target,
        module: options.module,
        sourceMap: options.sourceMap,
      };

      // Find files matching the glob pattern
      const matchedFiles = glob.sync(files, {
        cwd: process.cwd(),
        absolute: true,
      });

      if (matchedFiles.length === 0) {
        console.warn(`No files found matching pattern: ${files}`);
        return;
      }

      console.log(`Found ${matchedFiles.length} files to transform:`);
      matchedFiles.forEach((file) => console.log(`  - ${file}`));

      let totalWorkers = 0;

      for (const file of matchedFiles) {
        console.log(`\nTransforming: ${file}`);

        try {
          const result = transformWithThreadly(file, transformerOptions);

          if (result.workerConfigs.length > 0) {
            console.log(
              `  Generated ${result.workerConfigs.length} worker(s):`
            );
            result.workerConfigs.forEach((config) => {
              console.log(`    - ${config.filePath}`);
              totalWorkers += 1;
            });

            if (!options.dryRun) {
              // Ensure output directory exists
              const outputDir = path.resolve(transformerOptions.outputDir!);
              if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
              }

              // Write worker files
              for (const config of result.workerConfigs) {
                fs.writeFileSync(config.filePath, config.sourceCode);
                console.log(`    ✓ Written: ${config.filePath}`);
              }
            }
          } else {
            console.log(`  No workers generated`);
          }

          if (!options.dryRun) {
            // Write transformed source back to file
            fs.writeFileSync(file, result.modifiedSource);
            console.log(`  ✓ Updated: ${file}`);
          }
        } catch (error) {
          console.error(`  ✗ Error transforming ${file}:`, error);
        }
      }

      console.log(`\nTransformation complete!`);
      console.log(`Total workers generated: ${totalWorkers}`);

      if (options.dryRun) {
        console.log(`(Dry run - no files were actually written)`);
      }
    } catch (error) {
      console.error("Transformation failed:", error);
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Initialize Threadly configuration")
  .option(
    "-t, --type <type>",
    "Project type (typescript, webpack, vite)",
    "typescript"
  )
  .action(async (options: any) => {
    const configs = {
      typescript: {
        "tsconfig.json": {
          compilerOptions: {
            target: "es2020",
            module: "commonjs",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
          },
          plugins: [
            {
              transform: "@deca-inc/threadly/transformer-plugin",
              options: {
                outputDir: "./dist/workers",
                baseDir: "./src",
              },
            },
          ],
        },
      },
      webpack: {
        "webpack.config.js": `const path = require('path');

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\\.ts$/,
        use: [
          {
            loader: '@deca-inc/threadly/webpack-loader',
            options: {
              outputDir: './dist/workers',
              emitWorkerFiles: true
            }
          },
          'ts-loader'
        ],
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  }
};`,
      },
      vite: {
        "vite.config.ts": `import { defineConfig } from 'vite';
import { threadly } from '@deca-inc/threadly/vite-plugin';

export default defineConfig({
  plugins: [
    threadly({
      outputDir: './dist/workers',
      emitWorkerFiles: true
    })
  ]
});`,
      },
    };

    const config = configs[options.type as keyof typeof configs];

    if (!config) {
      console.error(`Unknown project type: ${options.type}`);
      console.log("Available types: typescript, webpack, vite");
      return;
    }

    console.log(`Initializing Threadly for ${options.type} project...`);

    for (const [filename, content] of Object.entries(config)) {
      if (fs.existsSync(filename)) {
        console.log(`⚠️  ${filename} already exists, skipping...`);
        continue;
      }

      fs.writeFileSync(
        filename,
        typeof content === "string" ? content : JSON.stringify(content, null, 2)
      );
      console.log(`✓ Created: ${filename}`);
    }

    console.log("\nThreadly initialization complete!");
    console.log(
      "You can now use Threadly annotations in your TypeScript files."
    );
  });

program.parse();
