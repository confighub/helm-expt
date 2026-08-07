#!/usr/bin/env node
// Pilot switch-effect map: classify a chart's switches by RENDERING, not by
// hand. The toggles are auto-extracted from the chart's own values (top-level
// `<key>.enabled` plus the architecture axis when present), each one is
// rendered flipped, and the object set is diffed against the baseline. A
// switch that changes the object set is structural (base-variant territory);
// one that only changes field values is a data edit. The classification is
// evidence, not opinion: every row is a real render diff.
//
// Usage:
//   node scripts/pilot-switch-effect-map.mjs                # redis (default)
//   node scripts/pilot-switch-effect-map.mjs --chart nginx  # any registry chart
//   node scripts/pilot-switch-effect-map.mjs --all
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { normalizeTempPaths, repoRoot, write } from "./lib/proof-common.mjs";

// Versions pinned to the catalog's packages/ tree. baseValues exist to make
// the baseline render deterministic where the chart supports it; generated
// secrets elsewhere change bytes between renders but never the object set,
// which is all the map compares.
const REGISTRY = {
  redis: {
    ref: "oci://registry-1.docker.io/bitnamicharts/redis",
    version: "25.5.3",
    release: "redis",
    namespace: "redis",
    baseValues: 'auth:\n  password: "confighub-redis-password"\n',
  },
  postgresql: {
    ref: "oci://registry-1.docker.io/bitnamicharts/postgresql",
    version: "18.6.10",
    release: "postgresql",
    namespace: "postgresql",
    baseValues: 'auth:\n  postgresPassword: "confighub-postgres-password"\n',
  },
  rabbitmq: {
    ref: "oci://registry-1.docker.io/bitnamicharts/rabbitmq",
    version: "16.0.14",
    release: "rabbitmq",
    namespace: "rabbitmq",
    baseValues: 'auth:\n  password: "confighub-rabbitmq-password"\n  erlangCookie: "confighuberlangcookiefortesting"\n',
  },
  nginx: {
    ref: "oci://registry-1.docker.io/bitnamicharts/nginx",
    version: "24.0.2",
    release: "nginx",
    namespace: "nginx",
    baseValues: "",
  },
  grafana: {
    chartName: "grafana",
    repo: "https://grafana.github.io/helm-charts",
    version: "10.5.15",
    release: "grafana",
    namespace: "grafana",
    baseValues: 'adminPassword: "confighub-grafana-password"\n',
  },
};

const args = process.argv.slice(2);
const wantAll = args.includes("--all");
const chartArg = args.includes("--chart") ? args[args.indexOf("--chart") + 1] : "redis";
const charts = wantAll ? Object.keys(REGISTRY) : [chartArg];

const tmp = mkdtempSync(join(tmpdir(), "pilot-switch-map-"));
try {
  for (const name of charts) {
    const chart = REGISTRY[name];
    if (!chart) {
      console.error(`unknown chart '${name}'; registry: ${Object.keys(REGISTRY).join(", ")}`);
      process.exit(2);
    }
    buildMap(name, chart);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

function buildMap(name, chart) {
  console.log(`\n=== ${name}@${chart.version} ===`);
  const switches = extractSwitches(chart);
  console.log(`switches auto-extracted from chart values: ${switches.length}`);
  const baseline = objectSet(renderHelm(chart, chart.baseValues));
  const rows = [];
  for (const sw of switches) {
    let objects;
    try {
      objects = objectSet(renderHelm(chart, chart.baseValues + sw.values));
    } catch (error) {
      rows.push({ switch: sw.name, kind: "render-error", error: normalizeTempPaths(error.message || error).slice(0, 200), added: [], removed: [] });
      process.stdout.write(`render-err  ${sw.name}\n`);
      continue;
    }
    const added = [...objects].filter((k) => !baseline.has(k));
    const removed = [...baseline].filter((k) => !objects.has(k));
    const kind = added.length || removed.length ? "structural" : "field";
    rows.push({ switch: sw.name, kind, baselineObjects: baseline.size, variantObjects: objects.size, added, removed });
    process.stdout.write(`${kind.padEnd(11)} ${sw.name}  (+${added.length} -${removed.length})\n`);
  }
  const structural = rows.filter((r) => r.kind === "structural");
  const outDir = join(repoRoot, "data", "pilot-switch-map");
  mkdirSync(outDir, { recursive: true });
  write(join(outDir, `${name}.json`), `${JSON.stringify({ chart: `${chart.ref ?? `${chart.repo}#${chart.chartName}`}@${chart.version}`, baselineObjects: baseline.size, rows }, null, 2)}\n`);
  write(join(outDir, `${name}.md`), renderMarkdown(name, chart, baseline.size, rows));
  console.log(`${structural.length}/${rows.length} structural; wrote data/pilot-switch-map/${name}.{json,md}`);
}

// Auto-extract the switch space from the chart's own values: every top-level
// key whose block carries a two-space `enabled:`, flipped from its default,
// plus the architecture axis when the chart declares one.
function chartArgs(chart) {
  return chart.ref ? [chart.ref] : [chart.chartName, "--repo", chart.repo];
}

function extractSwitches(chart) {
  const valuesText = execFileSync("helm", ["show", "values", ...chartArgs(chart), "--version", chart.version], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024,
  });
  const lines = valuesText.split("\n");
  const switches = [];
  let currentTop = null;
  for (const line of lines) {
    const top = line.match(/^([a-zA-Z][\w]*):\s*(.*)$/);
    if (top) currentTop = top[1];
    const arch = line.match(/^architecture:\s*(\S+)/);
    if (arch) {
      const flipped = arch[1] === "standalone" ? "replication" : "standalone";
      switches.push({ name: `architecture=${flipped}`, values: `architecture: ${flipped}\n` });
      continue;
    }
    const en = line.match(/^  enabled:\s*(true|false)\s*$/);
    if (en && currentTop) {
      const flipped = en[1] === "true" ? "false" : "true";
      switches.push({ name: `${currentTop}.enabled=${flipped}`, values: `${currentTop}:\n  enabled: ${flipped}\n` });
      currentTop = null;
    }
  }
  return switches;
}

function renderHelm(chart, valuesText) {
  const valuesPath = join(mkdtempSync(join(tmp, "v-")), "values.yaml");
  writeFileSync(valuesPath, valuesText || "# defaults\n");
  return execFileSync("helm", [
    "template", chart.release, ...chartArgs(chart), "--version", chart.version,
    "--namespace", chart.namespace, "--values", valuesPath, "--kube-version", "1.30.0",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

// One object key per rendered document: apiVersion/kind/name.
function objectSet(yaml) {
  const set = new Set();
  for (const doc of yaml.split(/^---$/m)) {
    const kind = doc.match(/^kind:\s*(\S+)/m)?.[1];
    const api = doc.match(/^apiVersion:\s*(\S+)/m)?.[1];
    const name = doc.match(/^\s{2}name:\s*(\S+)/m)?.[1];
    if (kind && name) set.add(`${api}/${kind}/${name}`);
  }
  return set;
}

function renderMarkdown(name, chart, baselineObjects, rows) {
  const structural = rows.filter((r) => r.kind === "structural");
  const field = rows.filter((r) => r.kind === "field");
  const errors = rows.filter((r) => r.kind === "render-error");
  const lines = [
    `# ${name} switch-effect map`,
    "",
    "Classified by rendering, not by hand. Every switch below was auto-extracted",
    `from the chart's own values (\`${chart.ref ?? `${chart.repo}#${chart.chartName}`}@${chart.version}\`), flipped, and the`,
    `rendered object set compared against the baseline (${baselineObjects} objects).`,
    "A switch that changes the object set is **structural** and belongs in a base",
    "variant. A switch that only changes field values is a **data edit** on a",
    "derived variant. The verdict is the diff, not an opinion.",
    "",
    "## Structural switches (change the object set)",
    "",
    "| Switch | Objects | Adds | Removes |",
    "| --- | --- | --- | --- |",
    ...structural.map((r) => `| \`${r.switch}\` | ${r.variantObjects} | ${r.added.map((a) => `\`${a}\``).join("<br>") || "-"} | ${r.removed.map((a) => `\`${a}\``).join("<br>") || "-"} |`),
    "",
    "## Data-edit switches (values only, no object-set change)",
    "",
    "| Switch | Objects |",
    "| --- | --- |",
    ...field.map((r) => `| \`${r.switch}\` | ${r.variantObjects} (unchanged set) |`),
    ...(errors.length
      ? ["", "## Switches that failed to render when flipped", "", "| Switch | Error |", "| --- | --- |",
         ...errors.map((r) => `| \`${r.switch}\` | ${r.error.replaceAll("|", "\\|")} |`),
         "", "A flip that breaks the render is itself a finding: the chart requires more than the toggle to enable that feature."]
      : []),
    "",
    "## What this means",
    "",
    `Of ${rows.length} switches tested, ${structural.length} are structural,`,
    `${field.length} are data edits${errors.length ? `, and ${errors.length} refuse to render without more inputs` : ""}.`,
    "Naming the structural axes as base variants and leaving the rest as data",
    "edits avoids both the values-file sprawl and the combinatorial explosion.",
    "Switches were tested independently; a generated variant renders the actual",
    "combination and proves parity, so interaction effects are caught at",
    "generation, not assumed here.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}
