import { WebSocketServer, WebSocket } from "ws";

interface SwarmMessage {
  type: string;
  from?: string;
  to?: string;
  payload: any;
}

const clients = new Map<string, WebSocket>();
const pendingWorkerMessages: SwarmMessage[] = [];

function broadcast(msg: SwarmMessage): void {
  const data = JSON.stringify(msg);
  Array.from(clients.values()).forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function startAgentSwarmServer(port = 8383): void {
  const wss = new WebSocketServer({ port });

  wss.on("listening", () => {
    if (process.parentPort) {
      process.parentPort.postMessage({ type: "started", port });
    }
  });

  wss.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      startAgentSwarmServer(port + 1);
    } else {
      console.error("[Swarm Worker] Server error:", err);
      if (process.parentPort) {
        process.parentPort.postMessage({ type: "error", error: err.message });
      }
    }
  });

  wss.on("connection", (ws) => {
    let clientRole = "";

    ws.on("message", (rawData) => {
      try {
        const msg: SwarmMessage = JSON.parse(rawData.toString());

        if (msg.type === "register") {
          clientRole = msg.payload.role;
          clients.set(clientRole, ws);
          if (clientRole === "ui-worker") {
            for (const pending of pendingWorkerMessages.splice(0)) {
              ws.send(JSON.stringify(pending));
            }
          }
          broadcast({ type: "system", payload: { text: `Agent ${clientRole} connected.` } });
          return;
        }

        if (msg.type === "spawn_agent" && !clients.has("ui-worker")) {
          pendingWorkerMessages.push({ ...msg, from: clientRole });
          return;
        }

        if (msg.to && clients.has(msg.to)) {
          clients.get(msg.to)?.send(JSON.stringify({ ...msg, from: clientRole }));
        } else {
          broadcast({ ...msg, from: clientRole });
        }
      } catch (err) {
        console.error("[Swarm Worker] Error handling message:", err);
      }
    });

    ws.on("close", () => {
      if (clientRole) {
        clients.delete(clientRole);
        broadcast({ type: "system", payload: { text: `Agent ${clientRole} disconnected.` } });
      }
    });
  });
}

// Automatically start when the process is spawned
startAgentSwarmServer(8383);
