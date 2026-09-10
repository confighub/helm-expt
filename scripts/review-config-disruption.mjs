#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { createHash } from "node:crypto";
import { reviewDisruption } from "./lib/config-disruption-review.mjs";

const MAX_BYTES = 10 * 1024 * 1024;
const PARSER_TIMEOUT_MS = 5000;
const PARSER = String.raw`
import json, sys, yaml

MAX_DOCUMENTS = 1000
MAX_DEPTH = 64

class StrictLoader(yaml.SafeLoader):
    nesting = -1
    def compose_node(self, parent, index):
        if self.check_event(yaml.events.AliasEvent):
            raise ValueError("aliases are not allowed")
        self.nesting += 1
        try:
            if self.nesting > MAX_DEPTH:
                raise ValueError("document nesting is too deep")
            return super().compose_node(parent, index)
        finally:
            self.nesting -= 1

def construct_mapping(loader, node, deep=False):
    if not isinstance(node, yaml.MappingNode):
        raise ValueError("document is not an object")
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in result:
            raise ValueError("duplicate mapping key")
        result[key] = loader.construct_object(value_node, deep=deep)
    return result

StrictLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_mapping)
StrictLoader.add_constructor("tag:yaml.org,2002:value", lambda loader, node: loader.construct_scalar(node))

def check_depth(value, depth=0):
    if depth > MAX_DEPTH:
        raise ValueError("document nesting is too deep")
    if isinstance(value, int) and not isinstance(value, bool) and abs(value) > 9007199254740991:
        raise ValueError("integer exceeds exact JSON number range")
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str):
                raise ValueError("mapping keys must be strings")
            check_depth(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            check_depth(child, depth + 1)

text = sys.stdin.read()
mode = sys.argv[1]
if mode == "json":
    def pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate JSON key")
            result[key] = value
        return result
    value = json.loads(text, object_pairs_hook=pairs, parse_constant=lambda value: (_ for _ in ()).throw(ValueError("non-standard JSON number")))
    if not isinstance(value, list):
        raise ValueError("JSON input must be an array")
    if len(value) > MAX_DOCUMENTS:
        raise ValueError("document count exceeds limit")
    for document in value:
        if not isinstance(document, dict):
            raise ValueError("every document must be an object")
        check_depth(document)
    documents = value
else:
    documents = []
    loader = StrictLoader(text)
    document_count = 0
    try:
        while loader.check_data():
            document_count += 1
            if document_count > MAX_DOCUMENTS:
                raise ValueError("document count is outside the allowed bound")
            node = loader.get_node()
            if isinstance(node, yaml.ScalarNode) and node.tag == "tag:yaml.org,2002:null" and node.value == "":
                continue
            document = loader.construct_document(node)
            if not isinstance(document, dict):
                raise ValueError("every document must be an object")
            check_depth(document)
            documents.append(document)
    finally:
        loader.dispose()
    if len(documents) == 0:
        raise ValueError("YAML input is empty")
print(json.dumps(documents, separators=(",", ":"), allow_nan=False))
`;

function usage() {
  return "Usage: node scripts/review-config-disruption.mjs --before FILE --after FILE\n       node scripts/review-config-disruption.mjs --help\nReads strict JSON arrays or YAML manifests using Python 3 with PyYAML. Exit 0 reports static review only; it is never approval or a runtime safety result.";
}

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  if (argv.includes("--help")) throw new Error("--help must be used alone");
  const values = { before: null, after: null };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (!["--before", "--after"].includes(option) || values[option.slice(2)] !== null) {
      throw new Error("arguments must contain one --before and one --after");
    }
    const value = argv[++index];
    if (!value || value.startsWith("--")) throw new Error("arguments require both input files");
    values[option.slice(2)] = value;
  }
  if (!values.before || !values.after) throw new Error("arguments require both input files");
  return values;
}

function input(path, label) {
  let descriptor;
  let bytes;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
    const stats = fstatSync(descriptor);
    if (!stats.isFile()) throw new Error("not a regular file");
    if (stats.size > MAX_BYTES) throw new Error("size limit");
    const chunks = [];
    let total = 0;
    while (total <= MAX_BYTES) {
      const chunk = Buffer.allocUnsafe(Math.min(1024 * 1024, MAX_BYTES + 1 - total));
      const read = readSync(descriptor, chunk, 0, chunk.length, null);
      if (read === 0) break;
      chunks.push(chunk.subarray(0, read));
      total += read;
      if (total > MAX_BYTES) break;
    }
    bytes = Buffer.concat(chunks, total);
    if (bytes.length > MAX_BYTES) throw new Error("size limit");

  } catch (error) {
    if (error instanceof Error && error.message === "size limit") {
      throw new Error(`${label} input exceeds the size limit`);
    }
    throw new Error(`unable to read ${label} input`);
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* already closed */ }
    }
  }
  return parseInput(bytes, label);
}

function parseInput(bytes, label) {
  let parsed;
  try {
    const text = bytes.toString("utf8");
    const mode = text.trimStart().startsWith("[") ? "json" : "yaml";
    const encoded = execFileSync("python3", ["-c", PARSER, mode], {
      input: bytes,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: PARSER_TIMEOUT_MS,
      maxBuffer: MAX_BYTES,
    });
    parsed = JSON.parse(encoded);
  } catch {
    throw new Error(`${label} input is not a bounded JSON array or YAML object manifest`);
  }
  return {
    objects: parsed,
    sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  const before = input(args.before, "before");
  const after = input(args.after, "after");
  let review;
  try {
    review = reviewDisruption(before.objects, after.objects);
  } catch {
    throw new Error("before or after object identity is invalid or duplicated");
  }
  console.log(JSON.stringify({
    schemaVersion: "1",
    kind: "ConfigDisruptionReview",
    before: { sha256: before.sha256, objectCount: before.objects.length },
    after: { sha256: after.sha256, objectCount: after.objects.length },
    review,
    notice: "Static review only; review-required is not an approval to apply.",
  }));
} catch (error) {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : "review failed" }));
  process.exitCode = 2;
}
