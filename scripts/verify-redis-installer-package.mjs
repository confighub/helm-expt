import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
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

const env = { ...process.env, CONFIGHUB_AGENT: "1" };
try {
  const goPath = execFileSync("go", ["env", "GOPATH"], { encoding: "utf8" }).trim();
  const goBin = join(goPath, "bin");
  if (!env.PATH?.split(":").includes(goBin)) {
    env.PATH = `${env.PATH ?? ""}:${goBin}`;
  }
} catch {
  // Let the later cub/kustomize command fail clearly if Go is unavailable.
}

const variants = [
  {
    name: "default",
    base: "default",
    releaseObjects: join(proofRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml"),
    helmObjectCount: 14,
    cubObjectCount: 15,
    separatedSecretCount: 1,
  },
  {
    name: "reuse-existing-secret",
    base: "reuse-existing-secret",
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

verifyPackage();

function verifyPackage() {
  check(existsSync(packageRoot), `missing package root ${packageRelative}; run npm run redis:generate-package`);
  check(existsSync(receiptPath), "missing installer package receipt; run npm run redis:generate-package");

  const installer = parseYamlFile(join(packageRoot, "installer.yaml"));
  const receipt = parseYamlFile(receiptPath);
  check(installer.kind === "Package", "installer.yaml must be a Package");
  check(installer.metadata?.name === "bitnami-redis", "package metadata.name must be bitnami-redis");
  check(String(installer.metadata?.version) === "25.5.3", "package metadata.version must be 25.5.3");
  check(installer.spec?.collector?.command === "/bin/sh", "package must declare the Redis target-facts collector");
  check(
    JSON.stringify(installer.spec?.collector?.args ?? []) === JSON.stringify(["collector/target-facts.sh"]),
    "package collector must run collector/target-facts.sh",
  );
  check(existsSync(join(packageRoot, "collector", "target-facts.sh")), "missing Redis target-facts collector script");
  check(receipt.kind === "InstallerPackageReceipt", "publication receipt must be InstallerPackageReceipt");
  check(receipt.spec?.package?.path === packageRelative, "receipt package path mismatch");

  const bases = installer.spec?.bases ?? [];
  check(bases.length === 2, "package must declare exactly two bases");
  check(bases.filter((base) => base.default === true).length === 1, "package must declare exactly one default base");
  for (const variant of variants) {
    const base = bases.find((candidate) => candidate.name === variant.base);
    check(Boolean(base), `missing base ${variant.base}`);
    check(base.path === `bases/${variant.base}`, `base ${variant.base} path mismatch`);
    if (variant.name === "reuse-existing-secret") {
      const requirements = base.externalRequires ?? [];
      check(requirements.length === 1, "reuse-existing-secret base must declare one target-fact precondition");
      const requirement = requirements[0];
      check(requirement.kind === "ClusterFeature", "reuse-existing-secret requirement must be installer-native ClusterFeature");
      check(
        requirement.name === "Secret redis/redis-existing-secret key redis-password",
        "reuse-existing-secret requirement must name the Redis Secret target fact",
      );
      check(requirement.namespace === "redis", "reuse-existing-secret requirement namespace mismatch");
    } else {
      check((base.externalRequires ?? []).length === 0, "default base must not require the existing Redis Secret");
    }
    check(existsSync(join(packageRoot, base.path, "kustomization.yaml")), `base ${variant.base} missing kustomization`);
    check(existsSync(join(packageRoot, base.path, "upstream.yaml")), `base ${variant.base} missing upstream.yaml`);
    check(
      readFileSync(join(packageRoot, base.path, "upstream.yaml"), "utf8") ===
        stripTrailingWhitespace(readFileSync(variant.releaseObjects, "utf8")),
      `base ${variant.base} upstream.yaml must match the normalized variant revision release objects`,
    );
  }

  const receiptFiles = receipt.spec?.package?.sourceFiles ?? [];
  const actualFiles = listFiles(packageRoot).map((path) => ({
    path: relative(packageRoot, path),
    sha256: sha256File(path),
    bytes: readFileSync(path).length,
  }));
  check(receiptFiles.length === actualFiles.length, "package source file count mismatch");
  const actualFileMap = new Map(actualFiles.map((file) => [file.path, file]));
  for (const receiptFile of receiptFiles) {
    const actualFile = actualFileMap.get(receiptFile.path);
    check(Boolean(actualFile), `receipt references missing package source file ${receiptFile.path}`);
    check(actualFile.sha256 === receiptFile.sha256, `package source file SHA mismatch for ${receiptFile.path}`);
    check(actualFile.bytes === receiptFile.bytes, `package source file byte count mismatch for ${receiptFile.path}`);
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "redis-installer-package-verify-"));
  let ok = false;
  try {
    const firstPackage = join(tempRoot, "bitnami-redis-25.5.3-a.tgz");
    const secondPackage = join(tempRoot, "bitnami-redis-25.5.3-b.tgz");
    runCub(["installer", "package", packageRoot, "-o", firstPackage]);
    runCub(["installer", "package", packageRoot, "-o", secondPackage]);
    const firstSHA = sha256File(firstPackage);
    const secondSHA = sha256File(secondPackage);
    check(firstSHA === secondSHA, "cub installer package SHA changed between two runs");
    check(readFileSync(firstPackage).equals(readFileSync(secondPackage)), "cub installer package output is not byte-identical");
    check(firstSHA === receipt.spec?.deterministicBundle?.sha256, "deterministic package SHA mismatch");
    check(
      receipt.spec?.deterministicBundle?.byteIdenticalAcrossTwoLocalBundles === true,
      "receipt must record byte-identical deterministic bundle",
    );

    for (const variant of variants) {
      verifySetupVariant(tempRoot, variant, receipt);
    }

    ok = true;
  } finally {
    if (ok) rmSync(tempRoot, { recursive: true, force: true });
    else console.error(`Left package verification workspace for inspection: ${tempRoot}`);
  }

  console.log("Redis installer package verification passed.");
}

function verifySetupVariant(tempRoot, variant, receipt) {
  const checkReceipt = (receipt.spec?.setupChecks ?? []).find((item) => item.variant === variant.name);
  check(Boolean(checkReceipt), `receipt missing setup check for ${variant.name}`);
  check(checkReceipt.base === variant.base, `${variant.name} receipt base mismatch`);
  check(checkReceipt.helmReleaseObjectCount === variant.helmObjectCount, `${variant.name} receipt Helm count mismatch`);
  check(
    checkReceipt.cubInstallObjectCountIncludingSupport === variant.cubObjectCount,
    `${variant.name} receipt cub object count mismatch`,
  );
  check(
    checkReceipt.separatedSecretCount === variant.separatedSecretCount,
    `${variant.name} receipt separated secret count mismatch`,
  );
  check(
    checkReceipt.targetFactMode === (variant.name === "reuse-existing-secret" ? "collector-facts" : "not-required"),
    `${variant.name} receipt target fact mode mismatch`,
  );
  check(
    checkReceipt.targetFactsBound === (variant.name === "reuse-existing-secret"),
    `${variant.name} receipt target fact binding mismatch`,
  );

  const workDir = join(tempRoot, `work-${variant.name}`);
  runCub([
    "install",
    "setup",
    "--pull",
    packageRoot,
    "--base",
    variant.base,
    "--work-dir",
    workDir,
    "--non-interactive",
    "--namespace",
    "redis",
  ]);

  const helmYaml = readFileSync(variant.releaseObjects, "utf8");
  const cubObjectFiles = objectFilesFromDirs([join(workDir, "out", "manifests"), join(workDir, "out", "secrets")]);
  const cubYaml = cubObjectFiles.map((file) => file.yaml).join("\n---\n");
  const semantic = canonicalObjectMaps(helmYaml, cubYaml);
  const helmObjects = new Set(Object.keys(semantic.helm));
  const cubObjects = new Set(Object.keys(semantic.cub));
  check(helmObjects.size === variant.helmObjectCount, `${variant.name} Helm object count mismatch`);
  check(cubObjects.size === variant.cubObjectCount, `${variant.name} cub object count mismatch`);

  const missingFromCub = difference(helmObjects, cubObjects);
  check(missingFromCub.length === 0, `${variant.name} cub output missing Helm object(s): ${missingFromCub.join(", ")}`);
  const extraInCub = difference(cubObjects, helmObjects);
  check(
    JSON.stringify(extraInCub) === JSON.stringify(["v1|Namespace||redis"]),
    `${variant.name} cub output may add only v1|Namespace||redis; found ${extraInCub.join(", ")}`,
  );

  const semanticDiffs = [];
  for (const key of helmObjects) {
    if (semantic.helm[key] !== semantic.cub[key]) semanticDiffs.push(key);
  }
  check(
    semanticDiffs.length === 0,
    `${variant.name} cub output differs semantically from Helm object(s): ${semanticDiffs.join(", ")}`,
  );

  const secretFiles = listYamlFiles(join(workDir, "out", "secrets"));
  check(secretFiles.length === variant.separatedSecretCount, `${variant.name} separated secret count mismatch`);
  verifyTargetFacts(workDir, variant);
}

function verifyTargetFacts(workDir, variant) {
  const factsPath = join(workDir, "out", "spec", "facts.yaml");
  check(existsSync(factsPath), `${variant.name} setup must write collector facts`);
  const facts = parseYamlFile(factsPath);
  const values = facts.spec?.values ?? {};
  check(facts.kind === "Facts", `${variant.name} collector output must be persisted as Facts`);
  check(values.targetFactChecks?.base === variant.base, `${variant.name} target fact check base mismatch`);
  if (variant.name === "reuse-existing-secret") {
    check(values.targetFactChecks?.mode === "record", "reuse-existing-secret target fact check mode must default to record");
    check(
      values.targetFactChecks?.result === "recorded",
      "reuse-existing-secret target fact check result must be recorded",
    );
    const requiredSecrets = values.targetFacts?.requiredSecrets ?? [];
    check(requiredSecrets.length === 1, "reuse-existing-secret setup must bind one required Secret fact");
    const secret = requiredSecrets[0];
    check(secret.namespace === "redis", "reuse-existing-secret target Secret namespace mismatch");
    check(secret.name === "redis-existing-secret", "reuse-existing-secret target Secret name mismatch");
    check(
      JSON.stringify(secret.keys ?? []) === JSON.stringify(["redis-password"]),
      "reuse-existing-secret target Secret keys mismatch",
    );
  } else {
    check(values.targetFactChecks?.mode === "not-required", "default target fact mode must be not-required");
    check(
      JSON.stringify(values.targetFacts?.requiredSecrets ?? []) === JSON.stringify([]),
      "default setup must not bind required Secret facts",
    );
  }
}

function runCub(args) {
  return execFileSync("cub", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 100,
  });
}

function parseYamlFile(path) {
  const script = `
import json
import sys
import yaml

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    docs = list(yaml.safe_load_all(handle))
docs = [doc for doc in docs if doc is not None]
print(json.dumps(docs[0] if len(docs) == 1 else docs, sort_keys=True))
`;
  return JSON.parse(
    execFileSync("python3", ["-c", script, path], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 100,
    }),
  );
}

function canonicalObjectMaps(helmYaml, cubYaml) {
  const output = execFileSync(
    "python3",
    [
      "-c",
      `
import json
import sys
import yaml

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
        if key.strip("|"):
            result[key] = json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return result

print(json.dumps({"helm": object_map(payload["helm"]), "cub": object_map(payload["cub"])}, sort_keys=True))
`,
    ],
    {
      input: JSON.stringify({ helm: helmYaml, cub: cubYaml }),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 100,
    },
  );
  return JSON.parse(output);
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

function listYamlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort();
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

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function stripTrailingWhitespace(text) {
  return `${text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n*$/, "")}\n`;
}
