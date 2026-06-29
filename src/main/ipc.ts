import { registerFsHandlers } from "./ipc/fs";
import { registerTerminalHandlers } from "./ipc/terminal";
import { registerIndexerHandlers } from "./ipc/indexer";
import { registerSystemHandlers } from "./ipc/system";
import { registerMemoryHandlers } from "./ipc/memory";
import { registerUpdaterHandlers } from "./ipc/updater";
import { registerDebugHandlers } from "./ipc/debug";
import { registerCheckpointHandlers } from "./ipc/checkpoints";
import { registerMcpHandlers } from "./ipc/mcp";

export function registerIpcHandlers(): void {
  registerMcpHandlers();
  registerFsHandlers();
  registerTerminalHandlers();
  registerIndexerHandlers();
  registerSystemHandlers();
  registerMemoryHandlers();
  registerUpdaterHandlers();
  registerDebugHandlers();
  registerCheckpointHandlers();
}
