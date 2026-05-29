import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const packageRoot = join(repoRoot, "packages", "bitnami", "redis", "25.5.3");
const receiptPath = join(repoRoot, "runs", "redis-oci", "latest", "redis-installer-package-publication-receipt.yaml");
const ociRef = process.env.REDIS_INSTALLER_OCI_REF;

if (!ociRef) {
  throw new Error("REDIS_INSTALLER_OCI_REF is required, for example oci://<registry>/<repo>:<tag>");
}

const tempRoot = mkdtempSync(join(tmpdir(), "redis-installer-package-publish-"));
let ok = false;
try {
  execFileSync("node", ["scripts/verify-redis-installer-package.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
  });

  const packageFile = join(tempRoot, "bitnami-redis-25.5.3.tgz");
  const packageOutput = execFileSync("cub", ["installer", "package", packageRoot, "-o", packageFile], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    maxBuffer: 1024 * 1024 * 100,
  });
  const packageSHA = sha256File(packageFile);
  const pushOutput = execFileSync("cub", ["installer", "push", packageFile, ociRef], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    maxBuffer: 1024 * 1024 * 100,
  });
  const inspectOutput = execFileSync("cub", ["installer", "inspect", ociRef, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    maxBuffer: 1024 * 1024 * 100,
  });

  write(
    receiptPath,
    `apiVersion: helm-expt.confighub.com/v1alpha1
kind: InstallerPackagePublicationReceipt
metadata:
  name: bitnami-redis-25.5.3
spec:
  ref: ${ociRef}
  package:
    path: ${relative(repoRoot, packageRoot)}
    sha256: ${packageSHA}
  commands:
    package: "cub installer package ${relative(repoRoot, packageRoot)} -o <tmp>/bitnami-redis-25.5.3.tgz"
    push: "cub installer push <tmp>/bitnami-redis-25.5.3.tgz ${ociRef}"
    inspect: "cub installer inspect ${ociRef} --json"
  outputs:
    package: |
${indentBlock(packageOutput.trimEnd(), 6)}
    push: |
${indentBlock(pushOutput.trimEnd(), 6)}
    inspectJSONSHA256: ${sha256(inspectOutput)}
`,
  );
  ok = true;
  console.log(`Wrote ${relative(repoRoot, receiptPath)}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

if (!ok) {
  process.exitCode = 1;
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function indentBlock(text, spaces) {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
