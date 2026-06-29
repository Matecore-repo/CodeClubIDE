const LARGE_FILE_THRESHOLD = 1024 * 1024;
const RANGE_SIZE = 256 * 1024;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function readTextFile(filePath: string): Promise<string | null> {
  const first = await window.api.readFileRange(filePath, 0, RANGE_SIZE, "", true);
  if (!first) return window.api.readFile(filePath);
  if (first.size <= LARGE_FILE_THRESHOLD && first.encoding === "utf8") {
    return first.data;
  }

  const decoder = new TextDecoder("utf-8");
  let output = "";
  let offset = 0;
  while (offset < first.size) {
    const range =
      offset === 0 ? first : await window.api.readFileRange(filePath, offset, RANGE_SIZE, "", true);
    if (!range) return null;
    const bytes =
      range.encoding === "base64" ? decodeBase64(range.data) : new TextEncoder().encode(range.data);
    output += decoder.decode(bytes, { stream: offset + range.length < first.size });
    offset += range.length;
    if (range.length === 0) break;
  }
  output += decoder.decode();
  return output;
}
