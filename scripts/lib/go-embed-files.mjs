// Read the files a Go program embedded with go:embed out of a 64-bit
// little-endian Mach-O binary, without running the binary.
//
// The Go linker stores an embed.FS as a slice of 48-byte rows: a name string
// (pointer, length), a data string (pointer, length), and a 16-byte hash. The
// reader finds the row whose name is a caller-supplied anchor, finds the slice
// header that owns that row, and returns every file in that one slice. It
// refuses rather than guesses when it cannot find exactly one owning slice.
//
// The caller decides what the bytes prove. Embedded bytes are the files that
// were compiled in; they say nothing about a repository the binary was built
// from unless the caller binds them to something else.

import { readFileSync } from "node:fs";

import { check, sha256 } from "./proof-common.mjs";

const MACHO_MAGIC_64 = 0xfeedfacf;
const LC_SEGMENT_64 = 0x19;
const ROW_BYTES = 48;

export function readGoEmbeddedFiles(binaryPath, anchorName) {
  const bytes = readFileSync(binaryPath);
  check(bytes.readUInt32LE(0) === MACHO_MAGIC_64, "binary is not a 64-bit little-endian Mach-O file");
  const segments = readSegments(bytes);
  const fileOffset = (address) => {
    for (const segment of segments) {
      if (address >= segment.address && address < segment.address + segment.fileSize) {
        return Number(address - segment.address + segment.fileOffset);
      }
    }
    return -1;
  };
  const address = (offset) => {
    for (const segment of segments) {
      const start = Number(segment.fileOffset);
      if (offset >= start && offset < start + Number(segment.fileSize)) {
        return segment.address + BigInt(offset - start);
      }
    }
    return -1n;
  };

  const anchor = Buffer.from(anchorName, "utf8");
  const anchorOffset = bytes.indexOf(anchor);
  check(anchorOffset !== -1, `binary does not contain the embedded name ${anchorName}`);
  check(
    bytes.indexOf(anchor, anchorOffset + 1) === -1,
    `binary contains ${anchorName} more than once; choose a unique anchor`,
  );
  const namePointer = Buffer.alloc(16);
  namePointer.writeBigUInt64LE(address(anchorOffset), 0);
  namePointer.writeBigUInt64LE(BigInt(anchor.length), 8);
  const rowOffset = bytes.indexOf(namePointer);
  check(rowOffset !== -1, `binary has no embed row naming ${anchorName}`);
  check(
    bytes.indexOf(namePointer, rowOffset + 1) === -1,
    `binary has more than one embed row naming ${anchorName}`,
  );

  const readRow = (offset) => {
    if (offset < 0 || offset + ROW_BYTES > bytes.length) return null;
    const nameAddress = bytes.readBigUInt64LE(offset);
    const nameLength = Number(bytes.readBigUInt64LE(offset + 8));
    const dataAddress = bytes.readBigUInt64LE(offset + 16);
    const dataLength = Number(bytes.readBigUInt64LE(offset + 24));
    const nameOffset = fileOffset(nameAddress);
    if (nameOffset === -1 || nameLength === 0 || nameLength > 4096) return null;
    const name = bytes.subarray(nameOffset, nameOffset + nameLength).toString("utf8");
    if (dataLength === 0) return { name, data: Buffer.alloc(0) };
    const dataOffset = fileOffset(dataAddress);
    if (dataOffset === -1) return null;
    return { name, data: bytes.subarray(dataOffset, dataOffset + dataLength) };
  };

  // Candidate starts are the rows reachable by stepping back from the anchor.
  // Only one of them is named by a slice header (pointer, length, capacity)
  // whose extent also covers the anchor row.
  const candidates = new Map();
  for (let offset = rowOffset; readRow(offset) && candidates.size < 100000; offset -= ROW_BYTES) {
    candidates.set(address(offset), offset);
  }
  const owners = [];
  for (const segment of segments.filter((item) => item.name.startsWith("__DATA"))) {
    const start = Number(segment.fileOffset);
    const end = start + Number(segment.fileSize) - 24;
    for (let offset = start; offset <= end; offset += 8) {
      const tableOffset = candidates.get(bytes.readBigUInt64LE(offset));
      if (tableOffset === undefined) continue;
      const length = bytes.readBigUInt64LE(offset + 8);
      const capacity = bytes.readBigUInt64LE(offset + 16);
      if (length !== capacity || length === 0n || length > 1000000n) continue;
      if (tableOffset + Number(length) * ROW_BYTES <= rowOffset) continue;
      owners.push({ tableOffset, length: Number(length) });
    }
  }
  const distinct = new Map(owners.map((owner) => [`${owner.tableOffset}:${owner.length}`, owner]));
  check(
    distinct.size === 1,
    `expected one embed slice owning ${anchorName}, found ${distinct.size}`,
  );
  const [{ tableOffset, length }] = [...distinct.values()];

  const files = new Map();
  for (let index = 0; index < length; index += 1) {
    const row = readRow(tableOffset + index * ROW_BYTES);
    check(row, `embed row ${index} of ${length} is unreadable`);
    if (row.name.endsWith("/")) continue;
    check(!files.has(row.name), `embed slice repeats ${row.name}`);
    files.set(row.name, { sha256: sha256(row.data), bytes: row.data.length });
  }
  return files;
}

function readSegments(bytes) {
  const commandCount = bytes.readUInt32LE(16);
  const segments = [];
  let offset = 32;
  for (let index = 0; index < commandCount; index += 1) {
    const command = bytes.readUInt32LE(offset);
    const size = bytes.readUInt32LE(offset + 4);
    if (command === LC_SEGMENT_64) {
      segments.push({
        name: bytes.subarray(offset + 8, offset + 24).toString("utf8").replace(/\0+$/, ""),
        address: bytes.readBigUInt64LE(offset + 24),
        fileOffset: bytes.readBigUInt64LE(offset + 40),
        fileSize: bytes.readBigUInt64LE(offset + 48),
      });
    }
    offset += size;
  }
  check(segments.length > 0, "binary has no Mach-O segments");
  return segments;
}
