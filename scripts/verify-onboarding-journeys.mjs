#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative } from "node:path";

import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";

const contractPath = join(repoRoot, "config-catalog", "onboarding-journeys.yaml");
const siteRoot = join(repoRoot, "site");
const requiredStages = [
  "awareness",
  "problem-recognition",
  "find",
  "understand",
  "start",
  "first-value",
  "delivery-requested",
  "verified-live",
  "expand-return",
];
const requiredJourneys = new Set([
  "ask-ai-assisted-configuration",
  "agent-catalog-skill-path",
  "browser-guided-first-component",
  "first-live-app",
  "tiny-two-component-stack",
  "brownfield-argo-app-of-apps",
  "brownfield-flux-fleet",
  "helm-chart-change",
  "aicr-or-oci-package",
  "diff-promote-and-rollback",
  "security-risk-check",
  "generator-platform-plan",
]);
const allowedTokenKinds = new Set(["deterministic-zero", "estimated-range"]);
const allowedSignalSources = new Set([
  "browser",
  "browser-or-test",
  "browser-or-cli",
  "confighub",
  "controller-and-workload",
  "browser-or-confighub",
]);

const contract = readYaml(contractPath);
validateContract(contract);

const { graph, pages } = readSiteGraph(siteRoot);
const repetitions = contract.spec.test.repetitions;
const runs = [];
for (let repetition = 0; repetition < repetitions; repetition += 1) {
  runs.push(simulateAll(contract, graph, pages));
}

const signatures = runs.map(stableDigest);
check(new Set(signatures).size === 1, `persona walks changed across ${repetitions} repetitions`);

const walkCount = runs[0].length;
const personaCount = contract.spec.personas.length;
const journeyCount = contract.spec.journeys.length;
console.log(
  `verified ${journeyCount} onboarding journeys for ${personaCount} personas across ${repetitions} deterministic repetitions (${walkCount * repetitions} local walks, no network or LLM); ${(contract.spec.unservedPersonas ?? []).length} persona(s) declared not yet served`,
);

function validateContract(document) {
  check(document?.apiVersion === "workshop.confighub.com/v1alpha1", "onboarding contract apiVersion is invalid");
  check(document?.kind === "OnboardingJourneyContract", "onboarding contract kind is invalid");
  check(document?.metadata?.name === "workshop-onboarding-journeys", "onboarding contract name is invalid");
  check(typeof document?.spec?.purpose === "string" && document.spec.purpose.trim(), "onboarding contract purpose is missing");

  const test = document?.spec?.test;
  check(test?.mode === "deterministic-persona-walk", "onboarding test mode must be deterministic-persona-walk");
  check(Number.isInteger(test?.repetitions) && test.repetitions >= 3, "onboarding test must repeat at least three times");
  check(test?.network === "forbidden", "onboarding test must forbid network access");
  check(test?.llm === "forbidden", "onboarding test must forbid LLM calls");
  check(test?.writes === "forbidden", "onboarding test must be read-only");
  check(test?.startPage === "index.html", "onboarding test must start at site/index.html");
  check(typeof test?.scope === "string" && test.scope.trim(), "onboarding test scope is missing");

  const tokenPolicy = document?.spec?.tokenPolicy;
  check(tokenPolicy?.measurementEvent === "onboarding_token_path_selected", "token policy measurement event is invalid");
  check(
    JSON.stringify(tokenPolicy?.measurementProperties) === JSON.stringify([
      "journey_id",
      "path_id",
      "estimate_kind",
      "estimated_input_min_tokens",
      "estimated_input_max_tokens",
      "estimated_output_min_tokens",
      "estimated_output_max_tokens",
    ]),
    "token estimate measurement properties are incomplete",
  );
  check(tokenPolicy?.actualUsageEvent === "onboarding_token_usage_observed", "actual token-usage event is invalid");
  check(
    JSON.stringify(tokenPolicy?.actualUsageProperties) === JSON.stringify([
      "journey_id",
      "path_id",
      "actual_input_tokens",
      "actual_output_tokens",
    ]),
    "actual token-usage properties are incomplete",
  );
  check(tokenPolicy?.unit === "tokens", "token policy unit must be tokens");
  check(tokenPolicy?.pricing === "excluded", "token policy must exclude pricing claims");
  check(typeof tokenPolicy?.estimateRule === "string" && tokenPolicy.estimateRule.trim(), "token estimate rule is missing");
  check(typeof tokenPolicy?.actualUsageRule === "string" && tokenPolicy.actualUsageRule.trim(), "actual token-usage rule is missing");
  check(typeof tokenPolicy?.zeroPathRule === "string" && tokenPolicy.zeroPathRule.trim(), "zero-token path rule is missing");

  const stages = document?.spec?.stages;
  check(Array.isArray(stages), "onboarding stages are missing");
  check(
    JSON.stringify(stages.map((stage) => stage.id)) === JSON.stringify(requiredStages),
    `onboarding stages must be ordered ${requiredStages.join(" -> ")}`,
  );

  const stageIds = new Set(requiredStages);
  const eventIds = new Set();
  const referencedExitReasons = new Set();
  for (const stage of stages) {
    check(question(stage.question), `${stage.id} must have a plain question`);
    check(typeof stage?.successSignal?.event === "string" && stage.successSignal.event, `${stage.id} success event is missing`);
    check(!eventIds.has(stage.successSignal.event), `duplicate success event ${stage.successSignal.event}`);
    eventIds.add(stage.successSignal.event);
    check(allowedSignalSources.has(stage.successSignal.source), `${stage.id} has unsupported signal source ${stage.successSignal.source}`);
    check(typeof stage.successSignal.passWhen === "string" && stage.successSignal.passWhen.trim(), `${stage.id} pass condition is missing`);
    check(Array.isArray(stage.exitReasonIds) && stage.exitReasonIds.length >= 2, `${stage.id} needs at least two exit reasons`);
    for (const id of stage.exitReasonIds) {
      check(!referencedExitReasons.has(id), `exit reason ${id} is assigned to more than one stage`);
      referencedExitReasons.add(id);
    }
  }

  const exitReasons = document?.spec?.exitReasons;
  check(Array.isArray(exitReasons) && exitReasons.length >= requiredStages.length * 2, "onboarding exit-reason taxonomy is incomplete");
  const exitReasonMap = uniqueBy(exitReasons, "id", "exit reason");
  for (const exitReason of exitReasons) {
    check(stageIds.has(exitReason.stage), `${exitReason.id} names unknown stage ${exitReason.stage}`);
    check(typeof exitReason.meaning === "string" && exitReason.meaning.trim(), `${exitReason.id} meaning is missing`);
  }
  for (const id of referencedExitReasons) {
    check(exitReasonMap.has(id), `stage names unknown exit reason ${id}`);
    const owningStage = stages.find((stage) => stage.exitReasonIds.includes(id));
    check(exitReasonMap.get(id).stage === owningStage.id, `${id} belongs to ${exitReasonMap.get(id).stage}, not ${owningStage.id}`);
  }
  check(referencedExitReasons.size === exitReasonMap.size, "every exit reason must belong to exactly one measured stage");

  const personas = document?.spec?.personas;
  const journeys = document?.spec?.journeys;
  check(Array.isArray(personas) && personas.length >= 6, "onboarding contract needs at least six generalized personas");
  check(Array.isArray(journeys) && journeys.length === requiredJourneys.size, `onboarding contract must contain ${requiredJourneys.size} journeys`);
  const personaMap = uniqueBy(personas, "id", "persona");
  const journeyMap = uniqueBy(journeys, "id", "journey");
  check(personaMap.has("ai-assisted-configuration-user"), "onboarding contract is missing the generalized AI-agent persona");
  check(
    [...requiredJourneys].every((id) => journeyMap.has(id)) && [...journeyMap.keys()].every((id) => requiredJourneys.has(id)),
    "onboarding journey ids do not match the required coverage set",
  );

  // A persona the Workshop does not serve yet is declared apart from the
  // served ones: it says why and which surface must exist first, and it can
  // carry no journey, so it never counts as coverage.
  const unserved = document?.spec?.unservedPersonas ?? [];
  check(Array.isArray(unserved), "unservedPersonas must be a list");
  const unservedMap = uniqueBy(unserved, "id", "unserved persona");
  for (const persona of unserved) {
    check(!personaMap.has(persona.id), `${persona.id} is listed as both served and unserved`);
    for (const field of ["situation", "needs", "reason", "requiredSurface"]) {
      check(typeof persona[field] === "string" && persona[field].trim(), `unserved ${persona.id} ${field} is missing`);
    }
    check(!Object.hasOwn(persona, "journeyIds"), `unserved ${persona.id} cannot name a journey; move it to personas when a journey serves it`);
  }
  for (const journey of journeys) {
    for (const personaId of journey.personaIds ?? []) {
      check(!unservedMap.has(personaId), `${journey.id} names unserved persona ${personaId}`);
    }
  }

  for (const persona of personas) {
    check(typeof persona.situation === "string" && persona.situation.trim(), `${persona.id} situation is missing`);
    check(typeof persona.needs === "string" && persona.needs.trim(), `${persona.id} needs are missing`);
    check(Array.isArray(persona.journeyIds) && persona.journeyIds.length, `${persona.id} has no journeys`);
    for (const journeyId of persona.journeyIds) {
      check(journeyMap.has(journeyId), `${persona.id} names unknown journey ${journeyId}`);
      check(journeyMap.get(journeyId).personaIds.includes(persona.id), `${persona.id} and ${journeyId} are not reciprocal`);
    }
  }

  const estimatedJourneyIds = new Set();
  const zeroTokenJourneyIds = new Set();
  for (const journey of journeys) {
    check(typeof journey.name === "string" && journey.name.trim(), `${journey.id} name is missing`);
    check(typeof journey.job === "string" && journey.job.trim(), `${journey.id} job is missing`);
    check(Array.isArray(journey.personaIds) && journey.personaIds.length, `${journey.id} has no personas`);
    for (const personaId of journey.personaIds) {
      check(personaMap.has(personaId), `${journey.id} names unknown persona ${personaId}`);
      check(personaMap.get(personaId).journeyIds.includes(journey.id), `${journey.id} and ${personaId} are not reciprocal`);
    }
    check(safeHtmlPath(journey.entryPage), `${journey.id} has unsafe entryPage`);
    check(safeHtmlPath(journey.destinationPage), `${journey.id} has unsafe destinationPage`);
    check(Number.isInteger(journey.maxClicks) && journey.maxClicks >= 1 && journey.maxClicks <= 3, `${journey.id} maxClicks must be 1..3`);
    check(Array.isArray(journey.contentMarkers) && journey.contentMarkers.length >= 2, `${journey.id} needs at least two content markers`);
    check(stageIds.has(journey.terminalStage), `${journey.id} has unknown terminal stage ${journey.terminalStage}`);
    check(requiredStages.indexOf(journey.terminalStage) >= requiredStages.indexOf("first-value"), `${journey.id} must reach first value`);
    check(typeof journey.startAction === "string" && journey.startAction.trim(), `${journey.id} start action is missing`);
    check(typeof journey.firstValue === "string" && journey.firstValue.trim(), `${journey.id} first-value outcome is missing`);
    if (reaches(journey, "delivery-requested")) {
      check(typeof journey.deliveryRequested === "string" && journey.deliveryRequested.trim(), `${journey.id} delivery-requested outcome is missing`);
    }
    if (reaches(journey, "verified-live")) {
      check(typeof journey.verifiedLive === "string" && journey.verifiedLive.trim(), `${journey.id} verified-live outcome is missing`);
      check(!/release requested alone/i.test(journey.verifiedLive), `${journey.id} cannot use a release request as live proof`);
    }
    check(typeof journey.nextJourneyId === "string" && journeyMap.has(journey.nextJourneyId), `${journey.id} next journey is missing or unknown`);
    check(journey.nextJourneyId !== journey.id, `${journey.id} cannot point to itself as the next journey`);
    const tokenKinds = validateTokenPlan(journey);
    if (tokenKinds.has("estimated-range")) estimatedJourneyIds.add(journey.id);
    if (tokenKinds.has("deterministic-zero")) zeroTokenJourneyIds.add(journey.id);
    validateSupportFiles(journey);
    check(Array.isArray(journey.watchExitReasonIds) && journey.watchExitReasonIds.length >= 3, `${journey.id} needs at least three watched exit reasons`);
    for (const id of journey.watchExitReasonIds) {
      check(exitReasonMap.has(id), `${journey.id} names unknown exit reason ${id}`);
      check(reaches(journey, exitReasonMap.get(id).stage), `${journey.id} watches ${id} after its terminal stage`);
    }
  }

  check(estimatedJourneyIds.has("ask-ai-assisted-configuration"), "Ask journey needs an estimated AI path");
  check(estimatedJourneyIds.has("agent-catalog-skill-path"), "agent Catalog journey needs an estimated AI path");
  check(zeroTokenJourneyIds.has("ask-ai-assisted-configuration"), "Ask journey needs a deterministic zero-token browser path");
  check(zeroTokenJourneyIds.size >= 9, "each non-agent path and the Ask fallback should expose deterministic zero-token use");

  const agentSupportPaths = new Set(journeyMap.get("agent-catalog-skill-path").supportFiles?.map((file) => file.path));
  for (const path of [
    "site/llms.txt",
    "site/guides.json",
    "site/listings/bitnami-redis-25-5-3-default.json",
    "skills/config-workshop/SKILL.md",
  ]) {
    check(agentSupportPaths.has(path), `agent Catalog journey must verify ${path}`);
  }

  check(Array.isArray(document?.spec?.limits) && document.spec.limits.length >= 3, "onboarding contract must state at least three limits");
}

function validateTokenPlan(journey) {
  const plan = journey?.tokenPlan;
  check(typeof plan?.selectionRule === "string" && plan.selectionRule.trim(), `${journey.id} token selection rule is missing`);
  check(Array.isArray(plan?.paths) && plan.paths.length, `${journey.id} token paths are missing`);
  const pathMap = uniqueBy(plan.paths, "id", `${journey.id} token path`);
  check(pathMap.has(plan.tokenOptimalPathId), `${journey.id} token-optimal path is missing or unknown`);

  const kinds = new Set();
  for (const path of plan.paths) {
    check(allowedTokenKinds.has(path.kind), `${journey.id}/${path.id} has unsupported token path kind ${path.kind}`);
    kinds.add(path.kind);
    check(typeof path.estimateLabel === "string" && path.estimateLabel.trim(), `${journey.id}/${path.id} estimate label is missing`);
    check(Array.isArray(path.assumptions) && path.assumptions.length >= 2, `${journey.id}/${path.id} needs at least two token assumptions`);
    check(path.assumptions.every((item) => typeof item === "string" && item.trim()), `${journey.id}/${path.id} has an empty token assumption`);
    check(typeof path.optimization === "string" && path.optimization.trim(), `${journey.id}/${path.id} token optimization is missing`);
    check(path.pricing === "not-estimated", `${journey.id}/${path.id} must not claim provider or model pricing`);
    check(!Object.hasOwn(path, "provider") && !Object.hasOwn(path, "model") && !Object.hasOwn(path, "currency"), `${journey.id}/${path.id} must not name a pricing provider, model, or currency`);

    const prose = [path.estimateLabel, ...path.assumptions, path.rangeBasis ?? "", path.optimization].join(" ");
    check(!/[£€$]|\b(?:usd|gbp|eur|dollars?|pounds?|euros?|per million|provider rate|model rate)\b/i.test(prose), `${journey.id}/${path.id} contains a pricing claim`);

    validateTokenRange(journey.id, path.id, "input", path.inputTokens, path.kind);
    validateTokenRange(journey.id, path.id, "output", path.outputTokens, path.kind);
    if (path.kind === "deterministic-zero") {
      check(/deterministic zero-token local path/i.test(path.estimateLabel), `${journey.id}/${path.id} must label the zero-token local path`);
      check(path.assumptions.some((item) => /no (?:ai|llm)|without an? (?:ai|llm)/i.test(item)), `${journey.id}/${path.id} must state that no AI or LLM is invoked`);
      check(path.rangeBasis === undefined, `${journey.id}/${path.id} zero-token path must not invent a range basis`);
    } else {
      check(/estimate/i.test(path.estimateLabel), `${journey.id}/${path.id} token range must be labelled as an estimate`);
      check(typeof path.rangeBasis === "string" && path.rangeBasis.trim(), `${journey.id}/${path.id} estimate basis is missing`);
    }
  }

  const optimal = pathMap.get(plan.tokenOptimalPathId);
  const optimalUpperBound = optimal.inputTokens.max + optimal.outputTokens.max;
  const lowestUpperBound = Math.min(...plan.paths.map((path) => path.inputTokens.max + path.outputTokens.max));
  check(optimalUpperBound === lowestUpperBound, `${journey.id} tokenOptimalPathId is not the lowest-token declared path`);
  return kinds;
}

function validateTokenRange(journeyId, pathId, direction, range, kind) {
  check(Number.isInteger(range?.min) && Number.isInteger(range?.max), `${journeyId}/${pathId} ${direction} token range must use integers`);
  check(range.min >= 0 && range.max >= range.min, `${journeyId}/${pathId} ${direction} token range is invalid`);
  if (kind === "deterministic-zero") {
    check(range.min === 0 && range.max === 0, `${journeyId}/${pathId} deterministic ${direction} tokens must be zero`);
  } else {
    check(range.max > range.min, `${journeyId}/${pathId} estimated ${direction} token range must have width`);
    check(range.min % 500 === 0 && range.max % 500 === 0, `${journeyId}/${pathId} ${direction} estimate must use broad 500-token boundaries`);
  }
}

function validateSupportFiles(journey) {
  if (journey.supportFiles === undefined) return;
  check(Array.isArray(journey.supportFiles) && journey.supportFiles.length, `${journey.id} supportFiles must be a non-empty list`);
  const seen = new Set();
  for (const support of journey.supportFiles) {
    check(safeSupportPath(support?.path), `${journey.id} has unsafe support file ${support?.path}`);
    check(!seen.has(support.path), `${journey.id} repeats support file ${support.path}`);
    seen.add(support.path);
    const absolute = join(repoRoot, support.path);
    check(existsSync(absolute), `${journey.id} support file ${support.path} is missing`);
    check(Array.isArray(support.markers) && support.markers.length >= 2, `${journey.id}/${support.path} needs at least two markers`);
    const text = normalizeText(readFileSync(absolute, "utf8"));
    for (const marker of support.markers) {
      check(text.includes(normalizeText(marker)), `${journey.id}/${support.path} is missing marker ${JSON.stringify(marker)}`);
    }
  }
}

function simulateAll(document, graph, pages) {
  const stages = document.spec.stages;
  const simulations = [];
  for (const journey of document.spec.journeys) {
    check(pages.has(journey.entryPage), `${journey.id} entry page site/${journey.entryPage} is missing`);
    check(pages.has(journey.destinationPage), `${journey.id} destination page site/${journey.destinationPage} is missing`);
    const route = shortestRoute(graph, journey.entryPage, journey.destinationPage);
    check(route, `${journey.id} has no local route from ${journey.entryPage} to ${journey.destinationPage}`);
    check(route.length - 1 <= journey.maxClicks, `${journey.id} needs ${route.length - 1} clicks, budget is ${journey.maxClicks}`);

    const pageText = pages.get(journey.destinationPage).text;
    for (const marker of journey.contentMarkers) {
      check(pageText.includes(normalizeText(marker)), `${journey.id} destination is missing content marker ${JSON.stringify(marker)}`);
    }

    const terminalIndex = requiredStages.indexOf(journey.terminalStage);
    const stageSignals = stages.slice(0, terminalIndex + 1).map((stage) => ({
      stage: stage.id,
      event: stage.successSignal.event,
    }));
    for (const personaId of journey.personaIds) {
      simulations.push({
        personaId,
        journeyId: journey.id,
        route,
        stageSignals,
        terminalStage: journey.terminalStage,
        nextJourneyId: journey.nextJourneyId,
      });
    }
  }
  return simulations.sort((left, right) => `${left.personaId}/${left.journeyId}`.localeCompare(`${right.personaId}/${right.journeyId}`));
}

function readSiteGraph(root) {
  const htmlFiles = [];
  walk(root, htmlFiles);
  htmlFiles.sort();
  const known = new Set(htmlFiles);
  const pages = new Map();
  const graph = new Map();

  for (const file of htmlFiles) {
    const html = readFileSync(join(root, file), "utf8");
    pages.set(file, { text: normalizeText(html) });
    const links = [];
    for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
      const target = localHtmlTarget(file, match[1]);
      if (target && known.has(target) && !links.includes(target)) links.push(target);
    }
    graph.set(file, links);
  }
  return { graph, pages };
}

function walk(directory, files) {
  for (const name of readdirSync(directory).sort()) {
    const absolute = join(directory, name);
    if (statSync(absolute).isDirectory()) {
      walk(absolute, files);
    } else if (name.endsWith(".html")) {
      files.push(relative(siteRoot, absolute).split("\\").join("/"));
    }
  }
}

function localHtmlTarget(from, rawHref) {
  const href = rawHref.replaceAll("&amp;", "&").split(/[?#]/, 1)[0];
  if (!href || href.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return null;
  let target = posix.normalize(posix.join(posix.dirname(from), href));
  if (target.endsWith("/")) target += "index.html";
  if (target.startsWith("../") || !target.endsWith(".html")) return null;
  return target;
}

function shortestRoute(graph, start, destination) {
  const queue = [[start]];
  const seen = new Set([start]);
  while (queue.length) {
    const route = queue.shift();
    const current = route.at(-1);
    if (current === destination) return route;
    for (const next of graph.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push([...route, next]);
    }
  }
  return null;
}

function normalizeText(value) {
  return String(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&rarr;", "->")
    .replaceAll("&ldquo;", '"')
    .replaceAll("&rdquo;", '"')
    .replaceAll("&rsquo;", "'")
    .replaceAll("&middot;", " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function uniqueBy(items, field, label) {
  const result = new Map();
  for (const item of items) {
    check(typeof item?.[field] === "string" && item[field], `${label} ${field} is missing`);
    check(!result.has(item[field]), `duplicate ${label} ${item[field]}`);
    result.set(item[field], item);
  }
  return result;
}

function reaches(journey, stage) {
  return requiredStages.indexOf(stage) <= requiredStages.indexOf(journey.terminalStage);
}

function safeHtmlPath(value) {
  return typeof value === "string"
    && value.endsWith(".html")
    && value === posix.normalize(value)
    && !value.startsWith("/")
    && !value.includes("\\")
    && !value.split("/").includes("..");
}

function safeSupportPath(value) {
  return typeof value === "string"
    && value === posix.normalize(value)
    && !value.startsWith("/")
    && !value.includes("\\")
    && !value.split("/").includes("..")
    && (value.startsWith("site/") || value.startsWith("skills/config-workshop/"));
}

function question(value) {
  return typeof value === "string" && value.trim().endsWith("?");
}

function stableDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
