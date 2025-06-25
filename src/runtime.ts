import {
  WorkerInstance,
  WorkerPool,
  ThreadlyContext,
  RuntimeOptions,
} from "./types";

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
    // In a real implementation, this would create an actual Worker
    // For now, we'll create a mock worker that simulates the behavior
    const worker = {
      postMessage: (data: any) => {
        // Simulate worker processing
        setTimeout(() => {
          if (worker.onmessage) {
            worker.onmessage({ data: this.processMessage(data) });
          }
        }, 10);
      },
      onmessage: null as any,
      terminate: () => {
        // Cleanup
      },
    };

    return worker;
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
    const worker = await this.createWorker(workerPath, options);

    // Add shared memory support
    if (options.shared) {
      // In a real implementation, this would set up SharedArrayBuffer
      // For now, we'll just return the regular worker
    }

    return worker;
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

      worker.onmessage = (event: any) => {
        worker.onmessage = originalOnMessage;
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
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
  }

  /**
   * Gets the runtime context
   */
  getContext(): ThreadlyContext {
    return this.context;
  }
}
