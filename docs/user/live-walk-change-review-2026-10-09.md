# Live walk of one reviewed change to a small app, 2026-10-09

**UNOFFICIAL/EXPERIMENTAL**

This log records one serial session. The session took a small public example
with a dev and a prod environment, proposed one change to prod, and followed
that change through a review gate in a hosted ConfigHub organization and onto a
throwaway local cluster. The change was one image tag. Prod ran v1.3.0 and dev
ran v1.4.0, and the change gave prod the tag that dev already ran.

This is a dated record of one run. It is not a Guide and it is not a receipt
for any Catalog entry. Every line that starts with `$` is a command that was
run, and the text under it is the output it printed. Times in the exit lines
are local wall-clock times. Times printed by the server are UTC, which was one
hour behind. The whole walk ran between 11:22 and 11:51 local time.

## Versions and setting

- The client is cub v0.8.7 (commit 072585f2, built 2026-10-07).
- The server is v0.8.10 (commit 28e0fc84, built 2026-10-08).
- The workshop plugin is 0.6.56. It supplies `cub config diff`, which is the only plugin command the walk used. The installer plugin 0.1.0 and the argo plugin 0.3.2 are installed and did not run.
- The local tools are kustomize v5.8.1, kubectl client v1.36.0, kind v0.31.0 with node image `kindest/node:v1.35.0`, Docker 29.4.0, yq and jq.
- `cub cluster up` installed Argo CD from the upstream `stable` manifest. The image it ran was `quay.io/argoproj/argocd:v3.5.4`.
- The example is `gitops/argo/intermediate-ci-to-gitops` at commit 7f1b8f2f of github.com/confighub/examples. The walk worked on a copy in a scratch directory, written `<work>`.
- The organization is a hosted ConfigHub organization. It is written `<org>`, and the cub context is written `<ctx>`. Every cub command ran as `cub --context <ctx> ...` with `CUB_CONTEXT=<ctx>` exported. The log leaves both out of the command lines.
- The organization id is written `<org-id>`, the signed-in account's user id is written `<user-id>`, a server request identifier is written `<request-id>`, the home directory is written `$HOME` and an account address is written `user@example.com`. The Argo CD admin password that `cub cluster up` prints is written `<argo-password>`. The log holds no token and no secret.
- The identifiers of the objects the walk made are left as they are, because the objects were still in place when the log was written. The section on what was in place lists them, and the clean-up section at the end records their removal.
- Each block ends with a line such as `[exit 0 at 11:23:23]`. The recording wrapper wrote that line. It is the exit code and the time the command returned.
- Long output is trimmed. Each cut is one line that starts with `...` and gives the number of lines removed. No kept line was edited beyond the substitutions above and the removal of trailing spaces and colour codes.
- The wrapper recorded 198 commands. The log shows most of them. It leaves out commands that repeat an earlier one and a few previews of a create, and the text says so where that matters.

## What the walk set out to do

A change-control reviewer at a bank asked for one small application
repository, one proposed change, an exact list of the objects affected in each
environment, and the reviewed result in ConfigHub. The reviewer wanted to know
who approved, what was released, and what a person would see afterwards. The
site answers that in pieces, from three unrelated examples, and names no
approver. The walk ran the whole question once on one small app so that a page
can print commands that have been run.

The walk had seven steps in three parts.

1. Render dev and prod with no account and no cluster.
2. Make the one-line change in a copy and diff the two renders.
3. Put the app into ConfigHub as two environments of one Component.
4. Set up a gate that refuses the change to prod without a recorded approval, and watch it refuse.
5. Propose the change, preview it and approve it, and read the approval record.
6. Bring up a local cluster, release prod before and after the change, and read the cluster each time.
7. Run the commands a reviewer would use afterwards.

## The answer in brief

The reviewer's four questions have these answers from this run.

- **Which objects change, and where.** One object changes, in one environment. It is the Deployment `apptique-prod/frontend`, and the field is the image of the container `server`, from `ghcr.io/confighub/apptique-frontend:v1.3.0` to `:v1.4.0`. The other three objects in prod and all four objects in dev do not change. `cub config diff` says so from two local renders, and ConfigHub says the same from its own records.
- **Who approved.** The record is an attestation of type `Approval` with result `Pass`, made in the dev Space at 10:37:42 UTC against change order `cwwalk-1009b-tag-v1-4-0-third`, with a note in the approver's words. It names the approver by user id, and `cub user get <user-id>` turns the id into the account. The real record names the signed-in account, which this log writes as `user@example.com`.
- **What was released.** Release 2 of the prod Space carries the change. Its manifest digest is `sha256:0005a406ddc9...`, its tag is the change order's end tag, and the change order lists it under Released Spaces. Release 1 holds prod as it stood before, with manifest digest `sha256:c587031ffa93...`.
- **What a person sees afterwards.** The change order shows who promoted the change into dev and into prod and when, and which Release in each Space carries it. The Unit's revision list shows revision 9 as the change. The diff between the two Releases shows the one field. On the cluster, the Argo CD Application reports the Release's digest as its synced revision, and the Deployment carries an annotation that names the Space, the Unit and revision 9.

The gate refused the promotion into prod before any approval existed, under
both workflows the walk made, and the server's words are in steps 4 and 5. It
also refused the author's own approval under the workflow with the default
rule, which is that an author of the change does not count. Release 1 was
published with the Component's requirement switched off for one command, and
step 6 says why.

These are the commands for the path that worked, in the order they ran, with
the walk's names and change descriptions replaced by placeholders. Each one ran
and worked unless the comment says it was refused. The walk reached this path
on its third change order, and the section on what went wrong says why.

```
# Part 1. No account and no cluster.
kustomize build <repo>/environments/apptique/prod > prod-before.yaml
#   change newTag from v1.3.0 to v1.4.0 in a copy of prod/kustomization.yaml
kustomize build <copy>/environments/apptique/prod > prod-after.yaml
cub config diff prod-before.yaml prod-after.yaml
cub config diff prod-before.yaml prod-after.yaml --json --out prod-change.json

# Part 2. The app in ConfigHub as a base with a dev and a prod variant.
kustomize build <repo>/environments/apptique/base > base.yaml
cub variant upload --component <app> --variant base --namespace apptique --create-namespace --change-desc "<text>" base.yaml
cub function set --space <app>-base --unit frontend --change-desc "<text>" set-container-image-reference server :v1.3.0
cub function set --space <app>-base --unit namespace --change-desc "<text>" set-label app.kubernetes.io/part-of apptique-examples
cub variant create dev <app>-base --stage dev --environment Dev --namespace apptique-dev --change-desc "<text>"
cub variant create prod <app>-base --stage prod --environment Prod --namespace apptique-prod --change-desc "<text>"
cub function set --space <app>-dev --change-desc "<text>" set-label environment dev
cub function set --space <app>-prod --change-desc "<text>" set-label environment prod
cub function set --space <app>-prod --unit frontend --change-desc "<text>" set-replicas 3
cub function set --space <app>-prod --unit frontend --change-desc "<text>" set-container-resources server all 200m 128Mi 2

# The gate.
cub changeworkflow create --space <app>-base <workflow> --stage dev --stage prod --attestation-prerequisite approved --attestation-prerequisite-count approved=1 --attestation-prerequisite-allow-authors approved=true --attestation-prerequisite-description approved="<text>" --stage-prerequisites prod=approved
cub component update --patch <app> --allowed-change-workflow <app>-base/<workflow> --change-workflow-required

# Propose the change. It lands in the base and then in dev.
cub function set --space <app>-base --unit frontend --change-desc "<text>" set-container-image-reference server :v1.4.0
cub changeorder create --space <app>-base <change> --description "<text>" --component <app> --change-workflow <app>-base/<workflow>
cub variant promote --change-order <app>-base/<change> --change-desc "<text>"

# Preview it.
cub variant diff <app>-dev Before:ChangeOrder:<app>-base/<change> ChangeOrder:<app>-base/<change> -o mutations
cub unit diff --space <app>-prod frontend --from HeadRevisionNum --file prod-after-deployment.yaml -o mutations

# Try prod without an approval. The server refused this one.
cub variant promote --change-order <app>-base/<change> --target-stage prod --change-desc "<text>"

# Approve, then preview what prod will get.
cub variant approve --change-order <app>-base/<change> --stage dev --note "<text>"
cub variant promote <app>-prod --change-order <app>-base/<change> --dry-run -o mutations

# Part 3. Apply the approved change to prod and release it.
cub variant promote --change-order <app>-base/<change> --target-stage prod --change-desc "<text>"
cub release publish --revision ChangeOrder:<app>-base/<change> <app>-prod

# Observe.
kubectl -n argocd get applications.argoproj.io
kubectl -n apptique-prod get deployment frontend -o jsonpath='{.spec.template.spec.containers[0].image}'

# Afterwards.
cub changeorder get --space <app>-base <change>
cub attestation get --space <app>-dev <attestation-id>
cub user get <user-id>
cub release list --space <app>-prod
cub revision list --space <app>-prod frontend
cub variant diff <app>-prod release-1 <app>-base/<change>-co-end -o mutations
```

The flag `--attestation-prerequisite-allow-authors approved=true` is there
because the walk had one account. Without it the workflow requires an approver
who did not write the change, and step 5 shows the server holding to that.

## What was substituted, and why

The example's own scripts were the starting point. The walk departed from them
in the places this table names.

| The example says | This run used | Why |
| --- | --- | --- |
| `./setup.sh` | not run | It uploads each overlay render into a Space of its own, named `gitops-argo-ci-to-gitops-dev` and `gitops-argo-ci-to-gitops-prod`, in a Component named `apptique`. Those names cannot carry the session prefix, and the walk chose a different model. The walk ran the script's two `kustomize build` commands itself and none of its `cub` commands. |
| One `cub variant upload` for each overlay render, as `--variant dev` and `--variant prod`, each into a named Space of its own | one upload of the repository's `base` directory as `--variant base`, then `cub variant create dev` and `cub variant create prod` | The next section gives the reason. |
| The image tag is a line in each overlay's `kustomization.yaml` | The tag is set once in the base with `set-container-image-reference`, and a change order carries it to dev and then to prod | A promotion in ConfigHub follows the links from a variant to its base. Two separate uploads have no such link. |
| Each overlay adds `namespace.yaml`, labels every object `environment: <env>`, and prod patches replicas and resources | `--create-namespace` on the base upload, `--namespace` on each `cub variant create`, then `set-label`, `set-replicas` and `set-container-resources` in the variants | These are the overlays' differences, made as edits in each variant. Step 3 checks the result against the repository's renders. |
| `./verify.sh` | run on both copies, read-only | It passes on the repository as it is. It fails on the copy with the change, by design, and step 2 shows the message. |
| `./cleanup.sh` | not run | The walk was told to leave everything in place. |
| The two workflow files under `.github/workflows/` | not run | The example says they are never run. The promotion pull request they describe is the thing this walk replaced with a change order. |
| `PROMOTED_FROM.md`, the promotion record | not edited | The change order, the approval and the Release are the record in this walk. |
| The Argo CD Applications in `gitops-repo/applications/` read a GitHub repository | Two Application Units in the cluster's apps Space that read each Space's Release from ConfigHub | That is how `cub cluster up` delivers. The walk wrote the two Units by hand, and step 6 says why. |
| No cluster. The example says it does not create one | `cub cluster up --name cwwalk-1009b --no-argobot` | The walk was asked to observe the change on a cluster. Argobot was left out because it installs into a shared `argobot-base` Space that belongs to other work, and it creates a Space named `argobot-<cluster>`, which cannot carry the prefix. |
| `AI_START_HERE.md` asks for a pause and a question after every stage | no pauses | Nobody was present to answer. |
| plain `cub ...` | `cub --context <ctx> ...` with `CUB_CONTEXT=<ctx>` exported | The machine's default context is a different organization, and a plugin does not see the flag. |

`cub cluster up` fixes three names inside the cluster Space. They are the Worker
`worker`, the Target `target` and the Trigger `no-placeholders`. They could not
be given the prefix. They live inside the Space `cwwalk-1009b`.

## The model chosen for dev and prod

The walk had two ways to put the app into ConfigHub.

The first is the example's own. Each overlay is rendered and uploaded into its
own Space. The repository stays the only source, and a change to prod is a
second upload of the prod render. Nothing in ConfigHub then connects dev to
prod. "Prod takes what dev already runs" would be something a person reads from
a diff.

The second is a shared base with a dev variant and a prod variant. The help for
`cub variant upload` says that `--variant` defaults to `base` "since an upload
normally seeds the base that variants are created from". The help for
`cub variant approve`, `cub variant diff` and `cub changeworkflow create` uses
Spaces named `apptique-base`, `apptique-dev` and `apptique-prod` in its
examples. The review gate that cub 0.8.7 offers is a ChangeWorkflow, and a
ChangeWorkflow orders the stages that a change order is promoted through.
A change order follows the links between a variant and its base.

The walk chose the second. The reviewer thinks "dev, then prod", and in this
model the server holds that order. A change is made once in the base. It
reaches dev first. It cannot reach prod before dev has taken it, and it cannot
reach prod without the approval. The same choice continues the dev and QA walk
of this morning, which used a base and variants and met no gate.

The choice has a cost, and the log states it plainly. The repository keeps the
image tag in each overlay, and the proposed change in the repository is one
line in prod's `kustomization.yaml`. In this model the tag lives in the base
and the change to prod is a promotion. The repository line and the promotion
are two ways to make the same change. The walk tied them together with two
comparisons. Once dev had taken the change, it compared what ConfigHub holds
for each environment with the repository's render of that environment. After
the promotion, it compared prod with the render of the one-line change. Both
reported no difference.

The first model was not run in ConfigHub.

## Before the walk

```
$ cub context list | grep -E "SELECTED|<ctx>"
SELECTED                    NAME            SERVER                                   ORGANIZATION                            USER
* --context, CUB_CONTEXT    <ctx>      https://hub.confighub.com                <org>                            user@example.com
[exit 0 at 11:22:57]

$ cub version; kustomize version; kubectl version --client 2>&1 | head -3; kind version; docker version --format "{{.Server.Version}}"; cub plugin list 2>&1 | head -20
Client Version:
  Version:    v0.8.7
  Commit:     072585f257783af26f03e70b338d9ea96ea28055
  Build Date: 2026-10-07T02:31:58Z
Server Version:
  URL:        https://hub.confighub.com
  Version:    v0.8.10
  Commit:     28e0fc849f2db6dd5796408cdab15619c7ae4fba
  Build Date: 2026-10-08T23:04:43Z
  Client ID:  cub
v5.8.1
Client Version: v1.36.0
Kustomize Version: v5.8.1
kind v0.31.0 go1.25.5 darwin/arm64
29.4.0
... (16 lines cut, the plugin list)
[exit 0 at 11:22:50]

$ cub plugin list -o json | jq -r '.[] | select(.name=="workshop" or .name=="installer" or .name=="argo") | .name + " " + .version'
argo 0.3.2
installer 0.1.0
workshop 0.6.56
[exit 0 at 11:23:14]
```

The context row names the hosted organization and a signed-in user, so the walk
went ahead. The same check ran once before the wrapper existed, with the other
nine contexts on the machine in view, and printed the same row.

```
$ cub space list --where "Slug LIKE 'gpu-operator-%'"
NAME                     COMPONENT       OWNER    VARIANT     STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
gpu-operator-v26-3-3     gpu-operator             v26-3-3                                                24
gpu-operator-prod        gpu-operator             prod                                                   24
gpu-operator-v25-10-1    gpu-operator             v25-10-1                                               24
gpu-operator-v26-3-2     gpu-operator             v26-3-2                                                24
[exit 0 at 11:22:57]

$ cub space list --where "Slug LIKE '%cwwalk%'"
NAME    COMPONENT    OWNER    VARIANT    STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
[exit 0 at 11:22:58]

$ cub component list --where "Slug LIKE '%gpu-operator%'"
NAME                WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
ch7-gpu-operator    false                0
gpu-operator        false                0                              gpu-operator-prod, gpu-operator-v25-10-1, gpu-operator-v26-3-2, gpu-operator-v26-3-3
[exit 0 at 11:22:59]

$ cub component list --where "Slug LIKE '%cwwalk%'"
NAME    WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
[exit 0 at 11:22:59]

$ cub unit list --space '*' --where "Space.Slug LIKE 'gpu-operator-%'" --no-headers -o jq='.[] | [.Space.Slug, .Unit.Slug, (.Unit.HeadRevisionNum|tostring)] | join(" ")' | sort > out/gpu-before.txt; wc -l < out/gpu-before.txt; shasum -a 256 out/gpu-before.txt | cut -c1-64; head -4 out/gpu-before.txt
      96
7fc4b5eaaef386bbda0c0e1b52f10a3ec64630e5047d2473ed16a2700fe40a85
gpu-operator-prod cluster-policy-clusterpolicy 4
gpu-operator-prod clusterpolicies.nvidia.com-crd 2
gpu-operator-prod gpu-operator 3
gpu-operator-prod gpu-operator-clusterrole 3
[exit 0 at 11:23:00]

$ kind get clusters; docker ps --format "{{.Names}}" | sort | wc -l; shasum -a 256 $HOME/.kube/config | cut -c1-64 > out/kubeconfig-before.sha; kubectl config current-context 2>&1
... (17 lines cut, one per kind cluster already on the machine)
      13
error: current-context is not set
[exit 1 at 11:23:00]
```

Four Spaces named `gpu-operator-*` and the Component `gpu-operator` belong to a
live example, and the walk was not allowed to touch them. They held 96 Units.
The walk kept each Unit's head revision number in a file so that the end could
compare. No Space and no Component carried the walk's prefix. The machine held
17 kind clusters and 13 running containers, and the default kubeconfig had no
current context. The last command exits 1 for that reason.

## Part 1. No account, no cluster

A visitor can repeat this part with cub, the workshop plugin and kustomize.

### Step 1. Render dev and prod

```
$ kustomize build example/gitops-repo/environments/apptique/dev > out/dev.yaml; kustomize build example/gitops-repo/environments/apptique/prod > out/prod-before.yaml; wc -l out/dev.yaml out/prod-before.yaml
      87 out/dev.yaml
      87 out/prod-before.yaml
     174 total
[exit 0 at 11:23:14]

$ for f in dev prod-before; do echo "== $f"; yq -r "[.kind, .metadata.namespace // \"(cluster)\", .metadata.name] | join(\" \")" out/$f.yaml | grep -v "^---"; done
== dev
Namespace (cluster) apptique-dev
ServiceAccount apptique-dev frontend
Service apptique-dev frontend
Deployment apptique-dev frontend
== prod-before
Namespace (cluster) apptique-prod
ServiceAccount apptique-prod frontend
Service apptique-prod frontend
Deployment apptique-prod frontend
[exit 0 at 11:23:14]

$ grep -n "image:\|replicas:\|cpu:\|memory:" out/dev.yaml out/prod-before.yaml
out/dev.yaml:54:  replicas: 1
out/dev.yaml:66:      - image: ghcr.io/confighub/apptique-frontend:v1.4.0
out/dev.yaml:82:            cpu: 200m
out/dev.yaml:83:            memory: 128Mi
out/dev.yaml:85:            cpu: 100m
out/dev.yaml:86:            memory: 64Mi
out/prod-before.yaml:54:  replicas: 3
out/prod-before.yaml:66:      - image: ghcr.io/confighub/apptique-frontend:v1.3.0
out/prod-before.yaml:82:            cpu: 400m
out/prod-before.yaml:83:            memory: 256Mi
out/prod-before.yaml:85:            cpu: 200m
out/prod-before.yaml:86:            memory: 128Mi
[exit 0 at 11:23:14]
```

Each environment renders to four objects. They are a Namespace, a
ServiceAccount, a Service and a Deployment. Dev runs v1.4.0 with one replica.
Prod runs v1.3.0 with three replicas and larger requests and limits. That is
what the example's README says.

### Step 2. Make the one-line change and diff it

The change went into a second copy of the example, so that the first copy
stayed as the repository has it.

```
$ cp -R example example-change && sed -i "" "s/newTag: v1.3.0/newTag: v1.4.0/" example-change/gitops-repo/environments/apptique/prod/kustomization.yaml; diff -ru example example-change
diff -ru example/gitops-repo/environments/apptique/prod/kustomization.yaml example-change/gitops-repo/environments/apptique/prod/kustomization.yaml
--- example/gitops-repo/environments/apptique/prod/kustomization.yaml	2026-10-09 11:22:49
+++ example-change/gitops-repo/environments/apptique/prod/kustomization.yaml	2026-10-09 11:23:23
@@ -16,7 +16,7 @@
 # this line. See PROMOTED_FROM.md for what was actually promoted and when.
 images:
   - name: ghcr.io/confighub/apptique-frontend
-    newTag: v1.3.0
+    newTag: v1.4.0

 patches:
   - target:
[exit 1 at 11:23:23]

$ kustomize build example-change/gitops-repo/environments/apptique/prod > out/prod-after.yaml; kustomize build example-change/gitops-repo/environments/apptique/dev > out/dev-after.yaml; diff -u out/prod-before.yaml out/prod-after.yaml
--- out/prod-before.yaml	2026-10-09 11:23:14
+++ out/prod-after.yaml	2026-10-09 11:23:23
@@ -63,7 +63,7 @@
         component: frontend
     spec:
       containers:
-      - image: ghcr.io/confighub/apptique-frontend:v1.3.0
+      - image: ghcr.io/confighub/apptique-frontend:v1.4.0
         livenessProbe:
           httpGet:
             path: /
[exit 1 at 11:23:23]
```

Both `diff` commands exit 1 because they found a difference. The repository
change is one line, and the render changes in one line.

```
$ cub config diff out/prod-before.yaml out/prod-after.yaml
Configuration diff: 0 added, 0 removed, 1 changed, 3 unchanged
  changed: apps/v1 Deployment apptique-prod/frontend
    /spec/template/spec/containers/server/image replace: "ghcr.io/confighub/apptique-frontend:v1.3.0" -> "ghcr.io/confighub/apptique-frontend:v1.4.0"
Local comparison only. This does not merge, protect edits or inspect a live target.
[exit 0 at 11:23:23]

$ cub config diff out/prod-before.yaml out/prod-after.yaml --summary
Configuration diff: 0 added, 0 removed, 1 changed, 3 unchanged
Kind summary (inventory only):
  apps/v1 Deployment: 1 -> 1 (+0)
  v1 Namespace: 1 -> 1 (+0)
  v1 Service: 1 -> 1 (+0)
  v1 ServiceAccount: 1 -> 1 (+0)
Local inventory comparison only. Matching kind counts do not establish object or behavior equivalence; this does not merge, protect edits or inspect a live target.
[exit 0 at 11:23:23]

$ cub config diff out/prod-before.yaml out/prod-after.yaml --json --out out/prod-change.json; echo "--- out/prod-change.json"; cat out/prod-change.json
{
  "schemaVersion": 1,
  "scope": "local-configuration-diff",
  "before": {
    "sha256": "sha256:3fb29e7c7f22f00712779de83252f5580fe2c0e013b06abab38994f3ace8d219",
    "objectCount": 4
  },
  "after": {
    "sha256": "sha256:8aae7b78fd9da6e543d4e6719a0a6913f2e548e7976fcf3e7a3deedc8f95bf73",
    "objectCount": 4
  },
  "equal": false,
  "summary": {
    "added": 0,
    "removed": 0,
    "changed": 1,
    "unchanged": 3
  },
  "changes": [
    {
      "object": {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "namespace": "apptique-prod",
        "name": "frontend"
      },
      "change": "changed",
      "fields": [
        {
          "path": "/spec/template/spec/containers/server/image",
          "operation": "replace",
          "before": "ghcr.io/confighub/apptique-frontend:v1.3.0",
          "after": "ghcr.io/confighub/apptique-frontend:v1.4.0"
        }
      ]
    }
  ],
  "comparison": "Object identity includes API version and explicit namespace; mapping and document order ignored, lists of uniquely named items compared item by item by name, every other list compared as a whole value, missing and null distinct. No Kubernetes defaulting or schema interpretation. Secret data and stringData values are replaced by a short hash of each value.",
  "notChecked": [
    "Kubernetes schema or admission validity",
    "upstream merge and protected-field preservation",
    "target readiness or live drift",
    "application availability"
  ]
}
... (46 lines cut, a marker line and the same JSON read back from the file)
[exit 0 at 11:23:24]

$ cub config diff out/prod-before.yaml out/prod-after.yaml --exit-code; echo "exit-code flag gave $?"
Configuration diff: 0 added, 0 removed, 1 changed, 3 unchanged
  changed: apps/v1 Deployment apptique-prod/frontend
    /spec/template/spec/containers/server/image replace: "ghcr.io/confighub/apptique-frontend:v1.3.0" -> "ghcr.io/confighub/apptique-frontend:v1.4.0"
Local comparison only. This does not merge, protect edits or inspect a live target.
exit-code flag gave 1
[exit 0 at 11:23:24]
```

One object changes, the Deployment `apptique-prod/frontend`, in one field, the
image of the container `server`. Three objects are unchanged. `--json --out`
prints the result and writes the same JSON to the file. With `--exit-code` the
command exits 1 when the two files differ.

The most honest command for "which environments are affected" renders every
environment before and after the change and diffs each pair.

```
$ for env in dev prod; do kustomize build example/gitops-repo/environments/apptique/$env > out/before-$env.yaml; kustomize build example-change/gitops-repo/environments/apptique/$env > out/after-$env.yaml; echo "== $env"; cub config diff out/before-$env.yaml out/after-$env.yaml --exit-code; echo "exit $?"; done
== dev
Configuration diff: 0 added, 0 removed, 0 changed, 4 unchanged
Local comparison only. This does not merge, protect edits or inspect a live target.
exit 0
== prod
Configuration diff: 0 added, 0 removed, 1 changed, 3 unchanged
  changed: apps/v1 Deployment apptique-prod/frontend
    /spec/template/spec/containers/server/image replace: "ghcr.io/confighub/apptique-frontend:v1.3.0" -> "ghcr.io/confighub/apptique-frontend:v1.4.0"
Local comparison only. This does not merge, protect edits or inspect a live target.
exit 1
[exit 0 at 11:23:32]
```

Dev is untouched. All four of its objects are unchanged, and prod has the one
change.

Comparing dev with prod directly is not readable, because the namespace is part
of each object's identity.

```
$ cub config diff out/dev.yaml out/prod-after.yaml
Configuration diff: 4 added, 4 removed, 0 changed, 0 unchanged
... (16 lines cut, each a whole object printed as one line of JSON, four removed and four added)
Local comparison only. This does not merge, protect edits or inspect a live target.
[exit 0 at 11:23:33]
```

The comparison works after the namespace and the environment label are made
the same in both files. That takes `sed`, and the log shows it so that nobody
mistakes it for a cub feature.

```
$ sed "s/apptique-dev/apptique-ENV/; s/environment: dev/environment: ENV/" out/dev.yaml > out/dev-norm.yaml; sed "s/apptique-prod/apptique-ENV/; s/environment: prod/environment: ENV/" out/prod-before.yaml > out/prod-before-norm.yaml; sed "s/apptique-prod/apptique-ENV/; s/environment: prod/environment: ENV/" out/prod-after.yaml > out/prod-after-norm.yaml; echo "== dev against prod before the change"; cub config diff out/dev-norm.yaml out/prod-before-norm.yaml; echo "== dev against prod after the change"; cub config diff out/dev-norm.yaml out/prod-after-norm.yaml
== dev against prod before the change
Configuration diff: 0 added, 0 removed, 1 changed, 3 unchanged
  changed: apps/v1 Deployment apptique-ENV/frontend
    /spec/replicas replace: 1 -> 3
    /spec/template/spec/containers/server/image replace: "ghcr.io/confighub/apptique-frontend:v1.4.0" -> "ghcr.io/confighub/apptique-frontend:v1.3.0"
    /spec/template/spec/containers/server/resources/limits/cpu replace: "200m" -> "400m"
    /spec/template/spec/containers/server/resources/limits/memory replace: "128Mi" -> "256Mi"
    /spec/template/spec/containers/server/resources/requests/cpu replace: "100m" -> "200m"
    /spec/template/spec/containers/server/resources/requests/memory replace: "64Mi" -> "128Mi"
Local comparison only. This does not merge, protect edits or inspect a live target.
== dev against prod after the change
Configuration diff: 0 added, 0 removed, 1 changed, 3 unchanged
  changed: apps/v1 Deployment apptique-ENV/frontend
    /spec/replicas replace: 1 -> 3
    /spec/template/spec/containers/server/resources/limits/cpu replace: "200m" -> "400m"
    /spec/template/spec/containers/server/resources/limits/memory replace: "128Mi" -> "256Mi"
    /spec/template/spec/containers/server/resources/requests/cpu replace: "100m" -> "200m"
    /spec/template/spec/containers/server/resources/requests/memory replace: "64Mi" -> "128Mi"
Local comparison only. This does not merge, protect edits or inspect a live target.
[exit 0 at 11:23:33]
```

Before the change, prod differs from dev in six fields. After the change it
differs in five, and the image is no longer one of them. Prod then runs the
image that dev runs.

The example has its own check, and the walk ran it on both copies.

```
$ (cd example && ./verify.sh) 2>&1 | tail -3; echo "== with the change"; (cd example-change && ./verify.sh) 2>&1 | tail -3
==> Checking dev and prod image tags differ (prod is one promotion behind dev)
==> Checking the prod image tag matches the last recorded promotion
All gitops-argo-intermediate-ci-to-gitops checks passed.
== with the change
==> Checking prod replica count differs from dev
==> Checking dev and prod image tags differ (prod is one promotion behind dev)
Expected the dev and prod apptique image tags to differ, both were v1.4.0
[exit 0 at 11:23:34]
```

The check passes on the repository as it is. It fails on the copy with the
change, because the script asserts that dev and prod run different tags. The
example treats a prod that has caught up with dev as an error, and it would
also want `PROMOTED_FROM.md` edited.

## Part 2. ConfigHub, with no cluster yet

### Step 3. Put the app into ConfigHub as a base with two variants

The base came from the repository's own `base` directory.

```
$ kustomize build example/gitops-repo/environments/apptique/base > out/base.yaml; yq -r "[.kind, .metadata.namespace // \"(none)\", .metadata.name] | join(\" \")" out/base.yaml | grep -v "^---"; grep -n "image:" out/base.yaml
ServiceAccount (none) frontend
Service (none) frontend
Deployment (none) frontend
52:      - image: ghcr.io/confighub/apptique-frontend:unset
[exit 0 at 11:30:21]

$ cub variant upload --dry-run --component cwwalk-1009b-apptique --variant base --namespace confighubplaceholder --create-namespace out/base.yaml
Failed: HTTP 400 for req <request-id>: Components[0]: CreateNamespace cannot synthesize Namespace "confighubplaceholder": the name is a placeholder. Upload without CreateNamespace, or set Namespace to the namespace the resources will run in

[exit 1 at 11:30:22]

$ cub variant upload --dry-run --component cwwalk-1009b-apptique --variant base --namespace apptique --create-namespace out/base.yaml
Dry run: nothing was written.
Space cwwalk-1009b-apptique-base (Create)
  Create    namespace
  Create    frontend-serviceaccount
  Create    frontend-service
  Create    frontend
  linked    frontend -> frontend-serviceaccount (reference:v1/ServiceAccount)
  linked    frontend -> namespace (namespace)
  linked    frontend-service -> frontend (selector)
  linked    frontend-service -> namespace (namespace)
  linked    frontend-serviceaccount -> namespace (namespace)
[exit 0 at 11:30:28]

$ cub variant upload --component cwwalk-1009b-apptique --variant base --namespace apptique --create-namespace --change-desc "Seed the base from the repository base directory" out/base.yaml
Space cwwalk-1009b-apptique-base (Create)
  Create    namespace
  Create    frontend-serviceaccount
  Create    frontend-service
  Create    frontend
  linked    frontend -> frontend-serviceaccount (reference:v1/ServiceAccount)
  linked    frontend -> namespace (namespace)
  linked    frontend-service -> frontend (selector)
  linked    frontend-service -> namespace (namespace)
  linked    frontend-serviceaccount -> namespace (namespace)

Revert this upload of cwwalk-1009b-apptique-base with:
  cub unit update --patch --space cwwalk-1009b-apptique-base --restore Before:ChangeSet:upload-20261009-103034 --where "Labels.UploadSource = 'cwwalk-1009b-apptique'"
[exit 0 at 11:30:34]

$ cub unit list --space cwwalk-1009b-apptique-base
NAME                       SPACE                         CHANGESET    TARGET    UPGRADE-NEEDED    UNRELEASED-CHANGES    VALIDATION-ERRORS    LAST-CHANGE-DESCRIPTION
namespace                  cwwalk-1009b-apptique-base                                                                                        Seed the base from the repository base directory
frontend-service           cwwalk-1009b-apptique-base                                                                                        Seed the base from the repository base directory
frontend-serviceaccount    cwwalk-1009b-apptique-base                                                                                        Seed the base from the repository base directory
frontend                   cwwalk-1009b-apptique-base                                                                                        Seed the base from the repository base directory
[exit 0 at 11:30:35]

$ for u in namespace frontend-serviceaccount frontend-service frontend; do echo "--- # unit $u"; cub unit data --space cwwalk-1009b-apptique-base $u; done
--- # unit namespace
apiVersion: v1
kind: Namespace
metadata:
  name: apptique
... (74 lines cut, the ServiceAccount, the Service and the Deployment, as rendered)
[exit 0 at 11:30:38]
```

The first preview used `confighubplaceholder` as the namespace, which the help
suggests for a base. The server refused it together with `--create-namespace`.
The walk gave the base the namespace `apptique`. The base is never released, so
that name never reaches a cluster. The upload made one Unit per object and did
not write a namespace into the three namespaced objects.

The repository's base carries the image tag `unset`. The walk set the tag that
prod runs, and gave the Namespace the label the overlays give it.

```
$ cub function set --space cwwalk-1009b-apptique-base --unit frontend --dry-run -o mutations set-container-image-reference server :v1.3.0
Function(s) succeeded on unit cwwalk-1009b-apptique-base/frontend (dac17ce7-8dec-4643-b4a8-3f289c9e7af5)
Config data changed

Changes to unit frontend from set-container-image-reference:
Resource: apps/v1/Deployment /frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:unset → ghcr.io/confighub/apptique-frontend:v1.3.0
[exit 0 at 11:30:51]

$ cub function set --space cwwalk-1009b-apptique-base --unit frontend --change-desc "Run image tag v1.3.0" set-container-image-reference server :v1.3.0
Function(s) succeeded on unit cwwalk-1009b-apptique-base/frontend (dac17ce7-8dec-4643-b4a8-3f289c9e7af5)
Config data changed
Awaiting triggers...
[exit 0 at 11:30:52]

$ cub function set --space cwwalk-1009b-apptique-base --unit namespace --change-desc "Label the namespace as the repository overlays do" set-label app.kubernetes.io/part-of apptique-examples
Function(s) succeeded on unit cwwalk-1009b-apptique-base/namespace (2913a22f-95ab-4fa6-bd03-852a7c3643b5)
Config data changed
Awaiting triggers...
[exit 0 at 11:30:53]
```

Then the walk made the two variants.

```
$ cub variant create dev cwwalk-1009b-apptique-base --stage dev --environment Dev --namespace apptique-dev --change-desc "Clone the base as dev"
Created variant space cwwalk-1009b-apptique-dev (ID: 8eca1259-7bb8-4b0f-a224-97de176113a4)
Set namespace "apptique-dev" on the cloned units in cwwalk-1009b-apptique-dev
Awaiting triggers...

Bulk create operation completed:
  Success: 4 unit(s)
[exit 0 at 11:31:03]

$ cub variant create prod cwwalk-1009b-apptique-base --stage prod --environment Prod --namespace apptique-prod --change-desc "Clone the base as prod"
Created variant space cwwalk-1009b-apptique-prod (ID: 4823373b-ac8a-4a68-911a-831fcb26d2ac)
Set namespace "apptique-prod" on the cloned units in cwwalk-1009b-apptique-prod
Awaiting triggers...

Bulk create operation completed:
  Success: 4 unit(s)
[exit 0 at 11:31:06]

$ cub space list --where "Slug LIKE 'cwwalk-1009b-%'"
NAME                          COMPONENT                OWNER    VARIANT    STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
cwwalk-1009b-apptique-base    cwwalk-1009b-apptique             base                                                  4
cwwalk-1009b-apptique-prod    cwwalk-1009b-apptique             prod       prod     Prod                              4
cwwalk-1009b-apptique-dev     cwwalk-1009b-apptique             dev        dev      Dev                               4
[exit 0 at 11:31:06]
```

`--namespace` ran `set-namespace` on each clone. It set the namespace on the
three namespaced objects and renamed the Namespace object. `--stage` set the
label that a workflow stage selects on.

The overlays' remaining differences went in as edits to the variants.

```
$ cub function set --space cwwalk-1009b-apptique-dev --change-desc "Label every object environment dev, as the dev overlay does" set-label environment dev
Function(s) succeeded on unit cwwalk-1009b-apptique-dev/frontend (90a0cf5a-91da-4cdc-b668-16eff5f7e545)
Config data changed
Function(s) succeeded on unit cwwalk-1009b-apptique-dev/frontend-service (c457e731-ec41-42f8-bd70-7b910d0d5074)
Config data changed
Function(s) succeeded on unit cwwalk-1009b-apptique-dev/frontend-serviceaccount (f8a28a0b-4ffc-4140-bf07-3e8a0c5f45cf)
Config data changed
Function(s) succeeded on unit cwwalk-1009b-apptique-dev/namespace (419cfb85-5cb8-4d5a-8eae-08279d6dfae1)
Config data changed
Awaiting triggers...
[exit 0 at 11:31:20]

$ cub function set --space cwwalk-1009b-apptique-prod --change-desc "Label every object environment prod, as the prod overlay does" set-label environment prod
Function(s) succeeded on unit cwwalk-1009b-apptique-prod/frontend (6475ae1a-7b55-406f-9a99-2957c8991df7)
Config data changed
Function(s) succeeded on unit cwwalk-1009b-apptique-prod/frontend-service (f4369faa-2434-4b9e-b081-9e891e4ad956)
Config data changed
Function(s) succeeded on unit cwwalk-1009b-apptique-prod/frontend-serviceaccount (d4d48b17-ffa4-4535-a133-3a431faaf8d2)
Config data changed
Function(s) succeeded on unit cwwalk-1009b-apptique-prod/namespace (a84a9b35-d381-4167-bd94-e53477e54087)
Config data changed
Awaiting triggers...
[exit 0 at 11:31:21]

$ cub function set --space cwwalk-1009b-apptique-prod --unit frontend --change-desc "Run three replicas in prod, as the prod overlay does" set-replicas 3
Function(s) succeeded on unit cwwalk-1009b-apptique-prod/frontend (6475ae1a-7b55-406f-9a99-2957c8991df7)
Config data changed
Awaiting triggers...
[exit 0 at 11:31:22]

$ cub function set --space cwwalk-1009b-apptique-prod --unit frontend --change-desc "Give prod the requests and limits of the prod overlay" set-container-resources server all 200m 128Mi 2
Function(s) succeeded on unit cwwalk-1009b-apptique-prod/frontend (6475ae1a-7b55-406f-9a99-2957c8991df7)
Config data changed
Awaiting triggers...
[exit 0 at 11:31:23]

$ for e in dev prod; do for u in namespace frontend-serviceaccount frontend-service frontend; do echo "---"; cub unit data --space cwwalk-1009b-apptique-$e $u; done > out/hub-$e.yaml; done; echo "== repository dev render against the dev Space"; cub config diff out/dev.yaml out/hub-dev.yaml; echo "== repository prod render against the prod Space"; cub config diff out/prod-before.yaml out/hub-prod.yaml
== repository dev render against the dev Space
Configuration diff: 0 added, 0 removed, 1 changed, 3 unchanged
  changed: apps/v1 Deployment apptique-dev/frontend
    /spec/template/spec/containers/server/image replace: "ghcr.io/confighub/apptique-frontend:v1.4.0" -> "ghcr.io/confighub/apptique-frontend:v1.3.0"
Local comparison only. This does not merge, protect edits or inspect a live target.
== repository prod render against the prod Space
Configuration diff: 0 added, 0 removed, 0 changed, 4 unchanged
Local comparison only. This does not merge, protect edits or inspect a live target.
[exit 0 at 11:31:28]
```

The prod Space holds exactly what the repository's prod overlay renders. The
dev Space differs from the repository's dev render in one field, the image tag,
because dev has not yet taken v1.4.0. Step 5 closes that difference.

### Step 4. Set up the gate and watch it refuse

`cub unit approve` does not exist in cub 0.8.7, and the walk found no function
for approvals in `cub function list`. The mechanism the walk found is a
ChangeWorkflow with an attestation prerequisite, and a Component that requires
a workflow. It took two commands.

The workflow has a dev stage and a prod stage. Entry into prod requires one
approval of the change as it stands in dev.

```
$ cub changeworkflow create --space cwwalk-1009b-apptique-base cwwalk-1009b-dev-then-prod --stage dev --stage prod --attestation-prerequisite approved --attestation-prerequisite-count approved=1 --attestation-prerequisite-description approved="One approval of the change as it stands in dev, by someone who did not write it" --stage-prerequisites prod=approved
Successfully created changeworkflow cwwalk-1009b-dev-then-prod (1b4379bb-e9f0-4785-9267-0bbe84d87085)
[exit 0 at 11:31:54]

$ cub changeworkflow get --space cwwalk-1009b-apptique-base cwwalk-1009b-dev-then-prod
ID                       1b4379bb-e9f0-4785-9267-0bbe84d87085
Name                     cwwalk-1009b-dev-then-prod
Space                    cwwalk-1009b-apptique-base
Created At               2026-10-09 10:31:54.367315 +0000 UTC
Updated At               2026-10-09 10:31:54.367315 +0000 UTC
Labels
Delete Gates
Annotations
Organization ID          <org-id>
Stage 1: dev             Labels.Stage = 'dev'
Stage 2: prod            Labels.Stage = 'prod'; gates: approved
Prerequisite approved    One approval of the change as it stands in dev, by someone who did not write it (1 Approval attestation(s), not by an author of the change)
[exit 0 at 11:31:54]

$ cub component get cwwalk-1009b-apptique
ID                         5f29ce8f-53d0-4926-bf80-368ac08f03bf
Name                       cwwalk-1009b-apptique
Created At                 2026-10-09 10:30:34.170738 +0000 UTC
Updated At                 2026-10-09 10:30:34.170738 +0000 UTC
Labels
Owner
Delete Gates
Annotations
Permissions                Manage: [<user-id>]
Allowed ChangeWorkflows
ChangeWorkflow Required    false
Organization ID            <org-id>
[exit 0 at 11:31:55]
```

The last line of the workflow says "not by an author of the change". That is
the default, and the walk did not ask for it.

A gate needs a change to hold, so the walk made the change in the base at this
point.

```
$ cub function set --space cwwalk-1009b-apptique-base --unit frontend --change-desc "Run image tag v1.4.0" set-container-image-reference server :v1.4.0
Function(s) succeeded on unit cwwalk-1009b-apptique-base/frontend (dac17ce7-8dec-4643-b4a8-3f289c9e7af5)
Config data changed
Awaiting triggers...
[exit 0 at 11:32:11]

$ cub revision list --space cwwalk-1009b-apptique-base frontend
NUM    UNIT        SOURCE           CHANGESET                 CHANGEORDERS    TAGS                            DESCRIPTION
4      frontend    Invoke                                                                                     Run image tag v1.4.0| Functions: set-container-...
3      frontend    Invoke                                                                                     Run image tag v1.3.0| Functions: set-container-...
2      frontend    MergeExternal    upload-20261009-103034                    upload-20261009-103034-end      Seed the base from the repository base directory
1      frontend    MergeExternal    upload-20261009-103034                    upload-20261009-103034-start    Empty revision preceding the unit's first conte...
[exit 0 at 11:32:12]
```

With the workflow created and nothing requiring it, a plain promotion into prod
was not held. The preview shows that it would go through.

```
$ cub variant promote cwwalk-1009b-apptique-prod --dry-run -o mutations
Changes to unit frontend from promote:
Resource: apps/v1/Deployment apptique-prod/frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0
[exit 0 at 11:32:14]
```

Then the Component was told to require a workflow.

```
$ cub component update --patch cwwalk-1009b-apptique --allowed-change-workflow cwwalk-1009b-apptique-base/cwwalk-1009b-dev-then-prod --change-workflow-required
Successfully updated component cwwalk-1009b-apptique (5f29ce8f-53d0-4926-bf80-368ac08f03bf)
[exit 0 at 11:32:20]

$ cub component get cwwalk-1009b-apptique
ID                         5f29ce8f-53d0-4926-bf80-368ac08f03bf
Name                       cwwalk-1009b-apptique
Created At                 2026-10-09 10:30:34.170738 +0000 UTC
Updated At                 2026-10-09 10:32:20.032241 +0000 UTC
Labels
Owner
Delete Gates
Annotations
Permissions                Manage: [<user-id>]
Allowed ChangeWorkflows    1b4379bb-e9f0-4785-9267-0bbe84d87085
ChangeWorkflow Required    true
Organization ID            <org-id>
[exit 0 at 11:32:20]
```

The same preview and the real command were both refused.

```
$ cub variant promote cwwalk-1009b-apptique-prod --dry-run -o mutations
Failed: HTTP 400 for req <request-id>: component cwwalk-1009b-apptique requires a ChangeWorkflow; use a ChangeOrder that has one

[exit 1 at 11:32:21]

$ cub variant promote cwwalk-1009b-apptique-prod --change-desc "Take v1.4.0 without a change order"
Failed: HTTP 400 for req <request-id>: component cwwalk-1009b-apptique requires a ChangeWorkflow; use a ChangeOrder that has one

[exit 1 at 11:32:28]

$ cub function get --space cwwalk-1009b-apptique-prod --unit frontend --quiet --show output get-container-image server
  Value: ghcr.io/confighub/apptique-frontend:v1.3.0  Path: spec.template.spec.containers.?name=server.image  Resource: apptique-prod/frontend  Type: apps/v1/Deployment
[exit 0 at 11:32:28]
```

The server's words are `component cwwalk-1009b-apptique requires a
ChangeWorkflow; use a ChangeOrder that has one`. Prod still ran v1.3.0.

### Step 5. Propose, preview and approve

This step took three change orders. The first ran under the workflow above and
showed the gate holding against the walk's only account. The second was the
walker's mistake. The third is the clean path.

#### The first change order, under the workflow that wants a second person

```
$ cub changeorder create --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0 --description "Run image tag v1.4.0" --component cwwalk-1009b-apptique --change-workflow cwwalk-1009b-apptique-base/cwwalk-1009b-dev-then-prod
Successfully created changeorder cwwalk-1009b-tag-v1-4-0 (85e70ff7-2003-4d84-8862-e95daa82cddb)
[exit 0 at 11:32:37]

$ cub changeorder get --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0
ID                       85e70ff7-2003-4d84-8862-e95daa82cddb
Name                     cwwalk-1009b-tag-v1-4-0
Space                    cwwalk-1009b-apptique-base
Update Type              UpgradeUnit
Created At               2026-10-09 10:32:37.117945 +0000 UTC
Updated At               2026-10-09 10:32:37.160996 +0000 UTC
Labels
Delete Gates
Annotations
Organization ID          <org-id>
Start Tag                cwwalk-1009b-tag-v1-4-0-co-start
End Tag                  cwwalk-1009b-tag-v1-4-0-co-end
Description              Run image tag v1.4.0
Skipped Units            frontend-service (already promoted through revision 2; marked, but carrying no revisions), frontend-serviceaccount (already promoted through revision 2; marked, but carrying no revisions), namespace (already promoted through revision 3; marked, but carrying no revisions)
State                    New
Stage
Completed                false
Change Workflow          cwwalk-1009b-dev-then-prod
Stage 1: dev             Labels.Stage = 'dev'
Stage 2: prod            Labels.Stage = 'prod'; gates: approved
Prerequisite approved    One approval of the change as it stands in dev, by someone who did not write it (1 Approval attestation(s), not by an author of the change)
Where Space              ComponentID = '5f29ce8f-53d0-4926-bf80-368ac08f03bf'
In-Scope Spaces          cwwalk-1009b-apptique-base, cwwalk-1009b-apptique-dev, cwwalk-1009b-apptique-prod
Resolved Spaces          cwwalk-1009b-apptique-base
Released Spaces
[exit 0 at 11:32:38]

$ cub variant diff cwwalk-1009b-apptique-base Before:ChangeOrder:cwwalk-1009b-tag-v1-4-0 ChangeOrder:cwwalk-1009b-tag-v1-4-0 -o mutations
=== cwwalk-1009b-apptique-base/frontend/3 -> cwwalk-1009b-apptique-base/frontend/4
Resource: apps/v1/Deployment /frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0
1 of 4 unit(s) changed between Before:ChangeOrder:cwwalk-1009b-tag-v1-4-0 and ChangeOrder:cwwalk-1009b-tag-v1-4-0 in cwwalk-1009b-apptique-base (3 unchanged, 0 at neither)
[exit 0 at 11:32:40]
```

The change order covers one revision of one Unit. The other three Units are
marked and carry nothing. Its in-scope Spaces are the base, dev and prod.

The walk tried prod before dev.

```
$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 --target-stage prod --dry-run
Failed: unable to promote to stage 'prod', Variant 'dev' has not taken change order 'cwwalk-1009b-tag-v1-4-0'
[exit 1 at 11:32:46]
```

The stage order holds. The change went into dev.

```
$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 --dry-run -o mutations
Changes to unit frontend from promote:
Resource: apps/v1/Deployment apptique-dev/frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0

Changes to unit frontend-service from promote:
No changes

Changes to unit frontend-serviceaccount from promote:
No changes

Changes to unit namespace from promote:
No changes
[exit 0 at 11:32:47]

$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 --change-desc "Take change order cwwalk-1009b-tag-v1-4-0 into dev"
Advancing change order cwwalk-1009b-tag-v1-4-0 to stage dev
Promoting cwwalk-1009b-apptique-dev into stage dev...
Upgraded 1 unit(s) behind their upstream
Marked 3 unit(s) the change order covers and carries no changes for
Adding 0 unit(s) from upstream at the change order's start
[exit 0 at 11:32:55]

$ for e in dev prod; do for u in namespace frontend-serviceaccount frontend-service frontend; do echo "---"; cub unit data --space cwwalk-1009b-apptique-$e $u; done > out/hub-$e.yaml; done; echo "== repository dev render against the dev Space"; cub config diff out/dev.yaml out/hub-dev.yaml; echo "== repository prod render against the prod Space"; cub config diff out/prod-before.yaml out/hub-prod.yaml
== repository dev render against the dev Space
Configuration diff: 0 added, 0 removed, 0 changed, 4 unchanged
Local comparison only. This does not merge, protect edits or inspect a live target.
== repository prod render against the prod Space
Configuration diff: 0 added, 0 removed, 0 changed, 4 unchanged
Local comparison only. This does not merge, protect edits or inspect a live target.
[exit 0 at 11:33:04]
```

ConfigHub now holds what the repository holds. Dev runs v1.4.0, prod runs
v1.3.0, and both Spaces equal the repository's renders.

Then the walk tried prod, with no approval.

```
$ cub variant promote cwwalk-1009b-apptique-prod --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 --dry-run -o mutations
Failed: unable to promote to stage 'prod', Variant 'dev': requires approved: 1 Approval attestation(s) from eligible attesters who did not write the change; frontend-service revision 4 has 0 of 1; frontend revision 5 has 0 of 1; namespace revision 4 has 0 of 1; frontend-serviceaccount revision 4 has 0 of 1
[exit 1 at 11:33:11]

$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 --target-stage prod --change-desc "Take change order cwwalk-1009b-tag-v1-4-0 into prod"
Failed: unable to promote to stage 'prod', Variant 'dev': requires approved: 1 Approval attestation(s) from eligible attesters who did not write the change; frontend-service revision 4 has 0 of 1; frontend revision 5 has 0 of 1; namespace revision 4 has 0 of 1; frontend-serviceaccount revision 4 has 0 of 1
[exit 1 at 11:33:12]

$ cub changeorder get --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0 -o json | jq ".ChangeOrder | {State, Stage, Promotions, PromotionFailures, PromotionOverrides}"
{
  "State": "InProgress",
  "Stage": "dev",
  "Promotions": [
    {
      "PromotedAt": "2026-10-09T10:32:55.423695398Z",
      "SpaceIDs": [
        "8eca1259-7bb8-4b0f-a224-97de176113a4"
      ],
      "Stage": "dev",
      "UserID": "<user-id>"
    }
  ],
  "PromotionFailures": null,
  "PromotionOverrides": null
}
[exit 0 at 11:33:31]
```

The gate refused, with `requires approved: 1 Approval attestation(s) from
eligible attesters who did not write the change`, and it named each revision in
dev with `0 of 1`. The refusal applies to the preview as well. A reviewer cannot
use `cub variant promote --dry-run` to see what prod would get until the
approval exists. The change order's record lists the promotion into dev and has
nothing for the two refused attempts.

Three other commands gave the preview.

```
$ cub variant diff cwwalk-1009b-apptique-dev Before:ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 -o mutations
=== cwwalk-1009b-apptique-dev/frontend/4 -> cwwalk-1009b-apptique-dev/frontend/5
Resource: apps/v1/Deployment apptique-dev/frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0
1 of 4 unit(s) changed between Before:ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 and ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 in cwwalk-1009b-apptique-dev (3 unchanged, 0 at neither)
[exit 0 at 11:33:32]

$ cub unit diff --space cwwalk-1009b-apptique-prod frontend --with-unit cwwalk-1009b-apptique-dev/frontend -o mutations
Resource: apps/v1/Deployment apptique-dev/frontend  (was apps/v1/Deployment apptique-prod/frontend)
  ~ [Update] metadata.labels.environment
      prod → dev
  ~ [Update] metadata.namespace
      apptique-prod → apptique-dev
  ~ [Update] spec.replicas
      3 → 1
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0
  ~ [Update] spec.template.spec.containers.?name=server.resources.limits.cpu
      400m → 200m
  ~ [Update] spec.template.spec.containers.?name=server.resources.limits.memory
      256Mi → 128Mi
  ~ [Update] spec.template.spec.containers.?name=server.resources.requests.cpu
      200m → 100m
  ~ [Update] spec.template.spec.containers.?name=server.resources.requests.memory
      128Mi → 64Mi
[exit 0 at 11:33:33]

$ yq "select(.kind == \"Deployment\")" out/prod-after.yaml > out/prod-after-deployment.yaml; cub unit diff --space cwwalk-1009b-apptique-prod frontend --from HeadRevisionNum --file out/prod-after-deployment.yaml -o mutations
Resource: apps/v1/Deployment apptique-prod/frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0
[exit 0 at 11:33:34]
```

The first shows the change as it stands in dev, which is what the approver is
asked to approve. The second shows every field in which prod differs from dev.
The third takes the Deployment from the Part 1 render of the one-line change
and asks what it would change in prod's Unit. It answers with the same one
field. That command joins the repository's change to ConfigHub's record of
prod.

The walk's only account then approved.

```
$ cub variant approve --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 --stage dev --dry-run
Would record pass Approval attestation in cwwalk-1009b-apptique-dev, covering 4 revision(s)
[exit 0 at 11:33:42]

$ cub variant approve --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 --stage dev --note "Reviewed the change as it stands in dev. One field changes, the frontend image tag, from v1.3.0 to v1.4.0."
Recorded pass Approval attestation b83f8506-86c9-4202-8c31-8590904ff623 in cwwalk-1009b-apptique-dev, covering 4 revision(s)
[exit 0 at 11:34:11]

$ cub attestation list --space cwwalk-1009b-apptique-dev
ATTESTATION-ID                          TYPE        RESULT    REVOKES    USER-ID                                 CREATED
b83f8506-86c9-4202-8c31-8590904ff623    Approval    Pass                 <user-id>    2026-10-09 10:34:11.175634 +0000 UTC
[exit 0 at 11:34:11]

$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 --target-stage prod --change-desc "Take change order cwwalk-1009b-tag-v1-4-0 into prod"
Failed: unable to promote to stage 'prod', Variant 'dev': requires approved: 1 Approval attestation(s) from eligible attesters who did not write the change; frontend-service revision 4 has 0 of 1; frontend revision 5 has 0 of 1; namespace revision 4 has 0 of 1; frontend-serviceaccount revision 4 has 0 of 1
[exit 1 at 11:34:12]
```

The server recorded the approval and still refused the promotion, with the same
message and the same `0 of 1`. The account wrote the change, so its approval
does not count. The server did not allow an author to approve by default.

The setting that lets an author approve is `AllowAuthors` on the attestation
prerequisite, set with `--attestation-prerequisite-allow-authors
<name>=true`. The help for `cub changeworkflow update` says that a change order
takes a copy of its workflow when it is created, so an edit applies only to
change orders created later. The walk left the first workflow as it was and
made a second one.

```
$ cub changeworkflow create --space cwwalk-1009b-apptique-base cwwalk-1009b-dev-then-prod-one-account --stage dev --stage prod --attestation-prerequisite approved --attestation-prerequisite-count approved=1 --attestation-prerequisite-allow-authors approved=true --attestation-prerequisite-description approved="One approval of the change as it stands in dev. An author may approve, because this walk has one account." --stage-prerequisites prod=approved
Successfully created changeworkflow cwwalk-1009b-dev-then-prod-one-account (07f690ef-90be-47f0-b866-c0eb28a56361)
[exit 0 at 11:34:35]

$ cub changeworkflow get --space cwwalk-1009b-apptique-base cwwalk-1009b-dev-then-prod-one-account
ID                       07f690ef-90be-47f0-b866-c0eb28a56361
Name                     cwwalk-1009b-dev-then-prod-one-account
Space                    cwwalk-1009b-apptique-base
Created At               2026-10-09 10:34:35.520485 +0000 UTC
Updated At               2026-10-09 10:34:35.520485 +0000 UTC
Labels
Delete Gates
Annotations
Organization ID          <org-id>
Stage 1: dev             Labels.Stage = 'dev'
Stage 2: prod            Labels.Stage = 'prod'; gates: approved
Prerequisite approved    One approval of the change as it stands in dev. An author may approve, because this walk has one account. (1 Approval attestation(s))
[exit 0 at 11:34:36]

$ cub component update --patch cwwalk-1009b-apptique --allowed-change-workflow cwwalk-1009b-apptique-base/cwwalk-1009b-dev-then-prod-one-account
Successfully updated component cwwalk-1009b-apptique (5f29ce8f-53d0-4926-bf80-368ac08f03bf)
[exit 0 at 11:34:36]
```

A second change order for the same change could not be created while dev and
prod stood at different revisions of the base.

```
$ cub changeorder create --dry-run -o yaml --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0-one-account --description "Run image tag v1.4.0" --component cwwalk-1009b-apptique --change-workflow cwwalk-1009b-apptique-base/cwwalk-1009b-dev-then-prod-one-account | grep -vE "^(CreatedAt|UpdatedAt|Version|OrganizationID|EntityType)"
Failed: HTTP 400 for req <request-id>: unit frontend: the targets are at different revisions of it (3, 4); upgrade them to the same revision or narrow the spaces the change order is headed for
Details:
  failed to create entity

[exit 1 at 11:34:37]
```

So the first change order was aborted and taken back out with
`cub variant demote`.

```
$ cub changeorder update --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0 --aborted-reason "The only account in this walk wrote the change, so its approval does not count under this workflow. The change is made again under a workflow that lets an author approve."
Successfully updated changeorder cwwalk-1009b-tag-v1-4-0 (85e70ff7-2003-4d84-8862-e95daa82cddb)
[exit 0 at 11:35:03]

$ cub variant demote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 --dry-run
Demoting cwwalk-1009b-apptique-dev...
Would restore 1 unit(s) to the revisions before change order cwwalk-1009b-tag-v1-4-0
Would mark 3 unit(s) the change order carried nothing for as restored, without a new revision
Demoting cwwalk-1009b-apptique-base...
Would restore 1 unit(s) to the revisions before change order cwwalk-1009b-tag-v1-4-0
Would mark 3 unit(s) the change order carried nothing for as restored, without a new revision
[exit 0 at 11:35:03]

$ cub variant demote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0 --change-desc "Take change order cwwalk-1009b-tag-v1-4-0 back out"
Demoting cwwalk-1009b-apptique-dev...
Restored 1 unit(s) to the revisions before change order cwwalk-1009b-tag-v1-4-0
Marked 3 unit(s) the change order carried nothing for as restored, without a new revision
Demoting cwwalk-1009b-apptique-base...
Restored 1 unit(s) to the revisions before change order cwwalk-1009b-tag-v1-4-0
Marked 3 unit(s) the change order carried nothing for as restored, without a new revision
[exit 0 at 11:35:10]

$ cub changeorder list --space cwwalk-1009b-apptique-base
NAME                       SPACE                         STATE              STAGE    COMPLETED    UPDATE-TYPE    DESCRIPTION             ABORTED-REASON
cwwalk-1009b-tag-v1-4-0    cwwalk-1009b-apptique-base    RestoreReleased    dev      false        UpgradeUnit    Run image tag v1.4.0    The only account in this walk wrote the change,...
[exit 0 at 11:35:10]

$ for s in base dev prod; do cub function get --space cwwalk-1009b-apptique-$s --unit frontend --quiet --show output get-container-image server; done
  Value: ghcr.io/confighub/apptique-frontend:v1.3.0  Path: spec.template.spec.containers.?name=server.image  Resource: /frontend  Type: apps/v1/Deployment
  Value: ghcr.io/confighub/apptique-frontend:v1.3.0  Path: spec.template.spec.containers.?name=server.image  Resource: apptique-dev/frontend  Type: apps/v1/Deployment
  Value: ghcr.io/confighub/apptique-frontend:v1.3.0  Path: spec.template.spec.containers.?name=server.image  Resource: apptique-prod/frontend  Type: apps/v1/Deployment
[exit 0 at 11:35:13]
```

The base and dev went back to v1.3.0, each with a new revision that holds the
earlier content.

#### The second change order, and the walker's mistake

The change was made again and a second change order went into dev.

```
$ cub function set --space cwwalk-1009b-apptique-base --unit frontend --change-desc "Run image tag v1.4.0" set-container-image-reference server :v1.4.0
Function(s) succeeded on unit cwwalk-1009b-apptique-base/frontend (dac17ce7-8dec-4643-b4a8-3f289c9e7af5)
Config data changed
Awaiting triggers...
[exit 0 at 11:35:23]

$ cub changeorder create --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0-one-account --description "Run image tag v1.4.0" --component cwwalk-1009b-apptique --change-workflow cwwalk-1009b-apptique-base/cwwalk-1009b-dev-then-prod-one-account
Successfully created changeorder cwwalk-1009b-tag-v1-4-0-one-account (7e443ee7-9dc5-46f5-a5ac-5b4a7475e21f)
[exit 0 at 11:35:24]

$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-one-account --change-desc "Take change order cwwalk-1009b-tag-v1-4-0-one-account into dev"
Advancing change order cwwalk-1009b-tag-v1-4-0-one-account to stage dev
Promoting cwwalk-1009b-apptique-dev into stage dev...
Upgraded 1 unit(s) behind their upstream
Marked 3 unit(s) the change order covers and carries no changes for
Adding 0 unit(s) from upstream at the change order's start
[exit 0 at 11:35:28]

$ for e in dev prod; do for u in namespace frontend-serviceaccount frontend-service frontend; do echo "---"; cub unit data --space cwwalk-1009b-apptique-$e $u; done > out/hub-$e.yaml; done; echo "== repository dev render against the dev Space"; cub config diff out/dev.yaml out/hub-dev.yaml; echo "== repository prod render against the prod Space"; cub config diff out/prod-before.yaml out/hub-prod.yaml
== repository dev render against the dev Space
Configuration diff: 0 added, 0 removed, 0 changed, 4 unchanged
Local comparison only. This does not merge, protect edits or inspect a live target.
== repository prod render against the prod Space
Configuration diff: 0 added, 0 removed, 0 changed, 4 unchanged
Local comparison only. This does not merge, protect edits or inspect a live target.
[exit 0 at 11:35:34]
```

The walker then ran the promotion into prod for real, expecting the refusal
seen twice before. It did not run the preview first.

```
$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-one-account --target-stage prod --change-desc "Take change order cwwalk-1009b-tag-v1-4-0-one-account into prod"
Promoting cwwalk-1009b-apptique-prod into stage prod...
Upgraded 1 unit(s) behind their upstream
Marked 3 unit(s) the change order covers and carries no changes for
Adding 0 unit(s) from upstream at the change order's start
[exit 0 at 11:35:43]

$ cub changeorder get --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0-one-account -o json | jq ".ChangeOrder | {State, Stage, Promotions}"
{
  "State": "Released",
  "Stage": "Completed",
  "Promotions": [
    {
      "PromotedAt": "2026-10-09T10:35:28.182888221Z",
      "SpaceIDs": [
        "8eca1259-7bb8-4b0f-a224-97de176113a4"
      ],
      "Stage": "dev",
      "UserID": "<user-id>"
    },
    {
      "PromotedAt": "2026-10-09T10:35:42.494834384Z",
      "SpaceIDs": [
        "4823373b-ac8a-4a68-911a-831fcb26d2ac"
      ],
      "Stage": "prod",
      "UserID": "<user-id>"
    }
  ]
}
[exit 0 at 11:36:30]

$ cub attestation get --space cwwalk-1009b-apptique-dev b83f8506-86c9-4202-8c31-8590904ff623
ID                 b83f8506-86c9-4202-8c31-8590904ff623
Type               Approval
Result             Pass
Change Order ID    85e70ff7-2003-4d84-8862-e95daa82cddb
Note               Reviewed the change as it stands in dev. One field changes, the frontend image tag, from v1.3.0 to v1.4.0.
User ID            <user-id>
Created At         2026-10-09 10:34:11.175634 +0000 UTC
Space              cwwalk-1009b-apptique-dev
[exit 0 at 11:36:30]

$ cub function get --space cwwalk-1009b-apptique-prod --unit frontend --quiet --show output get-container-image server; cub revision list --space cwwalk-1009b-apptique-prod frontend
  Value: ghcr.io/confighub/apptique-frontend:v1.4.0  Path: spec.template.spec.containers.?name=server.image  Resource: apptique-prod/frontend  Type: apps/v1/Deployment
NUM    UNIT        SOURCE         CHANGESET    CHANGEORDERS                        TAGS                                DESCRIPTION
7      frontend    UpgradeUnit                 cwwalk-1009b-apptique-base/cw...    cwwalk-1009b-apptique-base/cw...    Take change order cwwalk-1009b-tag-v1-4-0-one-a...
6      frontend    Invoke                                                          cwwalk-1009b-apptique-base/cw...    Give prod the requests and limits of the prod o...
5      frontend    Invoke                                                                                              Run three replicas in prod, as the prod overlay...
4      frontend    Invoke                                                                                              Label every object environment prod, as the pro...
3      frontend    Invoke                                                                                              Functions: set-namespace
2      frontend    CloneUnit                                                                                           Clone the base as prod
1      frontend    CloneUnit                                                                                           Empty revision preceding the unit's first content
[exit 0 at 11:36:32]
```

The promotion went through. No approval had been made under the second change
order. The approval made at 10:34:11 under the first change order satisfied
the gate, because the help for `cub variant approve` says an approval covers
"later revisions of the same unit with identical content", and dev's new
revision held the same content as the one approved. The new workflow lets an
author count. Prod's Space held v1.4.0 before prod had ever had a Release, and
before anyone had approved under the change order that carried it.

Nothing had been released. The walk aborted the second change order, took it
back out of all three Spaces, and withdrew the approval.

```
$ cub changeorder update --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0-one-account --aborted-reason "Promoted into prod by the walker in error. The earlier approval of the same content satisfied this gate at once, before prod had a first Release. The change is made a third time so that the order of events is plain."
Successfully updated changeorder cwwalk-1009b-tag-v1-4-0-one-account (7e443ee7-9dc5-46f5-a5ac-5b4a7475e21f)
[exit 0 at 11:36:43]

$ cub variant demote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-one-account --dry-run
Demoting cwwalk-1009b-apptique-dev...
Would restore 1 unit(s) to the revisions before change order cwwalk-1009b-tag-v1-4-0-one-account
Would mark 3 unit(s) the change order carried nothing for as restored, without a new revision
Demoting cwwalk-1009b-apptique-prod...
Would restore 1 unit(s) to the revisions before change order cwwalk-1009b-tag-v1-4-0-one-account
Would mark 3 unit(s) the change order carried nothing for as restored, without a new revision
Demoting cwwalk-1009b-apptique-base...
Would restore 1 unit(s) to the revisions before change order cwwalk-1009b-tag-v1-4-0-one-account
Would mark 3 unit(s) the change order carried nothing for as restored, without a new revision
[exit 0 at 11:36:44]

$ cub variant demote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-one-account --change-desc "Take change order cwwalk-1009b-tag-v1-4-0-one-account back out"
Demoting cwwalk-1009b-apptique-dev...
Restored 1 unit(s) to the revisions before change order cwwalk-1009b-tag-v1-4-0-one-account
Marked 3 unit(s) the change order carried nothing for as restored, without a new revision
Demoting cwwalk-1009b-apptique-prod...
Restored 1 unit(s) to the revisions before change order cwwalk-1009b-tag-v1-4-0-one-account
Marked 3 unit(s) the change order carried nothing for as restored, without a new revision
Demoting cwwalk-1009b-apptique-base...
Restored 1 unit(s) to the revisions before change order cwwalk-1009b-tag-v1-4-0-one-account
Marked 3 unit(s) the change order carried nothing for as restored, without a new revision
[exit 0 at 11:36:51]

$ cub attestation revoke --space cwwalk-1009b-apptique-dev b83f8506-86c9-4202-8c31-8590904ff623 --note "Recorded under a change order that was then aborted. Withdrawn so that the next change order starts with no approval."
Recorded a revocation of attestation b83f8506-86c9-4202-8c31-8590904ff623 in cwwalk-1009b-apptique-dev
[exit 0 at 11:36:52]

$ cub attestation list --space cwwalk-1009b-apptique-dev
ATTESTATION-ID                          TYPE        RESULT    REVOKES                                 USER-ID                                 CREATED
3b03884e-818e-471c-be97-f17505fa7ed6    Approval    Pass      b83f8506-86c9-4202-8c31-8590904ff623    <user-id>    2026-10-09 10:36:52.520173 +0000 UTC
b83f8506-86c9-4202-8c31-8590904ff623    Approval    Pass                                              <user-id>    2026-10-09 10:34:11.175634 +0000 UTC
[exit 0 at 11:36:53]

$ for s in base dev prod; do cub function get --space cwwalk-1009b-apptique-$s --unit frontend --quiet --show output get-container-image server; done; cub changeorder list --space cwwalk-1009b-apptique-base
  Value: ghcr.io/confighub/apptique-frontend:v1.3.0  Path: spec.template.spec.containers.?name=server.image  Resource: /frontend  Type: apps/v1/Deployment
  Value: ghcr.io/confighub/apptique-frontend:v1.3.0  Path: spec.template.spec.containers.?name=server.image  Resource: apptique-dev/frontend  Type: apps/v1/Deployment
  Value: ghcr.io/confighub/apptique-frontend:v1.3.0  Path: spec.template.spec.containers.?name=server.image  Resource: apptique-prod/frontend  Type: apps/v1/Deployment
NAME                                   SPACE                         STATE              STAGE        COMPLETED    UPDATE-TYPE    DESCRIPTION             ABORTED-REASON
cwwalk-1009b-tag-v1-4-0-one-account    cwwalk-1009b-apptique-base    RestoreReleased    Completed    true         UpgradeUnit    Run image tag v1.4.0    Promoted into prod by the walker in error. The ...
cwwalk-1009b-tag-v1-4-0                cwwalk-1009b-apptique-base    RestoreReleased    dev          false        UpgradeUnit    Run image tag v1.4.0    The only account in this walk wrote the change,...
[exit 0 at 11:36:55]

$ for e in prod; do for u in namespace frontend-serviceaccount frontend-service frontend; do echo "---"; cub unit data --space cwwalk-1009b-apptique-$e $u; done > out/hub-$e.yaml; done; echo "== repository prod render against the prod Space"; cub config diff out/prod-before.yaml out/hub-prod.yaml
== repository prod render against the prod Space
Configuration diff: 0 added, 0 removed, 0 changed, 4 unchanged
Local comparison only. This does not merge, protect edits or inspect a live target.
[exit 0 at 11:36:58]
```

A revocation is a second record that names the first. The first is kept. All
three Spaces ran v1.3.0 again, and prod again equalled the repository's prod
render.

#### The third change order, the clean path

```
$ cub function set --space cwwalk-1009b-apptique-base --unit frontend --change-desc "Run image tag v1.4.0" set-container-image-reference server :v1.4.0
Function(s) succeeded on unit cwwalk-1009b-apptique-base/frontend (dac17ce7-8dec-4643-b4a8-3f289c9e7af5)
Config data changed
Awaiting triggers...
[exit 0 at 11:37:10]

$ cub changeorder create --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0-third --description "Run image tag v1.4.0" --component cwwalk-1009b-apptique --change-workflow cwwalk-1009b-apptique-base/cwwalk-1009b-dev-then-prod-one-account
Successfully created changeorder cwwalk-1009b-tag-v1-4-0-third (2627e22b-094d-4a93-89c8-888537bdac13)
[exit 0 at 11:37:11]

$ cub changeorder get --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0-third
... (13 lines cut, the same header fields as the first change order, with this one's id, times and tags)
Skipped Units            frontend-service (already promoted through revision 2; marked, but carrying no revisions), frontend-serviceaccount (already promoted through revision 2; marked, but carrying no revisions), namespace (already promoted through revision 3; marked, but carrying no revisions)
State                    New
Stage
Completed                false
Change Workflow          cwwalk-1009b-dev-then-prod-one-account
Stage 1: dev             Labels.Stage = 'dev'
Stage 2: prod            Labels.Stage = 'prod'; gates: approved
Prerequisite approved    One approval of the change as it stands in dev. An author may approve, because this walk has one account. (1 Approval attestation(s))
Where Space              ComponentID = '5f29ce8f-53d0-4926-bf80-368ac08f03bf'
In-Scope Spaces          cwwalk-1009b-apptique-base, cwwalk-1009b-apptique-dev, cwwalk-1009b-apptique-prod
Resolved Spaces          cwwalk-1009b-apptique-base
Released Spaces
[exit 0 at 11:37:13]

$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third --dry-run -o mutations
Changes to unit frontend from promote:
Resource: apps/v1/Deployment apptique-dev/frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0

Changes to unit frontend-service from promote:
No changes

Changes to unit frontend-serviceaccount from promote:
No changes

Changes to unit namespace from promote:
No changes
[exit 0 at 11:37:14]

$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third --change-desc "Take change order cwwalk-1009b-tag-v1-4-0-third into dev"
Advancing change order cwwalk-1009b-tag-v1-4-0-third to stage dev
Promoting cwwalk-1009b-apptique-dev into stage dev...
Upgraded 1 unit(s) behind their upstream
Marked 3 unit(s) the change order covers and carries no changes for
Adding 0 unit(s) from upstream at the change order's start
[exit 0 at 11:37:15]
```

This time the preview came first.

```
$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third --target-stage prod --dry-run
Failed: unable to promote to stage 'prod', Variant 'dev': requires approved: 1 Approval attestation(s) from eligible attesters; frontend-service revision 4 has 0 of 1; frontend revision 9 has 0 of 1; namespace revision 4 has 0 of 1; frontend-serviceaccount revision 4 has 0 of 1
[exit 1 at 11:37:16]

$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third --target-stage prod --change-desc "Take change order cwwalk-1009b-tag-v1-4-0-third into prod"
Failed: unable to promote to stage 'prod', Variant 'dev': requires approved: 1 Approval attestation(s) from eligible attesters; frontend-service revision 4 has 0 of 1; frontend revision 9 has 0 of 1; namespace revision 4 has 0 of 1; frontend-serviceaccount revision 4 has 0 of 1
[exit 1 at 11:37:25]

$ for e in dev prod; do for u in namespace frontend-serviceaccount frontend-service frontend; do echo "---"; cub unit data --space cwwalk-1009b-apptique-$e $u; done > out/hub-$e.yaml; done; echo "== repository dev render against the dev Space"; cub config diff out/dev.yaml out/hub-dev.yaml; echo "== repository prod render against the prod Space"; cub config diff out/prod-before.yaml out/hub-prod.yaml
== repository dev render against the dev Space
Configuration diff: 0 added, 0 removed, 0 changed, 4 unchanged
Local comparison only. This does not merge, protect edits or inspect a live target.
== repository prod render against the prod Space
Configuration diff: 0 added, 0 removed, 0 changed, 4 unchanged
Local comparison only. This does not merge, protect edits or inspect a live target.
[exit 0 at 11:37:30]
```

The gate refused under the second workflow too, with `requires approved: 1
Approval attestation(s) from eligible attesters` and `0 of 1` for each of dev's
four revisions. The withdrawn approval no longer counted. ConfigHub again held
what the repository holds.

The previews gave the same answers as before.

```
$ cub variant diff cwwalk-1009b-apptique-dev Before:ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third -o mutations
=== cwwalk-1009b-apptique-dev/frontend/8 -> cwwalk-1009b-apptique-dev/frontend/9
Resource: apps/v1/Deployment apptique-dev/frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0
1 of 4 unit(s) changed between Before:ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third and ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third in cwwalk-1009b-apptique-dev (3 unchanged, 0 at neither)
[exit 0 at 11:37:32]

$ cub unit diff --space cwwalk-1009b-apptique-prod frontend --from HeadRevisionNum --file out/prod-after-deployment.yaml -o mutations
Resource: apps/v1/Deployment apptique-prod/frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0
[exit 0 at 11:37:32]
```

Then the walk approved, and read what the approval left behind.

```
$ cub variant approve --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third --stage dev --note "Reviewed the change as it stands in dev. One field changes, the frontend image tag, from v1.3.0 to v1.4.0."
Recorded pass Approval attestation b158b021-2bea-494e-b888-fe194eced1f8 in cwwalk-1009b-apptique-dev, covering 4 revision(s)
[exit 0 at 11:37:42]

$ cub attestation list --space cwwalk-1009b-apptique-dev
ATTESTATION-ID                          TYPE        RESULT    REVOKES                                 USER-ID                                 CREATED
3b03884e-818e-471c-be97-f17505fa7ed6    Approval    Pass      b83f8506-86c9-4202-8c31-8590904ff623    <user-id>    2026-10-09 10:36:52.520173 +0000 UTC
b158b021-2bea-494e-b888-fe194eced1f8    Approval    Pass                                              <user-id>    2026-10-09 10:37:42.055124 +0000 UTC
b83f8506-86c9-4202-8c31-8590904ff623    Approval    Pass                                              <user-id>    2026-10-09 10:34:11.175634 +0000 UTC
[exit 0 at 11:37:42]

$ cub attestation list --space cwwalk-1009b-apptique-dev -o json | jq "[.[] | (.Attestation // .) | del(.OrganizationID)] | sort_by(.CreatedAt) | last"
{
  "AttestationID": "b158b021-2bea-494e-b888-fe194eced1f8",
  "ChangeOrderID": "2627e22b-094d-4a93-89c8-888537bdac13",
  "CreatedAt": "2026-10-09T10:37:42.055124Z",
  "EntityType": "Attestation",
  "ExpiresAt": "0001-01-01T00:00:00Z",
  "Note": "Reviewed the change as it stands in dev. One field changes, the frontend image tag, from v1.3.0 to v1.4.0.",
  "Permissions": {
    "Manage": {
      "UserIDs": {
        "<user-id>": true
      }
    }
  },
  "Result": "Pass",
  "SpaceID": "8eca1259-7bb8-4b0f-a224-97de176113a4",
  "SpaceSlug": "cwwalk-1009b-apptique-dev",
  "Type": "Approval",
  "UpdatedAt": "2026-10-09T10:37:42.055125Z",
  "UserID": "<user-id>"
}
[exit 0 at 11:37:43]

$ cub revision list --space cwwalk-1009b-apptique-dev frontend -o jq='.[] | select(.Revision.RevisionNum >= 8) | {RevisionNum: .Revision.RevisionNum, Source: .Revision.Source, Description: .Revision.Description, Attestations: .Revision.Attestations}'
{
  "Attestations": {
    "b158b021-2bea-494e-b888-fe194eced1f8": ""
  },
  "Description": "Take change order cwwalk-1009b-tag-v1-4-0-third into dev",
  "RevisionNum": 9,
  "Source": "UpgradeUnit"
}
{
  "Attestations": null,
  "Description": "Take change order cwwalk-1009b-tag-v1-4-0-one-account back out",
  "RevisionNum": 8,
  "Source": "RestoreRevision"
}
[exit 0 at 11:37:43]

$ cub variant promote cwwalk-1009b-apptique-prod --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third --dry-run -o mutations
Changes to unit frontend from promote:
Resource: apps/v1/Deployment apptique-prod/frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0

Changes to unit frontend-service from promote:
No changes

Changes to unit frontend-serviceaccount from promote:
No changes

Changes to unit namespace from promote:
No changes
[exit 0 at 11:37:45]

$ cub changeorder get --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0-third | grep -E "^(State|Stage  |Completed|Resolved|Released)"
State                    InProgress
Stage                    dev
Completed                false
Resolved Spaces          cwwalk-1009b-apptique-base, cwwalk-1009b-apptique-dev
Released Spaces
[exit 0 at 11:38:02]
```

The approval record holds an id, the type `Approval`, the result `Pass`, the
id of the change order, the time, the Space, the note and the approver's user
id. It covers four revisions in dev, one per Unit, and revision 9 of `frontend`
lists the attestation. The record gives a user id and no name. The command
that turns the id into an account is in step 7.

After the approval the preview for prod went through and showed the one field.
The walk held the promotion itself until prod had a first Release.

## Part 3. Release and delivery to a throwaway cluster

### Step 6. A cluster, a Release before the change, and a Release after it

The help for `cub cluster up` was read first. It says the command creates a
kind cluster, installs Argo CD, and makes two Spaces. One holds a server-hosted
Worker and a Target. The other holds the root Argo CD Application and one
Application Unit per deployment. It also makes a `no-placeholders` Trigger, and
it installs argobot unless told not to.

```
$ cub cluster list; docker ps --format "{{.Names}} {{.Ports}}" | grep -E "3001[0-9]" ; echo "containers publishing 30010 to 30019: $(docker ps --format "{{.Ports}}" | grep -cE "3001[0-9]")"; lsof -nP -iTCP:30010-30019 -sTCP:LISTEN 2>/dev/null | wc -l
... (8 lines cut, the header and seven rows for other clusters on the machine)
containers publishing 30010 to 30019: 0
       0
[exit 0 at 11:38:03]

$ cub cluster up --name cwwalk-1009b --no-argobot
Creating kind cluster "cwwalk-1009b" (kubeconfig: $HOME/.confighub/clusters/cwwalk-1009b.kubeconfig)...
... (88 lines cut, the kind steps and one line per Argo CD object applied)
Patching argocd-cmd-params-cm (server.insecure=true)...
configmap/argocd-cmd-params-cm patched
Patching argocd-cm (ignoreDifferences for self-referencing root Application)...
configmap/argocd-cm patched
Patching argocd-server Service to NodePort 30010...
service/argocd-server patched
Restarting argocd-server to pick up cmd-params change...
deployment.apps/argocd-server restarted
Waiting for argocd-server Deployment to be Available (timeout 5m)...
deployment.apps/argocd-server condition met
Fetching initial admin password...
Creating ConfigHub space "cwwalk-1009b" (worker + target)...
Creating server-hosted OCI worker "worker" (OrgRole=none)...
Creating placeholder gate trigger "no-placeholders" (vet-placeholders on every Mutation)...
Creating OCI target "target" pulled by worker "worker"...
Creating ConfigHub space "cwwalk-1009b-argo-apps" (Argo Application Units)...
Setting the apps space's release target to "cwwalk-1009b/target"...
Applying confighub-oci-creds repo-creds Secret to argocd namespace...
Applying confighub-oci-creds repo-creds Secret to argocd namespace...
secret/confighub-oci-creds created
Creating root Application Unit "root" in apps space "cwwalk-1009b-argo-apps"...

Publishing the apps space's release (populates the OCI bundle Argo pulls)...
Bootstrapping root Application via kubectl (the only kubectl-apply moment)...
Warning: metadata.finalizers: "resources-finalizer.argocd.argoproj.io": prefer a domain-qualified finalizer name including a path (/) to avoid accidental conflicts with other finalizer writers
application.argoproj.io/cwwalk-1009b-argo-apps created

Done.
  cluster:    cwwalk-1009b
  kubeconfig: $HOME/.confighub/clusters/cwwalk-1009b.kubeconfig
  env file:   $HOME/.confighub/clusters/cwwalk-1009b.env
  space:      cwwalk-1009b
  apps space: cwwalk-1009b-argo-apps
  worker:     cwwalk-1009b/worker
  target:     cwwalk-1009b/target
  root app:   cwwalk-1009b-argo-apps/root
  gates:      cwwalk-1009b/no-placeholders (vet-placeholders) — blocks publishing a Release with
              unfilled confighubplaceholder values to this cluster

Argo CD: http://localhost:30010  (admin / <argo-password>)
Reopen it later with the password on your clipboard:
  cub cluster open cwwalk-1009b

User NodePort window: 30010-30019 (argo uses 30010; rest are open)

Load the cluster + Argo creds into your shell:
  source $HOME/.confighub/clusters/cwwalk-1009b.env

Deploy an app to this cluster:
  1. cub variant create <name> <base-space> --target cwwalk-1009b/target [--namespace <ns>]
  2. cub release publish <name>
Step 1 clones <base-space> into a deployment space bound to the cluster's
target and auto-creates its Argo CD Application in the apps space "cwwalk-1009b-argo-apps"
(republishing it so Argo picks it up); step 2 makes the deployment's config
go live. See "cub variant create --help".
[exit 0 at 11:39:47]

$ shasum -a 256 $HOME/.kube/config | cut -c1-64 | diff - out/kubeconfig-before.sha && echo "default kubeconfig unchanged"; kubectl config current-context 2>&1; kind get clusters | grep cwwalk; docker ps --format "{{.Names}} {{.Image}}" | grep cwwalk
default kubeconfig unchanged
error: current-context is not set
cwwalk-1009b
cwwalk-1009b-control-plane kindest/node:v1.35.0
[exit 0 at 11:39:56]

$ export KUBECONFIG=$HOME/.confighub/clusters/cwwalk-1009b.kubeconfig; kubectl config current-context; kubectl get nodes; kubectl -n argocd get pods; kubectl -n argocd get applications.argoproj.io; kubectl -n argocd get deploy argocd-server -o jsonpath="{.spec.template.spec.containers[0].image}"; echo
kind-cwwalk-1009b
NAME                         STATUS   ROLES           AGE   VERSION
cwwalk-1009b-control-plane   Ready    control-plane   96s   v1.35.0
NAME                                                READY   STATUS    RESTARTS   AGE
argocd-application-controller-0                     1/1     Running   0          87s
argocd-applicationset-controller-5c66f59556-ldsz4   1/1     Running   0          87s
argocd-dex-server-64cc54b998-4p8t2                  1/1     Running   0          87s
argocd-notifications-controller-68d59788b7-qglxs    1/1     Running   0          87s
argocd-redis-7f877d46b7-xd2t8                       1/1     Running   0          87s
argocd-repo-server-7bc46c4ddf-2zbwb                 1/1     Running   0          87s
argocd-server-6b5bc69595-t2j9d                      1/1     Running   0          86s
NAME                     SYNC STATUS   HEALTH STATUS
cwwalk-1009b-argo-apps   Synced        Healthy
quay.io/argoproj/argocd:v3.5.4
[exit 0 at 11:39:56]

$ cub space list --where "Slug LIKE 'cwwalk-1009b%'" -o wide
NAME                          COMPONENT                OWNER    VARIANT    STAGE    ENVIRONMENT    REGION    LAYER    #UNITS    #LINKS    #TAGS    #CHANGESETS    #CHANGEORDERS    #CHANGEWORKFLOWS    #FILTERS    #VIEWS    #INVOCATIONS    #TRIGGERS    #WORKERS    #TARGETS    #ATTRIBUTES
cwwalk-1009b-apptique-base    cwwalk-1009b-apptique             base                                                  4         5         10       1              3                2                   0           0         0               0            0           0           0
cwwalk-1009b                                                                                                          0         0         0        0              0                0                   0           0         0               1            1           1           0
cwwalk-1009b-apptique-prod    cwwalk-1009b-apptique             prod       prod     Prod                              4         9         0        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009b-apptique-dev     cwwalk-1009b-apptique             dev        dev      Dev                               4         9         0        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009b-argo-apps                                                                                                1         0         1        0              0                0                   0           0         0               0            0           0           0
[exit 0 at 11:39:57]

$ cub worker list --space cwwalk-1009b; cub target list --space cwwalk-1009b; cub trigger list --space cwwalk-1009b; cub unit list --space cwwalk-1009b-argo-apps; cub release list --space cwwalk-1009b-argo-apps
NAME      CONDITION    SPACE           LAST-SEEN
worker    Ready        cwwalk-1009b    2026-10-09 10:39:45
NAME      SPACE           LABELS
target    cwwalk-1009b
NAME               SPACE           WORKER    EVENT       VALIDATING    DISABLED    WARN     TOOLCHAIN-TYPE     FUNCTION-NAME       NUM-ARGS    INVOCATION
no-placeholders    cwwalk-1009b              Mutation    true          false       false    Kubernetes/YAML    vet-placeholders    0
NAME    SPACE                     CHANGESET    TARGET    UPGRADE-NEEDED    UNRELEASED-CHANGES    VALIDATION-ERRORS    LAST-CHANGE-DESCRIPTION
root    cwwalk-1009b-argo-apps                 target                                                                 UpdateUnit
NUM    TAG          PUBLISHED    DIGEST          LIVE    CREATED
1      release-1    true         a6f917713c7e            2026-10-09 10:39:47
[exit 0 at 11:39:59]
```

The command took under two minutes. It made one kind cluster as one
container, two files under `$HOME/.confighub/clusters/`, and two Spaces. kind
set a current context in the cluster's own kubeconfig file. The default
kubeconfig was unchanged, by checksum. Every kubectl command in this walk named
the cluster's file through `KUBECONFIG` in its own shell.

The variants existed before the cluster, so they had no Target.
`cub variant create --target` gives a new variant its Target and writes its
Argo CD Application. The walk found no command that does the same for a
variant that already exists, and it did the three parts by hand.

```
$ cub space update --patch cwwalk-1009b-apptique-prod --release-target cwwalk-1009b/target
Successfully updated space cwwalk-1009b-apptique-prod (4823373b-ac8a-4a68-911a-831fcb26d2ac)
[exit 0 at 11:40:21]

$ cub unit list --space cwwalk-1009b-apptique-prod
NAME                       SPACE                         CHANGESET    TARGET    UPGRADE-NEEDED    UNRELEASED-CHANGES    VALIDATION-ERRORS    LAST-CHANGE-DESCRIPTION
frontend                   cwwalk-1009b-apptique-prod                           Yes                                                          Take change order cwwalk-1009b-tag-v1-4-0-one-account back out
namespace                  cwwalk-1009b-apptique-prod                           No                                                           Label every object environment prod, as the prod overlay does| Functions: set-label
frontend-serviceaccount    cwwalk-1009b-apptique-prod                           No                                                           Label every object environment prod, as the prod overlay does| Functions: set-label
frontend-service           cwwalk-1009b-apptique-prod                           No                                                           Label every object environment prod, as the prod overlay does| Functions: set-label
[exit 0 at 11:40:21]

$ cub unit set-target --space cwwalk-1009b-apptique-prod cwwalk-1009b/target --where "Slug LIKE '%'"

Bulk set-target operation completed:
  Success: 4 unit(s)
  Context: target cwwalk-1009b/target
[exit 0 at 11:40:28]

$ cub unit list --space cwwalk-1009b-apptique-prod
NAME                       SPACE                         CHANGESET    TARGET    UPGRADE-NEEDED    UNRELEASED-CHANGES    VALIDATION-ERRORS    LAST-CHANGE-DESCRIPTION
frontend                   cwwalk-1009b-apptique-prod                 target    Yes               Yes                                        Take change order cwwalk-1009b-tag-v1-4-0-one-account back out
namespace                  cwwalk-1009b-apptique-prod                 target    No                Yes                                        Label every object environment prod, as the prod overlay does| Functions: set-label
frontend-serviceaccount    cwwalk-1009b-apptique-prod                 target    No                Yes                                        Label every object environment prod, as the prod overlay does| Functions: set-label
frontend-service           cwwalk-1009b-apptique-prod                 target    No                Yes                                        Label every object environment prod, as the prod overlay does| Functions: set-label
[exit 0 at 11:40:29]
```

Setting the Space's release Target did not give the Units the Target. The
second command did.

Prod then needed a first Release, with v1.3.0. Three commands were refused.

```
$ cub release publish cwwalk-1009b-apptique-prod
Failed: HTTP 400 for req <request-id>: component cwwalk-1009b-apptique requires a ChangeWorkflow; use a ChangeOrder that has one

[exit 1 at 11:40:29]

$ cub release publish --revision Before:ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third cwwalk-1009b-apptique-prod
Failed: HTTP 400 for req <request-id>: component cwwalk-1009b-apptique requires a ChangeWorkflow; use a ChangeOrder that has one

[exit 1 at 11:40:38]

$ cub release publish --revision ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third cwwalk-1009b-apptique-prod
Failed: HTTP 500 for req <request-id>: no Revision found for Unit namespace with the specified TagID 8898a079-9a7c-4f3b-9f06-9356da9cd71a

[exit 1 at 11:40:48]

$ cub release list --space cwwalk-1009b-apptique-prod
NUM    TAG    PUBLISHED    DIGEST    LIVE    CREATED
[exit 0 at 11:40:48]
```

A plain publish needs a change order. `Before:ChangeOrder:` is refused with the
same words. Naming the change order itself, before it has been promoted into
prod, returned HTTP 500. No Release was made.

The walk tried a change order that carries no change and is headed only for
prod, so that prod could be released as it stood.

```
$ cub changeorder create --space cwwalk-1009b-apptique-base cwwalk-1009b-prod-as-it-stands --description "Mark prod as it stands, with no change, so that it can have a first Release" --in-scope-space cwwalk-1009b-apptique-prod --end-tag cwwalk-1009b-tag-v1-4-0-third-co-start --change-workflow cwwalk-1009b-apptique-base/cwwalk-1009b-dev-then-prod-one-account
Successfully created changeorder cwwalk-1009b-prod-as-it-stands (eee43bf1-d04d-4045-995f-97210b73db0f)
[exit 0 at 11:41:37]

$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-prod-as-it-stands --dry-run
Advancing change order cwwalk-1009b-prod-as-it-stands to stage dev
[exit 0 at 11:41:44]

$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-prod-as-it-stands --target-stage prod --dry-run
Failed: unable to promote to stage 'prod', its previous stage 'dev' selects no Space
[exit 1 at 11:41:44]

$ cub changeorder update --space cwwalk-1009b-apptique-base cwwalk-1009b-prod-as-it-stands --aborted-reason "It cannot reach prod. The workflow has a dev stage, and this change order selects no Space for it."
Successfully updated changeorder cwwalk-1009b-prod-as-it-stands (eee43bf1-d04d-4045-995f-97210b73db0f)
[exit 0 at 11:42:09]
```

It could not reach prod, because the workflow's dev stage then selects no
Space. The walk aborted it.

The two Argo CD Applications were written by hand, in the form that
`cub variant create --target` wrote in the walk of 2026-10-08.

```
$ cat out/argo-app-prod.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cwwalk-1009b-apptique-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: oci://oci.hub.confighub.com:443/space/cwwalk-1009b-apptique-prod
    targetRevision: latest
    path: .
  destination:
    server: https://kubernetes.default.svc
  syncPolicy:
    automated:
      selfHeal: true
      allowEmpty: true
[exit 0 at 11:42:18]

$ cub unit create --space cwwalk-1009b-argo-apps cwwalk-1009b-apptique-prod out/argo-app-prod.yaml --target cwwalk-1009b/target --change-desc "Argo CD Application that reads the prod Space"
Successfully created unit cwwalk-1009b-apptique-prod (760a07f9-d7e4-484c-bdea-9f3aa44c4ca8)
[exit 0 at 11:42:19]

$ cub unit create --space cwwalk-1009b-argo-apps cwwalk-1009b-apptique-dev out/argo-app-dev.yaml --target cwwalk-1009b/target --change-desc "Argo CD Application that reads the dev Space"
Successfully created unit cwwalk-1009b-apptique-dev (478af72b-d521-42aa-a073-0a2c3c3a6020)
[exit 0 at 11:42:20]

$ cub space update --patch cwwalk-1009b-apptique-dev --release-target cwwalk-1009b/target
Successfully updated space cwwalk-1009b-apptique-dev (8eca1259-7bb8-4b0f-a224-97de176113a4)
[exit 0 at 11:42:21]

$ cub unit set-target --space cwwalk-1009b-apptique-dev cwwalk-1009b/target --where "Slug LIKE '%'"

Bulk set-target operation completed:
  Success: 4 unit(s)
  Context: target cwwalk-1009b/target
[exit 0 at 11:42:23]

$ cub unit list --space cwwalk-1009b-argo-apps; cub release publish cwwalk-1009b-argo-apps; cub release list --space cwwalk-1009b-argo-apps
NAME                          SPACE                     CHANGESET    TARGET    UPGRADE-NEEDED    UNRELEASED-CHANGES    VALIDATION-ERRORS    LAST-CHANGE-DESCRIPTION
root                          cwwalk-1009b-argo-apps                 target                                                                 UpdateUnit
cwwalk-1009b-apptique-dev     cwwalk-1009b-argo-apps                 target                      Yes                                        Argo CD Application that reads the dev Space
cwwalk-1009b-apptique-prod    cwwalk-1009b-argo-apps                 target                      Yes                                        Argo CD Application that reads the prod Space
Successfully created release 456ad15e-5410-435d-9a80-e121a40f6a1f (456ad15e-5410-435d-9a80-e121a40f6a1f)
NUM    TAG          PUBLISHED    DIGEST          LIVE    CREATED
2      release-2    true         2a5a8ac79504            2026-10-09 10:42:24
1      release-1    true         a6f917713c7e            2026-10-09 10:39:47
[exit 0 at 11:42:24]
```

For prod's first Release the walk switched the Component's requirement off,
published, and switched it back on. The requirement was off for about one
second.

```
$ cub function get --space cwwalk-1009b-apptique-prod --unit frontend --quiet --show output get-container-image server
  Value: ghcr.io/confighub/apptique-frontend:v1.3.0  Path: spec.template.spec.containers.?name=server.image  Resource: apptique-prod/frontend  Type: apps/v1/Deployment
[exit 0 at 11:42:31]

$ cub component update --patch cwwalk-1009b-apptique --change-workflow-required=false
Successfully updated component cwwalk-1009b-apptique (5f29ce8f-53d0-4926-bf80-368ac08f03bf)
[exit 0 at 11:42:32]

$ cub release publish cwwalk-1009b-apptique-prod
Successfully created release 1bdb2dfe-6f47-456a-ab00-1395a326784f (1bdb2dfe-6f47-456a-ab00-1395a326784f)
[exit 0 at 11:42:32]

$ cub component update --patch cwwalk-1009b-apptique --change-workflow-required
Successfully updated component cwwalk-1009b-apptique (5f29ce8f-53d0-4926-bf80-368ac08f03bf)
[exit 0 at 11:42:33]

$ cub component get cwwalk-1009b-apptique | grep -E "Updated At|Allowed|Required"; cub release list --space cwwalk-1009b-apptique-prod
Updated At                 2026-10-09 10:42:33.466419 +0000 UTC
Allowed ChangeWorkflows    07f690ef-90be-47f0-b866-c0eb28a56361, 1b4379bb-e9f0-4785-9267-0bbe84d87085
ChangeWorkflow Required    true
NUM    TAG          PUBLISHED    DIGEST          LIVE    CREATED
1      release-1    true         c587031ffa93            2026-10-09 10:42:32
[exit 0 at 11:42:34]

$ cub release publish cwwalk-1009b-apptique-prod
Failed: HTTP 400 for req <request-id>: component cwwalk-1009b-apptique requires a ChangeWorkflow; use a ChangeOrder that has one

[exit 1 at 11:42:35]
```

This is a departure from the gate, and the log does not hide it. The Release
holds prod as it stood, which step 5 showed to equal the repository's prod
render. An account that manages the Component can switch the requirement off.
In a real organization the first Release would have come before the gate, or
under an earlier change order.

The cluster then ran prod at v1.3.0.

```
$ export KUBECONFIG=$HOME/.confighub/clusters/cwwalk-1009b.kubeconfig; kubectl -n argocd wait --for=create applications.argoproj.io/cwwalk-1009b-apptique-prod --timeout=420s; kubectl -n argocd get applications.argoproj.io
application.argoproj.io/cwwalk-1009b-apptique-prod condition met
NAME                         SYNC STATUS   HEALTH STATUS
cwwalk-1009b-apptique-dev
cwwalk-1009b-apptique-prod
cwwalk-1009b-argo-apps       OutOfSync     Healthy
[exit 0 at 11:44:21]

$ export KUBECONFIG=$HOME/.confighub/clusters/cwwalk-1009b.kubeconfig; kubectl wait --for=create namespace/apptique-prod --timeout=300s; kubectl -n apptique-prod wait --for=create deployment/frontend --timeout=120s; kubectl -n argocd get applications.argoproj.io; kubectl -n apptique-prod get deployment frontend -o jsonpath="{.spec.template.spec.containers[0].image}{\"  replicas=\"}{.spec.replicas}{\"\n\"}"
namespace/apptique-prod condition met
deployment.apps/frontend condition met
NAME                         SYNC STATUS   HEALTH STATUS
cwwalk-1009b-apptique-dev    Unknown       Healthy
cwwalk-1009b-apptique-prod   OutOfSync     Missing
cwwalk-1009b-argo-apps       Synced        Healthy
ghcr.io/confighub/apptique-frontend:v1.3.0  replicas=3
[exit 0 at 11:44:38]

$ export KUBECONFIG=$HOME/.confighub/clusters/cwwalk-1009b.kubeconfig; kubectl -n argocd get applications.argoproj.io; kubectl -n apptique-prod get deployment,pods -o wide | cut -c1-200; kubectl -n argocd get applications.argoproj.io cwwalk-1009b-apptique-prod -o jsonpath="{.status.sync.status}{\" \"}{.status.health.status}{\" revision=\"}{.status.sync.revision}{\"\n\"}{range .status.resources[*]}{.kind}{\" \"}{.namespace}{\"/\"}{.name}{\" \"}{.status}{\" \"}{.health.status}{\"\n\"}{end}"
NAME                         SYNC STATUS   HEALTH STATUS
cwwalk-1009b-apptique-dev    Unknown       Healthy
cwwalk-1009b-apptique-prod   Synced        Progressing
cwwalk-1009b-argo-apps       Synced        Healthy
NAME                       READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS   IMAGES                                       SELECTOR
deployment.apps/frontend   0/3     3            0           54s   server       ghcr.io/confighub/apptique-frontend:v1.3.0   app=apptique,component=frontend

NAME                            READY   STATUS             RESTARTS   AGE   IP            NODE                         NOMINATED NODE   READINESS GATES
pod/frontend-659796cf84-hhxbq   0/1     ImagePullBackOff   0          54s   10.244.0.12   cwwalk-1009b-control-plane   <none>           <none>
pod/frontend-659796cf84-wdl5f   0/1     ErrImagePull       0          54s   10.244.0.14   cwwalk-1009b-control-plane   <none>           <none>
pod/frontend-659796cf84-wg5g9   0/1     ErrImagePull       0          54s   10.244.0.13   cwwalk-1009b-control-plane   <none>           <none>
Synced Progressing revision=sha256:c587031ffa937059576c65d0da7a90cf6d46db4112d4c5861cf42b62545fa3d5
Namespace /apptique-prod Synced
Service apptique-prod/frontend Synced
ServiceAccount apptique-prod/frontend Synced
Deployment apptique-prod/frontend Synced
[exit 0 at 11:45:31]

$ export KUBECONFIG=$HOME/.confighub/clusters/cwwalk-1009b.kubeconfig; kubectl -n apptique-prod get pods -o jsonpath="{range .items[*]}{.metadata.name}{\" \"}{.status.containerStatuses[0].state.waiting.reason}{\": \"}{.status.containerStatuses[0].state.waiting.message}{\"\n\"}{end}"; kubectl -n apptique-prod get deployment frontend -o jsonpath="{.metadata.annotations}" | jq .
frontend-659796cf84-hhxbq ImagePullBackOff: Back-off pulling image "ghcr.io/confighub/apptique-frontend:v1.3.0": ErrImagePull: failed to pull and unpack image "ghcr.io/confighub/apptique-frontend:v1.3.0": failed to resolve reference "ghcr.io/confighub/apptique-frontend:v1.3.0": failed to authorize: failed to fetch anonymous token: unexpected status from GET request to https://ghcr.io/token?scope=repository%3Aconfighub%2Fapptique-frontend%3Apull&service=ghcr.io: 403 Forbidden
frontend-659796cf84-wdl5f ErrImagePull: failed to pull and unpack image "ghcr.io/confighub/apptique-frontend:v1.3.0": failed to resolve reference "ghcr.io/confighub/apptique-frontend:v1.3.0": failed to authorize: failed to fetch anonymous token: unexpected status from GET request to https://ghcr.io/token?scope=repository%3Aconfighub%2Fapptique-frontend%3Apull&service=ghcr.io: 403 Forbidden
frontend-659796cf84-wg5g9 ErrImagePull: failed to pull and unpack image "ghcr.io/confighub/apptique-frontend:v1.3.0": failed to resolve reference "ghcr.io/confighub/apptique-frontend:v1.3.0": failed to authorize: failed to fetch anonymous token: unexpected status from GET request to https://ghcr.io/token?scope=repository%3Aconfighub%2Fapptique-frontend%3Apull&service=ghcr.io: 403 Forbidden
{
  "argocd.argoproj.io/tracking-id": "cwwalk-1009b-apptique-prod:apps/Deployment:apptique-prod/frontend",
  "confighub.com/origin": "{\"spaceId\":\"4823373b-ac8a-4a68-911a-831fcb26d2ac\",\"spaceSlug\":\"cwwalk-1009b-apptique-prod\",\"unitId\":\"6475ae1a-7b55-406f-9a99-2957c8991df7\",\"unitSlug\":\"frontend\",\"revisionNum\":8}",
  "deployment.kubernetes.io/revision": "1",
... (1 line cut, the last-applied-configuration annotation, about 1,400 characters)
}
[exit 0 at 11:45:31]
```

Argo CD created the prod Application within two minutes of the apps Space's
Release. The Application read `Synced` and `Progressing`, and its synced
revision is the manifest digest of Release 1. The Deployment's image is
`ghcr.io/confighub/apptique-frontend:v1.3.0` with three replicas. The pods
cannot pull the image, because the registry answers `403 Forbidden` to an
anonymous pull. The Deployment's image field is the observation that matters
here, and the Application will not reach `Healthy` with this example. The
`confighub.com/origin` annotation names the prod Space, the Unit `frontend` and
revision 8.

Then the approved change was applied to prod and released.

```
$ cub variant promote --change-order cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third --target-stage prod --change-desc "Take change order cwwalk-1009b-tag-v1-4-0-third into prod"
Promoting cwwalk-1009b-apptique-prod into stage prod...
Upgraded 1 unit(s) behind their upstream
Marked 3 unit(s) the change order covers and carries no changes for
Adding 0 unit(s) from upstream at the change order's start
[exit 0 at 11:45:41]

$ cub unit list --space cwwalk-1009b-apptique-prod
NAME                       SPACE                         CHANGESET    TARGET    UPGRADE-NEEDED    UNRELEASED-CHANGES    VALIDATION-ERRORS    LAST-CHANGE-DESCRIPTION
frontend                   cwwalk-1009b-apptique-prod                 target    No                Yes                                        Take change order cwwalk-1009b-tag-v1-4-0-third into prod
namespace                  cwwalk-1009b-apptique-prod                 target    No                                                           Label every object environment prod, as the prod overlay does| Functions: set-label
frontend-serviceaccount    cwwalk-1009b-apptique-prod                 target    No                                                           Label every object environment prod, as the prod overlay does| Functions: set-label
frontend-service           cwwalk-1009b-apptique-prod                 target    No                                                           Label every object environment prod, as the prod overlay does| Functions: set-label
[exit 0 at 11:45:42]

$ cub variant diff cwwalk-1009b-apptique-prod Before:ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third -o mutations
=== cwwalk-1009b-apptique-prod/frontend/8 -> cwwalk-1009b-apptique-prod/frontend/9
Resource: apps/v1/Deployment apptique-prod/frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0
1 of 4 unit(s) changed between Before:ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third and ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third in cwwalk-1009b-apptique-prod (3 unchanged, 0 at neither)
[exit 0 at 11:45:43]

$ for u in namespace frontend-serviceaccount frontend-service frontend; do echo "---"; cub unit data --space cwwalk-1009b-apptique-prod $u; done > out/hub-prod-after.yaml; echo "== render of the one-line repository change against the prod Space"; cub config diff out/prod-after.yaml out/hub-prod-after.yaml
== render of the one-line repository change against the prod Space
Configuration diff: 0 added, 0 removed, 0 changed, 4 unchanged
Local comparison only. This does not merge, protect edits or inspect a live target.
[exit 0 at 11:45:46]

$ cub release publish cwwalk-1009b-apptique-prod
Failed: HTTP 400 for req <request-id>: component cwwalk-1009b-apptique requires a ChangeWorkflow; use a ChangeOrder that has one

[exit 1 at 11:45:46]

$ cub release publish --revision ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third cwwalk-1009b-apptique-prod
Successfully created release 1a1eb0e0-44d4-4189-8d09-2964770b71cc (1a1eb0e0-44d4-4189-8d09-2964770b71cc)
[exit 0 at 11:45:48]

$ cub release list --space cwwalk-1009b-apptique-prod
NUM    TAG                                                                PUBLISHED    DIGEST          LIVE    CREATED
2      cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third-co-end    true         0005a406ddc9            2026-10-09 10:45:47
1      release-1                                                          true         c587031ffa93            2026-10-09 10:42:32
[exit 0 at 11:45:48]
```

The promotion went through, because the approval existed. Prod's Space then
equalled the render of the one-line repository change from Part 1, object for
object. A plain publish was still refused. The publish that names the change
order worked, and Release 2 carries the change order's end tag.

```
$ export KUBECONFIG=$HOME/.confighub/clusters/cwwalk-1009b.kubeconfig; kubectl -n apptique-prod wait --for=jsonpath="{.spec.template.spec.containers[0].image}"=ghcr.io/confighub/apptique-frontend:v1.4.0 deployment/frontend --timeout=420s; kubectl -n argocd get applications.argoproj.io; kubectl -n apptique-prod get deployment frontend -o jsonpath="{.spec.template.spec.containers[0].image}{\"  replicas=\"}{.spec.replicas}{\"\n\"}"
deployment.apps/frontend condition met
NAME                         SYNC STATUS   HEALTH STATUS
cwwalk-1009b-apptique-dev    Unknown       Healthy
cwwalk-1009b-apptique-prod   OutOfSync     Progressing
cwwalk-1009b-argo-apps       Synced        Healthy
ghcr.io/confighub/apptique-frontend:v1.4.0  replicas=3
[exit 0 at 11:47:53]

$ export KUBECONFIG=$HOME/.confighub/clusters/cwwalk-1009b.kubeconfig; kubectl -n argocd get applications.argoproj.io; kubectl -n argocd get applications.argoproj.io cwwalk-1009b-apptique-prod -o jsonpath="{.status.sync.status}{\" \"}{.status.health.status}{\" revision=\"}{.status.sync.revision}{\"\n\"}{range .status.resources[*]}{.kind}{\" \"}{.namespace}{\"/\"}{.name}{\" \"}{.status}{\" \"}{.health.status}{\"\n\"}{end}"; kubectl -n apptique-prod get deployment,rs,pods -o wide | cut -c1-190; kubectl -n apptique-prod get deployment frontend -o jsonpath="{.metadata.annotations.confighub\.com/origin}{\"\n\"}"
NAME                         SYNC STATUS   HEALTH STATUS
cwwalk-1009b-apptique-dev    Unknown       Healthy
cwwalk-1009b-apptique-prod   Synced        Progressing
cwwalk-1009b-argo-apps       Synced        Healthy
Synced Progressing revision=sha256:0005a406ddc969abd94886ffb1d529d85b3ba980fcfa7ed62d81e9739664b79d
Namespace /apptique-prod Synced
Service apptique-prod/frontend Synced
ServiceAccount apptique-prod/frontend Synced
Deployment apptique-prod/frontend Synced
NAME                       READY   UP-TO-DATE   AVAILABLE   AGE     CONTAINERS   IMAGES                                       SELECTOR
deployment.apps/frontend   0/3     1            0           3m46s   server       ghcr.io/confighub/apptique-frontend:v1.4.0   app=apptique,component=frontend

NAME                                  DESIRED   CURRENT   READY   AGE     CONTAINERS   IMAGES                                       SELECTOR
replicaset.apps/frontend-659796cf84   3         3         0       3m46s   server       ghcr.io/confighub/apptique-frontend:v1.3.0   app=apptique,component=frontend,pod-template-hash=659796cf
replicaset.apps/frontend-9c7bd8697    1         1         0       30s     server       ghcr.io/confighub/apptique-frontend:v1.4.0   app=apptique,component=frontend,pod-template-hash=9c7bd869

NAME                            READY   STATUS             RESTARTS   AGE     IP            NODE                         NOMINATED NODE   READINESS GATES
pod/frontend-659796cf84-hhxbq   0/1     ImagePullBackOff   0          3m46s   10.244.0.12   cwwalk-1009b-control-plane   <none>           <none>
pod/frontend-659796cf84-wdl5f   0/1     ImagePullBackOff   0          3m46s   10.244.0.14   cwwalk-1009b-control-plane   <none>           <none>
pod/frontend-659796cf84-wg5g9   0/1     ImagePullBackOff   0          3m46s   10.244.0.13   cwwalk-1009b-control-plane   <none>           <none>
pod/frontend-9c7bd8697-4plv4    0/1     ErrImagePull       0          30s     10.244.0.15   cwwalk-1009b-control-plane   <none>           <none>
{"spaceId":"4823373b-ac8a-4a68-911a-831fcb26d2ac","spaceSlug":"cwwalk-1009b-apptique-prod","unitId":"6475ae1a-7b55-406f-9a99-2957c8991df7","unitSlug":"frontend","revisionNum":9}
[exit 0 at 11:48:23]
```

The Deployment carried v1.4.0 at 11:47:53, which was 2 minutes 5 seconds after
the publish. The Application read `Synced` and `Progressing`, and its synced
revision is the manifest digest of Release 2. The origin annotation names
revision 9. A second ReplicaSet for v1.4.0 exists and its pod cannot pull
either.

Dev was cheap to attach, so the walk released it too, under the same change
order. The publish ran 21 seconds before the block above.

```
$ cub release publish --revision ChangeOrder:cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third cwwalk-1009b-apptique-dev; cub release list --space cwwalk-1009b-apptique-dev
Successfully created release ae6fc29a-c22f-4339-b104-8330a858019a (ae6fc29a-c22f-4339-b104-8330a858019a)
NUM    TAG                                                                PUBLISHED    DIGEST          LIVE    CREATED
1      cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third-co-end    true         031cdc59a26d            2026-10-09 10:48:02
[exit 0 at 11:48:02]

$ export KUBECONFIG=$HOME/.confighub/clusters/cwwalk-1009b.kubeconfig; kubectl wait --for=create namespace/apptique-dev --timeout=420s; kubectl -n apptique-dev wait --for=create deployment/frontend --timeout=120s; sleep 20; kubectl -n argocd get applications.argoproj.io; kubectl -n apptique-dev get deployment frontend -o jsonpath="{.spec.template.spec.containers[0].image}{\"  replicas=\"}{.spec.replicas}{\"\n\"}"; kubectl -n argocd get applications.argoproj.io cwwalk-1009b-apptique-dev -o jsonpath="{.status.sync.status}{\" \"}{.status.health.status}{\" revision=\"}{.status.sync.revision}{\"\n\"}"
namespace/apptique-dev condition met
deployment.apps/frontend condition met
NAME                         SYNC STATUS   HEALTH STATUS
cwwalk-1009b-apptique-dev    Synced        Progressing
cwwalk-1009b-apptique-prod   Synced        Progressing
cwwalk-1009b-argo-apps       Synced        Healthy
ghcr.io/confighub/apptique-frontend:v1.4.0  replicas=1
Synced Progressing revision=sha256:031cdc59a26d941459069a8cea3346606e7ab430b4313d3390753f3847a98696
[exit 0 at 11:50:20]
```

Dev ran v1.4.0 with one replica, about two minutes after its Release.

### Step 7. What a reviewer looks at afterwards

These are the Releases of prod.

```
$ cub release list --space cwwalk-1009b-apptique-prod
NUM    TAG                                                                PUBLISHED    DIGEST          LIVE    CREATED
2      cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third-co-end    true         0005a406ddc9            2026-10-09 10:45:47
1      release-1                                                          true         c587031ffa93            2026-10-09 10:42:32
[exit 0 at 11:48:40]

$ cub release get --space cwwalk-1009b-apptique-prod 2
ID                 1a1eb0e0-44d4-4189-8d09-2964770b71cc
Release Num        2
Published          true
Digest             sha256:46f461b70ff20d30c52bece41fb33d2140147644c2708edad909106a568a08bb
Manifest Digest    sha256:0005a406ddc969abd94886ffb1d529d85b3ba980fcfa7ed62d81e9739664b79d
Organization ID    <org-id>
Created At         2026-10-09 10:45:47.985392 +0000 UTC
Labels
Delete Gates
Annotations
Space ID           4823373b-ac8a-4a68-911a-831fcb26d2ac
Tag                cwwalk-1009b-tag-v1-4-0-third-co-end
[exit 0 at 11:48:41]

$ cub release get --space cwwalk-1009b-apptique-prod 1
ID                 1bdb2dfe-6f47-456a-ab00-1395a326784f
Release Num        1
Published          true
Digest             sha256:49d83b9fae7e044bf1e4ad0af0db312e2c43baf5a9ff74c48dfdf5014cc30bc0
Manifest Digest    sha256:c587031ffa937059576c65d0da7a90cf6d46db4112d4c5861cf42b62545fa3d5
Organization ID    <org-id>
Created At         2026-10-09 10:42:32.874729 +0000 UTC
Labels
Delete Gates
Annotations
Space ID           4823373b-ac8a-4a68-911a-831fcb26d2ac
Tag                release-1
[exit 0 at 11:48:41]
```

This is the revision history of the changed Unit.

```
$ cub revision list --space cwwalk-1009b-apptique-prod frontend
NUM    UNIT        SOURCE             CHANGESET    CHANGEORDERS                        TAGS                                DESCRIPTION
9      frontend    UpgradeUnit                     cwwalk-1009b-apptique-base/cw...    cwwalk-1009b-apptique-base/cw...    Take change order cwwalk-1009b-tag-v1-4-0-third...
8      frontend    RestoreRevision                                                     cwwalk-1009b-apptique-base/cw...    Take change order cwwalk-1009b-tag-v1-4-0-one-a...
7      frontend    UpgradeUnit                     cwwalk-1009b-apptique-base/cw...    cwwalk-1009b-apptique-base/cw...    Take change order cwwalk-1009b-tag-v1-4-0-one-a...
6      frontend    Invoke                                                              cwwalk-1009b-apptique-base/cw...    Give prod the requests and limits of the prod o...
5      frontend    Invoke                                                                                                  Run three replicas in prod, as the prod overlay...
4      frontend    Invoke                                                                                                  Label every object environment prod, as the pro...
3      frontend    Invoke                                                                                                  Functions: set-namespace
2      frontend    CloneUnit                                                                                               Clone the base as prod
1      frontend    CloneUnit                                                                                               Empty revision preceding the unit's first content
[exit 0 at 11:48:42]
```

Revision 9 is the change. Revisions 7 and 8 are the second change order going
in and coming out again. Revision 8 is what Release 1 holds.

This is the diff between the two released states, first by Release tag and
then by revision number.

```
$ cub variant diff cwwalk-1009b-apptique-prod release-1 cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third-co-end -o mutations
=== cwwalk-1009b-apptique-prod/frontend/8 -> cwwalk-1009b-apptique-prod/frontend/9
Resource: apps/v1/Deployment apptique-prod/frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0
1 of 4 unit(s) changed between release-1 and cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third-co-end in cwwalk-1009b-apptique-prod (3 unchanged, 0 at neither)
[exit 0 at 11:48:43]

$ cub unit diff --space cwwalk-1009b-apptique-prod frontend 8 9 -o mutations
Resource: apps/v1/Deployment apptique-prod/frontend
  ~ [Update] spec.template.spec.containers.?name=server.image
      ghcr.io/confighub/apptique-frontend:v1.3.0 → ghcr.io/confighub/apptique-frontend:v1.4.0
[exit 0 at 11:48:44]
```

The change order joins the promotions and the Releases.

```
$ cub changeorder get --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0-third
ID                       2627e22b-094d-4a93-89c8-888537bdac13
Name                     cwwalk-1009b-tag-v1-4-0-third
Space                    cwwalk-1009b-apptique-base
Update Type              UpgradeUnit
Created At               2026-10-09 10:37:11.802149 +0000 UTC
Updated At               2026-10-09 10:45:40.992683 +0000 UTC
Labels
Delete Gates
Annotations
Organization ID          <org-id>
Start Tag                cwwalk-1009b-tag-v1-4-0-third-co-start
End Tag                  cwwalk-1009b-tag-v1-4-0-third-co-end
Description              Run image tag v1.4.0
Skipped Units            frontend-service (already promoted through revision 2; marked, but carrying no revisions), frontend-serviceaccount (already promoted through revision 2; marked, but carrying no revisions), namespace (already promoted through revision 3; marked, but carrying no revisions)
State                    Released
Stage                    Completed
Completed                true
Change Workflow          cwwalk-1009b-dev-then-prod-one-account
Stage 1: dev             Labels.Stage = 'dev'
Stage 2: prod            Labels.Stage = 'prod'; gates: approved
Prerequisite approved    One approval of the change as it stands in dev. An author may approve, because this walk has one account. (1 Approval attestation(s))
Last Promotion           2026-10-09T10:45:40Z, stage prod (2 recorded; -o json lists them all)
                         cwwalk-1009b-apptique-prod
Where Space              ComponentID = '5f29ce8f-53d0-4926-bf80-368ac08f03bf'
In-Scope Spaces          cwwalk-1009b-apptique-base, cwwalk-1009b-apptique-dev, cwwalk-1009b-apptique-prod
Resolved Spaces          cwwalk-1009b-apptique-base, cwwalk-1009b-apptique-dev, cwwalk-1009b-apptique-prod
Released Spaces          cwwalk-1009b-apptique-dev (release 1), cwwalk-1009b-apptique-prod (release 2)
[exit 0 at 11:48:47]

$ cub changeorder get --space cwwalk-1009b-apptique-base cwwalk-1009b-tag-v1-4-0-third -o json | jq ".ChangeOrder | {State, Stage, Promotions, Releases, ReleasedSpaceIDs, PromotionOverrides, PromotionFailures}"
{
  "State": "Released",
  "Stage": "Completed",
  "Promotions": [
    {
      "PromotedAt": "2026-10-09T10:37:15.394441518Z",
      "SpaceIDs": [
        "8eca1259-7bb8-4b0f-a224-97de176113a4"
      ],
      "Stage": "dev",
      "UserID": "<user-id>"
    },
    {
      "PromotedAt": "2026-10-09T10:45:40.95799463Z",
      "SpaceIDs": [
        "4823373b-ac8a-4a68-911a-831fcb26d2ac"
      ],
      "Stage": "prod",
      "UserID": "<user-id>"
    }
  ],
  "Releases": [
    {
      "ReleaseID": "1a1eb0e0-44d4-4189-8d09-2964770b71cc",
      "ReleaseNum": 2,
      "SpaceID": "4823373b-ac8a-4a68-911a-831fcb26d2ac"
    },
    {
      "ReleaseID": "ae6fc29a-c22f-4339-b104-8330a858019a",
      "ReleaseNum": 1,
      "SpaceID": "8eca1259-7bb8-4b0f-a224-97de176113a4"
    }
  ],
  "ReleasedSpaceIDs": [
    "4823373b-ac8a-4a68-911a-831fcb26d2ac",
    "8eca1259-7bb8-4b0f-a224-97de176113a4"
  ],
  "PromotionOverrides": null,
  "PromotionFailures": null
}
[exit 0 at 11:48:47]
```

This is the approval, and then the account behind the user id.

```
$ cub attestation get --space cwwalk-1009b-apptique-dev b158b021-2bea-494e-b888-fe194eced1f8
ID                 b158b021-2bea-494e-b888-fe194eced1f8
Type               Approval
Result             Pass
Change Order ID    2627e22b-094d-4a93-89c8-888537bdac13
Note               Reviewed the change as it stands in dev. One field changes, the frontend image tag, from v1.3.0 to v1.4.0.
User ID            <user-id>
Created At         2026-10-09 10:37:42.055124 +0000 UTC
Space              cwwalk-1009b-apptique-dev
[exit 0 at 11:48:48]

$ cub user get $(cub attestation get --space cwwalk-1009b-apptique-dev b158b021-2bea-494e-b888-fe194eced1f8 -o jq=.Attestation.UserID 2>/dev/null || cub attestation list --space cwwalk-1009b-apptique-dev -o json | jq -r '.[0].Attestation.UserID // .[0].UserID') -o json | jq '.User | {UserID, Username: (.Username | sub(".+"; "user@example.com")), DisplayName: (.DisplayName | sub(".+"; "user@example.com"))}'
{
  "UserID": "<user-id>",
  "Username": "user@example.com",
  "DisplayName": "user@example.com"
}
[exit 0 at 11:49:12]
```

The last command is `cub user get <user-id>` with the two values masked inside
the command, so that the account never reached the recording. The real output
names the signed-in account in `Username` and `DisplayName`.

These are the other change orders, for a reader who finds them in the list.

```
$ cub changeorder list --space cwwalk-1009b-apptique-base; for c in cwwalk-1009b-tag-v1-4-0 cwwalk-1009b-tag-v1-4-0-one-account cwwalk-1009b-prod-as-it-stands; do cub changeorder get --space cwwalk-1009b-apptique-base $c -o json | jq -c ".ChangeOrder | {Slug, State, Stage, promotions: (.Promotions // [] | map(.Stage)), PromotionFailures, PromotionOverrides}"; done
NAME                                   SPACE                         STATE              STAGE        COMPLETED    UPDATE-TYPE    DESCRIPTION                                           ABORTED-REASON
cwwalk-1009b-tag-v1-4-0-third          cwwalk-1009b-apptique-base    Released           Completed    true         UpgradeUnit    Run image tag v1.4.0
cwwalk-1009b-tag-v1-4-0-one-account    cwwalk-1009b-apptique-base    RestoreReleased    Completed    true         UpgradeUnit    Run image tag v1.4.0                                  Promoted into prod by the walker in error. The ...
cwwalk-1009b-tag-v1-4-0                cwwalk-1009b-apptique-base    RestoreReleased    dev          false        UpgradeUnit    Run image tag v1.4.0                                  The only account in this walk wrote the change,...
cwwalk-1009b-prod-as-it-stands         cwwalk-1009b-apptique-base    Aborted                         false        UpgradeUnit    Mark prod as it stands, with no change, so that...    It cannot reach prod. The workflow has a dev st...
{"Slug":"cwwalk-1009b-tag-v1-4-0","State":"RestoreReleased","Stage":"dev","promotions":["dev"],"PromotionFailures":null,"PromotionOverrides":null}
{"Slug":"cwwalk-1009b-tag-v1-4-0-one-account","State":"RestoreReleased","Stage":"Completed","promotions":["dev","prod"],"PromotionFailures":null,"PromotionOverrides":null}
{"Slug":"cwwalk-1009b-prod-as-it-stands","State":"Aborted","Stage":null,"promotions":[],"PromotionFailures":null,"PromotionOverrides":null}
[exit 0 at 11:49:15]
```

These are the web addresses that cub prints for these objects.

```
$ cub unit open --space cwwalk-1009b-apptique-prod frontend --revisions --print-url; cub unit open --space cwwalk-1009b-apptique-dev frontend --revisions --print-url; cub component open cwwalk-1009b-apptique --print-url; cub component open cwwalk-1009b-apptique --variant prod --print-url
https://hub.confighub.com/units/4823373b-ac8a-4a68-911a-831fcb26d2ac/6475ae1a-7b55-406f-9a99-2957c8991df7?org=<org-id>&tab=2
https://hub.confighub.com/units/8eca1259-7bb8-4b0f-a224-97de176113a4/90a0cf5a-91da-4cdc-b668-16eff5f7e545?org=<org-id>&tab=2
https://hub.confighub.com/components?app=cwwalk-1009b-apptique&org=<org-id>
https://hub.confighub.com/components?app=cwwalk-1009b-apptique&org=<org-id>&space=4823373b-ac8a-4a68-911a-831fcb26d2ac
[exit 0 at 11:49:17]

$ for s in cwwalk-1009b-apptique-base cwwalk-1009b-apptique-dev cwwalk-1009b-apptique-prod cwwalk-1009b cwwalk-1009b-argo-apps; do cub space open $s --print-url; done
https://hub.confighub.com/spaces/053d21cf-caaa-4750-a529-09c6daee281c?org=<org-id>
https://hub.confighub.com/spaces/8eca1259-7bb8-4b0f-a224-97de176113a4?org=<org-id>
https://hub.confighub.com/spaces/4823373b-ac8a-4a68-911a-831fcb26d2ac?org=<org-id>
https://hub.confighub.com/spaces/3df047ac-0bee-4609-8b37-93fc7a90955c?org=<org-id>
https://hub.confighub.com/spaces/f1a762f0-2190-4ae6-b5b4-b0da02723e02?org=<org-id>
[exit 0 at 11:49:42]
```

## The end state

```
$ cub space list --where "Slug LIKE 'gpu-operator-%'"
NAME                     COMPONENT       OWNER    VARIANT     STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
gpu-operator-v26-3-3     gpu-operator             v26-3-3                                                24
gpu-operator-prod        gpu-operator             prod                                                   24
gpu-operator-v25-10-1    gpu-operator             v25-10-1                                               24
gpu-operator-v26-3-2     gpu-operator             v26-3-2                                                24
[exit 0 at 11:50:34]

$ cub component list --where "Slug LIKE '%gpu-operator%'"
NAME                WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
ch7-gpu-operator    false                0
gpu-operator        false                0                              gpu-operator-prod, gpu-operator-v25-10-1, gpu-operator-v26-3-2, gpu-operator-v26-3-3
[exit 0 at 11:50:35]

$ cub unit list --space '*' --where "Space.Slug LIKE 'gpu-operator-%'" --no-headers -o jq='.[] | [.Space.Slug, .Unit.Slug, (.Unit.HeadRevisionNum|tostring)] | join(" ")' | sort > out/gpu-after.txt; wc -l < out/gpu-after.txt; shasum -a 256 out/gpu-after.txt | cut -c1-64; diff out/gpu-before.txt out/gpu-after.txt && echo 'no difference from the list taken at the start'
      96
7fc4b5eaaef386bbda0c0e1b52f10a3ec64630e5047d2473ed16a2700fe40a85
no difference from the list taken at the start
[exit 0 at 11:50:35]
```

The four `gpu-operator-*` Spaces have the same names and the same Unit counts.
The list of 96 Units with their head revision numbers is identical to the list
taken at the start, by `diff` and by checksum. The Component `gpu-operator` has
the same four variants.

```
$ cub space list --where "Slug LIKE 'cwwalk-1009b%'" -o wide
NAME                          COMPONENT                OWNER    VARIANT    STAGE    ENVIRONMENT    REGION    LAYER    #UNITS    #LINKS    #TAGS    #CHANGESETS    #CHANGEORDERS    #CHANGEWORKFLOWS    #FILTERS    #VIEWS    #INVOCATIONS    #TRIGGERS    #WORKERS    #TARGETS    #ATTRIBUTES
cwwalk-1009b-apptique-base    cwwalk-1009b-apptique             base                                                  4         5         12       1              4                2                   0           0         0               0            0           0           0
cwwalk-1009b                                                                                                          0         0         0        0              0                0                   0           0         0               1            1           1           0
cwwalk-1009b-apptique-prod    cwwalk-1009b-apptique             prod       prod     Prod                              4         9         1        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009b-apptique-dev     cwwalk-1009b-apptique             dev        dev      Dev                               4         9         0        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009b-argo-apps                                                                                                3         0         2        0              0                0                   0           0         0               0            0           0           0
[exit 0 at 11:50:36]

$ cub space list --where "Slug LIKE 'cwwalk-1009b%'" --no-headers -o jq='.[] | [.Space.Slug, .Space.SpaceID] | join(" ")' | sort
cwwalk-1009b 3df047ac-0bee-4609-8b37-93fc7a90955c
cwwalk-1009b-apptique-base 053d21cf-caaa-4750-a529-09c6daee281c
cwwalk-1009b-apptique-dev 8eca1259-7bb8-4b0f-a224-97de176113a4
cwwalk-1009b-apptique-prod 4823373b-ac8a-4a68-911a-831fcb26d2ac
cwwalk-1009b-argo-apps f1a762f0-2190-4ae6-b5b4-b0da02723e02
[exit 0 at 11:50:36]

$ cub component list --where "Slug LIKE 'cwwalk-1009b%'"; cub component get cwwalk-1009b-apptique | grep -E '^(ID|Allowed|ChangeWorkflow Required)'
NAME                     WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
cwwalk-1009b-apptique    true                 2                              cwwalk-1009b-apptique-base, cwwalk-1009b-apptique-dev, cwwalk-1009b-apptique-prod
ID                         5f29ce8f-53d0-4926-bf80-368ac08f03bf
Allowed ChangeWorkflows    07f690ef-90be-47f0-b866-c0eb28a56361, 1b4379bb-e9f0-4785-9267-0bbe84d87085
ChangeWorkflow Required    true
[exit 0 at 11:50:37]

$ cub changeworkflow list --space cwwalk-1009b-apptique-base; cub changeorder list --space cwwalk-1009b-apptique-base -o jq=".[] | [.ChangeOrder.Slug, .ChangeOrder.ChangeOrderID, .ChangeOrder.State] | join(\" \")"
NAME                                      SPACE                         STAGES         FINAL-GATES
cwwalk-1009b-dev-then-prod-one-account    cwwalk-1009b-apptique-base    dev -> prod
cwwalk-1009b-dev-then-prod                cwwalk-1009b-apptique-base    dev -> prod
cwwalk-1009b-tag-v1-4-0-third 2627e22b-094d-4a93-89c8-888537bdac13 Released
cwwalk-1009b-tag-v1-4-0-one-account 7e443ee7-9dc5-46f5-a5ac-5b4a7475e21f RestoreReleased
cwwalk-1009b-tag-v1-4-0 85e70ff7-2003-4d84-8862-e95daa82cddb RestoreReleased
cwwalk-1009b-prod-as-it-stands eee43bf1-d04d-4045-995f-97210b73db0f Aborted
[exit 0 at 11:50:39]

$ cub target list --space cwwalk-1009b -o jq=".[] | [.Target.Slug, .Target.TargetID] | join(\" \")"; cub worker list --space cwwalk-1009b -o jq=".[] | [.BridgeWorker.Slug, .BridgeWorker.BridgeWorkerID, .BridgeWorker.Condition] | join(\" \")"; cub trigger list --space cwwalk-1009b -o jq=".[] | [.Trigger.Slug, .Trigger.TriggerID] | join(\" \")"
target 08832e7a-faa6-4a0b-8f6c-6cf2ea26694f
worker 30971cf1-3514-4f89-b2f6-2699c2924f79 Ready
no-placeholders 804e1cfb-77f7-41dc-9779-2f6ec6ffdec7
[exit 0 at 11:50:40]

$ for s in cwwalk-1009b-apptique-base cwwalk-1009b-apptique-dev cwwalk-1009b-apptique-prod cwwalk-1009b-argo-apps; do cub unit list --space $s --no-headers -o jq=".[] | [.Space.Slug, .Unit.Slug, .Unit.UnitID, (.Unit.HeadRevisionNum|tostring)] | join(\" \")"; done
cwwalk-1009b-apptique-base namespace 2913a22f-95ab-4fa6-bd03-852a7c3643b5 3
cwwalk-1009b-apptique-base frontend-service 5b901aff-5b14-474b-a8e5-5ab19836e253 2
cwwalk-1009b-apptique-base frontend-serviceaccount 9c86af19-3f15-4ad0-94be-725db5284c21 2
cwwalk-1009b-apptique-base frontend dac17ce7-8dec-4643-b4a8-3f289c9e7af5 8
cwwalk-1009b-apptique-dev namespace 419cfb85-5cb8-4d5a-8eae-08279d6dfae1 4
cwwalk-1009b-apptique-dev frontend 90a0cf5a-91da-4cdc-b668-16eff5f7e545 9
cwwalk-1009b-apptique-dev frontend-service c457e731-ec41-42f8-bd70-7b910d0d5074 4
cwwalk-1009b-apptique-dev frontend-serviceaccount f8a28a0b-4ffc-4140-bf07-3e8a0c5f45cf 4
cwwalk-1009b-apptique-prod frontend 6475ae1a-7b55-406f-9a99-2957c8991df7 9
cwwalk-1009b-apptique-prod namespace a84a9b35-d381-4167-bd94-e53477e54087 4
cwwalk-1009b-apptique-prod frontend-serviceaccount d4d48b17-ffa4-4535-a133-3a431faaf8d2 4
cwwalk-1009b-apptique-prod frontend-service f4369faa-2434-4b9e-b081-9e891e4ad956 4
cwwalk-1009b-argo-apps root 008f94b1-2730-4ebb-8b31-36895a7dab10 2
cwwalk-1009b-argo-apps cwwalk-1009b-apptique-dev 478af72b-d521-42aa-a073-0a2c3c3a6020 2
cwwalk-1009b-argo-apps cwwalk-1009b-apptique-prod 760a07f9-d7e4-484c-bdea-9f3aa44c4ca8 2
[exit 0 at 11:50:42]

$ for s in cwwalk-1009b-apptique-dev cwwalk-1009b-apptique-prod cwwalk-1009b-argo-apps; do echo "== $s"; cub release list --space $s; done; cub attestation list --space cwwalk-1009b-apptique-dev; cub attestation list --space cwwalk-1009b-apptique-prod
== cwwalk-1009b-apptique-dev
NUM    TAG                                                                PUBLISHED    DIGEST          LIVE    CREATED
1      cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third-co-end    true         031cdc59a26d            2026-10-09 10:48:02
== cwwalk-1009b-apptique-prod
NUM    TAG                                                                PUBLISHED    DIGEST          LIVE    CREATED
2      cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third-co-end    true         0005a406ddc9            2026-10-09 10:45:47
1      release-1                                                          true         c587031ffa93            2026-10-09 10:42:32
== cwwalk-1009b-argo-apps
NUM    TAG          PUBLISHED    DIGEST          LIVE    CREATED
2      release-2    true         2a5a8ac79504            2026-10-09 10:42:24
1      release-1    true         a6f917713c7e            2026-10-09 10:39:47
ATTESTATION-ID                          TYPE        RESULT    REVOKES                                 USER-ID                                 CREATED
3b03884e-818e-471c-be97-f17505fa7ed6    Approval    Pass      b83f8506-86c9-4202-8c31-8590904ff623    <user-id>    2026-10-09 10:36:52.520173 +0000 UTC
b158b021-2bea-494e-b888-fe194eced1f8    Approval    Pass                                              <user-id>    2026-10-09 10:37:42.055124 +0000 UTC
b83f8506-86c9-4202-8c31-8590904ff623    Approval    Pass                                              <user-id>    2026-10-09 10:34:11.175634 +0000 UTC
ATTESTATION-ID    TYPE    RESULT    REVOKES    USER-ID    CREATED
[exit 0 at 11:50:45]

$ kind get clusters | wc -l; kind get clusters | grep cwwalk; docker ps --format "{{.Names}}" | wc -l; shasum -a 256 $HOME/.kube/config | cut -c1-64 | diff - out/kubeconfig-before.sha && echo "default kubeconfig unchanged"; ls $HOME/.confighub/clusters/ | grep cwwalk
      18
cwwalk-1009b
      14
default kubeconfig unchanged
cwwalk-1009b.env
cwwalk-1009b.kubeconfig
[exit 0 at 11:50:46]
```

The machine has 18 kind clusters, which is the 17 from the start and the
walk's one. The default kubeconfig is unchanged.

## What went wrong

1. **The walker promoted into prod by mistake.** Under the second change order the walker ran the real promotion to show a refusal, without the preview first. The promotion went through. Prod's Space held v1.4.0 for about 70 seconds, with no Target and no Release. The walk aborted the change order and took it back out with `cub variant demote`. The Unit histories carry two extra revisions for it.
2. **An approval outlives the change order it was made under.** The approval recorded under the first change order satisfied the gate of the second, which did not exist when the approval was made. The help says an approval covers later revisions with identical content, so this is by design. A reviewer should know that the gate asks whether this content was approved, and does not ask whether it was approved for this change order. The walk had to revoke the approval to see the second workflow refuse.
3. **One account cannot pass the default gate, and changing that took a second workflow and a second change order.** The default requires an approver who did not write the change. The server recorded the author's approval and counted it as `0 of 1`. The help says a workflow edit does not reach a change order that already exists, and the walk did not test that. A second change order for the same change was refused with `the targets are at different revisions of it (3, 4)` until the first was aborted and demoted.
4. **The gate refuses the preview too.** `cub variant promote <prod> --change-order ... --dry-run -o mutations` returns the gate's refusal until the approval exists. The approver has to use `cub variant diff` or `cub unit diff` to see what is being approved.
5. **A refused promotion leaves no record.** `PromotionFailures` was null on all four change orders after three refused promotions and four refused previews. The record shows who promoted and when. It does not show who tried and was refused.
6. **A Component that requires a workflow could not give prod a first Release.** A plain publish and a `Before:ChangeOrder:` publish were both refused with `requires a ChangeWorkflow; use a ChangeOrder that has one`. A change order with no change, headed only for prod, was refused with `its previous stage 'dev' selects no Space`. The walk switched the requirement off for one publish. The walk set the requirement before the cluster existed, which is the order the task gave and is not the order a real team would meet.
7. **One publish returned HTTP 500.** `cub release publish --revision ChangeOrder:<change> <prod>` before the change order had been promoted into prod answered `no Revision found for Unit namespace with the specified TagID <id>`. The help says a Unit with no tagged revision falls back to its head. Nothing was released.
8. **An existing variant has no one-step way onto a cluster.** `cub space update --release-target` did not give the Units the Target. `cub unit set-target` did. The Argo CD Application had to be written by hand and the apps Space published again. `cub variant create --target` does all of this, and only when it creates the variant.
9. **The example's image cannot be pulled.** `ghcr.io/confighub/apptique-frontend` answers `403 Forbidden` to an anonymous pull for both tags. Every pod stayed in `ErrImagePull` or `ImagePullBackOff`, and both Applications stayed `Progressing`. A workflow with a `Healthy` gate could never pass with this example. A last look at 11:58, outside the wrapper, showed the prod Application as `Synced` and `Degraded`, about twelve minutes after the second Release.
10. **ConfigHub did not show what the cluster did.** The `LIVE` column of `cub release list` stayed blank, and the change order read `Released` as soon as the Releases were published. This cluster ran without argobot. "Released" here means published, and it does not mean running.
11. **`Released` and `Completed` read true with no cluster at all.** The second change order read `Released` and `Completed` seconds after it reached prod, when no Space had a Target. The help says a Space with no release Target has nothing to release and passes.
12. **Argo CD took about two minutes each time.** A new child Application, a first Release and a second Release each took about two minutes to show on the cluster. An Application whose Space had no Release that Argo CD had read showed `Unknown` and `Healthy`, as dev's did for about six minutes.
13. **`--create-namespace` refuses the placeholder namespace.** The help for `cub variant create --namespace` suggests a base uploaded with `--namespace confighubplaceholder`. With `--create-namespace` the server answers that it cannot synthesize a Namespace whose name is a placeholder.
14. **The example's own check fails once prod catches up.** `./verify.sh` stops with `Expected the dev and prod apptique image tags to differ, both were v1.4.0`.
15. **An unknown subcommand prints help and exits 0.** `cub unit approve --help` printed the help for `cub unit`. The command does not exist.
16. **The approval names a user id and nothing else.** A reviewer needs `cub user get` to learn whose it is.
17. **Other mistakes were the walker's own.** The first context and version checks ran before the recording wrapper existed. One `jq` expression read the wrong level of the change order's JSON and printed nulls, and the next command repeated it correctly. Three substitutions were added to the wrapper after the first output that needed them, for the organization id, the user id and a second organization id in web addresses, and the walk applied them to the recording afterwards. The help pages and one look at the fields of `cub user get` ran outside the wrapper.

Every command that exited 0 had done what it said. The promotion in finding 1
is the one that did more than the walker expected.

## What the walk did not cover

- No second person approved anything. The walk saw the default rule refuse an author. It did not see the default rule accept someone else, and it does not claim that it does.
- The approval gates entry into prod and is recorded on dev's revisions. Nobody approved prod's own revisions, and `cub attestation list` for the prod Space is empty. The workflow has a separate `ReleasePrerequisites` field for that, and the walk did not use it.
- The `Validated`, `Released` and `Healthy` gates, custom prerequisites, `--force`, `--expires-in`, `--claim` and `--evidence` were not used.
- No rollback of a released change was run. `cub variant demote` was run twice before any Release, and not after one.
- The walk did not look for a record of who changed the Component's requirement. `cub component get` shows the time of the last update and no more.
- The example's own model, with one Space per overlay render, was not run in ConfigHub. The `cub argo` plugin, which plans a handover of an existing Argo CD estate, was not run either.
- No pull request was opened and the repository was not changed. The one-line change exists only in the scratch copy.
- The walk did not open the web interface. The addresses below come from `--print-url`. Two pictures of the change order's page were taken afterwards, before the clean-up, and are in [the Guide](./workshop-review-a-change-guide.md).
- The cluster ran without argobot, on one machine, with one node. Flux was not tried.
- The application never ran, because its image cannot be pulled.
- Permissions were not explored. The walk's account manages every object, so the walk says nothing about who may approve, promote or publish.

## What was in place when the walk ended

Nothing was cleaned up. Every object below was made by this walk and is still
there.

These objects are in ConfigHub, in the hosted organization.

| Kind | Name | Id |
| --- | --- | --- |
| Component | `cwwalk-1009b-apptique` | `5f29ce8f-53d0-4926-bf80-368ac08f03bf` |
| Space, the base | `cwwalk-1009b-apptique-base` | `053d21cf-caaa-4750-a529-09c6daee281c` |
| Space, dev | `cwwalk-1009b-apptique-dev` | `8eca1259-7bb8-4b0f-a224-97de176113a4` |
| Space, prod | `cwwalk-1009b-apptique-prod` | `4823373b-ac8a-4a68-911a-831fcb26d2ac` |
| Space, the cluster | `cwwalk-1009b` | `3df047ac-0bee-4609-8b37-93fc7a90955c` |
| Space, the Argo CD apps | `cwwalk-1009b-argo-apps` | `f1a762f0-2190-4ae6-b5b4-b0da02723e02` |
| Target | `cwwalk-1009b/target` | `08832e7a-faa6-4a0b-8f6c-6cf2ea26694f` |
| Worker | `cwwalk-1009b/worker` | `30971cf1-3514-4f89-b2f6-2699c2924f79` |
| Trigger | `cwwalk-1009b/no-placeholders` | `804e1cfb-77f7-41dc-9779-2f6ec6ffdec7` |
| ChangeWorkflow, a second person required | `cwwalk-1009b-apptique-base/cwwalk-1009b-dev-then-prod` | `1b4379bb-e9f0-4785-9267-0bbe84d87085` |
| ChangeWorkflow, an author may approve | `cwwalk-1009b-apptique-base/cwwalk-1009b-dev-then-prod-one-account` | `07f690ef-90be-47f0-b866-c0eb28a56361` |
| Change order, the clean path, `Released` | `cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-third` | `2627e22b-094d-4a93-89c8-888537bdac13` |
| Change order, aborted and taken back out | `cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0` | `85e70ff7-2003-4d84-8862-e95daa82cddb` |
| Change order, aborted and taken back out | `cwwalk-1009b-apptique-base/cwwalk-1009b-tag-v1-4-0-one-account` | `7e443ee7-9dc5-46f5-a5ac-5b4a7475e21f` |
| Change order, aborted, never promoted | `cwwalk-1009b-apptique-base/cwwalk-1009b-prod-as-it-stands` | `eee43bf1-d04d-4045-995f-97210b73db0f` |
| Approval that gated prod, in dev | attestation | `b158b021-2bea-494e-b888-fe194eced1f8` |
| Earlier approval, in dev, revoked | attestation | `b83f8506-86c9-4202-8c31-8590904ff623` |
| The revocation, in dev | attestation | `3b03884e-818e-471c-be97-f17505fa7ed6` |
| Release 1 of prod, v1.3.0 | tag `release-1`, manifest `sha256:c587031ffa93...` | `1bdb2dfe-6f47-456a-ab00-1395a326784f` |
| Release 2 of prod, v1.4.0 | tag `cwwalk-1009b-tag-v1-4-0-third-co-end`, manifest `sha256:0005a406ddc9...` | `1a1eb0e0-44d4-4189-8d09-2964770b71cc` |
| Release 1 of dev, v1.4.0 | tag `cwwalk-1009b-tag-v1-4-0-third-co-end`, manifest `sha256:031cdc59a26d...` | `ae6fc29a-c22f-4339-b104-8330a858019a` |
| Releases 1 and 2 of the apps Space | tags `release-1` and `release-2` | second is `456ad15e-5410-435d-9a80-e121a40f6a1f` |

The base, dev and prod Spaces hold four Units each, named `namespace`,
`frontend-serviceaccount`, `frontend-service` and `frontend`. The apps Space
holds three Units, named `root`, `cwwalk-1009b-apptique-dev` and
`cwwalk-1009b-apptique-prod`. The changed Unit is `frontend` in prod, with id
`6475ae1a-7b55-406f-9a99-2957c8991df7`, at revision 9. The Unit the approval
covers is `frontend` in dev, with id `90a0cf5a-91da-4cdc-b668-16eff5f7e545`, at
revision 9. The base Space also holds one ChangeSet from the upload and the
tags of the four change orders. The Component requires a workflow and allows
both.

These are on the machine.

- The kind cluster `cwwalk-1009b`, as the container `cwwalk-1009b-control-plane`. Argo CD answers on `http://localhost:30010`.
- The files `$HOME/.confighub/clusters/cwwalk-1009b.kubeconfig` and `$HOME/.confighub/clusters/cwwalk-1009b.env`. The env file holds the Argo CD admin login.
- On the cluster, the namespaces `argocd`, `apptique-dev` and `apptique-prod`, and three Argo CD Applications named `cwwalk-1009b-argo-apps`, `cwwalk-1009b-apptique-dev` and `cwwalk-1009b-apptique-prod`.
- The scratch directory `<work>`, with both copies of the example, the renders under `out/`, the full recording in `transcript.txt` and this log.

cub printed the first four web addresses below with `--print-url`, each with
an `org=<org-id>` parameter that this log drops. A person signed in to the
organization should not need it, and that was not tested.

- (a) The changed Unit's revision list is `https://hub.confighub.com/units/4823373b-ac8a-4a68-911a-831fcb26d2ac/6475ae1a-7b55-406f-9a99-2957c8991df7?tab=2`.
- (b) The approval is recorded on the dev Unit's revision 9, whose revision list is `https://hub.confighub.com/units/8eca1259-7bb8-4b0f-a224-97de176113a4/90a0cf5a-91da-4cdc-b668-16eff5f7e545?tab=2`. cub has no `open` command for an attestation or a change order, so the walk cannot say which page shows the approval itself.
- (c) The Release has no `open` command either. The prod Space is `https://hub.confighub.com/spaces/4823373b-ac8a-4a68-911a-831fcb26d2ac`, and the Component view with prod selected is `https://hub.confighub.com/components?app=cwwalk-1009b-apptique&space=4823373b-ac8a-4a68-911a-831fcb26d2ac`.
- The Component view of all three variants is `https://hub.confighub.com/components?app=cwwalk-1009b-apptique`.
- The base Space, which holds the workflows and the change orders, is `https://hub.confighub.com/spaces/053d21cf-caaa-4750-a529-09c6daee281c`.

The commands that show the same three things from a terminal are
`cub revision list --space cwwalk-1009b-apptique-prod frontend`,
`cub attestation get --space cwwalk-1009b-apptique-dev b158b021-2bea-494e-b888-fe194eced1f8`
and `cub release get --space cwwalk-1009b-apptique-prod 2`.

## Clean-up

The walk was asked to clean up at 11:59, after screenshots had been taken. The
sections above describe the state before that. Everything they list as still
in place is now gone, except the scratch directory with the two copies of the
example, the renders, the recording and this log.

The help for `cub cluster down`, `cub space delete` and `cub component delete`
was read first. Each delete named one object. No bulk selector, `--detach`,
`--recursive-force` or `--delete-config` was used.

```
$ cub space list --where "Slug LIKE 'cwwalk%'"
NAME                          COMPONENT                OWNER    VARIANT    STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
cwwalk-1009b-apptique-base    cwwalk-1009b-apptique             base                                                  4
cwwalk-1009b                                                                                                          0
cwwalk-1009b-apptique-prod    cwwalk-1009b-apptique             prod       prod     Prod                              4
cwwalk-1009b-apptique-dev     cwwalk-1009b-apptique             dev        dev      Dev                               4
cwwalk-1009b-argo-apps                                                                                                3
[exit 0 at 11:59:02]

$ cub component list --where "Slug LIKE 'cwwalk%'"
NAME                     WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
cwwalk-1009b-apptique    true                 2                              cwwalk-1009b-apptique-base, cwwalk-1009b-apptique-dev, cwwalk-1009b-apptique-prod
[exit 0 at 11:59:02]

$ kind get clusters | grep cwwalk; docker ps --format "{{.Names}}" | grep cwwalk; ls $HOME/.confighub/clusters/ | grep cwwalk
cwwalk-1009b
cwwalk-1009b-control-plane
cwwalk-1009b.env
cwwalk-1009b.kubeconfig
[exit 0 at 11:59:03]

$ cub cluster down --name cwwalk-1009b
Deleting kind cluster "cwwalk-1009b"...
Deleting cluster "cwwalk-1009b" ...
Deleted nodes: ["cwwalk-1009b-control-plane"]

Left the ConfigHub config in place: space "cwwalk-1009b" (worker + OCI target),
space "cwwalk-1009b-argo-apps" (Argo Application Units), the argobot variant space "argobot-cwwalk-1009b" (if
installed), and any deployment variant spaces you created. Delete it all
in one step with 'cub cluster down --name cwwalk-1009b --delete-config', or by hand —
the cluster space LAST, since every other space's release target points
cross-space at its OCI target (deleting the cluster space first is blocked
by those references):
  cub space delete cwwalk-1009b-argo-apps --recursive
  cub space delete argobot-cwwalk-1009b --recursive   # if argobot was installed
  # ...plus any deployment variant spaces bound to cwwalk-1009b/target...
  cub space delete cwwalk-1009b --recursive

Done.
[exit 0 at 11:59:05]

$ kind get clusters | grep cwwalk; docker ps --format "{{.Names}}" | grep cwwalk; ls $HOME/.confighub/clusters/ | grep cwwalk; echo "kind clusters left: $(kind get clusters | wc -l | tr -d " ")"
kind clusters left: 16
[exit 0 at 11:59:05]
```

`cub cluster down` removed the kind cluster and both files under
`$HOME/.confighub/clusters/`, and left the ConfigHub side alone. The count of
kind clusters was then 16, one fewer than at the start, so the walk compared
the two lists.

```
$ kind get clusters | sort > out/kind-after-down.txt; sed -n "72,88p" transcript.txt | sort > out/kind-before.txt; echo "at the start: $(wc -l < out/kind-before.txt | tr -d " ")  now: $(wc -l < out/kind-after-down.txt | tr -d " ")"; diff out/kind-before.txt out/kind-after-down.txt; docker ps -a --format "{{.Names}} {{.Status}}" | grep -E "confighub-control-plane|kubara|lat-v11"
at the start: 17  now: 16
15d14
< rh-fflux
lat-v116-control-plane Up 29 hours
lat-v115-control-plane Up 29 hours
kubara-spoke-control-plane Up 10 days
kubara-hub-control-plane Up 10 days
confighub-control-plane Up 5 weeks
[exit 0 at 11:59:11]

$ docker ps -a --format "{{.Names}} {{.Status}}" | grep -c rh-fflux; grep -c "rh-fflux" transcript.txt; grep -n "rh-fflux" transcript.txt | cut -c1-60; docker events --since 15m --until 0s --filter type=container --filter event=destroy --format "{{.Time}} {{.Actor.Attributes.name}}" 2>/dev/null | while read t n; do echo "$(date -r $t +%H:%M:%S) destroy $n"; done
0
2
86:rh-fflux
2355:< rh-fflux
11:53:23 destroy rh-fflux-control-plane
11:59:04 destroy cwwalk-1009b-control-plane
[exit 0 at 11:59:18]
```

A cluster named `rh-fflux` is gone, and it was not the walk's. Docker's event
log shows its container destroyed at 11:53:23, while the walk was writing this
log and ran no cluster command. The walk's own container was destroyed at
11:59:04. Some other session on this machine removed `rh-fflux`.

The Spaces went in an order that leaves no reference behind. The two variants
went first, then the base, then the apps Space, and the cluster Space with its
Target went last.

```
$ cub space delete --recursive cwwalk-1009b-apptique-prod
Successfully deleted space cwwalk-1009b-apptique-prod (4823373b-ac8a-4a68-911a-831fcb26d2ac)
[exit 0 at 11:59:25]

$ cub space delete --recursive cwwalk-1009b-apptique-dev
Successfully deleted space cwwalk-1009b-apptique-dev (8eca1259-7bb8-4b0f-a224-97de176113a4)
[exit 0 at 11:59:26]

$ cub space delete --recursive cwwalk-1009b-apptique-base
Successfully deleted space cwwalk-1009b-apptique-base (053d21cf-caaa-4750-a529-09c6daee281c)
[exit 0 at 11:59:32]

$ cub space delete --recursive cwwalk-1009b-argo-apps
Successfully deleted space cwwalk-1009b-argo-apps (f1a762f0-2190-4ae6-b5b4-b0da02723e02)
[exit 0 at 11:59:33]

$ cub space delete --recursive cwwalk-1009b
Successfully deleted space cwwalk-1009b (3df047ac-0bee-4609-8b37-93fc7a90955c)
[exit 0 at 11:59:34]

$ cub component delete cwwalk-1009b-apptique
Successfully deleted component cwwalk-1009b-apptique (5f29ce8f-53d0-4926-bf80-368ac08f03bf)
[exit 0 at 11:59:35]
```

No delete was refused. The Component's workflow requirement did not stand in
the way of deleting its Spaces, and the Component itself was deleted last.

These are the checks.

```
$ cub space list --where "Slug LIKE 'cwwalk%'"
NAME    COMPONENT    OWNER    VARIANT    STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
[exit 0 at 11:59:43]

$ cub component list --where "Slug LIKE 'cwwalk%'"
NAME    WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
[exit 0 at 11:59:44]

$ kind get clusters | grep cwwalk; echo "grep exit $?"
grep exit 1
[exit 0 at 11:59:44]

$ docker ps --format '{{.Names}}' | grep cwwalk; echo "grep exit $?"
grep exit 1
[exit 0 at 11:59:44]

$ ls $HOME/.confighub/clusters/ | grep cwwalk; echo "grep exit $?"
grep exit 1
[exit 0 at 11:59:44]

$ shasum -a 256 $HOME/.kube/config | cut -c1-64 | diff - out/kubeconfig-before.sha && echo "default kubeconfig unchanged"
default kubeconfig unchanged
[exit 0 at 11:59:44]

$ cub space list --where "Slug LIKE 'gpu-operator-%'"
NAME                     COMPONENT       OWNER    VARIANT     STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
gpu-operator-v26-3-3     gpu-operator             v26-3-3                                                24
gpu-operator-prod        gpu-operator             prod                                                   24
gpu-operator-v25-10-1    gpu-operator             v25-10-1                                               24
gpu-operator-v26-3-2     gpu-operator             v26-3-2                                                24
[exit 0 at 11:59:45]

$ cub unit list --space '*' --where "Space.Slug LIKE 'gpu-operator-%'" --no-headers -o jq='.[] | [.Space.Slug, .Unit.Slug, (.Unit.HeadRevisionNum|tostring)] | join(" ")' | sort > out/gpu-after-cleanup.txt; cut -d' ' -f1 out/gpu-after-cleanup.txt | uniq -c; diff out/gpu-before.txt out/gpu-after-cleanup.txt && echo 'no difference from the list taken at the start'
  24 gpu-operator-prod
  24 gpu-operator-v25-10-1
  24 gpu-operator-v26-3-2
  24 gpu-operator-v26-3-3
no difference from the list taken at the start
[exit 0 at 11:59:45]

$ cub component list --where "Slug LIKE '%gpu-operator%'"
NAME                WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
ch7-gpu-operator    false                0
gpu-operator        false                0                              gpu-operator-prod, gpu-operator-v25-10-1, gpu-operator-v26-3-2, gpu-operator-v26-3-3
[exit 0 at 11:59:46]

$ cub changeworkflow list --where "Slug LIKE 'cwwalk%'"; cub changeorder list --where "Slug LIKE 'cwwalk%'"; cub target list --space '*' --where "Space.Slug LIKE 'cwwalk%'"; cub worker list --space '*' --where "Space.Slug LIKE 'cwwalk%'" 2>&1 | head -5
NAME    SPACE    STAGES    FINAL-GATES
NAME    SPACE    STATE    STAGE    COMPLETED    UPDATE-TYPE    DESCRIPTION    ABORTED-REASON
NAME    SPACE    LABELS
NAME    CONDITION    SPACE    LAST-SEEN
[exit 0 at 11:59:48]
```

No Space, Component, ChangeWorkflow, change order, Target or Worker with the
prefix remains. No kind cluster, container or kubeconfig file with the prefix
remains. The default kubeconfig has the checksum it had at the start. The four
`gpu-operator-*` Spaces hold 24 Units each, and the list of 96 Units with their
head revision numbers is identical to the list taken at the start.
