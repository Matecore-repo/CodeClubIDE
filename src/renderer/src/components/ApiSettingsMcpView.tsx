import { useState, useEffect } from "react";
import { getUserSettings, saveUserSettings, type MCPServerConfig } from "../utils/userSettings";

const s = {
  container: { display: "flex", flexDirection: "column" as const, gap: 16, height: "100%" },
  rowLabel: {
    fontSize: "var(--font-size-base)",
    color: "var(--text-strong)",
    fontWeight: 500,
    marginBottom: 4,
  },
  rowDesc: { fontSize: "var(--font-size-small)", color: "var(--text-weak)", marginBottom: 8 },
  input: {
    width: "100%",
    padding: "6px 9px",
    background: "#151515",
    border: "1px solid #2a2a30",
    borderRadius: 3,
    color: "var(--text-strong)",
    outline: "none",
    fontSize: 12,
  },
  addBtn: {
    padding: "6px 0",
    background: "transparent",
    border: "none",
    color: "var(--text-strong)",
    cursor: "pointer",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
    opacity: 0.8,
  },
  card: {
    padding: "16px 0",
    borderBottom: "1px solid #202024",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    position: "relative" as const,
  },
  removeBtn: {
    position: "absolute" as const,
    top: 16,
    right: 0,
    background: "transparent",
    border: "none",
    color: "var(--icon-base)",
    cursor: "pointer",
  },
  saveBtn: {
    position: "absolute" as const,
    top: 16,
    right: 24,
    background: "transparent",
    border: "none",
    color: "#4ade80",
    cursor: "pointer",
  },
  radioGroup: {
    display: "flex",
    gap: 12,
    fontSize: 12,
    color: "var(--text-strong)",
    alignItems: "center",
  },
  radioLabel: { display: "flex", gap: 4, alignItems: "center", cursor: "pointer" },
};

export function ApiSettingsMcpView() {
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [pingStatus, setPingStatus] = useState<
    Record<number, { status: "loading" | "success" | "error"; message?: string }>
  >({});

  useEffect(() => {
    getUserSettings().then((settings) => setServers(settings.mcpServers || []));
  }, []);

  const handleSave = (newServers: MCPServerConfig[]) => {
    setServers(newServers);
    getUserSettings().then((settings) => {
      saveUserSettings({ ...settings, mcpServers: newServers });
    });
  };

  const addServer = () => {
    const srv: MCPServerConfig = {
      name: "New Server",
      type: "stdio",
      command: "node",
      args: [],
      env: {},
    };
    handleSave([...servers, srv]);
  };

  const updateServer = (index: number, updates: Partial<MCPServerConfig>) => {
    const updated = [...servers];
    updated[index] = { ...updated[index], ...updates };
    handleSave(updated);
    setPingStatus((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const removeServer = (index: number) => {
    const updated = servers.filter((_, i) => i !== index);
    handleSave(updated);
    setPingStatus((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleAccept = async (index: number) => {
    setPingStatus((prev) => ({ ...prev, [index]: { status: "loading" } }));
    try {
      const res = await (window.api as any).mcpPing(servers[index]);
      if (res.ok) {
        setPingStatus((prev) => ({
          ...prev,
          [index]: { status: "success", message: `Connected! (${res.toolsCount} tools found)` },
        }));
      } else {
        setPingStatus((prev) => ({
          ...prev,
          [index]: { status: "error", message: res.error || "Connection failed" },
        }));
      }
    } catch (err: any) {
      setPingStatus((prev) => ({
        ...prev,
        [index]: { status: "error", message: err.message || String(err) },
      }));
    }
  };

  return (
    <div style={s.container}>
      <div>
        <div style={s.rowLabel}>MCP Servers (Model Context Protocol)</div>
        <div style={s.rowDesc}>
          Connect external tools to the AI agents. You can run local binaries (stdio) or connect to
          remote servers (SSE URL).
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          overflowY: "auto",
          flex: 1,
          paddingRight: 4,
        }}
      >
        {servers.map((srv, idx) => {
          const type = srv.type || "stdio";
          const status = pingStatus[idx];

          return (
            <div key={idx} style={s.card}>
              <button
                style={{ ...s.saveBtn, opacity: status?.status === "loading" ? 0.5 : 1 }}
                onClick={() => handleAccept(idx)}
                title="Test connection & save"
              >
                {status?.status === "loading" ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" strokeDasharray="16" strokeDashoffset="16">
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 12 12"
                        to="360 12 12"
                        dur="1s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </button>
              <button style={s.removeBtn} onClick={() => removeServer(idx)} title="Remove server">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <div style={{ paddingRight: 48, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "var(--text-weaker)", marginBottom: 2 }}>
                      Name
                    </div>
                    <input
                      style={s.input}
                      value={srv.name}
                      onChange={(e) => updateServer(idx, { name: e.target.value })}
                      placeholder="e.g. supabase"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "var(--text-weaker)", marginBottom: 2 }}>
                      Transport
                    </div>
                    <div style={{ ...s.radioGroup, height: "26px" }}>
                      <label style={s.radioLabel}>
                        <input
                          type="radio"
                          name={`mcp-type-${idx}`}
                          checked={type === "stdio"}
                          onChange={() => updateServer(idx, { type: "stdio" })}
                        />
                        Local (stdio)
                      </label>
                      <label style={s.radioLabel}>
                        <input
                          type="radio"
                          name={`mcp-type-${idx}`}
                          checked={type === "sse"}
                          onChange={() => updateServer(idx, { type: "sse" })}
                        />
                        Remote (URL)
                      </label>
                    </div>
                  </div>
                </div>

                {type === "stdio" ? (
                  <>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-weaker)", marginBottom: 2 }}>
                        Command
                      </div>
                      <input
                        style={s.input}
                        value={srv.command || ""}
                        onChange={(e) => updateServer(idx, { command: e.target.value })}
                        placeholder="npx"
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-weaker)", marginBottom: 2 }}>
                        Arguments (comma separated)
                      </div>
                      <input
                        style={s.input}
                        value={(srv.args || []).join(", ")}
                        onChange={(e) =>
                          updateServer(idx, {
                            args: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="-y, @modelcontextprotocol/server-sqlite, db.sqlite"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-weaker)", marginBottom: 2 }}>
                      Server URL
                    </div>
                    <input
                      style={s.input}
                      value={srv.url || ""}
                      onChange={(e) => updateServer(idx, { url: e.target.value })}
                      placeholder="https://mcp.supabase.com/mcp"
                    />
                  </div>
                )}

                {status && status.status !== "loading" && (
                  <div
                    style={{
                      fontSize: 11,
                      color: status.status === "success" ? "#4ade80" : "#ef4444",
                      marginTop: 2,
                      wordBreak: "break-all",
                    }}
                  >
                    {status.message}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {servers.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "20px 0",
              color: "var(--text-weaker)",
              fontSize: 12,
            }}
          >
            No MCP servers configured
          </div>
        )}
      </div>

      <div style={{ paddingTop: 8 }}>
        <button style={s.addBtn} onClick={addServer}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Server
        </button>
      </div>
    </div>
  );
}
