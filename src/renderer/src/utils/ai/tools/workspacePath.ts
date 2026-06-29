export function workspaceFilePath(workspacePath: string | undefined, filePath: string): string {
  if (!workspacePath || /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith("/"))
    return filePath;
  return `${workspacePath}/${filePath}`.replace(/\\/g, "/").replace(/\/+/g, "/");
}
