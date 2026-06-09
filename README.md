# ConfigHub Helm Experiment

Use Helm charts. Ship ConfigHub variants.

This repo shows how popular public Helm charts can become `cub installer`
packages with named base variants, exact rendered Kubernetes objects, optional
derived ConfigHub variants, scans, gates, receipts, and live proof.

The supported bases are intended to preserve the chart's end-to-end semantics
while splitting the install into visible, verifiable stages. That makes changes
safer, including AI-assisted changes, and helps keep users on the chart's
supported path instead of accidentally driving Helm into hidden edge cases.

All contents are experimental and unofficial.

Public entry points:

- [Offering page](./docs/user/offering.md): plain-English overview for Helm users.
- [Static HTML offering page](./site/offering.html): generated page for a public site.
- [Try now](./docs/user/try-now.md): short Redis and kube-prometheus-stack paths.
- [Static HTML try page](./site/try.html): generated try-now page for a public site.
- [Catalog dashboard](./site/index.html): generated status, catalog, and proof data.
- [Current proof status](./docs/user/current-proof-status.md): what is proven, watch, blocked, or still backlog.

Core flow:

```text
Helm chart
-> cub installer recipe/package
-> named base variants that select or change the Helm-rendered object set
-> exact rendered Kubernetes objects
-> optional derived ConfigHub variants for approved post-render fields, facts, targets, gates, links, and observation policy
-> hook/lifecycle policy for cluster-dependent Helm behavior
-> Helm-equivalence proof, scans, gates, receipts
-> ConfigHub / OCI / GitOps handoff
```

## The Idea

Pre-rendering Helm makes the real deployment object set visible before anyone
has to approve, promote, or operate it.

In this experiment, AI helps analyze public Helm charts and draft deterministic
`cub installer` recipes. The proof pipeline then checks the work mechanically:

```text
public Helm chart
-> deterministic installer recipe
-> deterministic rendered object set
-> base variants and optional derived ConfigHub variants
-> scans, gates, receipts, and live observations
```

That matters because many Helm problems are not just install-time problems.
They show up later as upgrade surprises, hidden value interactions, environment
drift, unclear ownership, unreviewed YAML changes, or uncertainty about what
actually reached a cluster.

The catalog is meant to show a better path:

```text
Day 0: install from a known recipe and inspect the exact objects.
Day 1: create variants deliberately and compare the rendered results.
Day 2: scan, promote, observe, upgrade, and audit with receipts.
```

The first experience should not require full product signup. The target shape is:

```text
public chart
-> public signed package / OCI artifact
-> user's cluster or GitOps controller
-> local verification receipt
```

If ConfigHub provides the public OCI gateway, public pulls may still be
authenticated, rate-limited, and signature-verified so the service is not an
unauthenticated firehose. Full signup becomes useful when the user wants
private charts, private overlays, derived ConfigHub variants, production
approvals, managed receipts, or fleet operations.

In practice: browse the catalog anonymously; use a lightweight read-only pull
token for public OCI artifacts; verify signatures and digests locally; create a
full ConfigHub account only when you want ConfigHub to manage private or
production state.

## Why

Helm is good at producing Kubernetes objects. The pain starts when teams need
to answer ordinary operational questions:

```text
What exactly did this values file produce?
Is prod getting the same objects that staging reviewed?
Which variant changed, and why?
Did we scan the exact objects we are about to deploy?
Can we prove what was rendered, checked, uploaded, and observed?
```

ConfigHub is the proof and variant layer around those Helm-generated objects.
The goal is not to replace Helm. The goal is to make Helm output reviewable,
comparable, scannable, promotable, and auditable.

We use AI to accelerate Helm chart analysis and recipe creation. We use
`cub installer` to prove the resulting recipes produce correct, Helm-equivalent,
reviewable base variants and derived ConfigHub variants.

This is not a single prompt. It is an AI-assisted workflow with explicit
decision points and mechanical checks. For the recipe-generation workflow and
the "where pieces go" table, see
[Introduction To The Harness](./docs/user/introduction-to-the-harness.md).

## How Values And Overlays Are Supported

Helm users already customize charts with values files, `--set` flags,
umbrella charts, wrapper charts, and sometimes Kustomize overlays. The rule in
this repo is not "stop doing that." The rule is:

```text
If a customization changes Helm render inputs, object count, object shape, or
lifecycle semantics, make it a reviewed cub installer recipe/package base.

If it refines already-rendered ConfigHub Units through approved post-render
fields, facts, links, targets, gates, functions, or checks, make it a derived
ConfigHub variant using `cub variant create` plus guided review.
```

There are three product questions behind that routing:

| Question | Product lane | Typical answer in this repo |
| --- | --- | --- |
| How many useful configs should be free or out of the box? | public catalog bases | enough reviewed base variants to cover common, high-value install shapes such as default, existing Secret, server-only, ClusterIP, storage, or observability modes |
| What can users customize inside ConfigHub after a base is reviewed? | derived ConfigHub variants | environment, region, customer, target, gates, observation policy, target facts, links, and approved post-render field fills |
| Which cases are more complex and likely managed or paid? | import, private overlays, and stacks | private values and wrapper charts, GitOps import, fleet variants, full app stacks, private patch SLAs, old-version support, and production receipts |

The public catalog should carry enough free base variants that most users do
not start from a blank chart analysis. Derived variants should cover many
environment and customer cases without rerendering Helm. Full import, private
overlay, and stack workflows are still important, but they should be presented
as a richer lane over the same proof model rather than as the first tutorial
vocabulary.

Before OCI delivery, users need to make three separate decisions:

| Question | Use | Examples |
| --- | --- | --- |
| Does this change Helm render inputs, object count, object shape, or lifecycle semantics? | `cub installer` base variant | values files, component on/off, storage, ingress, CRDs, RBAC, Kustomize patches that change object shape |
| Does this refine an already-reviewed ConfigHub object set after render? | derived ConfigHub variant | target, environment, region, namespace when represented, labels, gates, observation policy, links, target facts, allowed placeholder or TransformPaths fills |
| Is this required before Kubernetes or GitOps can use the artifact? | delivery prerequisite or receipt | existing Secret, StorageClass, IngressClass, CRD owner, GitOps pull secret, OCI digest/signature, hook/lifecycle decision |

Examples:

| Customization | Route |
| --- | --- |
| Helm values file that changes storage, ingress, CRDs, RBAC, args, env, object count, topology, or lifecycle behavior | new `cub installer` base / rendered revision |
| Replica count over an already-rendered workload field | derived ConfigHub variant or Day-2 operation when the base allows that path; base variant only when it changes topology or chart branches |
| Kustomize overlay that changes the install shape | explicit recipe/base overlay with digest and diff |
| Namespace, target, labels, approval gates, observation policy | derived ConfigHub variant |
| Existing Secret reference already represented in the rendered objects | derived ConfigHub variant with target fact/check |
| Approved post-clone function or TransformPaths fill over existing fields | derived ConfigHub variant with mutation receipt |
| Wrapper chart plus platform values plus customer overlay values | managed overlay import; usually needs ConfigHub Server |

NGINX-style extension slots are common. In the current evidence set, 13/20
top-20 catalog charts and 82/100 top-100 chart facts expose raw manifests,
`tpl` snippets, config blocks, sidecars, or add-on slots. In the broader
top-500 source scan, 254/500 charts expose raw/extra manifest values and
363/500 use `tpl` or raw/extra manifest values. Leaving those slots empty can
stay inside a supported catalog base. Populating them creates a new reviewed
install shape and should route back through a `cub installer` base variant with
render parity, scans, gates, and receipts. See
[Extension Slots](./docs/user/extension-slots.md) for the user-facing routing
guide.

For the detailed algorithm, see
[Customization Algorithm](./docs/reference/customization-algorithm.md). For the product
tier boundaries, see
[Product Support Tiers For Helm Scenarios](./docs/user/product-support-tiers.md).
For the seven-stage lifecycle and render parity boundary, see
[Seven-Stage Helm Lifecycle](./docs/reference/seven-stage-helm-lifecycle.md).
For the simple variant creation guide, see
[Creating Variants](./docs/user/creating-variants.md).
For wrapper charts and customer overlays, see
[Custom Overlays](./docs/user/custom-overlays.md).
For the OCI delivery boundary, see
[Choosing Base Variants, Derived Variants, And Delivery Changes](./docs/user/change-routing-before-oci.md).
For the extension-slot coverage table, see
[Extension Slot Coverage](./data/extension-slots/summary.md).
For Helm hooks specifically, see
[Hook Lifecycle Strategy](./docs/user/hook-lifecycle-strategy.md).

For a single serial order through the user docs, see
[User Docs Reading Order](./docs/user/README.md).
If you are asking why this is not just `cub helm install`, start with
[Why This Exists](./docs/user/why-this-exists.md). For the shortest product
model, start with [What You Get](./docs/user/what-you-get.md).

## Command Choice

Use the shortest command that answers the question you are asking:

| Goal | Command path |
| --- | --- |
| See what a chart renders, without ConfigHub state. | `cub helm template` |
| Load one Helm render into ConfigHub Units quickly. | `cub helm install` |
| Adopt an existing Argo, Flux, KRM, or rendered-manifest app. | `cub gitops discover/import`, `cub unit import`, or a managed import workflow |
| Use a maintained catalog entry with supported bases, receipts, scans, and live evidence. | `cub installer setup --pull <package> --base <base>` |
| Upload a reviewed rendered base into ConfigHub. | `cub installer upload` |
| Create an environment, region, customer, or target variant after upload. | `cub variant create` |

The durable catalog path starts at `cub installer`. The future bridge from a
direct Helm render/install into a maintained recipe is tracked as
`cub installer import helm`; it is not used as a current command in this repo.
For the full routing table, see [Choosing Commands](./docs/user/choosing-commands.md).

## What Is Proven Today

> **What a full test run verifies — and what you can expect to be true:** see
> [`docs/reference/verification-properties.md`](docs/reference/verification-properties.md) for the
> acceptance contract — the verified properties, current coverage, and the
> honest limitations.

The generated status dashboard is the authority for current counts:
[data/status-dashboard/summary.md](./data/status-dashboard/summary.md).
The numbers below are the current public snapshot, not a promise that every
chart/base row has every lane complete.

```text
20 popular Helm charts have catalog entries.
20/20 top-20 charts have at least one passing local kind live/e2e receipt.
20/20 top-20 charts have chart-level ConfigHub upload, scan, and safe-ops proof receipt sets.
20/20 top-20 charts are production-review-ready by disposition receipt.
0/20 top-20 charts still need pre-review target-fact preflight disposition.
0/20 top-20 charts are production-supported until target-scoped support decisions are recorded.
100 charts have recipe/package proof artifacts.
156 chart/base rows have Helm-template versus cub installer render parity.
18/156 chart/base rows currently have the stricter in-ConfigHub proof lane marked pass.
The selected top-20 live Helm-vs-ConfigHub comparison lane has 18 pass,
2 watch, and 0 blocked receipts.
The top-20 base-variant two-cluster kind parity lane has 40 committed
receipts: 32 pass, 1 watch, 7 blocked, and 0 semantic parity defects.
5/5 maintained hook-bearing top-100 charts have hook route receipts;
0/5 of those hook-queue rows have hook execution or observation receipts yet.
Separately, cert-manager and External Secrets have lifecycle-observation
receipts for common CRD/webhook/controller-owned runtime behavior. Those
receipts demonstrate the observation pattern, not universal hook support.
Top-500 source/catalog analysis exists as catalog-planning data for future
recipe promotion work.
```

The production support decision contract is in
[data/production-disposition/support-decision-contract.md](./data/production-disposition/support-decision-contract.md).

The `20/20` claims above are chart-level catalog coverage. Per-base and
per-lane status is stricter; use `data/status-dashboard/summary.md` and
`data/outcome-coverage/base-outcomes.csv` before making a claim about a
specific chart/base pair.
For the current non-pass live rows, use
`data/live-parity-rerun-plan/summary.md`; it separates semantic parity defects
from target prerequisites, runtime watch rows, and lifecycle work.

The current top-20 live proof means:

```text
rendered cub installer objects
-> kubectl apply to local kind
-> rollout/object checks pass
-> observation receipt is committed and verified
```

GitOps/OCI runtime verification lives in a separate live lane:

```text
ConfigHub OCI
-> Argo CD or Flux
-> cluster sync
-> live observation through cub-scout / controller evidence
```

That lane depends on a live GitOps controller and cluster, so it is documented
and exercised outside the pure local `npm run verify` corpus. The first
runtime/GitOps wave currently has 10 committed receipts: 5 pass and 5 non-pass
target-fit receipts. The strict live Helm-vs-ConfigHub comparison lane has 20
committed receipts for selected top-20 rows: 18 pass, 2 watch, and 0 blocked.
The strict two-cluster kind parity lane has receipts for all 40 top-20 base
variants and separates semantic parity from target prerequisites, runtime
readiness, hooks, and storage behavior.
See the generated summaries for exact chart/base status:
[Runtime/GitOps Wave](./data/runtime-gitops/summary.md) and
[Live Helm-vs-ConfigHub Parity](./data/live-helm-confighub-compare/summary.md).
For the all-base-variant parity lane, see
[Two-Cluster Kind Parity](./data/live-kind-parity/summary.md). For the exact
non-pass follow-up queue, see
[Live Parity Rerun Plan](./data/live-parity-rerun-plan/summary.md).

Start here:

```text
site/index.html
  Generated static catalog view: command routing, proof counters, top-20 bases,
  top-100 readiness, top-500 evidence boundary, and extension slots.

CATALOG.md
  The top-level chart catalog: charts first, variants underneath.

docs/user/what-you-get.md
  The compact product model: why this exists, what is proven, and what remains product work.

docs/user/outcomes-and-tests.md
  What the repo promises, which tests prove each promise, and where the CSVs live.

docs/user/helm-pain-points.md
  How common Helm pain points map to helm-expt, ConfigHub, cub installer, and live observation.

data/status-dashboard/summary.md
  One-page current status: top100, top500 evidence, proof lanes, hooks, quirks, GitOps, and live parity.

data/status-dashboard/top20-status.csv
  Compact chart-by-chart status for the top-20 catalog: recommended base,
  setup command, base readiness, lane counts, feature summary, gaps, and next action.

data/top20-base-readiness/start-here.md
  The shortest list of clean first catalog paths: chart, base, command, and
  production-support reminder.

data/top20-base-readiness/summary.md
  One row per top-20 base variant: which bases are clean first paths and which need prerequisites, runtime review, or hook lifecycle work.

data/top100-readiness/summary.md
  One chart-by-chart answer for current top-100 adoption bucket, strongest
  evidence, next action, and first work queues.

data/extension-slots/summary.md
  NGINX-like extension slots: 13/20 top-20 catalog charts and 82/100 top-100 chart facts surface raw manifests, tpl snippets, config blocks, sidecars, or add-on slots. The top-500 source scan sees raw/extra manifest values in 254/500 charts and tpl or raw/extra manifest values in 363/500 charts.

docs/user/current-proof-status.md
  What is proven now, and which generated summaries are authoritative.

docs/user/verification-lanes.md
  What each proof lane means, and what it does not prove.

docs/user/adopting-existing-apps.md
  How existing Argo, Flux, KRM, rendered-manifest, and live-resource apps enter the ConfigHub model.

docs/README.md
  The documentation map: what each doc family is for.

data/live-e2e/summary.md
  The top-20 live-test status table.

data/production-disposition/summary.md
  What still has to be resolved before each chart can be production-promoted.

data/outcome-coverage/summary.md
  Outcome promises, proving tests, and front-door CSVs for charts, bases, derived variants, and features.

data/pain-point-coverage/summary.md
  Helm pain points, current answers, handoffs, evidence paths, and remaining gaps.

data/variant-path-coverage/summary.md
  Proof status per chart, base variant, derived variant, diff, and operation path.

data/edge-recovery/summary.md
  Graph fragments recovered from Redis and kube-prometheus-stack recipe artifacts.

data/latest-top20-refresh/summary.md
  Which supported top-20 charts are current and which need new proof paths.
```

## Pick Your Path

```text
I want to check the repo quickly.
  Run Quick Verify.

I want to see what charts and variants exist.
  Open CATALOG.md.

I want the easiest browsable catalog with setup commands.
  Open site/index.html.

I want a short show-and-tell sequence.
  Read docs/user/tutorial-sequence.md.

I want to know which command to use.
  Read docs/user/choosing-commands.md.

I already run apps through Argo, Flux, KRM, or rendered manifests.
  Read docs/user/adopting-existing-apps.md.

I want the user docs in order.
  Read docs/user/README.md.

I want to understand how to create variants.
  Read docs/user/creating-variants.md.

I have wrapper chart, platform, or customer overlay values.
  Read docs/user/custom-overlays.md.

I installed Redis and want proof it matches the catalog.
  Run Verify Your Install.

I want the full ConfigHub walkthrough.
  Follow Quick Start With Redis.
```

## Quick Verify

You need Node.js to run the proof scripts. There are no npm dependencies and no
`npm install` step.

That is deliberate. The committed proof harness uses Node's standard library
and local repo code, so a fresh clone can check the corpus without downloading a
third-party npm supply chain first. Live lanes still need the relevant external
CLIs such as `helm`, `kubectl`, `kind`, `cub`, or GitOps controllers.

```sh
git clone https://github.com/confighub/helm-expt.git
cd helm-expt
npm run top20:verify-local-e2e
```

Expected result:

```text
verified 20 top20 local kind e2e receipt(s)
```

Run the full repository verifier:

```sh
npm run verify
```

That checks the committed proof corpus: recipe/package structure, recorded Helm
equivalence, rendered object digests, receipts, catalog status, target facts,
committed local live/e2e receipts, production disposition, and top-500 analysis.
The default verifier does not rerun Helm or touch a Kubernetes cluster; it proves
that the checked-in artifacts and receipts are self-consistent and current.

Use scoped checks while working. Use `npm run verify` as a broad gate before a
large merge, public demo, release note, or external review. Use live runners
only when the goal is to create or refresh live evidence.

| Need | Start with |
| --- | --- |
| One doc or generated table changed | the matching `*:verify` command, plus `npm run docs:verify` for docs |
| One chart proof changed | `<chart>:verify-proof`, `<chart>:verify-proof:self-test`, and `<chart>:verify-package` |
| Command examples changed | `npm run installer:command-surface:verify` and `npm run variant:command-surface:verify` |
| CSV/data front doors changed | owner `*:verify`, then `npm run data:index:verify` if CSVs moved or changed role |
| Fresh Kubernetes or GitOps evidence needed | the specific live runner, then commit the receipt and regenerate its summary |
| Broad release/public review gate | `npm run verify`, after scoped checks pass |

Use `redis:compare` when you want to see the fresh Helm-vs-installer comparison
end to end:

```sh
npm run redis:compare
```

For most curated charts, `<chart>:compare` currently verifies `cub installer
setup` against the stored Helm-rendered object set; fresh Helm rendering happens
in the chart's `:generate-proof` path. Use the live/runtime lanes when you want
to create fresh cluster or ConfigHub evidence.

For the proof contracts specifically:

```sh
npm run p0:contracts
```

That checks the schema directory, bounded Kubernetes capability profiles,
observation freshness SLO, top-20 live receipts, top-500 analysis, and the
minimum P0 corpus invariants.

Tested proof context:

```text
Helm renderer: v4.1.4+g05fa379
Kubernetes capability profile: 1.30.0
Local kind live-test image: kindest/node:v1.30.0
```

The `cub`, `kind`, and `kubectl` CLI versions are environment-dependent today;
the receipts record the rendered inputs and verified outputs.

For the full test-script map, including what each `npm run ...` family checks
and which commands write files, see:

```text
tests/npm-scripts.md
```

## Verify Your Install

The `Quick Verify` and `npm run verify` paths above check this repo's canonical
artifacts. To check that your own install matches them, run one command per
stage of the Redis demo.

For `cub installer setup` and `cub installer upload`, use an authenticated
`cub` CLI and keep `helm` and `kustomize` on your `PATH`. For live cluster
checks, use a Kubernetes context you are comfortable applying test resources to.

After `cub installer setup`, check the rendered objects:

```sh
npm run redis:verify-install:render -- \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --namespace redis
```

Expected result:

```text
PASS redis:verify-install:render bitnami/redis/25.5.3 default
semantic object matches: 14/14
```

After `kubectl apply`, check the live cluster:

```sh
npm run redis:verify-install:cluster -- \
  --base default \
  --context <your-kubectl-context> \
  --namespace redis
```

Expected result:

```text
PASS redis:verify-install:cluster bitnami/redis/25.5.3 default
checks: statefulsets, PVCs, Redis PING
```

After `cub installer upload`, check the ConfigHub Units and labels:

```sh
npm run redis:verify-install:confighub -- \
  --base default \
  --space <your-space>
```

Expected result:

```text
PASS redis:verify-install:confighub bitnami/redis/25.5.3 default
units: 15
variant-labeled units: 14
```

Each command writes a receipt under `.tmp/verify-install/`. That receipt is the
user-side proof: what you rendered, what namespace/context you checked, what
matched, and which checks passed. Today these user-install checks ship for
Redis only. The generic `verify-install:*` scripts are lower-level compatibility
aliases for charts that have an `install-checks.yaml`; they are not a repo-wide
chart verifier.

The NGINX bulk-ops tutorial has a separate live ConfigHub verifier:

```sh
npm run verify-bulk-ops:nginx -- \
  --space helm-nginx-http-clusterip \
  --changeset nginx-bulk-hardening
```

## Quick Start With Redis

Redis is the happy-path demo because it is small, familiar, and still exercises
the important proof chain. The local verification path above does not need a
ConfigHub account. The upload part of this demo does.

Read the runnable script:

```text
docs/demo/redis/demo-script.md
```

The demo uses real commands, including:

```sh
cub installer setup \
  --pull packages/bitnami/redis/25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --non-interactive \
  --namespace redis

npm run redis:compare
npm run verify
npm run redis:verify-install:render -- --base default --work-dir .tmp/demo/redis-default --namespace redis
npm run redis:verify-install:confighub -- --base default --space <your-space>
```

The full ConfigHub upload command is in `docs/demo/redis/demo-script.md`; it is
longer because it records labels such as component, layer, owner, chart version,
variant, and proof.

Redis has two catalog variants:

```text
default
  Renders Secret redis/redis from the pinned demo password.
  cub installer separates that Secret into out/secrets.

reuse-existing-secret
  Renders no Redis Secret.
  Requires pre-staged Secret redis/redis-existing-secret key redis-password.
```

The key Redis proof files are:

```text
recipes/bitnami/redis/25.5.3/CATALOG.md
packages/bitnami/redis/25.5.3/installer.yaml
recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml
recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/helm-equivalence-receipt.yaml
runs/redis-local-kind/latest/observation-receipt.yaml
```

### Redis Secret Handling

Redis has two supported secret models in this catalog.

| Variant | Secret model | What ConfigHub records | Cluster requirement |
| --- | --- | --- | --- |
| `default` | Helm renders `Secret redis/redis` from the pinned demo password in `effective-values.yaml`. `cub installer` separates that Secret into `out/secrets`. | The rendered Secret is part of the proof, but it is not uploaded as a ConfigHub Unit/OCI artifact. Workloads record an expected external reference to `v1/Secret redis/redis`. | For direct local tests, apply `out/secrets` before `out/manifests`. |
| `reuse-existing-secret` | Helm renders no Redis Secret. Workloads reference `redis/redis-existing-secret` key `redis-password`. | The recipe records this as an installer `externalRequires` and variant `targetFacts.requiredSecrets` requirement. No secret material is stored. | Pre-stage `Secret redis/redis-existing-secret` with key `redis-password`; the verifier checks it exists. |

The point is deliberate: ConfigHub should carry proof, references, labels,
target-fact requirements, and receipts. It should not silently become the place
where generated Redis credentials are hidden.

## How A Chart Is Organized

For every chart, read the catalog page first:

```text
CATALOG.md
recipes/<repo>/<chart>/<version>/CATALOG.md
```

The root `CATALOG.md` is the shelf: charts first, variants underneath, with the
recommended first variant and `cub installer setup` package path visible. Then
open the per-chart `CATALOG.md` for the chart source, recipe, rendered objects,
receipts, scans, and current support status.

The main folders are:

```text
recipes/
  Chart analysis, variants, rendered objects, receipts, and catalogs.

packages/
  Executable cub installer packages.

docs/demo/
  Plain-English per-chart walkthroughs and transcripts.

docs/user/introduction-to-the-harness.md
  How recipes are generated and how chart behavior is placed into recipes,
  variants, facts, profiles, gates, receipts, or live observations.

runs/
  Receipts from ConfigHub, local kind, and proof runs.

data/live-e2e/
  Top-20 local kind live/e2e summary.

data/production-disposition/
  What is still required before production support.

data/latest-top20-refresh/
  Latest top-20 version refresh snapshot plus Redis promotion and Kubara overlay
  work orders.

data/top500-catalog-analysis/
  Current top-500 analysis and proof index.
```

## Viewing And Operating On Configs In ConfigHub

After `cub installer upload`, the rendered objects become ConfigHub Units. This
is where the proof stops being a pile of YAML and becomes something a team can
inspect, compare, scan, approve, and operate.

You need a ConfigHub account, an organization, and an authenticated `cub` CLI:

```sh
cub auth login --server https://hub.confighub.com
```

Useful first commands:

```sh
# Find uploaded Helm experiment spaces.
cub space list --where "Slug LIKE 'helm-%'"

# Open matching spaces in the ConfigHub web UI.
cub space list --where "Slug LIKE 'helm-%'" --web

# List the Units for one uploaded chart variant.
cub unit list --space <space> \
  --columns Unit.Slug,Unit.Labels.Component,Unit.Labels.HelmChartVersion,Unit.Labels.Variant

# Open the Units for one space in the ConfigHub web UI.
cub unit list --space <space> --web

# Inspect the stored config for one Unit.
cub unit data <unit> --space <space>

# Compare revisions of one Unit.
cub unit diff <unit> --space <space>

# Run a ConfigHub function scan over the uploaded Units.
cub function vet <function> --space <space>

# Create a controlled operation path.
cub changeset create --space <space> helm-review --description "Review rendered Helm variant"

# Approve the checked revision for the uploaded variant.
cub unit approve --space <space> --where "Labels.Variant = 'default'"

# Dry-run an apply when the Units are attached to a target and worker path.
cub unit apply --space <space> --where "Labels.Variant = 'default'" --dry-run

# Clone a reviewed ConfigHub space into an environment/region variant.
cub variant create staging <upstream-space> --environment Staging --region us-east2
```

The expected label model is visible in the Redis demo:

```text
Component=Redis
HelmChart=bitnami-redis
HelmChartVersion=25.5.3
Variant=default
Proof=redis-confighub-proof
```

The important split is:

```text
helm-expt proves the recipe and rendered objects.
cub installer upload stores those objects as ConfigHub Units.
ConfigHub lets you view, diff, scan, approve, and hand off those Units.
Live cluster truth needs a fresh observation receipt from a cluster-side tool.
```

## ConfigHub And GitOps

Once the Units are in ConfigHub, the intended GitOps path is:

1. Choose a chart from `CATALOG.md`.
2. Choose a catalog variant.
3. Verify the rendered objects and receipts.
4. Upload to ConfigHub, then publish the reviewed object set to ConfigHub OCI.
5. Point Argo CD or Flux at that ConfigHub OCI artifact.
6. Let GitOps sync the cluster.
7. Record or inspect an observation receipt.

Today this repo proves the chart -> recipe -> variant -> rendered objects path
for the top 20, and proves local kind deployment for those rendered objects.
The Argo CD / Flux OCI path is verified in a separate live lane because it needs
a running GitOps controller and cluster. The current generated status is:

```text
runtime/GitOps first wave: 5 pass, 5 non-pass target-fit receipts
strict live Helm-vs-ConfigHub comparison: 18 pass, 2 watch, 0 blocked
two-cluster kind parity: 32 pass, 1 watch, 7 blocked, 0 semantic defects
```

Use the generated summaries for exact chart/base status:
[Runtime/GitOps Wave](./data/runtime-gitops/summary.md) and
[Live Helm-vs-ConfigHub Parity](./data/live-helm-confighub-compare/summary.md).
For non-pass follow-up rows, use
[Live Parity Rerun Plan](./data/live-parity-rerun-plan/summary.md).

## Current Commands Used

These are real commands used somewhere in the current proof path. The Redis
quick path mainly uses `cub installer setup`, `npm run redis:compare`, and
`npm run verify`; the broader catalog, ConfigHub, scan, and safe-ops lanes use
more of the surface area below.

```text
cub installer doc
cub installer setup
cub installer render
cub installer package
cub installer vet
cub installer plan
cub installer upload
cub space list
cub variant create
cub unit list
cub unit data
cub unit diff
cub unit approve
cub unit apply
cub function vet
cub changeset create
```

## Additional Options For Live Cluster Verification

The built-in `redis:verify-install:cluster` command is intentionally small. It
proves the Redis happy path with rollout, PVC, Secret, and Redis PING checks.

For deeper runtime proof, use the
[cub-scout helm-expt example](https://github.com/confighub/cub-scout/tree/main/examples/helm-expt).

That example adds the cluster-side half of the proof:

```text
helm-expt proves:   Helm render == cub installer render
installer proves:   package/spec -> rendered objects -> ConfigHub Units/OCI
cub-scout proves:   rendered objects are present and matching in the live cluster
```

Typical cub-scout checks include:

```sh
./cub-scout map status --namespace "$NS" --json
./cub-scout doctor --namespace "$NS" --format json
./cub-scout compare drift --file "$MANIFESTS" -n "$NS" --format json --fail-on warning
./cub-scout receipt verify --file "$MANIFESTS" --scope namespace/"$NS" \
  --format json --out "$RUN_DIR/cub-scout-object-set.receipt.json" \
  --fail-on any-non-pass
```

Use this when you want a stronger live-cluster claim than the local Redis
smoke check: object-set receipts, drift checks, source-truth checks, ownership
graphs, snapshots, and GitOps convergence evidence.

## Background Reading

For the longer narrative behind this experiment, see `docs/planning/blog-posts.md`. For
the latest refresh plan, see `docs/planning/latest-top20-refresh-plan.md`. For the shape
of a dedicated public site, see `docs/planning/dedicated-website-plan.md`. The README
stays focused on why the project exists, what is proven, and how to try it.

## The Pitch

```text
You can keep using public Helm charts,
but stop approving guesses.

ConfigHub gives you named base and derived variants,
exact rendered objects,
checks,
receipts,
and a safer path from test to production.
```

Helm gives you charts. ConfigHub gives you managed, reviewable, scannable,
promotable base and derived variants from those charts.
