# Check an Existing Helm Release

Use this guide when a Helm release is stuck, an upgrade is risky, or you need to
know what Helm recorded before you move the configuration into ConfigHub.

The commands below only read the release and cluster. They write the result to
your machine. Review the files before sharing them because Helm values and
release records can contain credentials.

## Capture Helm's Record

Set the release name and namespace, then run the commands.

```sh
release=my-release
namespace=my-namespace
output=./helm-release-check

mkdir -p "$output"
helm status "$release" -n "$namespace" -o yaml > "$output/status.yaml"
helm get values "$release" -n "$namespace" -a -o yaml > "$output/values-all.yaml"
helm get manifest "$release" -n "$namespace" > "$output/manifest.yaml"
helm get hooks "$release" -n "$namespace" > "$output/hooks.yaml"
helm history "$release" -n "$namespace" -o yaml > "$output/history.yaml"
kubectl get secret -n "$namespace" \
  -l "owner=helm,name=$release" -o json > "$output/storage-secrets.json"
```

Read these files in this order:

1. `status.yaml` shows whether Helm considers the release deployed, failed,
   pending, or superseded.
2. `history.yaml` shows the revisions Helm knows about and which revision a
   rollback would select.
3. `values-all.yaml` shows the effective values Helm recorded, including
   defaults. Treat it as sensitive.
4. `manifest.yaml` is the ordinary Kubernetes object set Helm recorded for the
   current revision.
5. `hooks.yaml` shows install, upgrade, rollback, or test work that is separate
   from the ordinary object set.
6. `storage-secrets.json` shows the release records stored in the namespace.
   Large records can approach the Kubernetes Secret size limit.

## Compare the Next Version

Render the candidate with the same release name, namespace, and values. Pin the
chart version. Add any API-version or Kubernetes-version flags that matter to
this chart.

```sh
chart=repo/chart
new_version=1.2.3

helm template "$release" "$chart" \
  --namespace "$namespace" \
  --version "$new_version" \
  -f "$output/values-all.yaml" \
  > "$output/candidate-manifest.yaml"

diff -u "$output/manifest.yaml" "$output/candidate-manifest.yaml" || true
```

Check the diff for removed or renamed objects, selector changes, immutable
fields, storage changes, new CRDs, and changed hooks. Do not assume
`--reuse-values` is safe: values retained from an older release may no longer
match the new chart's schema or defaults.

## What the Files Can Tell You

This capture answers three useful questions:

- What release state and revision history did Helm record?
- Which values, ordinary objects, and hooks produced the current Helm record?
- What would change if the candidate chart were rendered with the same context?

The files do not prove that the live cluster still matches Helm's record. They
also do not prove that admission webhooks will accept the candidate, that a hook
will succeed, or that a rollback can reverse a database or storage migration.
Compare live objects and workload health separately before changing production.

## Moving the Result into ConfigHub

Use the captured Helm record as evidence, not as an automatic new source of
truth. First decide whether the ConfigHub base should match the existing release
exactly or contain an intended correction. Save that decision with the chart
source, values, release context, rendered objects, hooks, prerequisites, and
receipts.

The [Ask page](../../site/ask.html) builds a local diagnostic prompt around the
same facts. The [existing application guide](./adopting-existing-apps.md)
explains how to record the reviewed result without changing delivery first.
