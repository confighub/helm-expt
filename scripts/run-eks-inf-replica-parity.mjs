// Stage A.2 of the eks-inf replica experiment: rebuild the rendered components
// from their certified catalog inputs and compare them with the retained stack
// bundles at the object level. Select the literal components by digest and
// verify them byte for byte.
//
//   in:  data/certified-bundles/receipts.csv                 (bundle registry)
//        data/certified-bundles/receipts/**/receipt.yaml     (file hashes, paths)
//        packages/**/bases/eks-inference/upstream.yaml       (committed catalog renders)
//        ghcr.io/confighub/configs/eks-inference/*           (anonymous pulls, by digest)
//   out: data/eks-inf-replica/parity.csv
//        data/eks-inf-replica/parity.md
//
// The pulls are pinned by manifest digest, so the run is deterministic. A
// departure between the catalog rebuild and the retained bundle is a finding,
// not a failure: it names what the hand build knows that the Catalog does not
// yet encode. Integrity failures are failures: a retained bundle must match
// its own receipt exactly.

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, command, canonicalObjectMaps, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const registryPath = join(repoRoot, "data", "certified-bundles", "receipts.csv");
const stackReceiptsRoot = join(repoRoot, "data", "certified-bundles", "receipts", "eks-inference");
const catalogReceiptsRoot = join(repoRoot, "data", "certified-bundles", "receipts", "catalog");
const parityCsvPath = join(repoRoot, "data", "eks-inf-replica", "parity.csv");
const parityMdPath = join(repoRoot, "data", "eks-inf-replica", "parity.md");

const registryRows = readFileSync(registryPath, "utf8").trim().split("\n").slice(1).map((line) => line.split(","));
const stackRows = registryRows.filter((cells) => cells[0] === "eks-inference").map((cells) => ({
  name: cells[1].replace(/^eks-inference-/, ""),
  contentsKind: cells[3],
  digest: cells[6],
  ociReference: cells[10],
}));
check(stackRows.length === 8, "the registry must carry exactly eight eks-inference stack bundles");

const sourceLocksOf = (receipt) => (receipt.spec.source.evidence ?? []).filter((path) => /^recipes\/.*\/source-lock\.yaml$/.test(path));
const bundleFilesOf = (receipt) => receipt.spec.bundle.files.filter((file) => !file.role);
const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

const catalogReceipts = readdirSync(catalogReceiptsRoot)
  .filter((dir) => dir.endsWith("-eks-inference"))
  .map((dir) => readYaml(join(catalogReceiptsRoot, dir, "receipt.yaml")));

const workRoot = mkdtempSync(join(tmpdir(), "eks-inf-replica-"));
const results = [];
for (const row of stackRows) {
  const receipt = readYaml(join(stackReceiptsRoot, row.name, "receipt.yaml"));
  const pinnedRef = `${row.ociReference.replace(/:latest$/, "")}@${receipt.spec.bundle.manifestDigest}`;
  const pullRoot = join(workRoot, `${row.name}-pull`);
  command("oras", ["pull", pinnedRef, "-o", pullRoot]);

  // The bundle layer is a tarball; the receipt hashes the files inside it.
  const pullDir = join(workRoot, row.name);
  const tarball = readdirSync(pullRoot).find((name) => name.endsWith(".tar.gz") || name.endsWith(".tgz"));
  if (tarball) {
    command("mkdir", ["-p", pullDir]);
    command("tar", ["-xzf", join(pullRoot, tarball), "-C", pullDir]);
  } else {
    command("cp", ["-R", `${pullRoot}/`, pullDir]);
  }

  // Integrity: every config file the receipt names must exist in the pull with
  // the recorded hash. Companion evidence entries carry a role and stay in-repo.
  const expected = bundleFilesOf(receipt);
  const integrityFailures = [];
  for (const file of expected) {
    const pulled = join(pullDir, file.path);
    let ok = false;
    try {
      ok = statSync(pulled).isFile() && sha256File(pulled) === file.sha256;
    } catch {
      ok = false;
    }
    if (!ok) integrityFailures.push(file.path);
  }
  check(integrityFailures.length === 0, `${row.name}: pulled bundle does not match its receipt: ${integrityFailures.join(", ")}`);

  if (row.contentsKind !== "rendered-config") {
    results.push({ name: row.name, mode: "select-by-digest", files: expected.length, verdict: "exact", detail: [] });
    continue;
  }

  // Rebuild side: the committed rendered object sets of every catalog variant
  // sharing a source lock with this component.
  const locks = sourceLocksOf(receipt);
  const inputs = catalogReceipts.filter((candidate) => sourceLocksOf(candidate).some((lock) => locks.includes(lock)));
  check(inputs.length > 0, `${row.name}: no catalog inputs share a source lock`);
  const catalogYaml = inputs
    .flatMap((input) => input.spec.bundle.files.filter((file) => file.role === "rendered object set"))
    .map((file) => readFileSync(join(repoRoot, file.path), "utf8"))
    .join("\n---\n");
  const stackYaml = expected.map((file) => readFileSync(join(pullDir, file.path), "utf8")).join("\n---\n");

  const maps = canonicalObjectMaps(catalogYaml, stackYaml);
  const catalogMap = maps.helm;
  const stackMap = maps.cub;
  const catalogKeys = Object.keys(catalogMap);
  const stackKeys = Object.keys(stackMap);
  const matched = stackKeys.filter((key) => catalogMap[key] === stackMap[key]);
  const differing = stackKeys.filter((key) => key in catalogMap && catalogMap[key] !== stackMap[key]);
  const onlyStack = stackKeys.filter((key) => !(key in catalogMap));
  const onlyCatalog = catalogKeys.filter((key) => !(key in stackMap));
  const describeSection = (section, left, right) => {
    if (section !== "metadata") return section;
    const leftMeta = left.metadata ?? {};
    const rightMeta = right.metadata ?? {};
    const parts = [...new Set([...Object.keys(leftMeta), ...Object.keys(rightMeta)])]
      .filter((field) => JSON.stringify(leftMeta[field]) !== JSON.stringify(rightMeta[field]))
      .sort()
      .map((field) => {
        const leftMap = leftMeta[field];
        const rightMap = rightMeta[field];
        if (typeof leftMap === "object" || typeof rightMap === "object") {
          const keys = [...new Set([...Object.keys(leftMap ?? {}), ...Object.keys(rightMap ?? {})])]
            .filter((mapKey) => JSON.stringify((leftMap ?? {})[mapKey]) !== JSON.stringify((rightMap ?? {})[mapKey]))
            .sort();
          return `metadata.${field}{${keys.join(" ")}}`;
        }
        return `metadata.${field}`;
      });
    return parts.join("+");
  };
  // Leaf-level paths for anything outside metadata; arrays of named objects
  // (env, containers, ports) are keyed by name so the path stays readable.
  const leafDiffs = (left, right, path, out) => {
    if (JSON.stringify(left) === JSON.stringify(right)) return;
    if (Array.isArray(left) && Array.isArray(right) && [...left, ...right].every((item) => item && typeof item === "object" && typeof item.name === "string")) {
      const names = [...new Set([...left, ...right].map((item) => item.name))];
      for (const name of names) leafDiffs(left.find((item) => item.name === name), right.find((item) => item.name === name), `${path}[${name}]`, out);
      return;
    }
    if (left && right && typeof left === "object" && typeof right === "object" && !Array.isArray(left) && !Array.isArray(right)) {
      for (const field of new Set([...Object.keys(left), ...Object.keys(right)])) leafDiffs(left[field], right[field], `${path}.${field}`, out);
      return;
    }
    out.push(`${path}: ${JSON.stringify(left)} -> ${JSON.stringify(right)}`);
  };
  const differingSections = differing.map((key) => {
    const left = JSON.parse(catalogMap[key]);
    const right = JSON.parse(stackMap[key]);
    const sections = [...new Set([...Object.keys(left), ...Object.keys(right)])]
      .filter((section) => JSON.stringify(left[section]) !== JSON.stringify(right[section]))
      .sort()
      .map((section) => describeSection(section, left, right));
    const leaves = [];
    for (const section of Object.keys(left).filter((section) => section !== "metadata")) {
      if (JSON.stringify(left[section]) !== JSON.stringify(right[section])) leafDiffs(left[section], right[section], section, leaves);
    }
    return { key, sections, leaves };
  });
  const specParity = differingSections.every(({ sections }) => sections.every((section) => section.startsWith("metadata")));
  const classCounts = new Map();
  for (const { sections } of differingSections) {
    const label = sections.join("+");
    classCounts.set(label, (classCounts.get(label) ?? 0) + 1);
  }
  results.push({
    name: row.name,
    mode: "rebuild-from-catalog",
    inputs: inputs.map((input) => input.metadata.name),
    stackObjects: stackKeys.length,
    catalogObjects: catalogKeys.length,
    matched: matched.length,
    specParity,
    classCounts: [...classCounts.entries()].sort((a, b) => b[1] - a[1]),
    verdict: differing.length === 0 && onlyStack.length === 0 && onlyCatalog.length === 0 ? "object parity" : specParity ? "spec parity, metadata departures" : "departures",
    detail: [
      ...differingSections.map(({ key, sections, leaves }) => `differs ${key} at ${sections.join("+")}${leaves.length ? ` (${leaves.slice(0, 4).join("; ")}${leaves.length > 4 ? `; and ${leaves.length - 4} more` : ""})` : ""}`),
      ...onlyStack.map((key) => `only-in-stack ${key}`),
      ...onlyCatalog.map((key) => `only-in-catalog ${key}`),
    ],
  });
}
rmSync(workRoot, { recursive: true, force: true });

const rendered = results.filter((row) => row.mode === "rebuild-from-catalog");
const literal = results.filter((row) => row.mode === "select-by-digest");
check(literal.length === 5 && literal.every((row) => row.verdict === "exact"), "all five literal components must verify exactly");
check(rendered.length === 3, "three rendered components must be compared");

const csvHeader = "component,mode,stack_objects,catalog_objects,matched,departures,verdict";
const csvLines = results.map((row) => [
  row.name, row.mode, row.stackObjects ?? "", row.catalogObjects ?? "", row.matched ?? "", (row.detail ?? []).length, row.verdict,
].join(","));
write(parityCsvPath, `${csvHeader}\n${csvLines.join("\n")}\n`);

const sections = rendered.map((row) => {
  const classTable = row.classCounts.length === 0 ? "" : `\nDeparture classes:\n\n| Class | Objects |\n| --- | ---: |\n${row.classCounts.map(([label, count]) => `| \`${label}\` | ${count} |`).join("\n")}\n`;
  const lines = row.detail.length === 0 ? ["Object parity: every object in the retained bundle matches the catalog rebuild exactly."] : row.detail.map((item) => `- ${item}`);
  return `### ${row.name}\n\nCatalog inputs: ${row.inputs.join(", ")}. Retained bundle: ${row.stackObjects} object(s). Catalog rebuild: ${row.catalogObjects} object(s). Canonical matches: ${row.matched}. Spec parity: ${row.specParity ? "yes, every difference stays inside metadata" : "no, at least one object differs outside metadata"}.\n${classTable}\n${lines.join("\n")}`;
});
write(parityMdPath, `# Stage A.2: object parity between the catalog rebuild and the retained stack

<!-- Generated by scripts/run-eks-inf-replica-parity.mjs. Do not edit by hand. -->

Every bundle was pulled anonymously from its public registry, pinned by the manifest digest in its receipt, and verified file by file against the receipt before any comparison ran. The five literal components verify exactly, which is their whole claim. The three rendered components are compared object by object below: the retained bundle against a rebuild from the certified catalog variants that share its source lock.

A departure is a finding, not a failure. It names what the hand-built platform knows that the Catalog does not yet encode, and each one is a candidate catalog intake or variant revision.

${sections.join("\n\n")}

## Read the verdicts precisely

- exact for a literal component means byte identity with the receipt, nothing more.
- object parity means every canonical object matches; only-in-stack objects are authored additions the chart never rendered; a differs line names the object and the sections that changed.
- Nothing here loads ConfigHub, touches a cluster, or claims the composition is coherent. The composition verdict is stage B.

The closure map behind this comparison is in [summary.md](./summary.md), and the staged plan is [eks-inf-replica-plan.md](../../docs/planning/eks-inf-replica-plan.md).
`);

for (const row of results) console.log(`${row.name}: ${row.verdict}${row.detail?.length ? ` (${row.detail.length} departure(s))` : ""}`);
console.log(`parity written for ${results.length} component(s): ${rendered.length} rebuilt, ${literal.length} selected`);
