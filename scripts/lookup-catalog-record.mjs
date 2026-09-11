#!/usr/bin/env node
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { lookupCatalogRecord } from "./lib/catalog-record-lookup.mjs";

const relativePath = "data/base-variant-records/records.json";
const catalogPath = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
const MAX_BYTES = 32 * 1024 * 1024;

function requestFromArgs(args) {
  const request = {};
  for (let i = 0; i < args.length; i++) {
    const field = { "--name": "name", "--configuration-digest": "expectedConfigurationDigest" }[args[i]];
    if (!field || Object.hasOwn(request, field) || !args[i + 1] || args[i + 1].startsWith("--")) {
      throw new Error("invalid arguments");
    }
    request[field] = args[++i];
  }
  if (!request.name) throw new Error("missing name");
  return request;
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: node scripts/lookup-catalog-record.mjs --name RECORD_NAME [--configuration-digest SHA256]\nReturns one exact committed BaseVariantRecord as JSON, preserving evidence and limits.\nExit codes: 0 found, 3 not found, 4 digest mismatch, 2 invalid request/catalog.\nA match is not signature verification, deployment approval or runtime safety. No network or cluster access.");
  } else {
    const request = requestFromArgs(args);
    if (!statSync(catalogPath).isFile() || statSync(catalogPath).size > MAX_BYTES) throw new Error("invalid catalog size");
    const bytes = readFileSync(catalogPath);
    if (bytes.length > MAX_BYTES) throw new Error("invalid catalog size");
    const result = lookupCatalogRecord(JSON.parse(bytes.toString("utf8")), request);
    console.log(JSON.stringify({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "CatalogRecordLookup",
      catalog: { path: relativePath, sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}` },
      recordSchema: "schemas/base-variant-record.schema.json",
      ...result,
    }));
    process.exitCode = result.status === "found" ? 0 : result.status === "not-found" ? 3 : 4;
  }
} catch {
  console.error(JSON.stringify({ error: { code: "invalid-request-or-catalog", message: "Cannot resolve the exact record. Check --help, the record name/digest and the committed catalog." } }));
  process.exitCode = 2;
}
