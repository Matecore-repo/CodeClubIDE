import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { vi } from "vitest";
vi.mock("electron", () => ({ app: { isPackaged: false } }));
import {
  semanticNodeHash,
  structuralNodeId,
  type StructuralNode,
} from "../../../shared/structuralNodes";
import { buildTopographicTree, mutateTopographic, readTopographicContent } from "./topographic";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): {
  root: string;
  file: string;
  readNodes: (path: string) => Promise<StructuralNode[]>;
} {
  const root = mkdtempSync(join(tmpdir(), "codeclub-topographic-"));
  roots.push(root);
  const file = join(root, "src", "sample.ts");
  mkdirSync(join(root, "src"));
  writeFileSync(file, "function hello() {\n  return 1\n}\n");
  const readNodes = async (path: string) => {
    const content = readFileSync(path, "utf8");
    return [
      {
        id: structuralNodeId(path, "function", "hello"),
        name: "hello",
        type: "function" as const,
        ancestors: [],
        startLine: 1,
        endLine: 3,
        content: content.trimEnd(),
        baseHash: semanticNodeHash(content.trimEnd()),
      },
    ];
  };
  return { root, file, readNodes };
}

describe("simple topographic tree", () => {
  it("builds workspace, folder, file and code section metadata", async () => {
    const { root, readNodes } = fixture();
    const tree = await buildTopographicTree(root, readNodes);
    expect(tree.map((node) => node.type)).toEqual(["workspace", "folder", "file", "function"]);
    const file = tree.find((node) => node.type === "file")!;
    expect(file).toMatchObject({ characters: 32, bytes: 32, childCount: 1, isCode: true });
    expect("content" in file).toBe(false);
  });

  it("reads a node on demand and uses its hash", async () => {
    const { root, file, readNodes } = fixture();
    const node = (await readNodes(file))[0];
    const result = await readTopographicContent(root, { path: file, nodeId: node.id }, readNodes);
    expect(result).toMatchObject({
      content: node.content,
      hash: node.baseHash,
      startLine: 1,
      endLine: 3,
    });
  });

  it("reads relative, Windows absolute and WSL workspace paths", async () => {
    const { root, file, readNodes } = fixture();
    const relative = await readTopographicContent(root, { path: "src/sample.ts" }, readNodes);
    const absolute = await readTopographicContent(root, { path: file }, readNodes);
    expect(relative.content).toBe(absolute.content);

    if (process.platform === "win32") {
      const wslPath = file
        .replace(/^([a-zA-Z]):[\\/]/, (_match, drive: string) => `/mnt/${drive.toLowerCase()}/`)
        .replace(/\\/g, "/");
      const fromWsl = await readTopographicContent(root, { path: wslPath }, readNodes);
      expect(fromWsl.content).toBe(absolute.content);

      const outside = join(root, "..", "outside.ts")
        .replace(/^([a-zA-Z]):[\\/]/, (_match, drive: string) => `/mnt/${drive.toLowerCase()}/`)
        .replace(/\\/g, "/");
      await expect(readTopographicContent(root, { path: outside }, readNodes)).rejects.toThrow(
        "outside-workspace",
      );
    }
  });

  it("reads a file node ID as whole-file content", async () => {
    const { root, file, readNodes } = fixture();
    const fileNode = (await buildTopographicTree(root, readNodes)).find(
      (node) => node.type === "file",
    )!;
    const result = await readTopographicContent(
      root,
      { path: file, nodeId: fileNode.id },
      readNodes,
    );
    expect(result.content).toBe(readFileSync(file, "utf8"));
    expect(result.hash).toBe(fileNode.hash);
  });

  it("builds a scoped file as a file root without scanning it as a directory", async () => {
    const { file, readNodes } = fixture();
    const tree = await buildTopographicTree(file, readNodes);
    expect(tree[0]).toMatchObject({ type: "file", path: file.replace(/\\/g, "/") });
    expect(tree.some((node) => node.type === "function")).toBe(true);
  });

  it("replaces ranges and rejects stale hashes and outside paths", async () => {
    const { root, file, readNodes } = fixture();
    const hash = semanticNodeHash(readFileSync(file, "utf8"));
    await mutateTopographic(
      root,
      {
        action: "replace",
        path: file,
        startLine: 2,
        endLine: 2,
        content: "  return 2",
        baseHash: hash,
      },
      readNodes,
    );
    expect(readFileSync(file, "utf8")).toContain("return 2");
    await expect(
      mutateTopographic(root, { action: "delete", path: file, baseHash: hash }, readNodes),
    ).rejects.toThrow("hash-conflict");
    await expect(
      readTopographicContent(root, { path: join(root, "..", "outside.ts") }, readNodes),
    ).rejects.toThrow("outside-workspace");
  });

  it("renames a file when destination is only a new basename", async () => {
    const { root, file, readNodes } = fixture();
    const hash = semanticNodeHash(readFileSync(file, "utf8"));
    await mutateTopographic(
      root,
      { action: "rename", path: file, destination: "renamed.ts", baseHash: hash },
      readNodes,
    );
    expect(readFileSync(join(root, "src", "renamed.ts"), "utf8")).toContain("function hello");
  });

  it("edits a uniquely named node without requiring its ID", async () => {
    const { root, file, readNodes } = fixture();
    const node = (await readNodes(file))[0];
    const result = await mutateTopographic(
      root,
      {
        action: "replace",
        path: file,
        nodeName: "hello",
        content: "function hello() { return 2 }",
        baseHash: node.baseHash,
      },
      readNodes,
    );
    expect(readFileSync(file, "utf8")).toContain("return 2");
    expect(result).toMatchObject({ ok: true, startLine: 1, endLine: 3 });
  });
});
