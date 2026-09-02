#!/usr/bin/env node
// Publishes a catalog bundle as a certified bundle: one OCI artifact carrying
// the three classes the model promises travel together, the rendered
// configuration, the routes that say how to apply it, and the space guide.
//
// This is the render-early product. The installer package stays the render-late
// route and is published separately; a chart can have both, and a chart whose
// verdict says unsafe-to-flatten gets only the installer package. Publishing a
// flattened bundle for such a chart would contradict its own verdict, so this
// refuses to.
//
// The tarball is byte-reproducible: entries sorted, ownership zeroed, mtimes at
// the epoch, and gzip without its filename and timestamp fields. Reproducibility
// is checked by building twice and comparing, because a bundle whose digest
// moves without its content moving makes every digest that cites it meaningless.
//
// The receipt records what was published rather than what could be rebuilt, so
// verification pulls the artifact instead of re-tarring it. Tar implementations
// differ across platforms, and the published bytes are the fact.
//
// Every receipt records the moment the registry was read, so its evidence ages
// like the rest of this repository's rather than sitting outside the count.
// Publishing takes that moment from the manifest fetch that follows the push.
// A receipt already committed can record one without republishing: --reobserve
// reads each published manifest again and refuses if the registry no longer
// reports the digests the receipt claims. That path only reads, so it needs no
// credential, and it stamps only what it checked.
//
// Needs the network, and publishing needs a registry credential, so this runs
// deliberately and its output is committed. Usage:
//   node scripts/publish-certified-bundles.mjs --receipt <path> [--dry-run]
//   node scripts/publish-certified-bundles.mjs --reobserve

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";

import { check, listFiles, readYaml, repoRoot, sha256, sha256File, toYaml, write } from "./lib/proof-common.mjs";

const run = promisify(execFile);
const args = process.argv.slice(2);
const receiptArg = args.includes("--receipt") ? args[args.indexOf("--receipt") + 1] : null;
const dryRun = args.includes("--dry-run");
const reobserve = args.includes("--reobserve");
check(
  reobserve || receiptArg,
  "usage: node scripts/publish-certified-bundles.mjs --receipt <path> [--dry-run], or --reobserve",
);

const REGISTRY =
  process.env.HELM_EXPT_BUNDLE_OCI_REGISTRY ||
  "europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles";
const ARTIFACT_TYPE = "application/vnd.confighub.config.bundle.v1";
const EPOCH = new Date(0);

// Reading the manifest back is what turns a push into a fact. The digests a
// receipt carries come from what the registry serves, never from what this
// script built, so the receipt describes the artifact a consumer will pull.
async function fetchManifest(reference) {
  const { stdout } = await run("oras", ["manifest", "fetch", reference], {
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return { text: stdout, parsed: JSON.parse(stdout) };
}

// Both paths that write a receipt build it here, so a bundle that was just
// published and one that was read again cannot describe themselves differently.
function publicationRecord({ name, receipt, reference, manifest, observedAt, reproducible, stagedFiles, command }) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundlePublicationReceipt",
    metadata: { name },
    spec: {
      receipt,
      reference,
      artifactType: ARTIFACT_TYPE,
      manifestDigest: `sha256:${sha256(manifest.text)}`,
      layerDigest: manifest.parsed.layers[0].digest,
      layerBytes: manifest.parsed.layers[0].size,
      observedAt,
      reproducible,
      stagedFiles,
      command,
    },
  };
}

// Recording when a committed receipt was last confirmed, without republishing.
// Nothing is rebuilt and nothing is pushed: the manifest is read again and
// checked against what the receipt already claims. A registry reporting
// something else is a refusal rather than an update, because rewriting the
// digests here would quietly turn a record of what was published into a record
// of whatever happens to be there now.
async function reobserveCommittedReceipts() {
  const files = listFiles(join(repoRoot, "runs", "certified-bundles")).filter((path) =>
    path.endsWith("/publication-receipt.yaml"),
  );
  check(files.length > 0, "no committed publication receipt was found under runs/certified-bundles/");
  for (const path of files) {
    const rel = relative(repoRoot, path);
    const committed = readYaml(path);
    const spec = committed.spec;
    const manifest = await fetchManifest(spec.reference);
    const observedAt = new Date().toISOString();
    check(
      manifest.parsed.artifactType === ARTIFACT_TYPE,
      `${rel}: the registry reports artifact type ${manifest.parsed.artifactType}`,
    );
    const record = publicationRecord({
      name: committed.metadata.name,
      receipt: spec.receipt,
      reference: spec.reference,
      manifest,
      observedAt,
      reproducible: spec.reproducible,
      stagedFiles: spec.stagedFiles,
      command: spec.command,
    });
    for (const field of ["manifestDigest", "layerDigest", "layerBytes"]) {
      check(
        record.spec[field] === spec[field],
        `${rel}: the registry reports ${field} ${record.spec[field]}, and the receipt claims ${spec[field]}. Republish deliberately rather than restamping a receipt that no longer describes the artifact.`,
      );
    }
    write(path, `${toYaml(record)}\n`);
    console.log(`${rel}\n  ${spec.reference}\n  observed ${observedAt}, digests unchanged`);
  }
  console.log(`re-observed ${files.length} published bundle(s)`);
}

if (reobserve) {
  await reobserveCommittedReceipts();
  process.exit(0);
}

const receiptPath = join(repoRoot, receiptArg);
const receipt = readYaml(receiptPath);
const spec = receipt.spec;
const name = receipt.metadata.name;

check(
  spec.verdict.lane !== "unsafe-to-flatten",
  `${name} is unsafe-to-flatten, so it must not be published as a flattened bundle. Its certified route is the installer package.`,
);
check(
  spec.verdict.status === "certified",
  `${name} carries a ${spec.verdict.status} verdict. Publish only what an audit decided.`,
);

// Stage the three classes under the names a consumer will ingest, so the Unit
// per file is named for what it is rather than for where it sat in this repo.
const work = join(tmpdir(), `certified-bundle-${name}`);
rmSync(work, { recursive: true, force: true });
const stage = join(work, "stage");
mkdirSync(stage, { recursive: true });

// Catalog receipts list repository paths. AICR receipts list paths relative to
// the entry directory the receipt names as its source, so resolve those there.
const sourcePath = (function findPath(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 2) return null;
  if (typeof node.path === "string") return node.path;
  for (const value of Object.values(node)) {
    const found = findPath(value, depth + 1);
    if (found) return found;
  }
  return null;
})(spec.source);
// The receipt may name the upstream subtree rather than the entry directory,
// so the entry directory derived from the receipt's own name is searched too.
const entryDir = join(repoRoot, "examples", "aicr", String(name).replace(/^aicr-/, ""));
const sourceDir = sourcePath && existsSync(join(repoRoot, sourcePath)) ? join(repoRoot, sourcePath) : existsSync(entryDir) ? entryDir : null;
// An AICR entry keeps its rendered Applications under argocd-rendered/templates
// and its retained upstream trees at the path the receipt names, so try the
// exact path first, then the entry directory, then a bounded search of it.
const entryFiles = [...(sourceDir && existsSync(sourceDir) ? listFiles(sourceDir) : []), ...(existsSync(entryDir) ? listFiles(entryDir) : [])];
function locateBundleFile(relPath) {
  const candidates = [join(repoRoot, relPath)];
  if (sourceDir) candidates.push(join(sourceDir, relPath), join(sourceDir, "argocd-rendered", "templates", relPath));
  if (existsSync(entryDir)) candidates.push(join(entryDir, relPath), join(entryDir, "argocd-rendered", "templates", relPath));
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found) return found;
  const matches = entryFiles.filter((candidate) => candidate.endsWith(`/${relPath}`));
  return matches.length === 1 ? matches[0] : join(repoRoot, relPath);
}
for (const file of spec.bundle.files) {
  const source = locateBundleFile(file.path);
  check(existsSync(source), `bundle file missing: ${file.path}`);
  check(sha256File(source) === file.sha256, `bundle file drifted from its receipt: ${file.path}`);
  const role = String(file.role ?? "");
  const target = role.startsWith("route:")
    ? join(stage, "routes", file.path.split("/").pop())
    : role === "space-guide"
      ? join(stage, "README.md")
      : join(stage, file.path.split("/").pop());
  mkdirSync(dirname(target), { recursive: true });
  write(target, readFileSync(source));
}

async function buildTarball(destination) {
  const files = listFiles(stage)
    .map((path) => relative(stage, path))
    .sort();
  for (const rel of files) utimesSync(join(stage, rel), EPOCH, EPOCH);
  await run("sh", [
    "-c",
    `cd ${JSON.stringify(stage)} && tar --uid 0 --gid 0 --numeric-owner --format ustar -cf - ${files
      .map((file) => JSON.stringify(`./${file}`))
      .join(" ")} | gzip -n > ${JSON.stringify(destination)}`,
  ]);
  return files;
}

const tarballA = join(work, `${name}-a.tar.gz`);
const tarballB = join(work, `${name}-b.tar.gz`);
const staged = await buildTarball(tarballA);
await buildTarball(tarballB);
check(
  sha256File(tarballA) === sha256File(tarballB),
  "the bundle is not byte-reproducible; a digest that moves without its content moving makes every citation of it meaningless",
);

const layerSha = sha256File(tarballA);
const bundleName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const reference = `${REGISTRY}/${bundleName}:latest`;

console.log(`${receiptArg}`);
console.log(`  staged ${staged.length} file(s): ${staged.join(", ")}`);
console.log(`  layer sha256:${layerSha}`);
console.log(`  -> ${reference}`);
if (dryRun) process.exit(0);

const pushDir = join(work, "push");
mkdirSync(pushDir, { recursive: true });
const artifactName = `${bundleName}.tar.gz`;
write(join(pushDir, artifactName), readFileSync(tarballA));
await run(
  "oras",
  [
    "push",
    reference,
    "--artifact-type",
    ARTIFACT_TYPE,
    "--annotation",
    "org.opencontainers.image.created=1970-01-01T00:00:00Z",
    `${artifactName}:application/vnd.oci.image.layer.v1.tar+gzip`,
  ],
  { cwd: pushDir, timeout: 300000 },
);

const manifest = await fetchManifest(reference);
const observedAt = new Date().toISOString();
check(
  manifest.parsed.artifactType === ARTIFACT_TYPE,
  `published artifact type is ${manifest.parsed.artifactType}`,
);
check(
  manifest.parsed.layers[0].digest === `sha256:${layerSha}`,
  "the registry reports a different layer digest than the bundle that was pushed",
);

const record = publicationRecord({
  name,
  receipt: receiptArg,
  reference,
  manifest,
  observedAt,
  reproducible: true,
  stagedFiles: staged,
  command: `oras push ${reference} --artifact-type ${ARTIFACT_TYPE} <tmp>/${artifactName}`,
});
const recordRel = `runs/certified-bundles/${bundleName}/publication-receipt.yaml`;
write(join(repoRoot, recordRel), `${toYaml(record)}\n`);
rmSync(work, { recursive: true, force: true });
console.log(`  published, recorded at ${recordRel}`);
