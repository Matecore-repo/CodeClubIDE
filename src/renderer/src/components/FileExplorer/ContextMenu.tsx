import { FloatingContextMenu, type FloatingContextMenuItem } from "./FloatingContextMenu";

export function ContextMenu({ f }: { f: any }) {
  if (!f.contextMenu) return null;

  const entry = f.contextMenu.entry;
  const items: FloatingContextMenuItem[] = [
    { label: "New File", onClick: () => f.setShowCreateFile(true) },
    { label: "New Folder", onClick: () => f.setShowCreateDir(true) },
    { label: "Import File", onClick: f.handleImportFiles },
    { label: "Import Folder", onClick: f.handleImportFolder },
  ];

  if (entry?.path.endsWith(".html")) {
    items.push({
      label: "Open in Browser",
      onClick: () => {
        window.api.openLink(`file:///${entry.path.replace(/\\/g, "/")}`);
        f.closeContextMenu();
      },
    });
  }

  items.push(
    {
      label: entry?.isDirectory ? "Export Folder" : "Export File",
      disabled: !entry,
      onClick: () => {
        if (entry) f.handleExport(entry);
      },
    },
    { separator: true },
    {
      label: "Rename",
      disabled: !entry,
      onClick: () => {
        if (entry) f.startRename(entry);
      },
    },
    {
      label: "Delete",
      disabled: !entry,
      onClick: () => {
        if (!entry) return;
        f.setShowDelete(entry);
        f.closeContextMenu();
      },
    },
  );

  return <FloatingContextMenu x={f.contextMenu.x} y={f.contextMenu.y} items={items} />;
}
