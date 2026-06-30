# Expected Results And Clusters

**UNOFFICIAL/EXPERIMENTAL**

Every guide should show what the user should see after the command they just
ran. The default path should not make a new user read proof machinery first.
Use this page as the simple checking pattern for the public guides.

## Short Version

| User is doing | Cluster needed? | What they should check |
| --- | --- | --- |
| Render a public catalog package with `cub installer setup` | No | A work directory with rendered manifests, and optionally separated secrets. |
| Compare their Redis render with the catalog | No | The Redis chart page links the committed evidence for the base they rendered. |
| Upload to ConfigHub | No Kubernetes cluster, but ConfigHub auth is required | A Space with labeled Units. |
| Apply locally | Yes, any reachable Kubernetes context | `kubectl get` shows created workloads, and live checks show `Running` or `Ready`. |
| Compare Helm and cub installer live behavior | Yes, usually throwaway kind clusters | The parity receipt says `pass`, `watch`, or `blocked` with a named reason. |
| Deliver through Argo or Flux | Yes, a cluster with the controller and OCI credentials | The controller reports synced or reconciled, then workloads are observed. |
| Operate apps and variants | ConfigHub auth; cluster only when delivering or observing | Diffs, scans, changesets, promotions, and receipts are visible in ConfigHub. |

## The Default UX Should Be Product Commands First

For a new user, the steel thread is:

```text
choose chart
-> render with cub installer
-> inspect what was produced
-> optionally upload to ConfigHub
-> optionally apply or deliver
-> verify the specific thing they just did
```

`npm run ...` commands are optional proof checks. They are useful for reviewers,
maintainers, CI, and users who want to verify a receipt. They should not be the
main product action in a default guide unless the guide is explicitly about
proof or parity.

## Stage 1: Serverless Redis Render

Run:

```sh
cub installer setup \
  --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --non-interactive \
  --namespace redis
```

You should see a completed work directory.

Check:

```sh
find .tmp/demo/redis-default/out -maxdepth 2 -type f | sort | head
```

You should see something like:

```text
.tmp/demo/redis-default/out/manifests/...
.tmp/demo/redis-default/out/secrets/...
```

Redis `default` separates generated Secret material into `out/secrets`. For a
local apply, stage secrets before manifests:

```sh
kubectl apply -f .tmp/demo/redis-default/out/secrets
kubectl apply -f .tmp/demo/redis-default/out/manifests
```

The Redis chart page carries the catalog evidence for this base. You do not
need to run the repository proof harness for the first pass through the guide.

## Stage 2: Standard Helm Baseline

If the guide asks you to compare with standard Helm, use the same chart version
and values as the catalog base. Use a separate namespace or a separate
throwaway cluster so the two installs do not collide. A naked `helm install`
can be a useful smoke test, but it is not a parity check unless the inputs
match.

Example shape:

```sh
kubectl create namespace helm-redis --dry-run=client -o yaml | kubectl apply -f -
helm install redis oci://registry-1.docker.io/bitnamicharts/redis \
  --version 25.5.3 \
  --namespace helm-redis \
  -f recipes/bitnami/redis/25.5.3/effective-values.yaml
```

You should see Helm create a release:

```text
NAME: redis
LAST DEPLOYED: ...
NAMESPACE: helm-redis
STATUS: deployed
```

Then check Kubernetes:

```sh
kubectl -n helm-redis get statefulset,pod,pvc
```

You should see Redis StatefulSets, pods, and PVCs. Some charts take time to
become ready; readiness is a live-cluster fact, not a render fact.

For strict parity, use two clean clusters rather than comparing namespaces by
eye. Install regular Helm into one cluster. Render with `cub installer` and
apply the output into the other. Then compare the live Kubernetes objects and
workload readiness. The repository has a harness that automates this for
maintainers; that harness is not the default user install path.

## Stage 3: Upload To ConfigHub

Run:

```sh
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
  --unit-label Variant=default
```

Then check:

```sh
cub unit list --space helm-redis-default \
  --columns Unit.Slug,Unit.Labels.Component,Unit.Labels.Variant
```

You should see Redis Units, all labeled with `Component=Redis` and
`Variant=default`. For Redis `default`, expect the Kubernetes objects plus an
`installer-record` Unit.

In the ConfigHub UI:

```text
Space helm-redis-default -> Units
```

You should see the same Units and labels. If you want to rerun the repository
proof harness, use [Verify It Yourself](./verify-it-yourself.md) after the
product path is clear.

## Stage 4: Local Kubernetes

Users may bring any reachable Kubernetes cluster. For quick local tests, use a
throwaway kind cluster:

```sh
kind create cluster --name helm-expt-demo
kubectl config use-context kind-helm-expt-demo
```

Apply separated secrets first when a work directory has `out/secrets`:

```sh
kubectl apply -f .tmp/demo/redis-default/out/secrets
kubectl apply -f .tmp/demo/redis-default/out/manifests
```

Then check:

```sh
kubectl -n redis get statefulset,pod,pvc
```

You should see Redis workloads and PVCs. A healthy Redis run should eventually
show pods in `Running` or `Ready` state.

For deeper checks, use `kubectl describe`, workload logs, or a cub-scout
receipt. The repository proof harness can also check Redis-specific behavior,
but it should not be the first thing a new user has to understand.

## Stage 5: Argo, Flux, And cub-lk

For GitOps examples, users need a cluster that already has the chosen controller
and the ConfigHub OCI pull credentials. There are two sensible paths:

| Path | Use it when | What to expect |
| --- | --- | --- |
| Bring your own cluster | You already run Argo CD or Flux. | Configure the controller to pull the ConfigHub OCI artifact, then check controller sync and workload readiness. |
| Use `cub-lk` | You want a disposable local Argo/kind rig for a demo or proof run. | `cub lk up` provisions kind, Argo, and the OCI worker/target pieces needed by the proof path. |

The important point is that ConfigHub does not replace the in-cluster
controller in the GitOps path. ConfigHub stores Units, publishes one OCI
artifact, and records evidence. Argo or Flux pulls and reconciles it.

You should verify two things:

```text
controller accepted the artifact
workloads reached the expected live state
```

A synced controller alone is not enough. Read
[Why Synced Is Not Working](./why-synced-is-not-working.md).

## Stage 6: Apps And Ops

After upload, the expected checks become ConfigHub checks:

| Step | What the user should see |
| --- | --- |
| Create a derived variant | A downstream Space with cloned Units, labels, links to the upstream Space, and any target/gate changes. |
| Promote a variant | A dry-run mutation preview first, then a changeset or applied promotion with receipts. |
| Scan or gate | Findings, accepted findings, or blocked findings attached to exact Units. |
| Deliver through OCI | A digest or target artifact identity, plus controller or apply receipts. |
| Observe live state | Workload, prerequisite, controller, or cub-scout receipts with freshness. |

For a user guide, each step should show one concrete check:

```text
cub unit list ...
cub variant promote ... --dry-run -o mutations
kubectl get ...
controller status page
ConfigHub Space -> Units
ConfigHub changeset / approval / receipt
```

## Existing Apps, Platforms, Stacks, And Live Clusters

Yes, an existing app can enter the model. That is not the same as starting from
a public catalog chart.

| Existing thing | First route |
| --- | --- |
| Existing Argo CD app | Discover or import the Argo app, preserving source and target. |
| Existing Flux HelmRelease or Kustomization | Discover or import Flux state, preserving controller ownership. |
| Rendered manifests or KRM YAML | Import as ConfigHub Units, then label, scan, link, and observe. |
| Live cluster resources | Discover or import what exists, then decide whether to keep imported, create a variant, or graduate to a recipe. |
| Platform or stack | Represent multiple chart bases and custom app objects as one app graph. |

The first expected result should be read-only:

```text
ConfigHub found the app
ConfigHub shows the objects
no cluster change was made yet
next action is import, variant, or recipe graduation
```

Only move to a `cub installer` recipe when the app needs a maintained render
path, future chart refreshes, and catalog-grade proof.

## What Not To Put In The Default Guide Path

Do not make a new user run the full repo gate just to understand the product.
Use it for broad repo verification before release or review. In a user guide,
prefer a visible check tied to the thing they just did:

| User just did | Narrow check |
| --- | --- |
| Rendered Redis | Inspect the work directory and compare with the Redis chart page evidence. |
| Uploaded Redis | List Units in the ConfigHub Space and check labels in the UI. |
| Applied Redis to a cluster | Use `kubectl get`, `kubectl describe`, logs, or cub-scout receipts. |
| Wants strict Helm-vs-installer parity | Use two clean clusters: Helm in one, cub installer output in the other, then compare live objects. |
| Wants GitOps/OCI proof | Check the controller sync, workload readiness, and the chart/base evidence page. |

The default UX should stay simple. The proof machinery is there when the user
asks, "how do I know?"
