#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1];
};
const baseUrl = new URL(valueAfter("--base-url", "https://confighub.github.io/helm-expt/site/"));
const outDir = resolve(repoRoot, valueAfter("--out-dir", "data/site-persona-simulations-2026-08-13"));
const maxClicks = Number(valueAfter("--max-clicks", "5"));
const currentLabel = valueAfter("--current-label", "Ask");
const compareWith = valueAfter("--compare-with", "");

const starts = [
  "index.html",
  "guides.html",
  "ask.html",
  "charts/index.html",
  "try.html",
  "testing.html",
  "how-it-works.html",
  "docs.html",
  "confighub.html",
];

const g = (category, code, goal, query, groups, actions, format = "Helm") => ({
  category,
  code,
  goal,
  query,
  groups,
  actions,
  format,
});

const personas = [
  {
    id: "developer",
    label: "Application developer using AI-written configuration",
    routeBoosts: ["ask", "catalog", "try", "values", "example", "confighub"],
    goals: [
      g("comprehension", "D-C1", "understand what this site does", ["understand", "test", "configuration"], [["catalog", "configuration"], ["test", "inspect", "check"]], ["search", "try", "ask"], "mixed"),
      g("comprehension", "D-C2", "understand Catalog versus my own case", ["catalog", "own", "case"], [["catalog"], ["own values", "new version", "unexpected"]], ["ask", "search"], "mixed"),
      g("comprehension", "D-C3", "understand cub installer", ["cub", "installer", "render"], [["cub installer"], ["render", "writes", "files"], ["does not apply", "nothing has touched"]], ["install", "setup", "try"]),
      g("comprehension", "D-C4", "understand what ConfigHub adds", ["confighub", "shared", "diff"], [["confighub"], ["shared", "keep", "store"], ["diff", "promote", "release"]], ["account", "tutorial", "confighub"], "mixed"),
      g("navigation", "D-N1", "find a checked Redis configuration", ["redis", "checked", "catalog"], [["redis"], ["configuration", "package", "preset"]], ["render", "try", "script", "catalog"]),
      g("navigation", "D-N2", "find help for AI-written Helm values", ["ai", "values", "helm"], [["ai", "agent"], ["values"], ["review", "check", "render"]], ["ask", "prompt", "example"]),
      g("navigation", "D-N3", "find the AICR starting example", ["aicr", "ai infrastructure"], [["aicr"], ["example", "walkthrough", "recipe"]], ["start", "walkthrough", "example"], "AICR"),
      g("navigation", "D-N4", "find an existing OCI package example", ["existing", "oci", "inspect"], [["oci"], ["inspect", "transform", "package"]], ["inspect", "transform", "walkthrough"], "OCI"),
      g("action", "D-A1", "render Redis locally without an account", ["redis", "local", "no account"], [["redis"], ["no account"], ["cub installer", "render"]], ["setup", "install", "copy"]),
      g("action", "D-A2", "build a question for my own values", ["own values", "question", "prompt"], [["question"], ["values", "chart"], ["prompt", "assistant"]], ["build", "copy prompt", "ask"]),
      g("action", "D-A3", "inspect plain Kubernetes YAML", ["kubernetes yaml", "inspect"], [["kubernetes yaml", "plain yaml"], ["inspect", "upload", "objects"]], ["start", "guide", "example"], "YAML"),
      g("action", "D-A4", "write reviewed objects as OCI", ["reviewed", "objects", "oci"], [["oci"], ["reviewed", "rendered"], ["output", "publish", "write"]], ["output-oci", "flux push", "oras", "publish", "transform"], "OCI"),
      g("recovery", "D-R1", "recover when my chart is missing", ["chart", "not listed", "missing"], [["chart not listed", "not answered", "missing"], ["check my config", "render locally"]], ["build", "helm template", "report"]),
      g("recovery", "D-R2", "find why Helm ignored my value", ["ignored", "value", "helm"], [["ignored", "did helm ignore"], ["value"]], ["build", "prompt", "ask"]),
      g("recovery", "D-R3", "keep a private configuration private", ["private", "configuration", "local"], [["private"], ["local", "machine"], ["do not upload", "keep secrets"]], ["ask", "prompt", "keep"]),
      g("recovery", "D-R4", "find what to do after a surprising render", ["unexpected", "render", "next"], [["unexpected", "surprising", "not checked"], ["ask", "known gaps", "inspect"]], ["ask", "check", "report"]),
      g("conversion", "D-X1", "save a reviewed result for my team", ["save", "reviewed", "team"], [["reviewed"], ["shared", "team"], ["configHub", "account"]], ["create an account", "save", "upload"]),
      g("conversion", "D-X2", "compare development and production", ["development", "production", "diff"], [["development", "dev"], ["production", "prod"], ["diff", "variant", "compare"]], ["variant", "promote", "tutorial"]),
      g("conversion", "D-X3", "promote a reviewed change", ["promote", "reviewed", "change"], [["promote", "promotion"], ["reviewed", "approval"]], ["tutorial", "variant", "promote"]),
      g("conversion", "D-X4", "continue into ConfigHub", ["confighub", "account", "tutorial"], [["confighub"], ["account"], ["tutorial", "create"]], ["create an account", "open the tutorial"]),
    ],
  },
  {
    id: "gitops",
    label: "GitOps operator responsible for delivery",
    routeBoosts: ["deployment", "argo", "flux", "oci", "hooks", "crd", "known gaps"],
    goals: [
      g("comprehension", "O-C1", "confirm this does not replace Helm", ["keep helm", "not replace"], [["helm"], ["keep", "not instead", "does not replace"]], ["compare", "deployment"]),
      g("comprehension", "O-C2", "confirm Argo CD or Flux still delivers", ["argo", "flux", "delivery"], [["argo cd", "flux"], ["deliver", "controller", "gitops"]], ["guide", "deployment", "oci"]),
      g("comprehension", "O-C3", "understand OCI in and OCI out", ["oci", "input", "output"], [["oci"], ["input", "pull", "source"], ["output", "publish", "release"]], ["inspect", "transform", "publish"], "OCI"),
      g("comprehension", "O-C4", "understand hooks and CRDs", ["hooks", "crds", "lifecycle"], [["hook"], ["crd"], ["lifecycle", "order", "route"]], ["guide", "review", "include-hooks"]),
      g("navigation", "O-N1", "find the hook handling guide", ["hook", "guide"], [["hook"], ["guide", "lifecycle", "route"]], ["open", "guide", "walkthrough"]),
      g("navigation", "O-N2", "find CRD ownership and ordering", ["crd", "ownership", "ordering"], [["crd"], ["owner", "ordering", "install first"]], ["guide", "known gaps", "no-crds"]),
      g("navigation", "O-N3", "find an Argo CD OCI example", ["argo cd", "oci", "example"], [["argo cd"], ["oci"], ["example", "application", "source"]], ["guide", "walkthrough", "proof"]),
      g("navigation", "O-N4", "find a Flux OCI example", ["flux", "oci", "example"], [["flux"], ["oci"], ["example", "artifact", "source"]], ["guide", "walkthrough", "proof"]),
      g("action", "O-A1", "render and inspect without applying", ["render", "inspect", "not apply"], [["render", "writes"], ["inspect"], ["does not apply", "nothing has touched"]], ["cub installer setup", "try"]),
      g("action", "O-A2", "publish rendered files as OCI", ["rendered", "oci", "publish"], [["rendered"], ["oci"], ["publish", "output-oci", "push"]], ["output-oci", "flux push", "publish"], "OCI"),
      g("action", "O-A3", "deliver with kubectl", ["kubectl", "apply", "manifests"], [["kubectl"], ["apply"], ["manifest", "files"]], ["kubectl apply"]),
      g("action", "O-A4", "deliver with Argo CD or Flux", ["argo", "flux", "deliver"], [["argo cd", "flux"], ["oci", "source"], ["deliver", "apply", "pull"]], ["application", "ocirepository", "guide"]),
      g("recovery", "O-R1", "handle an object removed during upgrade", ["prune", "removed", "upgrade"], [["prune", "does not remove"], ["upgrade", "apply"]], ["known gaps", "argo", "flux"]),
      g("recovery", "O-R2", "handle CRDs on first install", ["crd", "first install", "wait"], [["crd"], ["install", "first"], ["wait", "ordering"]], ["known gaps", "install"]),
      g("recovery", "O-R3", "understand a Helm hook result", ["helm hook", "lifecycle", "result"], [["hook"], ["lifecycle", "ordinary resource", "execute"]], ["include-hooks", "guide", "route"]),
      g("recovery", "O-R4", "find delivery limitations", ["delivery", "known gaps", "limits"], [["known gaps", "limit"], ["delivery", "apply", "gitops"]], ["read known gaps", "verification"]),
      g("conversion", "O-X1", "store the reviewed configuration", ["store", "reviewed", "configuration"], [["reviewed"], ["store", "keep", "shared"], ["confighub"]], ["upload", "create an account"]),
      g("conversion", "O-X2", "promote and publish a release", ["promote", "publish", "release"], [["promote"], ["release"], ["publish", "oci"]], ["tutorial", "promotion", "release"]),
      g("conversion", "O-X3", "compare desired and live state", ["desired", "live", "compare"], [["desired"], ["live"], ["compare", "observation"]], ["connect", "observe", "guide"]),
      g("conversion", "O-X4", "keep GitOps while adding ConfigHub", ["keep", "gitops", "confighub"], [["configHub"], ["argo cd", "flux", "gitops"], ["keep", "remain"]], ["guide", "account", "tutorial"]),
    ],
  },
  {
    id: "platform",
    label: "Platform engineer managing environments and fleets",
    routeBoosts: ["variants", "promotion", "fleet", "apps", "confighub", "testing"],
    goals: [
      g("comprehension", "P-C1", "understand base and derived variants", ["base", "derived", "variant"], [["base"], ["derived"], ["variant"]], ["variants", "guide"]),
      g("comprehension", "P-C2", "understand environment promotion", ["development", "staging", "production", "promote"], [["development", "dev"], ["production", "prod"], ["promote", "promotion"]], ["tutorial", "walkthrough"]),
      g("comprehension", "P-C3", "understand fleet rollout", ["fleet", "rollout", "clusters"], [["fleet"], ["rollout", "wave"], ["cluster", "target"]], ["example", "walkthrough", "proof"]),
      g("comprehension", "P-C4", "understand account and cluster boundaries", ["account", "cluster", "local"], [["account"], ["cluster"], ["local", "laptop"]], ["try", "account", "tutorial"]),
      g("navigation", "P-N1", "find the variants guide", ["variants", "guide"], [["variant"], ["base", "derived"]], ["guide", "walkthrough"]),
      g("navigation", "P-N2", "find a promotion example", ["promotion", "example"], [["promote", "promotion"], ["example", "walkthrough", "redis"]], ["walkthrough", "proof"]),
      g("navigation", "P-N3", "find the AICR platform example", ["aicr", "platform", "example"], [["aicr"], ["platform", "infrastructure"], ["example", "walkthrough"]], ["start", "walkthrough"], "AICR"),
      g("navigation", "P-N4", "find existing YAML app adoption", ["existing", "yaml", "app"], [["existing"], ["yaml", "kubernetes files"], ["app", "application"]], ["guide", "start", "upload"], "YAML"),
      g("action", "P-A1", "save a base configuration", ["save", "base", "configuration"], [["base"], ["save", "upload", "store"]], ["upload", "create", "tutorial"]),
      g("action", "P-A2", "create an environment variant", ["create", "environment", "variant"], [["variant"], ["create"], ["environment", "development", "production"]], ["cub variant", "walkthrough"]),
      g("action", "P-A3", "promote development to production", ["development", "production", "promote"], [["development", "dev"], ["production", "prod"], ["promote"]], ["promote", "tutorial"]),
      g("action", "P-A4", "assign configuration to a fleet", ["assign", "fleet", "clusters"], [["fleet"], ["cluster"], ["assign", "target", "rollout"]], ["walkthrough", "example", "target"]),
      g("recovery", "P-R1", "roll back a promoted release", ["rollback", "release", "exact"], [["rollback", "roll back"], ["release", "revision"], ["exact", "recorded"]], ["walkthrough", "restore"]),
      g("recovery", "P-R2", "pause or inspect a rollout wave", ["rollout", "wave", "pause"], [["rollout"], ["wave", "pilot"], ["pause", "check", "observe"]], ["example", "proof"]),
      g("recovery", "P-R3", "find live drift", ["drift", "live", "desired"], [["drift"], ["live"], ["desired", "approved"]], ["compare", "observe", "guide"]),
      g("recovery", "P-R4", "require approval for production", ["approval", "production", "gate"], [["approval"], ["production", "prod"], ["gate", "apply"]], ["proof", "policy", "example"]),
      g("conversion", "P-X1", "start the ConfigHub tutorial", ["confighub", "tutorial", "start"], [["configHub"], ["tutorial"], ["create", "start"]], ["create an account", "open the tutorial"]),
      g("conversion", "P-X2", "keep configuration history", ["history", "configuration", "diff"], [["history", "record"], ["configuration"], ["diff", "change"]], ["account", "tutorial"]),
      g("conversion", "P-X3", "connect Git OCI and live targets", ["git", "oci", "live", "target"], [["git"], ["oci"], ["live", "target", "observation"]], ["guide", "connect", "publish"]),
      g("conversion", "P-X4", "operate a small fleet", ["fleet", "operate", "rollout"], [["fleet"], ["rollout", "cluster"], ["configHub"]], ["example", "walkthrough", "account"]),
    ],
  },
  {
    id: "reviewer",
    label: "Security-minded release reviewer",
    routeBoosts: ["verification", "proof", "known gaps", "credentials", "digest", "ask"],
    goals: [
      g("comprehension", "S-C1", "understand checked versus not checked", ["checked", "not checked", "claim"], [["checked"], ["not checked"], ["claim", "evidence"]], ["verification", "proof"]),
      g("comprehension", "S-C2", "understand package provenance", ["package", "digest", "provenance"], [["package", "oci"], ["digest"], ["receipt", "provenance", "source"]], ["receipt", "proof", "inspect"], "OCI"),
      g("comprehension", "S-C3", "understand apply gates", ["apply", "gate", "approval"], [["apply"], ["gate", "check"], ["approval", "block", "warn"]], ["proof", "policy"]),
      g("comprehension", "S-C4", "understand rollback proof", ["rollback", "exact", "proof"], [["rollback"], ["exact", "recorded"], ["proof", "receipt", "checked"]], ["walkthrough", "verification"]),
      g("navigation", "S-N1", "find credential warnings", ["credential", "secret", "warning"], [["credential", "password", "secret"], ["warning", "blocks production", "placeholder"]], ["known gaps", "chart"]),
      g("navigation", "S-N2", "find image or package digests", ["image", "package", "digest"], [["digest"], ["image", "package", "oci"]], ["receipt", "proof", "inspect"]),
      g("navigation", "S-N3", "find lifecycle risks", ["hook", "crd", "risk"], [["hook", "crd"], ["risk", "lifecycle", "review"]], ["known gaps", "guide", "chart"]),
      g("navigation", "S-N4", "find known limitations", ["known gaps", "limitations"], [["known gaps", "not ready"], ["limit", "blocked", "partial"]], ["read", "evidence"]),
      g("action", "S-A1", "inspect a publication receipt", ["publication", "receipt", "digest"], [["receipt"], ["digest", "sha256"], ["publication", "published"]], ["receipt", "view source"]),
      g("action", "S-A2", "ask whether two digests are the same bytes", ["digest", "same bytes", "ask"], [["digest"], ["same bytes", "identify"], ["question", "prompt"]], ["build", "copy prompt"]),
      g("action", "S-A3", "inspect OCI without deploying", ["oci", "inspect", "not deploy"], [["oci"], ["inspect"], ["local", "without", "does not apply"]], ["inspect", "pull", "guide"], "OCI"),
      g("action", "S-A4", "review plain YAML before upload", ["yaml", "review", "upload"], [["yaml"], ["review", "inspect"], ["upload", "objects"]], ["guide", "start", "compare"], "YAML"),
      g("recovery", "S-R1", "block placeholder credentials", ["placeholder", "credentials", "block"], [["placeholder"], ["credential", "password"], ["block", "production"]], ["fix", "existing secret", "known gaps"]),
      g("recovery", "S-R2", "understand partial drift coverage", ["drift", "coverage", "partial"], [["drift"], ["coverage", "does not find every"], ["partial", "separately"]], ["read", "check", "receipt", "known gaps"]),
      g("recovery", "S-R3", "see when no proof exists", ["no evidence", "not checked", "claim"], [["not checked", "no evidence"], ["claim"]], ["verification", "ask"]),
      g("recovery", "S-R4", "handle CRD ordering risk", ["crd", "ordering", "risk"], [["crd"], ["ordering", "install first", "wait"], ["risk", "gap"]], ["known gaps", "guide"]),
      g("conversion", "S-X1", "keep an approval record", ["approval", "record", "confighub"], [["approval"], ["record", "history"], ["configHub"]], ["account", "tutorial"]),
      g("conversion", "S-X2", "relate source release and live state", ["source", "release", "live"], [["source", "git", "oci"], ["release"], ["live", "observation"]], ["connect", "guide", "account"]),
      g("conversion", "S-X3", "audit an exact diff", ["audit", "exact", "diff"], [["diff"], ["exact", "field"], ["audit", "record", "review"]], ["account", "tutorial"]),
      g("conversion", "S-X4", "see why ConfigHub is more than a scanner", ["confighub", "change", "promote"], [["configHub"], ["change", "variant"], ["promote", "release", "approve"]], ["create an account", "tutorial"]),
    ],
  },
];

const languageJobs = [
  "AI wrote Helm values; check whether they are safe",
  "my chart is not in the catalog",
  "find upgrade risk between two chart versions",
  "compare a candidate with an installed release",
  "understand hooks and CRDs",
  "review a private Helm configuration",
  "check an AICR configuration",
  "inspect an existing OCI package",
  "transform one field in OCI",
  "review plain Kubernetes YAML",
  "find why deployment differs from the approved config",
  "find whether Helm ignored a value",
  "identify prerequisites before install",
  "find a risky credential",
  "compare immutable digests",
  "check whether rollback will restore exact bytes",
  "investigate live drift",
  "compare development and production",
  "check whether production approval is required",
  "review a fleet configuration change",
];
const labels = [...new Set([currentLabel, "Ask", "Check my config", "Investigate", "Compare", "Help with a chart"])];

function decode(value) {
  return value
    .replaceAll(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replaceAll(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replaceAll("&middot;", "·")
    .replaceAll("&rarr;", "→")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function textOnly(value) {
  return decode(value.replaceAll(/<[^>]*>/g, " ")).replaceAll(/\s+/g, " ").trim();
}

function attr(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decode(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function parsePage(url, source, status, elapsedMs) {
  const clean = source
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const title = textOnly(clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const links = [];
  for (const match of clean.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(match[1], "href");
    const text = textOnly(match[2]);
    if (href && text) links.push({ href, text });
  }
  const buttons = [...clean.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)].map((m) => textOnly(m[1])).filter(Boolean);
  const codes = [...clean.matchAll(/<(?:code|pre)\b[^>]*>([\s\S]*?)<\/(?:code|pre)>/gi)].map((m) => textOnly(m[1])).filter(Boolean);
  return { url, status, elapsedMs, title, text: textOnly(clean), links, buttons, codes };
}

async function fetchPage(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const started = performance.now();
    try {
      const response = await fetch(url, {
        headers: { "cache-control": "no-cache", "user-agent": "helm-expt-persona-simulation/1" },
        signal: AbortSignal.timeout(20_000),
      });
      const source = await response.text();
      return parsePage(url, source, response.status, Math.round(performance.now() - started));
    } catch (error) {
      lastError = error;
    }
  }
  return { url, status: 0, elapsedMs: 0, title: "", text: String(lastError), links: [], buttons: [], codes: [] };
}

const lower = (value) => value.toLowerCase();
const groupMatch = (text, group) => group.some((term) => text.includes(lower(term)));
const evidenceFor = (page, task) => {
  const text = lower(page.text);
  const matched = task.groups.map((group) => groupMatch(text, group));
  const actionText = lower([...page.buttons, ...page.codes, ...page.links.flatMap((link) => [link.text, link.href])].join(" "));
  const actionable = task.actions.some((term) => actionText.includes(lower(term)));
  return { matched, count: matched.filter(Boolean).length, actionable, complete: matched.every(Boolean) && actionable };
};

function internalLink(currentUrl, href) {
  try {
    const target = new URL(href, currentUrl);
    return target.origin === baseUrl.origin && target.pathname.startsWith(baseUrl.pathname) ? target : null;
  } catch {
    return null;
  }
}

function linkScore(link, task, persona, currentUrl, visited) {
  const target = internalLink(currentUrl, link.href);
  if (!target || visited.has(target.href) || target.href === currentUrl) return -Infinity;
  const haystack = lower(`${link.text} ${target.pathname} ${target.hash}`);
  let score = 0;
  for (const term of task.query) if (haystack.includes(lower(term))) score += 8;
  for (const group of task.groups) if (groupMatch(haystack, group)) score += 5;
  for (const action of task.actions) if (haystack.includes(lower(action))) score += 3;
  for (const boost of persona.routeBoosts) if (haystack.includes(lower(boost))) score += 2;
  if (/^(home|config workshop)$/i.test(link.text)) score -= 6;
  if (/source|github/i.test(link.text) || target.pathname.includes("/d/data/")) score -= 2;
  return score;
}

function excerpt(page, task) {
  const text = page.text;
  const lowerText = lower(text);
  const term = task.groups.flat().find((candidate) => lowerText.includes(lower(candidate))) ?? task.query.find((candidate) => lowerText.includes(lower(candidate)));
  if (!term) return text.slice(0, 220);
  const index = lowerText.indexOf(lower(term));
  return text.slice(Math.max(0, index - 70), Math.min(text.length, index + term.length + 150)).trim();
}

async function simulateJourney(persona, task, start, runIndex) {
  const startUrl = new URL(start, baseUrl).href;
  const visited = new Set();
  const path = [];
  let page = await fetchPage(startUrl);
  let totalMs = page.elapsedMs;
  visited.add(page.url);
  path.push(page.url);
  let best = { page, evidence: evidenceFor(page, task) };
  const startEvidence = best.evidence.count;
  const startComplete = best.evidence.complete;
  let firstClickAccurate = false;

  for (let click = 0; click < maxClicks && !best.evidence.complete; click += 1) {
    const choices = page.links
      .map((link, order) => ({ link, order, score: linkScore(link, task, persona, page.url, visited) }))
      .filter((choice) => Number.isFinite(choice.score))
      .sort((a, b) => b.score - a.score || a.order - b.order);
    if (!choices.length) break;
    const chosen = choices[0];
    const target = internalLink(page.url, chosen.link.href);
    if (!target) break;
    const next = await fetchPage(target.href);
    totalMs += next.elapsedMs;
    visited.add(next.url);
    path.push(next.url);
    const nextEvidence = evidenceFor(next, task);
    if (click === 0) firstClickAccurate = nextEvidence.count > startEvidence || nextEvidence.complete;
    if (nextEvidence.count > best.evidence.count || nextEvidence.complete) best = { page: next, evidence: nextEvidence };
    page = next;
  }

  const threshold = Math.ceil(task.groups.length / 2);
  const outcome = best.evidence.complete ? "success" : best.evidence.count >= threshold ? "partial" : "fail";
  const disposition = outcome === "fail" ? "leave" : outcome === "partial" ? "bookmark" : task.category === "conversion" ? "signup" : "continue";
  return {
    persona: persona.id,
    run_id: `${persona.id}-${String(runIndex).padStart(3, "0")}`,
    category: task.category,
    format: task.format,
    goal_code: task.code,
    goal: task.goal,
    start_url: startUrl,
    outcome,
    clicks: path.length - 1,
    elapsed_ms: totalMs,
    start_complete: startComplete ? "yes" : "no",
    start_matched_groups: startEvidence,
    first_click_accurate: firstClickAccurate ? "yes" : "no",
    matched_groups: best.evidence.count,
    total_groups: task.groups.length,
    actionable: best.evidence.actionable ? "yes" : "no",
    next_action_clear: best.evidence.complete ? "yes" : "no",
    disposition,
    evidence_url: best.page.url,
    evidence_title: best.page.title,
    evidence_excerpt: excerpt(best.page, task),
    path: path.join(" -> "),
  };
}

const languageSemantics = {
  Ask: ["ask", "question", "help"],
  "Check my config": ["check", "config", "safe", "review", "values", "yaml", "aicr", "oci", "credential", "approval"],
  Investigate: ["investigate", "unknown", "why", "risk", "drift", "ignored", "differ", "hook", "crd", "problem"],
  Compare: ["compare", "diff", "upgrade", "installed", "development", "production", "rollback", "digest"],
  "Help with a chart": ["helm", "chart", "values", "hook", "crd"],
};
const personaLabelBoost = {
  developer: { "Check my config": 2, Ask: 1 },
  gitops: { Investigate: 2, Compare: 2 },
  platform: { Compare: 2, "Check my config": 1 },
  reviewer: { "Check my config": 2, Investigate: 2 },
};

function languageTrial(persona, job, index) {
  const jobText = lower(job);
  const scores = Object.fromEntries(labels.map((label) => {
    let score = personaLabelBoost[persona.id]?.[label] ?? 0;
    for (const term of languageSemantics[label] ?? []) if (jobText.includes(term)) score += 3;
    if (label === "Ask") score += 1;
    return [label, score];
  }));
  const preferred = [...labels].sort((a, b) => scores[b] - scores[a] || labels.indexOf(a) - labels.indexOf(b))[0];
  return {
    persona: persona.id,
    run_id: `${persona.id}-L${String(index + 1).padStart(2, "0")}`,
    category: "language-persona-simulation",
    job,
    current_label: currentLabel,
    preferred_label: preferred,
    current_label_score: scores[currentLabel],
    preferred_label_score: scores[preferred],
    label_alone_explains_own_ai: currentLabel.toLowerCase().includes("ai") ? "yes" : "no",
    caveat: "Synthetic persona preference, not observed human behavior",
  };
}

function csv(rows) {
  const headers = Object.keys(rows[0]);
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `${headers.map(quote).join(",")}\n${rows.map((row) => headers.map((header) => quote(row[header])).join(",")).join("\n")}\n`;
}

function parseCsvLine(line) {
  const values = [];
  for (const match of line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)) {
    values.push(match[1].replaceAll('""', '"'));
  }
  return values;
}

async function readCsv(path) {
  const text = await readFile(resolve(repoRoot, path), "utf8");
  const [headerLine, ...lines] = text.trimEnd().split("\n");
  const headers = parseCsvLine(headerLine);
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function countBy(rows, field) {
  const counts = new Map();
  for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function aggregate(rows) {
  const outcomes = Object.fromEntries(countBy(rows, "outcome"));
  const startedComplete = rows.filter((row) => row.start_complete === "yes").length;
  const neededNavigation = rows.length - startedComplete;
  const usefulFirstClick = rows.filter((row) => row.first_click_accurate === "yes").length;
  return {
    success: outcomes.success ?? 0,
    partial: outcomes.partial ?? 0,
    fail: outcomes.fail ?? 0,
    startedComplete,
    neededNavigation,
    usefulFirstClick,
  };
}

function markdown(journeys, language, baselineJourneys = []) {
  const lines = [
    "# Public-site persona simulations",
    "",
    `Site tested: ${baseUrl.href}`,
    "",
    "This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after five clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.",
    "",
    "## Results",
    "",
    "| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const persona of personas) {
    const rows = journeys.filter((row) => row.persona === persona.id);
    const outcomes = Object.fromEntries(countBy(rows, "outcome"));
    const clicks = rows.map((row) => row.clicks).sort((a, b) => a - b);
    const startedComplete = rows.filter((row) => row.start_complete === "yes").length;
    const neededNavigation = rows.length - startedComplete;
    const first = rows.filter((row) => row.first_click_accurate === "yes").length;
    lines.push(`| ${persona.label} | ${rows.length} | ${outcomes.success ?? 0} | ${outcomes.partial ?? 0} | ${outcomes.fail ?? 0} | ${startedComplete}/${rows.length} | ${first}/${neededNavigation} | ${clicks[Math.floor(clicks.length / 2)]} |`);
  }
  lines.push("", "## By category", "", "| Category | Success | Partial | Fail |", "| --- | ---: | ---: | ---: |");
  for (const category of ["comprehension", "navigation", "action", "recovery", "conversion"]) {
    const outcomes = Object.fromEntries(countBy(journeys.filter((row) => row.category === category), "outcome"));
    lines.push(`| ${category} | ${outcomes.success ?? 0} | ${outcomes.partial ?? 0} | ${outcomes.fail ?? 0} |`);
  }
  lines.push("", "## Cross-format", "", "| Input format | Success | Partial | Fail |", "| --- | ---: | ---: | ---: |");
  for (const format of ["Helm", "AICR", "OCI", "YAML", "mixed"]) {
    const outcomes = Object.fromEntries(countBy(journeys.filter((row) => row.format === format), "outcome"));
    lines.push(`| ${format} | ${outcomes.success ?? 0} | ${outcomes.partial ?? 0} | ${outcomes.fail ?? 0} |`);
  }
  const goals = new Map();
  for (const row of journeys) {
    const item = goals.get(row.goal_code) ?? { goal: row.goal, success: 0, partial: 0, fail: 0 };
    item[row.outcome] += 1;
    goals.set(row.goal_code, item);
  }
  const incompleteGoals = [...goals.entries()]
    .filter(([, item]) => item.partial || item.fail)
    .sort((left, right) => (right[1].partial + right[1].fail) - (left[1].partial + left[1].fail) || left[0].localeCompare(right[0]))
    .slice(0, 15);
  lines.push("", "## Goals that still need work", "", "| Goal | Success | Partial | Fail |", "| --- | ---: | ---: | ---: |");
  for (const [, item] of incompleteGoals) lines.push(`| ${item.goal} | ${item.success} | ${item.partial} | ${item.fail} |`);
  lines.push("", "## Navigation language", "", "These are synthetic forced-choice trials, not observed preferences.", "", "| Preferred label | Count |", "| --- | ---: |");
  for (const [label, count] of countBy(language, "preferred_label")) lines.push(`| ${label} | ${count} |`);
  const currentPreferred = language.filter((row) => row.preferred_label === currentLabel).length;
  lines.push("", `The current label \`${currentLabel}\` was preferred in ${currentPreferred} of ${language.length} synthetic trials. The page itself must explain that it builds a prompt for the visitor's own AI assistant; the navigation label does not have to carry that whole explanation.`, "");
  if (baselineJourneys.length) {
    const before = aggregate(baselineJourneys);
    const after = aggregate(journeys);
    const percent = (value, total) => total ? `${(value * 100 / total).toFixed(1)}%` : "n/a";
    const signed = (value) => value > 0 ? `+${value}` : String(value);
    lines.push(
      "## Change from baseline",
      "",
      "The baseline and candidate use the same personas, goals, starting pages, click limit, and scoring rules.",
      "",
      "| Measure | Baseline | Candidate | Change |",
      "| --- | ---: | ---: | ---: |",
      `| Successful journeys | ${before.success}/${baselineJourneys.length} | ${after.success}/${journeys.length} | ${signed(after.success - before.success)} |`,
      `| Partial journeys | ${before.partial}/${baselineJourneys.length} | ${after.partial}/${journeys.length} | ${signed(after.partial - before.partial)} |`,
      `| Failed journeys | ${before.fail}/${baselineJourneys.length} | ${after.fail}/${journeys.length} | ${signed(after.fail - before.fail)} |`,
      `| Answered on starting page | ${before.startedComplete}/${baselineJourneys.length} | ${after.startedComplete}/${journeys.length} | ${signed(after.startedComplete - before.startedComplete)} |`,
      `| Useful first click when needed | ${before.usefulFirstClick}/${before.neededNavigation} (${percent(before.usefulFirstClick, before.neededNavigation)}) | ${after.usefulFirstClick}/${after.neededNavigation} (${percent(after.usefulFirstClick, after.neededNavigation)}) | ${(after.usefulFirstClick * 100 / after.neededNavigation - before.usefulFirstClick * 100 / before.neededNavigation).toFixed(1)} points |`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

await mkdir(outDir, { recursive: true });
const work = [];
for (const persona of personas) {
  let runIndex = 1;
  for (const task of persona.goals) {
    for (const start of starts) {
      work.push({ persona, task, start, runIndex });
      runIndex += 1;
    }
  }
}

const journeys = [];
for (let index = 0; index < work.length; index += 8) {
  const batch = work.slice(index, index + 8);
  journeys.push(...await Promise.all(batch.map((item) => simulateJourney(item.persona, item.task, item.start, item.runIndex))));
}
const language = personas.flatMap((persona) => languageJobs.map((job, index) => languageTrial(persona, job, index)));
const baselineJourneys = compareWith ? await readCsv(compareWith) : [];

await writeFile(join(outDir, "journeys.csv"), csv(journeys));
await writeFile(join(outDir, "language.csv"), csv(language));
await writeFile(join(outDir, "summary.md"), markdown(journeys, language, baselineJourneys));

console.log(`wrote ${journeys.length} live journeys and ${language.length} language trials to ${outDir}`);
