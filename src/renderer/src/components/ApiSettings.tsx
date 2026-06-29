import { useState, useEffect } from "react";
import type { AIConfig } from "../utils/ai";

import { ApiSettingsKeysView } from "./ApiSettingsKeysView";
import { ApiSettingsMcpView } from "./ApiSettingsMcpView";
import { USER_COLOR_OPTIONS, type UserSettings } from "../utils/userSettings";
import qrCode from "../assets/qrcode.webp";
import chillBg from "../assets/chill.webp";

const s = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.38)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    animation: "fadeIn 0.15s ease-out",
  },
  dialog: {
    display: "flex",
    width: "min(calc(100vw - 32px), 680px)",
    height: "min(calc(100vh - 32px), 480px)",
    background: "#121212",
    border: "1px solid #242428",
    borderRadius: 4,
    boxShadow: "0 14px 32px rgba(0,0,0,0.55)",
    overflow: "hidden",
  },
  sidebar: {
    width: 48,
    flexShrink: 0,
    background: "#131313",
    borderRight: "1px solid #202024",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "12px 0",
    gap: 4,
  },
  tab: {
    width: 28,
    height: 28,
    borderRadius: 3,
    fontSize: 16,
    color: "#5e5e63",
    cursor: "pointer",
    border: "none",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    color: "var(--text-strong)",
    background: "#151515",
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  header: {
    padding: "12px 16px",
    borderBottom: "1px solid #202024",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text-strong)",
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 3,
    border: "none",
    background: "transparent",
    color: "var(--icon-base)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: "16px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #202024",
  },
  rowLabel: {
    fontSize: "var(--font-size-base)",
    color: "var(--text-strong)",
    fontWeight: 500,
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: "var(--font-size-small)",
    color: "var(--text-weak)",
  },
};

export function ApiSettings({
  config: _config,
  version,
  onSave,
  onClose,
  userSettings,
  onSaveUserSettings,
  initialTab = "general",
}: {
  config: AIConfig | null;
  version?: string;
  onSave: (c: AIConfig) => void;
  onClose: () => void;
  userSettings?: UserSettings;
  onSaveUserSettings?: (settings: UserSettings) => void;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  const [username, setUsername] = useState(
    userSettings?.username && userSettings.username !== "You" ? userSettings.username : "",
  );
  const [selectedColor, setSelectedColor] = useState(userSettings?.color || "#7c5cbf");
  const [caretShape, setCaretShape] = useState(userSettings?.caretShape || "bar");

  const handleUsernameChange = (newVal: string) => {
    setUsername(newVal);
    onSaveUserSettings?.({ username: newVal, color: selectedColor, caretShape });
  };

  const handleColorChange = (newColor: string) => {
    setSelectedColor(newColor);
    onSaveUserSettings?.({ username, color: newColor, caretShape });
  };

  const handleCaretShapeChange = (newShape: "bar" | "block") => {
    setCaretShape(newShape);
    onSaveUserSettings?.({ username, color: selectedColor, caretShape: newShape });
  };

  useEffect(() => {
    if (!username) {
      window.api.getDeviceName().then((name) => {
        const fallback = name || "You";
        setUsername(fallback);
        onSaveUserSettings?.({ username: fallback, color: selectedColor, caretShape });
      });
    }
  }, [username]);

  const [emailCopied, setEmailCopied] = useState(false);
  const [enterpriseContacted, setEnterpriseContacted] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={s.sidebar}>
          {[
            {
              id: "general",
              icon: (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              ),
            },
            {
              id: "keys",
              icon: (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ),
            },
            {
              id: "rules",
              icon: (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              ),
            },
            {
              id: "mcp",
              icon: (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 2v7.31" />
                  <path d="M14 9.3V1.99" />
                  <path d="M8.5 2h7" />
                  <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
                  <line x1="5.52" x2="18.48" y1="16" y2="16" />
                </svg>
              ),
            },
            {
              id: "privacy",
              icon: (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              ),
            },
            {
              id: "terms",
              icon: (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              ),
            },
            {
              id: "about",
              icon: (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              ),
            },
          ].map((t) => (
            <button
              key={t.id}
              disabled={t.id === "mcp"}
              title={
                t.id === "mcp"
                  ? "MCP Servers (Coming Soon)"
                  : t.id.charAt(0).toUpperCase() + t.id.slice(1)
              }
              style={{
                ...s.tab,
                ...(tab === t.id ? s.tabActive : {}),
                transition: "all 0.15s ease",
                opacity: t.id === "mcp" ? 0.3 : 1,
                cursor: t.id === "mcp" ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (tab !== t.id && t.id !== "mcp") {
                  e.currentTarget.style.background = "#1e1e20";
                  e.currentTarget.style.color = "#9a9aa1";
                }
              }}
              onMouseLeave={(e) => {
                if (tab !== t.id && t.id !== "mcp") {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#5e5e63";
                }
              }}
              onClick={() => {
                if (t.id !== "mcp") setTab(t.id);
              }}
            >
              {t.icon}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            title={emailCopied ? "Copied to clipboard!" : "Support: matecore.main@gmail.com"}
            style={s.tab}
            onClick={() => {
              navigator.clipboard.writeText("matecore.main@gmail.com");
              setEmailCopied(true);
              setTimeout(() => setEmailCopied(false), 2000);
            }}
          >
            {emailCopied ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#72e88b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            )}
          </button>
        </div>

        <div style={s.content}>
          <div style={s.header}>
            <span style={s.headerTitle}>
              {tab === "general"
                ? "General"
                : tab === "keys"
                  ? "API Keys"
                  : tab === "mcp"
                    ? "MCP Servers"
                    : tab === "about"
                      ? "About"
                      : tab === "privacy"
                        ? "PRIVACY POLICY (Or why your data is your business)"
                        : tab === "terms"
                          ? "TERMS AND CONDITIONS (Or what happens if you put the club at risk)"
                          : "Rules"}
            </span>
            <button style={s.closeBtn} onClick={onClose}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div style={s.body}>
            {tab === "general" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={s.rowLabel}>Username</div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 9px",
                      background: "#151515",
                      border: "1px solid #2a2a30",
                      borderRadius: 3,
                      color: "var(--text-strong)",
                      outline: "none",
                      fontSize: 12,
                      marginTop: 6,
                    }}
                  />
                </div>
                <div>
                  <div style={s.rowLabel}>User Color</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                    {USER_COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        onClick={() => handleColorChange(c)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 3,
                          backgroundColor: c,
                          border:
                            selectedColor === c
                              ? "2px solid var(--text-strong)"
                              : "2px solid transparent",
                          cursor: "pointer",
                          transition: "all 0.1s ease",
                          boxShadow:
                            selectedColor === c ? "0 0 0 1px rgba(255,255,255,0.14)" : "none",
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div style={s.rowLabel}>Cursor Style</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <button
                      onClick={() => handleCaretShapeChange("bar")}
                      style={{
                        padding: "5px 10px",
                        background: caretShape === "bar" ? "#151515" : "transparent",
                        border: caretShape === "bar" ? "1px solid #3a3a40" : "1px solid #242428",
                        borderRadius: 3,
                        color: "var(--text-strong)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      Bar ( | )
                    </button>
                    <button
                      onClick={() => handleCaretShapeChange("block")}
                      style={{
                        padding: "5px 10px",
                        background: caretShape === "block" ? "#151515" : "transparent",
                        border: caretShape === "block" ? "1px solid #3a3a40" : "1px solid #242428",
                        borderRadius: 3,
                        color: "var(--text-strong)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      Block ( █ )
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "keys" && <ApiSettingsKeysView onSave={onSave} />}
            {tab === "mcp" && <ApiSettingsMcpView />}

            {tab === "about" && (
              <div>
                <div style={{ ...s.row, borderBottom: "1px solid var(--border-color)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={s.rowLabel}>Code Club</span>
                      <span
                        style={{ fontSize: "var(--font-size-small)", color: "var(--text-weaker)" }}
                      >
                        v{version ?? "?"}
                      </span>
                    </div>
                    <div style={{ ...s.rowDesc, marginTop: 2 }}>
                      Code Club is an offline-first development environment licensed for personal
                      and educational use. Commercial, corporate, institutional, or
                      revenue-generating use requires a separate paid enterprise license.
                    </div>
                    <div style={{ ...s.rowDesc, marginTop: 4, color: "var(--text-weaker)" }}>
                      Personal and educational use only. Commercial use requires a paid license.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    position: "relative",
                    borderRadius: 12,
                    overflow: "hidden",
                    marginTop: 8,
                  }}
                >
                  <img
                    src={chillBg}
                    alt=""
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      filter: "blur(6px) brightness(0.55)",
                      zIndex: 0,
                    }}
                  />
                  <div
                    style={{
                      position: "relative",
                      zIndex: 1,
                      padding: "20px 16px",
                      textAlign: "center" as const,
                      fontSize: "var(--font-size-small)",
                      color: "#f0e6d8",
                    }}
                  >
                    <div style={{ marginBottom: 10, lineHeight: 1.5 }}>
                      Enjoying Code Club?{" "}
                      <a
                        onClick={() => window.api.openLink("https://ko-fi.com/codeclubide")}
                        style={{
                          color: "#e0895e",
                          fontWeight: 600,
                          cursor: "pointer",
                          textDecoration: "none",
                        }}
                      >
                        Support the project
                      </a>
                    </div>
                    <img
                      src={qrCode}
                      alt="Ko-fi QR"
                      style={{
                        width: 100,
                        height: 100,
                        borderRadius: 8,
                        display: "block",
                        margin: "0 auto 6px",
                        cursor: "pointer",
                      }}
                      onClick={() => window.api.openLink("https://ko-fi.com/codeclubide")}
                    />
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                      ko-fi.com/codeclubide
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "privacy" && (
              <div style={{ padding: "0 4px" }}>
                <div style={{ ...s.rowDesc, padding: "12px 0", lineHeight: 1.6, fontSize: 13 }}>
                  Code Club is built strictly for personal and educational use. We do not collect,
                  hoard, or transmit your personal data. Your code, API keys, and workspaces stay on
                  your machine. We have absolutely no desire to snoop through your files.
                  <br />
                  <br />
                  Every AI request goes straight from your device to whatever provider you managed
                  to configure. There are no middlemen, no one spying in between, and no
                  intermediary servers inspecting your traffic. It's just a direct line between you
                  and the silicon brain.
                  <br />
                  <br />
                  If you feel the need to chip in to keep the lights on in this basement, donations
                  are handled entirely externally via Ko-fi. Code Club does not touch, process, or
                  store your payment information. We want your support, not the liability of your
                  financial records.
                  <br />
                  <br />
                  As for commercial use: any organization or corporate user must obtain a paid
                  enterprise license before using Code Club in any business, professional, or
                  revenue-generating context. The rules are clear: if there are commercial purposes,
                  the corresponding license is required.
                </div>
              </div>
            )}

            {tab === "terms" && (
              <div style={{ padding: "0 4px" }}>
                <div style={{ ...s.rowDesc, padding: "12px 0", lineHeight: 1.6, fontSize: 13 }}>
                  Code Club is provided 'as is', without warranties of any kind. I mean, if it
                  breaks, don't come crying to us. Use it at your own risk, assuming you actually
                  have a clue what you're doing.
                  <br />
                  <br />
                  You better comply with the terms of service of the AI providers you connect to. We
                  don't impose additional usage restrictions on you, but if you do something that
                  draws unwanted attention to the club or gets us in trouble, we'll find out. And
                  let's just say the community doesn't like snitches or careless people.
                  <br />
                  <br />
                  This space is strictly for personal and educational use, unless, by some miracle,
                  you've paid us for a written enterprise license. Commercial, corporate,
                  client-facing use, or using it to line your pockets is prohibited without said
                  license. Don't try to outsmart us by profiting behind our backs; if your business
                  ambitions compromise the existence of the club, the consequences are going to
                  be... quite uncomfortable.
                </div>
              </div>
            )}

            {tab === "rules" && (
              <>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 0,
                    listStylePosition: "inside",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    color: "var(--text-weak)",
                    lineHeight: 1.45,
                  }}
                >
                  <li>The first rule of Code Club is: nobody talks about the editor.</li>
                  <li>
                    The second rule of Code Club is: NOBODY TALKS ABOUT THE EDITOR! If the editor
                    has no owner, it has no name.
                  </li>
                  <li>Dead code is a corpse. Nobody keeps corpses.</li>
                  <li>In a debugging session, only two take part: you and the bug. One is out.</li>
                  <li>
                    One problem at a time. Being busy does not make you productive; it makes you
                    scattered.
                  </li>
                  <li>You enter the terminal with no history and no past.</li>
                  <li>Debugging will last as long as it has to.</li>
                  <li>
                    The eighth and final rule is: if this is your first night at Code Club... open
                    the editor and tame the silicon beast.
                  </li>
                </ol>
                <p style={{ margin: "18px 0 0", color: "var(--text-weak)" }}>
                  If this is too much for you, stay outside the club.
                </p>
              </>
            )}

            {tab === "pricing" &&
              (() => {
                const userColor = userSettings?.color || "#7c5cbf";
                return (
                  <div
                    style={{ padding: "0 4px", display: "flex", flexDirection: "column", gap: 16 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid var(--border-weaker-base)",
                        paddingBottom: 16,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "var(--text-strong)",
                            marginBottom: 4,
                          }}
                        >
                          Personal
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-weaker)" }}>
                          No data collection • Direct AI requests • Personal use
                        </div>
                      </div>
                      <button
                        onClick={() => window.api.openLink("https://ko-fi.com/codeclubide")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 4,
                          border: `1px solid ${userColor}`,
                          background: "transparent",
                          color: userColor,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        Support
                      </button>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        opacity: 0.8,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "var(--text-weak)",
                            marginBottom: 4,
                          }}
                        >
                          Enterprise
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-weaker)" }}>
                          Self-hosted • Full team on-premise • Custom license • Dedicated SLA
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEnterpriseContacted(true);
                          window.api.openEmail("iangel.oned@gmail.com");
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 4,
                          border: "1px solid var(--border-weaker-base)",
                          background: "transparent",
                          color: "var(--text-weak)",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        {enterpriseContacted ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          "Contact"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      </div>
    </div>
  );
}
