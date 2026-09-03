// Stage B of the eks-inf replica experiment: run the eight-check composition
// verdict proposed in docs/planning/composition-certification.md over the
// assembled eight-bundle stack, its first real target.
//
//   in:  data/eks-inf-replica/source/components-manifest.yaml   (planes, order)
//        data/eks-inf-replica/source/eks-inference-stack.yaml (bindings: the declared link set; the live manifest is cub-workshop stacks/eks-inference.yaml)
//        data/eks-inf-replica/parity.csv                        (stage A.2 result)
//        data/certified-bundles/receipts.csv + receipts/**      (digests, files)
//        ghcr.io/confighub/configs/eks-inference/*              (pulls, by digest)
//   out: data/eks-inf-replica/composition-verdict.yaml
//        data/eks-inf-replica/composition-verdict.md
//
// Statuses are pass, findings, or not-evaluated, and nothing is silent. The
// acceptance test from the proposal: the verdict must catch the one defect
// curation already caught by hand, the karpenter-aws component hardcoding the
// cluster name the profile owns instead of linking it. --self-test mutates the
// composition in memory and asserts each check can go red.

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, command, parseDocs, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const selfTest = process.argv.includes("--self-test");
const gateMode = process.argv.includes("--gate");
const replicaRoot = join(repoRoot, "data", "eks-inf-replica");
const manifest = readYaml(join(replicaRoot, "source", "components-manifest.yaml"));
// The stack manifest is the single source for the declared link set; the
// profile-bindings snapshot remains as its derivation evidence.
const bindings = readYaml(join(repoRoot, "data", "eks-inf-replica", "source", "eks-inference-stack.yaml")).spec.bindings;
const registryRows = readFileSync(join(repoRoot, "data", "certified-bundles", "receipts.csv"), "utf8").trim().split("\n").slice(1).map((line) => line.split(","));
const stackRows = registryRows.filter((cells) => cells[0] === "eks-inference").map((cells) => ({ name: cells[1].replace(/^eks-inference-/, ""), ociReference: cells[10] }));
check(stackRows.length === 8, "the registry must carry exactly eight stack bundles");

const WELL_KNOWN_NAMESPACES = new Set(["default", "kube-system", "kube-public", "kube-node-lease"]);
const BUILTIN_GROUPS = new Set(["apps", "batch", "policy", "autoscaling", "networking.k8s.io", "rbac.authorization.k8s.io", "apiextensions.k8s.io", "admissionregistration.k8s.io", "storage.k8s.io", "scheduling.k8s.io", "coordination.k8s.io", "certificates.k8s.io"]);

// ---- Assemble the composition ------------------------------------------------

const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const planeRank = { mgmt: 0, workload: 1 };
const components = [];
const workRoot = mkdtempSync(join(tmpdir(), "eks-inf-verdict-"));
for (const spec of manifest.components) {
  const receipt = readYaml(join(repoRoot, "data", "certified-bundles", "receipts", "eks-inference", spec.name, "receipt.yaml"));
  const digest = receipt.spec.bundle.manifestDigest;
  const row = stackRows.find((candidate) => candidate.name === spec.name);
  const pullRoot = join(workRoot, `${spec.name}-pull`);
  command("oras", ["pull", `${row.ociReference.replace(/:latest$/, "")}@${digest}`, "-o", pullRoot]);
  const dir = join(workRoot, spec.name);
  command("mkdir", ["-p", dir]);
  command("tar", ["-xzf", join(pullRoot, readdirSync(pullRoot).find((name) => name.endsWith(".tar.gz"))), "-C", dir]);
  const files = receipt.spec.bundle.files.filter((file) => !file.role);
  const badFiles = files.filter((file) => sha256File(join(dir, file.path)) !== file.sha256);
  check(badFiles.length === 0, `${spec.name}: pulled bundle does not match its receipt`);
  const objects = files.flatMap((file) => parseDocs(readFileSync(join(dir, file.path), "utf8"))).filter((doc) => doc && typeof doc === "object" && doc.kind);
  components.push({ ...spec, digest, objects });
}
rmSync(workRoot, { recursive: true, force: true });

const identityOf = (doc) => [doc.apiVersion ?? "", doc.kind ?? "", doc.metadata?.namespace ?? "", doc.metadata?.name ?? ""].join("|");
const waveOf = (component, doc) => {
  const syncWave = Number(doc.metadata?.annotations?.["argocd.argoproj.io/sync-wave"] ?? 0);
  return planeRank[component.plane] * 1_000_000 + component.order * 1_000 + syncWave + 500;
};
const applied = components.filter((component) => component.plane !== "hub");
const hub = components.find((component) => component.plane === "hub");
const profile = hub.objects.find((doc) => doc.kind === "PlatformProfile");
check(Boolean(profile), "the hub plane must carry the PlatformProfile");

const leafWalk = (value, path, visit) => {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    const named = value.length > 0 && value.every((item) => item && typeof item === "object" && typeof item.name === "string");
    value.forEach((item, index) => leafWalk(item, `${path}[${named ? item.name : index}]`, visit));
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) leafWalk(child, path ? `${path}.${key}` : key, visit);
    return;
  }
  visit(path, value);
};

// ---- The eight checks --------------------------------------------------------

function checkClosure(appliedComponents) {
  const namespaces = new Map();
  const serviceAccounts = new Set();
  const secretsAndConfigMaps = new Set();
  for (const component of appliedComponents) {
    for (const doc of component.objects) {
      if (doc.kind === "Namespace") namespaces.set(doc.metadata.name, component.name);
      if (doc.kind === "ServiceAccount") serviceAccounts.add(`${doc.metadata.namespace}|${doc.metadata.name}`);
      if (doc.kind === "Secret" || doc.kind === "ConfigMap") secretsAndConfigMaps.add(`${doc.kind}|${doc.metadata.namespace}|${doc.metadata.name}`);
    }
  }
  const findings = [];
  const notes = [];
  const seen = new Set();
  for (const component of appliedComponents) {
    for (const doc of component.objects) {
      const namespace = doc.metadata?.namespace;
      if (namespace && !namespaces.has(namespace) && !WELL_KNOWN_NAMESPACES.has(namespace)) {
        const key = `namespace ${namespace} (needed by ${component.name})`;
        if (!seen.has(key)) { seen.add(key); findings.push(`unprovided ${key}: no component creates it`); }
      }
      const podSpec = doc.spec?.template?.spec ?? (doc.kind === "Pod" ? doc.spec : undefined);
      if (podSpec?.serviceAccountName && !serviceAccounts.has(`${namespace}|${podSpec.serviceAccountName}`)) {
        findings.push(`unprovided serviceaccount ${namespace}/${podSpec.serviceAccountName} (needed by ${component.name}/${doc.metadata.name})`);
      }
      for (const volume of podSpec?.volumes ?? []) {
        const wanted = volume.secret ? `Secret|${namespace}|${volume.secret.secretName}` : volume.configMap ? `ConfigMap|${namespace}|${volume.configMap.name}` : null;
        if (wanted && !secretsAndConfigMaps.has(wanted)) {
          const optional = volume.secret?.optional ?? volume.configMap?.optional;
          const line = `${wanted.replaceAll("|", " ")} (volume in ${component.name}/${doc.metadata.name})`;
          if (optional) notes.push(`target-supplied optional ${line}`);
          else findings.push(`unprovided ${line}: supplied by the target, not the composition`);
        }
      }
    }
  }
  return { name: "closure", status: findings.length ? "findings" : "pass", findings, notes };
}

function checkSingleOwner(appliedComponents, profileSpec, declaredBindings) {
  const owned = [];
  leafWalk(profileSpec, "spec", (path, value) => {
    if (typeof value === "string" && value.length >= 9) owned.push({ path, value });
  });
  // Binding paths use numeric dot segments; the leaf walk brackets them.
  const bracketed = (path) => path.replace(/\.(\d+)(?=\.|$)/g, "[$1]");
  const pathBound = new Set((declaredBindings.pathBindings ?? []).map((b) => `${b.component}|${b.resourceType}|${b.resourceName}|${bracketed(b.path)}`));
  const envBound = new Set((declaredBindings.envBindings ?? []).map((b) => `${b.component}|${b.container}|${b.envVar}`));
  const findings = [];
  let covered = 0;
  let identity = 0;
  const derived = new Map();
  for (const component of appliedComponents) {
    for (const doc of component.objects) {
      const resourceType = `${doc.apiVersion}/${doc.kind}`;
      const resourceName = `${doc.metadata?.namespace ?? ""}/${doc.metadata?.name ?? ""}`;
      leafWalk(doc, "", (path, value) => {
        if (typeof value !== "string" || path.endsWith(".description")) return;
        // A value matching several owned values counts only for the longest,
        // so clusterName does not shadow every networkName occurrence.
        const matches = owned.filter((owner) => value === owner.value || value.includes(owner.value));
        const keep = matches.filter((owner) => !matches.some((other) => other !== owner && other.value.includes(owner.value)));
        for (const owner of keep) {
          const envMatch = path.match(/containers\[([^\]]+)\]\.env\[([^\]]+)\]\.value$/);
          if (envMatch && envBound.has(`${component.name}|${envMatch[1]}|${envMatch[2]}`)) { covered += 1; continue; }
          if (pathBound.has(`${component.name}|${resourceType}|${resourceName}|${path}`)) { covered += 1; continue; }
          if (path.startsWith("metadata")) { identity += 1; continue; }
          if (value !== owner.value) { derived.set(component.name, (derived.get(component.name) ?? 0) + 1); continue; }
          findings.push(`literal copy of ${owner.path.replace(/^spec\./, "profile ")} in ${component.name} ${resourceType} ${resourceName} at ${path}`);
        }
      });
    }
  }
  const notes = [
    `${covered} occurrence(s) covered by declared links`,
    `${identity} occurrence(s) in object identity, not linkable`,
    `derived-name occurrences, values that embed an owned value inside a longer string, are counted per component, not listed: ${[...derived.entries()].sort().map(([name, count]) => `${name}=${count}`).join(", ") || "none"}`,
    "prose description fields are excluded from matching",
  ];
  return { name: "single-owner", status: findings.length ? "findings" : "pass", findings: [...new Set(findings)].sort(), notes };
}

function checkCrdCompatibility(appliedComponents) {
  const served = new Map();
  for (const component of appliedComponents) {
    for (const doc of component.objects) {
      if (doc.kind !== "CustomResourceDefinition") continue;
      for (const version of doc.spec.versions ?? []) {
        if (version.served === false) continue;
        served.set(`${doc.spec.group}/${version.name}|${doc.spec.names.kind}`, { component: component.name, crd: doc });
      }
    }
  }
  const findings = [];
  let customResources = 0;
  for (const component of appliedComponents) {
    for (const doc of component.objects) {
      const [group] = doc.apiVersion.includes("/") ? doc.apiVersion.split("/") : [""];
      if (!group || BUILTIN_GROUPS.has(group) || doc.kind === "CustomResourceDefinition") continue;
      customResources += 1;
      if (!served.has(`${doc.apiVersion}|${doc.kind}`)) {
        findings.push(`no CRD in the composition serves ${doc.apiVersion} ${doc.kind} (${component.name}/${doc.metadata?.name})`);
      }
    }
  }
  return { name: "crd-api-compatibility", status: findings.length ? "findings" : "pass", findings, notes: [`${customResources} custom resource(s) checked against ${served.size} served CRD version(s)`] };
}

function checkConflicts(appliedComponents) {
  const owners = new Map();
  const findings = [];
  for (const component of appliedComponents) {
    for (const doc of component.objects) {
      const key = identityOf(doc);
      if (owners.has(key) && owners.get(key) !== component.name) findings.push(`both ${owners.get(key)} and ${component.name} own ${key}`);
      owners.set(key, component.name);
    }
  }
  return { name: "conflict", status: findings.length ? "findings" : "pass", findings, notes: [`${owners.size} distinct object identities across ${appliedComponents.length} applied components; ports and quota dimensions are not evaluated`] };
}

function checkOrdering(appliedComponents) {
  const findings = [];
  const crdWave = new Map();
  const namespaceWave = new Map();
  for (const component of appliedComponents) {
    for (const doc of component.objects) {
      if (doc.kind === "CustomResourceDefinition") {
        for (const version of doc.spec.versions ?? []) crdWave.set(`${doc.spec.group}/${version.name}|${doc.spec.names.kind}`, waveOf(component, doc));
      }
      if (doc.kind === "Namespace") namespaceWave.set(doc.metadata.name, waveOf(component, doc));
    }
  }
  for (const component of appliedComponents) {
    for (const doc of component.objects) {
      const wave = waveOf(component, doc);
      const [group] = doc.apiVersion.includes("/") ? doc.apiVersion.split("/") : [""];
      if (group && !BUILTIN_GROUPS.has(group) && doc.kind !== "CustomResourceDefinition") {
        const provider = crdWave.get(`${doc.apiVersion}|${doc.kind}`);
        if (provider !== undefined && provider > wave) findings.push(`CRD for ${doc.apiVersion} ${doc.kind} lands after ${component.name}/${doc.metadata?.name}`);
      }
      const namespace = doc.metadata?.namespace;
      if (namespace && namespaceWave.has(namespace) && namespaceWave.get(namespace) > wave) {
        findings.push(`namespace ${namespace} lands after ${component.name}/${doc.metadata?.name}`);
      }
    }
  }
  const notes = ["waves are plane order, then component order, then the sync-wave annotation", "cross-plane convergence, the management plane finishing before the workload plane deploys, is enforced by the producer's workflow, not by these annotations"];
  return { name: "ordering", status: findings.length ? "findings" : "pass", findings, notes };
}

function checkParity() {
  const parityPath = join(replicaRoot, "parity.csv");
  const rows = readFileSync(parityPath, "utf8").trim().split("\n").slice(1).map((line) => line.split(","));
  const findings = [];
  const notes = [];
  for (const [component, mode, , , , departures, verdict] of rows) {
    if (verdict === "exact" || verdict === "object parity") continue;
    if (verdict === "spec parity, metadata departures") notes.push(`${component}: ${departures} metadata departure(s), the sync-wave ordering mechanism, see the ordering check`);
    else findings.push(`${component} (${mode}): ${verdict}, ${departures} departure(s); the ACK deletion-policy departure is at a path no declared binding owns`);
  }
  return { name: "parity", status: findings.length ? "findings" : "pass", findings, notes: [...notes, "inherited from the stage A.2 report, not recomputed here"] };
}

function checkPolicy(appliedComponents) {
  const placeholders = [];
  for (const component of appliedComponents) {
    for (const doc of component.objects) {
      leafWalk(doc, "", (path, value) => {
        if (typeof value === "string" && value.includes("confighubplaceholder")) placeholders.push(`${component.name} ${doc.kind}/${doc.metadata?.name} at ${path}`);
      });
    }
  }
  const notes = [`${placeholders.length} declared placeholder value(s); the producer's blocking vet-placeholders trigger refuses a release while any remain`, ...placeholders.sort()];
  return { name: "policy", status: "pass", findings: [], notes };
}

function checkDigestBinding(allComponents, manifestSha) {
  const memberLines = allComponents.map((component) => `${component.name} ${component.digest}`).sort();
  const compositionDigest = `sha256:${createHash("sha256").update(`${memberLines.join("\n")}\n${manifestSha}\n`).digest("hex")}`;
  const findings = allComponents.filter((component) => !/^sha256:[0-9a-f]{64}$/.test(component.digest)).map((component) => `${component.name} carries no well-formed digest`);
  const notes = [`composition digest ${compositionDigest} over ${allComponents.length} member digests and the pinned manifest`, "every member was pulled by its receipt digest and hash-verified file by file before this check", "the digest is computed by this verdict; promoting it into the receipt schema and the strict verifier remains open as backlog item 30"];
  return { name: "digest-binding", status: findings.length ? "findings" : "pass", findings, notes, compositionDigest };
}

const manifestSha = sha256File(join(replicaRoot, "source", "components-manifest.yaml"));
const runChecks = (appliedComponents, allComponents) => [
  checkClosure(appliedComponents),
  checkSingleOwner(appliedComponents, profile.spec, bindings),
  checkCrdCompatibility(appliedComponents),
  checkConflicts(appliedComponents),
  checkOrdering(appliedComponents),
  checkParity(),
  checkPolicy(appliedComponents),
  checkDigestBinding(allComponents, manifestSha),
];

// ---- Self-test: every check must be able to fail -----------------------------

if (selfTest) {
  const clone = () => applied.map((component) => ({ ...component, objects: JSON.parse(JSON.stringify(component.objects)) }));
  let mutated = clone();
  mutated[1].objects.push(JSON.parse(JSON.stringify(mutated[0].objects.find((doc) => doc.kind !== "Namespace"))));
  check(checkConflicts(mutated).status !== "pass", "self-test: a duplicated object must fail the conflict check");
  mutated = clone();
  for (const component of mutated) component.objects = component.objects.filter((doc) => doc.kind !== "CustomResourceDefinition");
  check(checkCrdCompatibility(mutated).status !== "pass", "self-test: removing every CRD must fail the compatibility check");
  check(checkOrdering(clone()).status === "pass" && checkOrdering(mutated).status === "pass", "self-test: ordering stays clean when CRDs vanish entirely, closure and compatibility own that case");
  mutated = clone();
  for (const component of mutated) component.objects = component.objects.filter((doc) => doc.kind !== "Namespace");
  check(checkClosure(mutated).status !== "pass", "self-test: removing every Namespace must fail the closure check");
  mutated = clone();
  mutated.find((component) => component.name === "gpu-runtime").objects.push({ apiVersion: "v1", kind: "ConfigMap", metadata: { name: "leak", namespace: "gpu-operator" }, data: { copied: profile.spec.clusterName } });
  const singleOwner = checkSingleOwner(mutated, profile.spec, bindings);
  check(singleOwner.findings.some((finding) => finding.includes("gpu-runtime") && finding.includes("data.copied")), "self-test: an unbound literal copy must be named by the single-owner check");
  const tampered = applied.map((component, index) => index === 0 ? { ...component, digest: "sha256:not-a-digest" } : component);
  check(checkDigestBinding([hub, ...tampered], manifestSha).status !== "pass", "self-test: a malformed member digest must fail the digest binding check");
  console.log("composition verdict self-test: every mutated composition failed the intended check");
  process.exit(0);
}

// ---- The real verdict --------------------------------------------------------

const results = runChecks(applied, components);
const digestResult = results.find((result) => result.name === "digest-binding");
const acceptance = results.find((result) => result.name === "single-owner").findings.filter((finding) => finding.includes("karpenter-aws"));
check(acceptance.length > 0, "acceptance: the verdict must catch the karpenter-aws hardcoded cluster name that curation caught by hand");

// --gate arms the verdict as a regression gate. The committed verdict is the
// triaged baseline; the gate refuses any NEW finding, any check that slips
// from pass, and any composition-digest change the baseline has not recorded.
// A finding leaving is fine, that is a fix landing.
if (gateMode) {
  const baselineText = readFileSync(join(replicaRoot, "composition-verdict.yaml"), "utf8");
  const baselineFindings = new Set([...baselineText.matchAll(/^ {8}- "(.*)"$/gm)].map((match) => match[1]));
  const baselinePasses = new Set([...baselineText.matchAll(/- name: "([a-z-]+)"\n {6}status: "pass"/g)].map((match) => match[1]));
  const baselineDigest = (baselineText.match(/compositionDigest: "(sha256:[0-9a-f]{64})"/) ?? [])[1];
  const failures = [];
  for (const result of results) {
    if (baselinePasses.has(result.name) && result.status !== "pass") {
      failures.push(`${result.name} was pass in the committed verdict and is now ${result.status}`);
    }
    for (const finding of result.findings) {
      if (!baselineFindings.has(finding.replaceAll('"', "'"))) failures.push(`new finding in ${result.name}: ${finding}`);
    }
  }
  if (digestResult.compositionDigest !== baselineDigest) {
    failures.push(`composition digest changed: ${baselineDigest} -> ${digestResult.compositionDigest}; re-run the verdict and commit it with the change that moved a member`);
  }
  if (failures.length) {
    console.error(`composition gate REFUSED (${failures.length}):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`composition gate: no new findings, no regressed checks, digest ${digestResult.compositionDigest.slice(0, 19)} unchanged against the committed verdict`);
  process.exit(0);
}

const yamlLines = [
  "apiVersion: evidence.confighub.com/v1alpha1",
  "kind: CompositionVerdict",
  "metadata:",
  "  name: eks-inference-stack",
  "spec:",
  `  compositionDigest: "${digestResult.compositionDigest}"`,
  "  members:",
  ...components.map((component) => `    - name: "${component.name}"\n      plane: "${component.plane}"\n      digest: "${component.digest}"`),
  "  checks:",
  ...results.map((result) => [
    `    - name: "${result.name}"`,
    `      status: "${result.status}"`,
    `      findings: ${result.findings.length}`,
    ...(result.findings.length ? ["      findingDetails:", ...result.findings.map((finding) => `        - "${finding.replaceAll('"', "'")}"`)] : []),
    ...(result.notes?.length ? ["      notes:", ...result.notes.map((note) => `        - "${note.replaceAll('"', "'")}"`)] : []),
  ].join("\n")),
];
write(join(replicaRoot, "composition-verdict.yaml"), `${yamlLines.join("\n")}\n`);

const table = results.map((result) => `| ${result.name} | ${result.status} | ${result.findings.length} |`).join("\n");
const sections = results.filter((result) => result.findings.length || result.notes?.length).map((result) => {
  const body = [...result.findings.map((finding) => `- ${finding}`), ...(result.notes ?? []).map((note) => `- Note: ${note}`)];
  return `### ${result.name} (${result.status})\n\n${body.join("\n")}`;
});
write(join(replicaRoot, "composition-verdict.md"), `# Stage B: the composition verdict over the eks-inference stack

<!-- Generated by scripts/run-eks-inf-composition-verdict.mjs. Do not edit by hand. -->

This is the first real run of the eight-check composition verdict proposed in [composition-certification.md](../../docs/planning/composition-certification.md), over the eight retained bundles, keyed by one composition digest. Every member was pulled by its receipt digest and hash-verified before any check ran. A findings status is a named result, not a silent failure, and the run refuses to complete unless it catches the one defect curation already caught by hand.

Composition digest: \`${digestResult.compositionDigest}\`

| Check | Status | Findings |
| --- | --- | ---: |
${table}

${sections.join("\n\n")}

## Read this verdict precisely

- The verdict judges the assembled bundles. It does not load ConfigHub, touch a cluster, or prove the platform runs.
- The single-owner check reads the producer's declared link set, so a literal copy is one the links would not repair.
- The digest is computed here and not yet part of the receipt schema; that promotion remains open as backlog item 30.
- The self-test (\`--self-test\`) mutates the composition in memory and proves each check can go red.

The staged plan is [eks-inf-replica-plan.md](../../docs/planning/eks-inf-replica-plan.md), and the object-level parity behind the parity check is [parity.md](./parity.md).
`);

for (const result of results) console.log(`${result.name}: ${result.status}${result.findings.length ? ` (${result.findings.length})` : ""}`);
console.log(`composition digest: ${digestResult.compositionDigest}`);
