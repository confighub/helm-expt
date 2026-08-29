#!/usr/bin/env node
// cub app — a working prototype of the `cub <noun>` idea, workload side.
//
// An app is a workload. `cub app sandbox <name>` renders it for free and works out
// what it needs to run: the objects it installs, the namespaces that must exist, and
// crucially whether it is self-contained or needs a PLATFORM for its dependencies
// (an ingress controller, cert-manager, a Prometheus operator, external-secrets). A
// standalone app goes straight to a cluster from OCI; an app with dependencies lands
// on a platform that carries the stack it needs.
//
// Verbs:
//   node scripts/cub-app.mjs list
//   node scripts/cub-app.mjs sandbox <name>
//   node scripts/cub-app.mjs install <name>    # prints the delivery plan

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseDocs, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const APPS_DIR = join(repoRoot, "examples", "cub-app", "apps");
const [verb, name] = process.argv.slice(2);

// The platform services an app can depend on, keyed by what appears in its objects.
const DEPENDENCIES = [
  { when: (o) => o.kind === "Ingress", service: "an ingress controller", detail: (o) => `Ingress ${o.metadata?.name} (class ${o.spec?.ingressClassName ?? "default"})` },
  { when: (o) => String(o.apiVersion).startsWith("cert-manager.io/"), service: "cert-manager", detail: (o) => `${o.kind} ${o.metadata?.name}` },
  { when: (o) => String(o.apiVersion).startsWith("monitoring.coreos.com/"), service: "a Prometheus operator (kube-prometheus-stack)", detail: (o) => `${o.kind} ${o.metadata?.name}` },
  { when: (o) => String(o.apiVersion).startsWith("external-secrets.io/"), service: "external-secrets", detail: (o) => `${o.kind} ${o.metadata?.name}` },
];

function loadApp(appName) {
  const path = join(APPS_DIR, `${appName}.yaml`);
  if (!existsSync(path)) {
    console.error(`no such app "${appName}". Try: cub app list`);
    process.exit(2);
  }
  const objects = parseDocs(readFileSync(path, "utf8")).filter((d) => d && d.kind && d.metadata?.name);
  return { name: appName, path, objects };
}

function analyze(app) {
  const kinds = {};
  const createdNamespaces = new Set();
  const usedNamespaces = new Set();
  for (const o of app.objects) {
    kinds[o.kind] = (kinds[o.kind] ?? 0) + 1;
    if (o.kind === "Namespace") createdNamespaces.add(o.metadata.name);
    if (o.metadata?.namespace) usedNamespaces.add(o.metadata.namespace);
  }
  const nsPrereqs = [...usedNamespaces].filter((ns) => !createdNamespaces.has(ns)).sort();

  const deps = [];
  for (const o of app.objects) {
    for (const d of DEPENDENCIES) {
      if (d.when(o)) deps.push({ service: d.service, detail: d.detail(o) });
    }
  }
  return { kinds, nsPrereqs, deps };
}

if (verb === "list") {
  const files = readdirSync(APPS_DIR).filter((f) => f.endsWith(".yaml"));
  console.log(`\nAvailable apps (${relativeRepo(APPS_DIR)})\n`);
  for (const f of files.sort()) {
    const app = loadApp(f.replace(/\.yaml$/, ""));
    const { deps } = analyze(app);
    const tag = deps.length ? `needs a platform (${[...new Set(deps.map((d) => d.service))].length} deps)` : "standalone";
    console.log(`  ${app.name}  —  ${app.objects.length} objects, ${tag}`);
  }
  console.log(`\ncub app sandbox <name>   # render and analyze, free\n`);
} else if (verb === "sandbox") {
  if (!name) {
    console.error("usage: cub app sandbox <name>");
    process.exit(2);
  }
  const app = loadApp(name);
  const { kinds, nsPrereqs, deps } = analyze(app);

  console.log(`\nApp: ${app.name}`);
  console.log(`Rendering the workload from the catalog (free, no infrastructure)\n`);

  console.log("Installs");
  console.log(`  ${app.objects.length} objects: ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ")}`);
  console.log(`  namespaces that must already exist: ${nsPrereqs.length ? nsPrereqs.join(", ") : "none"}\n`);

  if (deps.length === 0) {
    console.log("Dependencies");
    console.log("  [PASS] standalone — no platform services required");
    console.log("  Delivers straight to a cluster from OCI, reconciled by your own Argo CD or Flux.\n");
  } else {
    console.log("Dependencies (this app needs a platform to provide these)");
    const byService = new Map();
    for (const d of deps) {
      if (!byService.has(d.service)) byService.set(d.service, []);
      byService.get(d.service).push(d.detail);
    }
    for (const [service, details] of byService) {
      console.log(`  [NEEDS] ${service}`);
      for (const det of details) console.log(`             ${det}`);
    }
    console.log(`\n  Install this app onto a platform that carries those services (for example a cub stack`);
    console.log(`  with cert-manager, ingress, and monitoring), then your Argo CD or Flux reconciles it.\n`);
  }
} else if (verb === "install") {
  if (!name) {
    console.error("usage: cub app install <name>");
    process.exit(2);
  }
  const app = loadApp(name);
  const space = `${app.name}-app`;
  console.log(`\nApp install plan for ${app.name} (dry run, no changes)\n`);
  console.log("  Steps:");
  console.log(`    cub space create ${space} --component ${app.name} --variant app`);
  console.log(`    cub unit create --space ${space} ${app.name} ${relativeRepo(app.path)} --change-desc 'Seed app ${app.name}'`);
  console.log(`    cub trigger create --space ${space} require-approval Mutation Kubernetes/YAML vet-approvedby 1`);
  console.log(`\n  Then release through OCI and reconcile with your Argo CD or Flux.`);
  console.log(`  (cub stack install runs the same shape live end to end; this is the app-scoped plan.)\n`);
} else {
  console.log(`cub app — prototype

Usage:
  node scripts/cub-app.mjs list
  node scripts/cub-app.mjs sandbox <name>
  node scripts/cub-app.mjs install <name>`);
  process.exit(verb ? 2 : 0);
}
