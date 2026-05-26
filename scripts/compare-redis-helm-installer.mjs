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
import { join, resolve } from "node:path";

const repoRoot = process.cwd();
const redisPackage = resolve(repoRoot, "archive/render-and-vendor-top20/charts/06-bitnami-redis");
const proofRoot = resolve(repoRoot, "recipes/bitnami/redis/25.5.3");
const receiptFile = join(redisPackage, "helm-import.receipt.yaml");
const chartRef = "oci://registry-1.docker.io/bitnamicharts/redis";
const chartVersion = "25.5.3";
const releaseName = "redis";
const namespace = "redis";
const kubeVersion = "1.30.0";

const env = { ...process.env };
try {
  const goPath = execFileSync("go", ["env", "GOPATH"], { encoding: "utf8" }).trim();
  const goBin = join(goPath, "bin");
  if (!env.PATH?.split(":").includes(goBin)) {
    env.PATH = `${env.PATH ?? ""}:${goBin}`;
  }
} catch {
  // If Go is unavailable, let the later kustomize/cub command fail clearly.
}

const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-redis-compare-"));
let ok = false;

try {
  const receipt = readFileSync(receiptFile, "utf8");
  const expectedDefaultHelmSHA = receipt.match(/upstreamYAMLSHA256:\s+"([^"]+)"/)?.[1];
  if (!expectedDefaultHelmSHA) {
    throw new Error(`Could not read upstreamYAMLSHA256 from ${receiptFile}`);
  }

  const variants = [
    {
      name: "default",
      valuesText: readFileSync(join(redisPackage, "values.yaml"), "utf8"),
      expectedYamlPath: join(redisPackage, "base", "upstream.yaml"),
      expectedHelmSHA: expectedDefaultHelmSHA,
      packageDir: redisPackage,
      normalizeWhitespace: false,
    },
    {
      name: "reuse-existing-secret",
      valuesText: "auth:\n  existingSecret: redis-existing-secret\n  existingSecretPasswordKey: redis-password\n",
      expectedYamlPath: join(
        proofRoot,
        "revisions",
        "reuse-existing-secret",
        "r001",
        "rendered",
        "release-objects.yaml",
      ),
      packageDir: null,
      normalizeWhitespace: true,
    },
  ];

  for (const variant of variants) {
    compareVariant(variant);
  }

  ok = true;
} finally {
  if (ok) {
    rmSync(tempRoot, { recursive: true, force: true });
  } else {
    console.error(`Left comparison workspace for inspection: ${tempRoot}`);
  }
}

function compareVariant(variant) {
  console.log(`\nComparing Redis variant: ${variant.name}`);
  console.log("Rendering Redis with Helm using the captured variant inputs...");
  const helmYaml = variant.normalizeWhitespace ? stripTrailingWhitespace(renderHelm(variant.valuesText)) : renderHelm(variant.valuesText);
  const helmSHA = sha256(helmYaml);
  const expectedYaml = variant.normalizeWhitespace
    ? stripTrailingWhitespace(readFileSync(variant.expectedYamlPath, "utf8"))
    : readFileSync(variant.expectedYamlPath, "utf8");
  const expectedSHA = sha256(expectedYaml);

  if (variant.expectedHelmSHA) {
    assertEqual(helmSHA, variant.expectedHelmSHA, `${variant.name} fresh Helm render must match receipt SHA`);
  }
  assertEqual(helmSHA, expectedSHA, `${variant.name} fresh Helm render must match stored release-objects.yaml`);
  assertEqual(helmYaml, expectedYaml, `${variant.name} fresh Helm render must byte-match stored release objects`);

  const packageDir = variant.packageDir ?? writeInstallerPackage(variant.name, expectedYaml);
  const workDir = join(tempRoot, `installer-work-${variant.name}`);

  console.log("Rendering the same Redis package with cub install setup...");
  const setupOutput = execFileSync(
    "cub",
    [
      "install",
      "setup",
      "--pull",
      packageDir,
      "--work-dir",
      workDir,
      "--non-interactive",
      "--namespace",
      namespace,
    ],
    { encoding: "utf8", env, stdio: ["ignore", "pipe", "inherit"] },
  );
  process.stdout.write(setupOutput);

  const helmObjects = objectKeySetFromYaml(helmYaml);
  const cubObjectFiles = objectFilesFromDirs([join(workDir, "out/manifests"), join(workDir, "out/secrets")]);
  const cubYaml = cubObjectFiles.map((file) => file.yaml).join("\n---\n");
  const semantic = canonicalObjectMaps(helmYaml, cubYaml);
  const cubObjects = new Set(Object.keys(semantic.cub));

  const missingFromCub = difference(helmObjects, cubObjects);
  if (missingFromCub.length) {
    throw new Error(`cub install output is missing Helm object(s):\n${missingFromCub.join("\n")}`);
  }

  const extraInCub = difference(cubObjects, helmObjects);
  assertEqual(
    JSON.stringify(extraInCub),
    JSON.stringify(["v1|Namespace||redis"]),
    `${variant.name} cub install may add only the explicit namespace support object`,
  );

  const semanticDiffs = [];
  for (const key of helmObjects) {
    if (semantic.helm[key] !== semantic.cub[key]) semanticDiffs.push(key);
  }
  if (semanticDiffs.length) {
    throw new Error(`cub install output differs semantically from Helm object(s):\n${semanticDiffs.join("\n")}`);
  }

  const manifestFiles = listYamlFiles(join(workDir, "out/manifests"));
  const secretFiles = listYamlFiles(join(workDir, "out/secrets"));

  console.log("\nComparison passed.");
  console.log(`Variant: ${variant.name}`);
  console.log(`Helm render SHA256: ${helmSHA}`);
  console.log(`Helm objects: ${helmObjects.size}`);
  console.log(`cub install objects: ${cubObjects.size}`);
  console.log(`semantic object matches: ${helmObjects.size}/${helmObjects.size}`);
  console.log(`cub uploaded-manifest files: ${manifestFiles.length}`);
  console.log(`cub separated-secret files: ${secretFiles.length}`);
  console.log("Allowed cub-only object: v1|Namespace||redis");
}

function renderHelm(valuesText) {
  const variantRoot = mkdtempSync(join(tempRoot, "values-"));
  const valuesPath = join(variantRoot, "values.yaml");
  writeFileSync(valuesPath, valuesText);
  return execFileSync(
    "helm",
    [
      "template",
      releaseName,
      chartRef,
      "--version",
      chartVersion,
      "--namespace",
      namespace,
      "--values",
      valuesPath,
      "--kube-version",
      kubeVersion,
      "--include-crds",
      "--skip-tests",
      "--no-hooks",
    ],
    { encoding: "utf8", env, stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1024 * 1024 * 100 },
  );
}

function writeInstallerPackage(variantName, upstreamYaml) {
  const packageRoot = join(tempRoot, `installer-package-${variantName}`);
  mkdirSync(join(packageRoot, "base"), { recursive: true });
  writeFileSync(
    join(packageRoot, "installer.yaml"),
    `apiVersion: installer.confighub.com/v1alpha1
kind: Package
metadata:
  name: "redis-${variantName}"
  version: "25.5.3"
spec:
  bases:
    - name: default
      path: base
      default: true
      description: "Imported Helm render for bitnami/redis ${variantName}"
`,
  );
  writeFileSync(
    join(packageRoot, "base", "kustomization.yaml"),
    `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - upstream.yaml
`,
  );
  writeFileSync(join(packageRoot, "base", "upstream.yaml"), upstreamYaml);
  return packageRoot;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function stripTrailingWhitespace(text) {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nexpected: ${expected}\nactual:   ${actual}`);
  }
}

function listYamlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort();
}

function objectKeySetFromYaml(yaml) {
  return new Set(Object.keys(canonicalObjectMaps(yaml, "").helm));
}

function objectFilesFromDirs(dirs) {
  const files = [];
  for (const dir of dirs) {
    for (const file of listYamlFiles(dir)) {
      const path = join(dir, file);
      files.push({ path, yaml: readFileSync(path, "utf8") });
    }
  }
  return files;
}

function canonicalObjectMaps(helmYaml, cubYaml) {
  try {
    const output = execFileSync(
      "python3",
      [
        "-c",
        `
import json
import sys

try:
    import yaml
except Exception as exc:
    raise SystemExit(f"python3 with PyYAML is required for semantic comparison: {exc}")

payload = json.load(sys.stdin)

def object_map(text):
    result = {}
    if not text:
        return result
    for doc in yaml.safe_load_all(text):
        if not doc:
            continue
        metadata = doc.get("metadata") or {}
        key = "|".join([
            str(doc.get("apiVersion", "")),
            str(doc.get("kind", "")),
            str(metadata.get("namespace", "")),
            str(metadata.get("name", "")),
        ])
        result[key] = json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return result

print(json.dumps({
    "helm": object_map(payload["helm"]),
    "cub": object_map(payload["cub"]),
}, sort_keys=True))
`,
      ],
      {
        encoding: "utf8",
        input: JSON.stringify({ helm: helmYaml, cub: cubYaml }),
      },
    );
    return JSON.parse(output);
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

function difference(left, right) {
  return [...left].filter((key) => !right.has(key)).sort();
}
