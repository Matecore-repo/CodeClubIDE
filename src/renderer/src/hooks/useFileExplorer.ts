import { useState, useEffect, useCallback, useRef } from "react";

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  entry: DirEntry | null;
}

export interface RenameError {
  path: string;
  message: string;
}

function parentDir(path: string): string {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return i >= 0 ? path.slice(0, i) : "";
}

function entryName(path: string): string {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return i >= 0 ? path.slice(i + 1) : path;
}

export function useFileExplorer(rootPath: string | null) {
  const [rootChildren, setRootChildren] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const clipboardRef = useRef<{ paths: string[]; mode: "copy" | "cut" } | null>(null);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [showCreateDir, setShowCreateDir] = useState(false);
  const [showDelete, setShowDelete] = useState<DirEntry | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const [dragOverDir, setDragOverDir] = useState<string | null>(null);
  const draggedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (renaming) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!createError) return;
    const t = setTimeout(() => setCreateError(null), 3000);
    return () => clearTimeout(t);
  }, [createError]);

  useEffect(() => {
    if (!renameError) return;
    const t = setTimeout(() => setRenameError(null), 3000);
    return () => clearTimeout(t);
  }, [renameError]);

  const loadRoot = useCallback(() => {
    if (!rootPath) {
      setRootChildren([]);
      return;
    }
    window.api
      .readDir(rootPath)
      .then(setRootChildren)
      .catch(() => setRootChildren([]));
  }, [rootPath]);

  useEffect(() => {
    if (!rootPath) {
      setRootChildren([]);
      return;
    }
    setLoading(true);
    window.api
      .readDir(rootPath)
      .then((list) => {
        setRootChildren(list);
        setLoading(false);
      })
      .catch(() => {
        setRootChildren([]);
        setLoading(false);
      });
  }, [rootPath]);

  useEffect(() => {
    if (!rootPath) return;
    window.api.watchDir(rootPath);
    const unlisten = window.api.onFsChange((dirPath, _filename) => {
      if (dirPath === rootPath) loadRoot();
    });
    return () => {
      window.api.unwatchDir(rootPath);
      unlisten();
    };
  }, [rootPath, loadRoot]);

  const handleSelect = useCallback(
    (path: string | null, isDirectory: boolean, additive = false) => {
      setSelectedPath(path);
      setSelectedPaths((current) => {
        if (!path) return new Set();
        if (!additive) return new Set([path]);
        const next = new Set(current);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
      if (path) {
        if (isDirectory) {
          setSelectedDir(path);
        } else {
          setSelectedDir(parentDir(path));
        }
      } else {
        setSelectedDir(null);
      }
    },
    [],
  );

  const setClipboard = useCallback(
    (mode: "copy" | "cut") => {
      if (selectedPaths.size) clipboardRef.current = { paths: [...selectedPaths], mode };
    },
    [selectedPaths],
  );

  const pasteClipboard = useCallback(async () => {
    const clipboard = clipboardRef.current;
    if (!clipboard || !rootPath) return;
    const target = selectedDir || rootPath;
    for (const source of clipboard.paths) {
      const base = entryName(source);
      let destination = `${target}/${base}`;
      let index = 1;
      while (await window.api.exists(destination)) {
        const dot = base.lastIndexOf(".");
        const stem = dot > 0 ? base.slice(0, dot) : base;
        const ext = dot > 0 ? base.slice(dot) : "";
        destination = `${target}/${stem} Copy${index === 1 ? "" : ` ${index}`}${ext}`;
        index++;
      }
      if (clipboard.mode === "copy") await window.api.copyFile(source, destination);
      else await window.api.rename(source, destination);
    }
    if (clipboard.mode === "cut") clipboardRef.current = null;
    loadRoot();
  }, [loadRoot, rootPath, selectedDir]);

  const createTarget = useCallback(() => {
    if (contextMenu?.entry?.isDirectory) return contextMenu.entry.path;
    if (!contextMenu?.entry && selectedDir) return selectedDir;
    return rootPath ?? "";
  }, [contextMenu, selectedDir, rootPath]);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: DirEntry | null) => {
    e.preventDefault();
    e.stopPropagation();
    const menuHeight = 280; // Estimación de la altura del menú
    let y = e.clientY;
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight;
    }
    setContextMenu({ x: e.clientX, y, entry });
    if (entry) {
      setSelectedPath(entry.path);
      if (entry.isDirectory) setSelectedDir(entry.path);
      else setSelectedDir(parentDir(entry.path));
    }
  }, []);

  const handleCreateFile = useCallback(
    async (name: string) => {
      if (!rootPath) return;
      const dir = createTarget();
      const fileName = name.includes(".") ? name : name + ".txt";
      const fullPath = dir ? dir + "/" + fileName : fileName;
      const already = await window.api.exists(fullPath);
      if (already) {
        setCreateError(`"${fileName}" already exists`);
        return;
      }
      const ok = await window.api.createFile(fullPath);
      if (!ok) {
        setCreateError(`Failed to create "${fileName}"`);
        return;
      }
      setContextMenu(null);
      setCreateError(null);
      loadRoot();
    },
    [rootPath, createTarget, loadRoot],
  );

  const handleCreateDir = useCallback(
    async (name: string) => {
      if (!rootPath) return;
      const dir = createTarget();
      const fullPath = dir ? dir + "/" + name : name;
      const already = await window.api.exists(fullPath);
      if (already) {
        setCreateError(`"${name}" already exists`);
        return;
      }
      const ok = await window.api.createDir(fullPath);
      if (!ok) {
        setCreateError(`Failed to create folder "${name}"`);
        return;
      }
      setContextMenu(null);
      setCreateError(null);
      loadRoot();
    },
    [rootPath, createTarget, loadRoot],
  );

  const handleDelete = useCallback(
    async (entry: DirEntry) => {
      await window.api.deleteFile(entry.path);
      setSelectedPath(null);
      setShowDelete(null);
      loadRoot();
    },
    [loadRoot],
  );

  const handleImportFiles = useCallback(async () => {
    if (!rootPath) return;
    const dir = createTarget();
    const files = await window.api.selectFiles();
    if (files && files.length > 0) {
      for (const fPath of files) {
        const name = entryName(fPath);
        const dest = dir ? dir + "/" + name : name;
        await window.api.copyFile(fPath, dest);
      }
      loadRoot();
    }
    setContextMenu(null);
  }, [rootPath, createTarget, loadRoot]);

  const handleImportFolder = useCallback(async () => {
    if (!rootPath) return;
    const dir = createTarget();
    const folder = await window.api.selectFolder();
    if (folder) {
      const name = entryName(folder);
      const dest = dir ? dir + "/" + name : name;
      await window.api.copyFile(folder, dest);
      loadRoot();
    }
    setContextMenu(null);
  }, [rootPath, createTarget, loadRoot]);

  const handleExport = useCallback(async (entry: DirEntry) => {
    const destFolder = await window.api.selectFolder();
    if (destFolder) {
      const dest = destFolder + "/" + entry.name;
      await window.api.copyFile(entry.path, dest);
    }
    setContextMenu(null);
  }, []);

  const startRename = useCallback((entry: DirEntry) => {
    setRenaming(entry.path);
    setRenameVal(entry.name);
    setRenameError(null);
    setContextMenu(null);
  }, []);

  const doRename = useCallback(async () => {
    if (!renaming || !renameVal.trim()) {
      setRenaming(null);
      return;
    }
    const dir = parentDir(renaming);
    const newPath = dir ? dir + "/" + renameVal.trim() : renameVal.trim();
    if (newPath === renaming) {
      setRenaming(null);
      return;
    }
    const already = await window.api.exists(newPath);
    if (already) {
      setRenameError(`"${renameVal.trim()}" already exists`);
      return;
    }
    const ok = await window.api.rename(renaming, newPath);
    if (!ok) {
      setRenameError("Failed to rename");
      return;
    }
    setRenaming(null);
    setRenameError(null);
    loadRoot();
  }, [renaming, renameVal, loadRoot]);

  const handleRenameKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") doRename();
      if (e.key === "Escape") setRenaming(null);
    },
    [doRename],
  );

  const handleDrop = useCallback(
    async (_e: React.DragEvent, targetDir: string) => {
      setDragOverDir(null);

      const src = draggedPathRef.current;
      if (!src || src === targetDir) return;
      const name = entryName(src);
      const dest = targetDir ? targetDir + "/" + name : name;
      if (src === dest) return;
      const already = await window.api.exists(dest);
      if (already) return;
      await window.api.rename(src, dest);
      draggedPathRef.current = null;
      loadRoot();
    },
    [loadRoot],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  return {
    rootChildren,
    loading,
    selectedPath,
    selectedPaths,
    setSelectedPaths,
    setSelectedPath,
    handleSelect,
    contextMenu,
    closeContextMenu,
    showCreateFile,
    setShowCreateFile,
    showCreateDir,
    setShowCreateDir,
    showDelete,
    setShowDelete,
    createError,
    renaming,
    renameVal,
    setRenameVal,
    renameRef,
    renameError,
    dragOverDir,
    setDragOverDir,
    draggedPathRef,
    handleContextMenu,
    handleCreateFile,
    handleCreateDir,
    handleImportFiles,
    handleImportFolder,
    handleExport,
    handleDelete,
    startRename,
    doRename,
    handleRenameKey,
    handleDrop,
    setClipboard,
    pasteClipboard,
  };
}
