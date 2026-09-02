#!/usr/bin/env node
// A read-side OCI gateway for the Catalog: stable names over the publishing
// registries, the receipt served as a referrer, and listing, so any OCI client
// pulls a certified bundle by the name the Catalog gives it.
//
//   node catalog-oci-gateway.mjs --repo /path/to/helm-expt [--port 5010]
//
// Names: <chart>/<version>/<variant> for catalog bundles. A manifest or blob is
// fetched from the registry the receipt names (anonymous bearer token when the
// registry asks for one) and streamed back. The referrers endpoint answers with
// a synthesized artifact whose single layer is the receipt, so oras discover
// and cub config verify find it. Push is not implemented: this is the first
// version the design note describes.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const opt = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const repoRoot = opt("--repo", process.cwd());
const port = Number(opt("--port", "5010"));
const require = createRequire(import.meta.url);
const yaml = require("./lib/js-yaml-vendored.cjs");
const RECORD_TYPE = "application/vnd.confighub.record.v1+json";
const sha256 = (buffer) => "sha256:" + createHash("sha256").update(buffer).digest("hex");

// Index: stable name -> { upstream repo, digest, receipt json bytes }
const entries = new Map();
const csv = readFileSync(join(repoRoot, "data/certified-bundles/receipts.csv"), "utf8").trim().split("\n");
const header = csv[0].split(",");
for (const line of csv.slice(1)) {
  const cols = line.split(",");
  const row = Object.fromEntries(header.map((key, i) => [key, cols[i]]));
  if (row.producer !== "config-workshop-catalog" || row.oci_published !== "published") continue;
  const receipt = yaml.load(readFileSync(join(repoRoot, row.receipt), "utf8"));
  const spec = receipt.spec;
  const upstream = String(spec.bundle?.reference ?? spec.reference ?? "").replace(/^oci:\/\//, "");
  const host = upstream.split("/")[0];
  const repo = upstream.slice(host.length + 1).split(/[:@]/)[0];
  const variant = row.name.split(`${row.chart_version}-`)[1] ?? "default";
  const name = `${row.chart}/${row.chart_version}/${variant}`;
  const receiptJson = Buffer.from(JSON.stringify(receipt, null, 2));
  entries.set(name, { host, repo, digest: spec.bundle?.manifestDigest ?? spec.manifestDigest, receiptJson, receiptDigest: sha256(receiptJson) });
}
console.log(`catalog gateway: ${entries.size} stable names on :${port}`);

const tokens = new Map();
async function upstreamFetch(entry, path, accept) {
  const url = `https://${entry.host}/v2/${entry.repo}/${path}`;
  const headers = accept ? { accept } : {};
  const cached = tokens.get(entry.host + entry.repo);
  if (cached) headers.authorization = `Bearer ${cached}`;
  let response;
  try {
    response = await fetch(url, { headers, redirect: "follow" });
  } catch (error) {
    throw new Error(`upstream ${url}: ${error.message}${error.cause ? ` (${error.cause.message ?? error.cause.code})` : ""}`);
  }
  if (response.status === 401) {
    const challenge = response.headers.get("www-authenticate") ?? "";
    const param = (key) => (challenge.match(new RegExp(`${key}="([^"]+)"`)) ?? [])[1];
    const realm = param("realm"); const service = param("service"); const scope = param("scope") ?? `repository:${entry.repo}:pull`;
    if (!realm) return response;
    const tokenResponse = await fetch(`${realm}?service=${encodeURIComponent(service)}&scope=${encodeURIComponent(scope)}`);
    const body = await tokenResponse.json();
    const token = body.token ?? body.access_token;
    tokens.set(entry.host + entry.repo, token);
    response = await fetch(url, { headers: { ...headers, authorization: `Bearer ${token}` }, redirect: "follow" });
  }
  return response;
}

const manifestCache = new Map();
async function upstreamManifest(entry) {
  if (manifestCache.has(entry.digest)) return manifestCache.get(entry.digest);
  const response = await upstreamFetch(entry, `manifests/${entry.digest}`, "application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json");
  const bytes = Buffer.from(await response.arrayBuffer());
  const record = { bytes, type: response.headers.get("content-type") ?? "application/vnd.oci.image.manifest.v1+json", status: response.status };
  manifestCache.set(entry.digest, record);
  return record;
}

const EMPTY = Buffer.from("{}");
function receiptArtifact(entry, subject) {
  const manifest = {
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    artifactType: RECORD_TYPE,
    config: { mediaType: "application/vnd.oci.empty.v1+json", digest: sha256(EMPTY), size: EMPTY.length, data: Buffer.from(EMPTY).toString("base64") },
    layers: [{ mediaType: RECORD_TYPE, digest: entry.receiptDigest, size: entry.receiptJson.length, annotations: { "org.opencontainers.image.title": "receipt.json" } }],
    subject: { mediaType: subject.type, digest: entry.digest, size: subject.bytes.length },
    annotations: { "org.opencontainers.image.created": "1970-01-01T00:00:00Z" },
  };
  const bytes = Buffer.from(JSON.stringify(manifest));
  return { bytes, digest: sha256(bytes) };
}

function send(res, status, body, type, extra = {}) {
  res.writeHead(status, { "content-type": type, "content-length": Buffer.byteLength(body), "docker-distribution-api-version": "registry/2.0", ...extra });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = url.pathname;
    if (path === "/v2/" || path === "/v2") return send(res, 200, "{}", "application/json");
    if (path === "/v2/_catalog") return send(res, 200, JSON.stringify({ repositories: [...entries.keys()].sort() }), "application/json");
    const match = path.match(/^\/v2\/(.+?)\/(tags\/list|manifests|blobs|referrers)(?:\/(.+))?$/);
    if (!match) return send(res, 404, JSON.stringify({ errors: [{ code: "NAME_UNKNOWN" }] }), "application/json");
    const [, name, kind, ref] = match;
    const entry = entries.get(name);
    if (!entry) return send(res, 404, JSON.stringify({ errors: [{ code: "NAME_UNKNOWN", message: name }] }), "application/json");
    if (kind === "tags/list") return send(res, 200, JSON.stringify({ name, tags: ["latest"] }), "application/json");
    const subject = await upstreamManifest(entry);
    const artifact = receiptArtifact(entry, subject);
    if (kind === "referrers") {
      const index = { schemaVersion: 2, mediaType: "application/vnd.oci.image.index.v1+json", manifests: ref === entry.digest ? [{ mediaType: "application/vnd.oci.image.manifest.v1+json", artifactType: RECORD_TYPE, digest: artifact.digest, size: artifact.bytes.length }] : [] };
      return send(res, 200, JSON.stringify(index), "application/vnd.oci.image.index.v1+json");
    }
    if (kind === "manifests") {
      if (ref === artifact.digest) return send(res, 200, req.method === "HEAD" ? "" : artifact.bytes, "application/vnd.oci.image.manifest.v1+json", { "docker-content-digest": artifact.digest, "content-length": artifact.bytes.length });
      if (ref === "latest" || ref === entry.digest) return send(res, subject.status, req.method === "HEAD" ? "" : subject.bytes, subject.type, { "docker-content-digest": entry.digest, "content-length": subject.bytes.length });
      return send(res, 404, JSON.stringify({ errors: [{ code: "MANIFEST_UNKNOWN" }] }), "application/json");
    }
    if (kind === "blobs") {
      if (ref === entry.receiptDigest) return send(res, 200, req.method === "HEAD" ? "" : entry.receiptJson, "application/octet-stream", { "docker-content-digest": ref, "content-length": entry.receiptJson.length });
      if (ref === sha256(EMPTY)) return send(res, 200, req.method === "HEAD" ? "" : EMPTY, "application/octet-stream", { "docker-content-digest": ref, "content-length": EMPTY.length });
      const response = await upstreamFetch(entry, `blobs/${ref}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      return send(res, response.status, req.method === "HEAD" ? "" : bytes, "application/octet-stream", { "docker-content-digest": ref, "content-length": bytes.length });
    }
  } catch (error) {
    send(res, 500, JSON.stringify({ errors: [{ code: "UNKNOWN", message: String(error.message) }] }), "application/json");
  }
}).listen(port);
