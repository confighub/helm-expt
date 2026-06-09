import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const mode = args[0] ?? "--generate";
const targetCharts = targetFactCharts();

if (mode === "--generate") {
  for (const chart of targetCharts) syncChart(chart);
  console.log(`synced installer target facts for ${targetCharts.length} chart(s)`);
} else if (mode === "--verify") {
  for (const chart of targetCharts) verifyChart(chart);
  console.log(`verified installer target facts for ${targetCharts.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/sync-installer-target-facts.mjs --generate
  node scripts/sync-installer-target-facts.mjs --verify`);
  process.exit(1);
}

function targetFactCharts() {
  const variantFiles = listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/variant.yaml"))
    .filter((file) => readYaml(file).spec?.targetFacts)
    .sort();
  const charts = new Map();
  for (const variantFile of variantFiles) {
    const recipeRoot = dirname(dirname(dirname(variantFile)));
    const variant = readYaml(variantFile);
    const entry = charts.get(recipeRoot) ?? {
      recipeRoot,
      variants: [],
      recipe: readYaml(join(recipeRoot, "recipe.yaml")),
      receiptPath: join(recipeRoot, "publication", "installer-package-receipt.yaml"),
    };
    entry.variants.push({ name: variant.metadata?.name, path: variantFile, targetFacts: variant.spec.targetFacts });
    charts.set(recipeRoot, entry);
  }
  return [...charts.values()].sort((left, right) => left.recipeRoot.localeCompare(right.recipeRoot));
}

function syncChart(chart) {
  const packageRoot = packageRootFor(chart);
  const installerPath = join(packageRoot, "installer.yaml");
  check(existsSync(installerPath), `${relativeRepo(chart.recipeRoot)} missing package installer`);
  check(existsSync(chart.receiptPath), `${relativeRepo(chart.recipeRoot)} missing installer package receipt`);
  const installer = readYaml(installerPath);
  const factsByVariant = new Map(chart.variants.map((variant) => [variant.name, variant.targetFacts]));

  installer.spec.collector = {
    command: "/bin/sh",
    args: ["collector/target-facts.sh"],
    description: "Records target-fact bindings and can live-check existing Secret requirements.",
  };
  installer.spec.bases = (installer.spec.bases ?? []).map((base) => {
    const targetFacts = factsByVariant.get(base.name);
    const generated = targetFacts ? externalRequiresFor(targetFacts) : [];
    const existing = (base.externalRequires ?? []).filter((item) => !isGeneratedTargetFactRequire(item));
    const next = { ...base };
    if (existing.length || generated.length) next.externalRequires = [...existing, ...generated];
    else delete next.externalRequires;
    return next;
  });
  writeYaml(installerPath, installer);
  write(join(packageRoot, "collector", "target-facts.sh"), collectorScript(installer.spec.bases ?? [], factsByVariant));

  const receipt = readYaml(chart.receiptPath);
  receipt.spec.package.sourceFiles = packageSourceFiles(packageRoot);
  const bundle = deterministicBundle(packageRoot, receipt.spec.package.path);
  receipt.spec.deterministicBundle.sha256 = bundle.sha256;
  receipt.spec.deterministicBundle.byteIdenticalAcrossTwoLocalBundles = true;
  receipt.spec.setupChecks = (receipt.spec.setupChecks ?? []).map((item) => ({
    ...item,
    targetFactMode: factsByVariant.has(item.variant) ? "collector-facts" : "not-required",
    targetFactsBound: factsByVariant.has(item.variant),
  }));
  writeYaml(chart.receiptPath, receipt);
}

function verifyChart(chart) {
  const packageRoot = packageRootFor(chart);
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(chart.receiptPath);
  const factsByVariant = new Map(chart.variants.map((variant) => [variant.name, variant.targetFacts]));

  check(installer.spec?.collector?.command === "/bin/sh", `${relativeRepo(packageRoot)} must declare target-facts collector`);
  check(
    JSON.stringify(installer.spec?.collector?.args ?? []) === JSON.stringify(["collector/target-facts.sh"]),
    `${relativeRepo(packageRoot)} collector must run collector/target-facts.sh`,
  );
  check(existsSync(join(packageRoot, "collector", "target-facts.sh")), `${relativeRepo(packageRoot)} missing collector script`);

  const bases = installer.spec?.bases ?? [];
  for (const [variantName, targetFacts] of factsByVariant.entries()) {
    const base = bases.find((item) => item.name === variantName);
    check(Boolean(base), `${relativeRepo(packageRoot)} missing target-fact base ${variantName}`);
    const expected = externalRequiresFor(targetFacts);
    for (const requirement of expected) {
      check(
        (base.externalRequires ?? []).some((item) => sameRequire(item, requirement)),
        `${relativeRepo(packageRoot)} base ${variantName} missing requirement ${requirement.name}`,
      );
    }
    const setupCheck = (receipt.spec?.setupChecks ?? []).find((item) => item.variant === variantName);
    check(Boolean(setupCheck), `${relativeRepo(chart.receiptPath)} missing setup check for ${variantName}`);
    check(setupCheck.targetFactMode === "collector-facts", `${variantName} receipt targetFactMode mismatch`);
    check(setupCheck.targetFactsBound === true, `${variantName} receipt targetFactsBound mismatch`);
    verifySetupFacts(packageRoot, variantName, targetFacts);
  }

  const receiptFiles = receipt.spec?.package?.sourceFiles ?? [];
  const actualFiles = packageSourceFiles(packageRoot);
  check(receiptFiles.length === actualFiles.length, `${relativeRepo(packageRoot)} source file count mismatch`);
  const actualByPath = new Map(actualFiles.map((file) => [file.path, file]));
  for (const file of receiptFiles) {
    const actual = actualByPath.get(file.path);
    check(Boolean(actual), `${relativeRepo(chart.receiptPath)} references missing ${file.path}`);
    check(actual.sha256 === file.sha256, `${relativeRepo(packageRoot)} SHA mismatch for ${file.path}`);
    check(actual.bytes === file.bytes, `${relativeRepo(packageRoot)} byte count mismatch for ${file.path}`);
  }
}

function verifySetupFacts(packageRoot, variantName, targetFacts) {
  const tempRoot = mkdtempSync(join("/tmp", "helm-expt-target-facts-"));
  let ok = false;
  try {
    const namespace = firstNamespace(targetFacts) ?? "default";
    runCub([
      "installer",
      "setup",
      "--pull",
      packageRoot,
      "--base",
      variantName,
      "--work-dir",
      tempRoot,
      "--non-interactive",
      "--namespace",
      namespace,
    ]);
    const facts = readYaml(join(tempRoot, "out", "spec", "facts.yaml"));
    check(facts.kind === "Facts", `${variantName} setup must write Facts`);
    const values = facts.spec?.values ?? {};
    check(values.targetFactChecks?.base === variantName, `${variantName} facts base mismatch`);
    check(values.targetFactChecks?.mode === "record", `${variantName} facts mode mismatch`);
    check(values.targetFactChecks?.result === "recorded", `${variantName} facts result mismatch`);
    check(
      JSON.stringify(values.targetFacts?.requiredSecrets ?? []) === JSON.stringify(targetFacts.requiredSecrets ?? []),
      `${variantName} facts requiredSecrets mismatch`,
    );
    check(
      JSON.stringify(values.targetFacts?.requiredCRDs ?? []) === JSON.stringify(targetFacts.requiredCRDs ?? []),
      `${variantName} facts requiredCRDs mismatch`,
    );
    ok = true;
  } finally {
    if (ok) rmSync(tempRoot, { recursive: true, force: true });
    else console.error(`Left target-facts verification workspace for inspection: ${tempRoot}`);
  }
}

function packageRootFor(chart) {
  const receipt = readYaml(chart.receiptPath);
  const packagePath = receipt.spec?.package?.path ?? chart.recipe.spec?.currentExecutableFixture?.installerPackage;
  check(packagePath, `${relativeRepo(chart.recipeRoot)} missing installer package path`);
  return join(repoRoot, packagePath);
}

function externalRequiresFor(targetFacts) {
  const requirements = (targetFacts.requiredSecrets ?? []).map((secret) => ({
    kind: "ClusterFeature",
    name: secretRequirementName(secret),
    namespace: secret.namespace ?? "",
    suggestedSource: `kubectl -n ${secret.namespace ?? "default"} create secret generic ${secret.name} ${secret.keys
      .map((key) => `--from-literal=${key}=<value>`)
      .join(" ")}`,
  }));
  requirements.push(
    ...(targetFacts.requiredCRDs ?? []).map((crd) => ({
      kind: "ClusterFeature",
      name: crdRequirementName(crd),
      suggestedSource: "kubectl apply -f <crd-manifest.yaml>",
    })),
  );
  return requirements;
}

function secretRequirementName(secret) {
  const keyLabel = (secret.keys ?? []).length === 1 ? "key" : "keys";
  return `Secret ${secret.namespace ?? "default"}/${secret.name} ${keyLabel} ${(secret.keys ?? []).join(",")}`;
}

function crdRequirementName(crd) {
  return `CRD ${crd.name}`;
}

function isGeneratedTargetFactRequire(item) {
  return item?.kind === "ClusterFeature" && typeof item.name === "string" && (item.name.startsWith("Secret ") || item.name.startsWith("CRD "));
}

function sameRequire(left, right) {
  return left.kind === right.kind && left.name === right.name && (left.namespace ?? "") === (right.namespace ?? "");
}

function collectorScript(bases, factsByVariant) {
  const cases = bases
    .filter((base) => factsByVariant.has(base.name))
    .map((base) => collectorCase(base.name, factsByVariant.get(base.name)))
    .join("\n");
  return `#!/bin/sh
set -eu

base="\${INSTALLER_BASE:-default}"
check_mode="\${TARGET_FACT_CHECK_MODE:-record}"

emit_empty() {
  cat <<YAML
targetFacts:
  requiredSecrets: []
  requiredCRDs: []
targetFactChecks:
  base: "$base"
  mode: not-required
  result: pass
YAML
}

live_check_secret() {
  namespace="$1"
  name="$2"
  key="$3"
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  if ! kubectl -n "$namespace" get secret "$name" >/dev/null 2>&1; then
    echo "required Secret $namespace/$name was not found" >&2
    exit 1
  fi
  if ! kubectl -n "$namespace" get secret "$name" -o yaml | awk -v key="$key" '$1 == key ":" { found=1 } END { exit found ? 0 : 1 }'; then
    echo "required Secret $namespace/$name is missing key $key" >&2
    exit 1
  fi
}

live_check_crd() {
  name="$1"
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  if ! kubectl get crd "$name" >/dev/null 2>&1; then
    echo "required CRD $name was not found" >&2
    exit 1
  fi
}

case "$base" in
${cases}
  *)
    emit_empty
    ;;
esac
`;
}

function collectorCase(variantName, targetFacts) {
  const checks = (targetFacts.requiredSecrets ?? [])
    .flatMap((secret) => (secret.keys ?? []).map((key) => `      live_check_secret ${shellQuote(secret.namespace ?? "default")} ${shellQuote(secret.name)} ${shellQuote(key)}`))
    .concat((targetFacts.requiredCRDs ?? []).map((crd) => `      live_check_crd ${shellQuote(crd.name)}`))
    .join("\n");
  return `  ${shellQuote(variantName)})
    if [ "$check_mode" = "live" ]; then
${checks || "    true"}
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
${indentYaml({ requiredSecrets: targetFacts.requiredSecrets ?? [] }, 2)}
${indentYaml({ requiredCRDs: targetFacts.requiredCRDs ?? [] }, 2)}
targetFactChecks:
  base: "${variantName}"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;`;
}

function indentYaml(value, spaces) {
  const json = JSON.stringify(value);
  const text = execFileSync(
    "python3",
    [
      "-c",
      `import json,sys,yaml
data=json.loads(sys.stdin.read())
print(yaml.safe_dump(data, sort_keys=False).rstrip())
`,
    ],
    { input: json, encoding: "utf8" },
  );
  return text
    .split("\n")
    .map((line) => (line.length ? `${" ".repeat(spaces)}${line}` : ""))
    .join("\n");
}

function firstNamespace(targetFacts) {
  return targetFacts.requiredSecrets?.find((secret) => secret.namespace)?.namespace;
}

function packageSourceFiles(packageRoot) {
  return listFiles(packageRoot).map((path) => ({
    path: relative(packageRoot, path).replaceAll("\\", "/"),
    sha256: sha256File(path),
    bytes: readFileSync(path).length,
  }));
}

function deterministicBundle(packageRoot, packageRelative) {
  const tempRoot = mkdtempSync(join("/tmp", "helm-expt-package-"));
  try {
    const first = join(tempRoot, "a.tgz");
    const second = join(tempRoot, "b.tgz");
    runCub(["installer", "package", packageRoot, "-o", first]);
    runCub(["installer", "package", packageRoot, "-o", second]);
    check(sha256File(first) === sha256File(second), `${packageRelative} package SHA changed between runs`);
    check(readFileSync(first).equals(readFileSync(second)), `${packageRelative} package bytes changed between runs`);
    return { sha256: sha256File(first) };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runCub(cubArgs) {
  return execFileSync("cub", cubArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    env: cubEnv(),
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 200,
  });
}

function cubEnv() {
  const env = { ...process.env, CONFIGHUB_AGENT: "1" };
  try {
    const goPath = execFileSync("go", ["env", "GOPATH"], { encoding: "utf8" }).trim();
    const goBin = join(goPath, "bin");
    if (!env.PATH?.split(":").includes(goBin)) env.PATH = `${env.PATH ?? ""}:${goBin}`;
  } catch {
    // Let cub/kustomize fail clearly if the local toolchain is incomplete.
  }
  return env;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}
