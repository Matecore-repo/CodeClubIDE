import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

function Select<T extends string>({
  options,
  value,
  onChange,
  width,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  width?: number | string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current && listRef.current.children[activeIndex]) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const modal = document.getElementById("command-palette-container");
        if (modal && modal.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0 && activeIndex >= 0 && activeIndex < filtered.length) {
        onChange(filtered[activeIndex].value);
        setOpen(false);
      } else if (search.trim()) {
        onChange(search.trim() as T);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        display: "inline-block",
        minWidth: width,
        width: width ? undefined : "auto",
      }}
    >
      <button
        style={{
          padding: "3px 5px",
          borderRadius: 3,
          border: "none",
          background: "transparent",
          color: "var(--text-weak)",
          fontSize: 12,
          outline: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 4,
          width: "100%",
        }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ whiteSpace: "nowrap" }}>
          {options.find((o) => o.value === value)?.label ?? value}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ flexShrink: 0, opacity: 0.5 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open &&
        createPortal(
          <>
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 999,
                background: "rgba(0,0,0,0.38)",
                backdropFilter: "blur(1px)",
              }}
              onClick={() => setOpen(false)}
            />
            <div
              id="command-palette-container"
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "360px",
                maxWidth: "calc(100vw - 32px)",
                background: "#121212",
                border: "1px solid #242428",
                borderRadius: 4,
                boxShadow: "0 14px 32px rgba(0,0,0,0.55)",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: 8, borderBottom: "1px solid #202024" }}>
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "6px 9px",
                    borderRadius: 3,
                    border: "1px solid #2a2a30",
                    background: "#161616",
                    color: "var(--text-strong)",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>
              <div ref={listRef} style={{ overflow: "auto", maxHeight: 220, padding: 4 }}>
                {filtered.length === 0 ? (
                  <div
                    style={{
                      padding: 14,
                      color: "var(--text-weaker)",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    No matches found
                  </div>
                ) : (
                  filtered.map((o, idx) => {
                    const isSelected = o.value === value;
                    const isHighlighted = idx === activeIndex;
                    return (
                      <button
                        key={o.value}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "6px 7px",
                          border: "none",
                          borderRadius: 3,
                          background: isHighlighted
                            ? "var(--surface-base)"
                            : isSelected
                              ? "#1a1a1a"
                              : "transparent",
                          color:
                            isHighlighted || isSelected ? "var(--text-strong)" : "var(--text-base)",
                          fontSize: 12,
                          cursor: "pointer",
                          textAlign: "left",
                          outline: "none",
                        }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => {
                          onChange(o.value);
                          setOpen(false);
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>{o.label}</span>
                          {isSelected && (
                            <span
                              style={{
                                fontSize: 10,
                                opacity: 0.65,
                                background: "#1a1a1a",
                                padding: "2px 5px",
                                borderRadius: 2,
                              }}
                            >
                              Active
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

export default Select;
