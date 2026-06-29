import { ipcMain } from "electron";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

interface MCPServerConfig {
  name: string;
  type?: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

// Map from server name to its connected client instance
const clients = new Map<string, Client>();
// Map from server name to its transport
const transports = new Map<string, Transport>();

async function getOrConnectClient(config: MCPServerConfig): Promise<Client> {
  if (clients.has(config.name)) {
    return clients.get(config.name)!;
  }

  let transport: Transport;
  if (config.type === "sse") {
    if (!config.url) throw new Error("SSE MCP requires a URL");
    transport = new SSEClientTransport(new URL(config.url));
  } else {
    transport = new StdioClientTransport({
      command: config.command || "node",
      args: config.args || [],
      env: { ...process.env, ...config.env } as any,
    });
  }

  const client = new Client(
    {
      name: "codeclub",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  await client.connect(transport);

  clients.set(config.name, client);
  transports.set(config.name, transport);

  return client;
}

export function registerMcpHandlers(): void {
  ipcMain.handle("codeclub:mcp-ping", async (_, serverConfig: MCPServerConfig) => {
    try {
      // Create a fresh test connection specifically for ping
      let transport: Transport;
      if (serverConfig.type === "sse") {
        if (!serverConfig.url) throw new Error("SSE MCP requires a URL");
        transport = new SSEClientTransport(new URL(serverConfig.url));
      } else {
        transport = new StdioClientTransport({
          command: serverConfig.command || "node",
          args: serverConfig.args || [],
          env: { ...process.env, ...serverConfig.env } as any,
        });
      }

      const client = new Client(
        {
          name: "codeclub-ping",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      // We add a timeout so it doesn't hang forever
      const connectPromise = client.connect(transport);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), 15000),
      );

      await Promise.race([connectPromise, timeoutPromise]);

      const response = await client.listTools();

      // Cleanup the test client
      try {
        await client.close();
      } catch {
        // ignore close errors
      }

      return { ok: true, toolsCount: response.tools.length };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle("codeclub:mcp-list-tools", async (_, servers: MCPServerConfig[]) => {
    const allTools: any[] = [];

    for (const server of servers) {
      try {
        const client = await getOrConnectClient(server);
        const response = await client.listTools();
        // Tag tools with server name prefix to route them back correctly
        for (const tool of response.tools) {
          allTools.push({
            ...tool,
            serverName: server.name,
            originalName: tool.name,
            name: `mcp_${server.name}_${tool.name}`, // Make tool name globally unique
          });
        }
      } catch (err: any) {
        console.error(`Failed to connect or list tools for MCP server ${server.name}:`, err);
      }
    }

    return allTools;
  });

  ipcMain.handle(
    "codeclub:mcp-call-tool",
    async (_, serverName: string, toolName: string, args: any) => {
      const client = clients.get(serverName);
      if (!client) {
        throw new Error(`MCP Server ${serverName} is not connected.`);
      }

      const response = await client.callTool({
        name: toolName,
        arguments: args,
      });

      return response;
    },
  );
}
