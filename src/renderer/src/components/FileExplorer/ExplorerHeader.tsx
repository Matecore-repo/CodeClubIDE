import { s } from "./styles";

export function ExplorerHeader({
  rootName,
  mode,
  hasStudioSelection,
  setShowCreateDir,
  setShowCreateFile,
}: {
  rootName: string;
  mode: "folders" | "studio" | "design";
  hasStudioSelection?: boolean;
  setShowCreateDir: (b: boolean) => void;
  setShowCreateFile: (b: boolean) => void;
}) {
  return (
    <div style={s.header}>
      <span style={s.title}>{rootName || "Knowledge Base"}</span>
      {mode === "folders" ? (
        <>
          <button style={s.headerBtn} title="New folder" onClick={() => setShowCreateDir(true)}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
              <path d="M12 11v5M9.5 13.5h5" />
            </svg>
          </button>
          <button style={s.headerBtn} title="New file" onClick={() => setShowCreateFile(true)}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="5" y="4" width="14" height="16" rx="2" />
              <path d="M9 8h6M9 12h6" />
            </svg>
          </button>
        </>
      ) : mode === "studio" ? (
        <>
          <button
            style={s.headerBtn}
            title={hasStudioSelection ? "New column" : "New group"}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent(
                  hasStudioSelection ? "codeclub:studio-add-column" : "codeclub:studio-add-group",
                ),
              )
            }
          >
            {hasStudioSelection ? (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <line x1="12" y1="3" x2="12" y2="21" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            ) : (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            )}
          </button>
          <button
            style={s.headerBtn}
            title={hasStudioSelection ? "New row" : "Add member"}
            onClick={() => {
              if (hasStudioSelection) {
                window.dispatchEvent(new CustomEvent("codeclub:studio-add-row"));
              }
            }}
          >
            {hasStudioSelection ? (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="12" y1="8" x2="12" y2="16" />
              </svg>
            ) : (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                <path d="M19 8h4M21 6v4" />
              </svg>
            )}
          </button>
        </>
      ) : (
        <>
          <button
            style={s.headerBtn}
            title="New page"
            onClick={() => window.dispatchEvent(new CustomEvent("codeclub:design-add-page"))}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3h9l3 3v15H6Z" />
              <path d="M15 3v4h4M9 13h6M12 10v6" />
            </svg>
          </button>
          <button
            style={s.headerBtn}
            title="New layer"
            onClick={() => window.dispatchEvent(new CustomEvent("codeclub:design-add-layer"))}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 3 8 4-8 4-8-4Z" />
              <path d="m4 12 8 4 8-4M12 16v5M9.5 18.5h5" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
