import { resolve } from "path";

const MAX_STRING_LENGTH = 16 * 1024 * 1024;

export function ipcWarn(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[ipc:${scope}] ${message}`);
}

export function normalizeIpcString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  if (trimmed.includes("\0")) throw new Error(`${label} contains an invalid null byte`);
  if (trimmed.length > MAX_STRING_LENGTH) throw new Error(`${label} is too large`);
  return trimmed;
}

export function normalizeIpcPath(value: unknown, label = "path"): string {
  const path = normalizeIpcString(value, label);
  return resolve(path);
}

export function normalizeIpcUrl(
  value: unknown,
  protocols: readonly string[] = ["http:", "https:"],
): string {
  const input = normalizeIpcString(value, "url");
  const markdownLink = input.match(/^\[[^\]]+\]\((https?:\/\/[^)]+)\)$/);
  const raw = (markdownLink?.[1] ?? input).replace(/^["']|["']$/g, "");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("url is invalid");
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`url protocol is not allowed: ${parsed.protocol}`);
  }
  return parsed.toString();
}

export function isLikelyBase64(value: unknown, maxBytes: number): value is string {
  if (typeof value !== "string" || !value) return false;
  if (value.length > Math.ceil(maxBytes * 1.4)) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}
