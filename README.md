# ConfigHub Helm Installer Demo

This README is current-state only. Every demo step below uses real `cub`,
real `cub install` from [confighub/installer](https://github.com/confighub/installer),
and the real ConfigHub service.

Default ConfigHub org:

```text
ConfigHub Helm
```

Do not use `ConfighubOps` for this work.

## What This Demo Shows

Today, with existing `cub`, `confighub/installer`, and ConfigHub, this repo
demonstrates:

- Install the ConfigHub installer plugin so `cub install` is available.
- Inspect a Redis installer package generated from Helm-rendered Redis YAML.
- Render that package locally into exact Kubernetes objects.
- Keep Secrets out of uploaded manifest Units.
- Upload the rendered Redis objects into ConfigHub with `cub install upload`.
- Review the created Units, revisions, and diffs in ConfigHub.

The Redis package used here is:

```text
archive/render-and-vendor-top20/charts/06-bitnami-redis
```

The older direct Helm-to-ConfigHub model is documented separately in
[docs/old-cub-helm-model.md](docs/old-cub-helm-model.md).

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

Optional repo integrity check:

```sh
npm run verify
```

That command verifies the archived top-20 render-and-vendor receipts. It is not
part of the ConfigHub upload flow.

## CLI Demo

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

## Helm Comparison

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

## ConfigHub Demo

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

## Supporting Files

Top-500 source scan:

```text
outputs/helm_top500_matrix/helm_top500_import_feature_matrix.xlsx
outputs/helm_top500_matrix/helm_top500_import_feature_matrix.raw.json
```

Archived top-20 render-and-vendor artifacts:

```text
archive/render-and-vendor-top20/charts/
```

Background notes:

```text
docs/
```
