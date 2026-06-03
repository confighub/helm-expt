# ConfigHub Helm Experiment

Use Helm charts. Ship ConfigHub variants.

This repo shows how popular public Helm charts can become `cub installer`
packages with named variants, exact rendered Kubernetes objects, scans, gates,
receipts, and live proof.   ALL CONTENTS ARE EXPERIMENTAL & UNOFFICIAL.

Core flow:

```text
Helm chart
-> cub installer recipe/package
-> named ConfigHub variants
-> exact rendered Kubernetes objects
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
-> ConfigHub variants
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
private charts, private overlays, server-side variants, production approvals,
managed receipts, or fleet operations.

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
reviewable ConfigHub variants.

This is not a single prompt. It is an AI-assisted workflow with explicit
decision points and mechanical checks. For the recipe-generation workflow and
the "where pieces go" table, see
[Introduction To The Harness](./docs/user/introduction-to-the-harness.md).

## How Values And Overlays Are Supported

Helm users already customize charts with values files, `--set` flags,
umbrella charts, wrapper charts, and sometimes Kustomize overlays. The rule in
this repo is not "stop doing that." The rule is:

```text
If a customization changes rendered Kubernetes objects, make it a reviewed
cub installer recipe/package base.

If it refines already-rendered ConfigHub Units, make it a ConfigHub variant
using `cub variant create` plus guided review.
```

Before OCI delivery, users need to make three separate decisions:

| Question | Use | Examples |
| --- | --- | --- |
| Does this change rendered Kubernetes objects? | `cub installer` base variant | values files, component on/off, storage, ingress, CRDs, RBAC, Kustomize patches that change objects |
| Does this only change how a reviewed object set is operated? | derived ConfigHub variant | target, environment, region, labels, gates, observation policy, links, allowed placeholder fills |
| Is this required before Kubernetes or GitOps can use the artifact? | delivery prerequisite or receipt | existing Secret, StorageClass, IngressClass, CRD owner, GitOps pull secret, OCI digest/signature, hook/lifecycle decision |

Examples:

| Customization | Route |
| --- | --- |
| Helm values file that changes replicas, storage, ingress, CRDs, RBAC, args, env, or object count | new `cub installer` base / rendered revision |
| Kustomize overlay that changes the install shape | explicit recipe/base overlay with digest and diff |
| Namespace, target, labels, approval gates, observation policy | ConfigHub variant |
| Existing Secret reference already represented in the rendered objects | ConfigHub variant with target fact/check |
| Wrapper chart plus platform values plus customer overlay values | managed overlay import; usually needs ConfigHub Server |

For the detailed algorithm, see
[Customization Algorithm](./docs/user/customization-algorithm.md). For the product
tier boundaries, see
[Product Support Tiers For Helm Scenarios](./docs/user/product-support-tiers.md).
For the simple variant creation guide, see
[Creating Variants](./docs/user/creating-variants.md).
For wrapper charts and customer overlays, see
[Custom Overlays](./docs/user/custom-overlays.md).
For the OCI delivery boundary, see
[Choosing Base Variants, Derived Variants, And Delivery Changes](./docs/user/change-routing-before-oci.md).
For Helm hooks specifically, see
[Hook Lifecycle Strategy](./docs/user/hook-lifecycle-strategy.md).

## What Is Proven Today

> **What a full test run verifies — and what you can expect to be true:** see
> [`docs/reference/verification-properties.md`](docs/reference/verification-properties.md) for the
> acceptance contract — the verified properties, current coverage, and the
> honest limitations.

```text
20 popular Helm charts have catalog entries.
20/20 have passing local kind live/e2e receipts.
20/20 have ConfigHub upload, scan, and safe-ops proof receipts.
100 charts have recipe/package proof artifacts.
Top-500 source/catalog analysis exists as catalog-planning data for future
recipe promotion work.
```

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
and exercised outside the pure local `npm run verify` corpus. See "Additional
Options For Live Cluster Verification" below for the runtime proof path.

Start here:

```text
CATALOG.md
  The top-level chart catalog: charts first, variants underneath.

site/index.html
  Generated static catalog view for a lightweight website slice.

docs/README.md
  The documentation map: what each doc family is for.

data/live-e2e/summary.md
  The top-20 live-test status table.

data/production-disposition/summary.md
  What still has to be resolved before each chart can be production-promoted.

data/latest-top20-refresh/summary.md
  Which supported top-20 charts are current and which need new proof paths.
```

## Pick Your Path

```text
I want to check the repo quickly.
  Run Quick Verify.

I want to see what charts and variants exist.
  Open CATALOG.md.

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

That checks recipe/package structure, Helm equivalence, rendered object
digests, receipts, catalog status, target facts, local live/e2e receipts,
production disposition, and top-500 analysis.

Some chart-specific package-equivalence diagnostics are currently still red
because they expose declared hard gaps in the top-100 data. The test-script map
lists those commands and explains how to read them.

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

After `cub installer setup`, check the rendered objects:

```sh
npm run verify-install:render -- \
  --chart bitnami/redis/25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --namespace redis
```

Expected result:

```text
PASS verify-install:render bitnami/redis/25.5.3 default
semantic object matches: 14/14
```

After `kubectl apply`, check the live cluster:

```sh
npm run verify-install:cluster -- \
  --chart bitnami/redis/25.5.3 \
  --base default \
  --context <your-kubectl-context> \
  --namespace redis
```

Expected result:

```text
PASS verify-install:cluster bitnami/redis/25.5.3 default
checks: statefulsets, PVCs, Redis PING
```

After `cub installer upload`, check the ConfigHub Units and labels:

```sh
npm run verify-install:confighub -- \
  --chart bitnami/redis/25.5.3 \
  --base default \
  --space <your-space>
```

Expected result:

```text
PASS verify-install:confighub bitnami/redis/25.5.3 default
units: 15
variant-labeled units: 14
```

Each command writes a receipt under `.tmp/verify-install/`. That receipt is the
user-side proof: what you rendered, what namespace/context you checked, what
matched, and which checks passed. Today these checks ship for Redis only. Other
charts should follow the same pattern as `install-checks.yaml` lands per chart.

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
npm run verify-install:render -- --chart bitnami/redis/25.5.3 --base default --work-dir .tmp/demo/redis-default --namespace redis
npm run verify-install:confighub -- --chart bitnami/redis/25.5.3 --base default --space <your-space>
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
The Argo CD / Flux OCI path is the intended delivery path and is verified in a
separate live lane because it needs a running GitOps controller and cluster.

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

The built-in `verify-install:cluster` command is intentionally small. It proves
the Redis happy path with rollout, PVC, Secret, and Redis PING checks.

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

ConfigHub gives you named variants,
exact rendered objects,
checks,
receipts,
and a safer path from test to production.
```

Helm gives you charts. ConfigHub gives you managed, reviewable, scannable,
promotable variants from those charts.
