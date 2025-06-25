/**
 * Threadly Worker Template
 * This file provides the basic structure for generated workers
 */

// Import Comlink for worker communication
import { expose } from "comlink";

// Worker context and utilities
interface WorkerContext {
  id: string;
  functionName: string;
}

// Global worker context
const workerContext: WorkerContext = {
  id: "",
  functionName: "",
};

/**
 * Sets up the worker context
 */
function setupWorkerContext(id: string, functionName: string): void {
  workerContext.id = id;
  workerContext.functionName = functionName;
}

/**
 * Handles worker errors
 */
function handleWorkerError(error: Error): void {
  console.error(`[Worker ${workerContext.id}] Error:`, error);
  // Send error back to main thread
  if (typeof self !== "undefined" && "postMessage" in self) {
    (self as any).postMessage({
      type: "error",
      error: error.message,
      workerId: workerContext.id,
    });
  }
}

/**
 * Worker message handler
 */
function handleMessage(event: MessageEvent): void {
  try {
    const {
      type,
      function: functionName,
      args,
      workerId,
      functionId,
    } = event.data;

    if (type === "execute") {
      // Execute the function
      const globalScope = globalThis as any;
      if (
        typeof functionName === "string" &&
        typeof globalScope[functionName] === "function"
      ) {
        const result = globalScope[functionName](...args);

        // Handle async functions
        if (result instanceof Promise) {
          result
            .then((resolvedResult) => {
              (self as any).postMessage({
                type: "result",
                result: resolvedResult,
                workerId: workerContext.id,
              });
            })
            .catch((error) => {
              handleWorkerError(error);
            });
        } else {
          (self as any).postMessage({
            type: "result",
            result,
            workerId: workerContext.id,
          });
        }
      } else {
        throw new Error(`Function ${functionName} not found or not callable`);
      }
    }
  } catch (error) {
    handleWorkerError(error as Error);
  }
}

// Set up message listener
if (typeof self !== "undefined") {
  self.addEventListener("message", handleMessage);

  // Handle errors
  self.addEventListener("error", (event) => {
    handleWorkerError(new Error(event.message || "Unknown worker error"));
  });

  // Handle unhandled promise rejections
  self.addEventListener("unhandledrejection", (event) => {
    handleWorkerError(new Error(event.reason || "Unhandled promise rejection"));
  });
}

/**
 * Exposes a function to the main thread using Comlink
 */
function exposeFunction<TArgs extends any[], TReturn>(
  functionName: string,
  fn: (...args: TArgs) => TReturn | Promise<TReturn>
): void {
  setupWorkerContext(`worker-${Date.now()}`, functionName);

  // Expose the function using Comlink
  expose(fn);

  // Also make it available globally for direct execution
  (globalThis as any)[functionName] = fn;
}

// Export the template utilities
export { exposeFunction, setupWorkerContext, handleWorkerError };
