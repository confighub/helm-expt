# Tutorial Sequence

**UNOFFICIAL/EXPERIMENTAL**

This page is a short show-and-tell path through the project. Each tutorial says
what you are doing, what to look for, and what the result means:

```text
what the tutorial proves
-> explanatory flow
-> commands
-> what success looks like
```

The first tutorials use Redis because it is small and familiar. The later
tutorials show promotion, custom overlays, the GitOps/runtime proof lane, and
bulk operations over uploaded ConfigHub Units.

## Run From The Repo Root

Start from a current checkout:

```sh
git clone https://github.com/confighub/helm-expt.git
cd helm-expt
git status --short --branch
```

If you already have a checkout, run from the repository root. The package paths
in this page are relative to that directory.

## Prerequisites

Install or verify the local tools before Tutorial 1:

```sh
cub version
cub plugin install confighub/installer
cub installer version

command -v kustomize || brew install kustomize
command -v kustomize || go install sigs.k8s.io/kustomize/kustomize/v5@latest

cub context get -o json
cub space list -o json
```

`cub installer setup` shells out to `kustomize build`; the first setup fails if
`kustomize` is not on `PATH`. The tutorials do not require `helm`.

`cub context get -o json` proves a context is selected. `cub space list -o json`
is the useful auth check for the upload tutorials. If it fails with an
authentication problem, run:

```sh
cub auth login
```

Tutorials with live Kubernetes steps also need `kubectl` on `PATH` and a
reachable cluster context. Tutorial 6 can create a disposable local rig with
`cub lk`.

## Picking A Path

For a quick outside-eyes test, run Tutorial 1 and Tutorial 7 first. Tutorial 7 is
the most self-contained operating demo after the NGINX base is uploaded.

Tutorials 2 and 6 touch live Kubernetes. Tutorial 6 also depends on Argo CD and
the ConfigHub OCI target created by `cub lk up`.

## Tutorial 1: Redis Quick Start

This proves the basic path from a public Helm chart to ConfigHub Units.

```text
Helm chart
-> cub installer recipe/package
-> choose a base variant, e.g. redis/default
-> cub installer setup renders Kubernetes YAML
-> cub installer upload creates ConfigHub Units
```

Run the render and upload path:

The first two commands are local. The upload and ConfigHub verification require
an authenticated `cub` CLI in the organization where you want the demo Space to
be created. If `helm-redis-default` already exists, choose a unique Space slug or
reuse the same work directory to reconcile the existing upload.

```sh
cub installer setup \
  --pull packages/bitnami/redis/25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --non-interactive \
  --namespace redis

npm run verify-install:render -- \
  --chart bitnami/redis/25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --namespace redis

cub installer upload \
  --work-dir .tmp/demo/redis-default \
  --space helm-redis-default \
  --component Redis \
  --layer App \
  --environment Demo \
  --owner ConfigHubHelm \
  --variant default \
  --unit-label Component=Redis \
  --unit-label HelmChart=bitnami-redis \
  --unit-label HelmChartVersion=25.5.3 \
  --unit-label Variant=default \
  --unit-label Proof=redis-confighub-proof

npm run verify-install:confighub -- \
  --chart bitnami/redis/25.5.3 \
  --base default \
  --space helm-redis-default
```

What success looks like:

```text
Redis/default renders the same Kubernetes objects as regular Helm.
ConfigHub stores the rendered objects as labeled Units.
You can verify both the local render and the uploaded Units.
```

Check that ConfigHub has the Redis Units:

```sh
cub unit list --space helm-redis-default \
  --columns Unit.Slug,Unit.Labels.Component,Unit.Labels.Variant
```

Expect 15 Units: 14 Redis Kubernetes objects plus `installer-record`.

Where to look in the UI:

```text
ConfigHub -> Space helm-redis-default -> Units
```

Full script: [docs/demo/redis/demo-script.md](../demo/redis/demo-script.md).

## Tutorial 2: Redis Secret Modes

This proves why some choices are base variants, not post-render edits.

```text
redis/default
  Helm renders Secret redis/redis.
  cub installer separates the Secret to out/secrets for local use.
  ConfigHub records references and proof, not hidden public secret material.

redis/reuse-existing-secret
  Helm renders no Redis Secret.
  Workloads reference redis/redis-existing-secret key redis-password.
  The existing Secret is a target fact and external requirement.
```

Run the existing-Secret path:

This tutorial is written for the catalog namespace `redis`. Redis embeds that
namespace in service DNS values, so changing the namespace changes rendered
object data. Treat a different namespace as a separate render choice and review
the diff deliberately.

```sh
kubectl --context <your-context> create namespace redis \
  --dry-run=client -o yaml | kubectl --context <your-context> apply -f -

kubectl --context <your-context> -n redis create secret generic redis-existing-secret \
  --from-literal=redis-password=confighub-redis-password \
  --dry-run=client -o yaml | kubectl --context <your-context> apply -f -

cub installer setup \
  --pull packages/bitnami/redis/25.5.3 \
  --base reuse-existing-secret \
  --work-dir .tmp/demo/redis-reuse-existing-secret \
  --non-interactive \
  --namespace redis

npm run verify-install:render -- \
  --chart bitnami/redis/25.5.3 \
  --base reuse-existing-secret \
  --work-dir .tmp/demo/redis-reuse-existing-secret \
  --namespace redis
```

Optional local live check:

```sh
kubectl --context <your-context> apply -f .tmp/demo/redis-reuse-existing-secret/out/manifests

npm run verify-install:cluster -- \
  --chart bitnami/redis/25.5.3 \
  --base reuse-existing-secret \
  --context <your-context> \
  --namespace redis
```

What this proves:

```text
default and reuse-existing-secret are different base variants because Helm
renders different Kubernetes object references.
```

If you ran the live step, check the Redis workload:

```sh
npm run verify-install:cluster -- \
  --chart bitnami/redis/25.5.3 \
  --base reuse-existing-secret \
  --context <your-context> \
  --namespace redis
```

Expect StatefulSets, PVCs, Redis PING, and target Secret checks to pass.

## Tutorial 3: Prometheus Base Variant

This proves how a values choice becomes a reviewed base variant when it changes
the rendered object set.

```text
prometheus/default
-> full chart shape

prometheus/server-only-ephemeral
-> disables bundled components and persistence
-> renders fewer Kubernetes objects
-> gets its own package base, revision, receipts, scans, and gate
```

Run the server-only base:

```sh
cub installer setup \
  --pull packages/prometheus-community/prometheus/29.8.0 \
  --base server-only-ephemeral \
  --work-dir .tmp/demo/prometheus-server-only \
  --non-interactive \
  --namespace monitoring
```

Inspect the catalog proof:

```sh
npm run prometheus:verify-proof
npm run prometheus:verify-package
```

What this proves:

```text
server-only-ephemeral is not a ConfigHub-only tweak.
It changes the rendered YAML, so it belongs in the cub installer base path.
```

Catalog page:
[recipes/prometheus-community/prometheus/29.8.0/CATALOG.md](../../recipes/prometheus-community/prometheus/29.8.0/CATALOG.md).

## Tutorial 4: Prometheus Promotion Variant

This shows the proposed product flow for creating a derived ConfigHub variant
after the reviewed base has been uploaded.

```text
Prometheus/server-only-ephemeral
-> uploaded reviewed ConfigHub Space
-> cub variant create clones that Space and its Units
-> Prometheus/prod-us-east adds target, environment, region, gates, and links
-> no Helm rerender
```

Current CLI primitive:

First upload the reviewed base Space if it does not already exist:

```sh
cub installer upload \
  --work-dir .tmp/demo/prometheus-server-only \
  --space helm-prometheus-server-only \
  --component Prometheus \
  --layer App \
  --environment Demo \
  --owner ConfigHubHelm \
  --variant server-only-ephemeral \
  --unit-label Component=Prometheus \
  --unit-label HelmChart=prometheus-community-prometheus \
  --unit-label HelmChartVersion=29.8.0 \
  --unit-label Variant=server-only-ephemeral
```

Then clone the Space into a derived ConfigHub variant:

```sh
cub variant create prod-us-east helm-prometheus-server-only \
  --environment Prod \
  --region us-east \
  --space-name-pattern 'template:{{.Labels.Component}}-{{.Labels.Variant}}' \
  --unit-delete-gate production-review \
  --unit-destroy-gate production-review
```

Add `--target <target-slug>` only when the target already exists. The command
sets the downstream Space labels such as `Variant=prod-us-east`,
`Environment=Prod`, and `Region=us-east`. Cloned Units keep the source base
labels unless a post-clone trigger or later bulk update changes them.

The user-facing Creator should make that look like:

```text
Create variant
From: Prometheus/server-only-ephemeral
For: prod-us-east
Change: target, environment, region, production gates, observation policy
Review: same Prometheus install shape
Status: ready to create
Create
```

What success looks like:

```text
Promotion uses ConfigHub clone/link/label/target primitives.
It does not create a new Helm render unless the requested change alters the
Kubernetes object set.
```

Check the derived Space and cloned Units:

```sh
cub space get Prometheus-prod-us-east
cub unit list --space Prometheus-prod-us-east \
  --columns Unit.Slug,Unit.Labels.Variant,Unit.DeleteGates,Unit.DestroyGates
```

Expect 8 cloned Units. The Space carries `Variant=prod-us-east`; Units keep the
source base label unless a post-clone operation changes them.

Where to look in the UI:

```text
ConfigHub -> Space Prometheus-prod-us-east -> Units
```

Worked example:
[Prometheus Promotion Example](./prometheus-overlay-promotion-example.md).

## Tutorial 5: ExternalDNS Custom Overlay

This shows how a managed or customer overlay is routed.

```text
wrapper chart + platform values + customer overlay values
-> classify each value before render
-> render-time values go through cub installer
-> post-render operating choices go through derived ConfigHub variants
```

Example base:

```text
ExternalDNS/managed-aws-acme
```

Render-time overlay values:

```yaml
provider: aws
sources:
  - service
  - ingress
registry: txt
domainFilters:
  - acme.example.com
txtOwnerId: acme-prod-us-east
serviceAccount:
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/external-dns-acme-prod
rbac:
  create: true
```

Derived customer variant:

```text
ExternalDNS/managed-aws-acme
-> ExternalDNS/customer-acme-prod
```

Post-render operating choices:

```yaml
customer: acme
environment: prod
region: us-east
target: prod-us-east
observationFreshness: PT15M
targetFacts:
  requiredHostedZones:
    - acme.example.com
  requiredSecrets:
    - external-dns/external-dns-aws
```

Verify the managed-overlay golden:

```sh
npm run variant-goldens:verify
```

What this proves:

```text
Customer values that affect Kubernetes YAML become a reviewed installer base.
Customer operating context becomes a derived ConfigHub variant.
Secret material stays outside the public proof.
```

Plain example:
[Custom Overlays](./custom-overlays.md).

Golden data:
[data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md](../../data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md).

## Before Live GitOps Runs: Bring Kubernetes And Argo CD

The live GitOps tutorial needs a Kubernetes cluster with Argo CD installed and
able to pull from the ConfigHub OCI gateway.

Recommended local setup:

```sh
cub plugin install jesperfj/cub-lk
cub lk version
cub lk up --name helm-expt-oci-demo
```

`cub lk up` creates a disposable kind cluster, installs Argo CD, creates a
dedicated kubeconfig at:

```text
$HOME/.confighub/lk/helm-expt-oci-demo.kubeconfig
```

It also creates the ConfigHub pieces used by the tutorial:

```text
helm-expt-oci-demo-cluster        cluster/root Space
helm-expt-oci-demo-cluster/oci    OCI target
helm-expt-oci-demo-cluster/root   root Argo Application Unit
```

If you bring your own cluster instead, set up the same contract:

```text
Kubernetes cluster is reachable with kubectl.
Argo CD is installed in the cluster.
Argo can reach oci.hub.confighub.com:443.
Argo has any pull secret/token required for the ConfigHub OCI gateway.
ConfigHub has a cluster Space with an OCI target.
Workload Units are uploaded to a workload Space and targeted at that OCI target.
An Argo Application points at the ConfigHub OCI repo, targetRevision latest,
and path ./<workload-space>.
```

For this tutorial, the Argo Application source looks like:

```yaml
repoURL: oci://oci.hub.confighub.com:443/target/<cluster-space>/oci
targetRevision: latest
path: ./<workload-space>
```

When new Units are applied to the OCI target, ConfigHub publishes a new OCI
revision. Argo reconciles that revision and applies the objects to the cluster.
Before Tutorial 6 runs, only the root Application is expected. The workload
Application named `nginx` is created by Tutorial 6, so do not refresh it yet.

Check that the root Application exists before Tutorial 6:

```sh
KUBECONFIG="$HOME/.confighub/lk/helm-expt-oci-demo.kubeconfig" \
kubectl --context kind-helm-expt-oci-demo get application \
  helm-expt-oci-demo-cluster -n argocd
```

## Tutorial 6: GitOps And Runtime Proof

This runs the OCI/GitOps path with a local kind cluster, ConfigHub OCI, and
Argo CD.

```text
ConfigHub OCI artifact
-> Argo CD or Flux pulls the artifact
-> controller syncs the cluster
-> runtime observation receipt records digest, sync result, checks, and freshness
```

Run the first live example:

```sh
python3 tests/chart-install-test \
  --package packages/bitnami/nginx/24.0.2 \
  --slug nginx \
  --namespace nginx \
  --rig helm-expt-oci-demo \
  --base http-clusterip \
  --helm-expt "$PWD" \
  --wait 240 \
  --keep \
  --json
```

What success looks like in command output:

```text
render: PASS
confighub: PASS
argo: PASS, nginx Synced/Healthy
runtime: PASS, deployment.apps/nginx 1/1
```

Check that Argo sees both Applications:

```sh
KUBECONFIG="$HOME/.confighub/lk/helm-expt-oci-demo.kubeconfig" \
kubectl --context kind-helm-expt-oci-demo get applications -n argocd \
  -o custom-columns='NAME:.metadata.name,SYNC:.status.sync.status,HEALTH:.status.health.status,REV:.status.sync.revision'
```

You are looking for:

```text
helm-expt-oci-demo-cluster   Synced   Healthy   sha256:...
nginx                        Synced   Healthy   sha256:...
```

If `nginx` exists but Argo has not polled the latest OCI revision, refresh it:

```sh
KUBECONFIG="$HOME/.confighub/lk/helm-expt-oci-demo.kubeconfig" \
kubectl --context kind-helm-expt-oci-demo -n argocd annotate application nginx \
  argocd.argoproj.io/refresh=hard \
  --overwrite
```

Check that Kubernetes has the NGINX workload:

```sh
KUBECONFIG="$HOME/.confighub/lk/helm-expt-oci-demo.kubeconfig" \
kubectl --context kind-helm-expt-oci-demo get deploy,pods,svc -n nginx -o wide
```

You are looking for:

```text
deployment.apps/nginx   1/1
pod/nginx-...           1/1 Running
service/nginx           ClusterIP
```

Check that ConfigHub marked the workload Units live:

```sh
cub unit list --space helm-expt-oci-demo-nginx \
  --columns Unit.Slug,Target.Slug,UnitStatus.Status,Unit.LiveRevisionNum,Unit.LastAppliedRevisionNum
```

You are looking for:

```text
6 workload Units are Ready on target oci.
installer-record is NotLive.
```

In the ConfigHub UI, open space `helm-expt-oci-demo-cluster` to see `root` and
`nginx-app`. Open space `helm-expt-oci-demo-nginx` to see the workload Units.
In Argo CD, open `http://localhost:30010` and check that `root` and `nginx` are
both `Synced` and `Healthy`.

Verify the committed first-wave receipt index:

```sh
npm run runtime-gitops:wave:verify
```

Open the committed receipt index:

```text
data/runtime-gitops/summary.md
data/runtime-gitops/wave1.csv
data/runtime-gitops/receipt-index.csv
```

What the receipt index should tell you:

```text
The first-wave index validates the committed NGINX Argo/OCI receipt and lists
the remaining chart/base/controller pairs that still need receipts.
```

## Tutorial 7: Bulk Scan And Bulk Patch

This shows the operating value once Helm output has become ConfigHub Units.

```text
uploaded ConfigHub Units
-> bulk scan the selected Units
-> create a changeset
-> bulk patch metadata, gates, or approved fields
-> re-scan
-> bulk approve the reviewed revision
```

Use NGINX as the small example:

```text
Component: NGINX
Base variant: http-clusterip
Space: helm-nginx-http-clusterip
```

Upload or select the reviewed base first:

```sh
cub installer setup \
  --pull packages/bitnami/nginx/24.0.2 \
  --base http-clusterip \
  --work-dir .tmp/demo/nginx-http \
  --non-interactive \
  --namespace nginx

cub installer upload \
  --work-dir .tmp/demo/nginx-http \
  --space helm-nginx-http-clusterip \
  --component NGINX \
  --layer App \
  --environment Demo \
  --owner ConfigHubHelm \
  --variant http-clusterip \
  --unit-label Component=NGINX \
  --unit-label HelmChart=bitnami-nginx \
  --unit-label HelmChartVersion=24.0.2 \
  --unit-label Variant=http-clusterip
```

Check that the upload created NGINX Units:

```sh
cub unit list --space helm-nginx-http-clusterip \
  --columns Unit.Slug,Unit.Labels.Component,Unit.Labels.Variant
```

Expect 7 Units: 6 NGINX Kubernetes objects plus `installer-record`.

Bulk scan the uploaded Units:

```sh
cub function vet vet-format \
  --space helm-nginx-http-clusterip \
  --where "Labels.Component = 'NGINX' AND Labels.Variant = 'http-clusterip'" \
  --output wide
```

Expect `Passed: true` for the 6 selected NGINX Units.

Create a changeset for the patch:

```sh
cub changeset create \
  --space helm-nginx-http-clusterip \
  nginx-bulk-hardening \
  --description "Bulk hardening patch after scan"
```

Check that the changeset exists:

```sh
cub changeset get --space helm-nginx-http-clusterip nginx-bulk-hardening
```

Expect the changeset to exist in `helm-nginx-http-clusterip`.

Bulk patch metadata and gates for every matching Unit:

```sh
cub unit update --patch \
  --space helm-nginx-http-clusterip \
  --where "Labels.Component = 'NGINX' AND Labels.Variant = 'http-clusterip'" \
  --changeset nginx-bulk-hardening \
  --change-desc "Mark NGINX Units as scanned and production-review gated" \
  --label ScanDisposition=reviewed \
  --label Operation=bulk-scan-patch \
  --delete-gate production-review \
  --destroy-gate production-review
```

Check that the metadata and gates landed:

```sh
cub unit list --space helm-nginx-http-clusterip \
  --where "Labels.Component = 'NGINX' AND Labels.Variant = 'http-clusterip'" \
  --columns Unit.Slug,Unit.Labels.ScanDisposition,Unit.DeleteGates,Unit.DestroyGates
```

Expect 6 Units with `ScanDisposition=reviewed` and `production-review` gates.

If there is an approved mutating function for the field you want to change, use
`cub function set` instead of ad hoc file editing. Always dry-run first:

```sh
cub function set --dry-run \
  --space helm-nginx-http-clusterip \
  --where "Labels.Component = 'NGINX' AND Labels.Variant = 'http-clusterip'" \
  --changeset nginx-bulk-hardening \
  --output mutations \
  set-image nginx nginx:1.25.5
```

Expect one changed path on `deployment-nginx-nginx`:
`spec.template.spec.containers.?name=nginx.image`.

Apply the same function after reviewing the mutation output:

```sh
cub function set \
  --space helm-nginx-http-clusterip \
  --where "Labels.Component = 'NGINX' AND Labels.Variant = 'http-clusterip'" \
  --changeset nginx-bulk-hardening \
  --change-desc "Set reviewed NGINX image" \
  set-image nginx nginx:1.25.5
```

Check the changed image field:

```sh
cub unit data deployment-nginx-nginx --space helm-nginx-http-clusterip
```

Expect the main `nginx` container image to be `nginx:1.25.5`.

Re-scan the changed Units:

```sh
cub function vet vet-format \
  --space helm-nginx-http-clusterip \
  --where "Labels.Component = 'NGINX' AND Labels.Variant = 'http-clusterip'" \
  --changeset nginx-bulk-hardening \
  --output wide
```

Expect `Passed: true` for the 6 selected NGINX Units.

Bulk approve the reviewed current revisions:

```sh
cub unit approve \
  --space helm-nginx-http-clusterip \
  --where "Labels.Component = 'NGINX' AND Labels.Variant = 'http-clusterip'"
```

Verify the whole bulk-ops result:

```sh
npm run verify-bulk-ops:nginx -- \
  --space helm-nginx-http-clusterip \
  --changeset nginx-bulk-hardening
```

What success looks like:

```text
PASS verify-bulk-ops:nginx helm-nginx-http-clusterip
units: 6
approved units: 6
deployment image: nginx:1.25.5
vet-format passes: 6
```

Where to look in the UI:

```text
ConfigHub -> Space helm-nginx-http-clusterip -> Units
ConfigHub -> Space helm-nginx-http-clusterip -> Changesets -> nginx-bulk-hardening
ConfigHub -> Unit deployment-nginx-nginx -> Data / Revisions
```

What this proves:

```text
The scan targets a labeled set of rendered Units.
The patch is tied to a changeset.
Metadata and gates can be patched in bulk with cub unit update --patch.
Data changes use approved mutating functions such as cub function set.
Approval is also bulk and selector-based.
```

This is the bulk-ops story we want to demonstrate:

```text
Helm gives you a rendered release.
ConfigHub gives you a searchable object set you can scan, patch, review,
approve, and audit as a group.
```
