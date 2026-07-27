#!/usr/bin/env node

// Lifecycle route contract.
//
// Turns the hook/hook-like disposition data into a deterministic,
// machine-readable answer to one user question:
//
//   "This chart has a hook or hidden lifecycle behavior. Where does it go,
//    who executes it, what is the default, and what are my off-ramps?"
//
// It joins:
//   - data/hook-disposition/top100-hook-dispositions.csv  (authoritative dispositions)
//   - data/hook-route-candidates/candidates.csv           (candidate route plans)
//   - data/hook-lifecycle-review/top100-source-hook-route-review.csv (review context)
//   - data/hook-route-candidates/selected-routes/*.yaml   (observed exact-base routes)
//
// and emits data/lifecycle-routes/{routes.csv,routes.json,summary.md,contract.md}.
//
// Determinism: output is a pure function of the committed source CSVs. No
// wall-clock timestamps, no network, no cluster. --verify regenerates and
// byte-compares, so it is stable across days. This script never executes a
// hook, mutates ConfigHub, or edits runs/ receipts.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const SOURCES = {
  dispositions: "data/hook-disposition/top100-hook-dispositions.csv",
  candidates: "data/hook-route-candidates/candidates.csv",
  review: "data/hook-lifecycle-review/top100-source-hook-route-review.csv",
  selectedRoutes: "data/hook-route-candidates/selected-routes",
};

const outDir = join(repoRoot, "data", "lifecycle-routes");
const routesCsvPath = join(outDir, "routes.csv");
const routesJsonPath = join(outDir, "routes.json");
const summaryPath = join(outDir, "summary.md");
const contractPath = join(outDir, "contract.md");

// --- Published vocabulary -------------------------------------------------

// disposition: the published user-facing word. todo is temporary (a next
// action is named); refused is a deliberate final decision.
const DISPOSITIONS = ["observed", "routed", "per-target", "refused", "todo"];

// execution_mode: WHO performs the route in the current product + recipe state.
// product-executes is reserved for routes the cub installer actually runs, and
// is only assigned when evidence proves it. Nothing proves that today, so no
// row is product-executes; this is intentional, not an omission.
const EXECUTION_MODES = ["product-executes", "user-executes", "target-owned", "not-yet-executable"];

// Source disposition vocabulary -> published disposition. Published next to the
// contract so candidate-route (master matrix) and recipe-needed (hook
// disposition CSV) join to the four published words without guessing.
const SOURCE_DISPOSITION_MAP = {
  observed: "observed",
  routed: "routed",
  "per-target": "per-target",
  refused: "refused",
  "recipe-needed": "todo",
  "candidate-route": "routed",
  "candidate-route-plan": "todo",
  "selected-route-receipt": "observed",
};

// route_name -> quirk class.
const ROUTE_QUIRK_CLASS = {
  "preflight-or-presync": "hook-phase",
  "preflight-or-presync-crd-apply": "crd-install",
  "postsync-check-or-observation": "hook-phase",
  "upgrade-action-with-receipt": "hook-phase",
  "explicit-managed-action": "hook-phase",
  "argocd-or-flux-lifecycle-hook": "hook-phase",
  "target-class-preflight-and-upgrade-action": "per-target-hook",
  "recipe-time-lifecycle-verification": "hook-phase",
  "explicit-test-check": "hook-test",
  "webhook-readiness-observation": "webhook-readiness",
  "target-facts-or-preflight": "target-facts",
  "preserve-ordering": "hook-weight-ordering",
  "preserve-cleanup-policy": "hook-delete-policy",
  "delete-cleanup-policy": "hook-delete-policy",
  "self-contained-crd-base": "crd-install",
};

// route_name -> base execution mode (before todo/blocked overrides). Never
// product-executes: the installer does not auto-run lifecycle routes yet.
const ROUTE_EXECUTION_MODE = {
  "preflight-or-presync": "user-executes",
  "preflight-or-presync-crd-apply": "user-executes",
  "postsync-check-or-observation": "user-executes",
  "upgrade-action-with-receipt": "user-executes",
  "explicit-managed-action": "not-yet-executable",
  "argocd-or-flux-lifecycle-hook": "target-owned",
  "target-class-preflight-and-upgrade-action": "user-executes",
  "recipe-time-lifecycle-verification": "user-executes",
  "explicit-test-check": "user-executes",
  "webhook-readiness-observation": "target-owned",
  "target-facts-or-preflight": "user-executes",
  "preserve-ordering": "target-owned",
  "preserve-cleanup-policy": "target-owned",
  "delete-cleanup-policy": "target-owned",
  "self-contained-crd-base": "target-owned",
};

// quirk class -> named alternative routes (off-ramps) and what each needs.
// Grounded in docs/user/hook-lifecycle-strategy.md (GitOps/Argo mapping) and
// docs/planning/where-does-my-hook-go.md (route catalog).
const QUIRK_ALTERNATIVES = {
  "hook-phase": [
    { route: "argocd-or-flux-lifecycle-hook", requirement: "a GitOps controller (Argo CD/Flux) that runs sync hooks or sync waves" },
    { route: "target-facts-or-preflight", requirement: "the prerequisite supplied as a target fact or preflight before apply" },
    { route: "refuse", requirement: "accept that the catalog will not run this automatically and do it manually" },
  ],
  "crd-install": [
    { route: "self-contained-crd-base", requirement: "a preset config that renders the required CRDs as ordinary objects before the workloads" },
    { route: "target-owned-crds", requirement: "the cluster or an operator owns CRD install and upgrade out of band" },
    { route: "refuse", requirement: "use a no-crds base and install/upgrade the CRDs yourself" },
  ],
  "hook-delete-policy": [
    { route: "delete-on-uninstall", requirement: "accept deletion of the hook-managed object on uninstall" },
    { route: "refuse", requirement: "manage cleanup manually and keep the object" },
  ],
  "hook-weight-ordering": [
    { route: "argocd-sync-waves", requirement: "a GitOps controller that maps hook weights to sync waves" },
    { route: "apply-order", requirement: "an apply step that preserves the documented order" },
  ],
  "hook-test": [
    { route: "ci-check", requirement: "run the test as a CI or post-apply check instead of a Helm test hook" },
    { route: "skip-test", requirement: "accept that the test is not run automatically" },
  ],
  "webhook-readiness": [
    { route: "postsync-check-or-observation", requirement: "a post-apply readiness check you run or observe" },
  ],
  "target-facts": [
    { route: "preflight-or-presync", requirement: "a preflight step that establishes the fact before apply" },
    { route: "refuse", requirement: "supply the fact manually and accept no preflight" },
  ],
  "per-target-hook": [
    { route: "per-target-scope-split", requirement: "named target classes, each with its own route decision" },
  ],
};

// --- CSV helpers ----------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readCsvObjects(relPath) {
  const abs = join(repoRoot, relPath);
  check(existsSync(abs), `missing source ${relPath}`);
  const rows = parseCsv(readFileSync(abs, "utf8")).filter((r) => r.some((cell) => cell.trim() !== ""));
  const headers = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, idx) => [h, cells[idx] ?? ""])));
}

function readSelectedRouteReceipts() {
  const relDir = SOURCES.selectedRoutes;
  const absDir = join(repoRoot, relDir);
  if (!existsSync(absDir)) return [];
  return readdirSync(absDir)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => {
      const path = `${relDir}/${name}`;
      const doc = readYaml(join(repoRoot, path));
      const spec = doc.spec ?? {};
      check(spec.chart, `${path} is missing spec.chart`);
      check(spec.version, `${path} is missing spec.version`);
      check(spec.base, `${path} is missing spec.base`);
      check(spec.result === "observed", `${path} must be observed before it enters the lifecycle route contract`);
      check(spec.execution?.runtimeObserved === true, `${path} must record runtimeObserved: true`);
      const phases = spec.route?.phases ?? [];
      check(phases.length > 0, `${path} has no selected route phase`);
      const evidence = [path, ...(spec.evidence ?? []).map((entry) => entry.path).filter(Boolean)];
      for (const evidencePath of evidence) {
        check(evidencePath.startsWith("http") || existsSync(join(repoRoot, evidencePath)), `${path} references missing evidence ${evidencePath}`);
      }
      return { path, spec, phases, evidence };
    });
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvCell(row[h])).join(","));
  return `${lines.join("\n")}\n`;
}

// --- Derivation -----------------------------------------------------------

function normalizeRoute(raw) {
  const trimmed = raw.trim();
  const match = trimmed.match(/^([^(]+?)\s*(?:\((.*)\))?$/);
  const name = (match ? match[1] : trimmed).trim();
  const qualifier = match && match[2] ? match[2].trim() : "";
  return { name, qualifier };
}

function mapDisposition(sourceValue) {
  const mapped = SOURCE_DISPOSITION_MAP[sourceValue.trim()];
  check(mapped !== undefined, `unmapped source disposition "${sourceValue}"; add it to SOURCE_DISPOSITION_MAP`);
  return mapped;
}

function quirkClassFor(routeName) {
  const value = ROUTE_QUIRK_CLASS[routeName];
  check(value !== undefined, `unmapped route "${routeName}"; add it to ROUTE_QUIRK_CLASS`);
  return value;
}

function baseExecutionFor(routeName) {
  const value = ROUTE_EXECUTION_MODE[routeName];
  check(value !== undefined, `unmapped route "${routeName}"; add it to ROUTE_EXECUTION_MODE`);
  return value;
}

function executionModeFor(routeName, disposition, liveStatus) {
  if (disposition === "todo") return "not-yet-executable";
  if (disposition === "refused") return "not-yet-executable";
  return baseExecutionFor(routeName);
}

function normalizeLiveStatus(raw) {
  const text = (raw ?? "").trim();
  if (text === "") return "none";
  const lower = text.toLowerCase();
  if (lower.startsWith("observed")) return "observed";
  if (lower.includes("blocked")) return "blocked";
  if (lower.startsWith("none")) return "none";
  return text;
}

function alternativesFor(quirkClass, routeName) {
  return (QUIRK_ALTERNATIVES[quirkClass] ?? []).filter((alt) => alt.route !== routeName);
}

function buildRows() {
  const dispositions = readCsvObjects(SOURCES.dispositions);
  const candidates = readCsvObjects(SOURCES.candidates);
  const review = readCsvObjects(SOURCES.review);
  const selectedRoutes = readSelectedRouteReceipts();

  const reviewByChart = new Map(review.map((r) => [r.chart, r]));
  const candidatesByChart = new Map(candidates.map((r) => [r.chart, r]));
  const dispositionCharts = new Set(dispositions.map((r) => r.chart));

  const rows = [];

  // 1) Authoritative dispositions, exploded one row per selected route.
  for (const d of dispositions) {
    const candidate = candidatesByChart.get(d.chart);
    const liveStatusToken = normalizeLiveStatus(d.live_status);
    const disposition = mapDisposition(d.disposition);
    const routeParts = d.selected_route.split(";").map((part) => part.trim()).filter(Boolean);
    for (const part of routeParts) {
      const { name: routeName, qualifier } = normalizeRoute(part);
      rows.push(makeRow({
        chart: d.chart,
        version: d.version,
        hookPhases: d.hook_phases,
        sourceDisposition: d.disposition.trim(),
        disposition,
        routeName,
        qualifier,
        liveStatus: liveStatusToken,
        requirements: candidate?.target_dependencies ?? "",
        evidenceOrNextAction: disposition === "observed"
          ? d.evidence
          : joinNonEmpty([d.next_action, rawLiveReason(d.live_status), d.evidence], " | "),
      }));
    }
  }

  // 2) Candidate-only charts (no authoritative disposition yet) -> todo rows.
  for (const c of candidates) {
    if (dispositionCharts.has(c.chart)) continue;
    const { name: routeName, qualifier } = normalizeRoute(c.candidate_route);
    const disposition = mapDisposition(c.status);
    rows.push(makeRow({
      chart: c.chart,
      version: c.version,
      hookPhases: c.hook_phases,
      sourceDisposition: c.status.trim(),
      disposition,
      routeName,
      qualifier,
      liveStatus: "candidate-route-plan",
      requirements: c.target_dependencies ?? "",
      evidenceOrNextAction: joinNonEmpty([c.promotion_next_step, SOURCES.candidates], " | "),
    }));
  }

  // 3) Selected, observed routes override the chart-level plan for one exact
  // base. Other bases keep the chart-level candidate until they have their own
  // selected receipt.
  for (const selected of selectedRoutes) {
    for (const phase of selected.phases) {
      const routeName = String(phase.action ?? "").trim();
      check(routeName, `${selected.path} has a route phase without an action`);
      rows.push(makeRow({
        chart: selected.spec.chart,
        version: String(selected.spec.version),
        baseOrVariant: selected.spec.base,
        hookPhases: (phase.hookTypes ?? []).join(", "),
        sourceDisposition: "selected-route-receipt",
        disposition: "observed",
        routeName,
        qualifier: "",
        liveStatus: "observed",
        requirements: joinNonEmpty([selected.spec.route?.summary, phase.reason], " "),
        evidenceOrNextAction: selected.evidence.join(";"),
      }));
    }
  }

  rows.sort((a, b) =>
    `${a.chart}|${a.version}|${a.base_or_variant}|${a.quirk_class}|${a.route_name}`.localeCompare(
      `${b.chart}|${b.version}|${b.base_or_variant}|${b.quirk_class}|${b.route_name}`,
    ),
  );
  return rows;
}

function makeRow({ chart, version, baseOrVariant = "", hookPhases, sourceDisposition, disposition, routeName, qualifier, liveStatus, requirements, evidenceOrNextAction }) {
  const quirkClass = quirkClassFor(routeName);
  const executionMode = executionModeFor(routeName, disposition, liveStatus);
  const alternatives = alternativesFor(quirkClass, routeName);
  const hasOfframp = alternatives.length > 0;
  const requirementText = joinNonEmpty([requirements, qualifier ? `condition: ${qualifier}` : ""], "; ");
  return {
    chart,
    version,
    base_or_variant: baseOrVariant,
    quirk_class: quirkClass,
    hook_phases: (hookPhases ?? "").trim(),
    source_disposition: sourceDisposition,
    disposition,
    route_name: routeName,
    default_route: routeName,
    alternatives: alternatives.map((alt) => alt.route).join("; "),
    route_requirements: requirementText,
    execution_mode: executionMode,
    human_offramp: hasOfframp ? "recipe-base-or-values" : "none",
    agent_offramp: hasOfframp ? "routes-json" : "none",
    live_status: liveStatus,
    safe_as_automatic: executionMode === "product-executes" ? "yes" : "no",
    evidence_or_next_action: (evidenceOrNextAction ?? "").trim(),
    _alternatives: alternatives,
  };
}

function joinNonEmpty(parts, sep) {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(sep);
}

function rawLiveReason(raw) {
  const text = (raw ?? "").trim();
  return /blocked|none/i.test(text) ? text : "";
}

// --- Output builders ------------------------------------------------------

const CSV_HEADERS = [
  "chart",
  "version",
  "base_or_variant",
  "quirk_class",
  "hook_phases",
  "source_disposition",
  "disposition",
  "route_name",
  "default_route",
  "alternatives",
  "route_requirements",
  "execution_mode",
  "human_offramp",
  "agent_offramp",
  "live_status",
  "safe_as_automatic",
  "evidence_or_next_action",
];

function buildJson(rows) {
  const routes = rows.map((row) => ({
    chart: row.chart,
    version: row.version,
    base_or_variant: row.base_or_variant,
    quirk_class: row.quirk_class,
    hook_phases: row.hook_phases,
    source_disposition: row.source_disposition,
    disposition: row.disposition,
    route_name: row.route_name,
    default_route: row.default_route,
    alternatives: row._alternatives,
    route_requirements: row.route_requirements,
    execution_mode: row.execution_mode,
    human_offramp: row.human_offramp,
    agent_offramp: row.agent_offramp,
    // Kept for compatibility with earlier readers; prefer the flat fields above.
    offramp: { human: row.human_offramp, agent: row.agent_offramp },
    live_status: row.live_status,
    safe_as_automatic: row.safe_as_automatic === "yes",
    evidence_or_next_action: row.evidence_or_next_action,
  }));
  validateJsonRoutes(routes);
  return `${JSON.stringify(
    {
      kind: "LifecycleRouteContract",
      unofficial: true,
      description:
        "Machine-readable lifecycle route contract for hook and hook-like behavior. Generated by scripts/generate-lifecycle-routes.mjs; do not hand-edit.",
      sources: Object.values(SOURCES),
      vocabulary: {
        disposition: DISPOSITIONS,
        execution_mode: EXECUTION_MODES,
        source_disposition_map: SOURCE_DISPOSITION_MAP,
      },
      invariants: [
        "safe_as_automatic is yes only when execution_mode is product-executes and evidence proves it.",
        "No row is product-executes today: the installer does not auto-run lifecycle routes yet.",
        "refused is a deliberate final decision; unmapped/unfinished cases are todo with a next action.",
      ],
      routes,
    },
    null,
    2,
  )}\n`;
}

function validateJsonRoutes(routes) {
  for (const row of routes) {
    const id = `${row.chart}@${row.version} ${row.quirk_class}/${row.route_name}`;
    for (const field of [
      "disposition",
      "route_name",
      "default_route",
      "execution_mode",
      "human_offramp",
      "agent_offramp",
      "live_status",
      "evidence_or_next_action",
    ]) {
      check(row[field] !== undefined && row[field] !== "", `lifecycle route JSON ${id} missing ${field}`);
    }
    check(Array.isArray(row.alternatives), `lifecycle route JSON ${id} alternatives must be an array`);
    check(row.safe_as_automatic === false || row.execution_mode === "product-executes", `lifecycle route JSON ${id} is automatic without product-executes`);
  }
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
}

function mdCountTable(title, pairs) {
  return [`| ${title} | Rows |`, "| --- | ---: |", ...pairs.map(([k, v]) => `| \`${k}\` | ${v} |`)].join("\n");
}

function buildSummary(rows) {
  const charts = new Set(rows.map((r) => `${r.chart}@${r.version}`));
  const autoYes = rows.filter((r) => r.safe_as_automatic === "yes").length;
  const rowTable = [
    "| Chart | Base | Quirk | Route | Disposition | Execution | Auto |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) =>
      `| ${r.chart}@${r.version} | ${r.base_or_variant || "chart fallback"} | ${r.quirk_class} | \`${r.route_name}\` | ${r.disposition} | ${r.execution_mode} | ${r.safe_as_automatic} |`,
    ),
  ].join("\n");

  return `# Lifecycle Routes

**UNOFFICIAL/EXPERIMENTAL.** Generated by \`scripts/generate-lifecycle-routes.mjs\`.
Do not hand-edit. Regenerate with \`npm run lifecycle:routes\`.

This is a machine-readable answer to one question a Helm user asks when a chart
has a hook or hidden lifecycle behavior:

~~~text
Where does it go? Who executes it? What is the default? What are my off-ramps?
~~~

Render parity proves the desired non-hook objects. This contract is the separate
fact about the lifecycle behavior: its route, who runs it, and whether the
product runs it automatically (today, nothing does — see below).

The full field definitions and the deterministic mapping tables are in
[contract.md](./contract.md). The two data forms are
[routes.csv](./routes.csv) (spreadsheet) and [routes.json](./routes.json)
(stable interface for agents).

## What This Covers

${rows.length} route rows across ${charts.size} chart/version lifecycle behaviors,
joined from:

- [${SOURCES.dispositions}](../hook-disposition/summary.md)
- [${SOURCES.candidates}](../hook-route-candidates/summary.md)
- [${SOURCES.review}](../hook-lifecycle-review/summary.md)
- \`${SOURCES.selectedRoutes}/*.yaml\`

It starts with hooks and existing routed hook candidates, and reaches the
adjacent Tier-1 lifecycle quirks those rows already touch (\`crd-install\`,
\`target-facts\`, \`webhook-readiness\`). Quirk classes with no per-chart route
data yet (for example generated-facts, lookup) are deliberately out of scope
until that data exists — a small correct contract, not a broad guess.

## The Honest Headline

${autoYes} of ${rows.length} rows are safe to show as automatic.

Nothing the catalog renders today is auto-executed by the cub installer. Every
route is \`user-executes\`, \`target-owned\` (a controller or GitOps engine runs
it), or \`not-yet-executable\`. That is the entire point of the contract: a
\`routed\` disposition means the route and its executor are named and an off-ramp
exists — **not** that the product silently runs it. \`safe_as_automatic\` only
becomes \`yes\` when \`execution_mode\` is \`product-executes\` and evidence proves
it.

## Distribution

${mdCountTable("Disposition", countBy(rows, "disposition"))}

${mdCountTable("Execution mode", countBy(rows, "execution_mode"))}

${mdCountTable("Quirk class", countBy(rows, "quirk_class"))}

## How To Read One Row

Take \`route_name = preflight-or-presync\`, \`disposition = routed\`,
\`execution_mode = user-executes\`:

- **quirk_class** — the kind of behavior (here a pre-install/upgrade hook phase).
- **disposition** — \`routed\`: the route is named but not yet proven live.
- **route_name / default_route** — where the behavior goes by default.
- **alternatives** — the named off-ramps for this quirk class.
- **execution_mode** — \`user-executes\`: you run it; the product does not.
- **human_offramp / agent_offramp** — how each picks a non-default route. A human
  selects a different recipe base/values; an agent enumerates and selects from
  [routes.json](./routes.json).
- **route_requirements** — what the route needs (target facts, conditions).
- **live_status / safe_as_automatic** — proven-ness, and the strict automatic
  flag (\`no\` until the product executes it with evidence).
- **evidence_or_next_action** — the receipt path if observed, else the next step.

## Rows

${rowTable}

## Boundaries

- Static join of committed CSVs and selected-route YAML receipts. No hook is executed, no cluster is
  touched, no ConfigHub state is changed, no \`runs/\` receipt is edited.
- A \`routed\` or \`todo\` row is a classification, not a proof. \`observed\` rows
  point at the committed receipt in \`evidence_or_next_action\`.
- The master matrix value \`candidate-route\` maps to \`routed\` here; the
  \`source_disposition\` column keeps the original value for traceability.
`;
}

function mdMapTable(title, valueTitle, map) {
  return [`| ${title} | ${valueTitle} |`, "| --- | --- |", ...Object.entries(map).map(([k, v]) => `| \`${k}\` | ${Array.isArray(v) ? v.join("; ") : `\`${v}\``} |`)].join("\n");
}

function buildContract() {
  const altRows = Object.entries(QUIRK_ALTERNATIVES).flatMap(([quirk, alts]) =>
    alts.map((alt) => `| \`${quirk}\` | \`${alt.route}\` | ${alt.requirement} |`),
  );
  return `# Lifecycle Route Contract

**UNOFFICIAL/EXPERIMENTAL.** Schema and derivation rules for
[routes.csv](./routes.csv) and [routes.json](./routes.json), generated by
\`scripts/generate-lifecycle-routes.mjs\`. Both the data and this contract are
generated from the same constants, so they cannot drift.

## Purpose

For every hook or hook-like lifecycle behavior, make machine-readable: the
route, who executes it, the default, the named alternatives and their
requirements, whether a human and an agent can pick an alternative, the
evidence or next action, and whether it is safe to show as automatic.

## Columns

| Column | Meaning |
| --- | --- |
| \`chart\` / \`version\` | Source chart and version. |
| \`base_or_variant\` | Specific base when a selected receipt proves an exact route; empty means the chart-level route used by bases without an exact receipt. |
| \`quirk_class\` | The behavior class, derived from \`route_name\` (see table). |
| \`hook_phases\` | Helm hook phases recorded by the source scan. |
| \`source_disposition\` | The raw disposition word from the source data, kept for traceability. |
| \`disposition\` | Published word: \`observed\`, \`routed\`, \`per-target\`, \`refused\`, or \`todo\`. |
| \`route_name\` | The selected/current route for this behavior. |
| \`default_route\` | The default route among the alternatives (equals \`route_name\`). |
| \`alternatives\` | Named off-ramp routes for this quirk class. |
| \`route_requirements\` | What the current route needs (target facts, render conditions). |
| \`execution_mode\` | Who performs it: \`product-executes\`, \`user-executes\`, \`target-owned\`, or \`not-yet-executable\`. |
| \`human_offramp\` | How a human picks an alternative (\`recipe-base-or-values\` or \`none\`). |
| \`agent_offramp\` | How an agent picks an alternative (\`routes-json\` or \`none\`). |
| \`live_status\` | \`observed\`, \`blocked\`, \`none\`, or \`candidate-route-plan\`. |
| \`safe_as_automatic\` | \`yes\` only when \`execution_mode\` is \`product-executes\` and evidence proves it. |
| \`evidence_or_next_action\` | Receipt path when observed, otherwise the next action. |

## Invariants

1. **No silent automation.** \`safe_as_automatic = yes\` requires
   \`execution_mode = product-executes\` plus evidence. No row qualifies today,
   so the column is uniformly \`no\`. This is deliberate.
2. **\`routed\` names an executor.** A \`routed\` row always records an
   \`execution_mode\`; \`candidate-route\`/\`recipe-needed\` only map to a real
   disposition once a route and executor are named.
3. **\`refused\` is final; \`todo\` is unfinished.** \`refused\` is a deliberate
   decision not to run a behavior automatically. \`todo\` (from
   \`recipe-needed\`/\`candidate-route-plan\`) means no recipe/route exists yet and
   a next action is named. They are never merged.
4. **Generated, not authored.** Regenerate with \`npm run lifecycle:routes\`;
   verify byte-for-byte with \`npm run lifecycle:routes:verify\`.

## Source Disposition Mapping

The source data uses more than one vocabulary. This is the published join.

${mdMapTable("Source value", "Published disposition", SOURCE_DISPOSITION_MAP)}

## Route → Quirk Class

${mdMapTable("route_name", "quirk_class", ROUTE_QUIRK_CLASS)}

## Route → Execution Mode (base)

Before the \`todo\`/\`refused\` override, which forces \`not-yet-executable\`.
No route maps to \`product-executes\`.

${mdMapTable("route_name", "execution_mode", ROUTE_EXECUTION_MODE)}

## Quirk Class → Alternatives (off-ramps)

The off-ramp routes a user or agent can choose instead of the default, and what
each needs. Grounded in
[../../docs/user/hook-lifecycle-strategy.md](../../docs/user/hook-lifecycle-strategy.md)
and [../../docs/planning/where-does-my-hook-go.md](../../docs/planning/where-does-my-hook-go.md).

| quirk_class | alternative route | requirement |
| --- | --- | --- |
${altRows.join("\n")}

## Off-ramps Today

The human off-ramp is recipe base/values selection. The agent off-ramp is
[routes.json](./routes.json): a stable enumeration of routes, defaults,
alternatives, and requirements an agent can read and act on. Selecting an
alternative is a recipe-level change today; this contract makes the choice
legible to both readers. Neither off-ramp implies the product executes the
route — see invariant 1.
`;
}

// --- Main -----------------------------------------------------------------

function buildAll() {
  const rows = buildRows();
  return {
    rows,
    csv: toCsv(CSV_HEADERS, rows),
    json: buildJson(rows),
    summary: buildSummary(rows),
    contract: buildContract(),
  };
}

if (mode === "--generate") {
  const out = buildAll();
  write(routesCsvPath, out.csv);
  write(routesJsonPath, out.json);
  write(summaryPath, out.summary);
  write(contractPath, out.contract);
  console.log(`wrote lifecycle routes -> ${relativeRepo(outDir)}/ (${out.rows.length} route rows)`);
} else if (mode === "--verify") {
  const out = buildAll();
  for (const [path, expected] of [
    [routesCsvPath, out.csv],
    [routesJsonPath, out.json],
    [summaryPath, out.summary],
    [contractPath, out.contract],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run lifecycle:routes`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run lifecycle:routes`);
  }
  console.log(`verified lifecycle routes for ${out.rows.length} route rows`);
} else {
  console.log(`Usage:
  node scripts/generate-lifecycle-routes.mjs --generate
  node scripts/generate-lifecycle-routes.mjs --verify`);
}
