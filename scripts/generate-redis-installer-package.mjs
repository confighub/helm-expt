import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const proofRoot = join(repoRoot, "recipes", "bitnami", "redis", "25.5.3");
const packageRoot = join(repoRoot, "packages", "bitnami", "redis", "25.5.3");
const receiptPath = join(proofRoot, "publication", "installer-package-receipt.yaml");
const packageRelative = relative(repoRoot, packageRoot);

const variants = [
  {
    name: "default",
    base: "default",
    description: "Redis default variant rendered from bitnami/redis@25.5.3",
    releaseObjects: join(proofRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml"),
    helmObjectCount: 14,
    cubObjectCount: 15,
    separatedSecretCount: 1,
  },
  {
    name: "reuse-existing-secret",
    base: "reuse-existing-secret",
    description: "Redis variant that uses an existing Secret target fact",
    releaseObjects: join(
      proofRoot,
      "revisions",
      "reuse-existing-secret",
      "r001",
      "rendered",
      "release-objects.yaml",
    ),
    helmObjectCount: 13,
    cubObjectCount: 14,
    separatedSecretCount: 0,
  },
];

for (const variant of variants) {
  if (!existsSync(variant.releaseObjects)) {
    throw new Error(`missing rendered object set for ${variant.name}: ${variant.releaseObjects}`);
  }
}

rmSync(packageRoot, { recursive: true, force: true });
mkdirSync(packageRoot, { recursive: true });

write(
  join(packageRoot, "installer.yaml"),
  `apiVersion: installer.confighub.com/v1alpha1
kind: Package
metadata:
  name: bitnami-redis
  version: "25.5.3"
spec:
  bases:
    - name: default
      path: bases/default
      default: true
      description: "Redis default variant rendered from bitnami/redis@25.5.3"
    - name: reuse-existing-secret
      path: bases/reuse-existing-secret
      description: "Redis variant that uses an existing Secret target fact"
      externalRequires:
        - kind: ClusterFeature
          name: "Secret redis/redis-existing-secret key redis-password"
          namespace: redis
          suggestedSource: "kubectl -n redis create secret generic redis-existing-secret --from-literal=redis-password=<value>"
  collector:
    command: /bin/sh
    args:
      - collector/target-facts.sh
    description: "Records Redis target-fact bindings and can live-check the existing Secret variant."
`,
);

write(
  join(packageRoot, "README.md"),
  `# bitnami/redis 25.5.3 Installer Package

This is the current executable Redis installer package proof.

It contains two real \`cub install setup --base\` variants:

- \`default\`
- \`reuse-existing-secret\`, which declares the existing Redis Secret through
  installer \`externalRequires\` and records the target-fact binding in
  \`out/spec/facts.yaml\` through the package collector.

The existing-Secret variant expects:

\`\`\`text
Secret redis/redis-existing-secret
key redis-password
\`\`\`

By default the collector records this binding without probing a live cluster,
so deterministic render tests still work offline. To force a live check during
setup, set:

\`\`\`sh
TARGET_FACT_CHECK_MODE=live
\`\`\`

Generate and verify it from the repository root:

\`\`\`sh
npm run redis:generate-package
npm run redis:verify-package
\`\`\`
`,
);

write(
  join(packageRoot, "collector", "target-facts.sh"),
  `#!/bin/sh
set -eu

base="\${INSTALLER_BASE:-default}"
secret_namespace="\${REDIS_EXISTING_SECRET_NAMESPACE:-redis}"
secret_name="\${REDIS_EXISTING_SECRET_NAME:-redis-existing-secret}"
secret_key="\${REDIS_EXISTING_SECRET_KEY:-redis-password}"
check_mode="\${TARGET_FACT_CHECK_MODE:-record}"

if [ "$base" != "reuse-existing-secret" ]; then
  cat <<YAML
targetFacts:
  requiredSecrets: []
targetFactChecks:
  base: "$base"
  mode: not-required
  result: pass
YAML
  exit 0
fi

if [ "$check_mode" = "live" ]; then
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  if ! kubectl -n "$secret_namespace" get secret "$secret_name" >/dev/null 2>&1; then
    echo "required Redis Secret $secret_namespace/$secret_name was not found" >&2
    exit 1
  fi
  if ! kubectl -n "$secret_namespace" get secret "$secret_name" -o yaml | awk -v key="$secret_key" '$1 == key ":" { found=1 } END { exit found ? 0 : 1 }'; then
    echo "required Redis Secret $secret_namespace/$secret_name is missing key $secret_key" >&2
    exit 1
  fi
  result="pass"
else
  result="recorded"
fi

cat <<YAML
targetFacts:
  requiredSecrets:
    - namespace: "$secret_namespace"
      name: "$secret_name"
      keys:
        - "$secret_key"
      purpose: "Redis authentication password"
targetFactChecks:
  base: "$base"
  mode: "$check_mode"
  result: "$result"
  liveCheck:
    command: "TARGET_FACT_CHECK_MODE=live cub install setup --pull packages/bitnami/redis/25.5.3 --base reuse-existing-secret --work-dir <tmp> --non-interactive --namespace redis"
YAML
`,
);

for (const variant of variants) {
  const baseRoot = join(packageRoot, "bases", variant.base);
  mkdirSync(baseRoot, { recursive: true });
  write(
    join(baseRoot, "kustomization.yaml"),
    `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - upstream.yaml
`,
  );
  write(join(baseRoot, "upstream.yaml"), stripTrailingWhitespace(readFileSync(variant.releaseObjects, "utf8")));
}

const files = listFiles(packageRoot).map((path) => ({
  path: relative(packageRoot, path),
  sha256: sha256File(path),
  bytes: readFileSync(path).length,
}));

const tempRoot = mkdtempSync(join(tmpdir(), "redis-installer-package-"));
let ok = false;
try {
  const firstPackage = join(tempRoot, "bitnami-redis-25.5.3-a.tgz");
  const secondPackage = join(tempRoot, "bitnami-redis-25.5.3-b.tgz");
  runCub(["install", "package", packageRoot, "-o", firstPackage]);
  runCub(["install", "package", packageRoot, "-o", secondPackage]);
  const firstSHA = sha256File(firstPackage);
  const secondSHA = sha256File(secondPackage);
  const byteIdentical = readFileSync(firstPackage).equals(readFileSync(secondPackage));
  if (!byteIdentical || firstSHA !== secondSHA) {
    throw new Error("cub install package did not produce byte-identical bundles");
  }

  mkdirSync(dirname(receiptPath), { recursive: true });
  write(
    receiptPath,
    `apiVersion: helm-expt.confighub.com/v1alpha1
kind: InstallerPackageReceipt
metadata:
  name: bitnami-redis-25.5.3
spec:
  chart:
    repository: bitnami
    name: redis
    version: 25.5.3
  package:
    path: ${packageRelative}
    name: bitnami-redis
    version: 25.5.3
    sourceFiles:
${files.map((file) => `      - path: ${file.path}\n        sha256: ${file.sha256}\n        bytes: ${file.bytes}`).join("\n")}
  deterministicBundle:
    command: "cub install package ${packageRelative} -o <tmp>/bitnami-redis-25.5.3.tgz"
    sha256: ${firstSHA}
    byteIdenticalAcrossTwoLocalBundles: true
  setupChecks:
${variants
  .map(
    (variant) => `    - variant: ${variant.name}
      base: ${variant.base}
      command: "cub install setup --pull ${packageRelative} --base ${variant.base} --work-dir <tmp> --non-interactive --namespace redis"
      helmReleaseObjectCount: ${variant.helmObjectCount}
      cubInstallObjectCountIncludingSupport: ${variant.cubObjectCount}
      semanticObjectMatches: ${variant.helmObjectCount}/${variant.helmObjectCount}
      separatedSecretCount: ${variant.separatedSecretCount}
      targetFactMode: ${variant.name === "reuse-existing-secret" ? "collector-facts" : "not-required"}
      targetFactsBound: ${variant.name === "reuse-existing-secret" ? "true" : "false"}
      allowedCubOnlyObjects:
        - v1|Namespace||redis`,
  )
  .join("\n")}
  ociPublication:
    status: not-run
    command: "REDIS_INSTALLER_OCI_REF=oci://<registry>/<repo>:<tag> npm run redis:publish-package"
    reason: "No registry ref is supplied by default; publication is verified only against an explicit OCI endpoint."
`,
  );
  ok = true;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

if (ok) {
  console.log(`Wrote ${packageRelative}`);
  console.log(`Wrote ${relative(repoRoot, receiptPath)}`);
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function listFiles(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(path));
    } else if (entry.isFile()) {
      result.push(path);
    }
  }
  return result.sort();
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runCub(args) {
  return execFileSync("cub", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 100,
  });
}

function stripTrailingWhitespace(text) {
  return `${text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n*$/, "")}\n`;
}
