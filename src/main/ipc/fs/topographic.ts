import { execFile } from "child_process";
import { getScanBinaryPath } from "../../indexer/scanner";
import type { TopographicMutation, TopographicNode } from "../../../shared/topographicNodes";
import { enrichTopographicNodes } from "../../../shared/topographicIdentity";
import { existsSync } from "fs";
import { isAbsolute, relative } from "path";

function workspaceRelativePath(workspacePath: string, value?: string): string | undefined {
  if (!value || !isAbsolute(value)) return value;
  const rel = relative(workspacePath, value);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel.replace(/\\/g, "/") : value;
}

function runTopographic<T>(workspacePath: string, args: string[], stdin?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const executable = getScanBinaryPath();
    if (!existsSync(executable)) {
      reject(new Error("Rust engine not found. Compilation needed?"));
      return;
    }

    const child = execFile(
      executable,
      ["topographic", ...args, workspacePath],
      { maxBuffer: 50 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && !stdout) {
          reject(new Error(stderr || error.message));
          return;
        }
        try {
          const result = JSON.parse(stdout);
          if (result.ok === false && result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result as T);
          }
        } catch (err) {
          reject(
            new Error(`Invalid JSON from topographic engine: ${err}\n${stdout.slice(0, 1000)}`),
          );
        }
      },
    );

    if (stdin !== undefined && child.stdin) {
      child.stdin.write(JSON.stringify(stdin));
      child.stdin.end();
    }
  });
}

export type NodeReader = (filePath: string) => Promise<any[]>;

export async function buildTopographicTree(
  workspacePath: string,
  _readNodes: NodeReader,
): Promise<TopographicNode[]> {
  return enrichTopographicNodes(await runTopographic<TopographicNode[]>(workspacePath, ["tree"]));
}

export function diffTopographicTrees(
  _treeA: TopographicNode[],
  _treeB: TopographicNode[],
): import("../../../shared/topographicNodes").TopographicDiffResult[] {
  throw new Error("Use async diffTopographicTreesAsync instead.");
}

export async function diffTopographicTreesAsync(
  workspacePath: string,
  treeA: TopographicNode[],
  treeB: TopographicNode[],
): Promise<import("../../../shared/topographicNodes").TopographicDiffResult[]> {
  return runTopographic<import("../../../shared/topographicNodes").TopographicDiffResult[]>(
    workspacePath,
    ["diff"],
    [treeA, treeB],
  );
}

export async function readTopographicContent(
  workspacePath: string,
  request: { path?: string; nodeId?: string; startLine?: number; endLine?: number },
  _readNodes: NodeReader,
): Promise<{ content: string; hash: string; startLine: number; endLine: number }> {
  const normalizedRequest = {
    ...request,
    path: workspaceRelativePath(workspacePath, request.path),
  };
  return runTopographic<{ content: string; hash: string; startLine: number; endLine: number }>(
    workspacePath,
    ["read"],
    normalizedRequest,
  );
}

export async function mutateTopographic(
  workspacePath: string,
  mutation: TopographicMutation,
  _readNodes: NodeReader,
): Promise<
  | {
      ok: true;
      path?: string;
      hash?: string;
      startLine?: number;
      endLine?: number;
      status?: string;
      willMutate?: boolean;
      replacedText?: string;
      proposedContent?: string;
      action?: string;
      wouldMutate?: boolean;
      nodeId?: string;
      nodeName?: string;
    }
  | { ok: false; error: string; currentHash?: string }
> {
  try {
    const clonedMutation = { ...mutation } as any;
    clonedMutation.path = workspaceRelativePath(workspacePath, clonedMutation.path);
    clonedMutation.destinationPath = workspaceRelativePath(
      workspacePath,
      clonedMutation.destinationPath,
    );
    if (typeof clonedMutation.baseHash === "string" && clonedMutation.baseHash.includes("_")) {
      clonedMutation.baseHash = clonedMutation.baseHash.substring(
        clonedMutation.baseHash.indexOf("_") + 1,
      );
    }
    if (clonedMutation.dryRun) {
      return dryRunTopographicMutation(workspacePath, clonedMutation, _readNodes);
    }
    const result = await runTopographic<any>(workspacePath, ["mutate"], clonedMutation);
    return result;
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

async function dryRunTopographicMutation(
  workspacePath: string,
  mutation: any,
  readNodes: NodeReader,
): Promise<any> {
  const action = mutation.action;
  const content = mutation.content ?? "";
  const needsTarget = !["create-file", "create-folder", "rename", "move"].includes(action);
  let target: { content: string; hash: string; startLine: number; endLine: number } | null = null;

  if (needsTarget) {
    const readRange =
      action === "insert" && !mutation.nodeId
        ? { path: mutation.path }
        : {
            path: mutation.path,
            nodeId: mutation.nodeId,
            startLine: mutation.startLine,
            endLine: mutation.endLine,
          };
    target = await readTopographicContent(
      workspacePath,
      readRange,
      readNodes,
    );
    if (
      mutation.baseHash &&
      mutation.baseHash !== target.hash &&
      !mutation.baseHash.endsWith(`_${target.hash}`)
    ) {
      return { ok: false, error: "hash-conflict", currentHash: target.hash };
    }
  }

  const startLine = mutation.startLine ?? target?.startLine ?? 1;
  const insertedLines = content.split("\n").length || 1;
  return {
    ok: true,
    dryRun: true,
    action,
    path: mutation.path,
    status: "dry-run-preview",
    willMutate: false,
    wouldMutate: true,
    startLine,
    endLine:
      action === "delete"
        ? target?.endLine
        : startLine + Math.max(1, insertedLines) - 1,
    replacedText: action === "insert" ? null : target?.content ?? null,
    proposedContent: ["insert", "replace", "create-file"].includes(action) ? content : undefined,
    nodeId: mutation.nodeId,
    nodeName: mutation.nodeName,
  };
}
