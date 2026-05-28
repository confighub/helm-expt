# NGINX ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/nginx-confighub-proof/latest/confighub-proof-receipt.yaml
runs/nginx-confighub-proof/latest/function-scan-receipt.yaml
runs/nginx-confighub-proof/latest/safe-ops-receipt.yaml
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
`cub install compare`, `cub install scan`, `cub variant diff`, or
`cub catalog install`.

## 1. Package Explanation

Command:

```sh
cub install doc packages/bitnami/nginx/24.0.2 --json
```

Result:

```text
Package: bitnami-nginx
Bases:
  http-clusterip, default, 0 external requirements
  existing-tls-ingress, 2 external requirements
Collector:
  /bin/sh collector/target-facts.sh
```

The `http-clusterip` happy path needs no target facts. The
`existing-tls-ingress` variant keeps its TLS Secret requirements visible through
the executable package.

## 2. Setup And Render

Command:

```sh
PATH="$PATH:$(go env GOPATH)/bin" cub install setup \
  --pull packages/bitnami/nginx/24.0.2 \
  --base http-clusterip \
  --work-dir .tmp/confighub-proof/nginx-http-clusterip \
  --non-interactive \
  --namespace nginx
```

Result:

```text
Wizard wrote selection.yaml and inputs.yaml
Collector produced facts.yaml
Base: http-clusterip; components: []
Namespace: nginx
Rendered 6 manifest(s)
```

Collector facts:

```yaml
apiVersion: installer.confighub.com/v1alpha1
kind: Facts
metadata:
  name: bitnami-nginx-facts
spec:
  package: bitnami-nginx
  values:
    targetFactChecks:
      base: http-clusterip
      mode: not-required
      result: pass
    targetFacts:
      requiredSecrets: []
```

Re-render:

```sh
PATH="$PATH:$(go env GOPATH)/bin" cub install render \
  --work-dir .tmp/confighub-proof/nginx-http-clusterip
```

Result:

```text
Rendered 6 manifest(s)
Spec docs written to out/spec
```

## 3. Package And Vet

Package determinism:

```sh
cub install package packages/bitnami/nginx/24.0.2 \
  -o .tmp/confighub-proof/nginx-archives/nginx-a.tgz
cub install package packages/bitnami/nginx/24.0.2 \
  -o .tmp/confighub-proof/nginx-archives/nginx-b.tgz
```

Result:

```text
sha256:bd5cb61027cf975d700d8b0cb7aba4b1b64f076368bd087328385f31ffc0eefb
byte-identical across two local package bundles
```

Vet:

```sh
PATH="$PATH:$(go env GOPATH)/bin" cub install vet \
  --work-dir .tmp/confighub-proof/nginx-http-clusterip
```

Result:

```text
Package declares no validators (spec.validators is empty).
```

## 4. Plan And Upload

Before upload, `cub install plan` correctly fails because there is no upload
state yet:

```text
out/spec/upload.yaml not found
run cub installer upload --work-dir ... --space <slug> first
```

Upload:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub install upload \
  --work-dir .tmp/confighub-proof/nginx-http-clusterip \
  --space helm-nginx-confighub-proof \
  --component NGINX \
  --layer App \
  --environment Demo \
  --owner ConfigHubHelm \
  --variant http-clusterip \
  --unit-label Component=NGINX \
  --unit-label HelmChart=bitnami-nginx \
  --unit-label HelmChartVersion=24.0.2 \
  --unit-label Variant=http-clusterip \
  --unit-label Proof=nginx-confighub-proof
```

Result:

```text
Created 6 rendered NGINX Units
Created installer-record Unit
Inferred 9 links
No rendered Secret was separated or uploaded for this variant
```

Post-upload plan:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub install plan \
  --work-dir .tmp/confighub-proof/nginx-http-clusterip
```

Result:

```text
No changes.

Images in helm-nginx-confighub-proof:
  init Deployment/nginx [preserve-logs-symlinks] registry-1.docker.io/bitnami/nginx:latest
       Deployment/nginx [nginx] registry-1.docker.io/bitnami/nginx:latest
```

## 5. Server-Side Variant

Command:

```sh
cub variant create staging helm-nginx-confighub-proof \
  --environment Staging \
  --region local \
  --space-name-pattern 'template:{{.SourceEntitySlug}}-{{.Labels.Variant}}' \
  --wait \
  --timeout 2m
```

Result:

```text
Created variant space helm-nginx-confighub-proof-staging
Bulk create operation completed:
  Success: 7 unit(s)
```

## 6. Review And Diff

Unit inventory:

```sh
cub unit list --space helm-nginx-confighub-proof \
  --where "Labels.Proof = 'nginx-confighub-proof'" \
  --columns Slug,Labels.Component,Labels.HelmChartVersion,Labels.Variant,HeadRevisionNum,DataHash
```

Result:

```text
6 NGINX Kubernetes Units labeled Component=NGINX, HelmChartVersion=24.0.2, Variant=http-clusterip
```

The staging clone contains 7 Units, including `installer-record`.

Clone tree:

```sh
cub unit tree --space '*' \
  --edge clone \
  --where "Slug = 'deployment-nginx-nginx'" \
  --columns Space.Slug,Unit.Labels.Variant
```

Result:

```text
deployment-nginx-nginx in helm-nginx-confighub-proof
  -> deployment-nginx-nginx in helm-nginx-confighub-proof-staging
```

ConfigHub-side Unit data:

```sh
cub unit data deployment-nginx-nginx \
  --space helm-nginx-confighub-proof
```

Result:

```text
Returned the NGINX Deployment YAML from ConfigHub, including:
apiVersion: apps/v1
kind: Deployment
metadata.name: nginx
metadata.namespace: nginx
image: registry-1.docker.io/bitnami/nginx:latest
```

Revision history:

```sh
cub revision list deployment-nginx-nginx \
  --space helm-nginx-confighub-proof
```

Result:

```text
Revision 1: Initial Data from deployment-nginx-nginx.yaml
Revision 2: Self-Resolve / normalize
```

Unit revision diff:

```sh
cub unit diff deployment-nginx-nginx \
  --space helm-nginx-confighub-proof \
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

## 7. ConfigHub Function Scan

Commands:

```sh
cub function vet vet-format --space helm-nginx-confighub-proof \
  --where "Labels.Proof = 'nginx-confighub-proof'" --output json --wait
cub function vet vet-placeholders --space helm-nginx-confighub-proof \
  --where "Labels.Proof = 'nginx-confighub-proof'" --output json --wait
cub function vet vet-merge-keys --space helm-nginx-confighub-proof \
  --where "Labels.Proof = 'nginx-confighub-proof'" --output json --wait
```

Result:

```text
vet-format: 6 units, 0 failures
vet-placeholders: 6 units, 0 failures
vet-merge-keys: 6 units, 0 failures
```

## 8. Safe Operations

Create/update changeset:

```sh
cub changeset create nginx-safe-ops-20260527 \
  --space helm-nginx-confighub-proof \
  --description "NGINX ConfigHub proof safe operation lane" \
  --label Proof=nginx-confighub-proof \
  --label Lane=safe-ops \
  --allow-exists

cub changeset update nginx-safe-ops-20260527 \
  --space helm-nginx-confighub-proof \
  --description "NGINX safe-ops proof: approve reviewed revisions, dry-run apply only" \
  --annotation proof.confighub.com/scope=local-test \
  --annotation proof.confighub.com/live-apply=false
```

Approve a representative Unit:

```sh
cub unit approve deployment-nginx-nginx \
  --space helm-nginx-confighub-proof \
  --revision HeadRevisionNum \
  --verbose \
  --wait
```

Result:

```text
Unit deployment-nginx-nginx (...) has been approved
Awaiting triggers...
```

Attempt dry-run apply:

```sh
cub unit apply --space helm-nginx-confighub-proof \
  --where "Labels.Proof = 'nginx-confighub-proof'" \
  --dry-run \
  --wait \
  --timeout 2m
```

Result:

```text
Failed: cannot invoke action on a unit without a target
```

Cancel is safe:

```sh
cub unit cancel --space helm-nginx-confighub-proof \
  --where "Labels.Proof = 'nginx-confighub-proof'"
```

Result:

```text
No units found matching the filter
```

## Verdict

Current NGINX `http-clusterip` lane is credible:

```text
real package docs
real setup/render
real deterministic package
real vet path
real ConfigHub upload
real no-op plan
real server-side variant clone
real Unit data/revision/diff review
real ConfigHub function scan
real safe operation boundary
```

The next chart target should be Metrics Server. It is smaller than PostgreSQL
but exercises APIService and target-fact/capability behavior that NGINX does
not.
