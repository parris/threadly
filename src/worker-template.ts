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
  processId?: number;
  threadId?: number;
}

// Global worker context
const workerContext: WorkerContext = {
  id: "",
  functionName: "",
};

/**
 * Gets process and thread information
 */
function getThreadInfo(): { processId: number; threadId?: number } {
  const processId = typeof process !== "undefined" ? process.pid : 0;
  let threadId: number | undefined;

  // Try to get thread ID (Node.js only)
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const { threadId: nodeThreadId } = require("worker_threads");
      threadId = nodeThreadId;
    } catch (e) {
      // Browser environment or threadId not available
    }
  }

  return { processId, threadId };
}

/**
 * Sets up the worker context
 */
function setupWorkerContext(id: string, functionName: string): void {
  const threadInfo = getThreadInfo();
  workerContext.id = id;
  workerContext.functionName = functionName;
  workerContext.processId = threadInfo.processId;
  workerContext.threadId = threadInfo.threadId;

  // Log worker startup with thread info
  console.log(
    `[Worker ${id}] Started - PID: ${threadInfo.processId}${
      threadInfo.threadId ? `, Thread ID: ${threadInfo.threadId}` : ""
    }`
  );
}

/**
 * Handles worker errors
 */
function handleWorkerError(error: Error): void {
  const threadInfo = getThreadInfo();
  console.error(
    `[Worker ${workerContext.id}] Error (PID: ${threadInfo.processId}${
      threadInfo.threadId ? `, Thread: ${threadInfo.threadId}` : ""
    }):`,
    error
  );
  // Send error back to main thread
  if (typeof self !== "undefined" && "postMessage" in self) {
    (self as any).postMessage({
      type: "error",
      error: error.message,
      workerId: workerContext.id,
      processId: threadInfo.processId,
      threadId: threadInfo.threadId,
    });
  }
}

/**
 * Logs worker activity with thread information
 */
function logWorkerActivity(action: string, data?: any): void {
  const threadInfo = getThreadInfo();
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] [Worker ${workerContext.id}] (PID: ${threadInfo.processId}${
      threadInfo.threadId ? `, Thread: ${threadInfo.threadId}` : ""
    }) ${action}`,
    data || ""
  );
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
        const threadInfo = getThreadInfo();
        logWorkerActivity(`Executing function: ${functionName}`, { args });

        const result = globalScope[functionName](...args);

        // Handle async functions
        if (result instanceof Promise) {
          result
            .then((resolvedResult) => {
              logWorkerActivity(`Function completed: ${functionName}`, {
                result: resolvedResult,
              });
              (self as any).postMessage({
                type: "result",
                result: resolvedResult,
                workerId: workerContext.id,
                processId: threadInfo.processId,
                threadId: threadInfo.threadId,
              });
            })
            .catch((error) => {
              handleWorkerError(error);
            });
        } else {
          logWorkerActivity(`Function completed: ${functionName}`, { result });
          (self as any).postMessage({
            type: "result",
            result,
            workerId: workerContext.id,
            processId: threadInfo.processId,
            threadId: threadInfo.threadId,
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
export {
  exposeFunction,
  setupWorkerContext,
  handleWorkerError,
  getThreadInfo,
  logWorkerActivity,
};
