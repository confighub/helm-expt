import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = process.cwd();
const redisPackage = resolve(
  repoRoot,
  "archive/render-and-vendor-top20/charts/06-bitnami-redis",
);
const valuesFile = join(redisPackage, "values.yaml");
const upstreamYaml = join(redisPackage, "base/upstream.yaml");
const receiptFile = join(redisPackage, "helm-import.receipt.yaml");

const env = { ...process.env };
try {
  const goPath = execFileSync("go", ["env", "GOPATH"], { encoding: "utf8" })
    .trim();
  const goBin = join(goPath, "bin");
  if (!env.PATH?.split(":").includes(goBin)) {
    env.PATH = `${env.PATH ?? ""}:${goBin}`;
  }
} catch {
  // If Go is unavailable, let the later kustomize/cub command fail clearly.
}

const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-redis-compare-"));
const workDir = join(tempRoot, "installer-work");
let ok = false;

try {
  const receipt = readFileSync(receiptFile, "utf8");
  const expectedHelmSHA = receipt.match(/upstreamYAMLSHA256:\s+"([^"]+)"/)?.[1];
  if (!expectedHelmSHA) {
    throw new Error(`Could not read upstreamYAMLSHA256 from ${receiptFile}`);
  }

  console.log("Rendering Redis with Helm using the captured import inputs...");
  const helmYaml = execFileSync(
    "helm",
    [
      "template",
      "redis",
      "oci://registry-1.docker.io/bitnamicharts/redis",
      "--version",
      "25.5.3",
      "--namespace",
      "redis",
      "--values",
      valuesFile,
      "--kube-version",
      "1.30.0",
      "--include-crds",
      "--skip-tests",
      "--no-hooks",
    ],
    { encoding: "utf8", env, stdio: ["ignore", "pipe", "inherit"] },
  );

  const helmSHA = sha256(helmYaml);
  assertEqual(
    helmSHA,
    expectedHelmSHA,
    "fresh Helm render must match helm-import.receipt.yaml",
  );

  const archivedYaml = readFileSync(upstreamYaml, "utf8");
  assertEqual(
    sha256(archivedYaml),
    expectedHelmSHA,
    "archived upstream.yaml must match helm-import.receipt.yaml",
  );
  assertEqual(
    helmYaml,
    archivedYaml,
    "fresh Helm render must byte-match archived upstream.yaml",
  );

  console.log("Rendering the same Redis package with cub install setup...");
  const setupOutput = execFileSync(
    "cub",
    [
      "install",
      "setup",
      "--pull",
      redisPackage,
      "--work-dir",
      workDir,
      "--non-interactive",
      "--namespace",
      "redis",
    ],
    { encoding: "utf8", env, stdio: ["ignore", "pipe", "inherit"] },
  );
  process.stdout.write(setupOutput);

  const helmObjects = objectKeySetFromYaml(helmYaml);
  const cubObjectFiles = objectFilesFromDirs([
    join(workDir, "out/manifests"),
    join(workDir, "out/secrets"),
  ]);
  const cubYaml = cubObjectFiles.map((file) => file.yaml).join("\n---\n");
  const semantic = canonicalObjectMaps(helmYaml, cubYaml);
  const cubObjects = new Set(Object.keys(semantic.cub));

  const missingFromCub = difference(helmObjects, cubObjects);
  if (missingFromCub.length) {
    throw new Error(
      `cub install output is missing Helm object(s):\n${missingFromCub.join(
        "\n",
      )}`,
    );
  }

  const extraInCub = difference(cubObjects, helmObjects);
  assertEqual(
    JSON.stringify(extraInCub),
    JSON.stringify(["v1|Namespace||redis"]),
    "cub install may add only the explicit namespace support object",
  );

  const semanticDiffs = [];
  for (const key of helmObjects) {
    if (semantic.helm[key] !== semantic.cub[key]) {
      semanticDiffs.push(key);
    }
  }
  if (semanticDiffs.length) {
    throw new Error(
      `cub install output differs semantically from Helm object(s):\n${semanticDiffs.join(
        "\n",
      )}`,
    );
  }

  const manifestFiles = listYamlFiles(join(workDir, "out/manifests"));
  const secretFiles = listYamlFiles(join(workDir, "out/secrets"));

  console.log("\nComparison passed.");
  console.log(`Helm render SHA256: ${helmSHA}`);
  console.log(`Helm objects: ${helmObjects.size}`);
  console.log(`cub install objects: ${cubObjects.size}`);
  console.log(`semantic object matches: ${helmObjects.size}/${helmObjects.size}`);
  console.log(`cub uploaded-manifest files: ${manifestFiles.length}`);
  console.log(`cub separated-secret files: ${secretFiles.length}`);
  console.log("Allowed cub-only object: v1|Namespace||redis");
  ok = true;
} finally {
  if (ok) {
    rmSync(tempRoot, { recursive: true, force: true });
  } else {
    console.error(`Left comparison workspace for inspection: ${tempRoot}`);
  }
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
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
