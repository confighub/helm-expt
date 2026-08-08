// Every npm lane that is named like a gate and is not run by `npm run verify`
// declares its role here. The catalog generator refuses to pass when one of
// those lanes has no entry, so a lane cannot look like a gate, run nowhere, and
// say nothing about why.
//
// This exists because two such lanes went stale unnoticed. app-readiness
// claimed to check "every catalog chart" while covering 95 of 120 rendered
// subjects, and preview-readiness was wrong in three fields of four. Both sat
// outside the chain, so nothing failed and nobody looked.
//
// Fields:
//   proves      what passing the lane establishes, concretely
//   requires    the strongest external thing its verify path needs:
//               offline | network | docker | kubernetes | confighub
//   status      what running it showed on 2026-08-08, or that it was not run
//   disposition why it is outside the chain, and what should happen:
//               join-the-chain    cheap and offline, belongs in the chain
//               keep-outside      needs external state or is too slow
//               superseded        belongs to work that has moved on
export const NPM_LANE_ROLES = Object.freeze({
  "anonymous-oci-ci:verify": {
    proves: "The committed runs/anonymous-oci-ci-proof/receipt.yaml still records a passing anonymous OCI->work->OCI CI run (same source reference, matching expected/observed manifest digests, zero ConfigHub token/context/env credentials, 6 reviewed NGINX objects, pulled-back object-set hash equal to the reviewed one), and data/anonymous-oci-ci-proof/summary.md byte-equals what renderSummary() re-derives from that receipt.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "red: summary is stale and only the live --run rewrites it, so clearing it needs a registry run",
  },
  "helm-org:fleet:verify": {
    proves: "That the live ConfigHub 'helm-catalog' fleet-promotion exhibit still matches data/fleet-promotion/live-nginx-registry-migration.yaml: it re-reads every Space, Unit payload, revision history, upstream Link and trigger filter from the live organization and diffs the freshly collected receipt against the committed one.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "helm-org:policy:verify": {
    proves: "That the live helm-catalog ConfigHub organization's apply-policy topology — the Trigger definition Space, Trigger filters, and per-Space WhereTrigger assignments — still matches both config-catalog/policies/catalog-standard.yaml and the committed receipt data/apply-policy-profiles/live-helm-catalog.yaml, field by field.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "helm-org:verify": {
    proves: "Every planned Space in the live ConfigHub `helm-catalog` organization exists, carries the planned labels, holds at least one Unit, and its recipe Unit data still equals the committed data/helm-render-intents/intents/<space>.yaml.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "hook-replacement:proof:verify": {
    proves: "Validates runs/hook-replacement-proof/receipt.yaml (kind, an allowed result, and presence of the neither/argo/flux legs) and byte-compares data/hook-replacement-proof/summary.md and by-controller.html against what the generator re-renders from it, so the published claim that all three recommended hook-replacement paths delivered and ran the routed Job matches the recorded run.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "red: runs/hook-replacement-proof/receipt.yaml was never recorded, so the proof has to run before this lane can pass",
  },
  "kubara-catalog-full-coverage:verify": {
    proves: "Re-verifies the final Kubara catalogs 1.1.0 coverage state end to end: the immutable 120-root recipe/package baseline, the ten additive roots and their proof and installer-package receipts, the ten OCI publication receipts against the live remote manifest and layer digests, the installer-OCI catalog rows, and that data/kubara-catalog-1.1-full-coverage/receipt.yaml records pass with ten published packages.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "kubara-catalog-full-coverage:verify-candidates": {
    proves: "That the ten exact Kubara catalogs 1.1.0 candidate recipes/packages under data/kubara-catalog-1.1-full-coverage/candidates still match their declared exact artifact URLs and SHAs, that the immutable 120-root baseline is unchanged, that the two supplemental locks are intact, and that each candidate's proof and installer package re-verify (including re-packaging it twice with cub and rendering it back through cub installer setup).",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "kubara-catalog-oci:verify": {
    proves: "That each of the ten additive Kubara installer packages is genuinely published: for every package it re-packs the local tree with `cub installer package` and compares the SHA to the receipt's layer digest, then runs `cub installer inspect <oci ref> --json` against europe-west1-docker.pkg.dev and checks the remote manifest digest, remote layer digest and canonical inspect JSON hash still equal the committed publication receipt — plus the immutable 110/120-root catalog baselines and both promotion receipts.",
    requires: "network",
    disposition: "keep-outside",
    status: "not run here, needs network",
  },
  "kubara-catalog-promotion:stage:verify": {
    proves: "That the disposable staging tree .tmp/kubara-catalog-root-promotion holds root-ready proof and package trees for all seven historical Kubara components — each with a source-lock pinned to the promoted version and exact artifact URL — and that promoting them would not disturb the 120-root immutable baseline.",
    requires: "network",
    disposition: "keep-outside",
    status: "not run here, needs network",
  },
  "kubara-catalog-promotion:verify": {
    proves: "Re-verifies the additive historical Kubara root promotion: the release scope manifest, the byte-locked baseline catalog roots, the required additions, each component's proof and installer-package receipts (including the packaged kube-prometheus-stack lifecycle files), the 13-lane live-qualification set receipt, and that data/kubara-catalog-refresh/root-promotion/receipt.yaml matches the receipt the script recomputes.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "kubara-catalog-release:verify": {
    proves: "That the full public Kubara catalog release still holds end to end: exactly 130 retained recipe and package version roots including all declared additions, the ten additive installer packages' publication receipts matching the live remote OCI manifests and layers, and twelve derived catalog/site generators (catalog-status, pain reports, root catalog, installer OCI catalog, model completeness, public site, ...) all re-deriving byte-identically, plus the site UX contract.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "kubara-current-catalog-candidates:verify": {
    proves: "All seven exact Kubara v0.13.0 public artifacts still verify as candidates — each recipe and package exists, its proof artifacts and installer package re-verify (including a byte-identical double `cub installer package` bundle and a semantic Helm-vs-`cub installer setup` object comparison per variant), source-lock version/URL/SHA match the recorded exact artifact — and data/kubara-catalog-refresh/current-candidates/{candidate-set.yaml,candidate-status.csv,README.md} are not stale relative to that inspection.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "kubara-current-catalog-promotion:stage:verify": {
    proves: "A previously staged .tmp/kubara-current-catalog-root-promotion tree contains root-ready recipe and package trees for each current Kubara component whose proof files, KPS lifecycle files, installer packages and source-lock exact-artifact URL/SHA match examples/kubara/current-platform/component-artifacts.yaml, while the immutable baseline catalog roots are unchanged.",
    requires: "network",
    disposition: "keep-outside",
    status: "not run here, needs network",
  },
  "kubara-current-catalog-promotion:verify": {
    proves: "That data/kubara-catalog-refresh/current-root-promotion/receipt.yaml exactly equals the receipt recomputed from the promoted roots for argo-cd 10.2.1, external-secrets, and kube-prometheus-stack — with the 13-lane/7-component KubaraLiveQualificationSetReceipt validated, the required additive roots present, the historical roots unchanged, and each component's proof, packaged lifecycle, and installer package re-verified in place.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes",
  },
  "kubara-mini-idp:orphan-audit:receipt-verify": {
    proves: "That runs/kubara-mini-idp-reconcile/orphan-audit.yaml still binds to the current reconciler: auditor and reconciler script digests, the reconcile plan digest, the apply-attempt ledger digest, read-only execution with zero mutation commands, stable opening/closing organization-wide ConfigHub snapshot fingerprints, and expected==observed counts for Spaces/Units/Links/Targets/Triggers/Filters against the freshly recomputed allowlist.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes",
  },
  "kubara-mini-idp:verify": {
    proves: "That the live Kubara mini-IDP matches its desired plan: it re-reads the whole pinned ConfigHub organization (Spaces, managed Units, NeedsProvides Links, Targets) and then, per fleet cluster, reads the local kind cluster's Argo runtime, argobot authority and ApplicationSets via kubectl, reporting Space/Unit/Link counts.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "kubara-release:verify": {
    proves: "Runs the whole Kubara release front door: the offline static contract (data/kubara-release-acceptance/contract.yaml plus catalog counts, tree SHAs and required evidence paths), then the final-state gates — current site live-evidence, adoption screenshots, public site pages, the 130-root final catalog and the installer-OCI catalog — and then executes ten downstream acceptance commands in order.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "kubara-release:verify-static": {
    proves: "That the offline half of the Kubara + ConfigHub release acceptance holds: data/kubara-release-acceptance/contract.yaml and the adoption-screenshot contract re-derive exactly, the named package.json scripts are verbatim, the recorded release scope still contains its immutable 120-root and baseline catalogs unchanged, the current shape / mini-IDP plan / site consumption agree, and twenty-two further offline sub-lanes pass.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "prometheus-adapter:apiservice-base:verify": {
    proves: "The prometheus-community/prometheus-adapter 5.3.0 `apiservice-v1-capability` base is intact end to end: the recipe and installer package both declare it, the variant records the APIService v1 capability profile and capability-profile-rerender strategy, the package base upstream.yaml byte-equals the rendered release-objects.yaml, the inventory digest and the APIService object identity match, the revision receipts are consistent, and a fresh `cub installer setup --pull` of the package reproduces the Helm object set semantically with the counts recorded in the package receipt.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
});

export const NPM_LANE_DISPOSITIONS = Object.freeze([
  "join-the-chain",
  "keep-outside",
  "superseded",
]);

export const NPM_LANE_REQUIREMENTS = Object.freeze([
  "offline",
  "network",
  "docker",
  "kubernetes",
  "confighub",
]);
