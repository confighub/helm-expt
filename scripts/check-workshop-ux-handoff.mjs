#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { lookupCatalogRecord } from "./lib/catalog-record-lookup.mjs";

const REQUIRED_ARTIFACTS = ["record.json", "result.md", "trial-log.md"];
const SHA256_RE = /^[a-f0-9]{64}$/;
const ENVELOPE_VERSION = "catalog.confighub.com/v1alpha1";
const MAX_CATALOG_BYTES = 32 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

function hash(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function finding(code, message) {
  return { code, message };
}

function output(passed, findings) {
  process.stdout.write(`${JSON.stringify({
    passed,
    scope: "Validates artifacts only; it does not validate prose accuracy, elapsed time, authorization, or UX pass.",
    findings,
  })}\n`);
}

function parseArgs(args) {
  const fields = { "--trial-dir": "trialDir", "--catalog": "catalog", "--catalog-sha256": "catalogSha256", "--record-name": "recordName" };
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const field = fields[args[index]];
    const value = args[index + 1];
    if (!field || Object.hasOwn(result, field) || typeof value !== "string" || !value || value.startsWith("--")) {
      throw new Error("invalid arguments");
    }
    result[field] = value;
    index += 1;
  }
  if (Object.keys(result).length !== Object.keys(fields).length || !SHA256_RE.test(result.catalogSha256) || !result.recordName.trim()) {
    throw new Error("invalid arguments");
  }
  return result;
}

function regularFile(path, maxBytes) {
  try {
    const stat = lstatSync(path);
    return stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= maxBytes;
  } catch {
    return false;
  }
}

function readTrialArtifacts(trialDir) {
  let root;
  try {
    const stat = lstatSync(trialDir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("invalid trial directory");
    root = realpathSync(trialDir);
  } catch {
    return { findings: [finding("invalid-trial-directory", "The trial directory is unavailable.")] };
  }
  const paths = Object.fromEntries(REQUIRED_ARTIFACTS.map((name) => [name, resolve(root, name)]));
  const missing = REQUIRED_ARTIFACTS.filter((name) => dirname(paths[name]) !== root || !regularFile(paths[name], MAX_ARTIFACT_BYTES));
  if (missing.length) return { findings: missing.map((name) => finding("missing-or-unsafe-artifact", `Required artifact is missing or unsafe: ${name}.`)) };
  try {
    const blank = ["result.md", "trial-log.md"].filter((name) => !readFileSync(paths[name], "utf8").trim());
    if (blank.length) return { findings: blank.map((name) => finding("empty-artifact", `Required artifact is empty: ${name}.`)) };
  } catch {
    return { findings: [finding("unreadable-artifact", "A required artifact cannot be read.")] };
  }
  return { root, paths, findings: [] };
}

function validateEnvelope(envelope, expectedLookup, catalogHash, expectedName) {
  const findings = [];
  if (!envelope || Array.isArray(envelope) || typeof envelope !== "object") {
    return [finding("invalid-record-envelope", "record.json is not a catalog lookup envelope.")];
  }
  if (envelope.apiVersion !== ENVELOPE_VERSION || envelope.kind !== "CatalogRecordLookup" || envelope.status !== "found" || envelope.name !== expectedName) {
    findings.push(finding("wrong-record-envelope", "record.json does not identify the requested found catalog record."));
  }
  if (envelope.catalog?.sha256 !== catalogHash) {
    findings.push(finding("catalog-hash-mismatch", "record.json does not pin these catalog bytes."));
  }
  if (!Object.hasOwn(envelope, "record") || !isDeepStrictEqual(envelope.record, expectedLookup.record)) {
    findings.push(finding("selected-record-mismatch", "record.json does not contain the selected catalog record."));
  }
  if (envelope.selectedRecordSha256 !== expectedLookup.selectedRecordSha256) {
    findings.push(finding("selected-record-hash-mismatch", "record.json has an incorrect selected record hash."));
  }
  return findings;
}

function check(args) {
  const trial = readTrialArtifacts(args.trialDir);
  if (trial.findings.length) return trial.findings;
  if (!regularFile(args.catalog, MAX_CATALOG_BYTES)) return [finding("invalid-catalog", "The catalog is unavailable.")];

  let catalogBytes;
  let catalog;
  let envelope;
  try {
    catalogBytes = readFileSync(args.catalog);
    catalog = JSON.parse(catalogBytes.toString("utf8"));
    envelope = JSON.parse(readFileSync(trial.paths["record.json"], "utf8"));
  } catch {
    return [finding("invalid-json", "The catalog or record.json cannot be parsed.")];
  }
  const catalogHash = hash(catalogBytes);
  const requestedHash = `sha256:${args.catalogSha256}`;
  if (catalogHash !== requestedHash) return [finding("requested-catalog-hash-mismatch", "The catalog bytes do not match the requested hash.")];

  let expectedLookup;
  try {
    expectedLookup = lookupCatalogRecord(catalog, { name: args.recordName });
  } catch {
    return [finding("invalid-catalog", "The catalog cannot be used for a record lookup.")];
  }
  if (expectedLookup.status !== "found") return [finding("record-not-found", "The requested record was not found in the catalog.")];
  return validateEnvelope(envelope, expectedLookup, catalogHash, args.recordName);
}

try {
  const args = parseArgs(process.argv.slice(2));
  const findings = check(args);
  output(findings.length === 0, findings.length ? findings : [finding("artifacts-validated", "Artifacts match the requested catalog record.")]);
  process.exitCode = findings.length ? 1 : 0;
} catch {
  output(false, [finding("invalid-arguments", "Arguments must provide each required option once.")]);
  process.exitCode = 2;
}
