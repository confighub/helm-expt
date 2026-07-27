#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  repoRoot,
  sha256File,
  toYaml,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--hub-verify";
if (!["--hub-sync", "--hub-verify"].includes(mode)) {
  console.error("Usage: node scripts/sync-hooks-crds-app.mjs [--hub-sync|--hub-verify]");
  process.exit(1);
}

const cubContext = process.env.CUB_CONTEXT ?? "";
const expectedOrg = "helm-catalog";
const appRoot = join(repoRoot, "data", "hooks-crds-app");
const receiptPath = join(appRoot, "live-receipt.yaml");
const baselineFilterRef = "platform/helm-catalog-checks";
const lifecycleTriggerRef = "platform/lifecycle-route-evidence";

const spaces = [
  {
    role: "kps",
    slug: "route-sketch-kube-prometheus-stack",
    routeRoot: join(appRoot, "routes"),
    readmePath: join(
      repoRoot,
      "data",
      "helm-catalog-readmes",
      "units",
      "route-sketch-kube-prometheus-stack",
      "readme.yaml",
    ),
    labels: {
      App: "hooks-crds",
      ApplyPolicyProfile: "catalog-standard",
      ChartVersion: "85.3.3",
      RouteStatus: "live-partial",
    },
  },
  {
    role: "hook-probe",
    slug: "hook-probe-base",
    routeRoot: join(appRoot, "hook-probe"),
    readmePath: join(
      repoRoot,
      "data",
      "helm-catalog-readmes",
      "units",
      "hook-probe-base",
      "readme.yaml",
    ),
    labels: {
      App: "hooks-crds",
      ApplyPolicyProfile: "catalog-standard",
      RouteStatus: "proven-fixture",
    },
  },
];

runLocalVerification();
assertOrg();

if (mode === "--hub-sync") {
  syncSpaces();
  const negativeTest = runNegativeGateTest();
  writeYaml(receiptPath, buildReceipt(negativeTest));
  verifyHub();
  console.log("synced Hooks and CRDs App Spaces, route Units, README Units, and live receipt");
} else {
  verifyHub();
  console.log("verified live Hooks and CRDs App Spaces, route Units, README Units, and blocked dry-run apply");
}

function runLocalVerification() {
  execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", "generate-hooks-crds-app.mjs"), "--verify"],
    { cwd: repoRoot, stdio: "inherit" },
  );
  for (const space of spaces) {
    check(existsSync(space.readmePath), `missing generated README Unit for ${space.slug}`);
  }
}

function assertOrg() {
  const context = cub(["context", "get"]);
  check(
    context.includes(expectedOrg),
    `refusing to run: cub context does not show organization '${expectedOrg}'`,
  );
}

function syncSpaces() {
  for (const space of spaces) {
    const labelArgs = Object.entries(space.labels)
      .flatMap(([key, value]) => ["--label", `${key}=${value}`]);
    cub([
      "space",
      "update",
      space.slug,
      ...labelArgs,
      "--trigger-filter",
      baselineFilterRef,
      "--where-trigger",
      "-",
      "--quiet",
    ]);
    cub(["space", "update", "--patch", space.slug, "--refresh-triggers", "--quiet"]);

    for (const route of routeSources(space)) {
      upsertUnit({
        space: space.slug,
        slug: route.unitSlug,
        sourcePath: route.path,
        labels: {
          App: "hooks-crds",
          RecordType: "lifecycle-route",
          RouteScope: space.role,
        },
        changeDescription: "Record the checked lifecycle route and its evidence",
      });
    }

    upsertUnit({
      space: space.slug,
      slug: "readme",
      sourcePath: space.readmePath,
      labels: {
        App: "hooks-crds",
        RecordType: "readme",
      },
      changeDescription: "Explain the Hooks and CRDs example in plain English",
    });
  }
}

function upsertUnit({
  space,
  slug,
  sourcePath,
  labels,
  changeDescription,
}) {
  let exists = true;
  try {
    cubJson(["unit", "get", slug, "--space", space]);
  } catch {
    exists = false;
  }
  const labelArgs = Object.entries(labels)
    .flatMap(([key, value]) => ["--label", `${key}=${value}`]);
  const action = exists ? "update" : "create";
  cub([
    "unit",
    action,
    "--space",
    space,
    slug,
    sourcePath,
    ...labelArgs,
    "--change-desc",
    changeDescription,
    "--quiet",
  ]);
  console.log(`${exists ? "updated" : "created"} ${space}/${slug}`);
}

function runNegativeGateTest() {
  const space = spaces.find((item) => item.role === "kps");
  const source = routeSources(space).find((item) => item.unitSlug === "route-crds-first");
  check(source, "CRD-first route source is missing");
  const unitBefore = cubJson(["unit", "get", source.unitSlug, "--space", space.slug]).Unit;
  const fixtureSlug = "route-policy-negative-test";
  const targetRef = "bitnami-redis-27-0-0-stage-pilot-live-20260705/oci-target";
  const invalid = readYaml(source.path);
  invalid.spec.automatic = true;
  invalid.spec.evidence = [];

  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-route-gate-"));
  const fixturePath = join(tempRoot, "invalid-route.yaml");
  try {
    writeFileSync(fixturePath, `${toYaml(invalid)}\n`);
    try {
      cub(["unit", "delete", "--space", space.slug, fixtureSlug, "--quiet"]);
    } catch {
      // A previous clean run leaves no fixture.
    }
    cub([
      "unit",
      "create",
      "--space",
      space.slug,
      fixtureSlug,
      fixturePath,
      "--label",
      "App=hooks-crds",
      "--label",
      "RecordType=negative-gate-fixture",
      "--change-desc",
      "Test that unsupported automatic lifecycle routes cannot be applied",
      "--quiet",
    ]);
    const gated = waitForGate(space.slug, fixtureSlug);
    const gateKey = `${lifecycleTriggerRef}/vet-cel`;
    check(
      gated.ApplyGates?.[gateKey] === true,
      `the invalid route did not receive ${gateKey}`,
    );
    cub(["unit", "set-target", "--space", space.slug, fixtureSlug, targetRef, "--quiet"]);
    const applyResult = spawnCub([
      "unit",
      "apply",
      "--space",
      space.slug,
      fixtureSlug,
      "--dry-run",
      "--wait",
      "-o",
      "json",
    ]);
    check(applyResult.status !== 0, "the invalid lifecycle route passed the apply boundary");
    const applyOutput = `${applyResult.stderr ?? ""}\n${applyResult.stdout ?? ""}`.trim();
    check(
      /apply gate|ApplyGate/i.test(applyOutput),
      `the invalid route failed for an unexpected reason: ${applyOutput.slice(0, 500)}`,
    );
    const unitAfter = cubJson(["unit", "get", source.unitSlug, "--space", space.slug]).Unit;
    check(
      unitAfter.DataHash === unitBefore.DataHash,
      "the negative gate test changed the live CRD-first route",
    );
    return {
      testedAt: new Date().toISOString(),
      space: space.slug,
      fixtureUnit: fixtureSlug,
      fixture: "automatic=true with an empty evidence list",
      result: "blocked",
      gate: gateKey,
      validation: gated.ValidationResults?.[gateKey] ?? {},
      target: targetRef,
      applyExitCode: applyResult.status,
      applyMessage: applyOutput
        .replaceAll(tempRoot, "<temporary-directory>")
        .slice(0, 1200),
      fixtureDeleted: true,
      checkedUnit: source.unitSlug,
      checkedUnitDataHashBefore: unitBefore.DataHash,
      checkedUnitDataHashAfter: unitAfter.DataHash,
    };
  } finally {
    try {
      cub(["unit", "delete", "--space", space.slug, fixtureSlug, "--quiet"]);
    } catch {
      // Cleanup is also checked by the live verifier.
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function waitForGate(space, slug) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const unit = cubJson(["unit", "get", slug, "--space", space]).Unit;
    const gates = unit.ApplyGates ?? {};
    if (Object.keys(gates).some((key) => key !== "awaiting/triggers")) return unit;
    execFileSync("sleep", ["1"]);
  }
  throw new Error(`${space}/${slug} did not receive a completed ApplyGate within 30 seconds`);
}

function buildReceipt(negativeTest) {
  const trigger = readTrigger();
  const filter = readFilter();
  const spaceReceipts = spaces.map((space) => readSpaceReceipt(space, filter.FilterID));
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HooksCrdsAppLiveReceipt",
    metadata: {
      name: "helm-catalog-hooks-crds-app",
    },
    spec: {
      organization: expectedOrg,
      verifiedAt: new Date().toISOString(),
      policy: {
        profile: "catalog-standard",
        filter: {
          ref: baselineFilterRef,
          id: filter.FilterID,
          hash: String(filter.Hash ?? "").trim(),
          where: filter.Where,
        },
        lifecycleRouteTrigger: triggerReceipt(trigger),
      },
      spaces: spaceReceipts,
      negativeGateTest: negativeTest,
      evidence: [
        "runs/kps-lifecycle-route-proof/receipt.yaml",
        "runs/crd-ordering-gap/receipt.yaml",
        "runs/hook-execution-proof/receipt.yaml",
        "runs/oci-hook-delivery-proof/receipt.yaml",
        "data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml",
      ],
    },
    status: {
      result: "partial",
      claim: "The live demo org stores the Kube Prometheus Stack route plan, seven passing direct fresh-install implementations, and the proven hook fixture under one policy. The policy blocked an unsupported automatic route from being applied.",
      limits: [
        "The top-level Kube Prometheus Stack route Units remain automatic: false because the chart-specific Argo CD, Flux, and upgrade implementations have not run.",
        "The seven passing Kube Prometheus Stack implementations apply only to the direct fresh-install script and its receipt.",
        "The automatic hook claim applies only to the recorded fixture and its three delivery receipts.",
        "The policy checks route records; it does not prove that every chart has a complete route plan.",
      ],
    },
  };
}

function readSpaceReceipt(spaceDefinition, expectedFilterId) {
  const space = cubJson(["space", "get", spaceDefinition.slug]).Space;
  check(
    space.TriggerFilterID === expectedFilterId,
    `${spaceDefinition.slug} is not using the catalog-standard baseline filter`,
  );
  const routes = routeSources(spaceDefinition).map((source) => {
    const unit = cubJson(["unit", "get", source.unitSlug, "--space", spaceDefinition.slug]).Unit;
    assertUnitMatches(unit, source.path, `${spaceDefinition.slug}/${source.unitSlug}`);
    return unitReceipt(unit, source.path);
  });
  const readme = cubJson(["unit", "get", "readme", "--space", spaceDefinition.slug]).Unit;
  assertUnitMatches(readme, spaceDefinition.readmePath, `${spaceDefinition.slug}/readme`);
  return {
    role: spaceDefinition.role,
    slug: spaceDefinition.slug,
    id: space.SpaceID,
    triggerFilterId: space.TriggerFilterID,
    labels: spaceDefinition.labels,
    routes,
    readme: unitReceipt(readme, spaceDefinition.readmePath),
  };
}

function verifyHub() {
  check(existsSync(receiptPath), `${receiptPath} is missing; run npm run hooks-crds-app:hub-sync`);
  const receipt = readYaml(receiptPath);
  check(receipt.kind === "HooksCrdsAppLiveReceipt", "Hooks and CRDs App receipt kind changed");
  check(receipt.spec?.organization === expectedOrg, "Hooks and CRDs App receipt organization changed");
  check(receipt.status?.result === "partial", "Hooks and CRDs App receipt overclaims a complete result");

  const trigger = readTrigger();
  const filter = readFilter();
  const recordedTrigger = receipt.spec?.policy?.lifecycleRouteTrigger;
  check(
    canonicalJson(triggerReceipt(trigger)) === canonicalJson(recordedTrigger),
    "live lifecycle-route-evidence Trigger differs from the receipt",
  );
  check(filter.FilterID === receipt.spec?.policy?.filter?.id, "live baseline filter ID differs from the receipt");
  check(
    String(filter.Hash ?? "").trim() === receipt.spec?.policy?.filter?.hash,
    "live baseline filter hash differs from the receipt",
  );
  check(filter.Where === receipt.spec?.policy?.filter?.where, "live baseline filter selector differs from the receipt");

  const recordedSpaces = receipt.spec?.spaces ?? [];
  check(recordedSpaces.length === spaces.length, "Hooks and CRDs App receipt has the wrong Space count");
  for (const spaceDefinition of spaces) {
    const recorded = recordedSpaces.find((item) => item.slug === spaceDefinition.slug);
    check(recorded, `Hooks and CRDs App receipt is missing ${spaceDefinition.slug}`);
    const space = cubJson(["space", "get", spaceDefinition.slug]).Space;
    check(space.SpaceID === recorded.id, `${spaceDefinition.slug} ID differs from the receipt`);
    check(space.TriggerFilterID === filter.FilterID, `${spaceDefinition.slug} lost the baseline filter`);
    check(
      space.TriggerIDs?.includes(trigger.TriggerID),
      `${spaceDefinition.slug} does not select the lifecycle-route-evidence Trigger`,
    );
    for (const [key, value] of Object.entries(spaceDefinition.labels)) {
      check(space.Labels?.[key] === value, `${spaceDefinition.slug} label ${key} drifted`);
    }

    const sources = routeSources(spaceDefinition);
    check(recorded.routes?.length === sources.length, `${spaceDefinition.slug} route count drifted`);
    for (const source of sources) {
      const unit = cubJson(["unit", "get", source.unitSlug, "--space", spaceDefinition.slug]).Unit;
      assertUnitMatches(unit, source.path, `${spaceDefinition.slug}/${source.unitSlug}`);
      const recordedUnit = recorded.routes.find((item) => item.slug === source.unitSlug);
      check(recordedUnit, `receipt is missing ${spaceDefinition.slug}/${source.unitSlug}`);
      check(unit.UnitID === recordedUnit.id, `${spaceDefinition.slug}/${source.unitSlug} ID drifted`);
      check(unit.DataHash === recordedUnit.dataHash, `${spaceDefinition.slug}/${source.unitSlug} hash drifted`);
      check(sha256File(source.path) === recordedUnit.sourceSha256, `${source.sourcePath} source hash drifted`);
    }

    const readme = cubJson(["unit", "get", "readme", "--space", spaceDefinition.slug]).Unit;
    assertUnitMatches(readme, spaceDefinition.readmePath, `${spaceDefinition.slug}/readme`);
    check(readme.UnitID === recorded.readme?.id, `${spaceDefinition.slug}/readme ID drifted`);
    check(readme.DataHash === recorded.readme?.dataHash, `${spaceDefinition.slug}/readme hash drifted`);
    check(
      sha256File(spaceDefinition.readmePath) === recorded.readme?.sourceSha256,
      `${spaceDefinition.slug}/readme source hash drifted`,
    );

    const listed = cubJson(["unit", "list", "--space", spaceDefinition.slug, "--quiet"]);
    const readmeSlugs = listed
      .map((item) => item.Unit?.Slug)
      .filter((slug) => slug?.toLowerCase().includes("readme"));
    check(
      readmeSlugs.length === 1 && readmeSlugs[0] === "readme",
      `${spaceDefinition.slug} must contain exactly one readme Unit`,
    );
  }

  const negative = receipt.spec?.negativeGateTest;
  check(negative?.result === "blocked", "negative lifecycle route test was not recorded as blocked");
  check(
    negative.checkedUnitDataHashBefore === negative.checkedUnitDataHashAfter,
    "negative lifecycle route test changed the source Unit",
  );
  let negativeFixtureExists = true;
  try {
    cubJson(["unit", "get", negative.fixtureUnit, "--space", negative.space]);
  } catch {
    negativeFixtureExists = false;
  }
  check(!negativeFixtureExists, "negative lifecycle route fixture was not deleted");
}

function readTrigger() {
  const [space, slug] = splitRef(lifecycleTriggerRef);
  const trigger = cubJson(["trigger", "get", "--space", space, slug]).Trigger;
  check(trigger.FunctionName === "vet-cel", "lifecycle route Trigger function changed");
  check(trigger.Validating === true, "lifecycle route Trigger is not validating");
  check(trigger.Warn !== true, "lifecycle route Trigger became advisory");
  const expression = trigger.Arguments
    ?.find((argument) => argument.ParameterName === "expression")?.Value ?? "";
  for (const term of ["LifecycleRoute", "automatic", "disposition", "evidence"]) {
    check(expression.includes(term), `live lifecycle route Trigger does not check ${term}`);
  }
  return trigger;
}

function readFilter() {
  const [space, slug] = splitRef(baselineFilterRef);
  const filter = cubJson(["filter", "get", "--space", space, slug]).Filter;
  check(
    filter.Where.includes("lifecycle-route-evidence"),
    "baseline filter does not select lifecycle-route-evidence",
  );
  return filter;
}

function triggerReceipt(trigger) {
  return {
    ref: lifecycleTriggerRef,
    id: trigger.TriggerID,
    hash: trigger.Hash,
    functionName: trigger.FunctionName,
    arguments: (trigger.Arguments ?? []).map((argument) => ({
      name: argument.ParameterName,
      value: argument.Value,
    })),
    description: trigger.Description ?? "",
    effect: trigger.Warn === true ? "warn" : "block",
    validating: trigger.Validating === true,
  };
}

function routeSources(space) {
  return readdirSync(space.routeRoot)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => {
      const path = join(space.routeRoot, name);
      const route = readYaml(path);
      return {
        path,
        sourcePath: path.slice(`${repoRoot}/`.length),
        unitSlug: `route-${route.metadata.name}`,
      };
    });
}

function assertUnitMatches(unit, path, label) {
  const liveText = Buffer.from(unit.Data, "base64").toString("utf8");
  check(
    canonicalHash(liveText) === canonicalHash(readFileSync(path, "utf8")),
    `${label} differs from ${path.slice(`${repoRoot}/`.length)}`,
  );
}

function unitReceipt(unit, sourcePath) {
  return {
    slug: unit.Slug,
    id: unit.UnitID,
    dataHash: unit.DataHash,
    headRevision: unit.HeadRevisionNum,
    source: sourcePath.slice(`${repoRoot}/`.length),
    sourceSha256: sha256File(sourcePath),
  };
}

function canonicalHash(text) {
  return createHash("sha256").update(JSON.stringify(parseDocs(text))).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(canonicalJson(item))));
  if (value && typeof value === "object") {
    const sorted = Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, JSON.parse(canonicalJson(value[key]))]),
    );
    return JSON.stringify(sorted);
  }
  return JSON.stringify(value);
}

function splitRef(ref) {
  const slash = ref.indexOf("/");
  return [ref.slice(0, slash), ref.slice(slash + 1)];
}

function cubJson(args) {
  return JSON.parse(cub([...args, "-o", "json"]));
}

function cub(args) {
  const contextArgs = cubContext ? ["--context", cubContext] : [];
  return execFileSync("cub", [...contextArgs, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 200,
  });
}

function spawnCub(args) {
  const contextArgs = cubContext ? ["--context", cubContext] : [];
  return spawnSync("cub", [...contextArgs, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    maxBuffer: 1024 * 1024 * 200,
  });
}
