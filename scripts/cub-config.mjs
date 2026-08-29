#!/usr/bin/env node
// cub config — a working prototype of the `cub <noun>` idea, config side.
//
// The smallest noun: one config, one chart. `cub config sandbox <name>` renders it
// for free and reports what it installs and the lifecycle work it carries (CRDs,
// hooks, admission webhooks, setup Jobs). This is the CLI form of the anonymous
// browser Check: render it, see what it installs, run checks — no cluster, no
// account. It completes the sandbox family: cub config → cub app → cub stack, each
// with the same free "look before you install" mode.
//
// Verbs:
//   node scripts/cub-config.mjs list
//   node scripts/cub-config.mjs sandbox <name>

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseDocs, repoRoot, trackedExists } from "./lib/proof-common.mjs";

// A small config catalog: friendly name to a committed chart render.
const A = "data/adversarial10/charts";
const CONFIGS = {
  "argo-cd": `${A}/argo-cd-argo-cd-9.5.15/rendered/default.yaml`,
  "cert-manager": `${A}/jetstack-cert-manager-v1.20.2/rendered/default.yaml`,
  "external-secrets": `${A}/external-secrets-external-secrets-2.5.0/rendered/default.yaml`,
  "ingress-nginx": `${A}/ingress-nginx-ingress-nginx-4.15.1/rendered/default.yaml`,
  "kube-prometheus-stack": `${A}/prometheus-community-kube-prometheus-stack-85.3.3/rendered/default.yaml`,
  loki: `${A}/grafana-loki-7.0.0/rendered/default.yaml`,
  "metrics-server": `${A}/metrics-server-metrics-server-3.13.0/rendered/default.yaml`,
  postgresql: `${A}/bitnami-postgresql-18.6.7/rendered/default.yaml`,
  rabbitmq: `${A}/bitnami-rabbitmq-16.0.14/rendered/default.yaml`,
  redis: `${A}/bitnami-redis-25.5.3/rendered/default.yaml`,
};

const [verb, name] = process.argv.slice(2);

function loadConfig(configName) {
  const render = CONFIGS[configName];
  if (!render || !trackedExists(join(repoRoot, render))) {
    console.error(`no such config "${configName}". Try: cub config list`);
    process.exit(2);
  }
  const objects = parseDocs(readFileSync(join(repoRoot, render), "utf8")).filter((d) => d && d.kind && d.metadata?.name);
  return { name: configName, render, objects };
}

function analyze(config) {
  const kinds = {};
  const created = new Set();
  const used = new Set();
  const crds = [];
  let hooks = 0;
  let jobs = 0;
  let webhooksNeedingCa = 0;
  for (const o of config.objects) {
    kinds[o.kind] = (kinds[o.kind] ?? 0) + 1;
    if (o.kind === "Namespace") created.add(o.metadata.name);
    if (o.metadata?.namespace) used.add(o.metadata.namespace);
    if (o.kind === "CustomResourceDefinition") crds.push(o.metadata.name);
    if (o.metadata?.annotations?.["helm.sh/hook"]) hooks += 1;
    if (o.kind === "Job") jobs += 1;
    if (String(o.kind).endsWith("WebhookConfiguration") && (o.webhooks ?? []).some((w) => !w.clientConfig?.caBundle)) webhooksNeedingCa += 1;
  }
  const nsPrereqs = [...used].filter((ns) => !created.has(ns)).sort();
  return { kinds, nsPrereqs, crds, hooks, jobs, webhooksNeedingCa };
}

if (verb === "list") {
  console.log(`\nAvailable configs (committed chart renders)\n`);
  for (const key of Object.keys(CONFIGS).sort()) console.log(`  ${key}`);
  console.log(`\ncub config sandbox <name>   # render and check, free\n`);
} else if (verb === "sandbox") {
  if (!name) {
    console.error("usage: cub config sandbox <name>");
    process.exit(2);
  }
  const config = loadConfig(name);
  const a = analyze(config);

  console.log(`\nConfig: ${config.name}`);
  console.log(`Rendering the chart from the catalog (free, no infrastructure)\n`);
  console.log("Installs");
  console.log(`  ${config.objects.length} objects: ${Object.entries(a.kinds).sort().map(([k, n]) => `${n} ${k}`).join(", ")}`);
  console.log(`  namespaces that must already exist: ${a.nsPrereqs.length ? a.nsPrereqs.join(", ") : "none"}\n`);

  console.log("Lifecycle work");
  console.log(`  ${a.crds.length ? "[NOTE]" : "[PASS]"} CRDs: ${a.crds.length}${a.crds.length ? " (apply and establish before any custom resource)" : ""}`);
  console.log(`  ${a.hooks ? "[NOTE]" : "[PASS]"} Helm hooks: ${a.hooks}`);
  console.log(`  ${a.jobs ? "[NOTE]" : "[PASS]"} setup Jobs: ${a.jobs}`);
  console.log(`  ${a.webhooksNeedingCa ? "[NOTE]" : "[PASS]"} admission webhooks needing a certificate: ${a.webhooksNeedingCa}`);
  console.log(`\n  Free look before you install. Compose it into a cub stack, or run it as a cub app.\n`);
} else {
  console.log(`cub config — prototype

Usage:
  node scripts/cub-config.mjs list
  node scripts/cub-config.mjs sandbox <name>`);
  process.exit(verb ? 2 : 0);
}
