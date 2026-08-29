#!/usr/bin/env node
// cub app — a working prototype of the `cub <noun>` idea, workload side.
//
// An app is a workload. `cub app sandbox <name>` renders it for free and works out
// what it needs to run: the objects it installs, the namespaces that must exist, and
// crucially whether it is self-contained or needs a PLATFORM for its dependencies
// (an ingress controller, cert-manager, a Prometheus operator, external-secrets).
// `cub app install <name> [--run]` creates the app in ConfigHub, one Unit per
// resource, with the release gated on review. A standalone app goes straight to a
// cluster from OCI; an app with dependencies lands on a platform that carries the
// stack it needs.
//
// Verbs:
//   node scripts/cub-app.mjs list
//   node scripts/cub-app.mjs sandbox <name>
//   node scripts/cub-app.mjs install <name> [--run]

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { parseDocs, relativeRepo, repoRoot, toYaml } from "./lib/proof-common.mjs";

const APPS_DIR = join(repoRoot, "examples", "cub-app", "apps");
const args = process.argv.slice(2);
const verb = args[0];
const name = args[1];
const RUN = args.includes("--run");

const CUB = process.env.CUB ?? join(homedir(), ".confighub", "bin", "cub");
function cub(cubArgs) {
  return execFileSync(CUB, cubArgs, { encoding: "utf8", maxBuffer: 200 * 1024 * 1024 });
}
function shellQuote(a) {
  return /[^A-Za-z0-9_./=:-]/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a;
}
function splitRawDocs(text) {
  return text.split(/^---\s*$/m).map((s) => s.trim()).filter((s) => /(^|\n)kind:/.test(s));
}

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

// Convert the app's workloads to Score (score.dev/v1b1), one Workload per Deployment
// or StatefulSet. ConfigHub's objects are already literal, so env values and ports
// resolve rather than dangling. This mirrors the k8s-to-score example in
// confighub/examples, applied to a cub app.
function toScore(app) {
  const services = app.objects.filter((o) => o.kind === "Service");
  const hasIngress = app.objects.some((o) => o.kind === "Ingress");
  const workloads = app.objects.filter((o) => o.kind === "Deployment" || o.kind === "StatefulSet");
  return workloads.map((w) => {
    const containers = {};
    for (const c of w.spec?.template?.spec?.containers ?? []) {
      const container = { image: c.image };
      const vars = {};
      for (const e of c.env ?? []) if (e?.value != null) vars[e.name] = String(e.value);
      if (Object.keys(vars).length) container.variables = vars;
      containers[c.name] = container;
    }
    const workload = { apiVersion: "score.dev/v1b1", metadata: { name: w.metadata.name }, containers };
    const svc = services.find((s) => s.metadata?.name === w.metadata?.name);
    if (svc) {
      const ports = {};
      for (const p of svc.spec?.ports ?? []) {
        ports[`port-${p.port}`] = p.targetPort ? { port: p.port, targetPort: p.targetPort } : { port: p.port };
      }
      if (Object.keys(ports).length) workload.service = { ports };
    }
    if (hasIngress) workload.resources = { route: { type: "route" } };
    return workload;
  });
}

function unitSlug(o) {
  return `${o.kind.toLowerCase()}-${o.metadata.name}`;
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
    console.log(`\n  Install onto a platform that carries those services (for example a cub stack such`);
    console.log(`  as web-platform), then your Argo CD or Flux reconciles it.\n`);
  }
} else if (verb === "install") {
  if (!name) {
    console.error("usage: cub app install <name> [--run]");
    process.exit(2);
  }
  const app = loadApp(name);
  const { deps } = analyze(app);
  const space = `${app.name}-app`;
  const docs = splitRawDocs(readFileSync(app.path, "utf8"));
  if (docs.length !== app.objects.length) {
    console.error(`could not split ${app.name} into one document per object (${docs.length} vs ${app.objects.length})`);
    process.exit(2);
  }

  const steps = [
    { kind: "cmd", desc: "create the app space", args: ["space", "create", space, "--component", app.name, "--variant", "app"] },
    ...app.objects.map((o, i) => ({ kind: "unit", slug: unitSlug(o), doc: docs[i], desc: `seed ${o.kind} ${o.metadata.name}` })),
    { kind: "cmd", desc: "gate the app release on review", args: ["trigger", "create", "--space", space, "-o", "json", "require-approval", "Mutation", "Kubernetes/YAML", "vet-approvedby", "1"] },
    { kind: "cmd", desc: "re-evaluate the seeded units against the gate", args: ["space", "update", "--patch", space, "--refresh-triggers"] },
  ];

  console.log(`\nApp install ${app.name} ${RUN ? "(live)" : "(dry run, no changes)"}\n`);
  if (deps.length) {
    console.log(`  Note: needs a platform for ${[...new Set(deps.map((d) => d.service))].join(", ")}. Land it on a platform that carries those.\n`);
  }
  console.log("  Steps:");
  for (const s of steps) {
    if (s.kind === "unit") {
      console.log(`    cub unit create --space ${space} ${s.slug} ${s.slug}.yaml --change-desc ${shellQuote(`Seed ${s.slug} for app ${app.name}`)}`);
    } else {
      console.log(`    cub ${s.args.map(shellQuote).join(" ")}`);
    }
  }
  console.log("");

  if (!RUN) {
    console.log(`  Dry run. Add --run to install, then \`cub unit approve\` releases the gated app.\n`);
    process.exit(0);
  }

  const tmp = mkdtempSync(join(tmpdir(), "cub-app-"));
  try {
    for (const s of steps) {
      process.stdout.write(`  ${s.desc}... `);
      if (s.kind === "unit") {
        const file = join(tmp, `${s.slug}.yaml`);
        writeFileSync(file, `${s.doc}\n`, "utf8");
        cub(["unit", "create", "--space", space, s.slug, file, "--change-desc", `Seed ${s.slug} for app ${app.name}`]);
      } else {
        cub(s.args);
      }
      console.log("ok");
    }
    const first = unitSlug(app.objects[0]);
    const gates = JSON.parse(cub(["unit", "get", first, "--space", space, "-o", "jq=.Unit.ApplyGates"]) || "null");
    const gated = gates && Object.keys(gates).length > 0;
    console.log(`\n  Installed. ${space} (${app.objects.length} units).`);
    console.log(`  Review gate on ${space}/${first}: ${gated ? "ACTIVE, release blocked until approved" : "not active"}`);
    console.log(`  The review: cub unit approve ${first} --space ${space}`);
    console.log(`  Tear down:  cub space delete --recursive-force ${space}\n`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
} else if (verb === "score") {
  if (!name) {
    console.error("usage: cub app score <name>");
    process.exit(2);
  }
  const app = loadApp(name);
  const workloads = toScore(app);
  if (!workloads.length) {
    console.error(`no Deployment or StatefulSet in ${app.name} to convert.`);
    process.exit(1);
  }
  console.log(`# ${workloads.length} Score workload(s) from ${app.name}, ready for score-k8s\n`);
  for (const w of workloads) console.log(`---\n${toYaml(w)}`);
} else {
  console.log(`cub app — prototype

Usage:
  node scripts/cub-app.mjs list
  node scripts/cub-app.mjs sandbox <name>
  node scripts/cub-app.mjs install <name> [--run]
  node scripts/cub-app.mjs score <name>          # export workloads to Score (score.dev)`);
  process.exit(verb ? 2 : 0);
}
