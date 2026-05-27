# Redis Use-More-Now Transcript

Run date: 2026-05-27

Receipt:

```text
runs/redis-use-more-now/latest/use-more-now-receipt.yaml
```

ConfigHub context:

```text
Organization: Kubara
Server: https://hub.confighub.com
Client: dev
Server version: v0.1.49
```

This transcript uses current commands only. It does not use proposed future
porcelain such as `cub install import helm`, `cub install analyze`,
`cub install compare`, `cub variant diff`, or `cub catalog install`.

## 1. Package Explanation

Command:

```sh
cub install doc packages/bitnami/redis/25.5.3 --json
```

Result:

```text
Package: bitnami-redis
Bases:
  default
  reuse-existing-secret
Collector:
  /bin/sh collector/target-facts.sh
Target-fact requirement:
  reuse-existing-secret requires ClusterFeature:
  Secret redis/redis-existing-secret key redis-password
```

This proves the Redis target fact is visible through the executable installer
package, not only through docs.

## 2. Setup And Render

Initial setup failed because local `kustomize` was installed in Go's bin
directory but was not on the shell PATH:

```text
Error: kustomize build ... exec: "kustomize": executable file not found in $PATH
```

Rerun with Go bin on PATH:

```sh
PATH="$PATH:$(go env GOPATH)/bin" cub install setup \
  --pull packages/bitnami/redis/25.5.3 \
  --base default \
  --work-dir .tmp/use-more-now/redis-default \
  --non-interactive \
  --namespace redis
```

Result:

```text
Wizard wrote selection.yaml and inputs.yaml
Collector produced facts.yaml
Base: default; components: []
Namespace: redis
Rendered 14 manifest(s)
Rendered 1 secret(s) to out/secrets (not uploaded)
```

Collector facts:

```yaml
apiVersion: installer.confighub.com/v1alpha1
kind: Facts
metadata:
  name: bitnami-redis-facts
spec:
  package: bitnami-redis
  values:
    targetFactChecks:
      base: default
      mode: not-required
      result: pass
    targetFacts:
      requiredSecrets: []
```

Re-render:

```sh
PATH="$PATH:$(go env GOPATH)/bin" cub install render \
  --work-dir .tmp/use-more-now/redis-default
```

Result:

```text
Rendered 14 manifest(s)
Rendered 1 secret(s) to out/secrets (not uploaded)
Spec docs written to out/spec
```

## 3. Package And Vet

Package determinism:

```sh
cub install package packages/bitnami/redis/25.5.3 \
  -o .tmp/use-more-now/archives/redis-a.tgz
cub install package packages/bitnami/redis/25.5.3 \
  -o .tmp/use-more-now/archives/redis-b.tgz
```

Result:

```text
sha256:33d75e4443ef0ca2d42d79049074f89e25de740bdc677f2451010024ab035550
byte-identical across two local package bundles
```

Vet:

```sh
PATH="$PATH:$(go env GOPATH)/bin" cub install vet \
  --work-dir .tmp/use-more-now/redis-default
```

Result:

```text
Package declares no validators (spec.validators is empty).
```

This is a successful current-state result: the command path works, and the
package has no validators yet. Adding validators is a separate package-quality
improvement.

## 4. Plan And Upload

Before upload, `cub install plan` correctly fails because there is no upload
state yet:

```text
out/spec/upload.yaml not found
run cub installer upload --work-dir ... --space <slug> first
```

First upload without an explicit `CUB_CONFIG` hit the known nested-`cub` local
config issue:

```text
Failed: read /Users/alexis/.confighub: is a directory
```

Rerun with the explicit config file:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub install upload \
  --work-dir .tmp/use-more-now/redis-default \
  --space helm-redis-use-more-now \
  --component Redis \
  --layer App \
  --environment Demo \
  --owner ConfigHubHelm \
  --variant default \
  --unit-label Component=Redis \
  --unit-label HelmChart=bitnami-redis \
  --unit-label HelmChartVersion=25.5.3 \
  --unit-label Variant=default \
  --unit-label Proof=redis-use-more-now
```

Result:

```text
Created 14 rendered Redis Units
Created namespace-redis support Unit
Created installer-record Unit
Inferred 31 links
1 rendered Secret was not uploaded to ConfigHub
```

The Secret handling is intentional:

```text
v1/Secret "redis/redis" rendered to out/secrets/secret-redis-redis.yaml
not uploaded to ConfigHub
```

Post-upload plan:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub install plan \
  --work-dir .tmp/use-more-now/redis-default
```

Result:

```text
No changes.

Images in helm-redis-use-more-now:
  StatefulSet/redis-master [redis] registry-1.docker.io/bitnami/redis:latest
  StatefulSet/redis-replicas [redis] registry-1.docker.io/bitnami/redis:latest
```

## 5. Server-Side Variant

Command:

```sh
cub variant create staging helm-redis-use-more-now \
  --environment Staging \
  --region local \
  --space-name-pattern 'template:{{.SourceEntitySlug}}-{{.Labels.Variant}}' \
  --wait \
  --timeout 2m
```

Result:

```text
Created variant space helm-redis-use-more-now-staging
Bulk create operation completed:
  Success: 15 unit(s)
```

Space labels:

```text
helm-redis-use-more-now:
  Component=Redis
  Environment=Demo
  Layer=App
  Owner=ConfigHubHelm
  Variant=default

helm-redis-use-more-now-staging:
  Component=Redis
  Environment=Staging
  Layer=App
  Owner=ConfigHubHelm
  Region=local
  Variant=staging
```

This proves the intended split:

```text
Recipe/package variants handle render-time object-set choices.
cub variant create handles post-upload server-side cloning for environment,
region, target, metadata, gates, and similar operational variation.
```

## 6. Review And Diff

Unit inventory:

```sh
cub unit list --space helm-redis-use-more-now \
  --where "Labels.Proof = 'redis-use-more-now'" \
  --columns Unit.Slug,Unit.Labels.Component,Unit.Labels.HelmChartVersion,Unit.Labels.Variant
```

Result:

```text
14 Redis Kubernetes Units labeled Component=Redis, HelmChartVersion=25.5.3, Variant=default
```

The staging clone contains 15 Units, including `installer-record`.

Clone tree:

```sh
cub unit tree --space '*' \
  --edge clone \
  --where "Slug = 'statefulset-redis-redis-master'" \
  --columns Space.Slug,Unit.Labels.Variant
```

Result:

```text
statefulset-redis-redis-master in helm-redis-use-more-now
  -> statefulset-redis-redis-master in helm-redis-use-more-now-staging
```

ConfigHub-side Unit data:

```sh
cub unit data statefulset-redis-redis-master \
  --space helm-redis-use-more-now
```

Result:

```text
Returned the Redis StatefulSet YAML from ConfigHub, including:
apiVersion: apps/v1
kind: StatefulSet
metadata.name: redis-master
metadata.namespace: redis
image: registry-1.docker.io/bitnami/redis:latest
```

Revision history:

```sh
cub revision list statefulset-redis-redis-master \
  --space helm-redis-use-more-now
```

Result:

```text
Revision 1: Initial Data from statefulset-redis-redis-master.yaml
Revision 2: Self-Resolve / normalize
```

Unit revision diff:

```sh
cub unit diff statefulset-redis-redis-master \
  --space helm-redis-use-more-now \
  --from 1 \
  --to 2 \
  -u
```

Result:

```text
Diff shows ConfigHub normalization, including:
metadata.annotations.confighub.com/ResourceMergeID
YAML list formatting normalization
```

The current `cub unit diff` path is useful for Unit revision history. A richer
`cub variant diff` remains a Brian/product ask for explaining differences
between server-side variants directly.

## Observed Friction

These are not hidden:

1. `kustomize` must be on PATH for local `cub install setup/render`. In this
   run, adding `$(go env GOPATH)/bin` fixed it.
2. `cub install upload` still needs
   `CUB_CONFIG=/Users/alexis/.confighub/config.yaml` in this local setup so
   installer-spawned `cub` commands do not try to read `/Users/alexis/.confighub`
   as a file.
3. Broad link-tree output for the whole Redis space was slow enough to stop;
   clone tree, unit list, unit data, revision list, and unit diff worked.

## Verdict

Current Redis "use more now" lane is credible:

```text
real package docs
real setup/render
real deterministic package
real vet path
real ConfigHub upload
real no-op plan
real server-side variant clone
real Unit data/revision/diff review
```

The next product gap is not proof. It is UX polish: package import/analyze,
preflight, compare/prove, scan, variant diff/promote, observe, and catalog
porcelain.
