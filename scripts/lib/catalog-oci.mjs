// The Catalog's configuration OCI artifacts on GitHub's registry.
//
// The Catalog publishes four kinds of configuration artifact that are not
// installer packages: certified config bundles, the literal bundles of the
// NVIDIA chart bases, the NIMService variants, and the Timoni Redis
// configuration. Until now each was pushed by hand to a Google registry with a
// maintainer's credential, unsigned, and nothing published a new one when its
// inputs changed. This module describes where each one now goes,
// oci://<REGISTRY>/<name>:<tag> with REGISTRY ghcr.io/confighub/configs/catalog,
// and builds the exact bytes to push. scripts/publish-catalog-oci.mjs pushes
// them from the catalog OCI workflow, signs each digest keylessly as that
// workflow, and records what it observed.
//
// An artifact is "rebuilt" when the committed files build its bytes in this
// process. When it was already published to the Google registry, the rebuilt
// manifest digest has to equal the one that publication recorded, so the GHCR
// copy and the Google copy are one artifact at two addresses:
//
// - NVIDIA literal bundles and NIMService variants are written byte by byte by
//   their own modules (stored-block gzip), so every machine builds the same
//   digest. Their receipts are refused unless they match those bytes.
// - Certified bundles were tarred by the host tar and compressed by gzip -n.
//   This module writes the same ustar layout and compresses with the system
//   zlib through Python, which reproduces those bytes on macOS and on Linux.
//   GNU gzip and the zlib Node bundles do not, so neither is used. The space
//   guide inside a published bundle is the one written before publication,
//   whose upload command reads <bundle>; the committed guide was rewritten
//   afterwards to cite the published reference, so that one line is put back
//   before building. A bundle whose committed files no longer build its
//   recorded digest either way is "copied" instead.
//
// An artifact is "copied" when the repository cannot rebuild the bytes that
// were published: its manifest and blobs are read from the Google registry at
// the digest the committed receipt records, checked against that digest, and
// pushed unchanged. The Timoni Redis configuration is one: oras stamped its
// manifest with the push time, which no committed file records.
//
// Tags never move. The Google copies of the certified bundles sit at :latest;
// GHCR gets no latest, because every Catalog reference pins the manifest
// digest and a moving tag could not be signed once and left alone. Each tag
// ends with the first twelve hex digits of the manifest digest, so a changed
// bundle is a new tag beside the old one rather than a rewrite of it.
//
// Nothing in this module contacts a registry except the functions under
// "registry" below, which scripts/publish-catalog-oci.mjs calls.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYamlFiles, readYamlText, repoRoot, serializeYaml, trackedExists } from "./proof-common.mjs";
import { loadNvidiaLiteralBundleEntries } from "./nvidia-literal-bundles.mjs";
import { loadNimServiceEntries } from "./nimservice-entries.mjs";

export const CATALOG_OCI_REGISTRY = "ghcr.io/confighub/configs/catalog";
export const CATALOG_OCI_EARLIER_REGISTRY = "europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt";
export const CATALOG_OCI_WORKFLOW = ".github/workflows/catalog-oci-publish.yml";
export const CATALOG_OCI_IDENTITY_REGEXP = "^https://github.com/confighub/helm-expt/.github/workflows/catalog-oci-publish.yml@refs/heads/main$";
export const CATALOG_OCI_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
export const CATALOG_OCI_RECEIPT_ROOT = "runs/catalog-oci";
export const CATALOG_OCI_RECEIPT_KIND = "CatalogOciPublicationReceipt";
export const CATALOG_OCI_INDEX = "data/catalog-oci/artifacts.csv";
export const CATALOG_OCI_SUMMARY = "data/catalog-oci/summary.md";
export const CATALOG_OCI_AWAITING = "awaits-workflow-publication";
export const CATALOG_OCI_PUBLISHED = "published-signed";
export const CATALOG_OCI_KINDS = ["certified-bundle", "nvidia-literal-bundle", "nimservice-variant", "timoni-config"];

const OCI_MANIFEST_TYPE = "application/vnd.oci.image.manifest.v1+json";
const OCI_EMPTY_CONFIG_TYPE = "application/vnd.oci.empty.v1+json";
const OCI_EMPTY_CONFIG = Buffer.from("{}");
const BUNDLE_ARTIFACT_TYPE = "application/vnd.confighub.config.bundle.v1";
const BUNDLE_LAYER_TYPE = "application/vnd.oci.image.layer.v1.tar+gzip";
const CREATED_ANNOTATION = "1970-01-01T00:00:00Z";
const CERTIFIED_RECEIPT_ROOT = "data/certified-bundles/receipts/catalog";
const CERTIFIED_PUBLICATION_ROOT = "runs/certified-bundles";
const TIMONI_RECEIPT = "runs/timoni-redis-catalog-proof/public-oci-receipt.yaml";
const TIMONI_RECORD = "timoni-redis-8-10-1-default";

const sha256Hex = (data) => createHash("sha256").update(data).digest("hex");
const digestOf = (data) => `sha256:${sha256Hex(data)}`;
const stripOci = (reference) => String(reference).replace(/^oci:\/\//, "");
const shortDigest = (digest) => String(digest).replace(/^sha256:/, "").slice(0, 12);

// The repository part of a reference: everything before its tag or digest.
export function ociRepository(reference) {
  const bare = stripOci(reference).replace(/@sha256:[0-9a-f]{64}$/, "");
  const slash = bare.lastIndexOf("/");
  const colon = bare.lastIndexOf(":");
  return colon > slash ? bare.slice(0, colon) : bare;
}

export function catalogOciRegistry(env = process.env) {
  return String(env.REGISTRY || CATALOG_OCI_REGISTRY).replace(/^oci:\/\//, "").replace(/\/+$/, "");
}

export function catalogOciVerifyCommand(immutableReference) {
  return `cosign verify --certificate-identity-regexp '${CATALOG_OCI_IDENTITY_REGEXP}' --certificate-oidc-issuer ${CATALOG_OCI_OIDC_ISSUER} ${stripOci(immutableReference)}`;
}

export const catalogOciReceiptRel = (name, tag) => `${CATALOG_OCI_RECEIPT_ROOT}/${name}/${tag}.yaml`;

// --- certified bundle bytes ---------------------------------------------------

// One ustar header as bsdtar writes it with --uid 0 --gid 0 --numeric-owner
// --format ustar: space-terminated octal fields, no user or group names, and
// zero device numbers. The certified bundles on record were tarred that way.
function bsdtarHeader(name, size) {
  check(Buffer.byteLength(name) <= 100, `the staged path ${name} is longer than a ustar name field`);
  const header = Buffer.alloc(512, 0);
  const field = (text, offset) => header.write(text, offset, "latin1");
  const octal = (value, width) => value.toString(8).padStart(width, "0");
  field(name, 0);
  field("000644 \0", 100);
  field("000000 \0", 108);
  field("000000 \0", 116);
  field(`${octal(size, 11)} `, 124);
  field(`${octal(0, 11)} `, 136);
  field("        ", 148);
  field("0", 156);
  field("ustar\0", 257);
  field("00", 263);
  field("000000 \0", 329);
  field("000000 \0", 337);
  let sum = 0;
  for (const byte of header) sum += byte;
  field(`${octal(sum, 6)}\0 `, 148);
  return header;
}

// The files in path order under "./", two zero blocks, then padding to a whole
// 10240-byte record, which is where bsdtar stops.
export function certifiedBundleTar(files) {
  const parts = [];
  for (const file of [...files].sort((left, right) => (left.path < right.path ? -1 : 1))) {
    parts.push(bsdtarHeader(`./${file.path}`, file.data.length), file.data);
    const padding = (512 - (file.data.length % 512)) % 512;
    if (padding > 0) parts.push(Buffer.alloc(padding, 0));
  }
  parts.push(Buffer.alloc(1024, 0));
  const body = Buffer.concat(parts);
  return Buffer.concat([body, Buffer.alloc((10240 - (body.length % 10240)) % 10240, 0)]);
}

// gzip -n as the certified bundles were compressed: a bare header with no name
// and no time, operating system 3, and a level-6 deflate stream from the
// reference zlib. Python's zlib module is that library on the machines this
// runs on; Node bundles a fork whose output differs, and GNU gzip has its own
// deflate. A host whose zlib differs builds other bytes, and the digest check
// that follows every build refuses them.
const PYTHON_GZIP = `import struct, sys, zlib
data = sys.stdin.buffer.read()
compressor = zlib.compressobj(6, zlib.DEFLATED, -15, 8, 0)
body = compressor.compress(data) + compressor.flush()
sys.stdout.buffer.write(b"\\x1f\\x8b\\x08\\x00\\x00\\x00\\x00\\x00\\x00\\x03" + body + struct.pack("<II", zlib.crc32(data) & 0xffffffff, len(data) & 0xffffffff))`;

export function referenceZlibGzip(data) {
  const result = spawnSync("python3", ["-I", "-c", PYTHON_GZIP], { input: data, maxBuffer: 1024 * 1024 * 1024, timeout: 120000 });
  check(result.status === 0, `python3 could not gzip a certified bundle: ${String(result.stderr || result.error || "").trim()}`);
  return result.stdout;
}

// Where publish-certified-bundles.mjs staged each file of a receipt.
function certifiedStagedPath(file) {
  const role = String(file.role ?? "");
  const base = String(file.path).split("/").pop();
  if (role.startsWith("route:")) return `routes/${base}`;
  if (role.startsWith("requirement:")) return `requirements/${base}`;
  if (role === "space-guide") return "README.md";
  return base;
}

function bundleManifest({ name, layer, configData }) {
  const config = { mediaType: OCI_EMPTY_CONFIG_TYPE, digest: digestOf(OCI_EMPTY_CONFIG), size: OCI_EMPTY_CONFIG.length };
  // oras writes the empty config inline as well; the recorded manifests carry it.
  if (configData) config.data = OCI_EMPTY_CONFIG.toString("base64");
  return Buffer.from(JSON.stringify({
    schemaVersion: 2,
    mediaType: OCI_MANIFEST_TYPE,
    artifactType: BUNDLE_ARTIFACT_TYPE,
    config,
    layers: [{
      mediaType: BUNDLE_LAYER_TYPE,
      digest: digestOf(layer),
      size: layer.length,
      annotations: { "org.opencontainers.image.title": `${name}.tar.gz` },
    }],
    annotations: { "org.opencontainers.image.created": CREATED_ANNOTATION },
  }));
}

function grab(text, pattern) {
  return pattern.exec(text)?.[1] ?? "";
}

// The earlier publication a committed receipt records: where, at which digest.
function earlierRecord(rel, { reference, manifestDigest, layerDigest = "" }) {
  return {
    reference: stripOci(reference),
    repository: ociRepository(reference),
    manifestDigest,
    layerDigest,
    immutableReference: `${ociRepository(reference)}@${manifestDigest}`,
    receipt: rel,
  };
}

function certifiedBundleArtifacts(root) {
  const dir = join(root, CERTIFIED_RECEIPT_ROOT);
  const paths = readdirSync(dir).sort().map((name) => join(dir, name, "receipt.yaml")).filter((path) => existsSync(path) && trackedExists(path));
  const artifacts = [];
  for (const [path, receipt] of readYamlFiles(paths)) {
    const receiptRel = path.slice(root.length + 1);
    const name = String(receipt.metadata.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const spec = receipt.spec;
    // The same refusals the hand publisher made: only what an audit certified,
    // and never a flattened copy of a chart whose verdict says not to flatten.
    if (spec.verdict?.status !== "certified" || spec.verdict?.lane === "unsafe-to-flatten") continue;
    const publicationRel = `${CERTIFIED_PUBLICATION_ROOT}/${name}/publication-receipt.yaml`;
    let earlier = null;
    if (existsSync(join(root, publicationRel)) && trackedExists(join(root, publicationRel))) {
      const text = readFileSync(join(root, publicationRel), "utf8");
      earlier = earlierRecord(publicationRel, {
        reference: grab(text, /reference:\s*"([^"]+)"/),
        manifestDigest: grab(text, /manifestDigest:\s*"(sha256:[0-9a-f]{64})"/),
        layerDigest: grab(text, /layerDigest:\s*"(sha256:[0-9a-f]{64})"/),
      });
      check(/^sha256:[0-9a-f]{64}$/.test(earlier.manifestDigest), `${publicationRel} records no manifest digest`);
    }
    const files = spec.bundle.files.map((file) => {
      const source = join(root, file.path);
      check(existsSync(source), `${receiptRel}: the bundle file ${file.path} is missing`);
      const data = readFileSync(source);
      check(sha256Hex(data) === file.sha256, `${receiptRel}: ${file.path} is not the file the receipt records. Run npm run certified-bundles`);
      return { path: certifiedStagedPath(file), source: file.path, role: file.role, data };
    });
    // The committed guide, and the guide as it read before its bundle was
    // published, which named the bundle <bundle>.
    const candidates = [{ files, guide: "as committed" }];
    if (earlier) {
      const cited = `oci://${earlier.reference.replace(/:latest$/, "")}`;
      const guide = files.find((file) => file.path === "README.md");
      const text = guide?.data.toString("utf8") ?? "";
      if (text.split(cited).length === 2) {
        candidates.push({
          files: files.map((file) => (file === guide ? { ...file, data: Buffer.from(text.replace(cited, "<bundle>")) } : file)),
          guide: "as written before publication",
        });
      }
    }
    const built = candidates.map((candidate) => {
      const layer = referenceZlibGzip(certifiedBundleTar(candidate.files));
      const manifest = bundleManifest({ name, layer, configData: true });
      return { ...candidate, layer, manifest, manifestDigest: digestOf(manifest) };
    });
    const base = {
      kind: "certified-bundle",
      name,
      record: name.replace(/^catalog-/, ""),
      earlier,
      inputs: [receiptRel, ...files.map((file) => file.source)],
    };
    const match = earlier ? built.find((candidate) => candidate.manifestDigest === earlier.manifestDigest) : built[0];
    if (match) {
      artifacts.push({
        ...base,
        source: "rebuilt",
        sourceNote: earlier
          ? `rebuilt from ${receiptRel} with the space guide ${match.guide}; the same digest as the earlier publication`
          : `built from ${receiptRel}; never published before`,
        manifest: match.manifest,
        blobs: [OCI_EMPTY_CONFIG, match.layer],
        manifestDigest: match.manifestDigest,
        tagBase: "bundle",
      });
    } else {
      artifacts.push({
        ...base,
        source: "copied",
        sourceNote: `the committed files build ${built.map((candidate) => candidate.manifestDigest).join(" or ")}, not the ${earlier.manifestDigest} recorded at ${earlier.receipt}; the published bytes are copied at that digest`,
        manifestDigest: earlier.manifestDigest,
        tagBase: "bundle",
      });
    }
  }
  return artifacts;
}

// The literal bundles of the NVIDIA bases and the NIMService variants. Both
// modules build their bytes from committed files and refuse a receipt that
// records other bytes, and both commit a plan naming the digest, so a base or
// variant is published here only when the bytes are the committed plan's.
function literalArtifacts(root, kind, entries, earlierLabel) {
  return entries.map((entry) => {
    const artifact = entry.artifact;
    const planPath = join(root, artifact.planRel);
    check(existsSync(planPath), `${artifact.planRel} is missing`);
    const planned = grab(readFileSync(planPath, "utf8"), /manifestDigest:\s*"?(sha256:[0-9a-f]{64})/);
    check(
      planned === artifact.manifestDigest,
      `${entry.recordName}: the committed files build ${artifact.manifestDigest} and ${artifact.planRel} records ${planned || "no digest"}. Regenerate the plan before publishing`,
    );
    const earlier = entry.publication?.published
      ? earlierRecord(entry.publication.receiptRel, {
        reference: artifact.reference,
        manifestDigest: artifact.manifestDigest,
        layerDigest: artifact.layerDigest,
      })
      : null;
    return {
      kind,
      name: artifact.bundleName,
      record: entry.recordName,
      source: "rebuilt",
      sourceNote: earlier
        ? `rebuilt from ${artifact.planRel} and its ${artifact.stagedFiles.length} staged files; the same digest as the earlier publication`
        : `built from ${artifact.planRel} and its ${artifact.stagedFiles.length} staged files; never published before`,
      earlier,
      manifest: artifact.manifest,
      blobs: [artifact.config ?? OCI_EMPTY_CONFIG, artifact.layer],
      manifestDigest: artifact.manifestDigest,
      // The existing tag names the render revision or the upstream commit. The
      // companion files can change under it, so the digest goes on the end.
      tagBase: artifact.tag,
      inputs: [artifact.planRel, ...artifact.stagedFiles.map((file) => file.source)],
      earlierLabel,
    };
  });
}

function timoniArtifact(root) {
  const path = join(root, TIMONI_RECEIPT);
  if (!existsSync(path) || !trackedExists(path)) return [];
  const text = readFileSync(path, "utf8");
  const reference = grab(text, /\n {4}reference:\s*"([^"]+)"/);
  const digest = grab(text, /\n {4}digest:\s*"(sha256:[0-9a-f]{64})"/);
  check(reference && digest, `${TIMONI_RECEIPT} records no reference and digest`);
  const tag = stripOci(reference).split(":").pop();
  return [{
    kind: "timoni-config",
    name: ociRepository(reference).split("/").pop(),
    record: TIMONI_RECORD,
    source: "copied",
    sourceNote: `oras stamped the manifest with its push time, which no committed file records, so the bytes recorded at ${TIMONI_RECEIPT} are copied at their digest`,
    earlier: earlierRecord(TIMONI_RECEIPT, { reference, manifestDigest: digest }),
    manifestDigest: digest,
    // One artifact, copied at one digest, under the tag it already had.
    tag,
    inputs: [TIMONI_RECEIPT],
  }];
}

// Every artifact this module publishes, in a stable order, each with its
// GHCR tag. Pass a registry to get references; the default is GHCR.
export function catalogOciArtifacts({ root = repoRoot, registry = CATALOG_OCI_REGISTRY, kinds = CATALOG_OCI_KINDS } = {}) {
  const artifacts = [];
  if (kinds.includes("certified-bundle")) artifacts.push(...certifiedBundleArtifacts(root));
  if (kinds.includes("nvidia-literal-bundle")) artifacts.push(...literalArtifacts(root, "nvidia-literal-bundle", loadNvidiaLiteralBundleEntries({ root })));
  if (kinds.includes("nimservice-variant")) artifacts.push(...literalArtifacts(root, "nimservice-variant", loadNimServiceEntries({ root })));
  if (kinds.includes("timoni-config")) artifacts.push(...timoniArtifact(root));
  for (const artifact of artifacts) {
    artifact.tag ??= `${artifact.tagBase}-${shortDigest(artifact.manifestDigest)}`;
    artifact.repository = `${registry}/${artifact.name}`;
    artifact.reference = `${artifact.repository}:${artifact.tag}`;
    artifact.immutableReference = `${artifact.repository}@${artifact.manifestDigest}`;
    check(/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(artifact.name), `${artifact.name} is not a valid repository name`);
    check(/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(artifact.tag), `${artifact.tag} is not a valid tag`);
    check(!artifact.tag.startsWith("sha256-"), `${artifact.tag} would collide with a cosign signature tag`);
  }
  const names = new Set(artifacts.map((artifact) => artifact.name));
  check(names.size === artifacts.length, "two catalog OCI artifacts would share one repository name");
  return artifacts.sort((left, right) => (CATALOG_OCI_KINDS.indexOf(left.kind) - CATALOG_OCI_KINDS.indexOf(right.kind)) || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
}

// --- receipts ---------------------------------------------------------------

export function catalogOciReceiptDoc(artifact, { observedAt, signature, anonymousPull }) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: CATALOG_OCI_RECEIPT_KIND,
    metadata: { name: artifact.name },
    spec: {
      kind: artifact.kind,
      record: artifact.record,
      reference: artifact.reference,
      immutableReference: artifact.immutableReference,
      manifestDigest: artifact.manifestDigest,
      source: artifact.source,
      sourceNote: artifact.sourceNote,
      earlierLocation: artifact.earlier
        ? {
          reference: artifact.earlier.immutableReference,
          receipt: artifact.earlier.receipt,
          sameDigest: artifact.earlier.manifestDigest === artifact.manifestDigest,
        }
        : null,
      publisher: CATALOG_OCI_WORKFLOW,
      signature,
      anonymousPull,
      observedAt,
    },
    status: { result: "pass" },
  };
}

// Why a committed receipt is not the receipt of this artifact. Empty when it is.
export function catalogOciReceiptProblems(receipt, artifact) {
  const problems = [];
  const expect = (condition, message) => { if (!condition) problems.push(message); };
  const spec = receipt?.spec ?? {};
  expect(receipt?.kind === CATALOG_OCI_RECEIPT_KIND, `it is a ${receipt?.kind ?? "nothing"}, not a ${CATALOG_OCI_RECEIPT_KIND}`);
  expect(receipt?.metadata?.name === artifact.name, `it names ${receipt?.metadata?.name}`);
  expect(spec.reference === artifact.reference, `it records ${spec.reference}, and the artifact is ${artifact.reference}`);
  expect(spec.manifestDigest === artifact.manifestDigest, `it records ${spec.manifestDigest}, and the artifact is ${artifact.manifestDigest}`);
  expect(spec.anonymousPull?.result === "pass", "it records no anonymous pull");
  expect(spec.signature?.result === "verified", "it records no verified signature");
  expect(spec.signature?.identityRegexp === CATALOG_OCI_IDENTITY_REGEXP && spec.signature?.issuer === CATALOG_OCI_OIDC_ISSUER, "its signature was not checked against the catalog OCI workflow identity");
  return problems;
}

// The receipt of an artifact's current tag, when one is committed.
export function loadCatalogOciReceipt(artifact, { root = repoRoot } = {}) {
  const rel = catalogOciReceiptRel(artifact.name, artifact.tag);
  const path = join(root, rel);
  if (!existsSync(path) || !trackedExists(path)) return null;
  const receipt = readYamlText(readFileSync(path, "utf8"));
  const problems = catalogOciReceiptProblems(receipt, artifact);
  check(problems.length === 0, `${rel} is not a receipt of ${artifact.reference}: ${problems.join("; ")}`);
  return { rel, receipt };
}

// --- the generated index ------------------------------------------------------

const INDEX_COLUMNS = [
  "kind",
  "name",
  "record",
  "source",
  "ghcr_reference",
  "manifest_digest",
  "ghcr_state",
  "ghcr_receipt",
  "earlier_reference",
  "same_digest_as_earlier",
  "verify_command",
];

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function catalogOciIndexRows(artifacts, { root = repoRoot } = {}) {
  return artifacts.map((artifact) => {
    const receipt = loadCatalogOciReceipt(artifact, { root });
    return {
      kind: artifact.kind,
      name: artifact.name,
      record: artifact.record,
      source: artifact.source,
      ghcr_reference: artifact.reference,
      manifest_digest: artifact.manifestDigest,
      ghcr_state: receipt ? CATALOG_OCI_PUBLISHED : CATALOG_OCI_AWAITING,
      ghcr_receipt: receipt?.rel ?? "",
      earlier_reference: artifact.earlier?.immutableReference ?? "",
      same_digest_as_earlier: artifact.earlier ? String(artifact.earlier.manifestDigest === artifact.manifestDigest) : "",
      verify_command: catalogOciVerifyCommand(artifact.immutableReference),
    };
  });
}

export function catalogOciIndexCsv(rows) {
  return `${[INDEX_COLUMNS.join(","), ...rows.map((row) => INDEX_COLUMNS.map((column) => csvCell(row[column])).join(","))].join("\n")}\n`;
}

export function catalogOciSummary(rows) {
  const count = (predicate) => rows.filter(predicate).length;
  const kinds = CATALOG_OCI_KINDS.map((kind) => {
    const of = rows.filter((row) => row.kind === kind);
    return `| ${kind} | ${of.length} | ${of.filter((row) => row.source === "rebuilt").length} | ${of.filter((row) => row.source === "copied").length} | ${of.filter((row) => row.earlier_reference).length} | ${of.filter((row) => row.ghcr_state === CATALOG_OCI_PUBLISHED).length} |`;
  });
  const copied = rows.filter((row) => row.source === "copied");
  return `# Catalog configuration OCI on GHCR

Generated by \`npm run catalog-oci:generate\` from the committed bundles, plans
and receipts. Do not edit it by hand.

The Catalog's configuration OCI artifacts that are not installer packages are
published to \`oci://${CATALOG_OCI_REGISTRY}/<name>:<tag>\` by the
[catalog OCI workflow](../../${CATALOG_OCI_WORKFLOW}) after a change to their
inputs is merged, and each manifest digest is signed keylessly as that
workflow. The earlier copies in the Google registry stay where they are, with
their receipts, as the recorded earlier location.

${rows.length} artifacts: ${count((row) => row.source === "rebuilt")} rebuilt from committed files, ${count((row) => row.source === "copied")} copied at their recorded digest, ${count((row) => row.ghcr_state === CATALOG_OCI_PUBLISHED)} with a GHCR receipt.

| Kind | Artifacts | Rebuilt | Copied | Published earlier | GHCR receipt |
| --- | ---: | ---: | ---: | ---: | ---: |
${kinds.join("\n")}

A row says \`${CATALOG_OCI_AWAITING}\` until a receipt under
\`${CATALOG_OCI_RECEIPT_ROOT}/<name>/<tag>.yaml\` records an anonymous pull of
that tag at that digest and a signature verified against the workflow
identity. Until then the Catalog's pages keep citing the earlier location.

Verify a published artifact with:

\`\`\`sh
cosign verify \\
  --certificate-identity-regexp '${CATALOG_OCI_IDENTITY_REGEXP}' \\
  --certificate-oidc-issuer ${CATALOG_OCI_OIDC_ISSUER} \\
  ${CATALOG_OCI_REGISTRY}/<name>@<manifest digest>
\`\`\`

${copied.length > 0 ? `## Copied rather than rebuilt

${copied.map((row) => `- \`${row.name}\` (${row.kind})`).join("\n")}

The committed files of these no longer build the bytes that were published, so
the workflow copies the published bytes at the digest their receipt records.
See [the reference](../../docs/reference/catalog-oci-on-ghcr.md) for why.
` : ""}`;
}

export function catalogOciOutputs({ root = repoRoot } = {}) {
  const rows = catalogOciIndexRows(catalogOciArtifacts({ root }), { root });
  return new Map([
    [CATALOG_OCI_INDEX, catalogOciIndexCsv(rows)],
    [CATALOG_OCI_SUMMARY, catalogOciSummary(rows)],
  ]);
}

// The index rows by catalog record name, for the listing and page generators.
// Reading the committed CSV keeps those generators offline and fast.
export function readCatalogOciIndex({ root = repoRoot } = {}) {
  const path = join(root, CATALOG_OCI_INDEX);
  if (!existsSync(path)) return new Map();
  const [header, ...lines] = readFileSync(path, "utf8").trimEnd().split("\n");
  const columns = header.split(",");
  const rows = new Map();
  for (const line of lines) {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (quoted) {
        if (char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; } else if (char === '"') quoted = false; else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { cells.push(cell); cell = ""; } else cell += char;
    }
    cells.push(cell);
    const row = Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""]));
    rows.set(row.record, row);
  }
  return rows;
}

// --- registry -----------------------------------------------------------------

// Plain HTTP only for a registry on this machine, the local trial.
export const plainHttpFlags = (reference) => (/^(localhost|127\.0\.0\.1)(:\d+)?\//.test(stripOci(reference)) ? ["--plain-http"] : []);

export function runAsync(command, args, { input, env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env: env ?? process.env });
    const out = [];
    const err = [];
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", (error) => resolve({ status: 127, stdout: "", stderr: error.message }));
    child.on("close", (status) => resolve({ status, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") }));
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

// An empty registry configuration and an empty home, so a read cannot borrow
// the credential a push used.
export function anonymousEnv(dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "config.json"), JSON.stringify({ auths: {} }));
  return {
    env: { PATH: process.env.PATH, HOME: dir, DOCKER_CONFIG: dir, CLOUDSDK_CONFIG: dir, GOOGLE_APPLICATION_CREDENTIALS: "" },
    config: join(dir, "config.json"),
  };
}

// The descriptor a registry serves for a reference: { state: "present",
// digest }, { state: "missing" }, or { state: "denied" } when the registry
// answered that the caller may not read it.
export async function fetchDescriptor(reference, { anonymous = null } = {}) {
  const args = ["manifest", "fetch", "--descriptor", ...plainHttpFlags(reference)];
  if (anonymous) args.push("--registry-config", anonymous.config);
  const result = await runAsync("oras", [...args, stripOci(reference)], { env: anonymous?.env });
  if (result.status === 0) return { state: "present", digest: JSON.parse(result.stdout).digest };
  const message = `${result.stderr}${result.stdout}`;
  if (/not found|NAME_UNKNOWN|MANIFEST_UNKNOWN|404/i.test(message)) return { state: "missing" };
  if (/denied|unauthorized|UNAUTHORIZED|DENIED|401|403/i.test(message)) return { state: "denied", message: message.trim().slice(0, 300) };
  return { state: "error", message: message.trim().slice(0, 600) };
}

// The manifest and blobs of a copied artifact, read at the recorded digest and
// checked against it.
export async function fetchRecordedBytes(artifact, dir, { anonymous }) {
  mkdirSync(dir, { recursive: true });
  const from = artifact.earlier.immutableReference;
  const manifestPath = join(dir, "manifest.json");
  const fetched = await runAsync("oras", ["manifest", "fetch", "--registry-config", anonymous.config, "--output", manifestPath, ...plainHttpFlags(from), from], { env: anonymous.env });
  check(fetched.status === 0, `could not read ${from}: ${fetched.stderr.trim().slice(0, 400)}`);
  const manifest = readFileSync(manifestPath);
  check(digestOf(manifest) === artifact.manifestDigest, `${from} served a manifest whose digest is ${digestOf(manifest)}`);
  const parsed = JSON.parse(manifest.toString("utf8"));
  const blobs = [];
  for (const descriptor of [parsed.config, ...(parsed.layers ?? [])]) {
    const blobPath = join(dir, descriptor.digest.replace(":", "-"));
    const blob = await runAsync("oras", ["blob", "fetch", "--registry-config", anonymous.config, "--output", blobPath, ...plainHttpFlags(from), `${artifact.earlier.repository}@${descriptor.digest}`], { env: anonymous.env });
    check(blob.status === 0, `could not read blob ${descriptor.digest} of ${from}: ${blob.stderr.trim().slice(0, 400)}`);
    const data = readFileSync(blobPath);
    check(digestOf(data) === descriptor.digest, `${from} served blob ${descriptor.digest} with other bytes`);
    blobs.push(data);
  }
  return { manifest, blobs };
}

// Push the blobs and the manifest by digest, with no tag. The tag is added
// only after the digest is signed, so a tag on GHCR always names a signed
// manifest, and a run that stops halfway leaves nothing a reader can find.
export async function pushUntagged(artifact, { manifest, blobs }, dir) {
  mkdirSync(dir, { recursive: true });
  const flags = plainHttpFlags(artifact.repository);
  for (const blob of blobs) {
    const path = join(dir, sha256Hex(blob));
    writeFileSync(path, blob);
    const result = await runAsync("oras", ["blob", "push", ...flags, `${artifact.repository}@${digestOf(blob)}`, path]);
    check(result.status === 0, `oras blob push to ${artifact.repository} failed: ${(result.stderr || result.stdout).trim().slice(0, 600)}`);
  }
  const manifestPath = join(dir, "manifest.json");
  writeFileSync(manifestPath, manifest);
  const pushed = await runAsync("oras", ["manifest", "push", "--descriptor", "--media-type", OCI_MANIFEST_TYPE, ...flags, artifact.immutableReference, manifestPath]);
  check(pushed.status === 0, `oras manifest push ${artifact.immutableReference} failed: ${(pushed.stderr || pushed.stdout).trim().slice(0, 600)}`);
  check(JSON.parse(pushed.stdout).digest === artifact.manifestDigest, `the registry stored ${artifact.immutableReference} under another digest`);
}

export async function tagDigest(artifact) {
  const result = await runAsync("oras", ["tag", ...plainHttpFlags(artifact.repository), artifact.immutableReference, artifact.tag]);
  check(result.status === 0, `oras tag ${artifact.reference} failed: ${(result.stderr || result.stdout).trim().slice(0, 600)}`);
}

export async function signDigest(artifact) {
  const result = await runAsync("cosign", ["sign", "--yes", artifact.immutableReference]);
  check(result.status === 0, `cosign sign ${artifact.immutableReference} failed: ${(result.stderr || result.stdout).trim().slice(0, 600)}`);
}

// cosign verify against the workflow identity. Returns the result word the
// receipt records.
export async function verifySignature(artifact, { anonymous }) {
  const result = await runAsync("cosign", [
    "verify",
    "--certificate-identity-regexp", CATALOG_OCI_IDENTITY_REGEXP,
    "--certificate-oidc-issuer", CATALOG_OCI_OIDC_ISSUER,
    "--output", "json",
    artifact.immutableReference,
  ], { env: { ...anonymous.env, HOME: process.env.HOME } });
  return result.status === 0 ? { result: "verified" } : { result: "not-verified", message: (result.stderr || result.stdout).trim().slice(0, 300) };
}

// The fix a reader needs when GHCR refuses an anonymous read of a package the
// workflow just published: GHCR creates a new package private.
export function makePublicFix(artifact) {
  if (!artifact.repository.startsWith("ghcr.io/")) return `make ${artifact.repository} readable without credentials`;
  const [, owner, ...rest] = artifact.repository.split("/");
  const packageName = encodeURIComponent(rest.join("/"));
  return `make the package public: https://github.com/orgs/${owner}/packages/container/${packageName}/settings, Danger Zone, Change visibility, Public. GHCR creates a package private when it is first pushed`;
}

export { digestOf as catalogOciDigestOf, serializeYaml as catalogOciYaml, stripOci };
export function cleanDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}
