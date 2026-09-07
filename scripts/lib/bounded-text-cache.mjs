const DEFAULT_MAX_ENTRIES = 512;
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;

function containsNegativeZero(value) {
  if (typeof value === "number") return Object.is(value, -0);
  if (Array.isArray(value)) return value.some(containsNegativeZero);
  if (value && typeof value === "object") return Object.values(value).some(containsNegativeZero);
  return false;
}

export function createBoundedTextCache({ maxEntries = DEFAULT_MAX_ENTRIES, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const entries = new Map();
  let totalBytes = 0;

  return {
    get(text, parse) {
      if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > maxBytes) return parse();
      const cached = entries.get(text);
      if (cached !== undefined) {
        entries.delete(text);
        entries.set(text, cached);
        return JSON.parse(cached.serialized);
      }
      const value = parse();
      if (containsNegativeZero(value)) return value;
      const serialized = JSON.stringify(value);
      if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > maxBytes) return value;
      const textBytes = Buffer.byteLength(text, "utf8");
      const serializedBytes = Buffer.byteLength(serialized, "utf8");
      if (textBytes + serializedBytes > maxBytes) return value;
      entries.set(text, { serialized, bytes: textBytes + serializedBytes });
      totalBytes += textBytes + serializedBytes;
      while (entries.size > maxEntries || totalBytes > maxBytes) {
        const oldest = entries.entries().next().value;
        entries.delete(oldest[0]);
        totalBytes -= oldest[1].bytes;
      }
      return JSON.parse(serialized);
    },
    clear() { entries.clear(); totalBytes = 0; },
    get size() { return entries.size; },
    get bytes() { return totalBytes; },
  };
}
