# A run of the OCI bundle route, 2026-11-02

**UNOFFICIAL/EXPERIMENTAL**

This log records one run of the commands a Helm entry page prints for its OCI
bundle, from upload to a change that reached the cluster. The entry was
`prometheus-community-prometheus-blackbox-exporter-11-18-0-default`. It has four
objects, no plan, and its own namespace.

This is a dated record of one run. It is not a Guide and it is not a receipt for
the entry. Every line that starts with `$` is a command that was run, and the
text under it is the output it printed. Colour codes are removed.

## Versions and setting

- The client is cub v0.9.0 and the workshop plugin is 0.6.61.
- The organization is a hosted ConfigHub organization. Every Space, Component and cluster the run created was deleted at the end.
- The cluster was a local kind cluster with Argo CD.

## What the run found

| Check | Result |
| --- | --- |
| Upload with `--create-namespace` | Worked. It added a Namespace Unit, and the workload ran in that namespace. |
| The `README.md` Unit the bundle adds | It did not stop delivery. Argo CD reported Synced and Healthy. |
| An edit to the variant, then a promotion from the base | The edit survived, and the base change merged in. |
| The promote commands the page printed that day | They stopped before a publish, so the change stayed in ConfigHub and did not reach the cluster. The page now prints the publish. |
| `cub cluster up --name workshop` | It failed while installing argobot, with `missing required environment variables: CONFIGHUB_URL`, and rolled itself back. |
| `cub cluster up --name workshop --no-argobot` | cub v0.9.0 refused the flag, which is now `--no-k8sbot`. |
| `cub cluster up --name workshop --no-k8sbot` | Worked. |

## Upload

```text
$ cub variant upload --dry-run --component prometheus-community-prometheus-blackbox-exporter --variant default --space prometheus-community-prometheus-blackbox-exporter-11-18-0-default --namespace monitoring --create-namespace oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-prometheus-community-prometheus-blackbox-exporter-11-18-0-default:latest@sha256:8d7f2dbd7a86354268bd590ab9d177742bba623f3cc8b5b7bb5ee3eed01f44af
Pulled oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-prometheus-community-prometheus-blackbox-exporter-11-18-0-default:latest@sha256:8d7f2dbd7a86354268bd590ab9d177742bba623f3cc8b5b7bb5ee3eed01f44af (sha256:8d7f2dbd7a86354268bd590ab9d177742bba623f3cc8b5b7bb5ee3eed01f44af)
Dry run: nothing was written.
Space prometheus-community-prometheus-blackbox-exporter-11-18-0-default (Create)
  Create    namespace
  Create    prometheus-blackbox-exporter-serviceaccount
  Create    prometheus-blackbox-exporter-configmap
  Create    prometheus-blackbox-exporter-service
  Create    prometheus-blackbox-exporter
  Create    README.md
  linked    prometheus-blackbox-exporter -> namespace (reference:v1/Namespace)
  linked    prometheus-blackbox-exporter -> prometheus-blackbox-exporter-configmap (reference:v1/ConfigMap)
  linked    prometheus-blackbox-exporter -> prometheus-blackbox-exporter-serviceaccount (reference:v1/ServiceAccount)
  linked    prometheus-blackbox-exporter-configmap -> namespace (reference:v1/Namespace)
  linked    prometheus-blackbox-exporter-service -> namespace (reference:v1/Namespace)
  linked    prometheus-blackbox-exporter-service -> prometheus-blackbox-exporter (selector)
  linked    prometheus-blackbox-exporter-serviceaccount -> namespace (reference:v1/Namespace)
  linked    prometheus-blackbox-exporter -> prometheus-blackbox-exporter-configmap (hash:v1/ConfigMap)
```

```text
$ cub variant upload --component prometheus-community-prometheus-blackbox-exporter --variant default --space prometheus-community-prometheus-blackbox-exporter-11-18-0-default --namespace monitoring --create-namespace oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-prometheus-community-prometheus-blackbox-exporter-11-18-0-default:latest@sha256:8d7f2dbd7a86354268bd590ab9d177742bba623f3cc8b5b7bb5ee3eed01f44af
Pulled oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-prometheus-community-prometheus-blackbox-exporter-11-18-0-default:latest@sha256:8d7f2dbd7a86354268bd590ab9d177742bba623f3cc8b5b7bb5ee3eed01f44af (sha256:8d7f2dbd7a86354268bd590ab9d177742bba623f3cc8b5b7bb5ee3eed01f44af)
Space prometheus-community-prometheus-blackbox-exporter-11-18-0-default (Create)
  Create    namespace
  Create    prometheus-blackbox-exporter-serviceaccount
  Create    prometheus-blackbox-exporter-configmap
  Create    prometheus-blackbox-exporter-service
  Create    prometheus-blackbox-exporter
  Create    README.md
  linked    prometheus-blackbox-exporter -> namespace (reference:v1/Namespace)
  linked    prometheus-blackbox-exporter -> prometheus-blackbox-exporter-configmap (reference:v1/ConfigMap)
  linked    prometheus-blackbox-exporter -> prometheus-blackbox-exporter-serviceaccount (reference:v1/ServiceAccount)
  linked    prometheus-blackbox-exporter-configmap -> namespace (reference:v1/Namespace)
  linked    prometheus-blackbox-exporter-service -> namespace (reference:v1/Namespace)
  linked    prometheus-blackbox-exporter-service -> prometheus-blackbox-exporter (selector)
  linked    prometheus-blackbox-exporter-serviceaccount -> namespace (reference:v1/Namespace)
  linked    prometheus-blackbox-exporter -> prometheus-blackbox-exporter-configmap (hash:v1/ConfigMap)

Revert this upload of prometheus-community-prometheus-blackbox-exporter-11-18-0-default with:
  cub unit update --patch --space prometheus-community-prometheus-blackbox-exporter-11-18-0-default --restore Before:ChangeSet:upload-20261102-135834 --where "Labels.UploadSource = 'prometheus-community-prometheus-blackbox-exporter'"
```

## Deliver

```text
$ cub cluster up --name workshop
...
Failed: install argobot: argobot install failed: 2026/11/02 14:01:14 [FATAL] missing required environment variables: CONFIGHUB_URL
```

```text
$ cub cluster up --name workshop --no-k8sbot
... (trimmed)
Deploy an app to this cluster:
  1. cub variant create <name> <base-space> --target workshop/target [--namespace <ns>]
  2. cub release publish <name>
Step 1 clones <base-space> into a deployment space bound to the cluster's
target and auto-creates its Argo CD Application in the apps space "workshop-argo-apps"
(republishing it so Argo picks it up); step 2 makes the deployment's config
go live. See "cub variant create --help".
```

```text
$ cub variant create dev prometheus-community-prometheus-blackbox-exporter-11-18-0-default --target workshop/target --space-pattern "template:prometheus-community-prometheus-blackbox-exporter-11-18-0-default-dev"
Created variant space prometheus-community-prometheus-blackbox-exporter-11-18-0-default-dev (ID: 6fc2b92c-7c78-4fd1-9190-9454cb55928b)
Creating Argo CD Application Unit "prometheus-community-prometheus-blackbox-exporter-11-18-0-default-dev" in apps space "workshop-argo-apps"...
Publishing apps space "workshop-argo-apps" Release...
Argo CD Application "prometheus-community-prometheus-blackbox-exporter-11-18-0-default-dev" created; Argo syncs it on its next reconcile.
Awaiting triggers...

Bulk create operation completed:
  Success: 6 unit(s)
```

```text
$ cub release publish prometheus-community-prometheus-blackbox-exporter-11-18-0-default-dev
Successfully created release e3c8b991-603a-4071-887c-3bd7f5107d57 (e3c8b991-603a-4071-887c-3bd7f5107d57)
```

```text
$ kubectl -n argocd get applications.argoproj.io
NAME                                                                    SYNC STATUS   HEALTH STATUS
prometheus-community-prometheus-blackbox-exporter-11-18-0-default-dev   Synced        Healthy
workshop-argo-apps                                                      Synced        Healthy
```

```text
$ kubectl -n monitoring get deploy
NAME                                           READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/prometheus-blackbox-exporter   1/1     1            1           26s
```

## Customise, then promote

The run set two replicas on the dev variant and published that. It then added an
annotation to the base.

```text
$ cub variant promote prometheus-community-prometheus-blackbox-exporter-11-18-0-default-dev --dry-run -o mutations
Changes to unit prometheus-blackbox-exporter from promote:
Resource: apps/v1/Deployment monitoring/prometheus-blackbox-exporter
  + [Add] metadata.annotations
      example.com/base-change: "yes"
```

```text
$ cub variant promote prometheus-community-prometheus-blackbox-exporter-11-18-0-default-dev --change-desc "Pull the reviewed base forward"
Upgraded 1 unit(s) behind their upstream
Adding 0 unit(s) from upstream
```

In ConfigHub, the dev variant now held both the annotation and two replicas. On
the cluster it did not hold the annotation yet.

```text
$ kubectl -n monitoring get deploy prometheus-blackbox-exporter -o jsonpath=...
replicas=2 anno=
```

```text
$ cub release publish prometheus-community-prometheus-blackbox-exporter-11-18-0-default-dev
Successfully created release 7869ea41-d3df-4914-939d-499add188f91 (7869ea41-d3df-4914-939d-499add188f91)
```

```text
$ kubectl -n monitoring get deploy prometheus-blackbox-exporter -o jsonpath=...
replicas=2 anno=yes
```

## Technical notes and disclaimers

The entry has no plan, so the run did not exercise any plan step. It ran one entry
of the 226 with a published OCI bundle. It did not test an upgrade to a new bundle.
