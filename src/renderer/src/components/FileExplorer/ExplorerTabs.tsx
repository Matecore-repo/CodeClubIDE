import { s } from "./styles";

export function ExplorerTabs({
  query,
  setQuery,
  mode,
  onModeChange,
}: {
  query: string;
  setQuery: (q: string) => void;
  mode: "folders" | "studio" | "design";
  onModeChange?: (mode: "folders" | "studio" | "design") => void;
}) {
  return (
    <>
      <label style={s.search}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          style={s.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
        />
      </label>
      <div style={{ padding: "6px 8px", background: "#121212" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            background: "#121212",
            borderRadius: 8,
            padding: 2,
            border: "1px solid #151515",
          }}
        >
          <button
            style={{
              ...s.tab,
              border: "none",
              background: mode === "folders" ? "#181818" : "transparent",
              color: mode === "folders" ? "#e4e4e7" : "#71717a",
              boxShadow: "none",
            }}
            onClick={() => onModeChange?.("folders")}
          >
            Coding
          </button>
          <button
            style={{
              ...s.tab,
              border: "none",
              background: mode === "studio" ? "#181818" : "transparent",
              color: mode === "studio" ? "#e4e4e7" : "#71717a",
              boxShadow: "none",
            }}
            onClick={() => onModeChange?.("studio")}
          >
            Studio
          </button>
          <button
            style={{
              ...s.tab,
              border: "none",
              background: mode === "design" ? "#181818" : "transparent",
              color: mode === "design" ? "#e4e4e7" : "#71717a",
              boxShadow: "none",
            }}
            onClick={() => onModeChange?.("design")}
          >
            Design
          </button>
        </div>
      </div>
    </>
  );
}
