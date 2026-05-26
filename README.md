# ConfigHub Helm Installer Demo

## Why This Exists

Helm is great at producing Kubernetes objects. It is not a durable operating
record of what was approved, changed, scanned, promoted, applied, and observed.

ConfigHub's Helm mission is:

```text
Use Helm charts.
Ship ConfigHub variants.
Never have Helm pain again.
```

Phase 1 scope:

```text
Public Helm chart catalog proof.
Not enterprise Helm archaeology.
```

Lead with the immediate value:

```text
Approve the Kubernetes objects Helm produced,
not the values you hope produced them.
```

Treat "Never have Helm pain again" as the ambition. The proof claim starts
smaller and sharper: ConfigHub shows the exact objects, differences, checks,
and proof before publish.

The product promise is:

```text
correct variants
safe operations
immediate proof
```

The missing object is:

```text
managed variant + known operation + proof
```

Helm owns chart rendering. Git owns files. Argo CD and Flux own sync.
Kubernetes owns live objects. Scanners own findings. CI owns logs. None of them
owns this complete record:

```text
this variant revision was approved,
this exact object set was scanned,
this exact revision was applied,
this target observed it fresh,
this rollback, promotion, or upgrade happened with proof.
```

ConfigHub is the missing operational record around Helm output. The goal is not
"better Helm values". The goal is exact, reviewable, scannable, promotable
variant revisions with receipts.

```text
Chart -> Recipe -> Variant -> VariantRevision -> Deployment -> Receipt
```

Default rule:

```text
1 Helm chart version -> 1 core recipe -> N variants -> M variant revisions
```

The model is complex. The intended product UX is short:

```text
install
review/plan
publish
```

Above all, the proof must show that this is simpler than living in Helm
directly. A user should get immediate value before they understand the full
model:

```text
one simple install command
one clear diff/review path
one safe publish/promote path
automatic receipts, scans, gates, and rendered-object proof in the background
```

If the demo feels like "Helm plus homework", the plan has failed.

Harder than Helm, riskier than Helm, or less correct than Helm are all product
failures. The first experience must feel:

```text
easier: fewer decisions before a useful result
safer: exact objects, scans, gates, and rollback/promote proof
more correct: Helm-equivalent when expected, with every difference explained
```

## Current Pathway Boundary

Default ConfigHub org:

```text
ConfigHub Helm
```

Do not use `ConfighubOps` for this work.

This README describes the current mission and proof plan. The current main
pathway is:

```text
new chart proof repos
  -> new HelmPlan / ChartDossier / recipe artifacts
  -> new variants and variant revisions
  -> new rendered-object scans, gates, OCI artifact receipts
  -> new generated spreadsheets as evidence maps
```

The fast install story for this project uses ConfigHub's OCI endpoint. The
public catalog/proof surface is the ConfigHub GitHub repo for this work,
currently `confighub/helm-expt`. A fully serverless `cub install` path is a
deferred option and is not part of this executable demo.

## Legacy Reference Only

The old render-and-vendor material has been deliberately archived:

```text
archive/render-and-vendor-top20/
outputs/helm_top500_matrix/
```

Those files are reference evidence only. They should not be reviewed as the
main pathway for this plan.

The archived material can still show that:

- rendered Helm YAML can be wrapped by `confighub/installer`
- `cub install setup` can preserve a Helm-rendered object set
- `cub install upload` can create ConfigHub Units from that output
- the old source-feature spreadsheet helped design the control-point taxonomy

But the current plan must be judged against new chart repos, new recipes, new
variants, new receipts, and new generated proof spreadsheets.

Planning/backlog sync:

```text
docs/issue-backlog.md
```

Open P0 issues in that file are gates before credible 20/100/500 chart proof.

## Current CLI Boundary

As of May 26, 2026, the real `cub install` surface is the
`confighub/installer` plugin. Commands relevant to this proof include:

```text
cub install doc
cub install pull
cub install setup
cub install render
cub install upload
cub install plan
cub install package
cub install push
cub install inspect
cub install list
cub install sign
cub install verify
cub install vet
cub install wizard
```

The upstream installer docs usually show the standalone binary name
`installer`. In this repo, the same command surface is invoked through the Cub
plugin as `cub install`.

The plugin also exposes package-authoring and registry helper commands such as
`init`, `new`, `edit`, `deps`, `login`, `logout`, `tag`, and `transformer`.
`preflight` appears in help as not yet implemented, so do not use it in proof
docs until it ships.

Do not present shorthand such as `cub install redis`, `cub diff redis`,
`cub publish redis`, or `cub variant redis ha` as current executable commands.
Those are candidate future porcelain verbs, not the current CLI. If we need
them to make the happy path obvious, propose them explicitly as Cub
plugins/extensions and keep executable docs on real commands until they ship.

## Planned Proof Files

New proof work should produce files such as:

```text
recipes/bitnami/redis/25.5.3/
packages/bitnami/redis/25.5.3/
data/adversarial10/
data/top500/
schemas/
runs/
```

Legacy reference files remain here:

```text
archive/render-and-vendor-top20/charts/
outputs/helm_top500_matrix/
```

## Verification

The default verifier is now the artifact-chain verifier:

```sh
npm run verify
npm run redis:compare
npm run redis:verify-package
```

It checks the archived reference receipts against their referenced files, then
checks the current Redis proof artifacts, Helm-equivalence evidence, scan/gate
receipts, variant diff evidence, deterministic `cub install` packaging, and
negative golden self-tests.

The old hash-only archive check is still available for comparison:

```sh
npm run verify:legacy
```

## Redis Proof

The current executable proof is:

```text
recipes/bitnami/redis/25.5.3/
```

Five-minute demo artifacts:

```text
docs/demo/redis/demo-script.md
docs/demo/redis/cli-transcript.txt
docs/demo/redis/ux-acceptance.md
```

It contains Redis readiness cards for the `default` and
`reuse-existing-secret` variants, recipe/variant/revision artifacts, rendered
object inventories, Helm equivalence receipts, render receipts, scan receipts,
install gates, and a readable diff from `default` to
`reuse-existing-secret`.

Useful commands:

```sh
npm run redis:generate-proof
npm run redis:generate-package
npm run redis:verify-proof
npm run redis:verify-package
npm run redis:compare
```

`redis:verify-proof` is local and deterministic. `redis:verify-package`
rebuilds the Redis installer package twice, checks byte-identical package
output, and verifies both package bases through real `cub install setup`.
`redis:compare` re-renders Redis with Helm and `cub install setup` to prove the
Helm-equivalence claim.

What it proves today:

- `default`: Helm renders 14 Redis objects; `cub install setup` preserves all
  14 and adds only the Namespace support object while separating the rendered
  Secret.
- `reuse-existing-secret`: Helm renders 13 Redis objects; `cub install setup`
  preserves all 13 and adds only the Namespace support object.
- The variant diff is recomputed from the rendered objects: one Secret removed,
  two StatefulSets changed, one target Secret requirement added.
- The local scan warns and blocks production, so the proof stays honest rather
  than pretending the chart is production-ready.

Optional live local e2e:

```sh
npm run redis:local-e2e
npm run redis:verify-local-e2e
npm run redis:local-e2e:reuse-existing-secret
npm run redis:verify-local-e2e:reuse-existing-secret
```

This uses a dedicated kind cluster named `helm-expt-redis`, writes a local
observation receipt under `runs/redis-local-kind/`, and does not change the
production scan gate.

Default handoff is a pinned ConfigHub OCI artifact for GitOps consumption.
Direct apply is an alternate path, not the default proof story.

Optional OCI publication, when a registry endpoint and credentials are
available:

```sh
REDIS_INSTALLER_OCI_REF=oci://<registry>/<repo>:<tag> npm run redis:publish-package
```

Publication is not simulated. Without an explicit registry ref, the package
proof remains a local deterministic package and setup proof.

Current ConfigHub upload/OCI evidence:

```text
runs/redis-confighub/latest/upload-oci-receipt.yaml
```

In Kubara, the current Redis package has been uploaded to:

```text
helm-redis-default
helm-redis-reuse-existing-secret
```

The receipt verifies both spaces and confirms ConfigHub's hosted OCI endpoint
returns unit-level OCI manifests for representative Redis StatefulSet Units.

## Adversarial 10 Harness

The first scale-out harness is:

```text
data/adversarial10/
```

It uses 10 pinned public Helm charts, renders chart-default values twice with
real Helm, stores rendered object sets for successful attempts, records blocker
receipts for failures, and generates a proof-readiness CSV:

```text
data/adversarial10/corpus.yaml
data/adversarial10/corpus.lock.yaml
data/adversarial10/summary.md
data/adversarial10/proof-readiness.csv
data/adversarial10/charts/*/helm-plan.yaml
data/adversarial10/charts/*/render-receipt.yaml
data/adversarial10/charts/*/rendered/object-inventory.yaml
```

Useful commands:

```sh
npm run adversarial10:generate
npm run adversarial10:verify
npm run adversarial10:verify:self-test
```

This is not certification. It is the first generated evidence map showing where
public-chart Helm pain appears: nondeterministic renders, required values,
CRDs, hooks, capability branching, `lookup`, generated facts, `tpl`, raw
extension slots, RBAC, webhooks, APIService, stateful workloads, and PVCs.

Rows must trace to receipts and rendered object digests. Blocked or
nondeterministic rows are useful findings, not swept-away failures.

## Legacy Redis Reference

Detailed legacy commands are intentionally not the root README experience.
They are retained in [docs/old-cub-helm-model.md](docs/old-cub-helm-model.md)
for reference only.

Background notes:

```text
docs/
```
