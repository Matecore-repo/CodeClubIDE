import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseCSV, stringifyCSV } from "../utils/csv";

export type WorkspaceColumnType = "text" | "status" | "files" | "date" | "number";

export interface WorkspaceColumn {
  id: string;
  name: string;
  type: WorkspaceColumnType;
  width: number;
}

export interface WorkspaceRow {
  id: string;
  cells: Record<string, string>;
}

export interface WorkspaceTable {
  columns: WorkspaceColumn[];
  rows: WorkspaceRow[];
}

export const WORKSPACE_STATUSES = [
  "",
  "Todo",
  "In Progress",
  "Review",
  "Done",
  "Blocked",
  "Archived",
];

export const WORKSPACE_STATUS_COLORS: Record<string, string> = {
  Todo: "#7d838c",
  "In Progress": "#3d7eff",
  Review: "#ff7a1a",
  Done: "#3fb950",
  Blocked: "#df3138",
  Archived: "#777780",
};

const COLUMN_TYPES: WorkspaceColumnType[] = ["text", "status", "files", "date", "number"];

function tableKey(workspacePath: string) {
  return `workspace-table:${workspacePath}`;
}

function defaultTable(): WorkspaceTable {
  const columns: WorkspaceColumn[] = [
    { id: "name", name: "Name", type: "text", width: 250 },
    { id: "status", name: "Status", type: "status", width: 210 },
    { id: "priority", name: "Priority", type: "status", width: 160 },
    { id: "files", name: "Files", type: "files", width: 220 },
    { id: "updated", name: "Updated", type: "date", width: 160 },
  ];
  return { columns, rows: [] };
}

function normalizeTableId(tableId?: string) {
  const safe = (tableId || "table_1")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || "table_1";
}

function isWorkspaceTable(value: unknown): value is WorkspaceTable {
  return Boolean(value && typeof value === "object" && "columns" in value && "rows" in value);
}

function removeSeedRows(table: WorkspaceTable): WorkspaceTable {
  const seedSignatures = new Set([642, 738, 878, 802, 729, 611, 947, 216]);
  const rows = table.rows.filter((row) => {
    const name = row.cells.name ?? "";
    const signature = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return !seedSignatures.has(signature);
  });
  if (rows.length === table.rows.length) return table;
  return { ...table, rows };
}

function normalizeStoredTable(table: WorkspaceTable): WorkspaceTable {
  const withoutSeeds = removeSeedRows(table);
  return {
    ...withoutSeeds,
    columns: withoutSeeds.columns.map((column) =>
      column.name === "Contacts" ? { ...column, name: "Name" } : column,
    ),
  };
}

export function normalizeColumnType(type: string): WorkspaceColumnType {
  return COLUMN_TYPES.includes(type as WorkspaceColumnType)
    ? (type as WorkspaceColumnType)
    : "text";
}

export function useWorkspaceTable(workspacePath: string, tableId?: string) {
  const activeTableId = normalizeTableId(tableId);
  const [table, setTable] = useState<WorkspaceTable>(() => defaultTable());
  const [deviceName, setDeviceName] = useState("Guest");
  const [studioConfig, setStudioConfig] = useState<any>(null);

  const saveToStorage = useCallback(
    async (currentTable: WorkspaceTable, currentConfig: any) => {
      if (!workspacePath) return;

      // Save schema to studio.json
      const config = currentConfig || { mode: "folders", tables: [] };
      const tableCfg = {
        id: activeTableId,
        name: activeTableId === "table_1" ? "Table 1" : activeTableId,
        csvFile: `${activeTableId}.csv`,
        columns: currentTable.columns,
      };
      const existingIdx = config.tables?.findIndex((t: any) => t.id === activeTableId) ?? -1;
      if (!config.tables) config.tables = [];
      if (existingIdx >= 0) config.tables[existingIdx] = tableCfg;
      else config.tables.push(tableCfg);

      setStudioConfig(config);
      await window.api.writeStudioConfig(workspacePath, config);

      // Save rows to the table CSV; headers use column names (human-readable)
      const headers = ["__id", ...currentTable.columns.map((c) => c.name)];
      const csvRows = currentTable.rows.map((r) => [
        r.id,
        ...currentTable.columns.map((c) => r.cells[c.id] || ""),
      ]);
      const csvStr = stringifyCSV([headers, ...csvRows]);
      await window.api.writeTableCsv(workspacePath, activeTableId, csvStr);
    },
    [workspacePath, activeTableId],
  );

  useEffect(() => {
    let alive = true;

    const loadData = async () => {
      let cfg = await window.api.readStudioConfig(workspacePath);
      if (!alive) return;
      setStudioConfig(cfg);

      const tableCfg = cfg?.tables?.find((t: any) => t.id === activeTableId);

      if (tableCfg && tableCfg.columns) {
        // Load from new JSON+CSV architecture
        const csvStr = await window.api.readTableCsv(workspacePath, activeTableId);
        if (!alive) return;

        // Map CSV column names → column IDs using studio.json schema
        let rows: WorkspaceRow[] = [];
        if (csvStr) {
          const parsed = parseCSV(csvStr);
          if (parsed.length > 1) {
            const csvHeaders = parsed[0]; // e.g. ["__id", "Name", "Status", ...]
            rows = parsed
              .slice(1)
              .map((r) => {
                const id = r[0];
                const cells: Record<string, string> = {};
                for (let i = 1; i < csvHeaders.length; i++) {
                  // Find column by name first, fallback to id for backwards compat
                  const col = tableCfg.columns.find(
                    (c: any) => c.name === csvHeaders[i] || c.id === csvHeaders[i],
                  );
                  if (col) cells[col.id] = r[i] || "";
                }
                return { id, cells };
              })
              .filter((row) => row.id && row.id.trim() !== "");
          }
        }

        const loadedTable: WorkspaceTable = {
          columns: tableCfg.columns,
          rows: removeSeedRows({ columns: tableCfg.columns, rows }).rows,
        };
        setTable(loadedTable);
      } else {
        // Fallback to legacy global store migration
        const legacyVal = await window.api.storeGet("workspace", tableKey(workspacePath));
        if (!alive) return;

        const loadedLegacy = isWorkspaceTable(legacyVal)
          ? normalizeStoredTable(legacyVal)
          : defaultTable();
        setTable(loadedLegacy);
        // Only migrate if legacy actually has data — never wipe CSV with empty default
        if (isWorkspaceTable(legacyVal)) {
          await saveToStorage(loadedLegacy, cfg);
        }
      }
    };

    if (!workspacePath) return;
    loadData().catch((err) => {
      console.error("[useWorkspaceTable] Failed to load table data:", err);
    });

    window.api
      .getDeviceName()
      .then((name) => {
        if (alive) setDeviceName(name || "Guest");
      })
      .catch(() => {
        if (alive) setDeviceName("Guest");
      });

    return () => {
      alive = false;
    };
  }, [workspacePath, activeTableId, saveToStorage]);

  const historyRef = useRef<{ table: WorkspaceTable; actionInfo: string; time: number }[]>([]);

  const pushHistory = (prev: WorkspaceTable, actionInfo: string) => {
    const hist = historyRef.current;
    const now = Date.now();
    if (hist.length > 0) {
      const last = hist[hist.length - 1];
      if (last.actionInfo === actionInfo && now - last.time < 2000) {
        last.time = now;
        return;
      }
    }
    historyRef.current = [...hist, { table: prev, actionInfo, time: now }].slice(-5);
  };

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prevEntry = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setTable(prevEntry.table);
    saveToStorage(prevEntry.table, studioConfig);
  }, [saveToStorage, studioConfig]);

  const totalWidth = useMemo(
    () => table.columns.reduce((sum, column) => sum + column.width, 0),
    [table.columns],
  );

  const updateCell = useCallback(
    (rowId: string, columnId: string, value: string) => {
      setTable((prev) => {
        pushHistory(prev, `updateCell:${rowId}:${columnId}`);
        const next = {
          ...prev,
          rows: prev.rows.map((row) =>
            row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row,
          ),
        };
        saveToStorage(next, studioConfig);
        return next;
      });
    },
    [saveToStorage, studioConfig],
  );

  const removeRow = useCallback(
    (rowId: string) => {
      setTable((prev) => {
        pushHistory(prev, `removeRow:${rowId}`);
        const next = { ...prev, rows: prev.rows.filter((row) => row.id !== rowId) };
        saveToStorage(next, studioConfig);
        return next;
      });
    },
    [saveToStorage, studioConfig],
  );

  const removeColumn = useCallback(
    (columnId: string) => {
      setTable((prev) => {
        pushHistory(prev, `removeColumn:${columnId}`);
        const next = {
          ...prev,
          columns: prev.columns.filter((c) => c.id !== columnId),
          rows: prev.rows.map((row) => {
            const cells = { ...row.cells };
            delete cells[columnId];
            return { ...row, cells };
          }),
        };
        saveToStorage(next, studioConfig);
        return next;
      });
    },
    [saveToStorage, studioConfig],
  );

  const addRow = useCallback(() => {
    const newId = `${Date.now()}`;
    setTable((prev) => {
      pushHistory(prev, `addRow:${newId}`);
      const next = {
        ...prev,
        rows: [
          ...prev.rows,
          { id: newId, cells: Object.fromEntries(prev.columns.map((column) => [column.id, ""])) },
        ],
      };
      saveToStorage(next, studioConfig);
      return next;
    });
    return newId;
  }, [saveToStorage, studioConfig]);

  const addRowWithCells = useCallback(
    (cells: Record<string, string>) => {
      const newId = `${Date.now()}`;
      setTable((prev) => {
        pushHistory(prev, `addRowWithCells:${newId}`);
        const next = {
          ...prev,
          rows: [...prev.rows, { id: newId, cells }],
        };
        saveToStorage(next, studioConfig);
        return next;
      });
      return newId;
    },
    [saveToStorage, studioConfig],
  );

  const addColumn = useCallback(
    (name: string, type: WorkspaceColumnType) => {
      const id = `${Date.now()}`;
      setTable((prev) => {
        pushHistory(prev, `addColumn:${id}`);
        const next = {
          columns: [...prev.columns, { id, name, type, width: type === "files" ? 220 : 180 }],
          rows: prev.rows.map((row) => ({ ...row, cells: { ...row.cells, [id]: "" } })),
        };
        saveToStorage(next, studioConfig);
        return next;
      });
    },
    [saveToStorage, studioConfig],
  );

  const renameColumn = useCallback(
    (columnId: string, name: string) => {
      setTable((prev) => {
        pushHistory(prev, `renameColumn:${columnId}`);
        const next = {
          ...prev,
          columns: prev.columns.map((column) =>
            column.id === columnId ? { ...column, name } : column,
          ),
        };
        saveToStorage(next, studioConfig);
        return next;
      });
    },
    [saveToStorage, studioConfig],
  );

  return {
    table,
    totalWidth,
    deviceName,
    addRow,
    addRowWithCells,
    addColumn,
    renameColumn,
    updateCell,
    removeRow,
    removeColumn,
    undo,
  };
}
