# Threadly

A TypeScript transformer that allows you to inline threaded functions with annotations for worker extraction, pools, and shared memory. 

**Why?** I wanted a threading system that resembles other languages a bit more. I've felt that creating
a separate worker file causes significant indirection and requires a fair amount of planning and tinkering
with build systems. I knew how to build this, I knew the API I wanted but I honestly did not want to trudge
through it all before. With Cursor, Claude another other LLMs I decided to vibe my way to success a bit here
and see if other people like the ergonomics here too before proceeding.

## Features

- **Inline Annotations**: Use simple comments to mark functions for worker extraction
- **Worker Pools**: Automatically create and manage worker pools
- **Shared Memory**: Support for SharedArrayBuffer and shared memory operations
- **Build Tool Integration**: Works with TypeScript, Webpack, and Vite
- **Type Safety**: Full TypeScript support with proper type checking

## Installation

```bash
npm install @deca-inc/threadly ts-patch
```

**Note**: The TypeScript transformer plugin requires `ts-patch` (TypeScript with transformer support) to work properly. Regular TypeScript does not support transformer plugins.

## Quick Start

### 1. Basic Usage

```typescript
/* @threadly */
async function fibonacci(n: number): Promise<number> {
  if (n <= 1) return n;
  return (await fibonacci(n - 1)) + (await fibonacci(n - 2));
}

/* @threadly pool(size=4) */
async function processArray(arr: number[]): Promise<number[]> {
  return arr.map(x => x * 2).filter(x => x > 10);
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
```

### 2. Build Tool Integration

Choose your preferred build tool:

#### TypeScript Transformer Plugin

**Prerequisite**: Install `ts-patch` for transformer support:
```bash
npm install ts-patch
```

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "plugins": [
      {
        "transform": "@deca-inc/threadly/transformer-plugin",
        "options": {
          "outputDir": "./dist/workers",
          "baseDir": "./src"
        }
      }
    ]
  }
}
```

**Important**: This use ts-patch plugins, which are nested under compiler options. These are separate from typescript plugins which sit at the root of tsconfig. You can still use `tsc` to compile with transformer support (ts-patch patches TypeScript automatically):
```bash
# ts-patch automatically patches TypeScript, so you can use tsc normally
tsc
```

**Note**: The transformer plugin exports a default function that can be used directly in `tsconfig.json`. This allows TypeScript to properly load and execute the transformer during compilation.

You can also use the transformer programmatically:

```typescript
import { threadlyTransformer } from '@deca-inc/threadly/transformer-plugin';

const transformer = threadlyTransformer({
  outputDir: './dist/workers',
  baseDir: './src',
  target: 'es2020',
  module: 'commonjs',
  sourceMap: false
});
```

#### Webpack Loader

Add to your `webpack.config.js`:

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: '@deca-inc/threadly/webpack-loader',
            options: {
              outputDir: './dist/workers',
              emitWorkerFiles: true
            }
          },
          'ts-loader'
        ]
      }
    ]
  }
};
```

#### Vite Plugin

Add to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { threadly } from '@deca-inc/threadly/vite-plugin';

export default defineConfig({
  plugins: [
    threadly({
      outputDir: './dist/workers',
      emitWorkerFiles: true
    })
  ]
});
```

### 3. CLI Tool

For manual transformations:

```bash
# Transform specific files
npx @deca-inc/threadly transform "src/**/*.ts"

# Initialize project configuration
npx @deca-inc/threadly init --type typescript
npx @deca-inc/threadly init --type webpack
npx @deca-inc/threadly init --type vite
```

### 4. Using ts-patch

When using the TypeScript transformer plugin, you need to use `ts-patch` to enable transformer support:

```bash
# Install ts-patch
npm install ts-patch

# ts-patch automatically patches TypeScript during postinstall
# You can now use tsc normally
tsc

# Or add to your package.json scripts
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

**Why ts-patch?** Regular TypeScript doesn't support transformer plugins. `ts-patch` patches TypeScript to add transformer support, allowing plugins like Threadly to modify your code during compilation. It's the modern replacement for `ttypescript` and works with TypeScript 5+.

## Annotation Types

### Basic Worker
```typescript
/* @threadly */
async function myFunction(): Promise<void> {
  // This function will run in a separate worker
}
```

### Worker Pool
```typescript
/* @threadly pool(size=4) */
async function processData(data: any[]): Promise<any[]> {
  // This function will use a pool of 4 workers
}
```

### Shared Memory
```typescript
/* @threadly shared */
async function sharedOperation(buffer: SharedArrayBuffer): Promise<number> {
  // This function can access shared memory
}
```

### Combined Annotations
```typescript
/* @threadly pool(size=10) shared */
async function complexOperation(data: SharedArrayBuffer): Promise<void> {
  // Pool of 10 workers with shared memory access
}
```

## Advanced Examples

### WebSocket Chat Server with Worker Pools

```typescript
import { WebSocketServer } from 'ws';

const chatLog: string[] = [];
const sharedBuffer = new SharedArrayBuffer(1024 * 1024); // 1MB shared memory

/* @threadly pool(size=10) shared */
async function handleConnection(ws: any, sharedData: SharedArrayBuffer): Promise<void> {
  ws.on('message', (message: string) => {
    chatLog.push(message);
    // Broadcast to all clients
  });
}

/* @threadly pool(size=5) shared */
async function processMessage(message: string, sharedData: SharedArrayBuffer): Promise<string> {
  // Process message with shared memory access
  return `Processed: ${message}`;
}

const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws) => {
  handleConnection(ws, sharedBuffer);
});
```

### Mathematical Operations with External Libraries

```typescript
import { evaluate } from 'mathjs';

/* @threadly */
async function complexCalculation(expression: string): Promise<number> {
  return evaluate(expression);
}

/* @threadly pool(size=4) */
async function batchCalculations(expressions: string[]): Promise<number[]> {
  return expressions.map(expr => evaluate(expr));
}
```

## API Reference

### Programmatic Usage

```typescript
import { createThreadly } from '@deca-inc/threadly';

const threadly = createThreadly({
  outputDir: './dist/workers',
  baseDir: './src'
});

// Transform a file
const result = await threadly.transformFile('./src/myfile.ts');

// Create a worker
const worker = await threadly.createWorker('myFunction');

// Create a worker pool
const pool = await threadly.createWorkerPool('myFunction', 4);
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outputDir` | string | `./dist/workers` | Directory for generated worker files |
| `baseDir` | string | `./src` | Base directory for source files |
| `target` | string | `es2020` | TypeScript target version |
| `module` | string | `commonjs` | Module system |
| `sourceMap` | boolean | `false` | Generate source maps |

## Troubleshooting

### Transformer Plugin Issues

If the TypeScript transformer plugin doesn't work in your `tsconfig.json`, try these solutions:

1. **Install ts-patch**: Make sure you have `ts-patch` installed:
   ```bash
   npm install ts-patch
   ```

2. **Use tsc normally**: With ts-patch, you can use `tsc` normally (no need for ttsc):
   ```bash
   # ts-patch automatically patches TypeScript
   tsc
   ```

3. **Ensure plugins are under compilerOptions**: The plugins section must be under `compilerOptions`, not at the root level:
   ```json
   {
     "compilerOptions": {
       "plugins": [
         {
           "transform": "@deca-inc/threadly/transformer-plugin"
         }
       ]
     }
   }
   ```

4. **Check TypeScript version**: Make sure you're using TypeScript 5+ which is fully supported by ts-patch.

5. **Verify plugin path**: Ensure the path `@deca-inc/threadly/transformer-plugin` resolves correctly in your project.

6. **Alternative usage**: If the plugin still doesn't work, you can use it programmatically:

```typescript
import { threadlyTransformer } from '@deca-inc/threadly/transformer-plugin';

// Use in your build script
const transformer = threadlyTransformer({
  outputDir: './dist/workers',
  baseDir: './src'
});
```

7. **Check for conflicts**: Ensure no other transformers are conflicting with Threadly.

### Common Error Messages

- **"Cannot find module '@deca-inc/threadly/transformer-plugin'"**: Make sure Threadly is installed and the path is correct.
- **"Transformer plugin must export a default function"**: This should be resolved with the latest version that includes the default export.
- **"No workers generated"**: Check that your functions have the correct `@threadly` annotations.
- **"Transformers are not supported"**: Make sure you have `ts-patch` installed and it has patched TypeScript properly.

## Development

```bash
# Install dependencies
npm install

# Build the project (uses ts-patch for transformer support)
npm run build

# Run tests
npm test

# Watch mode (uses ts-patch)
npm run dev
```

**Note**: The build process uses `ts-patch` to support the transformer plugin during compilation.

## Debugging

Threadly includes convenient debugging scripts and VS Code configurations to help you debug your threaded code.

### Command Line Debugging

Use the provided npm scripts to run examples with debugging enabled:

```bash
# Debug the basic example
npm run run-example

# Debug a specific example
npm run run-example --file=thread-verification-example.ts

# Debug with break on first line
npm run run-example:break --file=websocket-chat-server.ts
```

### VS Code Debugging

The project includes pre-configured VS Code debug configurations:

1. **Open the Debug panel** (Ctrl+Shift+D / Cmd+Shift+D)
2. **Select "Debug Example"** from the dropdown
3. **Choose your example file** from the picker
4. **Set breakpoints** in your TypeScript files
5. **Press F5** to start debugging

#### Available Debug Configurations

- **"Debug Example"** - Launch any example with full debugging support
- **"Attach to Process"** - Attach to a running process on port 9229

#### Available Examples

- `basic-example.ts` - Basic threading examples
- `thread-verification-example.ts` - Thread execution verification
- `worker-with-imports.ts` - Workers with external libraries
- `websocket-chat-server.ts` - Real-time WebSocket server
- `plugin-test.ts` - Transformer plugin testing
- `import-removal-test.ts` - Import handling tests

### Manual Debugging

For manual debugging without the scripts:

```bash
# Start with debugging enabled
npx ts-node --inspect examples/basic-example.ts

# Start with break on first line
npx ts-node --inspect-brk examples/basic-example.ts

# Use custom port
npx ts-node --inspect=9230 examples/basic-example.ts
```

Then attach using VS Code's "Attach to Process" configuration.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT 
