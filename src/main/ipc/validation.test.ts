import { isAbsolute } from "path";
import { describe, expect, it } from "vite-plus/test";
import {
  isLikelyBase64,
  normalizeIpcPath,
  normalizeIpcString,
  normalizeIpcUrl,
} from "./validation";

describe("IPC validation", () => {
  it("normalizes non-empty strings", () => {
    expect(normalizeIpcString("  ok  ", "value")).toBe("ok");
  });

  it("rejects empty strings and null bytes", () => {
    expect(() => normalizeIpcString("   ", "value")).toThrow("required");
    expect(() => normalizeIpcString("a\0b", "value")).toThrow("null byte");
  });

  it("resolves paths without requiring workspace scope", () => {
    const normalized = normalizeIpcPath("src/main/index.ts");
    expect(isAbsolute(normalized)).toBe(true);
    expect(normalized.replace(/\\/g, "/")).toContain("src/main/index.ts");
  });

  it("allows http and https URLs by default", () => {
    expect(normalizeIpcUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(normalizeIpcUrl("http://localhost:11434/api")).toBe("http://localhost:11434/api");
  });

  it("rejects unsafe URL protocols", () => {
    expect(() => normalizeIpcUrl("file:///C:/secret.txt")).toThrow("protocol");
    expect(() => normalizeIpcUrl("javascript:alert(1)")).toThrow("protocol");
  });

  it("allows mailto only when explicitly requested", () => {
    expect(() => normalizeIpcUrl("mailto:test@example.com")).toThrow("protocol");
    expect(normalizeIpcUrl("mailto:test@example.com", ["mailto:"])).toBe("mailto:test@example.com");
  });

  it("checks base64 shape and size", () => {
    expect(isLikelyBase64("aGVsbG8=", 16)).toBe(true);
    expect(isLikelyBase64("not base64!", 16)).toBe(false);
    expect(isLikelyBase64("aGVsbG8=", 1)).toBe(false);
  });
});
