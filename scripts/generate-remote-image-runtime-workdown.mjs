#!/usr/bin/env node

// Remote-image runtime workdown.
//
// Turns the remote-image watch rows (parity passed, but the workload cannot pull
// its image) into concrete product/base decisions: which need a chart/base
// refresh, which take a supported image override, which need a digest/mirror
// policy, which are a hook/lifecycle-image route, and which should stay
// watch/refused until the publisher restores the image.
//
// Read-only projection over committed evidence:
//   - data/live-parity-decisions/decisions.csv  (rows where residue_category=remote-image)
//   - the linked receipts under runs/live-helm-confighub-compare/*/receipt.yaml
//     (exact missing image refs, where they fail, whether both legs fail)
//   - data/image-digest-workdown/all-subjects.csv (fallback image refs)
//   - committed recipe effective-values.yaml (candidate override path, if present)
// It runs nothing, mutates no ConfigHub state, and edits no runs/ receipts.
// --verify regenerates and byte-compares, and FAILS if any row lacks a missing
// image, a product action, an owner class, or a next action.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const DECISIONS = "data/live-parity-decisions/decisions.csv";
const ALL_SUBJECTS = "data/image-digest-workdown/all-subjects.csv";

const outDir = join(repoRoot, "data", "remote-image-runtime-workdown");
const csvPath = join(outDir, "workdown.csv");
const jsonPath = join(outDir, "workdown.json");
const summaryPath = join(outDir, "summary.md");

const ACTIONS = new Set([
  "refresh-chart-or-base",
  "supported-image-override",
  "pin-or-mirror-digest",
  "route-lifecycle-image",
  "watch-upstream",
  "refuse-until-publisher-restores",
]);
const OWNERS = new Set(["catalog-refresh", "base-design", "registry-policy", "lifecycle-route", "upstream-watch"]);

const NEXT_ACTION = {
  "refresh-chart-or-base":
    "Refresh the catalog base to a chart version whose pinned image still exists upstream, or pin a retained digest; the current pinned tag(s) were removed from the publisher registry.",
  "route-lifecycle-image":
    "Route the pre-install lifecycle action and supply or refresh its image (the missing image is in a hook/lifecycle job); see the chart's lifecycle-route artifact.",
  "supported-image-override":
    "Provide a concrete image in a supported base; the chart renders `image: auto` for sidecar injection, which is not present on a vanilla target.",
  "pin-or-mirror-digest":
    "Pin a retained digest or configure a registry mirror/pull-secret for the missing image.",
  "watch-upstream":
    "Keep watch-grade and re-check whether the publisher restores the image.",
  "refuse-until-publisher-restores":
    "Refuse the base for support until the publisher restores a pullable image.",
};

// --- CSV ------------------------------------------------------------------

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

function readCsv(rel) {
  const abs = join(repoRoot, rel);
  check(existsSync(abs), `missing source ${rel}`);
  const rows = parseCsv(readFileSync(abs, "utf8")).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, idx) => [h, cells[idx] ?? ""])));
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  return `${[headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\n")}\n`;
}

// --- Receipt extraction ---------------------------------------------------

const IMAGE_PULL = /imagepull|errimagepull|invalidimagename|imageinspecterror/i;

function notReadyOf(leg) {
  return (leg?.runtime?.notReady ?? []).map((p) => ({ pod: String(p.pod ?? ""), status: String(p.status ?? "") }));
}

function imageLocation(pods) {
  if (pods.length === 0) return "unknown";
  if (pods.some((p) => /^init:/i.test(p.status))) return "init-container";
  if (pods.some((p) => /certgen|hook|-job\b|migration|provision/i.test(p.pod))) return "hook/lifecycle-job";
  return "container";
}

function hasImagePull(pods) {
  return pods.some((p) => IMAGE_PULL.test(p.status));
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function recommend(missingImages, location) {
  // image: auto is an injection placeholder (e.g. istio gateway) -> needs a concrete image.
  if (missingImages.includes("auto")) return { action: "supported-image-override", owner: "base-design" };
  // A removed publisher tag is the root cause wherever it appears (container, init, or
  // hook): the fix is a chart/base refresh, even when the failing pod is a hook job.
  if (missingImages.some((i) => /docker\.io\/bitnami/.test(i))) return { action: "refresh-chart-or-base", owner: "catalog-refresh" };
  // The image is otherwise pullable but lives in a hook/lifecycle job that config-only
  // delivery does not run -> route the lifecycle action and supply its image.
  if (location === "hook/lifecycle-job") return { action: "route-lifecycle-image", owner: "lifecycle-route" };
  return { action: "pin-or-mirror-digest", owner: "registry-policy" };
}

function overridePath(chart, version, missingImages) {
  if (missingImages.includes("auto")) {
    return "set a concrete image in a supported base, or deploy the injector (chart renders image: auto; no image value in committed base)";
  }
  const ev = join(repoRoot, "recipes", chart, version, "effective-values.yaml");
  if (existsSync(ev) && /(^|\n)\s*(image|global)\s*:/.test(readFileSync(ev, "utf8"))) {
    return `see recipes/${chart}/${version}/effective-values.yaml image keys`;
  }
  return "unknown — no image override in committed recipe artifacts (chart uses its default image.* values)";
}

// --- Build ----------------------------------------------------------------

const CSV_HEADERS = [
  "chart",
  "version",
  "base",
  "receipt",
  "missing_images",
  "image_location",
  "both_helm_and_confighub_fail",
  "candidate_override_path",
  "current_off_ramp",
  "recommended_action",
  "owner_class",
  "next_action",
];

function buildRows() {
  const decisions = readCsv(DECISIONS).filter((r) => r.residue_category === "remote-image");
  const allSub = new Map();
  for (const s of readCsv(ALL_SUBJECTS)) allSub.set(`${s.chart}|${s.version}|${s.variant}`, s.example_unpinned_images ?? "");

  const rows = decisions.map((d) => {
    const abs = join(repoRoot, d.receipt);
    check(existsSync(abs), `${d.chart}/${d.variant}: receipt missing ${d.receipt}`);
    const receipt = readYaml(abs);
    const legs = receipt?.spec?.legs ?? {};
    const ociImages = legs.configHubOciArgo?.argoStatus?.summary?.images ?? [];
    const fallback = (allSub.get(`${d.chart}|${d.version}|${d.variant}`) ?? "").split(";");
    const missingImages = uniq(ociImages.length ? ociImages : fallback);

    const rhPods = notReadyOf(legs.regularHelm);
    const directPods = notReadyOf(legs.configHubKubectlApply);
    const ociPods = notReadyOf(legs.configHubOciArgo);
    // Location comes from the regular-Helm leg: it runs the full install including
    // hooks, so it is the authoritative view of where the chart's image fails.
    // (Config-only ConfigHub legs do not run hooks, so their pod set differs.)
    const location = imageLocation(rhPods.length ? rhPods : [...directPods, ...ociPods]);
    const rhImg = hasImagePull(rhPods);
    const chImg = hasImagePull(directPods) || hasImagePull(ociPods);
    const bothFail = rhImg && chImg ? "both" : rhImg ? "regular-helm-only" : chImg ? "confighub-only" : "recorded-via-argo-images";

    const { action, owner } = recommend(missingImages, location);

    return {
      chart: d.chart,
      version: d.version,
      base: d.variant,
      receipt: d.receipt,
      missing_images: missingImages.join("; "),
      image_location: location,
      both_helm_and_confighub_fail: bothFail,
      candidate_override_path: overridePath(d.chart, d.version, missingImages),
      current_off_ramp: (d.next_action ?? "").replace(/\s+/g, " ").trim(),
      recommended_action: action,
      owner_class: owner,
      next_action: NEXT_ACTION[action],
    };
  });
  rows.sort((a, b) => `${a.chart}|${a.version}|${a.base}`.localeCompare(`${b.chart}|${b.version}|${b.base}`));
  return rows;
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])));
}

function mdCount(title, pairs) {
  return [`| ${title} | Rows |`, "| --- | ---: |", ...pairs.map(([k, v]) => `| \`${k || "(blank)"}\` | ${v} |`)].join("\n");
}

function buildJson(rows) {
  return `${JSON.stringify(
    {
      kind: "RemoteImageRuntimeWorkdown",
      unofficial: true,
      description:
        "Product/base decisions for the remote-image watch rows: per row, the exact missing image, where it fails, whether both Helm and ConfigHub fail, a candidate override path (or unknown), and a recommended product action + owner class. Read-only projection over committed receipts and decision surfaces. Generated by scripts/generate-remote-image-runtime-workdown.mjs; do not hand-edit.",
      sources: [DECISIONS, "runs/live-helm-confighub-compare/*/receipt.yaml", ALL_SUBJECTS],
      rowCount: rows.length,
      byAction: Object.fromEntries(countBy(rows, "recommended_action")),
      byOwner: Object.fromEntries(countBy(rows, "owner_class")),
      rows,
    },
    null,
    2,
  )}\n`;
}

function buildSummary(rows) {
  const lines = [];
  lines.push("# Remote-Image Runtime Workdown");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by");
  lines.push("`scripts/generate-remote-image-runtime-workdown.mjs`. Do not hand-edit. Regenerate");
  lines.push("with `npm run remote-image-runtime-workdown`.");
  lines.push("");
  lines.push("The `remote-image` watch rows all share one shape: **semantic parity holds, but");
  lines.push("the workload cannot pull its image** — the same failure under regular Helm,");
  lines.push("ConfigHub direct apply, and ConfigHub OCI/Argo. That is not a ConfigHub defect;");
  lines.push("it is an upstream image-availability problem. This surface turns each row into a");
  lines.push("concrete product/base decision.");
  lines.push("");
  lines.push("Source rows: [live-parity-decisions](../live-parity-decisions/summary.md)");
  lines.push("(`residue_category=remote-image`); image family defined in");
  lines.push("[residue-families](../../docs/reference/residue-families.md). Image-pin context:");
  lines.push("[image-digest-workdown](../image-digest-workdown/summary.md).");
  lines.push("");
  lines.push("## Recommended actions");
  lines.push("");
  lines.push(mdCount("Recommended action", countBy(rows, "recommended_action")));
  lines.push("");
  lines.push(mdCount("Owner class", countBy(rows, "owner_class")));
  lines.push("");
  lines.push("## Rows");
  lines.push("");
  lines.push("| Chart | Base | Missing image(s) | Where | Both fail | Action | Owner |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    lines.push(`| ${r.chart}@${r.version} | ${r.base} | ${r.missing_images} | ${r.image_location} | ${r.both_helm_and_confighub_fail} | ${r.recommended_action} | ${r.owner_class} |`);
  }
  lines.push("");
  lines.push("## How to read a row");
  lines.push("");
  lines.push("- **missing_images** is taken from the committed receipt (the workload's image");
  lines.push("  set); **image_location** says whether it fails in a main container, an init");
  lines.push("  container, or a hook/lifecycle job.");
  lines.push("- **candidate_override_path** is only filled when committed recipe artifacts");
  lines.push("  actually expose an image value; otherwise it is `unknown` — this surface does");
  lines.push("  not invent an override path.");
  lines.push("- **recommended_action** / **owner_class** route the fix: a removed publisher tag");
  lines.push("  is a `refresh-chart-or-base` (catalog), a hook-job image is a");
  lines.push("  `route-lifecycle-image` (lifecycle), and an `image: auto` injection placeholder");
  lines.push("  is a `supported-image-override` (base design).");
  lines.push("");
  lines.push("## Boundaries");
  lines.push("");
  lines.push("- Read-only over committed receipts and decision surfaces. No live run, no");
  lines.push("  registry call, no `runs/` edit, no status change.");
  lines.push("- A recommended action is a routed product decision, not a claim that the image");
  lines.push("  is fixed. These rows stay `watch` until a refreshed/overridden image is proven.");
  lines.push("");
  return `${lines.join("\n")}`;
}

// --- Invariants -----------------------------------------------------------

function checkInvariants(rows) {
  const decisions = readCsv(DECISIONS).filter((r) => r.residue_category === "remote-image");
  check(rows.length === decisions.length, `workdown row count ${rows.length} != remote-image rows ${decisions.length}`);
  for (const r of rows) {
    check(r.missing_images.trim() !== "", `${r.chart}/${r.base}: missing image reference not extracted`);
    check(ACTIONS.has(r.recommended_action), `${r.chart}/${r.base}: unknown recommended_action ${r.recommended_action}`);
    check(OWNERS.has(r.owner_class), `${r.chart}/${r.base}: unknown owner_class ${r.owner_class}`);
    check(r.next_action.trim() !== "", `${r.chart}/${r.base}: missing next_action`);
  }
}

// --- Main -----------------------------------------------------------------

function buildAll() {
  const rows = buildRows();
  return {
    rows,
    csv: toCsv(CSV_HEADERS, rows),
    json: buildJson(rows),
    summary: buildSummary(rows),
  };
}

if (mode === "--generate") {
  const out = buildAll();
  checkInvariants(out.rows);
  write(csvPath, out.csv);
  write(jsonPath, out.json);
  write(summaryPath, out.summary);
  console.log(`wrote remote-image runtime workdown -> ${relativeRepo(outDir)}/ (${out.rows.length} rows)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.rows);
  for (const [path, expected] of [
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run remote-image-runtime-workdown`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run remote-image-runtime-workdown`);
  }
  console.log(`verified remote-image runtime workdown for ${out.rows.length} rows`);
} else {
  console.log(`Usage:
  node scripts/generate-remote-image-runtime-workdown.mjs --generate
  node scripts/generate-remote-image-runtime-workdown.mjs --verify`);
}
