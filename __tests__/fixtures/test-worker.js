// Test worker for Threadly runtime tests
const { parentPort } = require("worker_threads");

// Handle messages from main thread
parentPort.on("message", (data) => {
  if (data.type === "execute") {
    // Simulate function execution
    const result = `Processed: ${data.function}(${data.args.join(", ")})`;
    parentPort.postMessage({ result });
  } else {
    // Echo back the message
    parentPort.postMessage({ data });
  }
});

// Handle errors
parentPort.on("error", (error) => {
  parentPort.postMessage({ error: error.message });
});

// Handle cleanup when parent port closes
parentPort.on("close", () => {
  console.log("Test worker shutting down");
  process.exit(0);
});

console.log("Test worker started");
