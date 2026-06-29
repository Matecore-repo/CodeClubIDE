export type TopographicNodeType =
  | "workspace"
  | "folder"
  | "file"
  | "function"
  | "class"
  | "interface"
  | "section"
  | "block"
  | "other";

export interface TopographicNode {
  id: string;
  parentId: string | null;
  name: string;
  type: TopographicNodeType;
  path: string;
  language: string;
  startLine: number;
  endLine: number;
  bytes: number;
  characters: number;
  hash: string;
  childCount: number;
  isCode: boolean;
}

export interface TopographicReadRequest {
  workspacePath: string;
  path?: string;
  nodeId?: string;
  startLine?: number;
  endLine?: number;
}

export type TopographicMutation =
  | { action: "create-file"; path: string; content?: string }
  | { action: "create-folder"; path: string }
  | { action: "insert"; path: string; content: string; startLine?: number; baseHash?: string }
  | {
      action: "replace";
      path: string;
      content: string;
      nodeId?: string;
      nodeName?: string;
      startLine?: number;
      endLine?: number;
      baseHash?: string;
      oldContent?: string;
      dryRun?: boolean;
    }
  | { action: "rename"; path: string; destination: string; baseHash?: string }
  | { action: "move"; path: string; destination: string; baseHash?: string }
  | {
      action: "move-node";
      path: string;
      destinationPath: string;
      nodeId?: string;
      nodeName?: string;
      startLine?: number;
      endLine?: number;
      destinationLine?: number;
      baseHash?: string;
      dryRun?: boolean;
    }
  | {
      action: "delete";
      path: string;
      nodeId?: string;
      startLine?: number;
      endLine?: number;
      baseHash?: string;
      oldContent?: string;
      dryRun?: boolean;
    }
  | {
      action: "undo";
      path: string;
      targetHash?: string;
      nodeId?: string;
      nodeName?: string;
      dryRun?: boolean;
    };

export interface TopographicMutationRequest {
  workspacePath: string;
  mutation: TopographicMutation;
}

export type TopographicMutationResult =
  | {
      ok: true;
      path?: string;
      hash?: string;
      startLine?: number;
      endLine?: number;
      dryRun?: boolean;
      replacedText?: string;
    }
  | { ok: false; error: string; currentHash?: string };

export type TopographicDiffResult = {
  id: string;
  name: string;
  path: string;
  status: "added" | "removed" | "modified" | "moved";
};
