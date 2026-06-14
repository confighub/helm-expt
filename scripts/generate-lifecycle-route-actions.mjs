#!/usr/bin/env node

// Lifecycle route ACTIONS.
//
// Projects the legible lifecycle-route contract (data/lifecycle-routes/) into
// machine-readable ACTION PACKETS: per route, the lifecycle phase, the action
// kind, the required target facts, an agent-readable input block, the evidence
// required to advance, and an explicit `automatic` flag. The point is to let a
// UI or agent turn "where a hook/lifecycle action should go" into a checkable
// preflight/action/observe plan — WITHOUT claiming live or automatic execution.
//
// Committed data only: a pure function of data/lifecycle-routes/routes.json and
// data/master-catalog-matrix/matrix.csv (for version-drift naming). No live
// lanes, no cluster, no ConfigHub, no edits to runs/ receipts. --verify
// regenerates and byte-compares, and enforces the executability invariants.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const ROUTES_JSON = "data/lifecycle-routes/routes.json";
const MATRIX_CSV = "data/master-catalog-matrix/matrix.csv";

const schemaPath = join(repoRoot, "schemas", "lifecycle-route-action.schema.json");
const outDir = join(repoRoot, "data", "lifecycle-route-actions");
const csvPath = join(outDir, "actions.csv");
const jsonPath = join(outDir, "actions.json");
const summaryPath = join(outDir, "summary.md");
const contractPath = join(outDir, "contract.md");

// --- Vocabulary -----------------------------------------------------------

// Executability disposition for an action packet. This is the published hook /
// lifecycle vocabulary; `blocked` (missing prerequisite or evidence) and
// `refused` (intentionally not run) are distinct.
const DISPOSITIONS = ["observed", "routed", "per-target", "blocked", "refused"];

const PHASES = ["pre-render", "preflight", "pre-apply", "post-apply", "observe", "refuse"];

// Action kinds. The first group is produced by projecting lifecycle-routes; the
// reserved group (stage-secret, configure-ingress, wait-for-apiservice) is for
// lifecycle-observation cases illustrated in the user doc but not yet in the
// hook-disposition source (see summary.md "Not yet projected").
const ACTION_KINDS = [
  "verify-render",
  "run-preflight",
  "stage-target-facts",
  "install-crd",
  "preserve-ordering",
  "run-job",
  "gitops-sync-hook",
  "run-check",
  "run-test",
  "observe-webhook",
  "accept-target-policy",
  // reserved for lifecycle-observation cases (doc-illustrated, not yet projected):
  "stage-secret",
  "configure-ingress",
  "wait-for-apiservice",
];

// Crosswalk: lifecycle-routes disposition -> action disposition. `todo`
// (candidate route plan / recipe not built) maps to `blocked` (a missing
// prerequisite). `routed` is `blocked` when the route's live_status is blocked.
const SOURCE_DISPOSITION_CROSSWALK = {
  observed: "observed",
  "per-target": "per-target",
  refused: "refused",
  todo: "blocked (no recipe/route built yet)",
  "routed (live_status=blocked)": "blocked",
  "routed (live_status=none/other)": "routed",
};

const ROUTE_PHASE = {
  "recipe-time-lifecycle-verification": "pre-render",
  "preflight-or-presync": "preflight",
  "target-facts-or-preflight": "preflight",
  "target-class-preflight-and-upgrade-action": "preflight",
  "preflight-or-presync-crd-apply": "pre-apply",
  "preserve-ordering": "pre-apply",
  "upgrade-action-with-receipt": "pre-apply",
  "explicit-managed-action": "post-apply",
  "argocd-or-flux-lifecycle-hook": "post-apply",
  "postsync-check-or-observation": "post-apply",
  "explicit-test-check": "observe",
  "webhook-readiness-observation": "observe",
  "preserve-cleanup-policy": "observe",
  "delete-cleanup-policy": "observe",
};

const ROUTE_ACTION_KIND = {
  "recipe-time-lifecycle-verification": "verify-render",
  "preflight-or-presync": "run-preflight",
  "target-facts-or-preflight": "stage-target-facts",
  "target-class-preflight-and-upgrade-action": "run-preflight",
  "preflight-or-presync-crd-apply": "install-crd",
  "preserve-ordering": "preserve-ordering",
  "upgrade-action-with-receipt": "run-job",
  "explicit-managed-action": "run-job",
  "argocd-or-flux-lifecycle-hook": "gitops-sync-hook",
  "postsync-check-or-observation": "run-check",
  "explicit-test-check": "run-test",
  "webhook-readiness-observation": "observe-webhook",
  "preserve-cleanup-policy": "accept-target-policy",
  "delete-cleanup-policy": "accept-target-policy",
};

// Human command placeholders. These are PLACEHOLDERS, not verified commands.
const HUMAN_COMMAND = {
  "install-crd": "kubectl apply --server-side -f <chart-crds>   # placeholder, not verified",
  "run-preflight": "kubectl apply -f <preflight-job>; kubectl wait --for=condition=complete job/<name>   # placeholder",
  "run-job": "kubectl apply -f <action-job>; kubectl wait --for=condition=complete job/<name>   # placeholder",
  "run-test": "# run the chart's test/check (helm test equivalent)   # placeholder",
  "observe-webhook": "kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations   # placeholder",
  "stage-target-facts": "# create the required target facts (Secret/StorageClass/etc.) before apply   # placeholder",
};

function phaseFor(route, disposition) {
  if (disposition === "refused") return "refuse";
  const phase = ROUTE_PHASE[route.route_name];
  check(phase !== undefined, `unmapped route "${route.route_name}"; add it to ROUTE_PHASE`);
  return phase;
}

function actionKindFor(route) {
  const kind = ROUTE_ACTION_KIND[route.route_name];
  check(kind !== undefined, `unmapped route "${route.route_name}"; add it to ROUTE_ACTION_KIND`);
  return kind;
}

function dispositionFor(route) {
  switch (route.disposition) {
    case "observed":
      return "observed";
    case "per-target":
      return "per-target";
    case "refused":
      return "refused";
    case "todo":
      return "blocked";
    case "routed":
      return route.live_status === "blocked" ? "blocked" : "routed";
    default:
      check(false, `unmapped source disposition "${route.disposition}"`);
      return "blocked";
  }
}

function evidenceRequiredFor(disposition) {
  switch (disposition) {
    case "observed":
      return "already has a live receipt; keep it fresh when chart, base, or cluster version changes";
    case "routed":
      return "a live lifecycle receipt showing this route ran for the supported target scope";
    case "per-target":
      return "a recorded target decision plus a live receipt for that scope";
    case "blocked":
      return "resolve the named prerequisite/blocker, then capture a live receipt";
    case "refused":
      return "n/a — intentionally not run automatically";
    default:
      return "a live receipt";
  }
}

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

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  return `${[headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\n")}\n`;
}

// --- Inputs ---------------------------------------------------------------

function readRoutes() {
  const abs = join(repoRoot, ROUTES_JSON);
  check(existsSync(abs), `missing source ${ROUTES_JSON}`);
  return JSON.parse(readFileSync(abs, "utf8")).routes;
}

function catalogVersionsByChart() {
  const abs = join(repoRoot, MATRIX_CSV);
  check(existsSync(abs), `missing source ${MATRIX_CSV}`);
  const rows = parseCsv(readFileSync(abs, "utf8")).filter((r) => r.some((cell) => cell.trim() !== ""));
  const headers = rows[0];
  const ci = headers.indexOf("chart");
  const vi = headers.indexOf("version");
  const map = new Map();
  for (const r of rows.slice(1)) {
    const chart = r[ci];
    const version = r[vi];
    if (!chart) continue;
    if (!map.has(chart)) map.set(chart, new Set());
    map.get(chart).add(version);
  }
  return map;
}

// --- Projection -----------------------------------------------------------

function buildPackets() {
  const routes = readRoutes();
  const catalogVersions = catalogVersionsByChart();
  const packets = routes.map((route) => {
    const disposition = dispositionFor(route);
    const lifecyclePhase = phaseFor(route, disposition);
    const actionKind = actionKindFor(route);
    const alternatives = (route.alternatives ?? []).map((alt) => alt.route);
    const catalog = catalogVersions.get(route.chart);
    const drift = catalog && !catalog.has(route.version)
      ? `route source version ${route.version}; catalog has ${[...catalog].sort().join(", ")}`
      : "";
    // automatic is true only when the product itself executes the route AND
    // evidence proves it. No route is product-executes today, so this is false.
    const automatic = route.execution_mode === "product-executes" && route.safe_as_automatic === true;
    return {
      chart: route.chart,
      version: route.version,
      base: route.base_or_variant ?? "",
      quirk_class: route.quirk_class,
      route_name: route.route_name,
      disposition,
      source_disposition: route.disposition,
      source_live_status: route.live_status ?? "",
      lifecycle_phase: lifecyclePhase,
      action_kind: actionKind,
      execution_mode: route.execution_mode,
      automatic,
      required_target_facts: route.route_requirements ?? "",
      human_command: HUMAN_COMMAND[actionKind] ?? "",
      evidence_required: evidenceRequiredFor(disposition),
      source_drift: drift,
      evidence_or_next_action: route.evidence_or_next_action ?? "",
      _alternatives: alternatives,
      _route: route,
    };
  });
  packets.sort((a, b) =>
    `${a.chart}|${a.version}|${a.quirk_class}|${a.route_name}`.localeCompare(
      `${b.chart}|${b.version}|${b.quirk_class}|${b.route_name}`,
    ),
  );
  return packets;
}

// --- Outputs --------------------------------------------------------------

const CSV_HEADERS = [
  "chart",
  "version",
  "base",
  "quirk_class",
  "route_name",
  "disposition",
  "source_disposition",
  "lifecycle_phase",
  "action_kind",
  "execution_mode",
  "automatic",
  "required_target_facts",
  "human_command",
  "evidence_required",
  "source_drift",
  "evidence_or_next_action",
];

function buildSchema() {
  return `${JSON.stringify(
    {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "https://confighub.com/helm-expt/schemas/lifecycle-route-action.schema.json",
      title: "Lifecycle Route Action Packet",
      description:
        "A machine-readable plan for one hook or hook-like lifecycle behavior: phase, action kind, required facts, evidence required, and an explicit automatic flag. UNOFFICIAL/EXPERIMENTAL. Generated by scripts/generate-lifecycle-route-actions.mjs.",
      type: "object",
      additionalProperties: false,
      required: [
        "chart",
        "version",
        "quirk_class",
        "route_name",
        "disposition",
        "lifecycle_phase",
        "action_kind",
        "execution_mode",
        "automatic",
        "evidence_required",
      ],
      properties: {
        chart: { type: "string" },
        version: { type: "string" },
        base: { type: "string" },
        quirk_class: { type: "string" },
        route_name: { type: "string" },
        disposition: { enum: DISPOSITIONS },
        source_disposition: { type: "string", description: "Raw disposition from data/lifecycle-routes (observed/routed/per-target/refused/todo)." },
        source_live_status: { type: "string" },
        lifecycle_phase: { enum: PHASES },
        action_kind: { enum: ACTION_KINDS },
        execution_mode: { enum: ["product-executes", "user-executes", "target-owned", "not-yet-executable"] },
        automatic: {
          type: "boolean",
          description: "true only when the product itself executes the route AND committed evidence proves it. Otherwise false.",
        },
        required_target_facts: { type: "string" },
        human_command: { type: "string", description: "Placeholder command, not a verified command. May be empty." },
        alternatives: { type: "array", items: { type: "string" }, description: "Off-ramp route names." },
        agent_inputs: { type: "object", description: "Stable machine-readable inputs for selecting and planning this route." },
        evidence_required: { type: "string", description: "What must exist before the row can advance to observed/supported." },
        source_drift: { type: "string", description: "Named drift between the route source version and the catalog version. Empty when none." },
        evidence_or_next_action: { type: "string" },
      },
    },
    null,
    2,
  )}\n`;
}

function buildJson(packets) {
  return `${JSON.stringify(
    {
      kind: "LifecycleRouteActions",
      unofficial: true,
      description:
        "Action packets projected from data/lifecycle-routes/routes.json. Each row is a checkable plan for a hook/lifecycle behavior; automatic is false unless evidence proves product execution. Generated by scripts/generate-lifecycle-route-actions.mjs; do not hand-edit.",
      schema: "schemas/lifecycle-route-action.schema.json",
      sources: [ROUTES_JSON, MATRIX_CSV],
      vocabulary: { disposition: DISPOSITIONS, lifecycle_phase: PHASES, action_kind: ACTION_KINDS },
      source_disposition_crosswalk: SOURCE_DISPOSITION_CROSSWALK,
      not_yet_projected: [
        "jetstack/cert-manager + external-secrets lifecycle observations (data/lifecycle-observations/cert-manager-eso) — observed via that lane, not in the hook-disposition source; illustrated in the user doc.",
        "hashicorp/consul UI Ingress per-target controller-health decision — illustrated in the user doc; not a hook-disposition row.",
      ],
      actions: packets.map((p) => ({
        chart: p.chart,
        version: p.version,
        base: p.base,
        quirk_class: p.quirk_class,
        route_name: p.route_name,
        disposition: p.disposition,
        source_disposition: p.source_disposition,
        source_live_status: p.source_live_status,
        lifecycle_phase: p.lifecycle_phase,
        action_kind: p.action_kind,
        execution_mode: p.execution_mode,
        automatic: p.automatic,
        required_target_facts: p.required_target_facts,
        human_command: p.human_command,
        alternatives: p._alternatives,
        agent_inputs: {
          route_name: p.route_name,
          default_route: p._route.default_route ?? p.route_name,
          alternatives: p._alternatives,
          lifecycle_phase: p.lifecycle_phase,
          action_kind: p.action_kind,
          required_target_facts: p.required_target_facts,
          disposition: p.disposition,
        },
        evidence_required: p.evidence_required,
        source_drift: p.source_drift,
        evidence_or_next_action: p.evidence_or_next_action,
      })),
    },
    null,
    2,
  )}\n`;
}

function countBy(packets, key) {
  const counts = new Map();
  for (const p of packets) counts.set(p[key], (counts.get(p[key]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
}

function mdCount(title, pairs) {
  return [`| ${title} | Packets |`, "| --- | ---: |", ...pairs.map(([k, v]) => `| \`${k}\` | ${v} |`)].join("\n");
}

function buildSummary(packets) {
  const automaticCount = packets.filter((p) => p.automatic).length;
  const driftRows = packets.filter((p) => p.source_drift);
  return `# Lifecycle Route Actions

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`scripts/generate-lifecycle-route-actions.mjs\`. Do not hand-edit. Regenerate
with \`npm run lifecycle:route-actions\`.

This projects the legible lifecycle-route contract
([../lifecycle-routes/](../lifecycle-routes/summary.md)) into machine-readable
**action packets**: per route, the lifecycle phase, the action kind, required
target facts, an agent-readable input block, the evidence required to advance,
and an explicit \`automatic\` flag. It lets a UI or agent turn "where a
hook/lifecycle action should go" into a checkable preflight/action/observe plan
— without claiming live or automatic execution.

Schema: [schemas/lifecycle-route-action.schema.json](../../schemas/lifecycle-route-action.schema.json).
Forms: [actions.csv](./actions.csv), [actions.json](./actions.json) (agent
interface), field definitions in [contract.md](./contract.md).

## The honest flag

${automaticCount} of ${packets.length} packets are \`automatic\`. No route is
executed by the product today, so \`automatic\` is \`false\` everywhere; a packet
is a *plan*, not a claim that anything ran. \`automatic\` only becomes \`true\`
when \`execution_mode\` is \`product-executes\` and committed evidence proves it.

## Distribution

${mdCount("Disposition", countBy(packets, "disposition"))}

${mdCount("Lifecycle phase", countBy(packets, "lifecycle_phase"))}

${mdCount("Action kind", countBy(packets, "action_kind"))}

## Named source drift

${
  driftRows.length
    ? `${driftRows.length} packet(s) carry a source-version drift, named (not hidden):\n\n${driftRows
        .map((p) => `- \`${p.chart}\`: ${p.source_drift}`)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join("\n")}`
    : "No source-version drift detected."
}

## Not yet projected

These hook-like lifecycle behaviors are real but are not in the hook-disposition
source, so they are not projected here yet. They are illustrated in the user doc
([../../docs/user/chart-hooks-what-happens.md](../../docs/user/chart-hooks-what-happens.md)):

- **cert-manager / External Secrets** webhook + CRD lifecycle — observed in
  \`data/lifecycle-observations/cert-manager-eso/\` (CRD ownership per target,
  \`startupapicheck\` as a post-apply API dry-run), not a hook-disposition row.
- **Consul UI Ingress** — a per-target controller-health decision, not a
  hook-disposition row.

Folding those sources into this projection (so they get action packets too) is
the next primitive worth adding to the model.

## How To Read One Packet

\`route_name\` is the route; \`lifecycle_phase\` is when it happens (pre-render →
preflight → pre-apply → post-apply → observe, or refuse); \`action_kind\` is what
kind of step it is; \`disposition\` is one of \`${DISPOSITIONS.join(", ")}\`;
\`automatic\` says whether the product runs it (always \`false\` today);
\`required_target_facts\` and \`human_command\` are the inputs; \`agent_inputs\`
(JSON) is the stable block an agent selects from; \`evidence_required\` is what
must exist before the row can advance to observed.

## Boundaries

- Static projection of committed data. No hook is executed, no cluster touched,
  no ConfigHub state changed, no \`runs/\` receipt edited.
- A packet is a plan, not a proof. \`observed\` packets point at the receipt in
  \`evidence_or_next_action\`; the rest name what is still required.
`;
}

function buildContract() {
  const phaseRows = Object.entries(ROUTE_PHASE).map(([r, p]) => `| \`${r}\` | \`${p}\` | \`${ROUTE_ACTION_KIND[r]}\` |`).join("\n");
  const crosswalkRows = Object.entries(SOURCE_DISPOSITION_CROSSWALK).map(([s, d]) => `| \`${s}\` | \`${d}\` |`).join("\n");
  return `# Lifecycle Route Action Contract

**UNOFFICIAL/EXPERIMENTAL.** Field definitions and projection rules for
[actions.csv](./actions.csv) / [actions.json](./actions.json), generated with
the data from the same constants so they cannot drift. Machine schema:
[../../schemas/lifecycle-route-action.schema.json](../../schemas/lifecycle-route-action.schema.json).

## Purpose

Turn each legible lifecycle route into a checkable plan a UI or agent can act on
— phase, action kind, required facts, evidence required — while keeping the
honest boundary that a known route is **not** an automatically executed one.

## Columns

| Column | Meaning |
| --- | --- |
| \`chart\` / \`version\` / \`base\` | Subject. |
| \`quirk_class\` / \`route_name\` | The route identity, from lifecycle-routes. |
| \`disposition\` | Executability: \`${DISPOSITIONS.join("\`, \`")}\`. |
| \`source_disposition\` / \`source_live_status\` | The raw lifecycle-routes values, for traceability. |
| \`lifecycle_phase\` | \`${PHASES.join("\`, \`")}\`. |
| \`action_kind\` | What kind of step it is (see table). |
| \`execution_mode\` | Who would run it: product-executes / user-executes / target-owned / not-yet-executable. |
| \`automatic\` | \`true\` only when \`execution_mode\` is \`product-executes\` AND evidence proves it. False otherwise. |
| \`required_target_facts\` | What the target must supply. |
| \`human_command\` | A placeholder command (not verified). May be empty. |
| \`evidence_required\` | What must exist before the row can advance to observed/supported. |
| \`source_drift\` | Named version drift vs the catalog; empty when none. |
| \`evidence_or_next_action\` | Receipt path when observed, else the next step. |

\`actions.json\` adds \`alternatives\` (off-ramp routes) and \`agent_inputs\` (the
stable selection block).

## Invariants (enforced by --verify)

1. Every routed/per-target lifecycle route has an action packet.
2. No packet is \`automatic: true\` without committed evidence — and none is today.
3. \`disposition\` / \`lifecycle_phase\` / \`action_kind\` never drift from the
   published vocabularies above.
4. Version drift is **named** in \`source_drift\`, never hidden.

## Source disposition crosswalk

lifecycle-routes disposition (+ live status) → action disposition:

| Source | Action disposition |
| --- | --- |
${crosswalkRows}

## Route → phase / action kind

| route_name | lifecycle_phase | action_kind |
| --- | --- | --- |
${phaseRows}

(For a \`refused\` route the phase is \`refuse\`.)

## Determinism

A pure function of \`${ROUTES_JSON}\` and \`${MATRIX_CSV}\`. No timestamps, no
network, no cluster. Regenerate with \`npm run lifecycle:route-actions\`; verify
byte-for-byte plus invariants with \`npm run lifecycle:route-actions:verify\`.
`;
}

// --- Verify invariants ----------------------------------------------------

function checkInvariants(packets) {
  for (const p of packets) {
    check(DISPOSITIONS.includes(p.disposition), `packet ${p.chart}/${p.route_name}: disposition "${p.disposition}" not in vocabulary`);
    check(PHASES.includes(p.lifecycle_phase), `packet ${p.chart}/${p.route_name}: phase "${p.lifecycle_phase}" not in vocabulary`);
    check(ACTION_KINDS.includes(p.action_kind), `packet ${p.chart}/${p.route_name}: action_kind "${p.action_kind}" not in vocabulary`);
    if (p.automatic) {
      check(/runs\//.test(p.evidence_or_next_action), `packet ${p.chart}/${p.route_name}: automatic=true without a committed receipt`);
    }
    if (p.source_drift) {
      check(p.source_drift.includes("route source version"), `packet ${p.chart}/${p.route_name}: drift present but not named`);
    }
  }
  // Coverage: every routed/per-target source route is projected.
  const routed = readRoutes().filter((r) => ["routed", "per-target"].includes(r.disposition));
  for (const r of routed) {
    const found = packets.some((p) => p.chart === r.chart && p.version === r.version && p.route_name === r.route_name);
    check(found, `routed/per-target route ${r.chart}/${r.route_name} has no action packet`);
  }
}

// --- Main -----------------------------------------------------------------

function buildAll() {
  const packets = buildPackets();
  return {
    packets,
    schema: buildSchema(),
    csv: toCsv(CSV_HEADERS, packets),
    json: buildJson(packets),
    summary: buildSummary(packets),
    contract: buildContract(),
  };
}

if (mode === "--generate") {
  const out = buildAll();
  checkInvariants(out.packets);
  write(schemaPath, out.schema);
  write(csvPath, out.csv);
  write(jsonPath, out.json);
  write(summaryPath, out.summary);
  write(contractPath, out.contract);
  console.log(`wrote lifecycle route actions -> ${relativeRepo(outDir)}/ + schema (${out.packets.length} packets)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.packets);
  for (const [path, expected] of [
    [schemaPath, out.schema],
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
    [contractPath, out.contract],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run lifecycle:route-actions`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run lifecycle:route-actions`);
  }
  console.log(`verified lifecycle route actions for ${out.packets.length} packets`);
} else {
  console.log(`Usage:
  node scripts/generate-lifecycle-route-actions.mjs --generate
  node scripts/generate-lifecycle-route-actions.mjs --verify`);
}
