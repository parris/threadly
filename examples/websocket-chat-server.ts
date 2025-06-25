import { createThreadly } from "../src/index";
import WebSocket from "ws";
import { createServer } from "http";

// Shared memory structure for chat log
interface ChatMessage {
  id: number;
  timestamp: number;
  username: string;
  message: string;
}

interface SharedChatData {
  messages: ChatMessage[];
  nextId: number;
  maxMessages: number;
}

// Worker function to handle a single WebSocket connection
/* @threadly pool(size=10) shared */
async function handleWebSocketConnection(
  ws: WebSocket,
  sharedBuffer: SharedArrayBuffer,
  clientId: string,
  workerId?: string
): Promise<void> {
  const view = new Uint8Array(sharedBuffer);
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "welcome",
      clientId,
      workerId,
      message: "Connected to Threadly Chat Server!",
    })
  );

  // Send current chat history
  const currentData = JSON.parse(
    decoder.decode(view).replace(/\0+$/, "")
  ) as SharedChatData;
  ws.send(
    JSON.stringify({
      type: "history",
      messages: currentData.messages,
    })
  );

  // Handle incoming messages
  ws.on("message", async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      // Process message using worker pool
      const result = await processMessage(message, sharedBuffer, workerId);

      if (!result.valid) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: result.error || "Invalid message format",
          })
        );
        return;
      }

      if (result.processedMessage?.type === "chat") {
        // Add message to shared memory
        const chatData = JSON.parse(
          decoder.decode(view).replace(/\0+$/, "")
        ) as SharedChatData;

        const newMessage: ChatMessage = {
          id: chatData.nextId++,
          timestamp: result.processedMessage.timestamp,
          username: result.processedMessage.username,
          message: result.processedMessage.message,
        };

        // Add to messages array, maintaining max size
        chatData.messages.push(newMessage);
        if (chatData.messages.length > chatData.maxMessages) {
          chatData.messages.shift(); // Remove oldest message
        }

        // Update shared memory
        const updatedData = encoder.encode(JSON.stringify(chatData));
        view.set(updatedData);

        // For this example, we'll just log the message with worker info
        console.log(
          `[${clientId}] [Worker: ${workerId || "unknown"}] ${
            newMessage.username
          }: ${newMessage.message}`
        );
      } else if (result.processedMessage?.type === "system") {
        // Send system message back to client
        ws.send(JSON.stringify(result.processedMessage));
      }
    } catch (error) {
      console.error("Error processing message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        })
      );
    }
  });

  // Handle client disconnect
  ws.on("close", () => {
    console.log(
      `Client ${clientId} disconnected from worker ${workerId || "unknown"}`
    );
  });

  // Keep connection alive
  ws.on("error", (error) => {
    console.error(
      `WebSocket error for client ${clientId} on worker ${
        workerId || "unknown"
      }:`,
      error
    );
  });
}

// Worker function to process and validate messages
/* @threadly pool(size=3) shared */
async function processMessage(
  message: any,
  sharedBuffer: SharedArrayBuffer,
  workerId?: string
): Promise<{ valid: boolean; processedMessage?: any; error?: string }> {
  try {
    // Validate message structure
    if (!message.type || !message.message) {
      return { valid: false, error: "Invalid message structure" };
    }

    // Process different message types
    switch (message.type) {
      case "chat":
        // Validate chat message
        if (
          typeof message.message !== "string" ||
          message.message.length === 0
        ) {
          return { valid: false, error: "Chat message cannot be empty" };
        }
        if (message.message.length > 500) {
          return {
            valid: false,
            error: "Message too long (max 500 characters)",
          };
        }

        // Add timestamp and sanitize
        const processedMessage = {
          ...message,
          message: message.message.trim(),
          timestamp: Date.now(),
          username: message.username || "Anonymous",
        };

        console.log(
          `[Message Processing] Worker ${workerId || "unknown"} processed: ${
            processedMessage.message
          }`
        );
        return { valid: true, processedMessage };

      case "command":
        // Handle special commands
        if (message.message.startsWith("/")) {
          const command = message.message.slice(1).toLowerCase();
          switch (command) {
            case "help":
              return {
                valid: true,
                processedMessage: {
                  type: "system",
                  message: "Available commands: /help, /stats, /clear",
                },
              };
            case "stats":
              // Read current stats from shared memory
              const view = new Uint8Array(sharedBuffer);
              const decoder = new TextDecoder();
              const chatData = JSON.parse(
                decoder.decode(view).replace(/\0+$/, "")
              ) as SharedChatData;
              return {
                valid: true,
                processedMessage: {
                  type: "system",
                  message: `Chat stats: ${chatData.messages.length} messages, Next ID: ${chatData.nextId}`,
                },
              };
            default:
              return { valid: false, error: "Unknown command" };
          }
        }
        return { valid: false, error: "Invalid command format" };

      default:
        return { valid: false, error: "Unknown message type" };
    }
  } catch (error) {
    return { valid: false, error: "Message processing error" };
  }
}

// Worker function to broadcast messages to all connected clients
/* @threadly pool(size=5) shared */
async function broadcastToClients(
  clients: Set<WebSocket>,
  message: any,
  sharedBuffer: SharedArrayBuffer
): Promise<void> {
  const messageStr = JSON.stringify(message);
  const deadClients: WebSocket[] = [];

  for (const client of clients) {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      } else {
        deadClients.push(client);
      }
    } catch (error) {
      console.error("Error broadcasting to client:", error);
      deadClients.push(client);
    }
  }

  // Remove dead clients
  deadClients.forEach((client) => clients.delete(client));
}

// Main server setup
async function main() {
  const threadly = createThreadly({
    outputDir: "./dist",
    baseDir: "./examples",
  });

  // Transform the file to generate workers
  const result = await threadly.transformFile(
    "./examples/websocket-chat-server.ts"
  );
  console.log("Chat server workers generated!");

  // Initialize shared memory for chat data
  const initialChatData: SharedChatData = {
    messages: [],
    nextId: 1,
    maxMessages: 100,
  };

  const sharedBuffer = new SharedArrayBuffer(1024 * 1024); // 1MB buffer
  const view = new Uint8Array(sharedBuffer);
  const encoder = new TextEncoder();
  view.set(encoder.encode(JSON.stringify(initialChatData)));

  // Create WebSocket server
  const server = createServer();
  const wss = new (WebSocket as any).Server({ server });
  const clients = new Set<WebSocket>();
  let clientCounter = 0;

  // Handle new WebSocket connections
  wss.on("connection", async (ws: WebSocket) => {
    const clientId = `client-${++clientCounter}`;
    clients.add(ws);

    console.log(`New client connected: ${clientId}`);

    // Handle the connection in a worker thread
    try {
      await handleWebSocketConnection(
        ws,
        sharedBuffer,
        clientId,
        `worker-${clientCounter % 10}`
      );
    } catch (error) {
      console.error("Error in worker thread:", error);
      ws.close();
    }
  });

  // Start the server
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`🚀 Threadly Chat Server running on ws://localhost:${PORT}`);
    console.log(`📝 Connection handling: Pool of 10 shared workers`);
    console.log(`🔧 Message processing: Pool of 3 shared workers`);
    console.log(`📢 Broadcasting: Pool of 5 shared workers`);
    console.log(`💬 All workers share the same chat memory`);
    console.log(`🔗 Connect with: ws://localhost:${PORT}`);
    console.log(`💡 Try commands: /help, /stats`);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down chat server...");
    await threadly.terminateAll();
    server.close();
    process.exit(0);
  });
}

// Multi-client test for demonstration
async function testMultipleClients() {
  const WebSocket = require("ws");
  const clients: any[] = [];
  const clientCount = 5;

  console.log(`\n🧪 Starting ${clientCount} test clients for 10 seconds...`);

  // Create multiple clients
  for (let i = 0; i < clientCount; i++) {
    const ws = new WebSocket("ws://localhost:8080");
    const clientId = `TestClient-${i + 1}`;

    ws.on("open", () => {
      console.log(`${clientId} connected!`);

      // Send initial message
      setTimeout(() => {
        ws.send(
          JSON.stringify({
            type: "chat",
            username: clientId,
            message: `Hello from ${clientId}!`,
          })
        );
      }, 1000 + i * 200);

      // Send periodic messages every 2 seconds
      const interval = setInterval(() => {
        const messages = [
          `Random message from ${clientId}`,
          `Testing shared memory from ${clientId}`,
          `Pool worker test from ${clientId}`,
          `Message #${Date.now()} from ${clientId}`,
          `Threadly is awesome from ${clientId}!`,
        ];
        const randomMessage =
          messages[Math.floor(Math.random() * messages.length)];

        ws.send(
          JSON.stringify({
            type: "chat",
            username: clientId,
            message: randomMessage,
          })
        );
      }, 2000 + i * 300); // Stagger the intervals slightly

      // Send commands occasionally
      setTimeout(() => {
        ws.send(
          JSON.stringify({
            type: "command",
            message: "/stats",
          })
        );
      }, 5000 + i * 1000);

      // Store interval for cleanup
      ws.interval = interval;
    });

    ws.on("message", (data: Buffer) => {
      const message = JSON.parse(data.toString());
      if (message.type === "welcome") {
        console.log(
          `${clientId} received welcome from worker: ${message.workerId}`
        );
      } else if (message.type === "system") {
        console.log(`${clientId} received system message: ${message.message}`);
      }
    });

    ws.on("close", () => {
      console.log(`${clientId} disconnected`);
      if (ws.interval) clearInterval(ws.interval);
    });

    ws.on("error", (error: any) => {
      console.error(`${clientId} error:`, error.message);
    });

    clients.push(ws);
  }

  // Stop sending messages after 10 seconds
  setTimeout(() => {
    console.log("\n⏹️  Stopping message sending after 10 seconds...");
    clients.forEach((client) => {
      if (client.interval) {
        clearInterval(client.interval);
        client.interval = null;
      }
    });
  }, 10000);

  // Cleanup and disconnect after 12 seconds
  setTimeout(() => {
    console.log("\n🧹 Cleaning up test clients...");
    clients.forEach((client) => {
      if (client.interval) clearInterval(client.interval);
      client.close();
    });
  }, 12000);
}

// Run the server
if (require.main === module) {
  main().catch(console.error);

  // Start test client after a delay
  setTimeout(() => {
    testMultipleClients().catch(console.error);
  }, 2000);
}
