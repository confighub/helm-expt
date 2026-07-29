#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot } from "./lib/proof-common.mjs";

const intentsPath = join(repoRoot, "data", "helm-render-intents", "intents.json");
const gapsPath = join(repoRoot, "data", "helm-render-intents", "contract-gaps.csv");

check(existsSync(intentsPath), "data/helm-render-intents/intents.json is missing");
check(existsSync(gapsPath), "data/helm-render-intents/contract-gaps.csv is missing");

const intents = JSON.parse(readFileSync(intentsPath, "utf8")).intents ?? [];
const gaps = parseCsv(readFileSync(gapsPath, "utf8"));
const lifecycleStates = new Set(["attached", "actionable-gap", "no-route-required"]);
const targetStates = new Set([
  "attached",
  "attached-with-observed-actions",
  "actionable-gap",
  "no-target-facts-required",
]);
const expectedGaps = new Set();
const names = new Set();

check(intents.length === 199, `expected 199 real-base render intents, found ${intents.length}`);

for (const intent of intents) {
  const name = intent.metadata?.name;
  check(name && !names.has(name), `duplicate or missing render intent name: ${name}`);
  names.add(name);

  for (const path of [
    intent.spec?.renderInputs?.recipe,
    intent.spec?.renderInputs?.variant,
    intent.spec?.renderInputs?.sourceLock,
    intent.spec?.renderOutput?.renderedObjects,
    intent.spec?.renderOutput?.revision,
    intent.spec?.renderOutput?.packageBase,
  ]) {
    check(path && existsSync(join(repoRoot, path)), `${name} points at missing render evidence: ${path || "(blank)"}`);
  }

  const lifecycle = intent.spec?.lifecycle;
  const lifecycleState = lifecycle?.coverage?.state;
  check(lifecycleStates.has(lifecycleState), `${name} has invalid lifecycle coverage state`);
  check(Array.isArray(lifecycle.coverage.evidence), `${name} lifecycle coverage evidence is not an array`);
  check(typeof lifecycle.coverage.reason === "string" && lifecycle.coverage.reason, `${name} lifecycle coverage needs a reason`);
  const routeCount = Number(lifecycle.routeCount ?? 0);
  check(routeCount === lifecycle.variantRoutes.length, `${name} lifecycle route count differs from attached routes`);

  if (lifecycleState === "attached") {
    check(routeCount > 0, `${name} says lifecycle routes are attached but has none`);
    check(
      lifecycle.variantRoutes.every((route) => route.routeSourceVersion === intent.spec.chart.version),
      `${name} says lifecycle routes are attached but uses evidence from another chart version`,
    );
  } else if (lifecycleState === "no-route-required") {
    check(routeCount === 0 && lifecycle.routeContract === "n/a", `${name} no-route state is inconsistent`);
  } else {
    check(lifecycle.coverage.nextAction, `${name} lifecycle gap has no next action`);
    expectedGaps.add(`${name}|lifecycle-route`);
  }

  for (const route of lifecycle.variantRoutes) {
    check(Array.isArray(route.evidence), `${name}/${route.routeName} evidence is not an array`);
    if (route.disposition === "observed") {
      check(route.evidence.length > 0, `${name}/${route.routeName} has no evidence`);
    } else {
      check(
        route.evidence.length > 0 || route.nextAction,
        `${name}/${route.routeName} needs evidence or a next action`,
      );
    }
    for (const evidence of route.evidence) {
      checkRepoReference(evidence, `${name}/${route.routeName}`);
    }
    if (route.routeSourceVersion !== intent.spec.chart.version) {
      check(lifecycleState === "actionable-gap", `${name}/${route.routeName} hides chart-version drift`);
      check(route.sourceDrift, `${name}/${route.routeName} has chart-version drift without an explanation`);
    }
    check(route.automatic === false, `${name}/${route.routeName} became automatic without an explicit product contract`);
    for (const runner of ["direct", "argoCd", "flux"]) {
      const record = route.runners?.[runner];
      check(record && typeof record.implementation === "string", `${name}/${route.routeName} is missing ${runner} implementation`);
      check(record.status, `${name}/${route.routeName} is missing ${runner} evidence status`);
      check(Array.isArray(record.evidence), `${name}/${route.routeName} ${runner} evidence is not an array`);
      for (const evidence of record.evidence) {
        checkRepoReference(evidence, `${name}/${route.routeName} ${runner}`);
      }
      if (record.status === "pass") {
        check(
          record.evidence.some((evidence) => evidence.startsWith("runs/")),
          `${name}/${route.routeName} ${runner} passes without a runner-specific receipt`,
        );
      }
    }
  }

  const targetFacts = intent.spec?.targetFacts;
  const targetState = targetFacts?.coverage?.state;
  check(targetStates.has(targetState), `${name} has invalid target-prerequisite coverage state`);
  check(typeof targetFacts.coverage.reason === "string" && targetFacts.coverage.reason, `${name} target coverage needs a reason`);
  check(Array.isArray(targetFacts.requirements), `${name} target requirements are not an array`);
  check(Array.isArray(targetFacts.actions), `${name} target actions are not an array`);

  for (const requirement of targetFacts.requirements) {
    check(requirement.category && requirement.name, `${name} has an unnamed target requirement`);
    check(["render", "apply"].includes(requirement.requiredBefore), `${name}/${requirement.name} has an invalid check point`);
    check(
      ["recheck-before-render", "recheck-before-apply"].includes(requirement.freshness?.policy),
      `${name}/${requirement.name} has no freshness policy`,
    );
    check(requirement.declarationPath === intent.spec.renderInputs.variant, `${name}/${requirement.name} lost its declaration path`);
    check(Array.isArray(requirement.evidence) && requirement.evidence.length > 0, `${name}/${requirement.name} has no evidence`);
    for (const evidence of requirement.evidence) {
      checkRepoReference(evidence, `${name}/${requirement.name}`);
    }
  }
  for (const action of targetFacts.actions) {
    check(action.requiredBefore === "apply", `${name} target action is not checked before apply`);
    check(action.freshness?.policy === "recheck-before-apply", `${name} target action has no apply-time freshness policy`);
    check(Array.isArray(action.evidence) && action.evidence.length > 0, `${name} target action has no evidence`);
    for (const evidence of action.evidence) {
      checkRepoReference(evidence, `${name} target action`);
    }
  }

  if (targetState === "attached") {
    check(targetFacts.requirements.length > 0, `${name} says target facts are attached but has no normalized requirements`);
  } else if (targetState === "attached-with-observed-actions") {
    check(
      targetFacts.requirements.length > 0 && targetFacts.actions.length > 0,
      `${name} attached-with-actions state is inconsistent`,
    );
  } else if (targetState === "no-target-facts-required") {
    check(
      targetFacts.requirements.length === 0 && targetFacts.coverage.declarationSource,
      `${name} has not explicitly declared that no target facts are required`,
    );
  } else {
    check(targetFacts.coverage.nextAction, `${name} target-prerequisite gap has no next action`);
    expectedGaps.add(`${name}|target-prerequisite`);
  }
}

const actualGaps = new Set(gaps.map((gap) => `${gap.name}|${gap.area}`));
check(actualGaps.size === gaps.length, "contract-gaps.csv contains duplicate rows");
check(actualGaps.size === expectedGaps.size, "contract-gaps.csv does not match the render-intent coverage states");
for (const gap of expectedGaps) {
  check(actualGaps.has(gap), `contract-gaps.csv is missing ${gap}`);
}

for (const [base, receiptPath] of [
  ["default", "runs/kps-lifecycle-route-proof/receipt.yaml"],
  ["no-crds", "runs/kps-lifecycle-route-proof/no-crds-receipt.yaml"],
]) {
  const kps = intents.find((intent) =>
    intent.metadata.name === `prometheus-community-kube-prometheus-stack-85-3-3-${base}`);
  check(kps, `kube-prometheus-stack ${base} render intent is missing`);
  for (const route of kps.spec.lifecycle.variantRoutes) {
    const expected = route.routeName === "upgrade-action-with-receipt" ? "not-run" : "pass";
    check(route.runners.direct.status === expected, `KPS ${base}/${route.routeName} direct evidence status is wrong`);
    check(
      route.runners.direct.evidence.includes(receiptPath),
      `KPS ${base}/${route.routeName} is missing the direct lifecycle receipt`,
    );
  }
  if (base === "no-crds") {
    const upgradeRoute = kps.spec.lifecycle.variantRoutes.find(
      (route) => route.routeName === "upgrade-action-with-receipt",
    );
    check(
      kps.spec.evidence.lifecycleUpgrade === "85.3.3-to-86.1.0-pass",
      "KPS no-crds render intent is missing the proved upgrade",
    );
    for (const controller of ["argoCd", "flux"]) {
      check(
        upgradeRoute?.runners?.[controller]?.status === "pass",
        `KPS no-crds upgrade is not connected to the ${controller} receipt`,
      );
      check(
        upgradeRoute.runners[controller].evidence.includes(
          "runs/kps-gitops-lifecycle-proof/receipt.yaml",
        ),
        `KPS no-crds upgrade is missing ${controller} evidence`,
      );
    }
  }
}

const kpsUpgradeTarget = intents.find((intent) =>
  intent.metadata.name === "prometheus-community-kube-prometheus-stack-86-1-0-no-crds");
check(
  kpsUpgradeTarget?.spec?.evidence?.lifecycleUpgradeTarget === "pass-from-85.3.3",
  "KPS 86.1.0 no-crds intent is not linked as the proved upgrade target",
);
check(
  kpsUpgradeTarget?.spec?.targetFacts?.requirements?.every((requirement) =>
    requirement.category !== "crd"
    || requirement.packagePath
      === "packages/prometheus-community/kube-prometheus-stack/86.1.0/prerequisites/kube-prometheus-stack-lifecycle/default-crds.yaml"),
  "KPS 86.1.0 no-crds intent does not point at its versioned packaged CRDs",
);

const vault = intents.find((intent) =>
  intent.metadata.name === "hashicorp-vault-0-32-0-ha-raft-ui");
check(
  vault?.spec?.targetFacts?.requirements?.some((requirement) =>
    requirement.category === "topology" && requirement.name === "target topology"),
  "Vault requiredTopology was not normalized into a target requirement",
);

console.log(
  `verified ${intents.length} Helm render-intent contracts and ${gaps.length} explicit gap row(s)`,
);

function parseCsv(text) {
  const rows = text.split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  const header = rows[0] ?? [];
  return rows.slice(1).map((cells) =>
    Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])));
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current);
  return cells;
}

function checkRepoReference(reference, owner) {
  check(
    reference.startsWith("http://")
      || reference.startsWith("https://")
      || existsSync(join(repoRoot, reference)),
    `${owner} points at missing evidence: ${reference}`,
  );
}
