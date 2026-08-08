#!/usr/bin/env node
// Publishes a catalog bundle as a certified bundle: one OCI artifact carrying
// the three classes the model promises travel together, the rendered
// configuration, the routes that say how to apply it, and the space guide.
//
// This is the render-early product. The installer package stays the render-late
// route and is published separately; a chart can have both, and a chart whose
// verdict says do-not-flatten gets only the installer package. Publishing a
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
// Needs the network and a registry credential, so this runs deliberately and
// its output is committed. Usage:
//   node scripts/publish-certified-bundles.mjs --receipt <path> [--dry-run]

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
check(receiptArg, "usage: node scripts/publish-certified-bundles.mjs --receipt <path> [--dry-run]");

const REGISTRY =
  process.env.HELM_EXPT_BUNDLE_OCI_REGISTRY ||
  "europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles";
const ARTIFACT_TYPE = "application/vnd.confighub.config.bundle.v1";
const EPOCH = new Date(0);

const receiptPath = join(repoRoot, receiptArg);
const receipt = readYaml(receiptPath);
const spec = receipt.spec;
const name = receipt.metadata.name;

check(
  spec.verdict.lane !== "do-not-flatten",
  `${name} is do-not-flatten, so it must not be published as a flattened bundle. Its certified route is the installer package.`,
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

for (const file of spec.bundle.files) {
  const source = join(repoRoot, file.path);
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

const { stdout: manifestText } = await run("oras", ["manifest", "fetch", reference], {
  timeout: 120000,
  maxBuffer: 8 * 1024 * 1024,
});
const manifest = JSON.parse(manifestText);
check(manifest.artifactType === ARTIFACT_TYPE, `published artifact type is ${manifest.artifactType}`);
check(
  manifest.layers[0].digest === `sha256:${layerSha}`,
  "the registry reports a different layer digest than the bundle that was pushed",
);

const record = {
  apiVersion: "evidence.confighub.com/v1alpha1",
  kind: "CertifiedBundlePublicationReceipt",
  metadata: { name },
  spec: {
    receipt: receiptArg,
    reference,
    artifactType: ARTIFACT_TYPE,
    manifestDigest: `sha256:${sha256(manifestText)}`,
    layerDigest: manifest.layers[0].digest,
    layerBytes: manifest.layers[0].size,
    reproducible: true,
    stagedFiles: staged,
    command: `oras push ${reference} --artifact-type ${ARTIFACT_TYPE} <tmp>/${artifactName}`,
  },
};
const recordRel = `runs/certified-bundles/${bundleName}/publication-receipt.yaml`;
write(join(repoRoot, recordRel), `${toYaml(record)}\n`);
rmSync(work, { recursive: true, force: true });
console.log(`  published, recorded at ${recordRel}`);
