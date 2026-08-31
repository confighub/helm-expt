// Stage C of the eks-inf replica experiment: rebuild the ConfigHub
// organization with the generic surface and compare it with the plugin's own
// build, shape by shape.
//
// The run is phased, one phase per invocation, so every mutation stays a
// deliberate step:
//
//   --capture <label>   read-only: dump the org shape to data/eks-inf-replica/
//                       org-rebuild/shape-<label>.yaml (spaces, labels, units,
//                       data hashes, links, triggers, targets, releases)
//   --teardown          delete the stack's Spaces (bases, sandboxes, cluster
//                       spaces); leaves everything else in the org alone
//   --rebuild           build the same organization from committed snapshots
//                       only, with generic verbs: variant upload, variant
//                       create, link create, release publish
//   --compare           diff two captured shapes into comparison.md
//
// Everything runs against the currently authenticated ConfigHub, expected to
// be a disposable self-hosted server. The capture records which server and
// organization it read, so the evidence cannot silently claim another org.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { check, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const outRoot = join(repoRoot, "data", "eks-inf-replica", "org-rebuild");
const manifest = readYaml(join(repoRoot, "data", "eks-inf-replica", "source", "components-manifest.yaml"));
const componentNames = manifest.components.map((component) => component.name);

const cub = (...args) => execFileSync("cub", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const cubJson = (...args) => JSON.parse(cub(...args, "-o", "json"));
const sha = (text) => createHash("sha256").update(text).digest("hex");

const mode = process.argv[2];
const label = process.argv[3];

const stackSpaceOf = (slug) => {
  if (componentNames.some((name) => slug === `${name}-base` || slug === `${name}-sandbox`)) return true;
  return /^sandbox-(mgmt|workload)(-argo-apps)?$/.test(slug);
};

function captureShape() {
  const who = cub("auth", "status");
  const organization = (who.match(/Organization Name\s+(\S.*?)\s*$/m) ?? [])[1] ?? "unknown";
  const spaces = cubJson("space", "list").map((entry) => entry.Space ?? entry).filter((space) => stackSpaceOf(space.Slug));
  const shape = { organization, spaces: [] };
  for (const space of spaces.sort((a, b) => a.Slug.localeCompare(b.Slug))) {
    const units = cubJson("unit", "list", "--space", space.Slug).map((entry) => entry.Unit ?? entry);
    const unitRows = units.sort((a, b) => a.Slug.localeCompare(b.Slug)).map((unit) => {
      const data = cub("unit", "data", unit.Slug, "--space", space.Slug);
      return {
        slug: unit.Slug,
        dataSha256: sha(data),
        // Generated Application units are small; keeping their text lets the
        // comparison name a field-level difference instead of "data differs".
        ...(space.Slug.endsWith("-argo-apps") ? { data } : {}),
        upstream: unit.UpstreamUnitID ? "linked-upstream" : "none",
        applyGates: Object.keys(unit.ApplyGates ?? {}).sort(),
      };
    });
    let links = [];
    try {
      links = cubJson("link", "list", "--space", space.Slug).map((entry) => entry.Link ?? entry)
        .map((link) => ({
          slug: link.Slug,
          from: link.FromUnitID ? "unit" : "unknown",
          toSpace: link.ToSpaceID === space.SpaceID ? "same-space" : "cross-space",
        }));
    } catch {
      links = [{ slug: "link-list-unavailable" }];
    }
    let triggers = [];
    try {
      triggers = cubJson("trigger", "list", "--space", space.Slug).map((entry) => (entry.Trigger ?? entry).Slug).sort();
    } catch { triggers = ["trigger-list-unavailable"]; }
    let releases = [];
    try {
      releases = cubJson("release", "list", "--space", space.Slug).map((entry) => {
        const release = entry.Release ?? entry;
        return { units: release.UnitCount ?? (release.Units?.length ?? "unknown") };
      });
    } catch { releases = []; }
    let targets = [];
    try {
      targets = cubJson("target", "list", "--space", space.Slug).map((entry) => (entry.Target ?? entry).Slug).sort();
    } catch { targets = []; }
    shape.spaces.push({
      slug: space.Slug,
      labels: Object.fromEntries(Object.entries(space.Labels ?? {}).sort()),
      units: unitRows,
      linkCount: links.length,
      links: links.map((link) => link.slug).sort(),
      triggers,
      releaseCount: releases.length,
      targets,
    });
  }
  return shape;
}

const toYaml = (value, indent = 0) => {
  const pad = "  ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value.map((item) => typeof item === "object" && item !== null
      ? `${pad}-\n${toYaml(item, indent + 1)}`
      : `${pad}- ${JSON.stringify(item)}`).join("\n");
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).map(([key, child]) => typeof child === "object" && child !== null
      ? `${pad}${key}:\n${toYaml(child, indent + 1)}`
      : `${pad}${key}: ${JSON.stringify(child)}`).join("\n");
  }
  return `${pad}${JSON.stringify(value)}`;
};

if (mode === "--capture") {
  check(Boolean(label), "usage: --capture <label>");
  mkdirSync(outRoot, { recursive: true });
  const shape = captureShape();
  write(join(outRoot, `shape-${label}.yaml`), `# Captured org shape, label ${label}.\n${toYaml(shape)}\n`);
  console.log(`captured ${shape.spaces.length} stack space(s) from organization "${shape.organization}" as shape-${label}`);
  process.exit(0);
}

if (mode === "--teardown") {
  const spaces = cubJson("space", "list").map((entry) => (entry.Space ?? entry).Slug).filter(stackSpaceOf);
  // References decide the order: component sandboxes point at the scaffolding
  // spaces' Targets, so the Target owners go last.
  const rank = (slug) => slug.endsWith("-argo-apps") ? 0 : slug.endsWith("-sandbox") ? 1 : /^sandbox-(mgmt|workload)$/.test(slug) ? 2 : 3;
  for (const slug of spaces.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) {
    cub("space", "delete", slug, "--recursive");
    console.log(`deleted ${slug}`);
  }
  console.log(`teardown complete: ${spaces.length} space(s) removed; everything else untouched`);
  process.exit(0);
}

if (mode === "--compare") {
  const left = process.argv[3];
  const right = process.argv[4];
  check(Boolean(left && right), "usage: --compare <label-a> <label-b>");
  const shapeA = readYaml(join(outRoot, `shape-${left}.yaml`));
  const shapeB = readYaml(join(outRoot, `shape-${right}.yaml`));
  const findings = [];
  const spacesA = new Map(shapeA.spaces.map((space) => [space.slug, space]));
  const spacesB = new Map(shapeB.spaces.map((space) => [space.slug, space]));
  for (const slug of new Set([...spacesA.keys(), ...spacesB.keys()])) {
    const a = spacesA.get(slug);
    const b = spacesB.get(slug);
    if (!a) { findings.push(`space ${slug} exists only in ${right}`); continue; }
    if (!b) { findings.push(`space ${slug} exists only in ${left}`); continue; }
    const unitsA = new Map(a.units.map((unit) => [unit.slug, unit]));
    const unitsB = new Map(b.units.map((unit) => [unit.slug, unit]));
    for (const unitSlug of new Set([...unitsA.keys(), ...unitsB.keys()])) {
      const unitA = unitsA.get(unitSlug);
      const unitB = unitsB.get(unitSlug);
      if (!unitA) { findings.push(`${slug}/${unitSlug} exists only in ${right}`); continue; }
      if (!unitB) { findings.push(`${slug}/${unitSlug} exists only in ${left}`); continue; }
      if (unitA.dataSha256 !== unitB.dataSha256) {
        if (unitA.data && unitB.data) {
          const linesA = String(unitA.data).split("\n");
          const linesB = String(unitB.data).split("\n");
          const onlyA = linesA.filter((line) => line.trim() && !linesB.includes(line)).slice(0, 3);
          const onlyB = linesB.filter((line) => line.trim() && !linesA.includes(line)).slice(0, 3);
          findings.push(`${slug}/${unitSlug} data differs: ${left} has [${onlyA.map((line) => line.trim()).join(" | ") || "reordering only"}], ${right} has [${onlyB.map((line) => line.trim()).join(" | ") || "reordering only"}]`);
        } else {
          findings.push(`${slug}/${unitSlug} data differs`);
        }
      }
      if (unitA.upstream !== unitB.upstream) findings.push(`${slug}/${unitSlug} upstream linkage differs (${unitA.upstream} vs ${unitB.upstream})`);
    }
    if (JSON.stringify(a.labels) !== JSON.stringify(b.labels)) findings.push(`${slug} labels differ: ${JSON.stringify(a.labels)} vs ${JSON.stringify(b.labels)}`);
    if (a.linkCount !== b.linkCount) findings.push(`${slug} link count differs (${a.linkCount} vs ${b.linkCount})`);
    if (JSON.stringify(a.triggers) !== JSON.stringify(b.triggers)) findings.push(`${slug} triggers differ`);
    if (a.releaseCount !== b.releaseCount) findings.push(`${slug} release count differs (${a.releaseCount} vs ${b.releaseCount})`);
    if (JSON.stringify(a.targets) !== JSON.stringify(b.targets)) findings.push(`${slug} targets differ`);
  }
  const verdict = findings.length === 0 ? "shape parity" : "departures";
  const spaceCount = new Set([...spacesA.keys(), ...spacesB.keys()]).size;
  const unitCount = shapeA.spaces.reduce((sum, space) => sum + space.units.length, 0);
  write(join(outRoot, "comparison.md"), `# Stage C: the plugin's organization against the generic rebuild

<!-- Generated by scripts/run-eks-inf-org-rebuild.mjs --compare. Do not edit by hand. -->

Two builds of the same organization on a disposable self-hosted ConfigHub server: shape \`${left}\` built by the producer's plugin (cub eksinf install, then sandbox up), and shape \`${right}\` built from the committed snapshots alone with generic verbs (variant upload, variant create, link create, release publish). The comparison covers ${spaceCount} stack space(s) and ${unitCount} unit(s): space labels, unit sets, unit data hashes, upstream linkage, link counts, triggers, release counts, and targets.

Verdict: **${verdict}**${findings.length ? ` (${findings.length})` : ""}.

${findings.length ? findings.map((finding) => `- ${finding}`).join("\n") : "Every compared dimension matches."}

## Read this comparison precisely

- Both shapes were captured with the same read-only dump on the same server, and each capture names the organization it read.
- Data equality is by unit-data hash, so it proves identical configuration content, not merely identical counts.
- The comparison covers organization shape. It does not prove either organization deploys, and it does not compare per-link path details beyond counts.
`);
  console.log(`compared ${spaceCount} space(s): ${verdict}${findings.length ? ` (${findings.length} departure(s))` : ""}`);
  findings.slice(0, 12).forEach((finding) => console.log(`- ${finding}`));
  process.exit(0);
}

if (mode === "--rebuild") {
  // Build the same organization from committed snapshots only, with generic
  // verbs. The argo-apps app-of-apps spaces are deliberately out of scope:
  // they are the plugin's deploy machinery, not catalog content.
  // The stack manifest is the single source for the declared link set.
  const bindings = readYaml(join(repoRoot, "examples", "cub-stack", "stacks", "eks-inference.yaml")).spec.bindings;
  const registry = readFileSync(join(repoRoot, "data", "certified-bundles", "receipts.csv"), "utf8").trim().split("\n").slice(1)
    .map((line) => line.split(","))
    .filter((cells) => cells[0] === "eks-inference")
    .map((cells) => ({ name: cells[1].replace(/^eks-inference-/, ""), digest: cells[6], ref: cells[10].replace(/:latest$/, "") }));

  console.log("== bases: variant upload from pinned digests ==");
  for (const component of manifest.components) {
    const row = registry.find((candidate) => candidate.name === component.name);
    cub("variant", "upload", "--component", component.name, "--variant", "base",
      "--granularity", "per-file", "--owner", "EKS Inference",
      "--label", "managed-by=eks-inference", `oci://${row.ref}@${row.digest}`);
    console.log(`  ${component.name}-base uploaded`);
  }

  console.log("== scaffolding: cluster spaces, workers, targets, apps spaces ==");
  for (const name of ["sandbox-mgmt", "sandbox-workload"]) {
    cub("space", "create", name, "--label", "Owner=EKS Inference", "--label", "Mode=sandbox");
    cub("worker", "create", "worker", "--space", name, "--is-server-worker");
    cub("target", "create", "target", "{}", "worker", "--space", name,
      "-p", "OCI", "-t", "Any",
      "--annotation", `confighub.com/argo-apps-space=${name}-argo-apps`);
    // The annotated target makes variant creation register each variant as an
    // Argo Application unit in this space; the server does that, not the plugin.
    cub("space", "create", `${name}-argo-apps`, "--label", "Owner=EKS Inference");
    cub("space", "update", `${name}-argo-apps`, "--patch", "--release-target", `${name}/target`);
    cub("trigger", "create", "no-placeholders", "Mutation", "Kubernetes/YAML", "vet-placeholders",
      "--space", name,
      "--description", "Blocks publishing a Release that still contains an unfilled confighubplaceholder value.");
    console.log(`  ${name}: space, worker, OCI target, placeholder trigger, ${name}-argo-apps releasing to it`);
  }

  console.log("== sandbox variants ==");
  cub("variant", "create", "sandbox", "platform-profile-base");
  console.log("  platform-profile-sandbox (no target; never deployed)");
  for (const component of manifest.components.filter((entry) => entry.plane !== "hub")) {
    const target = component.plane === "mgmt" ? "sandbox-mgmt/target" : "sandbox-workload/target";
    cub("variant", "create", "sandbox", `${component.name}-base`, "--target", target);
    console.log(`  ${component.name}-sandbox -> ${target}`);
  }

  console.log("== profile links from the bindings snapshot ==");
  const profileResource = { ResourceType: "eks-inference.confighub.com/v1/PlatformProfile", ResourceName: "/inference-demo" };
  const byUnit = new Map();
  for (const binding of bindings.pathBindings) {
    const key = `${binding.component}|${binding.unit}`;
    if (!byUnit.has(key)) byUnit.set(key, { paths: [], setters: [] });
    byUnit.get(key).paths.push(binding);
  }
  for (const binding of bindings.envBindings) {
    const key = `${binding.component}|${binding.unit}`;
    if (!byUnit.has(key)) byUnit.set(key, { paths: [], setters: [] });
    byUnit.get(key).setters.push(binding);
  }
  for (const [key, group] of [...byUnit.entries()].sort()) {
    const [component, unit] = key.split("|");
    // Mirrors the producer's payloadFor: upstream reads dedupe by field, every
    // downstream expression is {{.Params.<field>}}, and the escaped path form
    // is what cub link create requires.
    const upstreams = [];
    const seen = new Set();
    const addUpstream = (field, path) => {
      if (seen.has(field)) return;
      seen.add(field);
      upstreams.push({ Name: field, Path: path, Resource: profileResource });
    };
    for (const binding of group.paths) addUpstream(binding.field, binding.upstream);
    for (const binding of group.setters) addUpstream(binding.field, `spec.${binding.field}`);
    const payload = {
      UpstreamPaths: upstreams,
      DownstreamPaths: group.paths.map((binding) => ({
        Path: binding.pathEscaped,
        Resource: { ResourceType: binding.resourceType, ResourceName: binding.resourceName },
        Expression: `{{.Params.${binding.field}}}`,
        Evaluator: "template",
        Parameters: [binding.field],
        DataType: "string",
      })),
      DownstreamSetters: group.setters.map((binding) => ({
        Parameters: [binding.field],
        FunctionInvocation: {
          FunctionName: "set-env-var",
          WhereResource: "ConfigHub.ResourceType = 'apps/v1/Deployment'",
          Arguments: [
            { Value: binding.container },
            { Value: binding.envVar },
            { Value: `{{.Params.${binding.field}}}`, Evaluator: "template" },
          ],
        },
      })),
    };
    if (payload.DownstreamSetters.length === 0) delete payload.DownstreamSetters;
    if (payload.DownstreamPaths.length === 0) delete payload.DownstreamPaths;
    execFileSync("cub", ["link", "create", "--space", `${component}-sandbox`, "-", unit,
      "profile", "platform-profile-sandbox",
      "--update-type", "TransformPaths", "--auto-update", "--from-stdin"],
    { input: JSON.stringify(payload), encoding: "utf8" });
    cub("unit", "update", "--space", `${component}-sandbox`, "--patch", "--resolve", "Link:*", unit);
    console.log(`  ${component}-sandbox/${unit}: ${group.paths.length} path(s), ${group.setters.length} setter(s), resolved`);
  }

  console.log("== prune on the generated Applications, then republish the apps spaces ==");
  // The producer patches prune into each generated Application so that deleting
  // config deletes the resource it describes; this pairs with the ACK
  // controllers' deletionPolicy delete that the stage A.2 parity run surfaced.
  for (const component of manifest.components.filter((entry) => entry.plane !== "hub")) {
    const appsSpace = component.plane === "mgmt" ? "sandbox-mgmt-argo-apps" : "sandbox-workload-argo-apps";
    cub("function", "do", "--quiet", "--space", appsSpace, "--unit", `${component.name}-sandbox`,
      "set-bool-path", "argoproj.io/v1alpha1/Application", "spec.syncPolicy.automated.prune", "true");
  }
  for (const appsSpace of ["sandbox-mgmt-argo-apps", "sandbox-workload-argo-apps"]) {
    cub("release", "publish", appsSpace);
    console.log(`  ${appsSpace}: prune patched, republished`);
  }

  console.log("== releases ==");
  for (const component of manifest.components.filter((entry) => entry.plane !== "hub")) {
    cub("release", "publish", `${component.name}-sandbox`);
    console.log(`  ${component.name}-sandbox: published`);
  }
  console.log("rebuild complete from committed snapshots; the server itself populated the argo-apps spaces when the target-bound variants were created");
  process.exit(0);
}

check(false, "usage: run-eks-inf-org-rebuild.mjs --capture <label> | --teardown | --rebuild | --compare <a> <b>");
