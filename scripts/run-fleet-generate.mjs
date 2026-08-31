// The fleet generator: composition times placement times history.
//
// A stack manifest says what a platform is made of. The fleet manifest says
// where each stack or app lands, the layer the stack manifest deliberately
// leaves out. And the attention states a fleet view shows, pending changes,
// variants behind their base, blocked releases, rollouts in flight, are not
// composition at all: they are the residue of operations, so the generator
// replays the ladder to produce them. This driver runs all three layers from
// declared data against a disposable ConfigHub organization.
//
//   --scaffold   cluster spaces from the fleet manifest: a Space, a server
//                worker, and an OCI target per cluster, skipping any cluster
//                that already has a target (a real one wired by cub cluster up)
//   --build      one base Space per placed component: variant upload of the
//                stack's render or authored file, or the placement's app
//   --place      one deployment variant per component per placed cluster,
//                then a release per deployment Space
//   --age        the history layer: edits after release (pending changes), a
//                base advanced after placement (upgrades available), one
//                approval gate armed with the clone's WhereTrigger fix, and
//                one ChangeOrder opened across a promotion
//   --capture    read-only: recompute the four attention tiles from fleet
//                queries and write the receipt to data/fleet-slice/
//   --down       delete everything the fleet manifest names, deployments
//                before the target-owning cluster Spaces
//
// The receipt's point: the numbers a fleet view renders are reproduced here
// from the same queries, over an organization this generator manufactured
// from committed manifests.

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { check, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const cub = (...args) => execFileSync("cub", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const mode = process.argv[2];
const fleet = readYaml(join(repoRoot, "examples", "cub-stack", "fleets", "meridian-slice.yaml"));
const clusters = fleet.spec.clusters;
const clusterNames = clusters.map((cluster) => cluster.name);

// Resolve every placement to components with a local source file the upload
// path can take. Stack placements expand through the stack manifest's render
// or authored components; app placements are single authored components.
function resolvedPlacements() {
  const placements = [];
  for (const placement of fleet.spec.placements) {
    const placedClusters = placement.clusters.includes("*") ? clusterNames : placement.clusters;
    for (const name of placedClusters) check(clusterNames.includes(name), `placement names unknown cluster ${name}`);
    if (placement.stack) {
      const stack = readYaml(join(repoRoot, "examples", "cub-stack", "stacks", `${placement.stack}.yaml`));
      for (const component of stack.spec.components) {
        const source = component.render ?? component.authored;
        check(Boolean(source), `stack ${placement.stack} component ${component.name} has no local source; the fleet generator places render or authored components`);
        placements.push({ component: component.name, source, clusters: placedClusters });
      }
    } else {
      placements.push({ component: placement.app, source: placement.authored, clusters: placedClusters });
    }
  }
  return placements;
}

if (mode === "--scaffold") {
  for (const cluster of clusters) {
    let spaceExists = false;
    try { cub("space", "get", cluster.name, "-o", "name"); spaceExists = true; } catch { spaceExists = false; }
    if (spaceExists) { console.log(`  ${cluster.name}: already scaffolded${cluster.real ? " (real cluster via cub cluster up)" : ""}, left as is`); continue; }
    cub("space", "create", cluster.name, "--label", "Owner=Meridian Slice");
    cub("worker", "create", "worker", "--space", cluster.name, "--is-server-worker");
    cub("target", "create", "target", "{}", "worker", "--space", cluster.name, "-p", "OCI", "-t", "Any");
    console.log(`  ${cluster.name}: sandbox cluster space, worker, OCI target`);
  }
  process.exit(0);
}

if (mode === "--build") {
  const built = new Set();
  for (const placement of resolvedPlacements()) {
    if (built.has(placement.component)) continue;
    built.add(placement.component);
    cub("variant", "upload", "--component", placement.component, "--variant", "base",
      "--granularity", "per-resource", "--owner", "Meridian Slice", join(repoRoot, placement.source));
    console.log(`  ${placement.component}-base uploaded (per-resource)`);
  }
  process.exit(0);
}

if (mode === "--place") {
  for (const placement of resolvedPlacements()) {
    for (const cluster of placement.clusters) {
      cub("variant", "create", cluster, `${placement.component}-base`, "--target", `${cluster}/target`);
      cub("release", "publish", `${placement.component}-${cluster}`);
      console.log(`  ${placement.component} -> ${cluster}: placed and released`);
    }
  }
  process.exit(0);
}

if (mode === "--age") {
  // Pending changes: edits after release, never republished.
  cub("function", "do", "--space", "shop-web-eu-dev1", "--unit", "shop-web-deployment-shop-web",
    "set-replicas", "3", "--change-desc", "Aging: scale shop-web in eu-dev1 after its release");
  cub("function", "do", "--space", "traefik-eu-payments-dev1", "--where", "Slug LIKE '%deployment%'",
    "set-annotation", "meridian.example/reviewed", "pending", "--change-desc", "Aging: annotate traefik in eu-payments after its release");
  console.log("  aged: edits after release in two deployment spaces (pending changes)");

  // Upgrades available: the base advances after every variant was cloned.
  cub("function", "do", "--space", "cert-manager-base", "--where", "Slug LIKE '%deployment%'",
    "set-annotation", "meridian.example/base-rev", "2", "--change-desc", "Aging: advance the cert-manager base after placement");
  console.log("  aged: cert-manager base advanced (upgrades available across its fleet)");

  // A blocking gate, with the WhereTrigger fix a clone needs.
  cub("trigger", "create", "require-approval", "Mutation", "Kubernetes/YAML", "vet-approvedby", "1", "--space", "metrics-server-eu-payments-dev1");
  const spaceId = JSON.parse(cub("space", "get", "metrics-server-eu-payments-dev1", "-o", "json")).Space?.SpaceID;
  cub("space", "update", "--patch", "metrics-server-eu-payments-dev1", "--where-trigger", `SpaceID='${spaceId}'`, "--refresh-triggers");
  cub("function", "do", "--space", "metrics-server-eu-payments-dev1", "--where", "Slug LIKE '%deployment%'",
    "set-annotation", "meridian.example/hardening", "requested", "--change-desc", "Aging: a gated change awaiting approval");
  console.log("  aged: approval gate armed and holding in metrics-server-eu-payments-dev1");

  // A ChangeOrder in flight: it names the fleet spaces the change is headed
  // for, the change lands on the base, and promotion is still pending, which
  // is exactly a rollout in progress.
  cub("changeorder", "create", "meridian-traefik-rollout", "--space", "traefik-base",
    "--in-scope-space", "traefik-ap-dev1,traefik-eu-dev1,traefik-eu-payments-dev1",
    "--description", "Roll the traefik wave-1 change across all three regional clusters.");
  cub("function", "do", "--space", "traefik-base", "--where", "Slug LIKE '%deployment%'",
    "set-annotation", "meridian.example/rollout", "wave-1", "--change-desc", "Aging: the change the ChangeOrder rolls across the fleet");
  console.log("  aged: ChangeOrder meridian-traefik-rollout opened, scoped to the three traefik deployments");
  process.exit(0);
}

if (mode === "--capture") {
  const who = cub("auth", "status");
  const organization = (who.match(/Organization Name\s+(\S.*?)\s*$/m) ?? [])[1] ?? "unknown";
  const names = (out) => out.trim().split("\n").filter(Boolean);
  // Pending deployment means a deployment Space is ahead of its release;
  // bases are never released, so they stay out of this tile by definition.
  const unreleased = names(cub("unit", "list", "--space", "*", "--where", "HeadRevisionNum > LastReleasedRevisionNum", "-o", "name"))
    .filter((line) => clusterOwned(line) && !line.split("/")[0].endsWith("-base"));
  const upgrades = names(cub("unit", "list", "--space", "*", "--where", "UpstreamRevisionNum < UpstreamUnit.HeadRevisionNum", "-o", "name"))
    .filter((line) => clusterOwned(line));
  const gated = names(cub("unit", "list", "--space", "*", "--where", "LEN(ApplyGates) > 0", "-o", "name"))
    .filter((line) => clusterOwned(line));
  const changeOrders = names(cub("changeorder", "list", "--space", "traefik-base", "-o", "name"));
  function clusterOwned(line) {
    const space = line.split("/")[0];
    return clusterNames.some((name) => space.endsWith(`-${name}`)) || space.endsWith("-base");
  }
  // The one real cluster's controller view, when its kind context exists.
  let liveRows = [];
  try {
    const kubeconfig = join(process.env.HOME ?? "", ".confighub", "clusters", "ap-dev1.kubeconfig");
    const apps = JSON.parse(execFileSync("kubectl", ["get", "applications", "-n", "argocd", "-o", "json"], { encoding: "utf8", env: { ...process.env, KUBECONFIG: kubeconfig } }));
    liveRows = apps.items.map((app) => `${app.metadata.name}: ${app.status?.sync?.status ?? "?"} / ${app.status?.health?.status ?? "?"}`).sort();
  } catch { liveRows = []; }

  check(unreleased.length > 0, "acceptance: aging must leave pending changes");
  check(upgrades.length > 0, "acceptance: the advanced base must leave variants behind it");
  check(gated.length > 0, "acceptance: the armed gate must hold at least one unit");
  check(changeOrders.length > 0, "acceptance: one ChangeOrder must be in flight");

  write(join(repoRoot, "data", "fleet-slice", "receipt.yaml"), [
    "apiVersion: evidence.confighub.com/v1alpha1",
    "kind: FleetSliceReceipt",
    "metadata:",
    "  name: meridian-slice",
    "spec:",
    `  organization: "${organization}"`,
    '  fleetManifest: "examples/cub-stack/fleets/meridian-slice.yaml"',
    `  clusters: [${clusterNames.map((name) => `"${name}"`).join(", ")}]`,
    "  attentionTiles:",
    `    blockingGates: ${gated.length}`,
    `    unreleasedChanges: ${unreleased.length}`,
    `    upgradesAvailable: ${upgrades.length}`,
    `    outstandingRollouts: ${changeOrders.length}`,
    "  detail:",
    "    gated:",
    ...gated.map((line) => `      - "${line}"`),
    "    unreleased:",
    ...unreleased.map((line) => `      - "${line}"`),
    "    upgradesAvailable:",
    ...upgrades.map((line) => `      - "${line}"`),
    "    changeOrders:",
    ...changeOrders.map((line) => `      - "${line}"`),
    ...(liveRows.length ? ["  liveCluster:", '    name: "ap-dev1"', "    argoApplications:", ...liveRows.map((row) => `      - "${row}"`)] : []),
    "  boundaries:",
    '    - "One cluster is real and reconciles through cub cluster up; the others are sandbox scaffolding, desired state only."',
    '    - "The live rows are what Argo reported at capture time; convergence was not awaited, so an OutOfSync there is an observation, not a failure."',
    '    - "The tiles are recomputed from the same fleet queries a components view renders; this receipt does not read any GUI."',
    '    - "The organization is the disposable self-hosted server named above, and the run tears down what it made."',
  ].join("\n") + "\n");
  console.log(`receipt: gates=${gated.length} unreleased=${unreleased.length} upgrades=${upgrades.length} rollouts=${changeOrders.length} on "${organization}"`);
  process.exit(0);
}

if (mode === "--down") {
  const deployments = [];
  const bases = new Set();
  for (const placement of resolvedPlacements()) {
    bases.add(`${placement.component}-base`);
    for (const cluster of placement.clusters) deployments.push(`${placement.component}-${cluster}`);
  }
  for (const space of [...deployments, ...clusterNames.flatMap((name) => [`${name}-argo-apps`, name]), ...bases]) {
    try { cub("space", "delete", space, "--recursive"); console.log(`  deleted ${space}`); } catch { /* absent or shared */ }
  }
  console.log("fleet slice teardown complete");
  process.exit(0);
}

check(false, "usage: run-fleet-generate.mjs --scaffold | --build | --place | --age | --capture | --down");
