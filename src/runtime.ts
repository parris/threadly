import {
  WorkerInstance,
  WorkerPool,
  ThreadlyContext,
  RuntimeOptions,
} from "./types";

const isNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

// Node.js SharedWorker polyfill
let NodeSharedWorker: any = null;
let sharedWorkers: Map<string, { worker: any; ports: Set<any> }> = new Map();
if (isNode) {
  const { Worker, MessageChannel } = require("worker_threads");
  // Map to ensure singleton per worker script
  NodeSharedWorker = class {
    public port: any;
    private shared: any;
    constructor(workerPath: string, options: any) {
      let shared = sharedWorkers.get(workerPath);
      if (!shared) {
        const worker = new Worker(workerPath, { eval: false });
        shared = { worker, ports: new Set() };
        sharedWorkers.set(workerPath, shared);
        // Broadcast from worker to all ports
        worker.on("message", (data: any) => {
          for (const port of shared!.ports) {
            port.postMessage(data);
          }
        });
      }
      this.shared = shared;
      // Each client gets a MessageChannel port
      const { port1, port2 } = new MessageChannel();
      shared.ports.add(port1);
      // Forward messages from port to worker
      port1.on("message", (data: any) => {
        shared!.worker.postMessage(data);
      });
      // Remove port on close
      port1.on("close", () => {
        shared!.ports.delete(port1);
        // If no more ports, terminate the worker
        if (shared!.ports.size === 0) {
          shared!.worker.terminate();
          sharedWorkers.delete(workerPath);
        }
      });
      this.port = port1;
    }
  };
}

// Global cleanup function for shared workers
function cleanupSharedWorkers() {
  if (isNode && sharedWorkers) {
    for (const [path, shared] of sharedWorkers) {
      for (const port of shared.ports) {
        port.close();
      }
      shared.worker.terminate();
    }
    sharedWorkers.clear();
  }
}

/**
 * Runtime utilities for managing Threadly workers
 */
export class ThreadlyRuntime {
  private context: ThreadlyContext;

  constructor(baseDir: string) {
    this.context = {
      workers: new Map(),
      configs: new Map(),
      baseDir,
    };
  }

  /**
   * Creates a basic worker
   */
  async createWorker(
    workerPath: string,
    options: RuntimeOptions = {}
  ): Promise<WorkerInstance> {
    let worker: any;
    if (isNode) {
      // Use worker_threads in Node.js
      const { Worker } = await import("worker_threads");
      worker = new Worker(workerPath, {
        eval: false,
      });
      // Polyfill browser-like API
      const messageListeners: Array<(event: any) => void> = [];
      const errorListeners: Array<(event: any) => void> = [];
      worker.on("message", (data: any) => {
        messageListeners.forEach((fn) => fn({ data } as any));
      });
      worker.on("error", (err: any) => {
        errorListeners.forEach((fn) => fn(err as any));
      });
      return {
        postMessage: (data: any) => worker.postMessage(data),
        terminate: () => {
          // Close all ports first
          for (const port of messageListeners) {
            // Remove listeners
          }
          messageListeners.length = 0;
          errorListeners.length = 0;
          // Terminate the worker
          worker.terminate();
        },
        get onmessage() {
          return messageListeners[0] || null;
        },
        set onmessage(fn: ((event: any) => void) | null) {
          messageListeners.length = 0;
          if (fn) messageListeners.push(fn);
        },
        get onerror() {
          return errorListeners[0] || null;
        },
        set onerror(fn: ((event: any) => void) | null) {
          errorListeners.length = 0;
          if (fn) errorListeners.push(fn);
        },
      };
    } else {
      // Browser Worker
      worker = new (globalThis as any).Worker(workerPath, {
        type: "module",
        name: `threadly-worker-${Date.now()}`,
      });
      const workerInstance: WorkerInstance = {
        postMessage: (data: any, transfer?: any[]) => {
          if (transfer) {
            worker.postMessage(data, transfer);
          } else {
            worker.postMessage(data);
          }
        },
        onmessage: null,
        onerror: null,
        terminate: () => {
          worker.terminate();
        },
      };
      worker.onmessage = (event: any) => {
        if (workerInstance.onmessage) {
          workerInstance.onmessage(event);
        }
      };
      worker.onerror = (error: any) => {
        if (workerInstance.onerror) {
          workerInstance.onerror(error);
        }
      };
      return workerInstance;
    }
  }

  /**
   * Creates a worker pool
   */
  async createWorkerPool(
    workerPath: string,
    poolSize: number,
    options: RuntimeOptions = {}
  ): Promise<WorkerPool> {
    const workers: WorkerInstance[] = [];
    const available: WorkerInstance[] = [];
    const busy: WorkerInstance[] = [];

    // Create workers
    for (let i = 0; i < poolSize; i++) {
      const worker = await this.createWorker(workerPath, options);
      workers.push(worker);
      available.push(worker);
    }

    const pool: WorkerPool = {
      workers,
      available,
      busy,
      maxSize: poolSize,
    };

    return pool;
  }

  /**
   * Gets an available worker from a pool
   */
  async getWorkerFromPool(pool: WorkerPool): Promise<WorkerInstance> {
    if (pool.available.length === 0) {
      // Wait for a worker to become available
      return new Promise((resolve) => {
        const checkAvailable = () => {
          if (pool.available.length > 0) {
            const worker = pool.available.shift()!;
            pool.busy.push(worker);
            resolve(worker);
          } else {
            setTimeout(checkAvailable, 10);
          }
        };
        checkAvailable();
      });
    }

    const worker = pool.available.shift()!;
    pool.busy.push(worker);
    return worker;
  }

  /**
   * Returns a worker to the pool
   */
  returnWorkerToPool(pool: WorkerPool, worker: WorkerInstance): void {
    const busyIndex = pool.busy.indexOf(worker);
    if (busyIndex !== -1) {
      pool.busy.splice(busyIndex, 1);
      pool.available.push(worker);
    }
  }

  /**
   * Creates a shared memory worker
   */
  async createSharedWorker(
    workerPath: string,
    options: RuntimeOptions = {}
  ): Promise<WorkerInstance> {
    if (isNode) {
      // Use NodeSharedWorker polyfill
      const sharedWorker = new NodeSharedWorker(workerPath, {});
      sharedWorker.port.start();
      const worker: WorkerInstance = {
        postMessage: (data: any, transfer?: any[]) => {
          if (transfer) {
            sharedWorker.port.postMessage(data, transfer);
          } else {
            sharedWorker.port.postMessage(data);
          }
        },
        onmessage: null,
        onerror: null,
        terminate: () => {
          // Close the port which will trigger cleanup
          sharedWorker.port.close();
        },
      };
      sharedWorker.port.on("message", (event: any) => {
        if (worker.onmessage) {
          worker.onmessage(new MessageEvent("message", { data: event }));
        }
      });
      sharedWorker.port.on("error", (error: any) => {
        if (worker.onerror) {
          worker.onerror(error);
        }
      });
      return worker;
    } else {
      // Browser SharedWorker
      const sharedWorker = new (globalThis as any).SharedWorker(workerPath, {
        type: "module",
        name: `threadly-shared-worker-${Date.now()}`,
      });
      sharedWorker.port.start();
      const worker: WorkerInstance = {
        postMessage: (data: any, transfer?: any[]) => {
          if (transfer) {
            sharedWorker.port.postMessage(data, transfer);
          } else {
            sharedWorker.port.postMessage(data);
          }
        },
        onmessage: null,
        onerror: null,
        terminate: () => {
          sharedWorker.port.close();
        },
      };
      sharedWorker.port.onmessage = (event: any) => {
        if (worker.onmessage) {
          worker.onmessage(event);
        }
      };
      return worker;
    }
  }

  /**
   * Executes a function in a worker
   */
  async executeInWorker<TArgs extends any[], TReturn>(
    worker: WorkerInstance,
    functionName: string,
    args: TArgs
  ): Promise<TReturn> {
    return new Promise((resolve, reject) => {
      const originalOnMessage = worker.onmessage;

      worker.onmessage = (event: MessageEvent) => {
        worker.onmessage = originalOnMessage;

        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          // Log thread information if available
          if (event.data.processId || event.data.threadId) {
            console.log(
              `[Runtime] Worker execution completed - PID: ${
                event.data.processId || "N/A"
              }, Thread: ${event.data.threadId || "N/A"}`
            );
          }
          resolve(event.data.result);
        }
      };

      worker.postMessage({
        type: "execute",
        function: functionName,
        args,
      });
    });
  }

  /**
   * Creates a shared memory buffer and passes it to workers
   */
  createSharedBuffer(size: number): SharedArrayBuffer {
    return new SharedArrayBuffer(size);
  }

  /**
   * Transfers data to a worker using transferable objects
   */
  transferToWorker<T>(
    worker: WorkerInstance,
    data: T,
    transferables: any[]
  ): void {
    worker.postMessage(data, transferables);
  }

  /**
   * Processes a message in the worker context
   */
  private processMessage(message: any): any {
    if (message.type === "execute") {
      // In a real worker, this would execute the actual function
      // For now, we'll simulate the result
      return {
        result: `Processed: ${message.function}(${message.args.join(", ")})`,
      };
    }
    return message;
  }

  /**
   * Terminates all workers in the context
   */
  async terminateAll(): Promise<void> {
    for (const [id, workerOrPool] of this.context.workers) {
      if ("maxSize" in workerOrPool) {
        // It's a pool
        for (const worker of workerOrPool.workers) {
          worker.terminate();
        }
      } else {
        // It's a single worker
        workerOrPool.terminate();
      }
    }

    this.context.workers.clear();

    // Clean up shared workers
    cleanupSharedWorkers();
  }

  /**
   * Gets the runtime context
   */
  getContext(): ThreadlyContext {
    return this.context;
  }

  /**
   * Registers a worker in the context
   */
  registerWorker(id: string, worker: WorkerInstance | WorkerPool): void {
    this.context.workers.set(id, worker);
  }

  /**
   * Unregisters a worker from the context
   */
  unregisterWorker(id: string): void {
    this.context.workers.delete(id);
  }

  /**
   * Gets a worker by ID from the context
   */
  getWorker(id: string): WorkerInstance | WorkerPool | undefined {
    return this.context.workers.get(id);
  }
}
