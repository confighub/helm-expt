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
  "ai-change-review:self-test": {
    proves: "That the AI-change-review builder rejects a tampered scenario: mutating config-catalog/demonstrations/ai-change-review.yaml so the reviewed candidate reintroduces a `confighubplaceholder` value, or asks for 5 training nodes against a 4-node targetFacts limit, must make build() throw.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "ai-change-review:verify": {
    proves: "Byte-compares data/ai-change-review/{proposal.yaml,reviewed.yaml,receipt.yaml,summary.md} against what the generator re-derives from config-catalog/demonstrations/ai-change-review.yaml and the committed ClusterTrainingRuntime source object, so the recorded rejected proposal and approved-pending candidate still follow from their inputs.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "aicr-argocd-example:receipt:verify": {
    proves: "That the committed AICR Argo CD example is internally consistent: it re-runs scripts/verify-aicr-argocd-example.mjs and then asserts every field of examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml (org helm-catalog, 17 Applications, sync waves 0..15, source digest) and apply-policy-receipt.yaml against the committed OCI artifact digests and each other.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "anonymous-oci-ci:verify": {
    proves: "The committed runs/anonymous-oci-ci-proof/receipt.yaml still records a passing anonymous OCI->work->OCI CI run (same source reference, matching expected/observed manifest digests, zero ConfigHub token/context/env credentials, 6 reviewed NGINX objects, pulled-back object-set hash equal to the reviewed one), and data/anonymous-oci-ci-proof/summary.md byte-equals what renderSummary() re-derives from that receipt.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "red: data/anonymous-oci-ci-proof/summary.md is stale",
  },
  "app-readiness:verify": {
    proves: "Byte-compares data/app-readiness/summary.md, rbac-findings.csv and matrix.html against what the generator re-derives from the 120 committed recipes/**/revisions/default/r001/rendered/release-objects.yaml files, so the catalog RBAC risk table (wildcard verbs, secret reads, escalate/bind/impersonate) still matches the rendered objects.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "bad-decisions:comparison:verify": {
    proves: "The committed data/bad-decisions-comparison/summary.md and helm-vs-confighub.html byte-match what the generator re-renders from runs/bad-decisions-comparison/receipt.yaml, and that receipt is a BadDecisionsComparisonReceipt with a valid result and a non-zero case count.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "bad-decisions:fuzz:verify": {
    proves: "That data/bad-decisions-fuzz/summary.md and by-decision.html are byte-identical to what the generator re-derives from runs/bad-decisions-fuzz/receipt.yaml, and that the receipt is a BadDecisionsFuzzReceipt with a valid result and at least one case.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "catalog-oci:proof:verify": {
    proves: "Validates runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml (kind, chart/version/base pins, all three Argo/Flux/direct legs pass on one recorded release-OCI digest, cleanup pass) and byte-compares data/catalog-oci-delivery-proof/summary.md and by-controller.html against what the generator re-renders from that receipt.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "chart-facts:verify": {
    proves: "Byte-compares data/chart-facts/chart-facts.csv, summary.md and chart-facts.json against what the generator re-derives from recipes/**/recipe.yaml, recipes/**/dependency-lock.yaml, recipes/**/helm-pain-report.yaml, the variant dirs, data/top500-catalog-analysis/source/source-feature-scan.raw.json, data/variant-backlog/*, data/hook-lifecycle*/ and data/remote-dependency-closure/top100.csv, and asserts at least 100 charts have recipes.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "chart-use:guide:verify": {
    proves: "data/chart-use-guide/summary.md and chart-use-guide.csv byte-equal what buildReport() re-derives from data/top100-readiness/readiness.csv, data/status-dashboard/top20-status.csv and data/top100-promotion-wave/wave.csv.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "red: data/chart-use-guide/summary.md is stale; run npm run chart-use:guide",
  },
  "chart:evidence-router:verify": {
    proves: "Byte-compares data/chart-evidence-router/router.csv and summary.md against a re-derivation that joins eleven committed CSVs (top100-user-readiness, chart-use-guide, top100-coverage, outcome-coverage, hook-coverage, quirk-work-queue, runtime-gitops, live-helm-confighub-compare, gitops-health-residue, production-support-decisions, top500) plus every data/runtime-gitops/receipts/**/latest.yaml, and asserts the router still resolves exactly 100 top-100 charts.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "config-catalog:self-test": {
    proves: "Negative-fixture tests: mutated copies of config-catalog/policies/catalog-standard.yaml, config-catalog/program.yaml, the OCI delivery/rollout/anonymous-OCI receipts, the fleet-promotion receipt, and the AI change review scenario are each rejected by the validators, so the catalog policy and delivery validators actually fail on approval leakage, blanket delivery claims, digest tampering, hidden pending promotions, and unremoved placeholders.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "config-catalog:verify": {
    proves: "That every generated config-catalog surface still re-derives byte-for-byte from its committed sources: the 200-odd BaseVariantRecords plus records.json/csv/summary, catalog-standard policy (yaml+json), operational-class examples, the demo program, the OCI evidence chains, and the Top-50 completion tracker — and that config-catalog/base-records contains exactly the expected file set.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "red: docs/user/config-catalog-demonstrations.md is stale; run npm run config-catalog",
  },
  "confighub-example-guides:verify": {
    proves: "Byte-compares data/confighub-example-guides/summary.md, guides.csv and every per-space guide markdown file against what the generator re-derives from data/installer-oci-packages/packages.json, data/helm-render-intents/intents.json, the master catalog matrix and the chart-use guide, and additionally asserts each guide's linked site/sh/*.sh helper exists and that no banned jargon phrase survives.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "crd-ordering:proof:verify": {
    proves: "That runs/crd-ordering-gap/receipt.yaml is a CrdOrderingGapProofReceipt with a valid result and a bundleApply leg, and that data/crd-ordering-gap/summary.md and summary.html are byte-identical to what summaryMd(r)/summaryHtml(r) re-render from that receipt.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "cub-adoption-caveats:verify": {
    proves: "data/cub-adoption-caveats/caveats.csv, summary.md and summary.html byte-equal what generateAll() re-derives by walking every packages/<repo>/<chart>/<version>/installer.yaml (latest version per chart), scanning each default base's upstream.yaml for baked password key names and CRD objects, and cross-checking remediation bases against blocked live receipts.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "red: data/cub-adoption-caveats/caveats.csv is stale; run npm run cub-adoption-caveats:generate",
  },
  "cub-installer:determinism:verify": {
    proves: "Re-renders data/cub-installer-determinism/summary.md and by-package.html from the committed runs/cub-installer-determinism/receipt.yaml and byte-compares them, and asserts the receipt kind is CubInstallerDeterminismReceipt with result in {pass, watch, blocked} — so the published \"same inputs render byte-identically\" claim still matches the recorded run.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "cub-installer:fuzz:verify": {
    proves: "The committed data/cub-installer-fuzz/summary.md and by-case.html byte-match what the generator re-renders from runs/cub-installer-fuzz/receipt.yaml, and that receipt is a CubInstallerFuzzReceipt with a valid result and at least one case.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "cub-scout-diff:verify": {
    proves: "That data/cub-scout-diff/summary.md and matrix.html match what the generator rebuilds from capability-matrix.csv plus the example ObjectSetDiffReceipts, and that each receipt's diff.changedObjects equals both its declared provenance.predictedObjects and the objects listed in the referenced chart value-source-map.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "default-credential:check:verify": {
    proves: "Validates runs/default-credential-check/receipt.yaml (kind and a result of pass/watch/blocked) and byte-compares data/default-credential-check/summary.md and by-chart.html against what the generator re-renders from that receipt, so the published claim about how many default bases ship a fixed shared password matches the recorded scan.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "drift-gap:proof:verify": {
    proves: "That runs/drift-detection-gap/receipt.yaml is a DriftDetectionGapProofReceipt with a valid result and an envDrift leg, and that data/drift-detection-gap/summary.md and summary.html byte-match what the generator re-renders from that receipt.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "flux-lookup:proof:verify": {
    proves: "runs/flux-lookup-proof/receipt.yaml is a FluxLookupProofReceipt with a valid result and all three legs (helmTemplate, helmInstall, fluxHelmController) present, and data/flux-lookup-proof/summary.md byte-equals summaryMd(receipt).",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "gitops:route-emission:verify": {
    proves: "Byte-compares all four of data/gitops-route-emission/{emission.csv,emission.json,summary.md,emission.html} against a pure function of data/lifecycle-routes-by-variant/by-variant.json, so every hook route's derived Argo CD hook/sync-wave and Flux equivalent still matches the committed route inventory.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "helm-catalog-readmes:verify": {
    proves: "Every generated Helm Catalog README markdown and Unit YAML under data/helm-catalog-readmes/, plus summary.md and readmes.csv, byte-match what the generator re-derives from data/helm-org/wave1.csv and data/confighub-example-guides/guides.csv, and each README's site/sh/*.sh links resolve to a file in the repo and contain no banned jargon.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "helm-habit:friction:verify": {
    proves: "That data/helm-habit-friction/summary.md and by-idiom.html are byte-identical to what the generator re-derives from runs/helm-habit-friction/receipt.yaml, and that the receipt is a well-formed HelmHabitFrictionReceipt.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "helm-org:fleet:receipt:verify": {
    proves: "Checks the committed data/fleet-promotion/live-nginx-registry-migration.yaml receipt against config-catalog/demonstrations/nginx-fleet-registry-migration.yaml — same organization, source record, workload digest, Space set, and per-variant image/filter/replicas/pending-promotion results — and that the demonstration still links the receipt.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "helm-org:fleet:verify": {
    proves: "That the live ConfigHub 'helm-catalog' fleet-promotion exhibit still matches data/fleet-promotion/live-nginx-registry-migration.yaml: it re-reads every Space, Unit payload, revision history, upstream Link and trigger filter from the live organization and diffs the freshly collected receipt against the committed one.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "helm-org:policy:receipt:verify": {
    proves: "The committed data/apply-policy-profiles/live-helm-catalog.yaml ApplyPolicyLiveReceipt still agrees with the maintained profile config-catalog/policies/catalog-standard.yaml — same definition Space and Trigger selector, same baseline/approval-required filter refs, display names, selectors and validating Trigger sets, disjoint Space sets with recorded approval reasons and source types for every Space, matching operational-class example labels, and a lastRecorded date matching the receipt's verifiedAt.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
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
  "hook-execution:proof:verify": {
    proves: "That data/hook-execution-proof/summary.md and its HTML match what the generator re-derives from the committed HookRouteExecutionReceipt, and that the receipt still carries all three legs (renderParity, helmInstallSilent, routedExecution) with a valid overall result.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "hook-replacement:proof:verify": {
    proves: "Validates runs/hook-replacement-proof/receipt.yaml (kind, an allowed result, and presence of the neither/argo/flux legs) and byte-compares data/hook-replacement-proof/summary.md and by-controller.html against what the generator re-renders from it, so the published claim that all three recommended hook-replacement paths delivered and ran the routed Job matches the recorded run.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "red: runs/hook-replacement-proof/receipt.yaml missing; run npm run hook-replacement:proof",
  },
  "hook-test:proof:verify": {
    proves: "That runs/hook-test-proof/receipt.yaml is a HookTestRouteProofReceipt carrying all three legs (renderParity, helmInstallSilent, explicitRouteRun) and that data/hook-test-proof/summary.md and visible-vs-silent.html are byte-identical to what the generator re-renders from it.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "hooks-crds-app:self-test": {
    proves: "The route contract itself has teeth: an in-memory clone of the first generated lifecycle route with `spec.automatic = true` and `spec.evidence = []` is rejected by validateRoute(), so the 'automatic:false until earned' rule cannot silently pass.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "hooks-crds-app:verify": {
    proves: "That every data/hooks-crds-app/routes/*.yaml and hook-probe/*.yaml file, plus summary.md, byte-matches the LifecycleRoute records re-derived from the kube-prometheus-stack 85.3.3 no-crds HelmRenderIntent and the two committed receipts (runs/kps-lifecycle-route-proof/no-crds-receipt.yaml, runs/kps-gitops-lifecycle-proof/receipt.yaml) — including that the route directories contain no extra or missing files.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "hooks:disposition:verify": {
    proves: "data/hook-disposition/top100-hook-dispositions.csv and summary.md byte-match what the generator re-derives from data/hook-lifecycle/source-top100-hooks.csv, receipt-index.csv and data/hook-route-candidates/candidates.csv, with one row per hook-bearing chart, every disposition inside the five-word vocabulary, and every cited evidence path present on disk.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "keda:apiservice-gitops:verify": {
    proves: "That data/runtime-gitops/receipts/kedacore-keda/default/latest.yaml is a RuntimeGitOpsReceipt pinned to kedacore/keda 2.19.0 default, delivered by \"Argo CD OCI\", with the APIService reported Available, a passing aggregated-api-query check, exactly three KEDA deployments, and a passing teardown.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kind-parity:enterprise-contract:verify": {
    proves: "Asserts docs/reference/enterprise-parity-contract.md still names all twenty-three required contract phrases, that docs/README.md assigns the document a role, and that tests/enterprise-parity-fixture/packet.json keeps its schema, customer-safe-aggregate privacy mode, three source shapes, and the arithmetic identity blastRadius === density * fanOut with no customer-identifying fields.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-adoption:self-test": {
    proves: "That four Kubara adoption compilers refuse the tampering they claim to refuse — git-revision import (target facts committed to Git, credential leakage), selected-org workflow compilation and journal forgery, app-release compilation, and the app-release runner's durable operation journal, approval gates and Target-provider audits — each exercised against synthetic fixtures in a temp directory.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-app-release-runner:self-test": {
    proves: "The Kubara application-release runner is crash-safe and CAS-fenced against a simulated ConfigHub/Argo backend: it stops durably at pending root convergence and resumes, records an immediate zero-action re-apply audit, refuses a concurrent execution lock, recovers a prepared step and durable evidence written before its journal update without replay, and refuses a raced root release, drifted source data hash, or an unbound extra source Unit.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-app-release:self-test": {
    proves: "That the exact-digest Kubara application-release compiler still refuses everything it is supposed to refuse: it compiles a synthetic two-target (dev→prod) request in a temp dir, checks the emitted Argo Applications carry sha256 targetRevisions with no syncPolicy.automated and the reviewed non-production OCI base, then asserts that mutating any of eight authority fields changes releaseDigest, that a symlinked output path is rejected without touching the link target, that a `latest` release manifest digest is rejected, and that automatedSync:true is rejected.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-app-rollout:verify": {
    proves: "runs/kubara-app-rollout-proof/receipt.yaml is a ConfigHubManagedArgoAppRolloutReceipt whose recorded topology, five Space slugs and variant lineage, four sha256 release digests, six named steps (all pass), and final four-cluster fleet state (staging-only sandbox, prod-a rolled back to 2/2) match the expected shape declared in the script.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-catalog-full-coverage:self-test": {
    proves: "That the Kubara 1.1 coverage constants still describe an exactly-additive release (18 unique artifacts, 10 additive roots, 2 supplemental locks, +10 versions / +3 components over the baseline, every artifact SHA well-formed and every OCI entry carrying a manifest digest), that the additive tree merge refuses to overwrite conflicting bytes, and that the remote-digest parser reads ManifestDigest and Config.bundle.layerDigest correctly.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
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
  "kubara-catalog-oci:self-test": {
    proves: "Two things in one lane: (a) the installer OCI publisher's idempotency logic reuses an identical remote layer, refuses to overwrite a layer with a different digest, and hashes `cub installer inspect` JSON canonically across key order and formatting; (b) the Kubara catalog additions dry-run resolves all ten package paths to distinct OCI refs, matches the additive root contract, and reports promotion-gate presence without changing package, registry, receipt, or catalog state.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-catalog-oci:verify": {
    proves: "That each of the ten additive Kubara installer packages is genuinely published: for every package it re-packs the local tree with `cub installer package` and compares the SHA to the receipt's layer digest, then runs `cub installer inspect <oci ref> --json` against europe-west1-docker.pkg.dev and checks the remote manifest digest, remote layer digest and canonical inspect JSON hash still equal the committed publication receipt — plus the immutable 110/120-root catalog baselines and both promotion receipts.",
    requires: "network",
    disposition: "keep-outside",
    status: "not run here, needs network",
  },
  "kubara-catalog-promotion:self-test": {
    proves: "The promotion machinery's safety properties hold: the immutable baseline recipes/ and packages/ tree digests still match, additive copy refuses to overwrite, offline-candidate residue is rejected, tree digests catch tampering, a partial merge is retry-safe but rejects conflicting bytes, a live-qualification receipt with a tampered exact-artifact SHA is rejected, and unsafe --stage-root values are refused.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
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
  "kubara-current-catalog-promotion:self-test": {
    proves: "That the current-wave Kubara catalog promoter's safety machinery still fails closed: it locks the immutable baseline (110-root and 120-root tree digests over recipes/ and packages/) and the exact declared addition scope, then exercises copyNewTree/mergeNewTree in a scratch tree to prove additive copy works, a second copy is rejected as \"already exists\", offline-candidate residue is rejected, tree digests notice tampering, a retry-safe merge converges while a conflicting merge is rejected as \"different bytes\", a tampered live exact-artifact SHA is rejected, and six unsafe stage roots (absolute, ../, .., //, inside recipes/) are all refused.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
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
  "kubara-current-example:verify": {
    proves: "Re-derives the source, generated-tree and effective-render checksum files for examples/kubara/current-platform and byte-compares them, then checks the catalog-parity and generation receipts against those digests, the exact artifact SHAs in component-artifacts.yaml, the SHA/object-count/kind inventory of all thirteen committed effective renders, the Argo repository authorization, the override copies, tree portability and the README.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-current-live-qualification:verify": {
    proves: "Byte-compares runs/kubara-current-live-qualification/receipt.yaml against a KubaraLiveQualificationSetReceipt re-derived from the thirteen committed per-lane receipts under runs/live-helm-confighub-compare/kubara-*, for the v0.13.0 / catalogs 1.1.0 chart pins, including each lane's result, legs and cluster-cleanup fields.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-effective-renders:verify": {
    proves: "For both the current four-cluster and historical v0.12.0 Kubara fixtures, the committed effective-render corpora are internally consistent: source-checksums.txt matches a fresh re-derivation from the fixture config and generated wrappers, every rendered instance file's sha256, object count and kind inventory match its entry in receipt.yaml with a recorded deterministic double render, and render-checksums.txt plus README.md are not stale.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-faithful-hub-spoke:verify": {
    proves: "That runs/kubara-faithful-hub-spoke/receipt.yaml is a clean serial-live-lock pass for Kubara v0.13.0 / catalog 1.1.0 whose recorded source config SHA still equals sha256File of examples/kubara/current-platform/source/config.yaml, that no attempt.yaml or failure.yaml is sitting next to it, and that data/kubara-faithful-hub-spoke/summary.yaml and summary.md byte-match what the receipt re-derives.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-git-handoff:self-test": {
    proves: "The Git-handoff preparer is path-neutral and safe: two preparations at different absolute checkout roots produce byte-identical trees matching examples/kubara/current-platform/effective-renders, reruns are deterministic, an interrupted or input-racing generate leaves the prior output intact, symlink/credential/secret/artifact-contract inputs are refused, and --verify performs no repository write (git status unchanged) while refusing a dirty or tampered checkout.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-git-import:self-test": {
    proves: "That the Kubara Git importer refuses the unsafe imports it is supposed to refuse — target facts committed to Git, credential-shaped material in apps/, conflicting duplicate artifact locks, ambiguous first-party locks, duplicate generation-receipt renders/artifacts, duplicate or normalization-colliding cluster/service names, and a skip-worktree-hidden committed sibling — and that a clean compile of the current-platform fixture still yields 4 clusters (1 hub, 3 spokes), 13 config releases, 7 deployable definitions, and target facts all marked external.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-live-qualification:verify": {
    proves: "Recomputes the 13-lane KubaraLiveQualificationSetReceipt from the thirteen committed per-lane receipts under runs/ and byte-compares it with runs/kubara-live-qualification/receipt.yaml, so the aggregate result, per-lane legs, source artifacts and cleanup status cannot drift from the individual receipts.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-mini-idp:orphan-audit:receipt-verify": {
    proves: "That runs/kubara-mini-idp-reconcile/orphan-audit.yaml still binds to the current reconciler: auditor and reconciler script digests, the reconcile plan digest, the apply-attempt ledger digest, read-only execution with zero mutation commands, stable opening/closing organization-wide ConfigHub snapshot fingerprints, and expected==observed counts for Spaces/Units/Links/Targets/Triggers/Filters against the freshly recomputed allowlist.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes",
  },
  "kubara-mini-idp:orphan-audit:self-test": {
    proves: "The orphan-audit classifier behaves correctly on hand-built fixtures: the release classifier keeps active current-stream releases, retains older current-stream releases as history and definition releases as catalog inventory while rejecting an active release in a cluster-target Space; durable workloads are classified as Argo-desired, kind bootstrap baseline, or operator/CronJob-generated only when bound to an exact desired controller owner, with dangling tracking, unowned workloads, non-controller ownerReferences and stale controller owner UIDs rejected; unpinned Argo bootstrap runtime images are rejected; and bulk Unit Data decoding round-trips and fails closed on bad base64, wrong DataHash, or invalid UTF-8.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-mini-idp:performance-contract:verify": {
    proves: "That data/kubara-mini-idp-performance/contract.yaml still states the agreed acceptance terms — kind KubaraMiniIDPPerformanceAcceptance, fixture id kubara-v0-13-0-four-cluster-warm-v1 with 63 managed units / 27 deployments / 4 clusters / 55 spaces, and a rejectedBaseline that remains failure evidence (evidenceType failed-process-exit-profile, acceptedAsSuccessfulRun false, wallElapsedMs 1541558) — so nobody can quietly relabel a failed run as the performance baseline.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-mini-idp:performance:receipt-verify": {
    proves: "runs/kubara-mini-idp-reconcile/receipt.yaml, its orphan-audit.yaml and attempts.yaml satisfy the committed data/kubara-mini-idp-performance/contract.yaml — the fixture cardinality and rejected failed baseline are unchanged, and the changed-apply and idempotent-apply pair stays inside the declared wall-time, subprocess, ConfigHub-read and unclassified-wait budgets.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-mini-idp:performance:self-test": {
    proves: "That the mini-IDP performance acceptance rules actually bite: synthetic receipts must be rejected when a no-op run records a successful ConfigHub mutation, when reads-before-first-dev-acceptance exceed the contract's 96, when unclassified explicit wait time is non-zero, when the changed and no-op runs are out of order, and when the orphan audit's opening five-resource fingerprint disagrees with the accepted no-op final state.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-mini-idp:receipt-verify": {
    proves: "Checks the committed mini-IDP reconcile receipt against the plan the script rebuilds from committed Kubara v0.13.0 outputs: source-file digests, organization identity, the deterministic/no-AI execution declaration, the destructive-operation and prune/namespace-move/immutable-selector policy strings, the 55-Space allowlist, the final ConfigHub snapshot fingerprint, and its binding to the latest pass row in the durable apply-attempt ledger.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-mini-idp:verify": {
    proves: "That the live Kubara mini-IDP matches its desired plan: it re-reads the whole pinned ConfigHub organization (Spaces, managed Units, NeedsProvides Links, Targets) and then, per fleet cluster, reads the local kind cluster's Argo runtime, argobot authority and ApplicationSets via kubectl, reporting Space/Unit/Link counts.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "kubara-org-shape:receipt-verify": {
    proves: "The committed runs/kubara-org-shape-proof/receipt.yaml still matches its sources: it is a ConfigHubKubaraOrgShapeReceipt for the Kubara organization with a UUID entity ID, records Kubara v0.12.0, and carries current sha256 digests for examples/kubara/local-platform/source/config.yaml, catalog-alignment.yaml and runs/kubara-single-platform-proof/receipt.yaml, plus the expected contract Unit ref, toolchain, provider, null target and a positive head revision.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-org-shape:self-test": {
    proves: "That the retirement boundary on the historical Kubara v0.12.0 org-shape script still holds: --apply and --verify each throw before any ConfigHub access, with a message naming both \"historical Kubara v0.12.0\" and the kubara-mini-idp handoff, while --plan, --receipt-verify and --self-test are confirmed to pass through the same guard.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-platform-matrix:self-test": {
    proves: "The matrix builders reject bad evidence rather than publishing it: a synthetic mini-IDP receipt with a stale source digest, a wrong Kubara version or partial cells is refused, an absent receipt yields zero live observations, the orphan-audit acceptance rules hold, and the current live-publication gate refuses a desired-only or partial overlay while still allowing deterministic desired-only publication.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-platform-matrix:verify": {
    proves: "That both matrix profiles (current and historical-v0.12.0) still regenerate byte-identically into data/kubara-platform-matrix — matrix.json/csv/html/summary.md plus desired-matrix.json — from the committed platform sources, and that the current profile refuses to publish a passing mini-IDP or faithful receipt as a desired-only overlay (36 parsed observation cells, accepted-current-live overlay, scoped-residue-clean orphan receipt).",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
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
  "kubara-selected-org:self-test": {
    proves: "The selected-organization workflow compiler produces a safe plan and an unforgeable operation journal: application requests are digest-bound to their bytes, packaging happens before organization selection, multi-system bootstrap uses the prepared-is-in-flight replay policy, a destination-bound verify checkpoint precedes apply, the apply pair keeps distinct immutable receipt evidence, and the journal refuses a changed request, a wrong destination, tampered evidence, a fabricated evidence digest, an advanced-journal overwrite, and a live-acceptance claim that exceeds the completed prefix.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-wiring:self-test": {
    proves: "That the wiring extractor's dependency analyser still classifies edges correctly against a hand-built two-component fixture: a CRD-declared API and an IngressClass resolve as resolved-rendered, a ClusterExternalSecret-materialised pull secret resolves as resolved-runtime, a missing ClusterSecretStore and a missing service DNS endpoint stay unresolved, and an ApplicationSet's cluster selector and AppProject resolve while its Git source is recorded as external.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "kubara-wiring:verify": {
    proves: "For both wiring profiles (current-platform and historical-v0.12.0), the committed data/kubara-wiring graph.json, edges.csv, summary.md and graph.html byte-match the provides/needs graph re-extracted from the committed effective-render corpus plus the component artifact index, and the extractor's own self-test passes first.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "lifecycle:fluent-bit-test-hook:verify": {
    proves: "That runs/hook-lifecycle/fluent-fluent-bit/default/latest/receipt.yaml is a passing HookLifecycleObservationReceipt for fluent/fluent-bit 0.57.6 default on the explicit-post-install-check route, carrying all five named checks (cub-installer-setup, kubectl-apply, daemonset-ready, service-endpoints, explicit-post-install-health-check) with a health status of ok, cleanup passed, and every referenced evidence file matching its recorded SHA-256.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "lifecycle:routes-by-variant:verify": {
    proves: "Byte-compares all four committed outputs in data/lifecycle-routes-by-variant (by-variant.csv, by-variant.json, summary.md, by-variant.html) against what the generator re-derives from data/lifecycle-route-actions/actions.csv, each recipes/<chart>/<version>/variants/<base>/variant.yaml, and the per-base hook_disposition column of data/master-catalog-matrix/matrix.csv.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "red: data/lifecycle-routes-by-variant/by-variant.csv is stale; run npm run lifecycle:routes-by-variant",
  },
  "live-matrix:burndown:verify": {
    proves: "Byte-compares data/live-matrix-burndown/work-items.csv and summary.md against the burn-down the generator re-derives from data/master-catalog-matrix/matrix.csv (per-row live-parity and kind-parity lane states, merged with the active rerun map).",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "local-live:triage:verify": {
    proves: "data/local-live-triage/{summary.md,triage.csv,classes.csv} byte-equal what buildReport() re-derives by re-triaging every non-pass (blocked/fail/watch) row of data/outcome-coverage/base-outcomes.csv against its committed live receipt text and observed objects, including the route-class assignment, confidence and per-class counts.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "managed-cub-direct:proof:verify": {
    proves: "Re-renders data/managed-cub-direct-proof/summary.md and summary.html from runs/managed-cub-direct-proof/receipt.yaml and byte-compares them, and asserts the receipt is a ManagedCubDirectProofReceipt with a valid result and a legs.crdOrdering block — so the published claim that CRD ordering, prune-on-upgrade and SSA conflicts are manageable on the cub-direct path still matches the recorded kind run.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "managed-setup-guidance:proof:verify": {
    proves: "The committed data/managed-setup-guidance/summary.md and summary.html byte-match what the generator re-renders from runs/managed-setup-guidance/receipt.yaml, and that receipt is a ManagedSetupGuidanceReceipt with a valid result and both the customize-guidance and secret-guidance sections present.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "oci-hook:proof:verify": {
    proves: "That data/oci-hook-proof/summary.md and its HTML are byte-identical to what the generator re-renders from the committed HookOciDeliveryProofReceipt, and that the receipt is a HookOciDeliveryProofReceipt with a valid pass/watch/blocked result.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "per-chart-hooks:verify": {
    proves: "Byte-compares data/per-chart-hooks/summary.md, by-chart.html and cards.csv against what the generator re-derives by grouping data/lifecycle-route-actions/actions.csv per chart and joining data/chart-skills/skills.csv, including the headline disposition and the \"automatic\" count that backs the claim that no hook runs silently.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "red: data/per-chart-hooks/summary.md is stale; run npm run per-chart-hooks",
  },
  "preview-readiness:verify": {
    proves: "Byte-compares data/preview-readiness/summary.md, quirks.csv and matrix.html against what the generator re-derives from data/quirk-coverage/coverage.csv, the authored quirk-to-preview-disposition table, catalog-wide capabilityProfile/targetFacts adoption counted across recipes/**/variants/*/variant.yaml, and the four anchor charts' committed variant.yaml files.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "prometheus-adapter:apiservice-base:verify": {
    proves: "The prometheus-community/prometheus-adapter 5.3.0 `apiservice-v1-capability` base is intact end to end: the recipe and installer package both declare it, the variant records the APIService v1 capability profile and capability-profile-rerender strategy, the package base upstream.yaml byte-equals the rendered release-objects.yaml, the inventory digest and the APIService object identity match, the revision receipts are consistent, and a fresh `cub installer setup --pull` of the package reproduces the Helm object set semantically with the counts recorded in the package receipt.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "not run here, needs confighub",
  },
  "prune-gap:proof:verify": {
    proves: "Re-renders data/prune-gap-proof/summary.md and summary.html from runs/prune-gap-proof/receipt.yaml and byte-compares them, and asserts the receipt is a PruneGapProofReceipt with a valid result and an orphanOnPlainApply leg — so the recorded finding that plain `kubectl apply` orphans a resource an upgrade drops, and that `--prune -l` removes it, still matches what the site publishes.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "quirk-queue:verify": {
    proves: "data/quirk-review-queue/queue.csv and summary.md byte-match the backlog re-derived from every recipes/**/helm-pain-report.yaml entry whose disposition is needs-operator-decision, classified into standard/build/sme.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "red: quirk-review-queue queue.csv is stale; run npm run quirk-queue:generate",
  },
  "serverless-install-parity:proof:verify": {
    proves: "That the committed ServerlessInstallParityProofReceipt still passes and agrees with its installer-package publication receipt (same ref and manifest digest), records the anonymous manifest pull as pass and the render parity as 13 Helm objects / 14 cub objects / 13-of-13 semantic matches, and that the proof's summary.md and HTML re-render from it byte-for-byte.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "serverless-oci-gitops:proof:verify": {
    proves: "Checks runs/serverless-oci-gitops-proof/receipt.yaml against the committed installer-package publication receipt (same ref, manifest digest and package layer digest) plus the whole no-account contract — anonymous pull, no ConfigHub token or organization in the isolated cub home, six rendered NGINX objects, output digest matching what Flux observed, 1/1 replicas on the pinned image, cleanup pass — and byte-compares summary.md and summary.html against what it re-renders from the receipt.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "ssa-conflict:proof:verify": {
    proves: "That runs/ssa-conflict-gap/receipt.yaml is an SsaConflictGapProofReceipt with a valid result and a cubServerSideReapply leg, and that data/ssa-conflict-gap/summary.md and summary.html are byte-identical to what the generator re-renders from that receipt.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "top50:completion:verify": {
    proves: "data/top50-completion/{plan.json,plan.csv,summary.md} byte-equal what buildReport() re-derives from config-catalog/top50.yaml, after validating that plan's identity fields, its status definitions for available/partial/planned/blocked, and the package.json scripts it references.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
  },
  "variant-backlog:verify": {
    proves: "Byte-compares data/variant-backlog/backlog.csv and summary.md against a re-derivation that, for each of the 135 recipes/**/recipe.yaml roots, reads control-points.yaml and maps detected control-point categories to the seven standard variant dimensions (existing-secret, no-crds, ha, ingress-tls, minimal, tls, rotation), subtracts the dimensions the chart's existing variant names already cover, and asserts at least 100 recipe roots were found.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "red: variant-backlog backlog.csv is stale; run npm run variant-backlog:generate",
  },
  "webhook-cert:lifecycle:verify": {
    proves: "data/webhook-cert-lifecycle/summary.md, evidence.csv and each receipts/<case>.yaml byte-match what the generator re-derives from the five declared webhook-cert cases, each of which must be paired with a passing ObservationReceipt under runs/next80-local-kind/ and, for the no-crds case, the expected number of CRDs staged from the committed rendered release objects.",
    requires: "offline",
    disposition: "join-the-chain",
    status: "passes",
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
