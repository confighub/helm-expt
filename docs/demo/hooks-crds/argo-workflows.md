# Argo Workflows: install the right CRDs before the workloads

Argo Workflows is a useful example of work that Helm normally performs outside
the rendered release.

The chart's default configuration does not put its full Custom Resource
Definitions (CRDs) in the ordinary manifest output. During install and upgrade,
a Helm hook downloads eight CRD files from GitHub and applies them before the
controller and server start. The hook uses Kubernetes server-side apply with
forced conflict resolution because the full schemas are too large for the
client-side apply annotation.

That sequence works in Helm, but it creates three questions for any other
delivery path:

1. Which exact CRD files should be used?
2. Who applies or upgrades them before the workloads?
3. How can a reviewer check that the alternative path produced the same
   result?

## What the catalog package does

The `default` package base keeps the chart's normal full-CRD behavior without
requiring an install-time download from GitHub.

- The package contains the eight full CRD files used by
  `argo-workflows@1.0.14`.
- Each source URL and SHA-256 digest is recorded in the base variant.
- The generated no-account script applies the CRDs with
  `kubectl apply --server-side --force-conflicts` before it applies the
  controller and server objects.
- Running the same step before an upgrade refreshes the CRDs in the same phase
  as Helm's pre-upgrade hook.
- The script waits for every CRD to become established before it applies the
  workloads.

This is a chart-specific replacement for one Helm hook. It is not a claim that
one generic hook translator can safely handle every chart.

## Try the default path

Use a disposable Kubernetes cluster:

```sh
bash <(curl -fsSL \
  https://confighub.github.io/helm-expt/site/sh/argo-cd-argo-workflows-1-0-14/default/try.sh)
```

The script first writes the package and rendered objects under
`./argo-cd-argo-workflows-1-0-14-default`. Read those files before the first
`kubectl apply` step if you want to inspect exactly what will run.

The same package can be rendered without touching a cluster:

```sh
cub installer setup \
  --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/argo-cd-argo-workflows:1.0.14 \
  --base default \
  --work-dir ./argo-workflows-default \
  --non-interactive \
  --namespace default
```

The CRD bundle is in:

```text
./argo-workflows-default/package/prerequisites/target-facts/default-crds.yaml
```

The ordinary rendered objects are in:

```text
./argo-workflows-default/out/manifests/
```

## What was checked

The live comparison used two clean kind clusters.

- Normal Helm ran its real pre-install hook.
- The catalog package applied its locked CRD bundle before the ordinary
  rendered objects.
- All eight live CRD specifications had matching SHA-256 digests.
- The 19 ordinary chart objects matched semantically.
- The workflow controller and server became ready in both clusters.
- Both clusters were deleted after the run.

The receipt is
[`runs/live-kind-parity/argo-cd-argo-workflows-default/receipt.yaml`](../../../runs/live-kind-parity/argo-cd-argo-workflows-default/receipt.yaml).

## The smaller alternative

The `minimal-crds` base makes a different, explicit choice. It renders eight
smaller CRDs as ordinary Kubernetes objects and does not need the full-CRD
hook. Those CRDs preserve unknown fields instead of carrying the full OpenAPI
schemas.

Use that base when the smaller schema is acceptable and you want the CRDs to
travel with the ordinary rendered release:

```sh
bash <(curl -fsSL \
  https://confighub.github.io/helm-expt/site/sh/argo-cd-argo-workflows-1-0-14/minimal-crds/try.sh)
```

The minimal and full CRDs are not interchangeable proof. Choose the behavior
you want and keep that choice with the base variant.

## What remains

The direct package path is proven for a fresh install. It also contains the
same CRD action needed before an upgrade, but a cross-version upgrade has not
yet been tested.

Argo CD and Flux need their own ordering proof before this page can claim that
either controller runs the full-CRD action automatically. Until then, use the
generated direct script, make the CRDs a separately managed prerequisite, or
choose the `minimal-crds` base.

This evidence is not a production support statement. A production decision
still needs the target Kubernetes version, upgrade policy, CRD ownership, and
recovery procedure.
