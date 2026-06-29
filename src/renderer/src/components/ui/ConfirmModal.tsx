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
    minWidth: 240,
    background: "#121212",
    border: "1px solid #242428",
    borderRadius: 4,
    boxShadow: "0 14px 32px rgba(0,0,0,0.55)",
    padding: 10,
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  modalTitle: { fontSize: "var(--font-size-small)", fontWeight: 600, color: "var(--text-strong)" },
  modalActions: { display: "flex", gap: 6, justifyContent: "flex-end" },
  modalBtn: {
    padding: "5px 10px",
    borderRadius: 3,
    border: "1px solid #242428",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
};

export function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Delete",
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}) {
  return (
    <div style={s.modalOverlay} onClick={onCancel}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalTitle}>{title}</div>
        <div style={{ fontSize: "var(--font-size-small)", color: "var(--text-base)" }}>
          {message}
        </div>
        <div style={s.modalActions}>
          <button
            style={{ ...s.modalBtn, background: "#151515", color: "var(--text-base)" }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            style={{ ...s.modalBtn, background: "#151515", color: "var(--text-strong)" }}
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
