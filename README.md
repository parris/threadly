# Threadly

**This work is not yet released.**

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

NOT POSSIBLE YET, check out examples first. 

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

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs"
  },
  "plugins": [
    {
      "transform": "threadly/transformer-plugin",
      "options": {
        "outputDir": "./dist/workers",
        "baseDir": "./src"
      }
    }
  ]
}
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
            loader: 'threadly/webpack-loader',
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
import { threadly } from 'threadly/vite-plugin';

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
npx threadly transform "src/**/*.ts"

# Initialize project configuration
npx threadly init --type typescript
npx threadly init --type webpack
npx threadly init --type vite
```

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
import { createThreadly } from 'threadly';

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

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT 
