# Live walk of a GPU Operator upgrade through dev and QA, 2026-10-09

**UNOFFICIAL/EXPERIMENTAL**

This log records one serial session in a hosted ConfigHub organization. The
session moved NVIDIA's GPU Operator from v26.3.2 to v26.3.3 on a base, then
into a dev variant, then into a QA variant. It then moved one driver version
the same way. Nothing left ConfigHub. No cluster ran, no Target existed and no
Release was published.

This is a dated record of one run. It is not a Guide and it is not a receipt
for any Catalog entry. Every line that starts with `$` is a command that was
run, and the text under it is the output it printed. Times are local
wall-clock times. The whole walk ran between 08:41 and 08:52.

## Versions and setting

- The client is cub v0.8.7 (commit 072585f2, built 2026-10-07).
- The server is v0.8.10 (commit 28e0fc84, built 2026-10-08).
- The installer plugin is 0.1.0 and the workshop plugin is 0.6.56. Neither ran in this walk. Every command used is built into cub.
- The inputs are three published literal configuration bundles. Each reference is the `reference` of the `literal-config` bundle in the entry's listing under `site/listings/`, read at commit 59de828d1a.
- The organization is a hosted ConfigHub organization. It is written `<org>`, and the cub context is written `<ctx>`.
- Every command ran as `cub --context <ctx> ...` with `CUB_CONTEXT=<ctx>` exported. The log leaves both out of the command lines.
- Identifiers are written `<id>`, a server request identifier is written `<request-id>` and an account address is written `user@example.com`. The log holds no token and no secret.
- Each block ends with a line such as `[exit 0 at 08:42:12]`. The recording wrapper wrote that line. It is the exit code and the time the command returned.
- Long output is trimmed. Each cut is one line that starts with `...` and gives the number of lines removed. No kept line was edited beyond the substitutions above and the removal of trailing spaces.

## What the walk set out to do

A visitor who runs the GPU Operator asked how an upgrade is promoted through
dev and QA. The site prints commands for one `dev` variant and shows no second
environment. The walk ran the missing part so that a page can print it.

The walk had eight steps.

1. List the organization's GPU Operator Spaces before anything was written.
2. Upload the v26.3.2 default bundle as a base.
3. Create a dev variant and a QA variant, and find out which command makes QA take its changes from dev.
4. Upload the v26.3.3 default bundle onto the same base.
5. Preview and promote into dev, try QA before dev, then promote QA.
6. Diff base, dev and QA.
7. Repeat steps 4 to 6 for one driver version.
8. Delete everything the walk made and prove it.

## The answer in brief

A GPU Operator version step moves through dev and QA in ConfigHub with three
kinds of command. An upload moves the base. A promotion moves each variant, one
step at a time. A QA variant cloned from dev takes its changes from dev, so it
cannot get ahead of dev.

These are the walk's commands in the order they ran, with the walk's names and
change descriptions replaced by placeholders. Each one ran and worked.

```
cub variant upload --component <your-component> --variant base --namespace gpu-operator --change-desc "<text>" <v26.3.2 bundle reference>
cub variant create dev <your-component>-base --environment Dev --change-desc "<text>"
cub variant create qa <your-component>-dev --environment QA --change-desc "<text>"
cub variant upload --yes --component <your-component> --variant base --namespace gpu-operator --change-desc "<text>" <v26.3.3 bundle reference>
cub variant diff <your-component>-base Before:ChangeSet:<changeset> ChangeSet:<changeset> -o mutations
cub variant promote <your-component>-dev --dry-run -o mutations
cub variant promote <your-component>-dev --change-desc "<text>"
cub variant promote <your-component>-qa --dry-run -o mutations
cub variant promote <your-component>-qa --change-desc "<text>"
cub unit diff --space <your-component>-dev <unit> --with-unit <your-component>-qa/<unit> -o mutations
```

The upload prints the ChangeSet name that the diff command needs. The section
on what went wrong lists the places where a reader could be surprised.

## What was substituted, and why

The listings were the source for the commands. The walk departed from them in
the places this table names.

| The listing says | This run used | Why |
| --- | --- | --- |
| `cub auth login` | not run | The session used an existing login. The rules of the run forbade a new one. |
| plain `cub ...` | `cub --context <ctx> ...` with `CUB_CONTEXT=<ctx>` exported | The machine's default context is a different organization. |
| The upload step in `nextSteps` prints `cub installer setup --pull <package>` and then `cub installer upload --work-dir ./<entry> --space <your-space> --component <your-component>` | `cub variant upload --component cwwalk-1009-gpu-operator --variant base --namespace gpu-operator <literal bundle reference>` | The walk was asked to use each entry's published literal configuration bundle. The upload step prints no `cub variant upload` command. The nearest printed one is under `variants.howToMakeOne.commands`, and the next four rows compare with it. |
| `./rendered` as the input | the `oci://` reference from `oci.bundles[literal-config].reference` | The bundle is public and pinned by digest. The server pulls it, so no local render was needed. |
| `--component nvidia-gpu-operator --variant default --space nvidia-gpu-operator-v26-3-3-default` | `--component cwwalk-1009-gpu-operator --variant base`, with no `--space` | Every object had to carry the session prefix. The default Space name is `<component>-<variant>`, which gave `cwwalk-1009-gpu-operator-base`. One base had to carry three bundles in turn, so the Space could not be named after one entry. |
| `--unit-annotation workshop.confighub.com/object-set-sha256=<hash>` | left out | The annotation names the object set of one entry, and this base held three. The walk did not test what a second upload does to that annotation. |
| no `--namespace` flag | `--namespace gpu-operator` | The help says the flag has no default, and the listing's `cub installer setup` line uses `--namespace gpu-operator`. Finding 3 records a side effect. |
| `cub variant create staging <space> --space-pattern template:<space>-staging --environment Staging --unit-annotation ...` | `cub variant create dev cwwalk-1009-gpu-operator-base --environment Dev` and `cub variant create qa cwwalk-1009-gpu-operator-dev --environment QA` | The question was about dev and QA. The default Space names already carried the prefix, so no `--space-pattern` was needed. |
| `cub variant create dev <your-space> --target workshop/target --space-pattern "template:<your-space>-dev"` in the deploy step | no `--target` | The walk had no cluster and no Target. |
| `cub variant promote <your-space>-dev --dry-run -o mutations` | `cub variant promote cwwalk-1009-gpu-operator-dev --dry-run -o mutations` | Only the name changed. The same holds for the promote line with `--change-desc`. |
| `cub unit delete --space <your-space>-dev installer-record` and `cub release publish <your-space>-dev` | not run | A base made by `cub variant upload` has no `installer-record` Unit. The walk published no Release. |
| no command for a second upload onto the same base | the first upload command again with the next bundle and `--yes` | The listings print no upgrade-by-upload command. Finding 2 says why `--yes` was needed. |

The walk also made a third variant named `qa-direct`, cloned from the base, to
compare with the QA variant cloned from dev. It was not promoted.

## Step 1. The organization before the walk

```
$ cub version
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
[exit 0 at 08:51:59]

$ cub context list
SELECTED                    NAME            SERVER                                   ORGANIZATION                            USER
* --context, CUB_CONTEXT    <ctx>      https://hub.confighub.com                <org>                            user@example.com
... (9 lines cut, one per other context on this machine)
[exit 0 at 08:51:59]
```

The context row names the hosted organization and a signed-in user, so the walk
went ahead. Both commands ran first, before any write, outside the recording
wrapper. The transcript shown is a second run at the end of the walk, which
printed the same rows.

```
$ cub space list --where "Slug LIKE '%gpu-operator%'"
NAME                     COMPONENT       OWNER    VARIANT     STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
gpu-operator-v26-3-3     gpu-operator             v26-3-3                                                24
gpu-operator-prod        gpu-operator             prod                                                   24
gpu-operator-v25-10-1    gpu-operator             v25-10-1                                               24
gpu-operator-v26-3-2     gpu-operator             v26-3-2                                                24
[exit 0 at 08:41:35]

$ cub space list --where "Slug LIKE '%cwwalk%'"
NAME    COMPONENT    OWNER    VARIANT    STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
[exit 0 at 08:41:35]

$ cub component list --where "Slug LIKE '%gpu-operator%'"
NAME                WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
ch7-gpu-operator    false                0
gpu-operator        false                0                              gpu-operator-prod, gpu-operator-v25-10-1, gpu-operator-v26-3-2, gpu-operator-v26-3-3
[exit 0 at 08:41:36]

$ cub component list --where "Slug LIKE '%cwwalk%'"
NAME    WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
[exit 0 at 08:41:36]

$ cub unit list --space '*' --where "Space.Slug LIKE 'gpu-operator-%'" --no-headers -o jq='.[] | [.Space.Slug, .Unit.Slug, (.Unit.HeadRevisionNum|tostring)] | join(" ")' | sort
gpu-operator-prod cluster-policy-clusterpolicy 4
gpu-operator-prod clusterpolicies.nvidia.com-crd 2
gpu-operator-prod gpu-operator 3
gpu-operator-prod gpu-operator-clusterrole 3
... (92 more lines cut, one per Unit, 96 Units in all)
[exit 0 at 08:41:44]
```

Four Spaces named `gpu-operator-*` belong to a live example, and the walk was
not allowed to touch them. They held 96 Units between them. The last command
recorded each Unit's head revision number so that the end of the walk could
compare. No Space and no Component carried the walk's prefix.

## Step 2. Upload v26.3.2 default as a base

The preview came first.

```
$ cub variant upload --dry-run --component cwwalk-1009-gpu-operator --variant base --namespace gpu-operator oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-2-default:r001@sha256:0f6f399365cb045906854c9b568afa8dcb960d7898db5e5b47a317a3eed10484
Pulled oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-2-default:r001@sha256:0f6f399365cb045906854c9b568afa8dcb960d7898db5e5b47a317a3eed10484 (sha256:0f6f399365cb045906854c9b568afa8dcb960d7898db5e5b47a317a3eed10484)
Dry run: nothing was written.
Space cwwalk-1009-gpu-operator-base (Create)
  Create    nvidia-gpu-operator-v26-3-2-default-target-requirements-bundletargetrequirements
  Create    nvidia-gpu-operator-v26-3-2-default-crd-ordering-bundleroute
  Create    nvidia-gpu-operator-v26-3-2-default-lifecycle-actions-bundleroute
  Create    clusterpolicies.nvidia.com-crd
  Create    nvidiadrivers.nvidia.com-crd
  Create    nodefeatures.nfd.k8s-sigs.io-crd
  Create    nodefeaturegroups.nfd.k8s-sigs.io-crd
  Create    nodefeaturerules.nfd.k8s-sigs.io-crd
  Create    node-feature-discovery-serviceaccount
  Create    gpu-operator-serviceaccount
  Create    gpu-operator-node-feature-discovery-master-conf-configmap
  Create    gpu-operator-node-feature-discovery-worker-conf-configmap
  Create    gpu-operator-node-feature-discovery-clusterrole
  Create    gpu-operator-node-feature-discovery-gc-clusterrole
  Create    gpu-operator-clusterrole
  Create    gpu-operator-node-feature-discovery-clusterrolebinding
  Create    gpu-operator-node-feature-discovery-gc-clusterrolebinding
  Create    gpu-operator-clusterrolebinding
  Create    gpu-operator-node-feature-discovery-worker-role
  Create    gpu-operator-role
  Create    gpu-operator-node-feature-discovery-worker-rolebinding
  Create    gpu-operator-rolebinding
  Create    gpu-operator-node-feature-discovery-worker
  Create    gpu-operator-node-feature-discovery-master
  Create    gpu-operator-node-feature-discovery-gc
  Create    gpu-operator
  Create    cluster-policy-clusterpolicy
... (17 lines cut, one per inferred link between two Units)

Note: the following references didn't resolve to any uploaded Unit (expected when the
target lives in the cluster, e.g. a Secret created out-of-band):
... (20 lines cut, one per reference to an object outside the bundle)
[exit 0 at 08:41:57]
```

The bundle holds 24 Kubernetes objects and three companion documents. The
companions are a `BundleTargetRequirements` and two `BundleRoute` documents, and
each one becomes a Unit named after the entry id. That makes 27 Units, where
the listing counts 24 objects. Finding 2 follows from those three names.

```
$ cub variant upload --component cwwalk-1009-gpu-operator --variant base --namespace gpu-operator --change-desc 'Seed the base at v26.3.2 default' oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-2-default:r001@sha256:0f6f399365cb045906854c9b568afa8dcb960d7898db5e5b47a317a3eed10484
Pulled oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-2-default:r001@sha256:0f6f399365cb045906854c9b568afa8dcb960d7898db5e5b47a317a3eed10484 (sha256:0f6f399365cb045906854c9b568afa8dcb960d7898db5e5b47a317a3eed10484)
Space cwwalk-1009-gpu-operator-base (Create)
  Create    nvidia-gpu-operator-v26-3-2-default-target-requirements-bundletargetrequirements
  Create    nvidia-gpu-operator-v26-3-2-default-crd-ordering-bundleroute
  Create    nvidia-gpu-operator-v26-3-2-default-lifecycle-actions-bundleroute
  Create    clusterpolicies.nvidia.com-crd
  Create    nvidiadrivers.nvidia.com-crd
  Create    nodefeatures.nfd.k8s-sigs.io-crd
  Create    nodefeaturegroups.nfd.k8s-sigs.io-crd
  Create    nodefeaturerules.nfd.k8s-sigs.io-crd
  Create    node-feature-discovery-serviceaccount
  Create    gpu-operator-serviceaccount
  Create    gpu-operator-node-feature-discovery-master-conf-configmap
  Create    gpu-operator-node-feature-discovery-worker-conf-configmap
  Create    gpu-operator-node-feature-discovery-clusterrole
  Create    gpu-operator-node-feature-discovery-gc-clusterrole
  Create    gpu-operator-clusterrole
  Create    gpu-operator-node-feature-discovery-clusterrolebinding
  Create    gpu-operator-node-feature-discovery-gc-clusterrolebinding
  Create    gpu-operator-clusterrolebinding
  Create    gpu-operator-node-feature-discovery-worker-role
  Create    gpu-operator-role
  Create    gpu-operator-node-feature-discovery-worker-rolebinding
  Create    gpu-operator-rolebinding
  Create    gpu-operator-node-feature-discovery-worker
  Create    gpu-operator-node-feature-discovery-master
  Create    gpu-operator-node-feature-discovery-gc
  Create    gpu-operator
  Create    cluster-policy-clusterpolicy
... (17 lines cut, one per inferred link between two Units)

Note: the following references didn't resolve to any uploaded Unit (expected when the
target lives in the cluster, e.g. a Secret created out-of-band):
... (20 lines cut, one per reference to an object outside the bundle)

Revert this upload of cwwalk-1009-gpu-operator-base with:
  cub unit update --patch --space cwwalk-1009-gpu-operator-base --restore Before:ChangeSet:upload-20261009-074209 --where "Labels.UploadSource = 'cwwalk-1009-gpu-operator'"
[exit 0 at 08:42:12]

$ cub space list --where "Slug LIKE 'cwwalk-1009-%'" -o wide
NAME                             COMPONENT                   OWNER    VARIANT    STAGE    ENVIRONMENT    REGION    LAYER    #UNITS    #LINKS    #TAGS    #CHANGESETS    #CHANGEORDERS    #CHANGEWORKFLOWS    #FILTERS    #VIEWS    #INVOCATIONS    #TRIGGERS    #WORKERS    #TARGETS    #ATTRIBUTES
cwwalk-1009-gpu-operator-base    cwwalk-1009-gpu-operator             base                                                  27        17        2        1              0                0                   0           0         0               0            0           0           0
[exit 0 at 08:42:17]

$ cub component list --where "Slug LIKE 'cwwalk-1009-%'"
NAME                        WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
cwwalk-1009-gpu-operator    false                0                              cwwalk-1009-gpu-operator-base
[exit 0 at 08:42:18]
```

The upload created the Component, the Space `cwwalk-1009-gpu-operator-base`,
27 Units and 17 Links. It recorded one ChangeSet and printed the command that
reverts it.

## Step 3. A dev variant and two QA variants

`cub variant create <variant> <upstream-space>` clones a Space. The second
argument decides where the new variant takes its changes from. The walk made
dev from the base, then made `qa` from dev and `qa-direct` from the base.

```
$ cub variant create dev cwwalk-1009-gpu-operator-base --environment Dev --change-desc 'Clone the base as dev'
Created variant space cwwalk-1009-gpu-operator-dev (ID: <id>)
Awaiting triggers...

Bulk create operation completed:
  Success: 27 unit(s)
[exit 0 at 08:42:36]

$ cub variant create qa cwwalk-1009-gpu-operator-dev --environment QA --change-desc 'Clone dev as qa'
Created variant space cwwalk-1009-gpu-operator-qa (ID: <id>)
Awaiting triggers...

Bulk create operation completed:
  Success: 27 unit(s)
[exit 0 at 08:42:48]

$ cub variant create qa-direct cwwalk-1009-gpu-operator-base --environment QA --change-desc 'Clone the base as qa-direct'
Created variant space cwwalk-1009-gpu-operator-qa-direct (ID: <id>)
Awaiting triggers...

Bulk create operation completed:
  Success: 27 unit(s)
[exit 0 at 08:42:56]

$ cub space list --where "Slug LIKE 'cwwalk-1009-%'" -o wide
NAME                                  COMPONENT                   OWNER    VARIANT      STAGE    ENVIRONMENT    REGION    LAYER    #UNITS    #LINKS    #TAGS    #CHANGESETS    #CHANGEORDERS    #CHANGEWORKFLOWS    #FILTERS    #VIEWS    #INVOCATIONS    #TRIGGERS    #WORKERS    #TARGETS    #ATTRIBUTES
cwwalk-1009-gpu-operator-base         cwwalk-1009-gpu-operator             base                                                    27        17        2        1              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-qa-direct    cwwalk-1009-gpu-operator             qa-direct             QA                                27        44        0        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-qa           cwwalk-1009-gpu-operator             qa                    QA                                27        44        0        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-dev          cwwalk-1009-gpu-operator             dev                   Dev                               27        44        0        0              0                0                   0           0         0               0            0           0           0
[exit 0 at 08:42:56]
```

All three commands worked. Each clone has 44 Links, which is the 17 copied
Links plus one `UpgradeUnit` Link per Unit. The next commands show where those
27 Links point.

```
$ cub link list --space cwwalk-1009-gpu-operator-base --no-headers -o jq='.[] | [.Link.UpdateType, .Space.Slug, "->", .ToSpace.Slug] | join(" ")' | sort | uniq -c
  17 NeedsProvides cwwalk-1009-gpu-operator-base -> cwwalk-1009-gpu-operator-base
[exit 0 at 08:43:13]

$ cub link list --space cwwalk-1009-gpu-operator-dev --no-headers -o jq='.[] | [.Link.UpdateType, .Space.Slug, "->", .ToSpace.Slug] | join(" ")' | sort | uniq -c
  17 NeedsProvides cwwalk-1009-gpu-operator-dev -> cwwalk-1009-gpu-operator-dev
  27 UpgradeUnit cwwalk-1009-gpu-operator-dev -> cwwalk-1009-gpu-operator-base
[exit 0 at 08:43:11]

$ cub link list --space cwwalk-1009-gpu-operator-qa --no-headers -o jq='.[] | [.Link.UpdateType, .Space.Slug, "->", .ToSpace.Slug] | join(" ")' | sort | uniq -c
  17 NeedsProvides cwwalk-1009-gpu-operator-qa -> cwwalk-1009-gpu-operator-qa
  27 UpgradeUnit cwwalk-1009-gpu-operator-qa -> cwwalk-1009-gpu-operator-dev
[exit 0 at 08:43:12]

$ cub link list --space cwwalk-1009-gpu-operator-qa-direct --no-headers -o jq='.[] | [.Link.UpdateType, .Space.Slug, "->", .ToSpace.Slug] | join(" ")' | sort | uniq -c
  17 NeedsProvides cwwalk-1009-gpu-operator-qa-direct -> cwwalk-1009-gpu-operator-qa-direct
  27 UpgradeUnit cwwalk-1009-gpu-operator-qa-direct -> cwwalk-1009-gpu-operator-base
[exit 0 at 08:43:13]
```

Both forms exist. `cub variant create qa <the dev Space>` gave a chain, because
every `UpgradeUnit` Link in `qa` points at a Unit in dev. `cub variant create
qa-direct <the base Space>` gave a variant that takes from the base, because its
Links point at the base. The rest of the walk used the chain and kept
`qa-direct` unpromoted as a contrast.

## Step 4. Move the base to v26.3.3

The walk uploaded the v26.3.3 default bundle with the same Component and
variant names. The preview came first.

```
$ cub variant upload --dry-run --component cwwalk-1009-gpu-operator --variant base --namespace gpu-operator oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-default:r001@sha256:408cfa607e699388f62c1859f3f0daeecc99b8110f8cee076f06855be2d8ea1e
Pulled oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-default:r001@sha256:408cfa607e699388f62c1859f3f0daeecc99b8110f8cee076f06855be2d8ea1e (sha256:408cfa607e699388f62c1859f3f0daeecc99b8110f8cee076f06855be2d8ea1e)
Dry run: nothing was written.
Space cwwalk-1009-gpu-operator-base (Update)
  Create    nvidia-gpu-operator-v26-3-3-default-target-requirements-bundletargetrequirements
  Create    nvidia-gpu-operator-v26-3-3-default-crd-ordering-bundleroute
  Create    nvidia-gpu-operator-v26-3-3-default-lifecycle-actions-bundleroute
  Update    gpu-operator-serviceaccount
  Update    gpu-operator-clusterrole
  Update    gpu-operator-clusterrolebinding
  Update    gpu-operator-role
  Update    gpu-operator-rolebinding
  Update    gpu-operator
  Update    cluster-policy-clusterpolicy
  Empty     nvidia-gpu-operator-v26-3-2-default-crd-ordering-bundleroute
  Empty     nvidia-gpu-operator-v26-3-2-default-target-requirements-bundletargetrequirements
  Empty     nvidia-gpu-operator-v26-3-2-default-lifecycle-actions-bundleroute
  Unchanged 17 Unit(s)

Note: the following references didn't resolve to any uploaded Unit (expected when the
target lives in the cluster, e.g. a Secret created out-of-band):
... (20 lines cut, one per reference to an object outside the bundle)
[exit 0 at 08:43:29]
```

The preview lists three Units to empty. They are the v26.3.2 companion
documents, whose names are not in the v26.3.3 bundle. The upload asks before it
empties a Unit, so the command without `--yes` stopped in this shell, which has
no terminal to answer from.

```
$ cub variant upload --component cwwalk-1009-gpu-operator --variant base --namespace gpu-operator --change-desc 'Move the base to v26.3.3 default' oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-default:r001@sha256:408cfa607e699388f62c1859f3f0daeecc99b8110f8cee076f06855be2d8ea1e </dev/null
This upload empties 3 Unit(s) whose resources are no longer in the bundle:
  - nvidia-gpu-operator-v26-3-2-default-target-requirements-bundletargetrequirements
  - nvidia-gpu-operator-v26-3-2-default-crd-ordering-bundleroute
  - nvidia-gpu-operator-v26-3-2-default-lifecycle-actions-bundleroute
Their resources are withdrawn from the cluster by the next Release. Nothing is deleted.

Continue? [y/N]: Failed: read confirmation: EOF
[exit 1 at 08:43:38]

$ cub variant upload --yes --component cwwalk-1009-gpu-operator --variant base --namespace gpu-operator --change-desc 'Move the base to v26.3.3 default' oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-default:r001@sha256:408cfa607e699388f62c1859f3f0daeecc99b8110f8cee076f06855be2d8ea1e
Pulled oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-default:r001@sha256:408cfa607e699388f62c1859f3f0daeecc99b8110f8cee076f06855be2d8ea1e (sha256:408cfa607e699388f62c1859f3f0daeecc99b8110f8cee076f06855be2d8ea1e)
Space cwwalk-1009-gpu-operator-base (Update)
  Create    nvidia-gpu-operator-v26-3-3-default-target-requirements-bundletargetrequirements
  Create    nvidia-gpu-operator-v26-3-3-default-crd-ordering-bundleroute
  Create    nvidia-gpu-operator-v26-3-3-default-lifecycle-actions-bundleroute
  Update    gpu-operator-serviceaccount
  Update    gpu-operator-clusterrole
  Update    gpu-operator-clusterrolebinding
  Update    gpu-operator-role
  Update    gpu-operator-rolebinding
  Update    gpu-operator
  Update    cluster-policy-clusterpolicy
  Empty     nvidia-gpu-operator-v26-3-2-default-crd-ordering-bundleroute
  Empty     nvidia-gpu-operator-v26-3-2-default-lifecycle-actions-bundleroute
  Empty     nvidia-gpu-operator-v26-3-2-default-target-requirements-bundletargetrequirements
  Unchanged 17 Unit(s)

Note: the following references didn't resolve to any uploaded Unit (expected when the
target lives in the cluster, e.g. a Secret created out-of-band):
... (20 lines cut, one per reference to an object outside the bundle)

Revert this upload of cwwalk-1009-gpu-operator-base with:
  cub unit update --patch --space cwwalk-1009-gpu-operator-base --restore Before:ChangeSet:upload-20261009-074347 --where "Labels.UploadSource = 'cwwalk-1009-gpu-operator'"
[exit 0 at 08:43:50]

$ cub space list --where "Slug LIKE 'cwwalk-1009-%'" -o wide
NAME                                  COMPONENT                   OWNER    VARIANT      STAGE    ENVIRONMENT    REGION    LAYER    #UNITS    #LINKS    #TAGS    #CHANGESETS    #CHANGEORDERS    #CHANGEWORKFLOWS    #FILTERS    #VIEWS    #INVOCATIONS    #TRIGGERS    #WORKERS    #TARGETS    #ATTRIBUTES
cwwalk-1009-gpu-operator-base         cwwalk-1009-gpu-operator             base                                                    30        17        4        2              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-qa-direct    cwwalk-1009-gpu-operator             qa-direct             QA                                27        44        0        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-qa           cwwalk-1009-gpu-operator             qa                    QA                                27        44        0        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-dev          cwwalk-1009-gpu-operator             dev                   Dev                               27        44        0        0              0                0                   0           0         0               0            0           0           0
[exit 0 at 08:43:50]
```

With `--yes` the upload worked. The base went from 27 Units to 30, because the
three emptied Units stay and three new companion Units arrive. The dev and QA
Spaces did not change.

`cub variant diff` across the upload's ChangeSet shows what changed in the base.

```
$ cub variant diff cwwalk-1009-gpu-operator-base Before:ChangeSet:upload-20261009-074347 ChangeSet:upload-20261009-074347 -o mutations
=== cwwalk-1009-gpu-operator-base/cluster-policy-clusterpolicy/2 -> cwwalk-1009-gpu-operator-base/cluster-policy-clusterpolicy/3
Resource: nvidia.com/v1/ClusterPolicy /cluster-policy
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
  ~ [Update] spec.daemonsets.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] spec.validator.version
      v26.3.2 → v26.3.3
  ~ [Update] spec.devicePlugin.version
      v0.19.2 → v0.19.3
  ~ [Update] spec.gfd.version
      v0.19.2 → v0.19.3
  ~ [Update] spec.nodeStatusExporter.version
      v26.3.2 → v26.3.3
=== cwwalk-1009-gpu-operator-base/gpu-operator/2 -> cwwalk-1009-gpu-operator-base/gpu-operator/3
Resource: apps/v1/Deployment gpu-operator/gpu-operator
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
  ~ [Update] spec.template.metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] spec.template.metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
  ~ [Update] spec.template.spec.containers.?name=gpu-operator.image
      nvcr.io/nvidia/gpu-operator:v26.3.2 → nvcr.io/nvidia/gpu-operator:v26.3.3
=== cwwalk-1009-gpu-operator-base/gpu-operator-clusterrole/2 -> cwwalk-1009-gpu-operator-base/gpu-operator-clusterrole/3
Resource: rbac.authorization.k8s.io/v1/ClusterRole /gpu-operator
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
=== cwwalk-1009-gpu-operator-base/gpu-operator-clusterrolebinding/2 -> cwwalk-1009-gpu-operator-base/gpu-operator-clusterrolebinding/3
Resource: rbac.authorization.k8s.io/v1/ClusterRoleBinding /gpu-operator
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
=== cwwalk-1009-gpu-operator-base/gpu-operator-role/2 -> cwwalk-1009-gpu-operator-base/gpu-operator-role/3
Resource: rbac.authorization.k8s.io/v1/Role gpu-operator/gpu-operator
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
=== cwwalk-1009-gpu-operator-base/gpu-operator-rolebinding/2 -> cwwalk-1009-gpu-operator-base/gpu-operator-rolebinding/3
Resource: rbac.authorization.k8s.io/v1/RoleBinding gpu-operator/gpu-operator
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
=== cwwalk-1009-gpu-operator-base/gpu-operator-serviceaccount/2 -> cwwalk-1009-gpu-operator-base/gpu-operator-serviceaccount/3
Resource: v1/ServiceAccount gpu-operator/gpu-operator
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
... (338 more lines cut, the full text of three deleted and three added companion documents)
13 of 30 unit(s) changed between Before:ChangeSet:upload-20261009-074347 and ChangeSet:upload-20261009-074347 in cwwalk-1009-gpu-operator-base (0 unchanged, 17 at neither)
[exit 0 at 08:43:58]
```

Seven Kubernetes Units changed, with 22 changed paths between them. The
changes are the chart and version labels, the operator image, and four
component versions in the ClusterPolicy. The 338 lines cut are the six
companion documents. The last line counts 13 changed Units, which is the seven
Kubernetes Units, the three emptied and the three added.

## Step 5. Promote into dev, then into QA

The preview for dev has a short form and a mutations form.

```
$ cub variant promote cwwalk-1009-gpu-operator-dev --dry-run
Would upgrade 10 unit(s) behind their upstream
  3 of them emptied, as their upstream units were
Would add 3 unit(s) from upstream
  + nvidia-gpu-operator-v26-3-3-default-crd-ordering-bundleroute
  + nvidia-gpu-operator-v26-3-3-default-lifecycle-actions-bundleroute
  + nvidia-gpu-operator-v26-3-3-default-target-requirements-bundletargetrequirements
[exit 0 at 08:44:15]

$ cub variant promote cwwalk-1009-gpu-operator-dev --dry-run -o mutations
Changes to unit cluster-policy-clusterpolicy from promote:
Resource: nvidia.com/v1/ClusterPolicy /cluster-policy
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
  ~ [Update] spec.daemonsets.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] spec.validator.version
      v26.3.2 → v26.3.3
  ~ [Update] spec.devicePlugin.version
      v0.19.2 → v0.19.3
  ~ [Update] spec.gfd.version
      v0.19.2 → v0.19.3
  ~ [Update] spec.nodeStatusExporter.version
      v26.3.2 → v26.3.3

Changes to unit gpu-operator from promote:
Resource: apps/v1/Deployment gpu-operator/gpu-operator
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
  ~ [Update] spec.template.metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] spec.template.metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
  ~ [Update] spec.template.spec.containers.?name=gpu-operator.image
      nvcr.io/nvidia/gpu-operator:v26.3.2 → nvcr.io/nvidia/gpu-operator:v26.3.3

... (381 more lines cut, five more Units with two label paths each, then the six companion documents)
[exit 0 at 08:44:17]
```

Before dev took the change, the walk asked what QA would take. The chained
`qa` had nothing to take. The walk then ran the promotion for real, to see
whether ConfigHub refuses or warns.

```
$ cub variant promote cwwalk-1009-gpu-operator-qa --dry-run -o mutations
No units behind their upstream
[exit 0 at 08:44:27]

$ cub variant promote cwwalk-1009-gpu-operator-qa --dry-run
Would upgrade 0 unit(s) behind their upstream
Would add 0 unit(s) from upstream
[exit 0 at 08:44:28]

$ cub variant promote cwwalk-1009-gpu-operator-qa --change-desc 'Try to take v26.3.3 before dev has it'
Upgraded 0 unit(s) behind their upstream
Adding 0 unit(s) from upstream
[exit 0 at 08:44:37]

$ cub variant promote cwwalk-1009-gpu-operator-qa-direct --dry-run
Would upgrade 10 unit(s) behind their upstream
  3 of them emptied, as their upstream units were
Would add 3 unit(s) from upstream
  + nvidia-gpu-operator-v26-3-3-default-crd-ordering-bundleroute
  + nvidia-gpu-operator-v26-3-3-default-lifecycle-actions-bundleroute
  + nvidia-gpu-operator-v26-3-3-default-target-requirements-bundletargetrequirements
[exit 0 at 08:44:29]
```

The promotion of `qa` exited 0 and changed nothing. It did not say that dev was
behind the base. A chained QA cannot pass dev, and ConfigHub does not report
that as an error. `qa-direct` could have taken the change at once, because it
reads from the base. The `qa-direct` preview ran at 08:44:29, before the `qa`
promotion at 08:44:37. The log shows it last so that the two `qa` results sit
together.

Dev was promoted next.

```
$ cub variant promote cwwalk-1009-gpu-operator-dev --change-desc 'Take v26.3.3 from the base'
Upgraded 10 unit(s) behind their upstream
  3 of them emptied, as their upstream units were
Adding 3 unit(s) from upstream
  + nvidia-gpu-operator-v26-3-3-default-crd-ordering-bundleroute
  + nvidia-gpu-operator-v26-3-3-default-lifecycle-actions-bundleroute
  + nvidia-gpu-operator-v26-3-3-default-target-requirements-bundletargetrequirements
[exit 0 at 08:44:41]

$ cub variant promote cwwalk-1009-gpu-operator-dev --dry-run
Would upgrade 0 unit(s) behind their upstream
Would add 0 unit(s) from upstream
[exit 0 at 08:44:42]
```

Then QA, which now had something to take from dev.

```
$ cub variant promote cwwalk-1009-gpu-operator-qa --dry-run
Would upgrade 10 unit(s) behind their upstream
  3 of them emptied, as their upstream units were
Would add 3 unit(s) from upstream
  + nvidia-gpu-operator-v26-3-3-default-crd-ordering-bundleroute
  + nvidia-gpu-operator-v26-3-3-default-lifecycle-actions-bundleroute
  + nvidia-gpu-operator-v26-3-3-default-target-requirements-bundletargetrequirements
[exit 0 at 08:44:50]

$ cub variant promote cwwalk-1009-gpu-operator-qa --dry-run -o mutations
Changes to unit cluster-policy-clusterpolicy from promote:
Resource: nvidia.com/v1/ClusterPolicy /cluster-policy
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] metadata.labels.app~1kubernetes~1io/version
      v26.3.2 → v26.3.3
  ~ [Update] spec.daemonsets.labels.helm~1sh/chart
      gpu-operator-v26.3.2 → gpu-operator-v26.3.3
  ~ [Update] spec.validator.version
      v26.3.2 → v26.3.3
  ~ [Update] spec.devicePlugin.version
      v0.19.2 → v0.19.3
  ~ [Update] spec.gfd.version
      v0.19.2 → v0.19.3
  ~ [Update] spec.nodeStatusExporter.version
      v26.3.2 → v26.3.3
... (395 more lines cut, the same 22 paths and six companion documents that dev took)
[exit 0 at 08:44:52]

$ cub variant promote cwwalk-1009-gpu-operator-qa --change-desc 'Take v26.3.3 from dev'
Upgraded 10 unit(s) behind their upstream
  3 of them emptied, as their upstream units were
Adding 3 unit(s) from upstream
  + nvidia-gpu-operator-v26-3-3-default-crd-ordering-bundleroute
  + nvidia-gpu-operator-v26-3-3-default-lifecycle-actions-bundleroute
  + nvidia-gpu-operator-v26-3-3-default-target-requirements-bundletargetrequirements
[exit 0 at 08:44:56]

$ cub variant promote cwwalk-1009-gpu-operator-qa --dry-run
Would upgrade 0 unit(s) behind their upstream
Would add 0 unit(s) from upstream
[exit 0 at 08:44:56]

$ cub space list --where "Slug LIKE 'cwwalk-1009-%'" -o wide
NAME                                  COMPONENT                   OWNER    VARIANT      STAGE    ENVIRONMENT    REGION    LAYER    #UNITS    #LINKS    #TAGS    #CHANGESETS    #CHANGEORDERS    #CHANGEWORKFLOWS    #FILTERS    #VIEWS    #INVOCATIONS    #TRIGGERS    #WORKERS    #TARGETS    #ATTRIBUTES
cwwalk-1009-gpu-operator-base         cwwalk-1009-gpu-operator             base                                                    30        17        4        2              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-qa-direct    cwwalk-1009-gpu-operator             qa-direct             QA                                27        44        0        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-qa           cwwalk-1009-gpu-operator             qa                    QA                                30        47        0        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-dev          cwwalk-1009-gpu-operator             dev                   Dev                               30        47        0        0              0                0                   0           0         0               0            0           0           0
[exit 0 at 08:44:57]
```

Every promotion worked on the first try. The server asked for no approval and
refused nothing. The organization had no Trigger and no ChangeWorkflow on these
Spaces, so no gate existed to meet. `cub variant approve` was not run.

## Step 6. What base, dev and QA hold after the version step

`cub unit diff` compares one Unit in two Spaces. The walk has no command that
compares two whole Spaces, so a small loop ran the diff for every Unit name.
The loop is `bin/diffall.sh` in the scratch directory, and it prints `same`
when the command printed `No changes`.

```
$ cub unit diff --space cwwalk-1009-gpu-operator-base cluster-policy-clusterpolicy --with-unit cwwalk-1009-gpu-operator-dev/cluster-policy-clusterpolicy -o mutations
No changes
[exit 0 at 08:45:11]

$ cub unit diff --space cwwalk-1009-gpu-operator-dev cluster-policy-clusterpolicy --with-unit cwwalk-1009-gpu-operator-qa/cluster-policy-clusterpolicy -o mutations
No changes
[exit 0 at 08:45:13]

$ cub unit diff --space cwwalk-1009-gpu-operator-base cluster-policy-clusterpolicy --with-unit cwwalk-1009-gpu-operator-qa-direct/cluster-policy-clusterpolicy -o mutations
Resource: nvidia.com/v1/ClusterPolicy /cluster-policy
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v26.3.3 → gpu-operator-v26.3.2
  ~ [Update] metadata.labels.app~1kubernetes~1io/version
      v26.3.3 → v26.3.2
  ~ [Update] spec.daemonsets.labels.helm~1sh/chart
      gpu-operator-v26.3.3 → gpu-operator-v26.3.2
  ~ [Update] spec.validator.version
      v26.3.3 → v26.3.2
  ~ [Update] spec.devicePlugin.version
      v0.19.3 → v0.19.2
  ~ [Update] spec.gfd.version
      v0.19.3 → v0.19.2
  ~ [Update] spec.nodeStatusExporter.version
      v26.3.3 → v26.3.2
[exit 0 at 08:45:14]

$ for s in base dev qa qa-direct; do echo "$s $(cub unit data --space cwwalk-1009-gpu-operator-$s gpu-operator | grep 'image: nvcr.io/nvidia/gpu-operator')"; done
base         image: nvcr.io/nvidia/gpu-operator:v26.3.3
dev         image: nvcr.io/nvidia/gpu-operator:v26.3.3
qa         image: nvcr.io/nvidia/gpu-operator:v26.3.3
qa-direct         image: nvcr.io/nvidia/gpu-operator:v26.3.2
[exit 0 at 08:47:09]
```

Base, dev and `qa` hold v26.3.3. `qa-direct` still holds v26.3.2, as expected.

```
$ bin/diffall.sh cwwalk-1009-gpu-operator-base cwwalk-1009-gpu-operator-dev
... (27 lines cut, one per Unit that is the same in both Spaces)
differs   nvidia-gpu-operator-v26-3-3-default-crd-ordering-bundleroute
            Resource: evidence.confighub.com/v1alpha1/BundleRoute gpu-operator/nvidia-gpu-operator-v26-3-3-default-crd-ordering  (was evidence.confighub.com/v1alpha1/BundleRoute /nvidia-gpu-operator-v26-3-3-default-crd-ordering)
              + [Add] metadata.namespace
                  gpu-operator
differs   nvidia-gpu-operator-v26-3-3-default-lifecycle-actions-bundleroute
            Resource: evidence.confighub.com/v1alpha1/BundleRoute gpu-operator/nvidia-gpu-operator-v26-3-3-default-lifecycle-actions  (was evidence.confighub.com/v1alpha1/BundleRoute /nvidia-gpu-operator-v26-3-3-default-lifecycle-actions)
              + [Add] metadata.namespace
                  gpu-operator
differs   nvidia-gpu-operator-v26-3-3-default-target-requirements-bundletargetrequirements
            Resource: evidence.confighub.com/v1alpha1/BundleTargetRequirements gpu-operator/nvidia-gpu-operator-v26-3-3-default-target-requirements  (was evidence.confighub.com/v1alpha1/BundleTargetRequirements /nvidia-gpu-operator-v26-3-3-default-target-requirements)
              + [Add] metadata.namespace
                  gpu-operator
[exit 0 at 08:46:11]

$ bin/diffall.sh cwwalk-1009-gpu-operator-dev cwwalk-1009-gpu-operator-qa
... (30 lines cut, one per Unit that is the same in both Spaces)
[exit 0 at 08:47:06]

$ cub space list --where "Slug LIKE 'cwwalk-1009-%'" --no-headers -o jq='.[] | [.Space.Slug, (.Space.Labels|tostring), (.Space.Annotations|keys|tostring)] | join(" ")'
cwwalk-1009-gpu-operator-base {"Namespace":"gpu-operator","Variant":"base"} ["ExternalSourceDigest","ExternalSourceRef"]
cwwalk-1009-gpu-operator-qa-direct {"Environment":"QA","Namespace":"gpu-operator","Variant":"qa-direct"} ["ExternalSourceDigest","ExternalSourceRef","UpstreamSpaceID"]
cwwalk-1009-gpu-operator-qa {"Environment":"QA","Namespace":"gpu-operator","Variant":"qa"} ["ExternalSourceDigest","ExternalSourceRef","UpstreamSpaceID"]
cwwalk-1009-gpu-operator-dev {"Environment":"Dev","Namespace":"gpu-operator","Variant":"dev"} ["ExternalSourceDigest","ExternalSourceRef","UpstreamSpaceID"]
[exit 0 at 08:45:24]
```

Dev and `qa` are the same in all 30 Units. Base and dev differ in three Units,
and none of them is a Kubernetes object. The promotion wrote
`metadata.namespace: gpu-operator` into the three companion documents it added.
The upload had not. The last command shows the cause. The upload's
`--namespace` flag left a `Namespace` label on the base Space, each variant
inherited it, and a promotion runs `set-namespace` on the Units it adds to a
Space with that label.

## Step 7. One bounded change, the driver version

The bundle for `nvidia-gpu-operator-v26-3-3-driver-595-91-07` differs from the
default bundle in one field of one Kubernetes object.

```
$ cub variant upload --dry-run --component cwwalk-1009-gpu-operator --variant base --namespace gpu-operator oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-driver-595-91-07:r001@sha256:40d9e69207a27448d6c64616d19b079f5315659e971f01754a8319c370573ce3
Pulled oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-driver-595-91-07:r001@sha256:40d9e69207a27448d6c64616d19b079f5315659e971f01754a8319c370573ce3 (sha256:40d9e69207a27448d6c64616d19b079f5315659e971f01754a8319c370573ce3)
Dry run: nothing was written.
Space cwwalk-1009-gpu-operator-base (Update)
  Create    nvidia-gpu-operator-v26-3-3-driver-595-91-07-target-requirements-bundletargetrequirements
  Create    nvidia-gpu-operator-v26-3-3-driver-595-91-07-crd-ordering-bundleroute
  Create    nvidia-gpu-operator-v26-3-3-driver-595-91-07-lifecycle-actions-bundleroute
  Update    cluster-policy-clusterpolicy
  Empty     nvidia-gpu-operator-v26-3-3-default-crd-ordering-bundleroute
  Empty     nvidia-gpu-operator-v26-3-3-default-lifecycle-actions-bundleroute
  Empty     nvidia-gpu-operator-v26-3-3-default-target-requirements-bundletargetrequirements
  Unchanged 26 Unit(s)

Note: the following references didn't resolve to any uploaded Unit (expected when the
target lives in the cluster, e.g. a Secret created out-of-band):
... (20 lines cut, one per reference to an object outside the bundle)
[exit 0 at 08:47:20]

$ cub variant upload --yes --component cwwalk-1009-gpu-operator --variant base --namespace gpu-operator --change-desc 'Pin the driver to 595.91.07' oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-driver-595-91-07:r001@sha256:40d9e69207a27448d6c64616d19b079f5315659e971f01754a8319c370573ce3
Pulled oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-driver-595-91-07:r001@sha256:40d9e69207a27448d6c64616d19b079f5315659e971f01754a8319c370573ce3 (sha256:40d9e69207a27448d6c64616d19b079f5315659e971f01754a8319c370573ce3)
Space cwwalk-1009-gpu-operator-base (Update)
  Create    nvidia-gpu-operator-v26-3-3-driver-595-91-07-target-requirements-bundletargetrequirements
  Create    nvidia-gpu-operator-v26-3-3-driver-595-91-07-crd-ordering-bundleroute
  Create    nvidia-gpu-operator-v26-3-3-driver-595-91-07-lifecycle-actions-bundleroute
  Update    cluster-policy-clusterpolicy
  Empty     nvidia-gpu-operator-v26-3-3-default-crd-ordering-bundleroute
  Empty     nvidia-gpu-operator-v26-3-3-default-lifecycle-actions-bundleroute
  Empty     nvidia-gpu-operator-v26-3-3-default-target-requirements-bundletargetrequirements
  Unchanged 26 Unit(s)

Note: the following references didn't resolve to any uploaded Unit (expected when the
target lives in the cluster, e.g. a Secret created out-of-band):
... (20 lines cut, one per reference to an object outside the bundle)

Revert this upload of cwwalk-1009-gpu-operator-base with:
  cub unit update --patch --space cwwalk-1009-gpu-operator-base --restore Before:ChangeSet:upload-20261009-074730 --where "Labels.UploadSource = 'cwwalk-1009-gpu-operator'"
[exit 0 at 08:47:30]

$ cub variant diff cwwalk-1009-gpu-operator-base Before:ChangeSet:upload-20261009-074730 ChangeSet:upload-20261009-074730 -o mutations --where "Slug = 'cluster-policy-clusterpolicy'"
=== cwwalk-1009-gpu-operator-base/cluster-policy-clusterpolicy/3 -> cwwalk-1009-gpu-operator-base/cluster-policy-clusterpolicy/4
Resource: nvidia.com/v1/ClusterPolicy /cluster-policy
  ~ [Update] spec.driver.version
      580.126.20 → 595.91.07
1 of 1 unit(s) changed between Before:ChangeSet:upload-20261009-074730 and ChangeSet:upload-20261009-074730 in cwwalk-1009-gpu-operator-base (0 unchanged, 0 at neither)
[exit 0 at 08:47:40]
```

The one field is `spec.driver.version` in the ClusterPolicy, from 580.126.20 to
595.91.07. The upload also emptied the three v26.3.3 default companion Units
and created three more, so the base reached 33 Units. The same diff without
`--where` printed 343 lines, and four of them were about that one field.

```
$ cub variant promote cwwalk-1009-gpu-operator-dev --dry-run
Would upgrade 4 unit(s) behind their upstream
  3 of them emptied, as their upstream units were
Would add 3 unit(s) from upstream
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-crd-ordering-bundleroute
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-lifecycle-actions-bundleroute
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-target-requirements-bundletargetrequirements
[exit 0 at 08:47:42]

$ cub variant promote cwwalk-1009-gpu-operator-dev --dry-run -o mutations
Changes to unit cluster-policy-clusterpolicy from promote:
Resource: nvidia.com/v1/ClusterPolicy /cluster-policy
  ~ [Update] spec.driver.version
      580.126.20 → 595.91.07

... (349 more lines cut, the six companion documents)
[exit 0 at 08:47:43]

$ cub variant promote cwwalk-1009-gpu-operator-qa --dry-run
Would upgrade 0 unit(s) behind their upstream
Would add 0 unit(s) from upstream
[exit 0 at 08:47:43]

$ cub variant promote cwwalk-1009-gpu-operator-dev --change-desc 'Take driver 595.91.07 from the base'
Upgraded 4 unit(s) behind their upstream
  3 of them emptied, as their upstream units were
Adding 3 unit(s) from upstream
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-crd-ordering-bundleroute
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-lifecycle-actions-bundleroute
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-target-requirements-bundletargetrequirements
[exit 0 at 08:47:55]

$ cub variant promote cwwalk-1009-gpu-operator-qa --dry-run
Would upgrade 4 unit(s) behind their upstream
  3 of them emptied, as their upstream units were
Would add 3 unit(s) from upstream
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-crd-ordering-bundleroute
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-lifecycle-actions-bundleroute
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-target-requirements-bundletargetrequirements
[exit 0 at 08:47:56]

$ cub variant promote cwwalk-1009-gpu-operator-qa --dry-run -o mutations
Changes to unit cluster-policy-clusterpolicy from promote:
Resource: nvidia.com/v1/ClusterPolicy /cluster-policy
  ~ [Update] spec.driver.version
      580.126.20 → 595.91.07

... (349 more lines cut, the six companion documents)
[exit 0 at 08:47:56]

$ cub variant promote cwwalk-1009-gpu-operator-qa --change-desc 'Take driver 595.91.07 from dev'
Upgraded 4 unit(s) behind their upstream
  3 of them emptied, as their upstream units were
Adding 3 unit(s) from upstream
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-crd-ordering-bundleroute
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-lifecycle-actions-bundleroute
  + nvidia-gpu-operator-v26-3-3-driver-595-91-07-target-requirements-bundletargetrequirements
[exit 0 at 08:47:58]
```

The field moved base to dev to QA in the same way as the version step. QA had
nothing to take until dev had been promoted.

```
$ for s in base dev qa qa-direct; do echo "$s"; cub unit data --space cwwalk-1009-gpu-operator-$s cluster-policy-clusterpolicy | grep -A12 '^  driver:' | grep -E 'version|repository|image'; done
base
    repository: nvcr.io/nvidia
    image: driver
    version: "595.91.07"
    imagePullPolicy: IfNotPresent
dev
    repository: nvcr.io/nvidia
    image: driver
    version: "595.91.07"
    imagePullPolicy: IfNotPresent
qa
    repository: nvcr.io/nvidia
    image: driver
    version: "595.91.07"
    imagePullPolicy: IfNotPresent
qa-direct
    repository: nvcr.io/nvidia
    image: driver
    version: "580.126.20"
    imagePullPolicy: IfNotPresent
[exit 0 at 08:48:01]

$ cub revision list --space cwwalk-1009-gpu-operator-base cluster-policy-clusterpolicy --no-headers -o jq='.[] | [(.Revision.RevisionNum|tostring), .Revision.Source, .Revision.Description] | join(" | ")'
4 | MergeExternal | MergeExternal; from oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-driver-595-91-07:r001@sha256:40d9e69207a27448d6c64616d19b079f5315659e971f01754a8319c370573ce3
3 | MergeExternal | MergeExternal; from oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-default:r001@sha256:408cfa607e699388f62c1859f3f0daeecc99b8110f8cee076f06855be2d8ea1e
2 | MergeExternal | Seed the base at v26.3.2 default
1 | MergeExternal | Empty revision preceding the unit's first content, marking the start of ChangeSet upload-20261009-074209
[exit 0 at 08:48:10]

$ cub revision list --space cwwalk-1009-gpu-operator-qa cluster-policy-clusterpolicy --no-headers -o jq='.[] | [(.Revision.RevisionNum|tostring), .Revision.Source, .Revision.Description] | join(" | ")'
4 | UpgradeUnit | Take driver 595.91.07 from dev
3 | UpgradeUnit | Take v26.3.3 from dev
2 | CloneUnit | Clone dev as qa
1 | CloneUnit | Empty revision preceding the unit's first content
[exit 0 at 08:48:11]

$ bin/diffall.sh cwwalk-1009-gpu-operator-base cwwalk-1009-gpu-operator-dev
... (30 lines cut, one per Unit that is the same in both Spaces)
differs   nvidia-gpu-operator-v26-3-3-driver-595-91-07-crd-ordering-bundleroute
            Resource: evidence.confighub.com/v1alpha1/BundleRoute gpu-operator/nvidia-gpu-operator-v26-3-3-driver-595-91-07-crd-ordering  (was evidence.confighub.com/v1alpha1/BundleRoute /nvidia-gpu-operator-v26-3-3-driver-595-91-07-crd-ordering)
              + [Add] metadata.namespace
                  gpu-operator
differs   nvidia-gpu-operator-v26-3-3-driver-595-91-07-lifecycle-actions-bundleroute
            Resource: evidence.confighub.com/v1alpha1/BundleRoute gpu-operator/nvidia-gpu-operator-v26-3-3-driver-595-91-07-lifecycle-actions  (was evidence.confighub.com/v1alpha1/BundleRoute /nvidia-gpu-operator-v26-3-3-driver-595-91-07-lifecycle-actions)
              + [Add] metadata.namespace
                  gpu-operator
differs   nvidia-gpu-operator-v26-3-3-driver-595-91-07-target-requirements-bundletargetrequirements
            Resource: evidence.confighub.com/v1alpha1/BundleTargetRequirements gpu-operator/nvidia-gpu-operator-v26-3-3-driver-595-91-07-target-requirements  (was evidence.confighub.com/v1alpha1/BundleTargetRequirements /nvidia-gpu-operator-v26-3-3-driver-595-91-07-target-requirements)
              + [Add] metadata.namespace
                  gpu-operator
[exit 0 at 08:49:09]

$ bin/diffall.sh cwwalk-1009-gpu-operator-dev cwwalk-1009-gpu-operator-qa
... (33 lines cut, one per Unit that is the same in both Spaces)
[exit 0 at 08:50:01]

$ cub space list --where "Slug LIKE 'cwwalk-1009-%'" -o wide
NAME                                  COMPONENT                   OWNER    VARIANT      STAGE    ENVIRONMENT    REGION    LAYER    #UNITS    #LINKS    #TAGS    #CHANGESETS    #CHANGEORDERS    #CHANGEWORKFLOWS    #FILTERS    #VIEWS    #INVOCATIONS    #TRIGGERS    #WORKERS    #TARGETS    #ATTRIBUTES
cwwalk-1009-gpu-operator-base         cwwalk-1009-gpu-operator             base                                                    33        17        6        3              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-qa-direct    cwwalk-1009-gpu-operator             qa-direct             QA                                27        44        0        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-qa           cwwalk-1009-gpu-operator             qa                    QA                                33        50        0        0              0                0                   0           0         0               0            0           0           0
cwwalk-1009-gpu-operator-dev          cwwalk-1009-gpu-operator             dev                   Dev                               33        50        0        0              0                0                   0           0         0               0            0           0           0
[exit 0 at 08:50:01]
```

Base, dev and `qa` hold driver 595.91.07, and `qa-direct` still holds
580.126.20. Dev and `qa` are the same in all 33 Units. Base and dev differ only
in the namespace line of the three newest companion Units.

The revision lists show one more thing. The QA Unit's revisions carry the
`--change-desc` text of each promotion. The base Unit's revisions 3 and 4 do
not carry the `--change-desc` text of the uploads that made them.

## What went wrong

1. **The listing's upload step does not print the command this walk was asked to follow.** The `nextSteps` upload step prints `cub installer upload --work-dir`. The walk was told it would find a `cub variant upload` command for the literal bundle there. The bundle reference is in `oci.bundles`, and a `cub variant upload` command for a local `./rendered` directory is in `variants.howToMakeOne.commands`. The walk combined the two.
2. **An upgrade by upload empties three Units and adds three, every time.** Each bundle carries three companion documents named after the entry id. A second bundle has three different names, so the upload empties the old three and creates new ones. The base grew from 27 Units to 30 and then to 33, and each variant followed. The upload needs `--yes` for that. Without it, in a shell with no terminal, it printed `Continue? [y/N]: Failed: read confirmation: EOF` and exited 1. The same six documents fill the previews, where one changed field came with about 350 lines of companion text.
3. **A promotion changes the companion documents that it adds.** `cub variant upload --namespace gpu-operator` leaves a `Namespace` label on the base Space. Each variant inherits the label, and `cub variant promote` then writes `metadata.namespace: gpu-operator` into every Unit it adds. The three added companion Units in dev and QA differ from the base by that line. The help for `cub variant promote` describes the rule. The upload did not apply the same rule to the same documents, so base and dev disagree.
4. **`--change-desc` on an upload is not recorded on a Unit that the upload updates.** The first upload recorded `Seed the base at v26.3.2 default` on the Units it created. The second and third uploads were given a description, and the updated ClusterPolicy Unit recorded `MergeExternal; from oci://...` instead. The walk looked at one Unit only.
5. **Promoting a chained QA before dev is a silent no-op.** The command printed `Upgraded 0 unit(s) behind their upstream` and exited 0. It gave no sign that the upstream was itself behind its own upstream. The exit code is true to what happened, and a reader who expected a refusal gets none.
6. **A base cannot be deleted while a variant still reads from it.** `cub space delete --recursive-force` on the base returned HTTP 409 and named the Links. Deleting the Spaces downstream first worked. The Component outlived its Spaces and needed `cub component delete`.
7. **Four mistakes were the walker's own.** The first version and context check ran outside the recording wrapper, so step 1 shows a second run of those two commands. A shell line used `echo` with a bare `=====` and zsh stopped on it, with nothing written. A first query for each Unit's upstream guessed a field named `UpstreamSpace`, which the list output does not have, so it printed a fallback word and the log leaves that query out. The Links listing in step 3 is the evidence instead. A first list of base Units added a byte count from a field the list does not return, and the log leaves that out too.
8. **Not every help page was read first.** The walk read the help for `variant upload`, `variant create`, `variant promote`, `variant diff`, `unit diff`, `space list`, `unit list`, `space delete`, `component delete` and `plugin list`, and the usage part of `revision list`. It used `link list`, `component list`, `unit data`, `context list` and `version` without reading their help. All five only read.

No command in this walk exited 0 after failing.

## What the walk did not cover

- No cluster ran. No Target, Worker or Release existed, so nothing here shows that a promoted Space deploys.
- No GPU was involved. The walk says nothing about whether v26.3.3 or driver 595.91.07 works on a node.
- No approval workflow was met. The Spaces had no Trigger and no ChangeWorkflow, so the walk did not see a gate hold a promotion, and `cub variant approve` was not run.
- No variant carried a local change. The walk did not see how a promotion merges with an edit made in dev or QA.
- The `--change-order`, `--squash`, `--tag` and `--expected-plan` flags of `cub variant promote` were not used.
- The walk did not test a rollback. The upload printed a revert command each time, and `cub variant demote` exists, and neither was run.
- The walk did not test whether the emptied companion Units can be removed, or whether the upload can leave the companion documents out.
- `qa-direct` was created and previewed and never promoted.

## Cleanup proof

The live example's Spaces were compared with the start before anything was
deleted.

```
$ cub space list --where "Slug LIKE '%gpu-operator%'"
NAME                                  COMPONENT                   OWNER    VARIANT      STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
cwwalk-1009-gpu-operator-base         cwwalk-1009-gpu-operator             base                                                    33
gpu-operator-v26-3-3                  gpu-operator                         v26-3-3                                                 24
cwwalk-1009-gpu-operator-qa-direct    cwwalk-1009-gpu-operator             qa-direct             QA                                27
cwwalk-1009-gpu-operator-qa           cwwalk-1009-gpu-operator             qa                    QA                                33
gpu-operator-prod                     gpu-operator                         prod                                                    24
cwwalk-1009-gpu-operator-dev          cwwalk-1009-gpu-operator             dev                   Dev                               33
gpu-operator-v25-10-1                 gpu-operator                         v25-10-1                                                24
gpu-operator-v26-3-2                  gpu-operator                         v26-3-2                                                 24
[exit 0 at 08:50:27]
```

The Unit listing from step 1 was run again and the two results were compared
with `diff`. They were identical, 96 lines each, with SHA-256
`7fc4b5eaaef386bbda0c0e1b52f10a3ec64630e5047d2473ed16a2700fe40a85`.

The first delete tried the base and was refused.

```
$ cub space delete --recursive-force cwwalk-1009-gpu-operator-base
Failed: HTTP 409 for req <request-id>: Cannot delete Space cwwalk-1009-gpu-operator-base: 20 Units it contains are still referenced by 60 Links. Remove those references first, or detach them as part of the delete.
Details:
  failed to delete entity
Metadata:
  Link cwwalk-1009-gpu-operator-dev/upgrade-clusterpolicies.nvidia.com-crd: ToUnitID references Unit cwwalk-1009-gpu-operator-base/clusterpolicies.nvidia.com-crd
... (21 more lines cut, one per Link that still pointed at a base Unit, then the server's own line that says 40 more)
[exit 1 at 08:50:35]

$ cub space delete --recursive-force cwwalk-1009-gpu-operator-qa
Successfully deleted space cwwalk-1009-gpu-operator-qa (<id>)
[exit 0 at 08:50:44]

$ cub space delete --recursive-force cwwalk-1009-gpu-operator-qa-direct
Successfully deleted space cwwalk-1009-gpu-operator-qa-direct (<id>)
[exit 0 at 08:50:46]

$ cub space delete --recursive-force cwwalk-1009-gpu-operator-dev
Successfully deleted space cwwalk-1009-gpu-operator-dev (<id>)
[exit 0 at 08:50:48]

$ cub space delete --recursive-force cwwalk-1009-gpu-operator-base
Successfully deleted space cwwalk-1009-gpu-operator-base (<id>)
[exit 0 at 08:50:49]

$ cub component list --where "Slug LIKE '%cwwalk%'"
NAME                        WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
cwwalk-1009-gpu-operator    false                0
[exit 0 at 08:50:51]

$ cub component delete cwwalk-1009-gpu-operator
Successfully deleted component cwwalk-1009-gpu-operator (<id>)
[exit 0 at 08:51:02]
```

Nothing with the walk's prefix remains.

```
$ cub space list --where "Slug LIKE '%cwwalk%'"
NAME    COMPONENT    OWNER    VARIANT    STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
[exit 0 at 08:50:50]

$ cub component list --where "Slug LIKE '%cwwalk%'"
NAME    WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
[exit 0 at 08:51:03]

$ cub unit list --space '*' --where "Space.Slug LIKE '%cwwalk%'"
NAME    SPACE    CHANGESET    TARGET    UPGRADE-NEEDED    UNRELEASED-CHANGES    VALIDATION-ERRORS    LAST-CHANGE-DESCRIPTION
[exit 0 at 08:51:03]

$ cub space list --include-hidden --where "Slug LIKE '%cwwalk%'"
NAME    COMPONENT    OWNER    VARIANT    STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
[exit 0 at 08:51:04]

$ cub unit list --space '*' --include-hidden --contains cwwalk-1009
NAME    SPACE    CHANGESET    TARGET    UPGRADE-NEEDED    UNRELEASED-CHANGES    VALIDATION-ERRORS    LAST-CHANGE-DESCRIPTION
[exit 0 at 08:51:04]

$ cub space list --where "Slug LIKE '%gpu-operator%'"
NAME                     COMPONENT       OWNER    VARIANT     STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
gpu-operator-v26-3-3     gpu-operator             v26-3-3                                                24
gpu-operator-prod        gpu-operator             prod                                                   24
gpu-operator-v25-10-1    gpu-operator             v25-10-1                                               24
gpu-operator-v26-3-2     gpu-operator             v26-3-2                                                24
[exit 0 at 08:51:05]

$ cub component list --where "Slug LIKE '%gpu-operator%'"
NAME                WORKFLOW-REQUIRED    #ALLOWED-WORKFLOWS    OWNER    VARIANTS
ch7-gpu-operator    false                0
gpu-operator        false                0                              gpu-operator-prod, gpu-operator-v25-10-1, gpu-operator-v26-3-2, gpu-operator-v26-3-3
[exit 0 at 08:51:05]
```

The four `gpu-operator-*` Spaces and the two Components are as they were in
step 1. The Unit listing was run a third time after the deletes and matched the
start again, with the same SHA-256.
