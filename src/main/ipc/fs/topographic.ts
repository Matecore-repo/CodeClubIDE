import { execFile } from "child_process";
import { getScanBinaryPath } from "../../indexer/scanner";
import type { TopographicMutation, TopographicNode } from "../../../shared/topographicNodes";
import { existsSync } from "fs";

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
  return runTopographic<TopographicNode[]>(workspacePath, ["tree"]);
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
  return runTopographic<{ content: string; hash: string; startLine: number; endLine: number }>(
    workspacePath,
    ["read"],
    request,
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
      nodeId?: string;
      nodeName?: string;
    }
  | { ok: false; error: string }
> {
  try {
    const clonedMutation = { ...mutation } as any;
    if (typeof clonedMutation.baseHash === "string" && clonedMutation.baseHash.includes("_")) {
      clonedMutation.baseHash = clonedMutation.baseHash.substring(
        clonedMutation.baseHash.indexOf("_") + 1,
      );
    }
    const result = await runTopographic<any>(workspacePath, ["mutate"], clonedMutation);
    return result;
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
