# A run of the deploy and promote steps, 2026-11-27

**UNOFFICIAL/EXPERIMENTAL**

This log records one run of steps 4 and 5 under "Use this entry in ConfigHub"
for one Helm entry, `bitnami-nginx-24-0-2-http-clusterip`, as the entry page
printed them on `main` at commit bd1798731b. Step 4 cloned the uploaded base
onto a local kind cluster's Target and published it. Step 5 changed the base,
promoted the change and published it again.

The page then told the reader to delete a Unit named `installer-record` before
each publish, because the [walk of 2026-10-08](./live-walk-entry-steps-2026-10-08.md)
found that Argo CD could not read a Release that carried it. This run checked
whether that delete is still needed. It is not.

This is a dated record of one run. It is not a Guide and it is not a receipt for
the entry. Every line that starts with `$` is a command that was run, and the
text under it is the output it printed. The run's scratch directory is written
`$HOME/<work>`. Times are local wall-clock times.

## Versions and setting

- The client is cub v0.11.23 (commit c95bcee9).
- The server is a throwaway local ConfigHub server at v0.11.1 (commit 00b8b23a), started with `cub mini install` in a cub configuration of its own. It was removed with its data after the run.
- The installer plugin is 0.6.1.
- The cluster tools are kind v0.31.0, kubectl client v1.36.0 and OrbStack 29.8.2 as the Docker runtime.
- `cub cluster up` installed Argo CD from the upstream `stable` manifest. The run did not record the image tag it ran.
- The package was `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67`, the `digest_pinned_ref` in `data/installer-oci-packages/packages.json`.
- The Space the page writes `<your-space>` was named `walk-nginx`. No other name was changed.
- The Argo CD admin password that `cub cluster up` prints is left out.

## What the run found

| Check | Result |
| --- | --- |
| The upload's record of the package | Both forms of step 3 made it as a hidden Unit named `installer`, with the hidden reason `InstallerRecord`. `cub unit list` showed the 6 rendered objects only. |
| `cub variant create` | Cloned the 6 rendered objects onto the Target. It did not clone the `installer` Unit. |
| One publish | Deployed the entry. The Application was `Synced` and `Healthy`, with every object on the cluster, about 4.5 minutes after the publish. |
| The promotion preview | Listed the one-field change and the whole `installer` record as added: 57 lines in all. |
| The promotion | Changed the Deployment and added the `installer` Unit to the dev Space, hidden and with no Target. |
| The publish after the promotion | Delivered two replicas. Argo CD listed the 6 objects and no `InstallerRecord`. |
| The delete line | Not needed in either step. In step 4 there was no `installer-record` Unit to delete. |

## Step 3, the upload

The base came from the one-command form of step 3.

```text
$ cub package install oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67 --base http-clusterip --space walk-nginx --namespace nginx --non-interactive
```

It ran as in the [run of 2026-11-26](./live-walk-cub-package-install-2026-11-26.md).
`cub unit list` showed six Units. Listing the hidden ones
too shows the seventh:

```text
$ cub unit list --space walk-nginx --include-hidden -o jq='.[] | [.Unit.Slug, (.Unit.HiddenReason//"-"), .Unit.ToolchainType] | @tsv'
nginx-serviceaccount	-	Kubernetes/YAML
installer	InstallerRecord	AppConfig/YAML
nginx-networkpolicy	-	Kubernetes/YAML
namespace	-	Kubernetes/YAML
nginx-pdb	-	Kubernetes/YAML
nginx-service	-	Kubernetes/YAML
nginx	-	Kubernetes/YAML
```

The two-step form, `cub installer setup` then `cub installer upload --component
walk-two`, into a second Space made the same hidden `installer` Unit.

## The cluster

```text
$ cub cluster up --name workshop --no-k8sbot
```

It took 91 seconds. The end of its output, with the password left out:

```text
  space:      workshop
  apps space: workshop-argo-apps
  target:     workshop/target
  identity:   service account argo-workshop (the controller pulls with a token of it; k8sbot runs as it with a key)
  root:       workshop-argo-apps/root
User NodePort window: 30000-30009 (argo uses 30000; rest are open)
```

**The first cluster could not reach the server.** Ten minutes after the first
publish, Argo CD had read nothing:

```text
$ kubectl -n argocd get applications.argoproj.io
NAME                 SYNC STATUS   HEALTH STATUS
workshop-argo-apps   Unknown       Healthy
```

Its condition was `ComparisonError` with `dial tcp 192.168.97.1:32162: connect:
connection refused`. The server listened on 127.0.0.1 only. On a runtime other
than Docker Desktop, cub points Argo CD at the kind network's gateway, and on
OrbStack that does not reach a server on 127.0.0.1. Every `cub` command had
exited 0.

The run deleted that cluster and the dev Space, and made the cluster again
with a `docker` wrapper first on the PATH. The wrapper answers "Docker Desktop"
to the one question cub asks, so cub points Argo CD at
`host.docker.internal`. A cluster that pulls from a hosted ConfigHub
organization does not meet this. Everything below ran on the second cluster.

## Step 4, deploy it

The page printed four commands for this step: the clone, a publish, the
delete of `installer-record`, and a second publish. The run ran the clone and
the first publish only.

```text
$ cub variant create dev walk-nginx --target workshop/target --space-pattern "template:walk-nginx-dev"

Bulk create operation completed:
  Success: 6 unit(s)
```

```text
$ cub unit list --space walk-nginx-dev --include-hidden='*' --no-headers | wc -l
       6
```

```text
$ cub release publish walk-nginx-dev        (08:56:44)
Successfully created release b1e752e9-4c64-4f26-80d6-d73b4c96e639 (b1e752e9-4c64-4f26-80d6-d73b4c96e639)
```

The cluster ran without k8sbot, so Argo CD found the Release by polling.

```text
$ kubectl -n argocd get applications.argoproj.io        (09:01:19)
NAME                 SYNC STATUS   HEALTH STATUS
walk-nginx-dev       Synced        Healthy
workshop-argo-apps   Synced        Healthy
```

```text
$ kubectl -n nginx get deployment,service,pods,networkpolicy,pdb
NAME                    READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/nginx   1/1     1            1           19s

NAME            TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)          AGE
service/nginx   ClusterIP   10.96.11.253   <none>        80/TCP,443/TCP   19s

NAME                        READY   STATUS    RESTARTS   AGE
pod/nginx-d9699d4ff-pv4cx   1/1     Running   0          19s

NAME                                    POD-SELECTOR                                                    AGE
networkpolicy.networking.k8s.io/nginx   app.kubernetes.io/instance=nginx,app.kubernetes.io/name=nginx   19s

NAME                               MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS   AGE
poddisruptionbudget.policy/nginx   N/A             1                 1                     19s
```

## Step 5, promote a change

The change was one replica to two on the Deployment Unit in the base.

```text
$ cub function set --space walk-nginx --unit nginx --change-desc "walk step 5: base replicas 1 to 2" set-replicas 2
Config data changed
```

The page printed four commands for this step: the preview, the promote, the
delete of `installer-record`, and a publish. The run ran the preview, the
promote and the publish.

```text
$ cub variant promote walk-nginx-dev --dry-run -o mutations
Changes to unit nginx from promote:
Resource: apps/v1/Deployment nginx/nginx
  ~ [Update] spec.replicas
      1 → 2

Changes to unit installer from promote:
Resource: InstallerRecord installer  (added)
    configHub:
      configSchema: InstallerRecord
      configName: installer
    package:
      name: bitnami-nginx
```

The preview ran to 57 lines, and the trimmed rest is the record. Colour codes
are stripped.

```text
$ cub variant promote walk-nginx-dev --change-desc "Pull the reviewed base forward"        (09:01:33)
Upgraded 1 unit(s) behind their upstream
Adding 1 unit(s) from upstream
```

```text
$ cub unit list --space walk-nginx-dev --include-hidden='*' -o jq='.[] | [.Unit.Slug, (.Unit.HiddenReason//"-"), (.Unit.TargetID//"no-target")] | @tsv'
installer	InstallerRecord	no-target
namespace	-	62bbca14-e88b-457e-984f-7676e5035203
nginx-service	-	62bbca14-e88b-457e-984f-7676e5035203
nginx-networkpolicy	-	62bbca14-e88b-457e-984f-7676e5035203
nginx-serviceaccount	-	62bbca14-e88b-457e-984f-7676e5035203
nginx-pdb	-	62bbca14-e88b-457e-984f-7676e5035203
nginx	-	62bbca14-e88b-457e-984f-7676e5035203
```

The cluster still ran one replica. The promotion publishes nothing.

```text
$ cub release publish walk-nginx-dev        (09:01:39)
Successfully created release 545ce087-5e74-4f8f-aa0c-220b2f44fd36 (545ce087-5e74-4f8f-aa0c-220b2f44fd36)
```

At 09:04:20 the Deployment asked for two replicas. Argo CD's resource list for
the Application named the six objects, each `Synced`, and no `InstallerRecord`.

```text
$ kubectl -n nginx rollout status deploy/nginx --timeout=120s
deployment "nginx" successfully rolled out
```

```text
$ kubectl -n argocd get applications.argoproj.io walk-nginx-dev
NAME             SYNC STATUS   HEALTH STATUS
walk-nginx-dev   Synced        Healthy
```

## What this run did not cover

- It ran against a local ConfigHub server, not a hosted organization, and did not run `cub auth login`.
- The cluster ran without k8sbot.
- It created the `dev` variant only.
- It did not try Flux or plain kubectl delivery.
- It ran one entry. The other installer-package entries print the same commands and have no run of their own.

## Clean-up

The run removed the cluster with `cub cluster down --name workshop
--delete-config` and `kind delete cluster --name workshop`, and the server
with `cub mini uninstall --delete-data`.
