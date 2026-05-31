# PostgreSQL ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/postgresql-confighub-proof/latest/confighub-proof-receipt.yaml
runs/postgresql-confighub-proof/latest/function-scan-receipt.yaml
runs/postgresql-confighub-proof/latest/safe-ops-receipt.yaml
```

ConfigHub context:

```text
Organization: Kubara
Server: https://hub.confighub.com
Client: dev
Server version: v0.1.49
```

This transcript uses current commands only. It does not use proposed future
porcelain such as `cub installer import helm`, `cub installer analyze`,
`cub installer compare`, `cub installer scan`, `cub variant diff`, or
`cub catalog install`.

## 1. Package Explanation

Command:

```sh
cub installer doc packages/bitnami/postgresql/18.6.7 --json
```

Result:

```text
Package: bitnami-postgresql
Bases:
  generated-passwords, default, 0 external requirements
  existing-secret, 1 external requirement
Collector:
  /bin/sh collector/target-facts.sh
```

The `generated-passwords` happy path needs no target facts. The
`existing-secret` variant keeps its Secret requirement visible through the
executable package:

```text
Secret postgresql/postgresql-auth key postgres-password
```

## 2. Setup And Render

Command:

```sh
PATH="$PATH:$(go env GOPATH)/bin" cub installer setup \
  --pull packages/bitnami/postgresql/18.6.7 \
  --base generated-passwords \
  --work-dir .tmp/confighub-proof/postgresql-generated-passwords \
  --non-interactive \
  --namespace postgresql
```

Result:

```text
Wizard wrote selection.yaml and inputs.yaml
Collector produced facts.yaml
Base: generated-passwords; components: []
Namespace: postgresql
Rendered 7 manifest(s)
Rendered 1 secret(s) to out/secrets (not uploaded)
```

Collector facts:

```yaml
apiVersion: installer.confighub.com/v1alpha1
kind: Facts
metadata:
  name: bitnami-postgresql-facts
spec:
  package: bitnami-postgresql
  values:
    targetFactChecks:
      base: generated-passwords
      mode: not-required
      result: pass
    targetFacts:
      requiredSecrets: []
```

Re-render:

```sh
PATH="$PATH:$(go env GOPATH)/bin" cub installer render \
  --work-dir .tmp/confighub-proof/postgresql-generated-passwords
```

Result:

```text
Rendered 7 manifest(s)
Rendered 1 secret(s) to out/secrets (not uploaded)
Spec docs written to out/spec
```

Rendered object shape:

```text
Namespace support object
NetworkPolicy
PodDisruptionBudget
Services
ServiceAccount
StatefulSet
Separated Secret
```

## 3. Package And Vet

Package determinism:

```sh
cub installer package packages/bitnami/postgresql/18.6.7 \
  -o .tmp/confighub-proof/postgresql-archives/postgresql-a.tgz
cub installer package packages/bitnami/postgresql/18.6.7 \
  -o .tmp/confighub-proof/postgresql-archives/postgresql-b.tgz
```

Result:

```text
sha256:75a3049026248392bc194051e2cb57d01d67cb4eb7c586b597762c60049cf18a
byte-identical across two local package bundles
```

Vet:

```sh
PATH="$PATH:$(go env GOPATH)/bin" cub installer vet \
  --work-dir .tmp/confighub-proof/postgresql-generated-passwords
```

Result:

```text
Package declares no validators (spec.validators is empty).
```

## 4. Plan And Upload

Before upload, `cub installer plan` correctly fails because there is no upload
state yet:

```text
out/spec/upload.yaml not found
run cub installer upload --work-dir ... --space <slug> first
```

Upload:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub installer upload \
  --work-dir .tmp/confighub-proof/postgresql-generated-passwords \
  --space helm-postgresql-confighub-proof \
  --component PostgreSQL \
  --layer Data \
  --environment Demo \
  --owner ConfigHubHelm \
  --variant generated-passwords \
  --unit-label Component=PostgreSQL \
  --unit-label HelmChart=bitnami-postgresql \
  --unit-label HelmChartVersion=18.6.7 \
  --unit-label Variant=generated-passwords \
  --unit-label Proof=postgresql-confighub-proof
```

Result:

```text
Created 7 rendered PostgreSQL Units
Created installer-record Unit
Inferred 12 links
1 rendered Secret was not uploaded to ConfigHub
```

Separated Secret:

```text
v1/Secret "postgresql/postgresql" (secret-postgresql-postgresql.yaml)
```

Post-upload plan:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub installer plan \
  --work-dir .tmp/confighub-proof/postgresql-generated-passwords
```

Result:

```text
No changes.

Images in helm-postgresql-confighub-proof:
  StatefulSet/postgresql [postgresql] registry-1.docker.io/bitnami/postgresql:latest
```

## 5. Server-Side Variant

Command:

```sh
cub variant create staging helm-postgresql-confighub-proof \
  --environment Staging \
  --region local \
  --space-name-pattern 'template:{{.Labels.Component}}-{{.Labels.Variant}}' \
  --wait \
  --timeout 2m
```

Result:

```text
Created variant space helm-postgresql-confighub-proof-staging
Bulk create operation completed:
  Success: 8 unit(s)
```

## 6. Review And Diff

Unit inventory:

```sh
cub unit list --space helm-postgresql-confighub-proof \
  --where "Labels.Proof = 'postgresql-confighub-proof'" \
  --columns Slug,Labels.Component,Labels.HelmChartVersion,Labels.Variant,HeadRevisionNum,DataHash
```

Result:

```text
7 PostgreSQL Kubernetes Units labeled Component=PostgreSQL, HelmChartVersion=18.6.7, Variant=generated-passwords
```

The staging clone contains 8 Units, including `installer-record`.

Clone tree:

```sh
cub unit tree --space '*' \
  --edge clone \
  --where "Slug = 'statefulset-postgresql-postgresql'" \
  --columns Space.Slug,Unit.Labels.Variant
```

Result:

```text
statefulset-postgresql-postgresql in helm-postgresql-confighub-proof
  -> statefulset-postgresql-postgresql in helm-postgresql-confighub-proof-staging
```

ConfigHub-side StatefulSet data:

```sh
cub unit data statefulset-postgresql-postgresql \
  --space helm-postgresql-confighub-proof
```

Result:

```text
Returned the PostgreSQL StatefulSet YAML from ConfigHub, including:
apiVersion: apps/v1
kind: StatefulSet
metadata.name: postgresql
metadata.namespace: postgresql
image: registry-1.docker.io/bitnami/postgresql:latest
POSTGRES_PASSWORD_FILE: /opt/bitnami/postgresql/secrets/postgres-password
```

Revision history:

```sh
cub revision list statefulset-postgresql-postgresql \
  --space helm-postgresql-confighub-proof
```

Result:

```text
Revision 1: Initial Data from statefulset-postgresql-postgresql.yaml
Revision 2: Self-Resolve / normalize
```

Unit revision diff:

```sh
cub unit diff statefulset-postgresql-postgresql \
  --space helm-postgresql-confighub-proof \
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
cub function vet vet-format --space helm-postgresql-confighub-proof \
  --where "Labels.Proof = 'postgresql-confighub-proof'" --output json --wait
cub function vet vet-placeholders --space helm-postgresql-confighub-proof \
  --where "Labels.Proof = 'postgresql-confighub-proof'" --output json --wait
cub function vet vet-merge-keys --space helm-postgresql-confighub-proof \
  --where "Labels.Proof = 'postgresql-confighub-proof'" --output json --wait
```

Result:

```text
vet-format: 7 units, 0 failures
vet-placeholders: 7 units, 0 failures
vet-merge-keys: 7 units, 0 failures
```

## 8. Safe Operations

Create/update changeset:

```sh
cub changeset create postgresql-safe-ops-20260527 \
  --space helm-postgresql-confighub-proof \
  --description "PostgreSQL ConfigHub proof safe operation lane" \
  --label Proof=postgresql-confighub-proof \
  --label Lane=safe-ops \
  --allow-exists

cub changeset update postgresql-safe-ops-20260527 \
  --space helm-postgresql-confighub-proof \
  --description "PostgreSQL safe-ops proof: approve reviewed revisions, dry-run apply only" \
  --annotation proof.confighub.com/scope=local-test \
  --annotation proof.confighub.com/live-apply=false
```

Approve a representative StatefulSet Unit:

```sh
cub unit approve statefulset-postgresql-postgresql \
  --space helm-postgresql-confighub-proof \
  --revision HeadRevisionNum \
  --verbose \
  --wait
```

Result:

```text
Unit statefulset-postgresql-postgresql (...) has been approved
Awaiting triggers...
```

Attempt dry-run apply:

```sh
cub unit apply --space helm-postgresql-confighub-proof \
  --where "Labels.Proof = 'postgresql-confighub-proof'" \
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
cub unit cancel --space helm-postgresql-confighub-proof \
  --where "Labels.Proof = 'postgresql-confighub-proof'"
```

Result:

```text
No units found matching the filter
```

## Verdict

Current PostgreSQL `generated-passwords` lane is credible:

```text
real package docs
real setup/render
real deterministic package
real vet path
real ConfigHub upload
real no-op plan
real server-side variant clone
real StatefulSet data/revision/diff review
real ConfigHub function scan
real safe operation boundary
visible generated Secret boundary
```

The next chart target should be ingress-nginx or cert-manager, depending on
whether we want the next proof to emphasize admission/webhook/cluster-RBAC
behavior or CRD lifecycle.
