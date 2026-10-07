#!/usr/bin/env node

// Publishes and signs exactly the NVIDIA GPU stack packages listed in
// scripts/lib/nvidia-gpu-stack-coverage.mjs, one at a time. This wrapper exists
// so the maintainer never relies on the unscoped all-catalog publisher, and so a
// package built with the wrong installer cannot be published.
//
//   node scripts/publish-nvidia-gpu-stack.mjs --dry-run     (the default)
//   node scripts/publish-nvidia-gpu-stack.mjs --publish
//   node scripts/publish-nvidia-gpu-stack.mjs --sign
//   node scripts/publish-nvidia-gpu-stack.mjs --verify
//   node scripts/publish-nvidia-gpu-stack.mjs --self-test
//
// --dry-run prints each package path, its destination reference, the committed
// deterministic digest, and whether a publication receipt and a signature
// receipt exist. It contacts no registry and changes nothing.
//
// --publish needs registry credentials with package write permission. For each
// package without a publication receipt it packages locally and refuses unless
// the archive digest equals the digest committed in the recipe's
// installer-package-receipt.yaml, then pushes through
// scripts/publish-installer-oci-packages.mjs --package <path> --idempotent, then
// inspects the reference with no credentials and checks the published layer is
// that same digest. Every package is checked against its committed digest
// before the first push, so a wrong installer stops the run before anything is
// written. Run it through scripts/run-with-pinned-installer.mjs.
//
// --sign runs scripts/sign-installer-oci-packages.mjs --sign --package <path>
// for each package. It needs HELM_EXPT_ALLOW_REGISTRY_SIGNING=1 and permission
// to impersonate the dedicated package signer; see
// docs/reference/installer-package-signing.md.
//
// --verify re-checks every publication receipt against the committed digest and
// an anonymous inspect. --self-test exercises the refusals with stand-ins and
// contacts no registry.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { cubEnv, readYaml, repoRoot, sha256File } from "./lib/proof-common.mjs";
import { installerOciRefForPackagePath } from "./lib/installer-oci.mjs";
import { signaturePathsForPublication } from "./lib/installer-package-signatures.mjs";
import { NVIDIA_GPU_STACK_ADDITIONS } from "./lib/nvidia-gpu-stack-coverage.mjs";

const PINNED = "node scripts/run-with-pinned-installer.mjs --";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

export function scope(additions = NVIDIA_GPU_STACK_ADDITIONS) {
  const rows = additions.map((item) => ({
    name: `${item.canonicalIdentity}@${item.version}`,
    packagePath: item.packagePath,
    recipePath: item.recipePath,
    ref: installerOciRefForPackagePath(item.packagePath),
  }));
  check(rows.length > 0, "the NVIDIA GPU stack scope is empty");
  check(new Set(rows.map((row) => row.packagePath)).size === rows.length, "the NVIDIA GPU stack scope lists a package twice");
  check(new Set(rows.map((row) => row.ref)).size === rows.length, "the NVIDIA GPU stack scope maps two packages to one reference");
  for (const row of rows) {
    check(/^packages\/nvidia\/[a-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(row.packagePath), `${row.packagePath} is not an exact NVIDIA package path`);
  }
  return rows;
}

export function publicationReceiptPath(row) {
  const [slug, tag = "latest"] = (row.ref.replace(/^oci:\/\//, "").split("/").at(-1) ?? "").split(":");
  return join(repoRoot, "runs", "installer-oci", slug, tag, "installer-package-publication-receipt.yaml");
}

// The digest the branch committed for this package, written by --generate-package.
export function committedDigest(row, read = readYaml) {
  const path = join(repoRoot, row.recipePath, "publication", "installer-package-receipt.yaml");
  const receipt = read(path);
  const digest = receipt?.spec?.deterministicBundle?.sha256 ?? "";
  check(receipt?.spec?.package?.path === row.packagePath, `${row.recipePath}: the committed package receipt names a different package`);
  check(/^[0-9a-f]{64}$/.test(digest), `${row.recipePath}: the committed package receipt records no deterministic digest`);
  return digest;
}

function packageLocally(row) {
  const tempRoot = mkdtempSync(join(tmpdir(), "nvidia-gpu-stack-publish-"));
  try {
    const archive = join(tempRoot, `${basename(row.packagePath)}.tgz`);
    execFileSync("cub", ["installer", "package", join(repoRoot, row.packagePath), "-o", archive], {
      cwd: repoRoot,
      env: cubEnv(),
      stdio: ["ignore", "ignore", "inherit"],
      maxBuffer: 1024 * 1024 * 200,
    });
    return sha256File(archive);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

// Refuses unless the installer on PATH packages this directory into the committed bytes.
export function preflight(row, { digestOf = packageLocally, committed = committedDigest } = {}) {
  const expected = committed(row);
  const actual = digestOf(row);
  check(
    actual === expected,
    `${row.packagePath}: the installer on PATH packages sha256:${actual}, but the committed digest is sha256:${expected}. Nothing was pushed. Run this command through ${PINNED} so the installer is the build CI pins.`,
  );
  return expected;
}

// Reads the published reference with no registry credentials at all.
function anonymousInspect(row) {
  const tempRoot = mkdtempSync(join(tmpdir(), "nvidia-gpu-stack-anonymous-"));
  try {
    const result = spawnSync("cub", ["installer", "inspect", row.ref, "--json"], {
      cwd: repoRoot,
      env: { ...cubEnv(), DOCKER_CONFIG: tempRoot, REGISTRY_AUTH_FILE: join(tempRoot, "auth.json") },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 200,
    });
    check(result.status === 0, `${row.ref}: anonymous inspect failed\n${`${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim()}`);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

// After a push: the receipt, the committed digest and what an anonymous reader sees must agree.
export function verifyPublished(row, { inspect = anonymousInspect, committed = committedDigest, read = readYaml, exists = existsSync } = {}) {
  const path = publicationReceiptPath(row);
  check(exists(path), `${row.packagePath}: no publication receipt at ${path.slice(repoRoot.length + 1)}`);
  const receipt = read(path);
  const expected = committed(row);
  check(receipt.kind === "InstallerPackagePublicationReceipt", `${row.packagePath}: publication receipt kind changed`);
  check(receipt.spec?.package?.path === row.packagePath, `${row.packagePath}: publication receipt names a different package`);
  check(receipt.spec?.ref === row.ref, `${row.packagePath}: publication receipt names a different reference`);
  check(receipt.spec?.package?.sha256 === expected, `${row.packagePath}: the published archive is not the committed digest sha256:${expected}`);
  const inspected = inspect(row);
  const manifestDigest = inspected.ManifestDigest ?? inspected.manifestDigest ?? "";
  const layerDigest = inspected.Config?.bundle?.layerDigest ?? inspected.config?.bundle?.layerDigest ?? "";
  check(layerDigest === `sha256:${expected}`, `${row.ref}: an anonymous reader sees layer ${layerDigest || "(none)"}, not the committed digest sha256:${expected}`);
  check(
    /^sha256:[0-9a-f]{64}$/.test(manifestDigest) && manifestDigest === receipt.spec?.outputs?.manifestDigest,
    `${row.ref}: an anonymous reader sees manifest ${manifestDigest || "(none)"}, not the one the publication receipt records`,
  );
  return { manifestDigest, layerDigest };
}

function runNode(args, env = process.env) {
  execFileSync(process.execPath, args, { cwd: repoRoot, env, stdio: "inherit", maxBuffer: 1024 * 1024 * 200 });
}

function dryRun(rows) {
  for (const row of rows) {
    const receipt = publicationReceiptPath(row);
    const signature = signaturePathsForPublication(receipt).receiptPath;
    console.log(
      [
        row.packagePath,
        row.ref,
        `sha256:${committedDigest(row)}`,
        `publication receipt ${existsSync(receipt) ? "present" : "missing"}`,
        `signature receipt ${existsSync(signature) ? "present" : "missing"}`,
      ].join("\t"),
    );
  }
  console.log(`${rows.length} package(s) in scope; dry run complete, and no package, registry, receipt or catalog state changed`);
}

function publish(rows) {
  // Every package is checked before the first push.
  const pending = rows.filter((row) => !existsSync(publicationReceiptPath(row)));
  for (const row of pending) preflight(row);
  for (const row of rows) {
    if (!pending.includes(row)) {
      verifyPublished(row);
      console.log(`already published and receipt-verified ${row.packagePath}`);
      continue;
    }
    preflight(row);
    runNode(["scripts/publish-installer-oci-packages.mjs", "--package", row.packagePath, "--idempotent"]);
    const { manifestDigest } = verifyPublished(row);
    console.log(`published and anonymously verified ${row.packagePath} -> ${row.ref}@${manifestDigest}`);
  }
  console.log(`published ${pending.length} package(s); ${rows.length - pending.length} already had a receipt`);
}

function sign(rows) {
  check(
    process.env.HELM_EXPT_ALLOW_REGISTRY_SIGNING === "1",
    "set HELM_EXPT_ALLOW_REGISTRY_SIGNING=1 to confirm registry signature writes",
  );
  for (const row of rows) {
    check(existsSync(publicationReceiptPath(row)), `${row.packagePath}: publish it before signing; no publication receipt exists`);
  }
  for (const row of rows) {
    const signature = signaturePathsForPublication(publicationReceiptPath(row)).receiptPath;
    if (existsSync(signature)) {
      console.log(`already signed ${row.packagePath}`);
      continue;
    }
    runNode(["scripts/sign-installer-oci-packages.mjs", "--sign", "--package", row.packagePath]);
    check(existsSync(signature), `${row.packagePath}: signing wrote no signature receipt`);
    console.log(`signed ${row.packagePath}`);
  }
}

function selfTest() {
  const refuses = (fn, pattern, message) => {
    try {
      fn();
    } catch (error) {
      check(pattern.test(error.message), `self-test failed: ${message}: unexpected error ${error.message}`);
      return;
    }
    throw new Error(`self-test failed: ${message}: nothing was refused`);
  };
  const rows = scope();
  check(rows.every((row) => row.packagePath.startsWith("packages/nvidia/")), "self-test failed: the scope left packages/nvidia");
  check(rows.every((row) => existsSync(join(repoRoot, row.packagePath, "installer.yaml"))), "self-test failed: a scoped package has no installer.yaml");
  for (const row of rows) committedDigest(row);
  const duplicate = NVIDIA_GPU_STACK_ADDITIONS[0];
  refuses(() => scope([duplicate, duplicate]), /lists a package twice/, "a package listed twice");
  refuses(() => scope([{ ...duplicate, packagePath: "packages/other/chart/1.0.0" }]), /not an exact NVIDIA package path/, "a package outside packages/nvidia");

  const row = rows[0];
  const good = "a".repeat(64);
  const other = "b".repeat(64);
  const committed = () => good;
  check(preflight(row, { digestOf: () => good, committed }) === good, "self-test failed: a matching local package is accepted");
  refuses(() => preflight(row, { digestOf: () => other, committed }), /Nothing was pushed/, "a local package that differs from the committed digest");
  refuses(
    () => committedDigest(row, () => ({ spec: { package: { path: row.packagePath }, deterministicBundle: {} } })),
    /records no deterministic digest/,
    "a recipe with no committed digest",
  );

  const manifest = `sha256:${"c".repeat(64)}`;
  const receipt = {
    kind: "InstallerPackagePublicationReceipt",
    spec: { package: { path: row.packagePath, sha256: good }, ref: row.ref, outputs: { manifestDigest: manifest } },
  };
  const inspected = (layer, manifestDigest = manifest) => () => ({ ManifestDigest: manifestDigest, Config: { bundle: { layerDigest: layer } } });
  const base = { committed, read: () => receipt, exists: () => true };
  check(verifyPublished(row, { ...base, inspect: inspected(`sha256:${good}`) }).manifestDigest === manifest, "self-test failed: a matching publication is accepted");
  refuses(() => verifyPublished(row, { ...base, inspect: inspected(`sha256:${other}`) }), /an anonymous reader sees layer/, "a published layer that is not the committed digest");
  refuses(
    () => verifyPublished(row, { ...base, inspect: inspected(`sha256:${good}`, `sha256:${"d".repeat(64)}`) }),
    /not the one the publication receipt records/,
    "a manifest the receipt does not record",
  );
  refuses(
    () => verifyPublished(row, { ...base, read: () => ({ ...receipt, spec: { ...receipt.spec, package: { path: row.packagePath, sha256: other } } }), inspect: inspected(`sha256:${good}`) }),
    /is not the committed digest/,
    "a receipt for different bytes",
  );
  refuses(() => verifyPublished(row, { ...base, exists: () => false, inspect: inspected(`sha256:${good}`) }), /no publication receipt/, "a missing publication receipt");
  refuses(
    () => verifyPublished(row, { ...base, read: () => ({ ...receipt, spec: { ...receipt.spec, ref: `${row.ref}-other` } }), inspect: inspected(`sha256:${good}`) }),
    /names a different reference/,
    "a receipt for another reference",
  );
  console.log(`publish-nvidia-gpu-stack self-test passed for ${rows.length} scoped package(s); no registry was contacted`);
}

const isMain = process.argv[1] && process.argv[1].endsWith("publish-nvidia-gpu-stack.mjs");
if (isMain) {
  const mode = process.argv[2] ?? "--dry-run";
  try {
    if (mode === "--self-test") selfTest();
    else if (mode === "--dry-run") dryRun(scope());
    else if (mode === "--publish") publish(scope());
    else if (mode === "--sign") sign(scope());
    else if (mode === "--verify") {
      const rows = scope();
      for (const row of rows) {
        preflight(row);
        verifyPublished(row);
      }
      console.log(`verified ${rows.length} NVIDIA GPU stack publication(s) against the committed digests and an anonymous inspect`);
    } else {
      console.error(`Usage:
  node scripts/publish-nvidia-gpu-stack.mjs --dry-run
  node scripts/publish-nvidia-gpu-stack.mjs --publish
  node scripts/publish-nvidia-gpu-stack.mjs --sign
  node scripts/publish-nvidia-gpu-stack.mjs --verify
  node scripts/publish-nvidia-gpu-stack.mjs --self-test`);
      process.exit(2);
    }
  } catch (error) {
    console.error(`publish-nvidia-gpu-stack: ${error.message}`);
    process.exit(1);
  }
}
