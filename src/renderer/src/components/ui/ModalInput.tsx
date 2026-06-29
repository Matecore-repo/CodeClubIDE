import { useState, useEffect, useRef } from "react";

const s = {
  modalOverlay: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 100,
    background: "rgba(0,0,0,0.38)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "fadeIn 0.1s ease-out",
  },
  modal: {
    minWidth: 260,
    background: "#121212",
    border: "1px solid #242428",
    borderRadius: 4,
    boxShadow: "0 14px 32px rgba(0,0,0,0.55)",
    padding: 8,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  modalTitle: { fontSize: 12, fontWeight: 500, color: "var(--text-weak)" },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#151515",
    border: "1px solid #2a2a30",
    borderRadius: 3,
    padding: "4px 5px 4px 8px",
  },
  modalInput: {
    flex: 1,
    minWidth: 0,
    padding: "4px 0",
    border: "none",
    borderRadius: 0,
    background: "transparent",
    color: "var(--text-strong)",
    fontSize: "var(--font-size-small)",
    outline: "none",
    fontFamily: "var(--font-family-sans)",
  },
  modalBtn: {
    width: 24,
    height: 24,
    borderRadius: 3,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

export function ModalInput({
  title,
  placeholder,
  onSubmit,
  onCancel,
  submitLabel = "Create",
  initialValue = "",
}: {
  title: string;
  placeholder: string;
  onSubmit: (v: string) => void;
  onCancel: () => void;
  submitLabel?: string;
  initialValue?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const [val, setVal] = useState(initialValue);
  return (
    <div style={s.modalOverlay} onClick={onCancel}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalTitle}>{title}</div>
        <div style={s.inputRow}>
          <input
            ref={ref}
            style={s.modalInput}
            placeholder={placeholder}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && val.trim()) onSubmit(val.trim());
              if (e.key === "Escape") onCancel();
            }}
          />
          <button
            style={{ ...s.modalBtn, background: "transparent", color: "var(--text-weaker)" }}
            title="Cancel"
            onClick={onCancel}
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
            style={{
              ...s.modalBtn,
              background: "#151515",
              color: "var(--text-strong)",
              opacity: val.trim() ? 1 : 0.45,
            }}
            disabled={!val.trim()}
            onClick={() => {
              if (val.trim()) {
                onSubmit(val.trim());
              }
            }}
            title={submitLabel}
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
  );
}
