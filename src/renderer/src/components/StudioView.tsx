import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeColumnType,
  useWorkspaceTable,
  WORKSPACE_STATUSES,
  WORKSPACE_STATUS_COLORS,
  type WorkspaceColumn,
  type WorkspaceColumnType,
  type WorkspaceRow,
} from "../hooks/useWorkspaceTable";

const styles = {
  wrap: {
    flex: 1,
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    background: "#111111",
    display: "flex",
    flexDirection: "column" as const,
    outline: "none",
  },
  toolbar: {
    height: 42,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
    borderBottom: "1px solid #202024",
    background: "#121212",
    flexShrink: 0,
  },
  toolBtn: {
    height: 26,
    border: "1px solid #252529",
    borderRadius: 6,
    background: "#151516",
    color: "#bdbdc3",
    fontSize: 12,
    padding: "0 9px",
    cursor: "pointer",
  },
  tableScroll: {
    position: "absolute" as const,
    inset: 0,
    overflow: "scroll",
    overscrollBehavior: "contain" as const,
    paddingBottom: 8,
  },
  tableFrame: {
    position: "relative" as const,
    flex: "1 1 0",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
  },
  grid: { width: "max-content" },
  headerRow: {
    display: "flex",
    minHeight: 32,
    borderBottom: "1px solid #202024",
    background: "#121212",
    color: "#85858c",
    fontSize: 12,
    position: "sticky" as const,
    top: 0,
    zIndex: 2,
  },
  row: {
    display: "flex",
    minHeight: 36,
    borderBottom: "1px solid #202024",
    color: "#bdbdc3",
    position: "relative" as const,
  },
  rowSelected: {
    outline: "2px solid #7c5cbf",
    outlineOffset: -2,
    background: "rgba(124,92,191,0.08)",
  },
  headerCell: {
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 10px",
    borderRight: "1px solid #202024",
    boxSizing: "border-box" as const,
    overflow: "visible",
    cursor: "pointer",
  },
  cell: {
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 10px",
    borderRight: "1px solid #202024",
    boxSizing: "border-box" as const,
    overflow: "visible",
    cursor: "cell",
  },
  input: {
    width: "100%",
    height: 26,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#d9d9dd",
    fontSize: 12,
  },
  pill: {
    maxWidth: "100%",
    borderRadius: 5,
    background: "#202024",
    color: "#e6e6e8",
    fontSize: 12,
    padding: "3px 6px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  statusDot: { width: 9, height: 9, borderRadius: 99, flexShrink: 0 },
  selection: {
    position: "absolute" as const,
    inset: -1,
    border: "2px solid #7c5cbf",
    borderRadius: 8,
    pointerEvents: "none" as const,
    zIndex: 1,
  },
  tag: {
    position: "absolute" as const,
    right: -1,
    top: -25,
    height: 24,
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
    borderRadius: "6px 6px 0 0",
    background: "#7c5cbf",
    color: "white",
    fontSize: 12,
    zIndex: 2,
  },
  select: {
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#d9d9dd",
    fontSize: 12,
    width: "100%",
  },
  statusButton: {
    flex: 1,
    minWidth: 0,
    height: 26,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#d9d9dd",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    cursor: "pointer",
  },
  statusMenu: {
    position: "absolute" as const,
    left: 8,
    top: 31,
    width: 180,
    padding: "4px",
    border: "1px solid #252529",
    borderRadius: 7,
    background: "#121212",
    boxShadow: "0 12px 30px rgba(0,0,0,0.42)",
    zIndex: 30,
  },
  statusOption: {
    height: 26,
    border: "none",
    borderRadius: 5,
    background: "transparent",
    color: "#d8d8dc",
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "0 8px",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left" as const,
  },
  modalBackdrop: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.38)",
  },
  modal: {
    width: 300,
    border: "1px solid #242428",
    borderRadius: 4,
    background: "#121212",
    boxShadow: "0 14px 32px rgba(0,0,0,0.55)",
    padding: 8,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  modalTitle: { color: "var(--text-weak)", fontSize: 12, fontWeight: 500 },
  modalField: {
    width: "100%",
    height: 30,
    boxSizing: "border-box" as const,
    border: "1px solid #2a2a30",
    borderRadius: 3,
    background: "#151515",
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "0 4px 0 8px",
  },
  modalInput: {
    flex: 1,
    minWidth: 0,
    height: 28,
    border: "none",
    background: "transparent",
    color: "var(--text-strong)",
    outline: "none",
    padding: 0,
    fontSize: 12,
  },
  modalIconBtn: {
    width: 24,
    height: 24,
    border: "none",
    borderRadius: 3,
    background: "transparent",
    color: "var(--text-weaker)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  modalTypeSelect: {
    width: "auto",
    height: 24,
    border: "none",
    borderRadius: 3,
    background: "transparent",
    color: "var(--text-weaker)",
    outline: "none",
    cursor: "pointer",
    fontSize: 11,
    textAlign: "center" as const,
  },
  scrollRailX: {
    position: "absolute" as const,
    left: 10,
    right: 22,
    bottom: 8,
    height: 7,
    borderRadius: 99,
    background: "rgba(255,255,255,0.045)",
    zIndex: 20,
  },
  scrollRailY: {
    position: "absolute" as const,
    top: 42,
    right: 8,
    bottom: 22,
    width: 7,
    borderRadius: 99,
    background: "rgba(255,255,255,0.045)",
    zIndex: 20,
  },
  scrollThumb: { position: "absolute" as const, borderRadius: 99, background: "#3a3a40" },
  empty: { padding: 18, color: "#777780", fontSize: 12 },
};

function columnIcon(type: WorkspaceColumnType) {
  if (type === "status") return "S";
  if (type === "files") return "F";
  if (type === "date") return "D";
  if (type === "number") return "#";
  return "T";
}

function fileLabel(value: string) {
  if (!value) return "";
  return value
    .split(";")
    .filter(Boolean)
    .map((file) => file.split(/[\\/]/).pop())
    .join(", ");
}

export function StudioView({
  workspacePath,
  activeColor,
  tableId,
}: {
  workspacePath: string;
  activeColor?: string;
  tableId?: string;
}) {
  const {
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
  } = useWorkspaceTable(workspacePath, tableId);
  const themeColor = activeColor || "#7c5cbf";
  const rowSelectedStyle = { background: themeColor + "14" };
  const tagStyle = { ...styles.tag, background: themeColor };
  const [selected, setSelected] = useState<{
    rowId: string;
    columnId?: string;
    scope: "cell" | "row" | "column";
  } | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [rowSelectionAnchor, setRowSelectionAnchor] = useState<string | null>(null);
  const [columnEditor, setColumnEditor] = useState<{
    mode: "new" | "rename";
    column?: WorkspaceColumn;
  } | null>(null);
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<WorkspaceColumnType>("text");
  const [openStatusCell, setOpenStatusCell] = useState<{ rowId: string; columnId: string } | null>(
    null,
  );
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [hoverType, setHoverType] = useState<string | null>(null);
  const [hoverStatusOption, setHoverStatusOption] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    scrollWidth: 1,
    scrollHeight: 1,
  });

  const clearSelection = useCallback(() => {
    setSelected(null);
    setSelectedCells(new Set());
    setSelectedRows(new Set());
    setSelectionAnchor(null);
    setRowSelectionAnchor(null);
    setOpenStatusCell(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow default undo in native inputs if the user is typing, but also trigger ours if they are not?
      // Wait, if an input is focused, let it handle its own undo first.
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

  const handleDeleteSelection = useCallback(() => {
    if (selected?.scope === "column" && selected.columnId) {
      removeColumn(selected.columnId);
      clearSelection();
      return;
    }
    if (selectedCells.size > 0) {
      selectedCells.forEach((key) => {
        const [rowId, columnId] = key.split("::");
        updateCell(rowId, columnId, "");
      });
      return;
    }
    if (selectedRows.size > 0) {
      selectedRows.forEach((rowId) => removeRow(rowId));
      setSelectedRows(new Set());
      return;
    }
    if (!selected) return;
    if (selected.scope === "row") {
      removeRow(selected.rowId);
      setSelected(null);
      return;
    }
    if (selected.columnId) updateCell(selected.rowId, selected.columnId, "");
  }, [selected, selectedCells, selectedRows, removeColumn, removeRow, updateCell, clearSelection]);

  const cellKey = (rowId: string, columnId: string) => `${rowId}::${columnId}`;

  const getCellSelectionStyle = (rowId: string, columnId: string) => {
    const rowIndex = table.rows.findIndex((row) => row.id === rowId);
    const colIndex = table.columns.findIndex((column) => column.id === columnId);
    const hasNeighbor = (rowOffset: number, colOffset: number) => {
      const row = table.rows[rowIndex + rowOffset];
      const column = table.columns[colIndex + colOffset];
      return Boolean(row && column && selectedCells.has(cellKey(row.id, column.id)));
    };
    const top =
      hasNeighbor(-1, 0) ||
      (rowIndex === 0 && selected?.scope === "column" && selected.columnId === columnId);
    const right = hasNeighbor(0, 1);
    const bottom = hasNeighbor(1, 0);
    const left = hasNeighbor(0, -1);

    return {
      ...styles.selection,
      border: "none",
      borderTop: top ? "none" : `2px solid ${themeColor}`,
      borderRight: right ? "none" : `2px solid ${themeColor}`,
      borderBottom: bottom ? "none" : `2px solid ${themeColor}`,
      borderLeft: left ? "none" : `2px solid ${themeColor}`,
      borderTopLeftRadius: top || left ? 0 : 8,
      borderTopRightRadius: top || right ? 0 : 8,
      borderBottomRightRadius: bottom || right ? 0 : 8,
      borderBottomLeftRadius: bottom || left ? 0 : 8,
    };
  };

  const getRowSelectionStyle = (rowId: string) => {
    const rowIndex = table.rows.findIndex((row) => row.id === rowId);
    const hasNeighbor = (offset: number) => {
      const row = table.rows[rowIndex + offset];
      return Boolean(row && selectedRows.has(row.id));
    };
    const top = hasNeighbor(-1);
    const bottom = hasNeighbor(1);

    return {
      ...styles.selection,
      border: "none",
      borderTop: top ? "none" : `2px solid ${themeColor}`,
      borderRight: `2px solid ${themeColor}`,
      borderBottom: bottom ? "none" : `2px solid ${themeColor}`,
      borderLeft: `2px solid ${themeColor}`,
      borderTopLeftRadius: top ? 0 : 8,
      borderTopRightRadius: top ? 0 : 8,
      borderBottomRightRadius: bottom ? 0 : 8,
      borderBottomLeftRadius: bottom ? 0 : 8,
    };
  };

  const getFirstSelectedRowId = () =>
    table.rows.find((row) => selectedRows.has(row.id))?.id ?? null;

  const selectColumn = (columnId: string) => {
    const next = new Set<string>();
    table.rows.forEach((row) => {
      next.add(cellKey(row.id, columnId));
    });
    setSelected({ rowId: table.rows[0]?.id ?? "", columnId, scope: "column" });
    setSelectedCells(next);
    setSelectedRows(new Set());
    setSelectionAnchor(null);
    setRowSelectionAnchor(null);
  };

  const selectRow = (rowId: string, event?: React.MouseEvent) => {
    const rowIndex = table.rows.findIndex((row) => row.id === rowId);
    const anchorIndex = rowSelectionAnchor
      ? table.rows.findIndex((row) => row.id === rowSelectionAnchor)
      : -1;
    setSelected({ rowId, scope: "row" });
    setSelectedCells(new Set());
    setSelectionAnchor(null);

    if (event?.shiftKey && anchorIndex >= 0 && rowIndex >= 0) {
      const start = Math.min(anchorIndex, rowIndex);
      const end = Math.max(anchorIndex, rowIndex);
      setSelectedRows(new Set(table.rows.slice(start, end + 1).map((row) => row.id)));
      return;
    }

    if (event?.ctrlKey || event?.metaKey) {
      setRowSelectionAnchor(rowId);
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) next.delete(rowId);
        else next.add(rowId);
        return next;
      });
      return;
    }

    setRowSelectionAnchor(rowId);
    setSelectedRows(new Set([rowId]));
  };

  const selectCell = (rowId: string, columnId: string, event?: React.MouseEvent) => {
    const key = cellKey(rowId, columnId);
    const rowIndex = table.rows.findIndex((row) => row.id === rowId);
    const colIndex = table.columns.findIndex((column) => column.id === columnId);
    const anchorRowIndex = selectionAnchor
      ? table.rows.findIndex((row) => row.id === selectionAnchor.rowId)
      : -1;
    const anchorColIndex = selectionAnchor
      ? table.columns.findIndex((column) => column.id === selectionAnchor.columnId)
      : -1;

    setSelected({ rowId, columnId, scope: "cell" });
    setSelectedRows(new Set());
    setRowSelectionAnchor(null);

    if (
      event?.shiftKey &&
      selectionAnchor &&
      rowIndex >= 0 &&
      colIndex >= 0 &&
      anchorRowIndex >= 0 &&
      anchorColIndex >= 0
    ) {
      const next = new Set<string>();
      const rowStart = Math.min(rowIndex, anchorRowIndex);
      const rowEnd = Math.max(rowIndex, anchorRowIndex);
      const colStart = Math.min(colIndex, anchorColIndex);
      const colEnd = Math.max(colIndex, anchorColIndex);
      for (let r = rowStart; r <= rowEnd; r += 1) {
        for (let c = colStart; c <= colEnd; c += 1) {
          next.add(cellKey(table.rows[r].id, table.columns[c].id));
        }
      }
      setSelectedCells(next);
      return;
    }

    if (event?.ctrlKey || event?.metaKey) {
      setSelectionAnchor({ rowId, columnId });
      setSelectedCells((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      return;
    }

    setSelectionAnchor({ rowId, columnId });
    setSelectedCells(new Set([key]));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
        return;
      }
      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        const target = e.target as HTMLElement | null;
        const isEditing =
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.tagName === "SELECT";
        if (isEditing) return;
        e.preventDefault();
        if (selectedRows.size > 0) {
          selectedRows.forEach((rowId) => {
            const source = table.rows.find((r) => r.id === rowId);
            if (source) addRowWithCells({ ...source.cells });
          });
          return;
        }
        if (selected?.scope === "row") {
          const source = table.rows.find((r) => r.id === selected.rowId);
          if (source) addRowWithCells({ ...source.cells });
          return;
        }
        return;
      }
      if (e.key !== "Delete") return;
      if (!selected && selectedCells.size === 0 && selectedRows.size === 0) return;
      const target = e.target as HTMLElement | null;
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";
      if (isEditing && selected?.scope !== "row" && selected?.scope !== "column") return;
      e.preventDefault();
      handleDeleteSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, selectedCells, selectedRows, table, handleDeleteSelection, addRowWithCells]);

  useEffect(() => {
    const handleAddRowEvent = () => {
      addRow();
    };
    const handleAddColEvent = () => {
      setColumnEditor({ mode: "new" });
      setColumnName("");
      setColumnType("text");
    };
    window.addEventListener("codeclub:studio-add-row", handleAddRowEvent);
    window.addEventListener("codeclub:studio-add-column", handleAddColEvent);
    return () => {
      window.removeEventListener("codeclub:studio-add-row", handleAddRowEvent);
      window.removeEventListener("codeclub:studio-add-column", handleAddColEvent);
    };
  }, [addRow]);

  const syncScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScroll({
      left: el.scrollLeft,
      top: el.scrollTop,
      width: el.clientWidth,
      height: el.clientHeight,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
    });
  };

  useEffect(() => {
    syncScroll();
    window.addEventListener("resize", syncScroll);
    return () => window.removeEventListener("resize", syncScroll);
  }, [table.rows.length, table.columns.length, totalWidth]);

  const horizontalThumbWidth = Math.max(
    36,
    (scroll.width / Math.max(scroll.scrollWidth, 1)) * Math.max(scroll.width - 32, 1),
  );
  const horizontalThumbLeft =
    (scroll.left / Math.max(scroll.scrollWidth - scroll.width, 1)) *
    Math.max(scroll.width - 32 - horizontalThumbWidth, 0);
  const verticalTrackHeight = Math.max(scroll.height - 64, 1);
  const verticalThumbHeight = Math.max(
    36,
    (scroll.height / Math.max(scroll.scrollHeight, 1)) * verticalTrackHeight,
  );
  const verticalThumbTop =
    (scroll.top / Math.max(scroll.scrollHeight - scroll.height, 1)) *
    Math.max(verticalTrackHeight - verticalThumbHeight, 0);
  const canScrollX = scroll.scrollWidth > scroll.width + 1;
  const canScrollY = scroll.scrollHeight > scroll.height + 1;

  const startDrag = (axis: "x" | "y", e: React.MouseEvent) => {
    e.preventDefault();
    const el = scrollRef.current;
    if (!el) return;
    const start = axis === "x" ? e.clientX : e.clientY;
    const startScroll = axis === "x" ? el.scrollLeft : el.scrollTop;
    const track =
      axis === "x"
        ? Math.max(scroll.width - 32 - horizontalThumbWidth, 1)
        : Math.max(verticalTrackHeight - verticalThumbHeight, 1);
    const maxScroll =
      axis === "x" ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
    const onMove = (event: MouseEvent) => {
      const delta = (axis === "x" ? event.clientX : event.clientY) - start;
      const next = startScroll + (delta / track) * maxScroll;
      if (axis === "x") el.scrollLeft = next;
      else el.scrollTop = next;
      syncScroll();
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const _openNewColumn = () => {
    setColumnName("");
    setColumnType("text");
    setColumnEditor({ mode: "new" });
  };

  const openRenameColumn = (column: WorkspaceColumn) => {
    setColumnName(column.name);
    setColumnType(column.type);
    setColumnEditor({ mode: "rename", column });
  };

  const submitColumnEditor = () => {
    const name = columnName.trim();
    if (!name || !columnEditor) return;
    if (columnEditor.mode === "new") addColumn(name, normalizeColumnType(columnType));
    else if (columnEditor.column) renameColumn(columnEditor.column.id, name);
    setColumnEditor(null);
  };

  const attachFiles = async (rowId: string, columnId: string) => {
    const files = await window.api.selectFiles();
    if (files.length) updateCell(rowId, columnId, files.join(";"));
  };

  const renderCell = (row: WorkspaceRow, column: WorkspaceColumn) => {
    const value = row.cells[column.id] ?? "";
    if (column.type === "status") {
      const isOpen = openStatusCell?.rowId === row.id && openStatusCell.columnId === column.id;
      return (
        <>
          <span
            style={{ ...styles.statusDot, background: WORKSPACE_STATUS_COLORS[value] || "#777780" }}
          />
          <button
            style={styles.statusButton}
            onClick={(e) => {
              e.stopPropagation();
              selectCell(row.id, column.id, e);
              setOpenStatusCell(isOpen ? null : { rowId: row.id, columnId: column.id });
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {value || "Empty"}
            </span>
          </button>
          {isOpen && (
            <div style={styles.statusMenu} onClick={(e) => e.stopPropagation()}>
              {WORKSPACE_STATUSES.map((option) => (
                <button
                  key={option}
                  style={{
                    ...styles.statusOption,
                    background:
                      option === value
                        ? "#242428"
                        : hoverStatusOption === option
                          ? "#1a1a1a"
                          : "transparent",
                  }}
                  onMouseEnter={() => setHoverStatusOption(option)}
                  onMouseLeave={() => setHoverStatusOption(null)}
                  onClick={() => {
                    selectCell(row.id, column.id);
                    updateCell(row.id, column.id, option);
                    setOpenStatusCell(null);
                  }}
                >
                  <span
                    style={{
                      ...styles.statusDot,
                      background: WORKSPACE_STATUS_COLORS[option] || "#777780",
                    }}
                  />
                  <span>{option || "Empty"}</span>
                </button>
              ))}
            </div>
          )}
        </>
      );
    }
    if (column.type === "files") {
      return (
        <button
          style={{
            ...styles.pill,
            background: "transparent",
            padding: 0,
            border: "none",
            outline: "none",
            cursor: "pointer",
            color: value ? "#e6e6e8" : "#d9d9dd",
          }}
          onClick={() => attachFiles(row.id, column.id)}
        >
          {fileLabel(value) || "Choose files"}
        </button>
      );
    }
    return (
      <input
        style={styles.input}
        value={value}
        type={column.type === "number" ? "number" : column.type === "date" ? "date" : "text"}
        onChange={(e) => updateCell(row.id, column.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Delete") return;
          e.preventDefault();
          updateCell(row.id, column.id, "");
        }}
      />
    );
  };

  return (
    <div
      style={styles.wrap}
      tabIndex={0}
      onClick={() => setOpenStatusCell(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          clearSelection();
          return;
        }
        if (e.key !== "Delete") return;
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT"
        )
          return;
        e.preventDefault();
        handleDeleteSelection();
      }}
    >
      <div style={styles.tableFrame}>
        <div
          ref={scrollRef}
          className="workspace-table-scroll"
          style={styles.tableScroll}
          onScroll={syncScroll}
        >
          <div style={{ ...styles.grid, minWidth: totalWidth }}>
            <div style={styles.headerRow}>
              {table.columns.map((column) => (
                <div
                  key={column.id}
                  style={{ ...styles.headerCell, width: column.width }}
                  onClick={() => selectColumn(column.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    openRenameColumn(column);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    selectColumn(column.id);
                  }}
                >
                  {selected?.scope === "column" && selected.columnId === column.id && (
                    <>
                      <span
                        style={{
                          ...styles.selection,
                          border: `2px solid ${themeColor}`,
                          borderBottom: "none",
                          borderBottomLeftRadius: 0,
                          borderBottomRightRadius: 0,
                        }}
                      />
                      <span style={tagStyle}>{deviceName}</span>
                    </>
                  )}
                  <span>{columnIcon(column.type)}</span>
                  <span>{column.name}</span>
                </div>
              ))}
            </div>
            {table.rows.map((row) => {
              const isRowSelected =
                selectedRows.has(row.id) ||
                (selected?.scope === "row" && selected.rowId === row.id);
              const showRowSelectionTag =
                selectedRows.size > 0 && getFirstSelectedRowId() === row.id;
              return (
                <div
                  key={row.id}
                  style={{ ...styles.row, ...(isRowSelected ? rowSelectedStyle : {}) }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    selectRow(row.id, e);
                  }}
                >
                  {selectedRows.has(row.id) && <span style={getRowSelectionStyle(row.id)} />}
                  {showRowSelectionTag && <span style={tagStyle}>{deviceName}</span>}
                  {table.columns.map((column) => {
                    const isSelected = selectedCells.has(cellKey(row.id, column.id));
                    const showSelectionTag =
                      isSelected &&
                      selected?.scope === "cell" &&
                      selected.rowId === row.id &&
                      selected.columnId === column.id;
                    return (
                      <div
                        key={column.id}
                        style={{ ...styles.cell, width: column.width }}
                        onClick={(e) => selectCell(row.id, column.id, e)}
                      >
                        {isSelected && <span style={getCellSelectionStyle(row.id, column.id)} />}
                        {showSelectionTag && <span style={tagStyle}>{deviceName}</span>}
                        {renderCell(row, column)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        {canScrollX && (
          <div style={styles.scrollRailX}>
            <div
              style={{
                ...styles.scrollThumb,
                left: horizontalThumbLeft,
                width: horizontalThumbWidth,
                top: 0,
                bottom: 0,
              }}
              onMouseDown={(e) => startDrag("x", e)}
            />
          </div>
        )}
        {canScrollY && (
          <div style={styles.scrollRailY}>
            <div
              style={{
                ...styles.scrollThumb,
                top: verticalThumbTop,
                height: verticalThumbHeight,
                left: 0,
                right: 0,
              }}
              onMouseDown={(e) => startDrag("y", e)}
            />
          </div>
        )}
      </div>
      {columnEditor && (
        <div style={styles.modalBackdrop} onMouseDown={() => setColumnEditor(null)}>
          <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={styles.modalField}>
              <input
                autoFocus
                style={styles.modalInput}
                value={columnName}
                placeholder={columnEditor.mode === "new" ? "New column" : "Rename column"}
                onChange={(e) => setColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitColumnEditor();
                  if (e.key === "Escape") setColumnEditor(null);
                }}
              />
              {columnEditor.mode === "new" && (
                <div style={{ position: "relative" }}>
                  <button
                    style={{
                      ...styles.modalTypeSelect,
                      padding: "0 8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                  >
                    <span>{columnType.charAt(0).toUpperCase() + columnType.slice(1)}</span>
                  </button>
                  {typeDropdownOpen && (
                    <div
                      style={{ ...styles.statusMenu, left: 0, top: 28, width: 100, zIndex: 600 }}
                    >
                      {["text", "status", "files", "date", "number"].map((opt) => (
                        <button
                          key={opt}
                          style={{
                            ...styles.statusOption,
                            background:
                              opt === columnType
                                ? "#242428"
                                : hoverType === opt
                                  ? "#1a1a1a"
                                  : "transparent",
                          }}
                          onMouseEnter={() => setHoverType(opt)}
                          onMouseLeave={() => setHoverType(null)}
                          onClick={() => {
                            setColumnType(normalizeColumnType(opt));
                            setTypeDropdownOpen(false);
                          }}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                style={styles.modalIconBtn}
                title="Cancel"
                onClick={() => setColumnEditor(null)}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
              <button
                style={{ ...styles.modalIconBtn, color: "var(--text-strong)" }}
                title="Save"
                onClick={submitColumnEditor}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
