#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const chart = "prometheus-community/kube-prometheus-stack";
const chartSlug = "prometheus-community-kube-prometheus-stack";
const version = "85.3.3";
const variants = ["default", "no-crds"];
const decisionPath = join(repoRoot, "data", "production-support-decisions", chartSlug, "security-decision.yaml");
const supportDecisionPath = join(repoRoot, "data", "production-support-decisions", chartSlug, "support-decision.yaml");
const scanWorkdownPath = join(repoRoot, "data", "scan-disposition-workdown", "workdown.csv");
const externalScanPath = join(repoRoot, "data", "external-scan-lane", "review.csv");

if (mode === "--generate") {
  writeYaml(decisionPath, buildDecision());
  console.log(`wrote ${relativeRepo(decisionPath)}`);
} else if (mode === "--verify") {
  verifyDecision();
  console.log(`verified ${relativeRepo(decisionPath)}`);
} else {
  console.log(`Usage:
  node scripts/generate-kps-security-support-decision.mjs --generate
  node scripts/generate-kps-security-support-decision.mjs --verify`);
}

function buildDecision() {
  const scanSummary = scanWorkdownRow();
  const variantScans = variants.map((variant) => variantScan(variant));
  const externalRows = parseCsv(readFileSync(externalScanPath, "utf8")).filter(
    (row) => row.chart === chart && row.version === version && variants.includes(row.variant),
  );
  check(externalRows.length === variants.length, `expected external scan rows for ${variants.join(", ")}`);

  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionSecurityDecision",
    metadata: {
      name: `${chartSlug}-public-oci-security-decision`,
    },
    spec: {
      chart,
      version,
      targetScope: {
        clusterClass: "vanilla-kubernetes",
        namespace: "monitoring",
        deliveryPath: "confighub-oci",
        gitopsController: "argo-or-flux",
      },
      supportedBaseCandidate: "default",
      variantsCovered: variants,
      decision: "accepted-for-target-scope",
      decidedAt: "2026-06-09",
      claim:
        "The recorded scan findings are accepted for this public monitoring infrastructure support draft, subject to the stated support boundary and remaining non-security blockers.",
      route: scanSummary.dispositionRoute,
      routeReason: scanSummary.routeReason,
      findingSummary: {
        externalScan: {
          scanner: "kube-linter",
          result: "warn",
          totalFindings: Number(scanSummary.findingCount),
          topChecks: parseCountMap(scanSummary.topChecks),
        },
        localRenderedScans: Object.fromEntries(
          variantScans.map((row) => [
            row.variant,
            {
              result: row.result,
              renderedObjectSetSHA256: row.renderedObjectSetSHA256,
              findingCounts: row.findingCounts,
            },
          ]),
        ),
      },
      acceptedFindings: [
        {
          group: "dangling-service",
          disposition:
            "Accepted for this monitoring scope when services intentionally point at existing cluster components or operator-created workloads. Fresh live evidence must still confirm runtime behavior.",
        },
        {
          group: "host-network-host-pid-sensitive-host-mounts",
          disposition:
            "Accepted for this monitoring infrastructure scope where node or control-plane observation requires host access. A hardened or narrower base is still allowed for stricter environments.",
        },
        {
          group: "resource-policy",
          disposition:
            "Accepted as chart-default behavior for this public proof scope. A production customer scope may require a resource-policy base or overlay before support.",
        },
        {
          group: "read-only-root-filesystem",
          disposition:
            "Accepted as chart-default behavior for this support draft. Hardened bases should be created where the chart supports safe hardening values.",
        },
      ],
      limits: [
        "This is not a blanket security approval for all clusters, overlays, Kubernetes distributions, or private values.",
        "This does not make kube-prometheus-stack production-supported by itself.",
        "Final support still needs the image pin-or-exception decision, lifecycle observation, and fresh target-scoped ConfigHub OCI/GitOps/live evidence.",
        "The no-crds variant remains valid only when compatible CRDs are already installed and observed in the target.",
      ],
      evidence: [
        {
          path: relativeRepo(scanWorkdownPath),
          claim: "Routes kube-prometheus-stack scan findings to accept-or-split-privileged-infrastructure.",
        },
        {
          path: relativeRepo(externalScanPath),
          claim: "Records kube-linter warning counts for default and no-crds rendered object sets.",
        },
        ...variants.map((variant) => ({
          path: `recipes/${chart}/${version}/revisions/${variant}/r001/receipts/scan-receipt.yaml`,
          claim: `Local rendered-object scan receipt for ${variant}.`,
        })),
        {
          path: `data/production-disposition/receipts/${chartSlug}/scan-gate-warning-disposition.yaml`,
          claim: "Earlier production disposition accepts scan warnings as production-review inputs, not final production support.",
        },
      ],
      remainingSupportBlockers: [
        "Choose a digest-pinned base, image override policy, or explicit mutable-image exception before production OCI support.",
        "Execute or observe the selected hook lifecycle route, including webhook TLS/readiness, cleanup, ordering, and upgrade behavior.",
        "Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope after the previous decisions are closed.",
      ],
    },
  };
}

function verifyDecision() {
  check(existsSync(decisionPath), `${relativeRepo(decisionPath)} is missing; run npm run kps:security-decision`);
  const decision = readYaml(decisionPath);
  check(decision.kind === "ProductionSecurityDecision", `${relativeRepo(decisionPath)} must be kind ProductionSecurityDecision`);
  const spec = decision.spec ?? {};
  check(spec.chart === chart, `${relativeRepo(decisionPath)} chart mismatch`);
  check(spec.version === version, `${relativeRepo(decisionPath)} version mismatch`);
  check(spec.decision === "accepted-for-target-scope", `${relativeRepo(decisionPath)} decision mismatch`);
  check(JSON.stringify(spec.variantsCovered ?? []) === JSON.stringify(variants), `${relativeRepo(decisionPath)} variants mismatch`);
  check((spec.limits ?? []).some((item) => item.includes("does not make kube-prometheus-stack production-supported")), `${relativeRepo(decisionPath)} must state support limit`);

  const scanSummary = scanWorkdownRow();
  check(spec.route === scanSummary.dispositionRoute, `${relativeRepo(decisionPath)} route mismatch`);
  check(Number(spec.findingSummary?.externalScan?.totalFindings) === Number(scanSummary.findingCount), `${relativeRepo(decisionPath)} finding count mismatch`);

  for (const variant of variants) {
    const scan = variantScan(variant);
    const recorded = spec.findingSummary?.localRenderedScans?.[variant];
    check(recorded, `${relativeRepo(decisionPath)} missing local scan summary for ${variant}`);
    check(recorded.result === scan.result, `${relativeRepo(decisionPath)} scan result mismatch for ${variant}`);
    check(recorded.renderedObjectSetSHA256 === scan.renderedObjectSetSHA256, `${relativeRepo(decisionPath)} rendered sha mismatch for ${variant}`);
  }
  for (const evidence of spec.evidence ?? []) {
    check(evidence.path, `${relativeRepo(decisionPath)} evidence without path`);
    check(existsSync(join(repoRoot, evidence.path)), `${relativeRepo(decisionPath)} references missing evidence ${evidence.path}`);
  }
}

function scanWorkdownRow() {
  const rows = parseCsv(readFileSync(scanWorkdownPath, "utf8")).filter((row) => row.chart === chart && row.version === version);
  check(rows.length === 1, `expected one scan workdown row for ${chart}`);
  return rows[0];
}

function variantScan(variant) {
  const path = join(repoRoot, "recipes", chart, version, "revisions", variant, "r001", "receipts", "scan-receipt.yaml");
  check(existsSync(path), `missing scan receipt ${relativeRepo(path)}`);
  const receipt = readYaml(path);
  const spec = receipt.spec ?? {};
  return {
    variant,
    result: spec.result,
    renderedObjectSetSHA256: spec.renderedObjectSetSHA256,
    findingCounts: spec.findingCounts,
  };
}

function parseCountMap(text) {
  return Object.fromEntries(
    String(text ?? "")
      .split(";")
      .filter(Boolean)
      .map((item) => {
        const [key, count] = item.split(":");
        return [key, Number(count ?? 0)];
      }),
  );
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}
