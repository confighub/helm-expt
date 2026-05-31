# Metrics Server ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/metrics-server-confighub-proof/latest/confighub-proof-receipt.yaml
runs/metrics-server-confighub-proof/latest/function-scan-receipt.yaml
runs/metrics-server-confighub-proof/latest/safe-ops-receipt.yaml
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
cub installer doc packages/metrics-server/metrics-server/3.13.0 --json
```

Result:

```text
Package: metrics-server-metrics-server
Bases:
  default, default, 0 external requirements
  external-tls-ca, 1 external requirement
Collector:
  /bin/sh collector/target-facts.sh
```

The `default` happy path needs no target facts. The `external-tls-ca` variant
keeps its Secret requirement visible through the executable package:

```text
Secret kube-system/metrics-server-tls keys tls.crt,tls.key
```

## 2. Setup And Render

Command:

```sh
PATH="$PATH:$(go env GOPATH)/bin" cub installer setup \
  --pull packages/metrics-server/metrics-server/3.13.0 \
  --base default \
  --work-dir .tmp/confighub-proof/metrics-server-default \
  --non-interactive \
  --namespace kube-system
```

Result:

```text
Wizard wrote selection.yaml and inputs.yaml
Collector produced facts.yaml
Base: default; components: []
Namespace: kube-system
Rendered 10 manifest(s)
```

Collector facts:

```yaml
apiVersion: installer.confighub.com/v1alpha1
kind: Facts
metadata:
  name: metrics-server-metrics-server-facts
spec:
  package: metrics-server-metrics-server
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
PATH="$PATH:$(go env GOPATH)/bin" cub installer render \
  --work-dir .tmp/confighub-proof/metrics-server-default
```

Result:

```text
Rendered 10 manifest(s)
Spec docs written to out/spec
```

Rendered object shape:

```text
APIService
ClusterRoles
ClusterRoleBindings
Deployment
Namespace support object
RoleBinding
Service
ServiceAccount
```

## 3. Package And Vet

Package determinism:

```sh
cub installer package packages/metrics-server/metrics-server/3.13.0 \
  -o .tmp/confighub-proof/metrics-server-archives/metrics-server-a.tgz
cub installer package packages/metrics-server/metrics-server/3.13.0 \
  -o .tmp/confighub-proof/metrics-server-archives/metrics-server-b.tgz
```

Result:

```text
sha256:40f5cf32954c5162a1fcc98985582652b2ae3122a88b48f19e41df21b46bc72d
byte-identical across two local package bundles
```

Vet:

```sh
PATH="$PATH:$(go env GOPATH)/bin" cub installer vet \
  --work-dir .tmp/confighub-proof/metrics-server-default
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
  --work-dir .tmp/confighub-proof/metrics-server-default \
  --space helm-metrics-server-confighub-proof \
  --component MetricsServer \
  --layer Platform \
  --environment Demo \
  --owner ConfigHubHelm \
  --variant default \
  --unit-label Component=MetricsServer \
  --unit-label HelmChart=metrics-server-metrics-server \
  --unit-label HelmChartVersion=3.13.0 \
  --unit-label Variant=default \
  --unit-label Proof=metrics-server-confighub-proof
```

Result:

```text
Created 10 rendered Metrics Server Units
Created installer-record Unit
Inferred 14 links
```

The upload also reported two unresolved cluster-provided references:

```text
deployment-kube-system-metrics-server -> PriorityClass system-cluster-critical
rolebinding-kube-system-metrics-server-auth-reader -> Role extension-apiserver-authentication-reader
```

This is useful proof. These are not hidden; they become target/operate checks
before live apply.

Post-upload plan:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub installer plan \
  --work-dir .tmp/confighub-proof/metrics-server-default
```

Result:

```text
No changes.

Images in helm-metrics-server-confighub-proof:
  Deployment/metrics-server [metrics-server] registry.k8s.io/metrics-server/metrics-server:v0.8.0
```

## 5. Server-Side Variant

Command:

```sh
cub variant create staging helm-metrics-server-confighub-proof \
  --environment Staging \
  --region local \
  --space-name-pattern 'template:{{.Labels.Component}}-{{.Labels.Variant}}' \
  --wait \
  --timeout 2m
```

Result:

```text
Created variant space helm-metrics-server-confighub-proof-staging
Bulk create operation completed:
  Success: 11 unit(s)
```

## 6. Review And Diff

Unit inventory:

```sh
cub unit list --space helm-metrics-server-confighub-proof \
  --where "Labels.Proof = 'metrics-server-confighub-proof'" \
  --columns Slug,Labels.Component,Labels.HelmChartVersion,Labels.Variant,HeadRevisionNum,DataHash
```

Result:

```text
10 Metrics Server Kubernetes Units labeled Component=MetricsServer, HelmChartVersion=3.13.0, Variant=default
```

The staging clone contains 11 Units, including `installer-record`.

Clone tree:

```sh
cub unit tree --space '*' \
  --edge clone \
  --where "Slug = 'apiservice-v1beta1-metrics-k8s-io'" \
  --columns Space.Slug,Unit.Labels.Variant
```

Result:

```text
apiservice-v1beta1-metrics-k8s-io in helm-metrics-server-confighub-proof
  -> apiservice-v1beta1-metrics-k8s-io in helm-metrics-server-confighub-proof-staging
```

ConfigHub-side APIService data:

```sh
cub unit data apiservice-v1beta1-metrics-k8s-io \
  --space helm-metrics-server-confighub-proof
```

Result:

```text
Returned the Metrics Server APIService YAML from ConfigHub, including:
apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata.name: v1beta1.metrics.k8s.io
spec.service.name: metrics-server
spec.service.namespace: kube-system
spec.insecureSkipTLSVerify: true
```

Revision history:

```sh
cub revision list apiservice-v1beta1-metrics-k8s-io \
  --space helm-metrics-server-confighub-proof
```

Result:

```text
Revision 1: Initial Data from apiservice-v1beta1-metrics-k8s-io.yaml
Revision 2: Self-Resolve / normalize
```

Unit revision diff:

```sh
cub unit diff apiservice-v1beta1-metrics-k8s-io \
  --space helm-metrics-server-confighub-proof \
  --from 1 \
  --to 2 \
  -u
```

Result:

```text
Diff shows ConfigHub normalization, including:
metadata.annotations.confighub.com/ResourceMergeID
```

## 7. ConfigHub Function Scan

Commands:

```sh
cub function vet vet-format --space helm-metrics-server-confighub-proof \
  --where "Labels.Proof = 'metrics-server-confighub-proof'" --output json --wait
cub function vet vet-placeholders --space helm-metrics-server-confighub-proof \
  --where "Labels.Proof = 'metrics-server-confighub-proof'" --output json --wait
cub function vet vet-merge-keys --space helm-metrics-server-confighub-proof \
  --where "Labels.Proof = 'metrics-server-confighub-proof'" --output json --wait
```

Result:

```text
vet-format: 10 units, 0 failures
vet-placeholders: 10 units, 0 failures
vet-merge-keys: 10 units, 0 failures
```

## 8. Safe Operations

Create/update changeset:

```sh
cub changeset create metrics-server-safe-ops-20260527 \
  --space helm-metrics-server-confighub-proof \
  --description "Metrics Server ConfigHub proof safe operation lane" \
  --label Proof=metrics-server-confighub-proof \
  --label Lane=safe-ops \
  --allow-exists

cub changeset update metrics-server-safe-ops-20260527 \
  --space helm-metrics-server-confighub-proof \
  --description "Metrics Server safe-ops proof: approve reviewed revisions, dry-run apply only" \
  --annotation proof.confighub.com/scope=local-test \
  --annotation proof.confighub.com/live-apply=false
```

Approve a representative APIService Unit:

```sh
cub unit approve apiservice-v1beta1-metrics-k8s-io \
  --space helm-metrics-server-confighub-proof \
  --revision HeadRevisionNum \
  --verbose \
  --wait
```

Result:

```text
Unit apiservice-v1beta1-metrics-k8s-io (...) has been approved
Awaiting triggers...
```

Attempt dry-run apply:

```sh
cub unit apply --space helm-metrics-server-confighub-proof \
  --where "Labels.Proof = 'metrics-server-confighub-proof'" \
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
cub unit cancel --space helm-metrics-server-confighub-proof \
  --where "Labels.Proof = 'metrics-server-confighub-proof'"
```

Result:

```text
No units found matching the filter
```

## Verdict

Current Metrics Server `default` lane is credible:

```text
real package docs
real setup/render
real deterministic package
real vet path
real ConfigHub upload
real no-op plan
real server-side variant clone
real APIService data/revision/diff review
real ConfigHub function scan
real safe operation boundary
visible cluster-provided references
```

The next chart target should be PostgreSQL to prove the same flow against a
stateful database with stronger storage, secret, and upgrade/rollback concerns.
