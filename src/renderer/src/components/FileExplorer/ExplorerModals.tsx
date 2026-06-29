import { ModalInput } from "../ui/ModalInput";
import { ConfirmModal } from "../ui/ConfirmModal";

export function ExplorerModals({ f }: { f: any }) {
  return (
    <>
      {f.createError && (
        <div
          style={{
            background: "var(--bg-red)",
            color: "var(--text-red)",
            padding: "8px 12px",
            fontSize: "12px",
          }}
        >
          {f.createError}
        </div>
      )}
      {f.showCreateFile && (
        <ModalInput
          title="New file"
          placeholder="filename.ts"
          onSubmit={(name) => {
            f.handleCreateFile(name);
            f.setShowCreateFile(false);
          }}
          onCancel={() => f.setShowCreateFile(false)}
        />
      )}
      {f.showCreateDir && (
        <ModalInput
          title="New folder"
          placeholder="folder name"
          onSubmit={(name) => {
            f.handleCreateDir(name);
            f.setShowCreateDir(false);
          }}
          onCancel={() => f.setShowCreateDir(false)}
        />
      )}
      {f.showDelete && (
        <ConfirmModal
          title="Delete"
          message={`Delete "${f.showDelete.name}"?`}
          onConfirm={() => f.handleDelete(f.showDelete!)}
          onCancel={() => f.setShowDelete(null)}
        />
      )}
    </>
  );
}
