import { ThreadlyRuntime } from "../src/runtime";
import * as path from "path";

describe("ThreadlyRuntime", () => {
  let runtime: ThreadlyRuntime;
  const testWorkerPath = path.join(__dirname, "fixtures", "test-worker.js");

  beforeEach(() => {
    runtime = new ThreadlyRuntime("/test/base/dir");
  });

  afterEach(async () => {
    // Clean up workers after each test
    await runtime.terminateAll();
  });

  afterAll(async () => {
    // Final cleanup
    await runtime.terminateAll();
  });

  describe("createWorker", () => {
    it("should create a basic worker", async () => {
      const worker = await runtime.createWorker(testWorkerPath);

      expect(worker).toBeDefined();
      expect(typeof worker.postMessage).toBe("function");
      expect(typeof worker.terminate).toBe("function");
    });

    it("should create a worker with options", async () => {
      const worker = await runtime.createWorker(testWorkerPath, {
        shared: true,
        transferable: true,
      });

      expect(worker).toBeDefined();
    });
  });

  describe("createWorkerPool", () => {
    it("should create a worker pool with specified size", async () => {
      const pool = await runtime.createWorkerPool(testWorkerPath, 4);

      expect(pool).toBeDefined();
      expect(pool.maxSize).toBe(4);
      expect(pool.workers).toHaveLength(4);
      expect(pool.available).toHaveLength(4);
      expect(pool.busy).toHaveLength(0);
    });

    it("should create a worker pool with options", async () => {
      const pool = await runtime.createWorkerPool(testWorkerPath, 2, {
        shared: true,
      });

      expect(pool).toBeDefined();
      expect(pool.maxSize).toBe(2);
    });
  });

  describe("getWorkerFromPool", () => {
    it("should get an available worker from pool", async () => {
      const pool = await runtime.createWorkerPool(testWorkerPath, 2);

      const worker = await runtime.getWorkerFromPool(pool);

      expect(worker).toBeDefined();
      expect(pool.available).toHaveLength(1);
      expect(pool.busy).toHaveLength(1);
    });

    it("should wait for worker to become available when pool is empty", async () => {
      const pool = await runtime.createWorkerPool(testWorkerPath, 1);

      // Get the only worker
      const worker1 = await runtime.getWorkerFromPool(pool);
      expect(pool.available).toHaveLength(0);
      expect(pool.busy).toHaveLength(1);

      // Try to get another worker (should wait)
      const getWorkerPromise = runtime.getWorkerFromPool(pool);

      // Return the first worker
      runtime.returnWorkerToPool(pool, worker1);

      const worker2 = await getWorkerPromise;
      expect(worker2).toBe(worker1);
    });
  });

  describe("returnWorkerToPool", () => {
    it("should return worker to pool", async () => {
      const pool = await runtime.createWorkerPool(testWorkerPath, 2);

      const worker = await runtime.getWorkerFromPool(pool);
      expect(pool.available).toHaveLength(1);
      expect(pool.busy).toHaveLength(1);

      runtime.returnWorkerToPool(pool, worker);
      expect(pool.available).toHaveLength(2);
      expect(pool.busy).toHaveLength(0);
    });

    it("should handle returning worker that is not in busy list", async () => {
      const pool = await runtime.createWorkerPool(testWorkerPath, 1);

      const worker = pool.workers[0];
      runtime.returnWorkerToPool(pool, worker);

      // Should not cause any issues
      expect(pool.available).toHaveLength(1);
      expect(pool.busy).toHaveLength(0);
    });
  });

  describe("createSharedWorker", () => {
    it("should create a shared worker", async () => {
      const worker = await runtime.createSharedWorker(testWorkerPath, {
        shared: true,
      });

      expect(worker).toBeDefined();
    });
  });

  describe("executeInWorker", () => {
    it("should execute function in worker", async () => {
      const worker = await runtime.createWorker(testWorkerPath);

      const result = await runtime.executeInWorker(
        worker,
        "testFunction",
        [1, 2]
      );

      expect(result).toContain("Processed: testFunction(1, 2)");
    });

    it("should handle worker errors", async () => {
      const worker = await runtime.createWorker(testWorkerPath);

      // Mock worker to return error
      const originalPostMessage = worker.postMessage;
      worker.postMessage = (data: any) => {
        setTimeout(() => {
          if (worker.onmessage) {
            worker.onmessage(
              new MessageEvent("message", { data: { error: "Test error" } })
            );
          }
        }, 10);
      };

      await expect(
        runtime.executeInWorker(worker, "testFunction", [1, 2])
      ).rejects.toThrow("Test error");

      // Restore original
      worker.postMessage = originalPostMessage;
    });
  });

  describe("terminateAll", () => {
    it("should terminate all workers", async () => {
      const worker1 = await runtime.createWorker(testWorkerPath);
      const worker2 = await runtime.createWorker(testWorkerPath);
      const pool = await runtime.createWorkerPool(testWorkerPath, 2);

      const context = runtime.getContext();
      context.workers.set("worker1", worker1);
      context.workers.set("worker2", worker2);
      context.workers.set("pool1", pool);

      await runtime.terminateAll();

      expect(context.workers.size).toBe(0);
    });
  });

  describe("getContext", () => {
    it("should return the runtime context", () => {
      const context = runtime.getContext();

      expect(context).toBeDefined();
      expect(context.baseDir).toBe("/test/base/dir");
      expect(context.workers).toBeInstanceOf(Map);
      expect(context.configs).toBeInstanceOf(Map);
    });
  });
});
