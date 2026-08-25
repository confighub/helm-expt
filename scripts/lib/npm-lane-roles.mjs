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
  "agent-skill:verify": {
    proves: "The Config Workshop agent skill, cross-format processing reference, task playbook, seven task contracts, published copies, and discovery index remain complete and internally consistent; it does not claim that an agent completed those tasks successfully.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; this focused lane checks the public agent contract and its published copy directly",
  },
  "config-catalog:verify": {
    proves: "The source-neutral Catalog records, lifecycle route resolutions, AI review example, OCI evidence chains, processing-model contract, and Top 50 tracker all re-derive from committed sources without stale output.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; its component generators and model verifier already run in the full verify chain, while this focused lane checks the complete Catalog model in one command",
  },
  "config-catalog:self-test": {
    proves: "The Catalog generators reject malformed AI review records, invalid four-stage assessment cases, and inconsistent source-neutral Catalog records.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; the same self-tests run separately in the full verify chain, while this alias groups the Catalog contract checks for development",
  },
  "config-assessment-stages:verify": {
    proves: "The six maintained assessment cases still separate inspection, materialization, destination acceptance, and post-deployment evidence across literal YAML, Helm, and AICR examples.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; the same generator runs inside config-catalog:verify and the full verify chain, while this alias checks the four-stage assessment contract directly",
  },
  "config-assessment-stages:self-test": {
    proves: "The assessment-stage generator rejects reordered stages, missing prerequisites, false deployment claims, and AICR expected-resource failures that should be recorded as blocked or not-run.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; the same self-test runs inside config-catalog:self-test and the full verify chain, while this alias is the focused negative test",
  },
  "catalog-shared-checks:verify": {
    proves: "Every maintained Helm base has a separate released cub check result bound to the exact YAML bytes and scanner object set, with pinned scanner and pattern-bundle identity, stable control IDs, complete Catalog-rule classification, and fresh generated indexes.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes for 245 exact Helm configurations; this focused gate also protects the distinction between the shared advisory result and the existing chart-specific Catalog review",
  },
  "lifecycle:route-resolutions:verify": {
    proves: "Each destination-specific lifecycle record still binds one exact configuration revision and object digest to a destination, runtime, ordered requirements, routes, and scoped receipts, including the blocked AICR v0.19.0 EKS/H100 staging plan.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; the same generator runs inside config-catalog:verify and the full verify chain, while this alias gives lifecycle work a focused gate",
  },
  "aicr-starter-public:verify": {
    proves: "The anonymous Try AICR receipt still names the exact public source digest, seven reviewed Application files, source-and-intent record, public script, local OCI digest, and successful pull-back, without claiming ConfigHub or Kubernetes execution.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; the public-site generator checks the same receipt and script contract, while this focused lane gives the AICR example a direct verifier",
  },
  "c3agent-config:verify": {
    proves: "The three compact c3agent environment inputs deterministically reproduce their exact Kubernetes objects, source-and-intent records, lifecycle record, environment diff, and portable local OCI; pulling the OCI back yields the recorded development object-set hash and two non-deployable companion records.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; requires the local oras CLI and is run with the focused c3agent example gate",
  },
  "c3agent-config:self-test": {
    proves: "The c3agent generator refuses an unpinned image, an inline credential value, or activation of the public disabled fixture.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; paired with c3agent-config:verify",
  },
  "c3agent-config:proof:verify": {
    proves: "The committed live receipt records a matching source OCI digest, ConfigHub base, development-to-staging-to-production promotion, release OCI, Argo CD sync at that digest, and Kubernetes object reconciliation while both Deployments and the agent task remain not-run.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes against the isolated live run recorded on 2026-08-20; repeating the run itself needs ConfigHub, Docker, kind, kubectl and oras",
  },
  "c3agent-config:proof:self-test": {
    proves: "The c3agent receipt verifier rejects a false agent-task pass, a false Secret-presence claim, or an Argo revision that differs from the published ConfigHub release digest.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; paired with c3agent-config:proof:verify",
  },
  "measured-promotion:verify": {
    proves: "The committed NGINX run tested three exact object sets against one fixed HTTP check and destination requirement, selected the smallest passing candidate, kept that object hash through ConfigHub staging and production, and delivered the recorded release digest through Argo CD.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes against the isolated live run recorded on 2026-08-20; repeating the run itself needs ConfigHub, kind and kubectl",
  },
  "measured-promotion:self-test": {
    proves: "The measured promotion verifier rejects a different selected candidate, a production object hash that differs from the winner, or an Argo revision that differs from the release digest.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; paired with measured-promotion:verify",
  },
  "timoni-redis:self-test": {
    proves: "The Timoni Redis publication payload contains the seven recorded Kubernetes objects and six internally consistent source, lifecycle, materialization, base, and index records without contacting a registry or ConfigHub.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; this focused lane checks the publication payload before any external write",
  },
  "timoni-redis:verify": {
    proves: "The committed public-OCI and ConfigHub receipts retain the Timoni source identity, canonical seven-object set, six base-only companion records, seven linked development Units, policy checks, and explicit not-run delivery limits.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; the cross-format Catalog gate checks the same base record while this lane checks both external receipts together",
  },
  "timoni-redis:oci:verify": {
    proves: "A credential-free pull of the immutable public Timoni Redis configuration OCI reproduces the recorded seven-object set and all six publication-time companion-record hashes.",
    requires: "network",
    disposition: "keep-outside",
    status: "passes; a fresh run needs Artifact Registry and oras, while timoni-redis:verify checks the committed receipt offline",
  },
  "timoni-redis:hub:verify": {
    proves: "The live helm-catalog base and development Spaces still match the committed Timoni receipt by Space ID, Unit ID, data hash, upstream link, README, companion-record placement, and policy assignment.",
    requires: "confighub",
    disposition: "keep-outside",
    status: "passes with a valid helm-catalog login; the offline receipt remains covered by timoni-redis:verify",
  },
  "verify:shard": {
    proves: "One deterministic slice of the `npm run verify` chain passes. The slice is chosen by position, so every step lands in exactly one shard and the runner refuses a split that would leave any step unrun.",
    requires: "offline",
    disposition: "keep-outside",
    status: "green: this is how CI runs the chain, in six parallel shards, rather than a gate of its own",
  },
  "verify:shard:offline": {
    proves: "A slice of the chain excluding the thirty-two steps that shell out to cub, oras or helm, carrying the gates declared in tests/verify-chain-known-red.yaml. Needs nothing installed beyond Node, git and a YAML reader.",
    requires: "offline",
    disposition: "keep-outside",
    status: "green: six of these run in parallel on every pull request",
  },
  "verify:shard:cli": {
    proves: "The thirty-two chain steps that re-render a package through the cub installer, read an OCI artifact through oras, or template a chart through helm. None of that can be done by reading files, so they are separated and their tools installed once.",
    requires: "network",
    disposition: "keep-outside",
    status: "green: runs as its own job so a hiccup reaching hub.confighub.com cannot mask an offline gate failing",
  },
  "site:published:verify": {
    proves: "That readers can actually see what main holds: the last GitHub Pages deployment of main concluded in success, and every page the top navigation links is served byte-identical to the committed file. `site:verify` proves neither, and the difference cost thirteen consecutive silent deploy failures (#1465, #1466).",
    requires: "network",
    disposition: "keep-outside",
    status: "green: runs in its own workflow after every push to main and once a day, because it fetches the live site and reads the Actions API",
  },
  "skills:verify": {
    proves: "The six internal helm-expt operating guides and the public Config Workshop agent skill satisfy their required content, terminology, task-contract, publication, and discovery checks.",
    requires: "offline",
    disposition: "keep-outside",
    status: "passes; this focused lane checks all repository skills together",
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
