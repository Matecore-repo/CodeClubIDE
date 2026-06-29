export interface ColumnConfig {
  id: string;
  name: string;
  type: "text" | "number" | "boolean" | "date" | "status" | "files";
  width?: number;
}

export interface TableConfig {
  id: string;
  name: string;
  columns: ColumnConfig[];
  csvFile: string; // e.g., 'table_1.csv'
}

export interface StudioConfig {
  /**
   * Whether this workspace defaults to "studio" mode or "folders" mode.
   * Stored in `.codeclub/studio.json`
   */
  mode: "folders" | "studio" | "design";

  /**
   * Tables metadata (schema)
   */
  tables?: TableConfig[];
}
