# Operating configs with cub

Command recipes for verifying an install and for viewing, operating, and
delivering stored configurations, moved unchanged from the README so it stays a
short front door.

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
tests/npm-script-catalog.md
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

# Dry-run an apply when the Units are attached to a target.
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
GitOps/OCI live pass rows: 135/199
selected live Helm-vs-ConfigHub comparison: 135 pass, 53 watch, 10 blocked
two-cluster kind parity corpus: 121 pass, 10 watch, 47 blocked
two-cluster semantic parity: 153/178 pass, 16 defects
```

Use the generated summaries for exact chart/base status:
[Runtime/GitOps Wave](../../data/runtime-gitops/summary.md) and
[Live Helm-vs-ConfigHub Parity](../../data/live-helm-confighub-compare/summary.md).
For non-pass follow-up rows, use
[Live Parity Rerun Plan](../../data/live-parity-rerun-plan/summary.md).

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

For deeper runtime proof, use cub-scout v2.4.0 or newer and the
[cub-scout helm-expt example](https://github.com/confighub/cub-scout/tree/main/examples/helm-expt).
Release v2.4.0 is the first cub-scout release aimed directly at the Helm
catalog gap: proving that an install actually worked without requiring
ConfigHub-connected mode.

That example adds the cluster-side half of the proof:

```text
helm-expt proves:   Helm render == cub installer render
installer proves:   package/spec -> rendered objects -> ConfigHub Units/OCI
cub-scout proves:   rendered objects, prerequisites, workloads, extras, drift, and freshness in the live cluster
```

Useful cub-scout v2.4.0 checks include:

```sh
./cub-scout receipt verify --file "$MANIFESTS" --scope namespace/"$NS" \
  --format json --out "$RUN_DIR/cub-scout-object-set.receipt.json" \
  --fail-on any-non-pass
./cub-scout receipt verify --prerequisites "$PREREQS" --scope namespace/"$NS" \
  --out "$RUN_DIR/cub-scout-prerequisites.receipt.json" \
  --fail-on any-non-pass
./cub-scout receipt verify --file "$MANIFESTS" --scope namespace/"$NS" \
  --predicate workloads-converged --ttl 30m \
  --out "$RUN_DIR/cub-scout-workloads.receipt.json" \
  --fail-on any-non-pass
./cub-scout receipt verify --file "$MANIFESTS" --scope namespace/"$NS" \
  --no-extras --out "$RUN_DIR/cub-scout-closed-world.receipt.json"
./cub-scout compare three-way --scope namespace/"$NS" \
  --dry-from "$MANIFESTS" --fail-on warning
```

Use this when you want a stronger live-cluster claim than the local Redis
smoke check: object-set receipts, prerequisite receipts, workload convergence,
closed-world checks, standalone drift checks, source-truth checks, ownership
graphs, snapshots, and GitOps convergence evidence.

