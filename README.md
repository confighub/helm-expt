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

The model is complex. The UX must not be:

```sh
cub install redis
cub diff redis
cub apply redis
```

Above all, the proof must show that this is simpler than living in Helm
directly. A user should get immediate value before they understand the full
model:

```text
one simple install command
one clear diff/review path
one safe apply/promote path
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
  -> new rendered-object scans, gates, OCI/apply receipts
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

## Legacy Redis Reference

The commands below are retained only for reference. They are not the hero demo
and not the acceptance test for the current plan.

## Prerequisites

- `cub`
- `go`
- Access to the `ConfigHub Helm` org on `https://hub.confighub.com`

Install `kustomize` and make sure it is on `PATH`:

```sh
go install sigs.k8s.io/kustomize/kustomize/v5@v5.8.1
export PATH="$PATH:$(go env GOPATH)/bin"
kustomize version
```

Install the ConfigHub installer plugin as `cub install`:

```sh
cub plugin install confighub/installer --source-repo --name install --force
make -C ~/.confighub/plugins/install build
cub install --help
```

Some installer help text says `installer` because that is the plugin binary.
For this demo, invoke it through Cub as `cub install`.

Optional archive integrity check:

```sh
npm run verify
```

That command verifies the archived top-20 render-and-vendor receipts. It is not
part of the current recipe/variant proof pathway.

## Legacy CLI Reference

Set the package and work directory:

```sh
export REDIS_PACKAGE=./archive/render-and-vendor-top20/charts/06-bitnami-redis
export WORK_DIR=/tmp/confighub-helm-redis
```

Inspect the Redis installer package:

```sh
cub install doc "$REDIS_PACKAGE"
```

Render Redis locally:

```sh
rm -rf "$WORK_DIR"
cub install setup \
  --pull "$REDIS_PACKAGE" \
  --work-dir "$WORK_DIR" \
  --non-interactive \
  --namespace redis
```

Inspect the rendered objects:

```sh
find "$WORK_DIR/out/manifests" -maxdepth 1 -type f | sort
find "$WORK_DIR/out/secrets" -maxdepth 1 -type f | sort
sed -n '1,120p' "$WORK_DIR/out/spec/manifest-index.yaml"
```

Expected result:

```text
Rendered 14 manifest(s) to /tmp/confighub-helm-redis/out/manifests
Rendered 1 secret(s) to /tmp/confighub-helm-redis/out/secrets (not uploaded)
```

## Legacy Helm Comparison

Check the Redis Helm render against the Redis installer render:

```sh
npm run redis:compare
```

That command does not upload anything. It checks:

- a fresh Helm render of Redis 25.5.3 byte-matches the archived Helm render
  recorded in `helm-import.receipt.yaml`
- `cub install setup` preserves the full Helm object set
- every Helm object is semantically identical after `cub install` splits and
  normalizes YAML
- `cub install setup` separates the Secret into `out/secrets`
- the only extra object from `cub install setup` is the explicit `redis`
  Namespace support object

## Legacy ConfigHub Upload Reference

Log in to the demo org:

```sh
cub auth login \
  --server https://hub.confighub.com \
  --organization "ConfigHub Helm"
```

Upload the rendered Redis objects to ConfigHub:

```sh
cub install upload \
  --work-dir "$WORK_DIR" \
  --space helm-redis-proof \
  --component Redis \
  --environment Demo \
  --variant default
```

The upload creates the `helm-redis-proof` Space if needed. It creates one Unit
per rendered manifest and an installer-record Unit for later reconcile.

List the uploaded Units:

```sh
cub unit list --space helm-redis-proof
```

Open ConfigHub:

```text
https://hub.confighub.com
```

In the UI:

1. Switch to the `ConfigHub Helm` org.
2. Open the `helm-redis-proof` Space.
3. Review the Redis Units created by `cub install upload`.
4. Use Unit revisions and diffs to inspect exactly what changed.

After the first upload, `cub install plan` is read-only and shows what a later
reconcile would change:

```sh
cub install plan --work-dir "$WORK_DIR"
```

## Planned Proof Files

New proof work should produce files such as:

```text
recipes/bitnami/redis/25.5.3/
data/top500/
schemas/
runs/
```

Legacy reference files remain here:

```text
archive/render-and-vendor-top20/charts/
outputs/helm_top500_matrix/
```

Background notes:

```text
docs/
```
