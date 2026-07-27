#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error("Usage: node scripts/generate-hooks-crds-app.mjs [--generate|--verify|--self-test]");
  process.exit(1);
}

const appRoot = join(repoRoot, "data", "hooks-crds-app");
const routesRoot = join(appRoot, "routes");
const hookProbeRoot = join(appRoot, "hook-probe");
const summaryPath = join(appRoot, "summary.md");
const kpsDirectReceiptPath = join(
  repoRoot,
  "runs",
  "kps-lifecycle-route-proof",
  "receipt.yaml",
);
const intentPath = join(
  repoRoot,
  "data",
  "helm-render-intents",
  "intents",
  "prometheus-community-kube-prometheus-stack-85-3-3-default.yaml",
);

const intent = readYaml(intentPath);
const kpsDirectReceipt = readYaml(kpsDirectReceiptPath);
const report = buildReport(intent, kpsDirectReceipt);

if (mode === "--self-test") {
  const badRoute = structuredClone(report.routes[0].document);
  badRoute.spec.automatic = true;
  badRoute.spec.evidence = [];
  expectFailure(
    () => validateRoute(badRoute),
    "an automatic route with no evidence unexpectedly passed",
  );
  console.log("verified Hooks and CRDs App route-contract self-test");
  process.exit(0);
}

if (mode === "--generate") {
  rmSync(routesRoot, { recursive: true, force: true });
  rmSync(hookProbeRoot, { recursive: true, force: true });
  for (const route of report.routes) writeYaml(route.path, route.document);
  write(summaryPath, report.summary);
  console.log(
    `wrote Hooks and CRDs App records -> ${relativeRepo(appRoot)} (${report.routes.length} route(s))`,
  );
} else {
  verifyGenerated(report);
  console.log(`verified Hooks and CRDs App records (${report.routes.length} route(s))`);
}

function buildReport(renderIntent, directReceipt) {
  check(renderIntent.kind === "HelmRenderIntent", "Kube Prometheus Stack render intent is missing");
  check(
    renderIntent.spec?.chart?.name === "prometheus-community/kube-prometheus-stack",
    "Hooks and CRDs App points at the wrong chart",
  );
  check(renderIntent.spec?.chart?.version === "85.3.3", "Hooks and CRDs App chart version changed");
  check(renderIntent.spec?.baseVariant === "default", "Hooks and CRDs App base changed");

  const chartRoutes = (renderIntent.spec?.lifecycle?.variantRoutes ?? []).map((source) => {
    const document = withKpsImplementations(lifecycleRoute({
      chart: renderIntent.spec.chart.name,
      version: renderIntent.spec.chart.version,
      base: renderIntent.spec.baseVariant,
      routeName: source.routeName,
      quirkClass: source.quirkClass,
      lifecyclePhase: source.lifecyclePhase,
      actionKind: source.actionKind,
      executionMode: source.executionMode,
      automatic: source.automatic,
      whoRuns: source.whoRuns,
      command: source.command,
      disposition: source.disposition,
      alternatives: source.alternatives ?? [],
      evidence: source.evidence,
      evidenceRequired: source.evidenceRequired,
      gitOps: source.gitOps,
      origin: {
        type: "helm-render-intent",
        record: relativeRepo(intentPath),
        routeSourceVersion: source.routeSourceVersion,
      },
    }), directReceipt);
    return routeRecord(document, join(routesRoot, `route-${source.routeName}.yaml`), "kps");
  });

  const crdFirst = withKpsImplementations(lifecycleRoute({
    chart: renderIntent.spec.chart.name,
    version: renderIntent.spec.chart.version,
    base: renderIntent.spec.baseVariant,
    routeName: "crds-first",
    quirkClass: "crd-install",
    lifecyclePhase: "pre-apply",
    actionKind: "install-crds-and-wait",
    executionMode: "target-owned",
    automatic: false,
    whoRuns: "Your delivery system applies the CRDs and waits for them before applying custom resources.",
    command: "kubectl apply -f crds.yaml && kubectl wait --for=condition=Established crd --all",
    disposition: "observed",
    alternatives: [
      "Use the no-crds preset when compatible CRDs are already managed by the platform.",
      "Keep the default preset when this package owns the CRDs.",
    ],
    evidence: [
      "runs/crd-ordering-gap/receipt.yaml",
      "runs/top20-local-kind/kube-prometheus-stack-default/observation-receipt.json",
      "data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/crd-lifecycle-and-upgrade-policy.yaml",
    ],
    evidenceRequired: "Repeat the ordering and compatibility checks when the chart or target Kubernetes version changes.",
    gitOps: {
      emitsControllerStep: true,
      argoCd: "Put CRDs in an earlier sync wave and wait before dependent custom resources.",
      flux: "Use an earlier CRD Kustomization and dependsOn before the workload Kustomization.",
      argoCdSnippet: "metadata:\n  annotations:\n    argocd.argoproj.io/sync-wave: \"-2\"",
    },
    origin: {
      type: "chart-specific-addition",
      record: "runs/crd-ordering-gap/receipt.yaml",
      routeSourceVersion: "85.3.3",
    },
  }), directReceipt);

  const hookProbe = lifecycleRoute({
    chart: "tests/fixtures/hook-replacement-probe",
    version: "1",
    base: "base",
    routeName: "explicit-managed-action",
    quirkClass: "hook-phase",
    lifecyclePhase: "post-apply",
    actionKind: "run-job",
    executionMode: "target-owned",
    automatic: true,
    whoRuns: "Argo CD, Flux, or the direct apply script runs the packaged Job and waits for completion.",
    command: "kubectl apply -f job.yaml && kubectl wait --for=condition=complete job/hook-replacement-migration",
    disposition: "observed",
    alternatives: [
      "Argo CD PostSync hook",
      "Flux follow-on Kustomization",
      "direct apply followed by kubectl wait",
    ],
    evidence: [
      "runs/hook-execution-proof/receipt.yaml",
      "runs/oci-hook-delivery-proof/receipt.yaml",
    ],
    evidenceRequired: "Automatic is justified only for this fixture and these three recorded delivery paths.",
    gitOps: {
      emitsControllerStep: true,
      argoCd: "PostSync",
      flux: "follow-on Kustomization with dependsOn",
      argoCdSnippet: "metadata:\n  annotations:\n    argocd.argoproj.io/hook: PostSync\n    argocd.argoproj.io/hook-delete-policy: HookSucceeded",
    },
    origin: {
      type: "live-fixture",
      record: "runs/oci-hook-delivery-proof/receipt.yaml",
      routeSourceVersion: "1",
    },
  });

  const routes = [
    ...chartRoutes,
    routeRecord(crdFirst, join(routesRoot, "route-crds-first.yaml"), "kps"),
    routeRecord(
      hookProbe,
      join(hookProbeRoot, "route-explicit-managed-action.yaml"),
      "hook-probe",
    ),
  ].sort((left, right) => left.path.localeCompare(right.path));

  validateRoutes(routes.map((item) => item.document));
  return { routes, summary: renderSummary(routes.map((item) => item.document)) };
}

function withKpsImplementations(route, receipt) {
  check(
    receipt.kind === "KubePrometheusStackLifecycleRouteReceipt",
    "the Kube Prometheus Stack direct lifecycle receipt is missing or invalid",
  );
  check(
    receipt.spec?.chart === "prometheus-community/kube-prometheus-stack"
      && receipt.spec?.version === "85.3.3"
      && receipt.spec?.base === "default"
      && receipt.spec?.deliveryPath === "direct-apply"
      && receipt.spec?.result === "pass",
    "the Kube Prometheus Stack direct lifecycle receipt covers the wrong source or did not pass",
  );
  const direct = receipt.spec?.routes?.[route.spec.routeName];
  check(direct, `the direct receipt has no result for ${route.spec.routeName}`);
  route.spec.implementations = {
    directApply: {
      result: direct.result,
      automatic: direct.automatic,
      executor: direct.executor ?? "",
      evidence: relativeRepo(kpsDirectReceiptPath),
      observation: direct.observation ?? direct.reason,
    },
    argoCd: {
      result: "not-run",
      automatic: false,
      evidence: "",
      observation: "No chart-specific Argo CD route receipt exists yet.",
    },
    flux: {
      result: "not-run",
      automatic: false,
      evidence: "",
      observation: "No chart-specific Flux route receipt exists yet.",
    },
  };
  if (!route.spec.evidence.includes(relativeRepo(kpsDirectReceiptPath))) {
    route.spec.evidence.push(relativeRepo(kpsDirectReceiptPath));
  }
  return route;
}

function lifecycleRoute({
  chart,
  version,
  base,
  routeName,
  quirkClass,
  lifecyclePhase,
  actionKind,
  executionMode,
  automatic,
  whoRuns,
  command,
  disposition,
  alternatives,
  evidence,
  evidenceRequired,
  gitOps,
  origin,
}) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "LifecycleRoute",
    metadata: {
      name: routeName,
      labels: {
        app: "hooks-crds",
        chart: chart.replaceAll("/", "-"),
        base,
        lifecyclePhase,
      },
    },
    spec: {
      chart,
      version,
      base,
      routeName,
      quirkClass,
      lifecyclePhase,
      actionKind,
      executionMode,
      automatic,
      whoRuns,
      command,
      disposition,
      alternatives,
      evidence,
      evidenceRequired,
      gitOps,
      origin,
    },
  };
}

function routeRecord(document, path, spaceRole) {
  return {
    document,
    path,
    sourcePath: relativeRepo(path),
    unitSlug: `route-${document.metadata.name}`,
    spaceRole,
  };
}

function validateRoutes(routes) {
  check(routes.length === 9, `expected nine Hooks and CRDs App routes, found ${routes.length}`);
  const identities = routes.map(
    (route) => `${route.spec.chart}@${route.spec.version}/${route.spec.base}/${route.spec.routeName}`,
  );
  check(new Set(identities).size === identities.length, "Hooks and CRDs App route identities overlap");
  for (const route of routes) validateRoute(route);

  const kpsRoutes = routes.filter(
    (route) => route.spec.chart === "prometheus-community/kube-prometheus-stack",
  );
  check(kpsRoutes.length === 8, `expected eight Kube Prometheus Stack routes, found ${kpsRoutes.length}`);
  check(kpsRoutes.every((route) => route.spec.version === "85.3.3"), "Kube Prometheus Stack route version drifted");
  check(kpsRoutes.every((route) => route.spec.automatic === false), "a Kube Prometheus Stack route overclaims automatic execution");
  check(kpsRoutes.some((route) => route.spec.routeName === "crds-first"), "the explicit CRD-first route is missing");
  const directPasses = kpsRoutes.filter(
    (route) => route.spec.implementations?.directApply?.result === "pass"
      && route.spec.implementations?.directApply?.automatic === true,
  );
  check(
    directPasses.length === 7,
    `expected seven passing direct lifecycle implementations, found ${directPasses.length}`,
  );
  const upgrade = kpsRoutes.find(
    (route) => route.spec.routeName === "upgrade-action-with-receipt",
  );
  check(
    upgrade?.spec.implementations?.directApply?.result === "not-run"
      && upgrade?.spec.implementations?.directApply?.automatic === false,
    "the Kube Prometheus Stack upgrade route must remain not-run",
  );
  check(
    kpsRoutes.every(
      (route) => route.spec.implementations?.argoCd?.result === "not-run"
        && route.spec.implementations?.argoCd?.automatic === false
        && route.spec.implementations?.flux?.result === "not-run"
        && route.spec.implementations?.flux?.automatic === false,
    ),
    "an unproved Kube Prometheus Stack controller route changed status",
  );

  const automatic = routes.filter((route) => route.spec.automatic);
  check(automatic.length === 1, `expected one proven automatic fixture route, found ${automatic.length}`);
  check(
    automatic[0].spec.chart === "tests/fixtures/hook-replacement-probe",
    "automatic execution escaped the proven hook fixture",
  );
}

function validateRoute(route) {
  check(route.apiVersion === "helm-expt.confighub.com/v1alpha1", "LifecycleRoute apiVersion changed");
  check(route.kind === "LifecycleRoute", "route kind must be LifecycleRoute");
  check(route.metadata?.name === route.spec?.routeName, "route metadata and routeName differ");
  for (const field of [
    "chart",
    "version",
    "base",
    "routeName",
    "quirkClass",
    "lifecyclePhase",
    "actionKind",
    "executionMode",
    "disposition",
  ]) {
    check(route.spec?.[field] !== undefined && route.spec[field] !== "", `${route.metadata?.name ?? "route"} has no ${field}`);
  }
  check(
    ["product-executes", "user-executes", "target-owned", "not-yet-executable"].includes(
      route.spec.executionMode,
    ),
    `${route.metadata.name} has an invalid executionMode`,
  );
  check(typeof route.spec.automatic === "boolean", `${route.metadata.name} has no automatic flag`);
  check(Array.isArray(route.spec.evidence) && route.spec.evidence.length > 0, `${route.metadata.name} has no evidence`);
  for (const evidencePath of route.spec.evidence) {
    check(existsSync(join(repoRoot, evidencePath)), `${route.metadata.name} points at missing ${evidencePath}`);
  }
  if (route.spec.automatic) {
    check(route.spec.disposition === "observed", `${route.metadata.name} claims automatic execution without an observed disposition`);
  }
}

function verifyGenerated(generatedReport) {
  const expectedFiles = new Set();
  for (const route of generatedReport.routes) {
    expectedFiles.add(route.path);
    check(existsSync(route.path), `${route.sourcePath} is missing; run npm run hooks-crds-app`);
    check(
      readFileSync(route.path, "utf8") === `${toYaml(route.document)}\n`,
      `${route.sourcePath} is stale; run npm run hooks-crds-app`,
    );
  }
  for (const root of [routesRoot, hookProbeRoot]) {
    const actual = existsSync(root)
      ? readdirSync(root)
        .filter((name) => name.endsWith(".yaml"))
        .map((name) => join(root, name))
      : [];
    check(
      actual.length === [...expectedFiles].filter((path) => path.startsWith(`${root}/`)).length &&
        actual.every((path) => expectedFiles.has(path)),
      `${relativeRepo(root)} contains missing or stale route files`,
    );
  }
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run hooks-crds-app`);
  check(
    readFileSync(summaryPath, "utf8") === generatedReport.summary,
    `${relativeRepo(summaryPath)} is stale; run npm run hooks-crds-app`,
  );
}

function renderSummary(routes) {
  const kps = routes.filter(
    (route) => route.spec.chart === "prometheus-community/kube-prometheus-stack",
  );
  const fixture = routes.find(
    (route) => route.spec.chart === "tests/fixtures/hook-replacement-probe",
  );
  return `# Hooks and CRDs App

This example shows how ConfigHub can keep the work around a Helm chart with the configuration it belongs to.

Kube Prometheus Stack 85.3.3 has ten CRDs, admission-webhook certificate setup, and checks that must happen at particular points in an install or upgrade. The ${kps.length} route records in this directory name that work. They say who runs each step and link to the receipts that support the choice.

The top-level chart routes remain \`automatic: false\`: ConfigHub does not yet choose and execute them across every delivery path. The direct-install script now has a narrower result. Seven fresh-install steps ran automatically in that script, using the chart's own certificate and patch Jobs. The upgrade step is still \`not-run\`. Argo CD and Flux are still \`not-run\` for this chart-specific sequence.

That distinction matters. A passing direct implementation does not turn the Argo CD or Flux columns green. Read the [direct lifecycle receipt](../../runs/kps-lifecycle-route-proof/receipt.yaml) for the exact sequence and limits.

The smaller hook fixture is different. Its \`${fixture.spec.routeName}\` route ran from one OCI bundle through Argo CD, Flux, and direct apply, so that fixture is recorded as \`automatic: true\`. The claim applies to that fixture, not to every Helm hook.

The \`catalog-standard\` apply policy checks every LifecycleRoute stored in the demo organization. A route must name its chart, version, base, executor, disposition, and evidence. A route cannot claim automatic execution unless its disposition is \`observed\` and it links to evidence.

## Route records

| Scope | Route | Phase | Who runs it | Top-level automatic | Direct script | Argo CD | Flux |
| --- | --- | --- | --- | --- | --- | --- | --- |
${routes.map((route) => {
  const direct = route.spec.implementations?.directApply?.result ?? (route.spec.automatic ? "pass" : "not-recorded");
  const argo = route.spec.implementations?.argoCd?.result ?? (route.spec.automatic ? "pass" : "not-recorded");
  const flux = route.spec.implementations?.flux?.result ?? (route.spec.automatic ? "pass" : "not-recorded");
  return `| ${route.spec.chart}@${route.spec.version}/${route.spec.base} | ${route.spec.routeName} | ${route.spec.lifecyclePhase} | ${route.spec.whoRuns} | ${route.spec.automatic ? "yes" : "no"} | ${direct} | ${argo} | ${flux} |`;
}).join("\n")}

## Human guide

Read [the Hooks and CRDs App guide](../../docs/demo/hooks-crds/kube-prometheus-stack.md) for the install order, the Argo CD, Flux, and direct-apply choices, what has been proved, and what is still manual.
`;
}

function expectFailure(fn, message) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  check(failed, message);
}
