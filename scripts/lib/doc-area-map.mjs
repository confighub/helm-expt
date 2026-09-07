// The doc-to-area map for the "Every doc, by area" section on docs.html.
//
// The site groups every top-level page under one of five nav buttons: Catalog
// (the store and why you can trust it), Config (the model and what you can do
// with a configuration), Stacks (platforms and fleets on demand), Operate
// (delivery, promotion, and observing what is live), and Docs (the docs hub
// itself and the pages that explain the site rather than one area of it).
// This file assigns every rendered doc under docs/ to one of those five areas,
// or marks it as contributor material, so scripts/generate-public-site.mjs and
// scripts/verify-doc-map.mjs read one shared answer instead of two.
//
// docs/agent/**, docs/skills/**, and docs/planning/** are not user-facing
// guides: they are internal operating notes and design/planning material.
// They collapse into the "For contributors" group instead of taking an area.
//
// docs/demo/** and docs/corpus/** are assigned by directory, in DIR_RULES
// below, because each directory already holds one topic's worth of generated
// per-chart or per-platform records (a chart's proof pair, a platform's
// adoption chapters). A new file dropped into an existing demo directory is
// classified automatically; a new demo directory is not, so its first file
// fails scripts/verify-doc-map.mjs until this file names it.
//
// docs/user/** and docs/reference/** are assigned by explicit path in
// DOC_AREA below, because those documents cover a mix of topics that a
// directory rule cannot tell apart. A new file here fails the verifier until
// it is added below, on purpose: silent default placement is how a doc index
// drifts from what the site actually explains.

export const AREAS = ["catalog", "config", "stacks", "operate", "docs"];

export const AREA_LABELS = {
  catalog: "Catalog",
  config: "Config",
  stacks: "Stacks",
  operate: "Operate",
  docs: "Docs",
};

// docs/agent/**, docs/skills/**, and docs/planning/** hold internal operating
// notes and design/planning material rather than user-facing guides.
export function isContributorDoc(repoPath) {
  return /^docs\/(agent|skills|planning)\//.test(repoPath);
}

// Explicit area for one document under docs/user/ or docs/reference/.
const DOC_AREA = {
  "docs/README.md": "docs",

  // docs/user/ -----------------------------------------------------------
  "docs/user/README.md": "docs",
  "docs/user/adopting-existing-apps.md": "stacks",
  "docs/user/ai-assisted-helm-changes.md": "config",
  "docs/user/anonymous-browser-workshop.md": "config",
  "docs/user/app-to-live-walkthrough.md": "stacks",
  "docs/user/approval-story.md": "operate",
  "docs/user/broken-chart-triage.md": "catalog",
  "docs/user/chain-of-proof.md": "catalog",
  "docs/user/change-routing-before-oci.md": "config",
  "docs/user/chart-hooks-what-happens.md": "config",
  "docs/user/check-and-promote-with-ai.md": "config",
  "docs/user/choose-your-path.md": "docs",
  "docs/user/choosing-commands.md": "config",
  "docs/user/ci-render-check.md": "operate",
  "docs/user/ci-rendered-catalog-journey.md": "operate",
  "docs/user/config-catalog-demonstrations.md": "docs",
  "docs/user/confighub-data-model.md": "config",
  "docs/user/configuration-question-workflow.md": "config",
  "docs/user/creating-variants.md": "config",
  "docs/user/cub-deployment-path.md": "operate",
  "docs/user/cub-scout-diff-design.md": "operate",
  "docs/user/cub-variant-command-surface.md": "config",
  "docs/user/current-proof-status.md": "catalog",
  "docs/user/custom-overlays.md": "config",
  "docs/user/day2-upgrade-rollback.md": "operate",
  "docs/user/day2-upgrade-story.md": "operate",
  "docs/user/derived-variant-walkthrough.md": "config",
  "docs/user/example-rendered-diff.md": "config",
  "docs/user/existing-helm-release-diagnostic.md": "stacks",
  "docs/user/expected-results-and-clusters.md": "docs",
  "docs/user/extension-slots.md": "config",
  "docs/user/first-run-walkthrough.md": "config",
  "docs/user/generative-gitops-fit.md": "operate",
  "docs/user/gitops-adopter-guide.md": "operate",
  "docs/user/hard-questions.md": "catalog",
  "docs/user/helm-pain-points.md": "catalog",
  "docs/user/helm-presets-and-values.md": "config",
  "docs/user/helm-render-intents.md": "config",
  "docs/user/helm-to-cub-migration.md": "config",
  "docs/user/helm-upgrade-crash-example.md": "operate",
  "docs/user/hook-lifecycle-strategy.md": "config",
  "docs/user/how-it-works.md": "operate",
  "docs/user/how-the-harness-works.md": "config",
  "docs/user/image-registry-migration.md": "operate",
  "docs/user/inspect-oci-package.md": "config",
  "docs/user/installer-oci-packages.md": "config",
  "docs/user/introduction-to-the-harness.md": "config",
  "docs/user/known-gaps-we-surface.md": "catalog",
  "docs/user/large-config-operations.md": "operate",
  "docs/user/live-parity.md": "catalog",
  "docs/user/maintenance-sla.md": "catalog",
  "docs/user/model-and-vocabulary.md": "config",
  "docs/user/nginx-configuration-files.md": "config",
  "docs/user/nim-coverage.md": "catalog",
  "docs/user/offering.md": "docs",
  "docs/user/outcomes-and-tests.md": "catalog",
  "docs/user/pathway-route-hooks-transparently.md": "config",
  "docs/user/product-support-tiers.md": "catalog",
  "docs/user/production-support-decisions.md": "catalog",
  "docs/user/prometheus-high-fanout.md": "config",
  "docs/user/prometheus-overlay-promotion-example.md": "operate",
  "docs/user/reading-the-matrix.md": "catalog",
  "docs/user/real-human-trial-protocol.md": "catalog",
  "docs/user/remote-images-and-supported-bases.md": "catalog",
  "docs/user/reverse-reconcile-design.md": "operate",
  "docs/user/runtime-drift-boundaries.md": "operate",
  "docs/user/security-end-to-end.md": "catalog",
  "docs/user/serious-chart-proof.md": "catalog",
  "docs/user/serious-charts.md": "catalog",
  "docs/user/serverless-mode.md": "config",
  "docs/user/target-prerequisites-before-rerun.md": "operate",
  "docs/user/target-prerequisites.md": "config",
  "docs/user/test-candidates-before-promotion.md": "operate",
  "docs/user/top100-readiness.md": "catalog",
  "docs/user/top100-status.md": "catalog",
  "docs/user/transform-oci-package.md": "config",
  "docs/user/try-now.md": "config",
  "docs/user/tutorial-sequence.md": "docs",
  "docs/user/ux-proposal-bulk-scan-patch-tutorial.md": "docs",
  "docs/user/ux-proposal-externaldns-custom-overlay-tutorial.md": "docs",
  "docs/user/ux-proposal-gitops-runtime-proof-tutorial.md": "docs",
  "docs/user/ux-proposal-prometheus-base-variant-tutorial.md": "docs",
  "docs/user/ux-proposal-prometheus-promotion-tutorial.md": "docs",
  "docs/user/ux-proposal-redis-quick-start-tutorial.md": "docs",
  "docs/user/ux-proposal-redis-secret-modes-tutorial.md": "docs",
  "docs/user/variants-after-upload.md": "config",
  "docs/user/verification-lanes.md": "catalog",
  "docs/user/verification.md": "catalog",
  "docs/user/verify-it-yourself.md": "catalog",
  "docs/user/what-config-workshop-is.md": "docs",
  "docs/user/what-we-refuse-to-claim.md": "catalog",
  "docs/user/what-you-get.md": "docs",
  "docs/user/why-synced-is-not-working.md": "operate",
  "docs/user/why-this-does-not-collapse.md": "catalog",
  "docs/user/why-this-exists.md": "docs",

  // docs/reference/ -------------------------------------------------------
  "docs/reference/aicr-composition-model.md": "stacks",
  "docs/reference/aicr-evidence-and-our-receipts.md": "catalog",
  "docs/reference/aicr-signature-verification.md": "catalog",
  "docs/reference/artifact-verifier-spec.md": "catalog",
  "docs/reference/capability-profile-catalog.md": "config",
  "docs/reference/catalog-doctrine.md": "catalog",
  "docs/reference/certified-bundle-spec.md": "catalog",
  "docs/reference/chart-recipe-manifest-flow.md": "config",
  "docs/reference/complete-corresponding-model.md": "catalog",
  "docs/reference/config-catalog-doctrine.md": "config",
  "docs/reference/confighub-promotion-mapping.md": "operate",
  "docs/reference/configuration-decisions.md": "config",
  "docs/reference/customization-algorithm.md": "config",
  "docs/reference/customization-decision-tree.md": "config",
  "docs/reference/deciding-a-flattening-lane.md": "config",
  "docs/reference/derived-variant-live-proof.md": "catalog",
  "docs/reference/direct-cub-helm-model.md": "config",
  "docs/reference/enterprise-parity-contract.md": "catalog",
  "docs/reference/flattening-alignment.md": "config",
  "docs/reference/fork-vocabulary.md": "config",
  "docs/reference/generated-fact-receipts.md": "config",
  "docs/reference/helm-community-persona-reference.md": "docs",
  "docs/reference/helm-import-contract.md": "config",
  "docs/reference/helm-quirk-support-matrix.md": "config",
  "docs/reference/helm-user-pain-evidence.md": "catalog",
  "docs/reference/how-the-catalog-is-built.md": "catalog",
  "docs/reference/installer-package-signing.md": "catalog",
  "docs/reference/kube-prometheus-stack-serious-chart-review.md": "catalog",
  "docs/reference/lane-test-doctrine.md": "catalog",
  "docs/reference/master-catalog-matrix.md": "catalog",
  "docs/reference/matrix-completion-audit.md": "catalog",
  "docs/reference/observation-freshness-slo.md": "operate",
  "docs/reference/per-chart-recipes.md": "config",
  "docs/reference/promotion-diff-classes.md": "operate",
  "docs/reference/proof-kit-migration.md": "catalog",
  "docs/reference/question-intake-operation.md": "catalog",
  "docs/reference/quirk-coverage.md": "config",
  "docs/reference/redis-worked-example.md": "catalog",
  "docs/reference/residue-families.md": "catalog",
  "docs/reference/secret-lifecycle.md": "config",
  "docs/reference/seven-stage-helm-lifecycle.md": "config",
  "docs/reference/top100-user-readiness.md": "catalog",
  "docs/reference/two-cluster-parity-harness.md": "catalog",
  "docs/reference/upgrade-rollback-receipts.md": "operate",
  "docs/reference/variant-creation-artifact.md": "config",
  "docs/reference/variant-creator-verification.md": "catalog",
  "docs/reference/variant-promotion-closeout.md": "operate",
  "docs/reference/variant-promotion-model.md": "operate",
  "docs/reference/variant-promotion-worked-example.md": "operate",
  "docs/reference/verification-properties.md": "catalog",
  "docs/reference/what-hook-support-means.md": "config",
  "docs/corpus/known-adversarial-charts.md": "catalog",
  "docs/corpus/kubara-customized-overlays.md": "catalog",
};

// Directory rules for docs/demo/**. Evaluated in order; the first match wins.
// Each demo directory holds one topic's generated records, so a whole
// directory takes one area. Every existing directory is named explicitly,
// including the per-chart catalog demos, so a newly added demo directory
// returns null from areaForDoc and fails the gate until it is assigned an
// area here rather than defaulting silently to Catalog. The docs/corpus files
// are named in DOC_AREA above for the same reason.
const DIR_RULES = [
  [/^docs\/demo\/(kubara|sveltos|aicr|c3agent|apps)\//, "stacks"],
  [/^docs\/demo\/(hooks-crds|redis)\//, "config"],
  [/^docs\/demo\/argo-cd\//, "operate"],
  [/^docs\/demo\/(cert-manager|consul|external-secrets|grafana|ingress-nginx|kube-prometheus-stack|loki|longhorn|metrics-server|mongodb|mysql|nginx|postgresql|prometheus|rabbitmq|secrets-store-csi-driver|tempo|vault)\//, "catalog"],
];

// Returns the area key for a rendered doc, or null when the doc is neither
// named in DOC_AREA nor covered by a DIR_RULES prefix. Callers treat null as
// a hard failure so a newly added doc cannot silently go unclassified.
export function areaForDoc(repoPath) {
  if (Object.prototype.hasOwnProperty.call(DOC_AREA, repoPath)) return DOC_AREA[repoPath];
  for (const [pattern, area] of DIR_RULES) {
    if (pattern.test(repoPath)) return area;
  }
  return null;
}
