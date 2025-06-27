# Threadly Examples with ts-patch

This directory contains examples demonstrating how to use Threadly with `ts-patch` for TypeScript 5+ compatibility.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **ts-patch will automatically patch TypeScript** during the postinstall script.

## Examples

### Basic Example
```bash
npm run build
npm run run-basic
```

### Thread Verification Example
```bash
npm run build
npm run run-verification
```

### WebSocket Chat Server
```bash
npm run build
npm run run-websocket
```

## Development

For development with watch mode:
```bash
npm run dev
```

## Key Differences from ttypescript

- **No need for `ttsc`**: Use `tsc` normally
- **Automatic patching**: ts-patch patches TypeScript automatically
- **TypeScript 5+ support**: Full compatibility with modern TypeScript versions
- **Simpler setup**: No need to remember to use a different compiler

## Configuration

The `tsconfig.json` in this directory shows how to configure Threadly with ts-patch:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "../dist/transformer-plugin",
        "options": {
          "outputDir": "./dist/workers",
          "baseDir": ".",
          "target": "es2020",
          "module": "commonjs",
          "sourceMap": true
        }
      }
    ]
  }
}
```

**Important**: The `plugins` section must be under `compilerOptions`, not at the root level of `tsconfig.json`.

## Troubleshooting

If you encounter issues:

1. **Ensure ts-patch is installed**: `npm install ts-patch`
2. **Check TypeScript version**: Should be 5.0.0 or higher
3. **Verify patching**: ts-patch should have run during `npm install`
4. **Use `tsc` normally**: No need for `ttsc` with ts-patch
5. **Check plugin location**: Make sure plugins are under `compilerOptions` in `tsconfig.json` 
