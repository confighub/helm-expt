#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const chart = "prometheus-community/kube-prometheus-stack";
const chartSlug = "prometheus-community-kube-prometheus-stack";
const version = "85.3.3";
const variants = ["default", "no-crds"];
const decisionPath = join(repoRoot, "data", "production-support-decisions", chartSlug, "image-policy-decision.yaml");
const imageWorkdownPath = join(repoRoot, "data", "image-digest-workdown", "chart-summary.csv");
const attackPlanImageReviewPath = join(repoRoot, "data", "attack-plan-workdown", "image-digest-review.csv");

if (mode === "--generate") {
  writeYaml(decisionPath, buildDecision());
  console.log(`wrote ${relativeRepo(decisionPath)}`);
} else if (mode === "--verify") {
  verifyDecision();
  console.log(`verified ${relativeRepo(decisionPath)}`);
} else {
  console.log(`Usage:
  node scripts/generate-kps-image-policy-decision.mjs --generate
  node scripts/generate-kps-image-policy-decision.mjs --verify`);
}

function buildDecision() {
  const receipts = variants.map((variant) => imageDigestReceipt(variant));
  const chartSummary = imageDigestWorkdownRow();
  const imageReviewRows = parseCsv(readFileSync(attackPlanImageReviewPath, "utf8"))
    .filter((row) => row.chart === chart && row.version === version && variants.includes(row.variant));

  check(Number(chartSummary.subjects_needing_resolution) === variants.length, "expected both KPS variants to need image policy");
  check(Number(chartSummary.resolution_receipts) === variants.length, "expected KPS digest-resolution receipts for both variants");
  check(imageReviewRows.length > 0, "expected KPS image review rows");

  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionImagePolicyDecision",
    metadata: {
      name: `${chartSlug}-public-oci-image-policy-decision`,
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
      decision: "mutable-image-exception-accepted-for-target-scope",
      decidedAt: "2026-06-09",
      claim:
        "The rendered kube-prometheus-stack bases still contain mutable image tags, but each rendered image reference has digest-resolution evidence. For this public monitoring support draft, the mutable tags are accepted as a target-scoped exception while stricter environments remain free to require digest-pinned bases or image overrides.",
      renderedImageSummary: {
        renderedSubjects: Number(chartSummary.rendered_subjects),
        subjectsNeedingResolution: Number(chartSummary.subjects_needing_resolution),
        imageRefs: Number(chartSummary.image_refs),
        mutableTagRefs: Number(chartSummary.mutable_tag_refs),
        floatingLatestOrUntaggedRefs: Number(chartSummary.floating_latest_or_untagged_refs),
        resolutionReceipts: Number(chartSummary.resolution_receipts),
      },
      variantReceipts: Object.fromEntries(
        receipts.map((receipt) => [
          receipt.spec.variant,
          {
            renderedObjectSetSHA256: receipt.spec.renderedObjectSet.sha256,
            sourceImageReviewRows: receipt.spec.sourceImageReview.rows,
            uniqueImages: receipt.spec.sourceImageReview.uniqueImages,
            receiptPath: receipt.path,
          },
        ]),
      ),
      acceptedException: {
        reason:
          "The public proof target is a vanilla monitoring namespace using upstream chart defaults. The receipt set records the digest that each mutable reference resolved to at decision time, so reviewers can detect and rerun the decision when upstream image tags move.",
        operatorAction:
          "For stricter production environments, create a digest-pinned base or image override policy before final support.",
      },
      limits: [
        "This does not mean the rendered manifests are digest-pinned.",
        "This is not a blanket approval for all clusters, private overlays, regulated environments, or future chart versions.",
        "This does not make kube-prometheus-stack production-supported by itself.",
        "Final support still needs lifecycle observation and fresh target-scoped ConfigHub OCI/GitOps/live evidence.",
        "If any recorded upstream image tag is retargeted, rerun digest resolution and re-review this decision before promotion.",
      ],
      evidence: [
        {
          path: relativeRepo(imageWorkdownPath),
          claim: "Summarizes KPS rendered image references and shows digest-resolution receipts for both base variants.",
        },
        {
          path: relativeRepo(attackPlanImageReviewPath),
          claim: "Lists every rendered image reference found in the KPS object sets.",
        },
        ...receipts.map((receipt) => ({
          path: receipt.path,
          claim: `Records registry digest resolution for the ${receipt.spec.variant} rendered object set.`,
        })),
      ],
      remainingSupportBlockers: [
        "Execute or observe the selected hook lifecycle route, including webhook TLS/readiness, cleanup, ordering, and upgrade behavior.",
        "Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope after the lifecycle decision is closed.",
      ],
    },
  };
}

function verifyDecision() {
  check(existsSync(decisionPath), `${relativeRepo(decisionPath)} is missing; run npm run kps:image-policy-decision`);
  const decision = readYaml(decisionPath);
  check(decision.kind === "ProductionImagePolicyDecision", `${relativeRepo(decisionPath)} must be kind ProductionImagePolicyDecision`);
  const spec = decision.spec ?? {};
  check(spec.chart === chart, `${relativeRepo(decisionPath)} chart mismatch`);
  check(spec.version === version, `${relativeRepo(decisionPath)} version mismatch`);
  check(spec.decision === "mutable-image-exception-accepted-for-target-scope", `${relativeRepo(decisionPath)} decision mismatch`);
  check(JSON.stringify(spec.variantsCovered ?? []) === JSON.stringify(variants), `${relativeRepo(decisionPath)} variants mismatch`);
  check((spec.limits ?? []).some((item) => item.includes("does not mean the rendered manifests are digest-pinned")), `${relativeRepo(decisionPath)} must state digest-pinning limit`);
  check((spec.limits ?? []).some((item) => item.includes("does not make kube-prometheus-stack production-supported")), `${relativeRepo(decisionPath)} must state support limit`);

  const chartSummary = imageDigestWorkdownRow();
  check(Number(spec.renderedImageSummary?.resolutionReceipts) === Number(chartSummary.resolution_receipts), `${relativeRepo(decisionPath)} receipt count mismatch`);
  check(Number(spec.renderedImageSummary?.mutableTagRefs) === Number(chartSummary.mutable_tag_refs), `${relativeRepo(decisionPath)} mutable tag count mismatch`);

  for (const variant of variants) {
    const receipt = imageDigestReceipt(variant);
    const recorded = spec.variantReceipts?.[variant];
    check(recorded, `${relativeRepo(decisionPath)} missing variant receipt summary for ${variant}`);
    check(recorded.renderedObjectSetSHA256 === receipt.spec.renderedObjectSet.sha256, `${relativeRepo(decisionPath)} rendered sha mismatch for ${variant}`);
    check(recorded.sourceImageReviewRows === receipt.spec.sourceImageReview.rows, `${relativeRepo(decisionPath)} image-review row mismatch for ${variant}`);
    check(recorded.uniqueImages === receipt.spec.sourceImageReview.uniqueImages, `${relativeRepo(decisionPath)} unique image count mismatch for ${variant}`);
  }

  for (const evidence of spec.evidence ?? []) {
    check(evidence.path, `${relativeRepo(decisionPath)} evidence without path`);
    check(existsSync(join(repoRoot, evidence.path)), `${relativeRepo(decisionPath)} references missing evidence ${evidence.path}`);
  }
}

function imageDigestReceipt(variant) {
  const path = [
    "data",
    "image-digest-workdown",
    "receipts",
    chartSlug,
    variant,
    "image-digest-resolution.yaml",
  ].join("/");
  const fullPath = join(repoRoot, path);
  check(existsSync(fullPath), `missing KPS image digest receipt ${path}`);
  const receipt = readYaml(fullPath);
  const spec = receipt.spec ?? {};
  check(receipt.kind === "ImageDigestResolutionReceipt", `${path} must be kind ImageDigestResolutionReceipt`);
  check(spec.chart === chart, `${path} chart mismatch`);
  check(spec.version === version, `${path} version mismatch`);
  check(spec.variant === variant, `${path} variant mismatch`);
  check(spec.productionSupportUse?.limits?.includes("does not mean the rendered manifests are digest-pinned"), `${path} must state limits`);
  return { path, ...receipt };
}

function imageDigestWorkdownRow() {
  const rows = parseCsv(readFileSync(imageWorkdownPath, "utf8")).filter((row) => row.chart === chart && row.version === version);
  check(rows.length === 1, `expected one KPS row in ${relativeRepo(imageWorkdownPath)}`);
  return rows[0];
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
