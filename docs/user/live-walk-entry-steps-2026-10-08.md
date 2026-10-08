# Live walk of the entry steps, 2026-10-08

**UNOFFICIAL/EXPERIMENTAL**

This log records one serial session that walked the five steps under "Use this
entry in ConfigHub" for two Catalog entries. Steps 3, 4 and 5 ran against a
hosted ConfigHub organization and one disposable local kind cluster with Argo CD.
The entries were `bitnami-nginx-24-0-2-http-clusterip` and
`nvidia-gpu-operator-v26-3-3-default`. The steps came from each entry's
`nextSteps` in `site/listings/<id>.json` on `main` at commit 831c29e1ec.

This is a dated record of one run. It is not a Guide and it is not a receipt for
either entry. Every line that starts with `$` is a command that was run, and the
text under it is the output it printed. Times are local wall-clock times.

## Versions and setting

- The client is cub v0.8.7 (commit 072585f2, built 2026-10-07).
- The server is v0.8.9 (commit 984c0a51, built 2026-10-08).
- The installer plugin is 0.1.0 and the workshop plugin is 0.6.56.
- The cluster tools are kind v0.31.0 with node image `kindest/node:v1.35.0`, kubectl client v1.36.0 and Docker 29.4.0.
- `cub cluster up` installed Argo CD from the upstream `stable` manifest. The image it ran was `quay.io/argoproj/argocd:v3.5.4`.
- The organization is a hosted ConfigHub organization. Before the run it held 85 Spaces, 38 Components, 15 Targets, 4 Workers, 711 Units, 783 Links and 11 Triggers. None of them was changed.
- The machine held 16 kind clusters and 19 Docker containers before the run. None of them was touched.
- The account address is written `<user>`, identifiers are written `<id>`, the machine name is written `<host>`, the scratch directory is written `<work>`, and the Argo CD admin password that `cub cluster up` prints is removed from the output and written `<argo-password>`. The log holds no other secret, token or account address.
- Colour codes are stripped from output. Long output is trimmed where the text says so.

## What was substituted, and why

The commands below are the page's commands with these changes and no others.

| The page says | This run used | Why |
| --- | --- | --- |
| `cub auth login` | not run | The session used an existing login. The rules of the run forbade a new one. |
| plain `cub ...` | `cub --context <ctx> ...` with `CUB_CONTEXT=<ctx>` exported | The machine's default context is a different organization. The log leaves both out of the command lines. Finding 7 says why the flag alone was not enough. |
| `--space bitnami-nginx-24-0-2-http-clusterip` | `--space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip` | Every object had to carry the session prefix. A Space with the page's name already existed in the organization. |
| `--space nvidia-gpu-operator-v26-3-3-default` | `--space cwwalk-1008-nvidia-gpu-operator-v26-3-3-default` | The session prefix. |
| no `--component` flag on `cub installer upload` | `--component cwwalk-1008-bitnami-nginx` and `--component cwwalk-1008-nvidia-gpu-operator` | The default Component label is the package name, and a Component named `bitnami-nginx` already existed. |
| `cub cluster up --name workshop` | `cub cluster up --name cwwalk-1008-kind --no-argobot` | The session prefix. Argobot was left out because it installs into a shared `argobot-base` Space that already existed and belongs to other work, and it creates a Space named `argobot-<cluster>`, which cannot carry the prefix. |
| `--target workshop/target` | `--target cwwalk-1008-kind/target` | The Target is named after the cluster. |
| `--space-pattern "template:<entry>-dev"` | `--space-pattern "template:cwwalk-1008-<entry>-dev"` | The session prefix. |

`cub cluster up` fixes three names inside the cluster Space. They are the Worker
`worker`, the Target `target` and the Trigger `no-placeholders`. They could not
be given the prefix. They lived inside `cwwalk-1008-kind` and went with it.

## Starting counts

```
$ cub version
Client Version:
  Version:    v0.8.7
  Commit:     072585f257783af26f03e70b338d9ea96ea28055
  Build Date: 2026-10-07T02:31:58Z
Server Version:
  URL:        https://hub.confighub.com
  Version:    v0.8.9
  Commit:     984c0a51c7f49ddd5f18f79f02840461bddb6b8b
  Build Date: 2026-10-08T20:02:08Z
  Client ID:  cub

$ cub auth status
Status               Authenticated
User                 <user>
Organization Name    <a hosted ConfigHub organization>
Server URL           https://hub.confighub.com
Client Version       v0.8.7
Server Version       v0.8.9

$ cub space list --no-headers -o jq='.[].Space.Slug' | wc -l
      85
$ cub component list --no-headers -o jq='.[].Component.Slug' | wc -l
      38
$ cub target list --space '*' --no-headers | wc -l
      15
$ cub worker list --space '*' --no-headers | wc -l
       4
$ cub link list --space '*' --no-headers | wc -l
     783
$ cub unit list --space '*' --no-headers | wc -l
     711
$ kind get clusters | wc -l
      16
$ kubectl config current-context
error: current-context is not set
```

## Entry A. bitnami-nginx-24-0-2-http-clusterip

The listing gives commands for all five steps, so this entry was used as asked.

### Step 1. Get the exact objects

```
$ curl -fsSL -o bitnami-nginx-24-0-2-http-clusterip.yaml https://raw.githubusercontent.com/confighub/helm-expt/main/recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/rendered/release-objects.yaml
$ shasum -a 256 bitnami-nginx-24-0-2-http-clusterip.yaml
7fb28597f2eea8113612fa9e67ac84760cba1e72c42a4c59e4c25d284e0a94ba  bitnami-nginx-24-0-2-http-clusterip.yaml

$ cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67 --base http-clusterip --work-dir ./bitnami-nginx-24-0-2-http-clusterip --non-interactive --namespace nginx
Wizard wrote <work>/a/bitnami-nginx-24-0-2-http-clusterip/out/spec/selection.yaml and inputs.yaml
Collector produced 2 fact(s) in <work>/a/bitnami-nginx-24-0-2-http-clusterip/out/spec/facts.yaml
Base: http-clusterip; components: []
Namespace: nginx
Rendered 6 manifest(s) to <work>/a/bitnami-nginx-24-0-2-http-clusterip/out/manifests
Next: cub installer upload --work-dir <work>/a/bitnami-nginx-24-0-2-http-clusterip --space <slug>
```

The digest matches the listing. The retained file holds 5 objects. The installer
rendered 6, because it adds a Namespace.

### Step 2. Compare with another version or base

```
$ cub config diff bitnami-nginx-24-0-2-http-clusterip.yaml bitnami-nginx-24-0-2-existing-tls-ingress.yaml --summary
Configuration diff: 1 added, 0 removed, 1 changed, 4 unchanged
... (kind summary trimmed)

$ cub config diff bitnami-nginx-24-0-2-http-clusterip.yaml bitnami-nginx-24-0-4-http-clusterip.yaml --summary
Configuration diff: 0 added, 0 removed, 5 changed, 0 unchanged
... (kind summary trimmed)
```

Both `curl` fetches and both diffs worked as written.

### Step 3. Upload it as a variant

```
$ cub installer upload --work-dir ./bitnami-nginx-24-0-2-http-clusterip --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip --component cwwalk-1008-bitnami-nginx
== bitnami-nginx@24.0.2 → Space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip ==
Successfully created unit deployment-nginx-nginx (<id>)
Successfully created unit namespace-nginx (<id>)
Successfully created unit networkpolicy-nginx-nginx (<id>)
Successfully created unit poddisruptionbudget-nginx-nginx (<id>)
Successfully created unit service-nginx-nginx (<id>)
Successfully created unit serviceaccount-nginx-nginx (<id>)
Successfully created unit installer-record (<id>)
Linked deployment-nginx-nginx -> namespace-nginx (reference:v1/Namespace)
... (8 more "Linked" lines trimmed)

$ cub unit list --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip
NAME                               SPACE                                              ...    TARGET    ...    LAST-CHANGE-DESCRIPTION
deployment-nginx-nginx             cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip                            MergeExternal; from deployment-nginx-nginx.yaml
poddisruptionbudget-nginx-nginx    cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip                            MergeExternal; from poddisruptionbudget-nginx-nginx.yaml
serviceaccount-nginx-nginx         cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip                            MergeExternal; from serviceaccount-nginx-nginx.yaml
installer-record                   cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip                            MergeExternal; from <temp>/installer-record-1357784852.yaml
namespace-nginx                    cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip                            MergeExternal; from namespace-nginx.yaml
service-nginx-nginx                cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip                            MergeExternal; from service-nginx-nginx.yaml
networkpolicy-nginx-nginx          cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip                            MergeExternal; from networkpolicy-nginx-nginx.yaml

$ cub space get cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip -o jq='.Space | {Slug, Labels, ComponentID, ReleaseTargetID}'
{
  "ComponentID": null,
  "Labels": { "Component": "cwwalk-1008-bitnami-nginx" },
  "ReleaseTargetID": null,
  "Slug": "cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip"
}

$ cub component list --where "Slug LIKE 'cwwalk-1008-%'"
NAME    WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
```

The upload took 22 seconds and printed no `FAILED` and no `quota`. It created one
Space with 7 Units and 9 Links. Six Units are the rendered objects and the
seventh is `installer-record`, which holds seven `installer.confighub.com/v1alpha1`
documents. The upload wrote a `Component` label on the Space. It did not create a
Component, and the Space has no `ComponentID`.

### The local cluster for step 4

The page names the Target `workshop/target` and says that `cub cluster up --name
workshop` creates it. The help for `cub cluster up` was read first.

```
$ cub cluster up --name cwwalk-1008-kind --no-argobot
Creating kind cluster "cwwalk-1008-kind" (kubeconfig: $HOME/.confighub/clusters/cwwalk-1008-kind.kubeconfig)...
 ✓ Ensuring node image (kindest/node:v1.35.0)
 ... (kind output trimmed)
Installing Argo CD...
Applying Argo CD install manifest from https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml...
 ... (about 60 "serverside-applied" lines trimmed)
Patching argocd-cmd-params-cm (server.insecure=true)...
Patching argocd-cm (ignoreDifferences for self-referencing root Application)...
Patching argocd-server Service to NodePort 30010...
Creating ConfigHub space "cwwalk-1008-kind" (worker + target)...
Creating server-hosted OCI worker "worker" (OrgRole=none)...
Creating placeholder gate trigger "no-placeholders" (vet-placeholders on every Mutation)...
Creating OCI target "target" pulled by worker "worker"...
Creating ConfigHub space "cwwalk-1008-kind-argo-apps" (Argo Application Units)...
Setting the apps space's release target to "cwwalk-1008-kind/target"...
Creating root Application Unit "root" in apps space "cwwalk-1008-kind-argo-apps"...
Publishing the apps space's release (populates the OCI bundle Argo pulls)...
Bootstrapping root Application via kubectl (the only kubectl-apply moment)...
application.argoproj.io/cwwalk-1008-kind-argo-apps created

Done.
  cluster:    cwwalk-1008-kind
  kubeconfig: $HOME/.confighub/clusters/cwwalk-1008-kind.kubeconfig
  env file:   $HOME/.confighub/clusters/cwwalk-1008-kind.env
  space:      cwwalk-1008-kind
  apps space: cwwalk-1008-kind-argo-apps
  worker:     cwwalk-1008-kind/worker
  target:     cwwalk-1008-kind/target
  root app:   cwwalk-1008-kind-argo-apps/root
  gates:      cwwalk-1008-kind/no-placeholders (vet-placeholders) — blocks publishing a Release with
              unfilled confighubplaceholder values to this cluster

Argo CD: http://localhost:30010  (admin / <argo-password>)
User NodePort window: 30010-30019 (argo uses 30010; rest are open)
... (the "Deploy an app to this cluster" hint is trimmed)
```

The command took 2 minutes 5 seconds. This is what it created.

In ConfigHub:

- The Space `cwwalk-1008-kind`, with the label `confighub.com/cluster=true` and annotations for the cluster name, the machine name `<host>`, the Argo CD port and the port range. It holds no Units. It holds the Worker `worker` (Ready), the Target `target` and the validating Trigger `no-placeholders`.
- The Space `cwwalk-1008-kind-argo-apps`, whose release Target is `cwwalk-1008-kind/target`. It holds one Unit, `root`, and one Release, `release-1`.
- The Target carries the annotation `confighub.com/argo-apps-space: cwwalk-1008-kind-argo-apps`.

On the machine:

- One kind cluster, `cwwalk-1008-kind`, as one container, `cwwalk-1008-kind-control-plane`. It publishes ports 30010 to 30019 on all interfaces and the API server on a loopback port.
- Two files, `$HOME/.confighub/clusters/cwwalk-1008-kind.kubeconfig` and `cwwalk-1008-kind.env`. The env file sets `KUBECONFIG`, the Argo CD address and the Argo CD admin login.
- The default kubeconfig was not changed. Its checksum was the same before and after, and it still had no current context.

On the cluster:

```
$ kubectl -n argocd get pods
NAME                                                READY   STATUS    RESTARTS   AGE
argocd-application-controller-0                     1/1     Running   0          2m3s
... (6 more Argo CD pods, all 1/1 Running, trimmed)

$ kubectl -n argocd get applications.argoproj.io
NAME                         SYNC STATUS   HEALTH STATUS
cwwalk-1008-kind-argo-apps   Synced        Healthy
```

The `argocd` namespace also holds a Secret named `confighub-oci-creds`.

### Step 4. Deploy it, as written

```
$ cub variant create dev cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip --target cwwalk-1008-kind/target --space-pattern "template:cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev"
Created variant space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev (ID: <id>)
Creating Argo CD Application Unit "cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev" in apps space "cwwalk-1008-kind-argo-apps"...
Publishing apps space "cwwalk-1008-kind-argo-apps" Release...
Argo CD Application "cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev" created; Argo syncs it on its next reconcile.
Awaiting triggers...

Bulk create operation completed:
  Success: 7 unit(s)

$ cub unit list --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev
NAME                               SPACE                                                  CHANGESET    TARGET    UPGRADE-NEEDED    UNRELEASED-CHANGES
deployment-nginx-nginx             cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev                 target    No                Yes
service-nginx-nginx                cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev                 target    No                Yes
namespace-nginx                    cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev                 target    No                Yes
networkpolicy-nginx-nginx          cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev                 target    No                Yes
serviceaccount-nginx-nginx         cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev                 target    No                Yes
installer-record                   cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev                 target    No                Yes
poddisruptionbudget-nginx-nginx    cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev                 target    No                Yes
```

All seven clones have the Target, and that includes `installer-record`. The Unit
the command added to the apps Space is this Argo CD Application.

```
$ cub unit data --space cwwalk-1008-kind-argo-apps cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: oci://oci.hub.confighub.com:443/space/cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev
    targetRevision: latest
    path: .
  destination:
    server: https://kubernetes.default.svc
  syncPolicy:
    automated:
      selfHeal: true
      allowEmpty: true
```

```
$ cub release publish cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev        (21:25:51)
Successfully created release <id> (<id>)

$ cub release list --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev
NUM    TAG          PUBLISHED    DIGEST          LIVE    CREATED
1      release-1    true         c2c69db4a7a2            2026-10-08 20:25:52
```

Both commands exited 0. The cluster was then watched with read-only commands.

```
$ kubectl -n argocd wait --for=create applications.argoproj.io/cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev --timeout=300s
application.argoproj.io/cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev condition met        (21:28:55)

$ kubectl -n argocd get applications.argoproj.io        (21:29:02)
NAME                                                  SYNC STATUS   HEALTH STATUS
cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev   Unknown       Healthy
cwwalk-1008-kind-argo-apps                            Synced        Healthy

$ kubectl -n argocd get applications.argoproj.io cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev -o jsonpath='{range .status.conditions[*]}{.type}: {.message}{"\n"}{end}'
ComparisonError: Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = failed to set app instance tracking info on manifest: failed to get annotations for installer.confighub.com/v1alpha1, Kind=Package /bitnami-nginx: .metadata.annotations accessor error: contains non-string value in the map under key "config.kubernetes.io/local-config": true is of the type bool, expected string

$ kubectl get ns nginx
Error from server (NotFound): namespaces "nginx" not found
```

The state was the same at 21:35:55, ten minutes after the publish. The
Application was `Unknown` and `Healthy` with the same `ComparisonError`, and the
`nginx` namespace did not exist. Nothing from the entry was on the cluster.

ConfigHub showed no sign of this. The Units no longer showed unreleased changes,
`cub unit-event list` and `cub unit-action list` for the Space were empty, and
the `LIVE` column of `cub release list` was blank.

Step 4 as written failed on the cluster. The cause is the `installer-record`
Unit. `cub variant create --target` gives it the Target, so the Release carries
its seven `installer.confighub.com` documents, and Argo CD cannot read them.

### Step 4, the change that made it work

Three documented ways to clear the Target on one Unit were tried. Each reported
success and each left the Target in place.

```
$ cub unit set-target --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev installer-record -
Successfully updated Unit installer-record (<id>)

$ cub unit set-target --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev - --unit installer-record
Bulk set-target operation completed:
  Success: 1 unit(s)
  Context: target -

$ echo '{"TargetID": null}' | cub unit update --patch --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev --unit installer-record --from-stdin --change-desc "cwwalk: keep installer-record out of the Release"
Bulk update operation completed:
  Success: 1 unit(s)

$ cub unit get --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev installer-record -o jq='.Unit.TargetID'
<id>        (still the Target, after each of the three)

$ cub release publish cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev
No change: no changes were made since :latest bundle; no Release was created
```

Deleting the cloned Unit from the dev Space worked.

```
$ cub unit delete --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev installer-record
Successfully deleted unit installer-record (<id>)

$ cub release publish cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev        (21:36:39)
Successfully created release <id> (<id>)

$ kubectl wait --for=create namespace/nginx --timeout=300s
namespace/nginx condition met        (21:36:57)
$ kubectl -n nginx rollout status deployment/nginx --timeout=240s
deployment "nginx" successfully rolled out        (21:37:35)

$ kubectl -n argocd get applications.argoproj.io        (21:37:42)
NAME                                                  SYNC STATUS   HEALTH STATUS
cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev   Synced        Healthy
cwwalk-1008-kind-argo-apps                            Synced        Healthy

$ kubectl -n nginx get deployment,service,pods,networkpolicy,pdb
deployment.apps/nginx   1/1     1            1           38s
service/nginx   ClusterIP   10.96.194.125   <none>        80/TCP,443/TCP   38s
pod/nginx-d9699d4ff-ps556   1/1     Running   0          37s
networkpolicy.networking.k8s.io/nginx   app.kubernetes.io/instance=nginx,app.kubernetes.io/name=nginx   38s
poddisruptionbudget.policy/nginx   N/A             1                 1                     38s
```

The Application listed six resources, all `Synced`. The live Deployment carried a
`confighub.com/origin` annotation that names the dev Space, the Unit and revision 2.

### Step 5. Promote a change

The change was one replica to two on the Deployment Unit in the base.

```
$ cub function set --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip --unit deployment-nginx-nginx --change-desc "cwwalk step 5: base replicas 1 to 2" set-replicas 2
Function(s) succeeded on unit cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip/deployment-nginx-nginx (<id>)
Config data changed
Awaiting triggers...

$ cub variant promote cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev --dry-run -o mutations
Changes to unit deployment-nginx-nginx from promote:
Resource: apps/v1/Deployment nginx/nginx
  ~ [Update] spec.replicas
      1 → 2

Changes to unit installer-record from promote:
Resource: installer.confighub.com/v1alpha1/Package /bitnami-nginx  (added)
    ... (the whole Package document, then Facts, FunctionChain, Inputs, ManifestIndex, Selection and Upload, all "(added)"; about 130 lines trimmed)

$ cub variant promote cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev --change-desc "Pull the reviewed base forward"        (21:38:01)
Upgraded 1 unit(s) behind their upstream
Adding 1 unit(s) from upstream
  + installer-record

$ cub function get --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev --unit deployment-nginx-nginx --quiet --show output get-replicas
  Value: 2  Path: spec.replicas  Resource: nginx/nginx  Type: apps/v1/Deployment

$ cub release list --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev
NUM    TAG          PUBLISHED    DIGEST          LIVE    CREATED
2      release-2    true         67ac41bb2d1c            2026-10-08 20:36:40
1      release-1    true         c2c69db4a7a2            2026-10-08 20:25:52

$ kubectl -n nginx wait --for=jsonpath='{.spec.replicas}'=2 deployment/nginx --timeout=200s
error: timed out waiting for the condition on deployments/nginx        (21:41:30)
```

Both of the page's commands worked as written. The dev Space took the change, and
two Units showed unreleased changes. The promotion did not publish a Release, so
the cluster still ran one replica. The promotion also put `installer-record` back
into the dev Space, with the Target.

A reader would publish next, so the run did.

```
$ cub release publish cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev        (21:41:38)
Successfully created release <id> (<id>)

$ kubectl -n argocd get applications.argoproj.io        (21:47:09)
NAME                                                  SYNC STATUS   HEALTH STATUS
cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev   Unknown       Healthy
ComparisonError: ... failed to get annotations for installer.confighub.com/v1alpha1, Kind=Package /bitnami-nginx: ... "config.kubernetes.io/local-config": true is of the type bool, expected string

$ kubectl -n nginx get deployment nginx
nginx   1/1     1            1           10m
```

Argo CD read the third Release at 21:47:00, which was 5 minutes 21 seconds after
the publish, and failed in the same way. The workload kept running one replica.

One test checked whether the annotation type was the whole problem. The seven
`config.kubernetes.io/local-config: true` values in the dev copy of
`installer-record` were changed to the string `"true"`, and a fourth Release was
published at 21:47:25.

```
$ kubectl -n argocd get applications.argoproj.io cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev -o jsonpath='...'        (21:54:31)
phase=Running
msg=one or more synchronization tasks are not valid: failed to discover server resources for group version installer.confighub.com/v1alpha1: the server could not find the requested resource. Retrying attempt #5 at 8:55PM.
Package/bitnami-nginx: SyncFailed The Kubernetes API could not find installer.confighub.com/Package for requested resource /bitnami-nginx. Make sure the "Package" CRD is installed on the destination cluster.
... (six more SyncFailed lines for Facts, FunctionChain, Upload, Selection, Inputs and ManifestIndex, trimmed)
```

The comparison error went away and the sync then failed, because Argo CD 3.5.4
tried to apply the seven documents. The Deployment stayed `OutOfSync` at one
replica. Quoting the annotation is not enough.

Deleting the Unit again worked.

```
$ cub unit delete --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev installer-record
Successfully deleted unit installer-record (<id>)
$ cub release publish cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev        (21:54:52)
Successfully created release <id> (<id>)

$ kubectl -n nginx wait --for=jsonpath='{.spec.replicas}'=2 deployment/nginx --timeout=420s
deployment.apps/nginx condition met        (21:57:36)

$ kubectl -n argocd get applications.argoproj.io        (21:58:00)
NAME                                                  SYNC STATUS   HEALTH STATUS
cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev   Synced        Healthy

$ kubectl -n nginx get deployment,pods
deployment.apps/nginx   2/2     2            2           20m
pod/nginx-d9699d4ff-7gvlk   1/1     Running   0          15s
pod/nginx-d9699d4ff-ps556   1/1     Running   0          20m

$ cub revision list --space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev deployment-nginx-nginx
NUM    UNIT                      SOURCE         TAGS                               DESCRIPTION
3      deployment-nginx-nginx    UpgradeUnit    release-3, release-4, release-5    Pull the reviewed base forward
2      deployment-nginx-nginx    CloneUnit      release-1, release-2               Cloned from <id>...
1      deployment-nginx-nginx    CloneUnit                                         Empty revision preceding the unit's first content
```

The final state for entry A was `Synced` and `Healthy` with two of two replicas
running, 2 minutes 44 seconds after the fifth Release.

### Entry A was removed from ConfigHub before entry B

```
$ cub unit delete --space cwwalk-1008-kind-argo-apps cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev
Successfully deleted unit cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev (<id>)
$ cub release publish cwwalk-1008-kind-argo-apps
Successfully created release <id> (<id>)
$ cub space delete --recursive cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev
Successfully deleted space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev (<id>)
$ cub space delete --recursive cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip
Successfully deleted space cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip (<id>)
$ cub link list --space '*' --no-headers | wc -l
     783
```

The cluster kept the workload. Fourteen minutes later the nginx Application and
its two pods were still there, the root Application was `OutOfSync`, and the
nginx Application reported that its bundle was gone.

```
$ kubectl -n argocd get applications.argoproj.io        (22:11:58)
cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev   Unknown       Healthy
cwwalk-1008-kind-argo-apps                            OutOfSync     Healthy
ComparisonError: ... failed to resolve revision "latest": cannot get digest for revision latest: oci.hub.confighub.com:443/space/cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev:latest: not found
$ kubectl -n nginx get deploy nginx --no-headers
nginx   2/2   2     2     35m
```

The root Application's sync policy is `{"automated":{"selfHeal":true}, ...}` with
no prune, so removing an Application Unit does not remove the Application.

## Entry B. nvidia-gpu-operator-v26-3-3-default

### Steps 1 and 2

```
$ curl -fsSL -o nvidia-gpu-operator-v26-3-3-default.yaml https://raw.githubusercontent.com/confighub/helm-expt/main/recipes/nvidia/gpu-operator/v26.3.3/revisions/default/r001/rendered/release-objects.yaml
$ shasum -a 256 nvidia-gpu-operator-v26-3-3-default.yaml
73ebb5f6de3d1f010330d266db11b99b508be84dfc92b9d5deb01a39b66fee7c  nvidia-gpu-operator-v26-3-3-default.yaml

$ cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/nvidia-gpu-operator:v26.3.3@sha256:abd8475d6bfeabe88acc2d6a319a04054a9e84046d69926dcee4717674329a8f --base default --work-dir ./nvidia-gpu-operator-v26-3-3-default --non-interactive --namespace gpu-operator
Collector produced 2 fact(s) in <work>/b/nvidia-gpu-operator-v26-3-3-default/out/spec/facts.yaml
Base: default; components: []
Namespace: gpu-operator
Rendered 25 manifest(s) to <work>/b/nvidia-gpu-operator-v26-3-3-default/out/manifests

$ cub config diff nvidia-gpu-operator-v26-3-3-default.yaml nvidia-gpu-operator-v26-3-3-aicr-eks-training.yaml --summary
Configuration diff: 1 added, 15 removed, 2 changed, 7 unchanged
$ cub config diff nvidia-gpu-operator-v26-3-2-default.yaml nvidia-gpu-operator-v26-3-3-default.yaml --summary
Configuration diff: 0 added, 0 removed, 7 changed, 17 unchanged
```

The digest matches. The retained file holds 24 objects, 5 of them CRDs and one a
ClusterPolicy. The installer rendered 25, because it adds a Namespace.

The pulled package keeps the chart's Helm hooks apart from the base, under
`package/prerequisites/gpu-operator-lifecycle/default/`. There are two files,
`pre-upgrade.yaml` and `post-delete.yaml`, with four objects each. Every action in
`lifecycle-actions.yaml` says `automatic: false` and `evidenceState: "not-run"`.
The chart has no install-time hook.

### Step 3. Upload it as a variant

```
$ cub installer upload --work-dir ./nvidia-gpu-operator-v26-3-3-default --space cwwalk-1008-nvidia-gpu-operator-v26-3-3-default --component cwwalk-1008-nvidia-gpu-operator
== nvidia-gpu-operator@v26.3.3 → Space cwwalk-1008-nvidia-gpu-operator-v26-3-3-default ==
Successfully created unit clusterpolicy-cluster-policy (<id>)
... (24 more "Successfully created unit" lines trimmed, the last one installer-record)
Linked clusterpolicy-cluster-policy -> customresourcedefinition-clusterpolicies-nvidia-com (crd)
... (31 more "Linked" lines trimmed)

Note: the following references didn't resolve to any Unit in this Space.
... (explanation trimmed)
  - clusterrole-gpu-operator-node-feature-discovery -> v1/ConfigMap,v1/PersistentVolume,v1/Secret "nfd-master.nfd.kubernetes.io"
  - daemonset-gpu-operator-gpu-operator-node-feature-discovery-worker -> scheduling.k8s.io/v1/PriorityClass "system-node-critical"
  ... (3 more PriorityClass lines trimmed)

$ cub unit list --space cwwalk-1008-nvidia-gpu-operator-v26-3-3-default --no-headers | wc -l
      26
```

The upload took 73 seconds and printed no `FAILED` and no `quota`. It created 26
Units and 32 Links. Step 3 worked with the two name substitutions.

### Step 4. Deploy it, as written

```
$ cub variant create dev cwwalk-1008-nvidia-gpu-operator-v26-3-3-default --target cwwalk-1008-kind/target --space-pattern "template:cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev"
Created variant space cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev (ID: <id>)
Creating Argo CD Application Unit "cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev" in apps space "cwwalk-1008-kind-argo-apps"...
Publishing apps space "cwwalk-1008-kind-argo-apps" Release...
Argo CD Application "cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev" created; Argo syncs it on its next reconcile.
Awaiting triggers...

Bulk create operation completed:
  Success: 26 unit(s)

$ cub release publish cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev        (22:00:29)
Successfully created release <id> (<id>)

$ kubectl -n argocd wait --for=create applications.argoproj.io/cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev --timeout=420s
application.argoproj.io/cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev condition met        (22:02:40)

$ kubectl -n argocd get applications.argoproj.io        (22:02:56)
cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev   Unknown       Healthy
ComparisonError: Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = failed to set app instance tracking info on manifest: failed to get annotations for installer.confighub.com/v1alpha1, Kind=Package /nvidia-gpu-operator: .metadata.annotations accessor error: contains non-string value in the map under key "config.kubernetes.io/local-config": true is of the type bool, expected string

$ kubectl get ns gpu-operator
Error from server (NotFound): namespaces "gpu-operator" not found
```

This is the failure entry A showed, and that one did not change in ten minutes.
The run did not wait ten minutes a second time. It spent the wait on the state
after the change below.

### Step 4, with the cloned installer-record deleted

```
$ cub unit delete --space cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev installer-record
Successfully deleted unit installer-record (<id>)
$ cub release publish cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev        (22:03:04)
Successfully created release <id> (<id>)
$ kubectl wait --for=create namespace/gpu-operator --timeout=420s
namespace/gpu-operator condition met        (22:06:48)
```

Argo CD started its sync at 22:06:35, which was 3 minutes 31 seconds after the
publish, and finished it in 17 seconds.

```
$ kubectl -n argocd get applications.argoproj.io cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev -o jsonpath='...operationState...'
phase=Succeeded
msg=successfully synced (all tasks run)
started=2026-10-08T21:06:35Z finished=2026-10-08T21:06:52Z
Namespace/gpu-operator: Synced | namespace/gpu-operator created
ServiceAccount/node-feature-discovery: Synced | serviceaccount/node-feature-discovery created
ServiceAccount/gpu-operator: Synced | serviceaccount/gpu-operator created
ConfigMap/gpu-operator-node-feature-discovery-master-conf: Synced | ... created
ConfigMap/gpu-operator-node-feature-discovery-worker-conf: Synced | ... created
CustomResourceDefinition/nodefeaturerules.nfd.k8s-sigs.io: Synced | ... created
CustomResourceDefinition/nodefeatures.nfd.k8s-sigs.io: Synced | ... created
CustomResourceDefinition/nodefeaturegroups.nfd.k8s-sigs.io: Synced | ... created
CustomResourceDefinition/nvidiadrivers.nvidia.com: Synced | ... created
CustomResourceDefinition/clusterpolicies.nvidia.com: Synced | ... created
ClusterRole/gpu-operator-node-feature-discovery-gc: Synced | ... reconciled. reconciliation required create ...
ClusterRole/gpu-operator: Synced | ...
ClusterRole/gpu-operator-node-feature-discovery: Synced | ...
ClusterRoleBinding/... (3 lines): Synced | ...
Role/... (2 lines): Synced | ...
RoleBinding/... (2 lines): Synced | ...
DaemonSet/gpu-operator-node-feature-discovery-worker: Synced | daemonset.apps/gpu-operator-node-feature-discovery-worker created
Deployment/gpu-operator: Synced | deployment.apps/gpu-operator created
Deployment/gpu-operator-node-feature-discovery-gc: Synced | ... created
Deployment/gpu-operator-node-feature-discovery-master: Synced | ... created
ClusterPolicy/cluster-policy: Synced | clusterpolicy.nvidia.com/cluster-policy created
(the RBAC rule lists and the "missing the last-applied-configuration annotation" warnings are trimmed)
```

All 25 objects were accepted in one sync. Argo CD ordered them by kind. The
Namespace came first, then ServiceAccounts and ConfigMaps, then the five CRDs,
then RBAC, then the workloads, and the ClusterPolicy came last. The CRD and the
ClusterPolicy needed no separate step and nothing was applied by hand.

```
$ kubectl -n gpu-operator rollout status deployment/gpu-operator --timeout=240s
deployment "gpu-operator" successfully rolled out        (22:07:48)

$ kubectl -n argocd get applications.argoproj.io        (22:08:08)
cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev   Synced        Healthy

$ kubectl -n gpu-operator get pods
gpu-operator-6f4cbc9d8f-hcr7z                                 1/1     Running   0          57s
gpu-operator-node-feature-discovery-gc-585b876f9c-9cr9h       1/1     Running   0          57s
gpu-operator-node-feature-discovery-master-7f6684fb45-64lhp   1/1     Running   0          57s
gpu-operator-node-feature-discovery-worker-g8kth              1/1     Running   0          57s

$ kubectl get clusterpolicy cluster-policy -o jsonpath='state={.status.state}...'
state=ready
Ready=True reason=NFDLabelsMissing msg=No NFD labels found
Error=False reason=Ready msg=
```

What the operator did on a cluster with no GPU.

```
$ kubectl -n gpu-operator logs deploy/gpu-operator --tail=400 | grep ...
"msg":"No GPU node in the cluster, do not create DaemonSets","DaemonSet":"nvidia-driver-daemonset"
... (the same message for nvidia-container-toolkit-daemonset, nvidia-operator-validator, nvidia-device-plugin-daemonset, nvidia-device-plugin-mps-control-daemon, nvidia-dcgm-exporter, gpu-feature-discovery and nvidia-mig-manager)
"msg":"No NFD label found, polling for new nodes.","requeueAfter":45

$ kubectl get runtimeclass
nvidia          nvidia          25s
nvidia-cdi      nvidia-cdi      25s
nvidia-legacy   nvidia-legacy   25s

$ kubectl -n gpu-operator get ds
gpu-operator-node-feature-discovery-worker   1         1         1       1            1

$ kubectl get jobs -A
No resources found
```

The operator created three RuntimeClasses, two Services (`gpu-operator` and
`nvidia-dcgm-exporter`) and six ConfigMaps. It created none of its eight GPU
DaemonSets. Node feature discovery created one NodeFeature object and put 54
`feature.node.kubernetes.io` labels on the node. No node label mentions nvidia.

What the unrun hooks left missing. Nothing was missing at install, because the
chart's hooks are `pre-upgrade` and `post-delete` only. None of the eight hook
objects was on the cluster, and there was no Job. Two things follow for later.
An upgrade delivered this way does not run the chart's CRD upgrade Job, so the
CRDs move only because they are objects in the base. A removal does not run the
post-delete prune, so the 54 node labels and the NodeFeature object stay on the
node. This run did not exercise an upgrade or a removal.

### Step 5. Promote a change

The change was one label on a ConfigMap Unit in the base.

```
$ cub function set --space cwwalk-1008-nvidia-gpu-operator-v26-3-3-default --unit configmap-gpu-operator-gpu-operator-node-feature-discovery-worker-conf --change-desc "cwwalk step 5: label the worker ConfigMap in the base" set-label cwwalk-step5 promoted
Function(s) succeeded on unit cwwalk-1008-nvidia-gpu-operator-v26-3-3-default/configmap-gpu-operator-gpu-operator-node-feature-discovery-worker-conf (<id>)
Config data changed
Awaiting triggers...

$ cub variant promote cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev --dry-run -o mutations
Changes to unit configmap-gpu-operator-gpu-operator-node-feature-discovery-worker-conf from promote:
Resource: v1/ConfigMap gpu-operator/gpu-operator-node-feature-discovery-worker-conf
  + [Add] metadata.labels.cwwalk-step5
      promoted

Changes to unit installer-record from promote:
Resource: installer.confighub.com/v1alpha1/Package /nvidia-gpu-operator  (added)
... (the output is 405 lines; about 400 of them are the seven installer-record documents, trimmed)

$ cub variant promote cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev --change-desc "Pull the reviewed base forward"        (22:08:42)
Upgraded 1 unit(s) behind their upstream
Adding 1 unit(s) from upstream
  + installer-record

$ kubectl -n gpu-operator get cm gpu-operator-node-feature-discovery-worker-conf -o jsonpath='{.metadata.labels}'
{"app.kubernetes.io/instance":"gpu-operator", ... ,"helm.sh/chart":"node-feature-discovery-0.18.3"}        (no cwwalk-step5 label)
```

Both commands worked as written, and the change stopped in ConfigHub. The
re-added `installer-record` was deleted again and a third Release was published.

```
$ cub unit delete --space cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev installer-record
Successfully deleted unit installer-record (<id>)
$ cub release publish cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev        (22:08:51)
Successfully created release <id> (<id>)

$ kubectl -n gpu-operator wait --for=jsonpath='{.metadata.labels.cwwalk-step5}'=promoted configmap/gpu-operator-node-feature-discovery-worker-conf --timeout=480s
configmap/gpu-operator-node-feature-discovery-worker-conf condition met        (22:11:50)
```

The final state for entry B, at 22:11:58.

```
$ kubectl -n argocd get applications.argoproj.io
cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev   Synced        Healthy

$ kubectl -n gpu-operator get pods
gpu-operator-6f4cbc9d8f-hcr7z                                 1/1     Running   0          5m7s
gpu-operator-node-feature-discovery-gc-585b876f9c-9cr9h       1/1     Running   0          5m7s
gpu-operator-node-feature-discovery-master-7f6684fb45-64lhp   1/1     Running   0          5m7s
gpu-operator-node-feature-discovery-worker-g8kth              1/1     Running   0          5m7s

$ kubectl get clusterpolicy cluster-policy -o jsonpath='state={.status.state}...'
state=ready
Ready=True reason=NoGPUNodes msg=No GPU node found, watching for new nodes to join the cluster.
Error=False reason=Ready msg=

$ cub release list --space cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev
NUM    TAG          PUBLISHED    DIGEST          LIVE    CREATED
3      release-3    true         25ac098b8b9b            2026-10-08 21:08:51
2      release-2    true         d184485cdfb0            2026-10-08 21:03:05
1      release-1    true         d14d621a4fe9            2026-10-08 21:00:30
```

The operator and node feature discovery were running, and the ClusterPolicy
reported `ready` with the reason `NoGPUNodes`. No GPU workload existed, as
expected on this cluster.

## What went wrong

1. **Step 4 as written deploys nothing.** `cub variant create --target` gives the cloned `installer-record` Unit the Target, so the Release carries seven `installer.confighub.com/v1alpha1` documents. Argo CD 3.5.4 stops with `ComparisonError: ... "config.kubernetes.io/local-config": true is of the type bool, expected string`. Both entries failed this way, and entry A was still failing ten minutes after the publish. Every cub command exited 0.
2. **ConfigHub shows no sign of the failure.** After the publish the Units stop showing unreleased changes, `cub unit-event list` is empty and the `LIVE` column of `cub release list` is blank. This cluster ran without argobot, so the result with argobot was not observed.
3. **Argo CD reports `Healthy` for an Application that deployed nothing.** The row read `Unknown` and `Healthy`. A reader who checks only the health column sees a pass.
4. **Clearing the Target on one Unit does not work.** `cub unit set-target <unit> -`, `cub unit set-target - --unit <unit>` and a patch of `{"TargetID": null}` each reported success and each left the Target in place. The help says `-` clears it. The Space has a release Target, which may be why.
5. **Deleting the cloned `installer-record` is the change that works, and promotion undoes it.** `cub variant promote` adds the Unit back, with the Target. The next publish fails in the same way as finding 1. The Unit has to be deleted after every promotion and before every publish.
6. **Quoting the annotation is not enough.** With `"true"` as a string the comparison error goes away, and the sync then fails with `The Kubernetes API could not find installer.confighub.com/Package ... Make sure the "Package" CRD is installed on the destination cluster.`
7. **`cub --context <ctx>` does not reach a plugin.** A wrapper that logged each cub call showed that the plugin's inner calls carried `CUB_CONTEXT=<the default context>` when only the flag was given. `cub --context <ctx> installer plan` then failed with `cub context organization mismatch: upload.yaml recorded <id>, current cub context is <id> — run 'cub context set <name>' or 'cub auth login' against the recorded organization`. A first `cub installer upload` has no recorded organization to compare, so it would have written to the default organization. Exporting `CUB_CONTEXT` fixed it. The message also names `cub context set`, and the command is `cub context use`.
8. **Step 5 ends before the change reaches the cluster.** The promotion updates the dev Space and publishes nothing. The page gives no `cub release publish` after it.
9. **The page's Space name was already taken.** `bitnami-nginx-24-0-2-http-clusterip` existed in the organization, and so did a Component named `bitnami-nginx`. The page's upload command as written would have written into that Space. This run never ran it.
10. **The deploy step for entry A says "Run for this entry", and the recorded run used different commands.** `scripts/run-catalog-oci-delivery-proof.mjs` runs `cub installer upload --target`, then `cub space update --release-target`, then `cub release publish`. That path leaves `installer-record` without a Target. The page's path is `cub variant create --target`, which has no recorded run.
11. **The page says the gpu-operator destination must supply five inputs, and it supplied none.** The five are the CRDs, and they are objects in the base. Argo CD applied them before the ClusterPolicy in the same sync.
12. **The object counts on the page are not the Unit counts.** The page says 5 and 24 objects. The uploads created 7 and 26 Units, because the installer adds a Namespace and an `installer-record`.
13. **`cub installer upload` writes a `Component` label and creates no Component.** The Space has no `ComponentID`, `cub space list` shows an empty COMPONENT column and `cub component list` shows nothing.
14. **Argo CD notices a Release slowly without argobot.** A new child Application took 2 minutes 23 seconds and 3 minutes 32 seconds to appear after `cub variant create`. A new Release took between 18 seconds and 5 minutes 21 seconds to be read. The page's `cub cluster up --name workshop` installs argobot, and this run did not.
15. **`cub cluster up` does more than the page says.** It creates two Spaces, a Worker, a Target and a Trigger with fixed names. With argobot it also uses a shared `argobot-base` Space and creates `argobot-<cluster>`. It publishes ports 30010 to 30019 on all interfaces, installs Argo CD from an unpinned `stable` manifest, and prints the Argo CD admin password to the terminal.
16. **Removing the ConfigHub side leaves the workload running.** Deleting the Application Unit, republishing the apps Space and deleting both nginx Spaces left the Argo CD Application and two nginx pods on the cluster. The root Application does not prune. The page has no removal step.
17. **The promotion preview is dominated by `installer-record`.** For gpu-operator it printed 405 lines for a one-label change, and about 400 of them were the re-added record. The output also carries colour codes when it is captured.
18. **The upload makes one cub call for each Unit and each Link.** The gpu-operator upload took 73 seconds for 26 Units and 32 Links.
19. **Not run.** `cub auth login` was not run. Flux and plain kubectl delivery were not tried. No upgrade and no removal of gpu-operator was exercised, so the two lifecycle actions were not observed in use.

## Cleanup proof

Everything created in the session, all of it now deleted.

- Six Spaces, with at most four alive at once. They were `cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip`, `cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev`, `cwwalk-1008-nvidia-gpu-operator-v26-3-3-default`, `cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev`, `cwwalk-1008-kind` and `cwwalk-1008-kind-argo-apps`.
- In `cwwalk-1008-kind`, the Worker `worker`, the Target `target` and the Trigger `no-placeholders`.
- In `cwwalk-1008-kind-argo-apps`, the Units `root`, `cwwalk-1008-bitnami-nginx-24-0-2-http-clusterip-dev` and `cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev`, and four Releases.
- Five Releases in the nginx dev Space and three in the gpu-operator dev Space.
- The Units, Links and revisions inside those Spaces. No Component was created.
- One kind cluster, `cwwalk-1008-kind`, and its two files under `$HOME/.confighub/clusters/`.

```
$ cub space delete --recursive cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev
Successfully deleted space cwwalk-1008-nvidia-gpu-operator-v26-3-3-default-dev (<id>)
$ cub space delete --recursive cwwalk-1008-nvidia-gpu-operator-v26-3-3-default
Successfully deleted space cwwalk-1008-nvidia-gpu-operator-v26-3-3-default (<id>)

$ cub cluster down --name cwwalk-1008-kind --delete-config
Deleting kind cluster "cwwalk-1008-kind"...
Deleting cluster "cwwalk-1008-kind" ...
Deleted nodes: ["cwwalk-1008-kind-control-plane"]

Deleting the ConfigHub config for "cwwalk-1008-kind"...
  deleting space "cwwalk-1008-kind-argo-apps"...
  deleting cluster space "cwwalk-1008-kind" (worker + target)...

Done.
```

The two nginx Spaces were deleted earlier, as shown under entry A.

Final verification.

```
$ cub space list --no-headers -o jq='.[].Space.Slug' | wc -l
      85
$ cub space list --include-hidden --no-headers -o jq='.[].Space.Slug' | wc -l
      85
$ cub component list --no-headers -o jq='.[].Component.Slug' | wc -l
      38
$ cub target list --space '*' --no-headers | wc -l
      15
$ cub worker list --space '*' --no-headers | wc -l
       4
$ cub link list --space '*' --no-headers | wc -l
     783
$ cub unit list --space '*' --no-headers | wc -l
     711
$ cub trigger list --space '*' --no-headers | wc -l
      11

$ cub space list --include-hidden --where "Slug LIKE 'cwwalk-1008-%'" --no-headers | wc -l
       0
$ cub component list --where "Slug LIKE 'cwwalk-1008-%'" --no-headers | wc -l
       0
$ cub unit list --space '*' --include-hidden --where "Slug LIKE 'cwwalk-1008-%'" --no-headers | wc -l
       0
$ cub target list --space '*' --where "Slug LIKE 'cwwalk%'" --no-headers | wc -l
       0

$ kind get clusters | grep -c cwwalk
0
$ kind get clusters | wc -l
      16
$ ls $HOME/.confighub/clusters | grep -c cwwalk
0
```

| Count | Before | After |
| --- | --- | --- |
| Spaces | 85 | 85 |
| Components | 38 | 38 |
| Targets | 15 | 15 |
| Workers | 4 | 4 |
| Units | 711 | 711 |
| Links | 783 | 783 |
| Triggers | 11 | 11 |
| kind clusters | 16 | 16 |
| Docker containers | 19 | 19 |

The sorted lists of Space names, Component names, Target names, Worker names,
kind cluster names and Docker container names after the run are identical to the
lists taken before it. The default kubeconfig has the same checksum as before,
and the machine's default cub context was not changed. The node image
`kindest/node:v1.35.0` is still in the Docker image cache. The run did not check
whether it was there before.

Nothing was published to an OCI registry by hand. The only Releases were the
ones `cub release publish`, `cub cluster up` and `cub variant create` made inside
the Spaces this session created. No git repository was edited.
