# Live run of ConfigHub commands, 2026-10-08

**UNOFFICIAL/EXPERIMENTAL**

This log records one serial session against a hosted ConfigHub organization.
It confirms or corrects commands that the site and the user docs show. It also
walks one gpu-operator component with a variant for each chart version and a
diff between versions inside ConfigHub.

This is a dated record of one run. It is not a Guide, and it is not a run for
any Catalog entry. The inputs were locally rendered files, and no cluster,
Worker or Target was involved. Every line that starts with `$` is a command
that was run, and the text under it is the output it printed.

## Versions and setting

- The client is cub v0.8.7 (commit 072585f2, built 2026-10-07).
- The server is v0.8.8 (commit 1bbdb335, built 2026-10-07).
- Fifteen cub plugins are installed and `cub plugin list` prints no versions. No plugin command was used in this run.
- The organization is a hosted ConfigHub organization. It held 44 Spaces and 12 Components before the run, and none of them was changed.
- No cluster, Worker or Target was created or used. Nothing was applied, published or pushed.
- Every object created here had a name that starts with `cwlive-1008-`.
- The account address is written `<user>`, the user identifier is written `<user-id>`, the organization name is written `<a hosted ConfigHub organization>`, the token expiry time is written `<time>`, and one server request identifier is written `<request-id>`.
- Colour codes are stripped from diff output. Long output is trimmed where the text says so.

## Check 1. Version, login and starting count

```
$ cub version
Client Version:
  Version:    v0.8.7
  Commit:     072585f257783af26f03e70b338d9ea96ea28055
  Build Date: 2026-10-07T02:31:58Z
Server Version:
  URL:        https://hub.confighub.com
  Version:    v0.8.8
  Commit:     1bbdb3357a68298e988a39b4fb457b94d33c30bc
  Build Date: 2026-10-07T18:20:50Z
  Client ID:  cub

$ cub auth status
Status               Authenticated
User                 <user>
Organization Name    <a hosted ConfigHub organization>
Server URL           https://hub.confighub.com
Token Expires        <time> (in 23h58m9s)
Client Version       v0.8.7
Server Version       v0.8.8

$ cub space list --no-headers -o jq='.[].Space.Slug' | wc -l
      44
```

## Check 2. Upload a local file as a variant

The input is the rendered redis 25.5.3 file. It holds 14 objects, and one of them is a Secret.

```
$ cub variant upload --dry-run --component cwlive-1008-redis --variant base \
    --space-pattern 'template:{{.Component.Slug}}-{{.Labels.Variant}}' \
    --namespace redis --unit-annotation cwlive/check=upload-1008 redis.yaml
Dry run: nothing was written.
Space cwlive-1008-redis-base (Create)
  Create    redis-networkpolicy
  Create    redis-master-pdb
  Create    redis-replicas-pdb
  Create    redis-master-serviceaccount
  Create    redis-replica-serviceaccount
  Create    redis-configuration-configmap
  Create    redis-health-configmap
  Create    redis-scripts-configmap
  Create    redis-headless-service
  Create    redis-master-service
  Create    redis-replicas-service
  Create    redis-master
  Create    redis-replicas
  linked    redis-master -> redis-configuration-configmap (reference:v1/ConfigMap)
  ... (15 more "linked" lines trimmed)
broke selector link redis-headless-service -> redis-master to resolve cycle: redis-master -> redis-headless-service
broke selector link redis-headless-service -> redis-replicas to resolve cycle: redis-headless-service -> redis-replicas

Note: 1 Secret(s) were NOT uploaded. Apply them out-of-band:
  - Secret/redis/redis

Note: the following references didn't resolve to any uploaded Unit (expected when the
target lives in the cluster, e.g. a Secret created out-of-band):
  - redis-master -> v1/Namespace "redis"
  - redis-master -> v1/Secret "redis"
  ... (13 more lines trimmed)
```

The real upload printed the same plan without the "Dry run" line, and it ended with a revert command.

```
$ cub variant upload --component cwlive-1008-redis --variant base \
    --space-pattern 'template:{{.Component.Slug}}-{{.Labels.Variant}}' \
    --namespace redis --unit-annotation cwlive/check=upload-1008 redis.yaml
Space cwlive-1008-redis-base (Create)
  Create    redis-networkpolicy
  ... (same 13 Create lines and 16 linked lines, trimmed)

Revert this upload of cwlive-1008-redis-base with:
  cub unit update --patch --space cwlive-1008-redis-base --restore Before:ChangeSet:upload-20261008-051433 --where "Labels.UploadSource = 'cwlive-1008-redis'"
```

```
$ cub space list --component cwlive-1008-redis -o wide
NAME                      COMPONENT            OWNER    VARIANT    ...    #UNITS    #LINKS    #TAGS    #CHANGESETS    ...    #TRIGGERS    #WORKERS    #TARGETS
cwlive-1008-redis-base    cwlive-1008-redis             base       ...    13        16        2        1              ...    0            0           0
```

```
$ cub unit list --space cwlive-1008-redis-base \
    -o jq='.[] | [.Unit.Slug, (.Unit.Annotations|tostring), (.Unit.Labels|tostring), (.Unit.HeadRevisionNum|tostring)] | join("  ")'
redis-headless-service  {"UploadDigest":"sha256:b377...2568","UploadFile":"redis/templates/headless-svc.yaml","UploadResource":"/Service/redis/redis-headless","cwlive/check":"upload-1008"}  {"UploadSource":"cwlive-1008-redis"}  2
redis-replicas  {"UploadDigest":"sha256:73a0...8837","UploadFile":"redis/templates/replicas/application.yaml","UploadResource":"apps/StatefulSet/redis/redis-replicas","cwlive/check":"upload-1008"}  {"UploadSource":"cwlive-1008-redis"}  2
... (11 more rows trimmed; every row carries "cwlive/check":"upload-1008")
```

What this shows.

- The upload created the Space `cwlive-1008-redis-base` and the Component `cwlive-1008-redis`.
- Each of the 13 non-Secret objects became its own Unit. The Secret was not uploaded and the output says so.
- A workload keeps its bare name (`redis-master`, `redis-replicas`). Every other Unit takes its kind as a suffix (`redis-master-service`, `redis-health-configmap`, `redis-master-pdb`).
- The `--unit-annotation` value is on all 13 Units. The upload also writes `UploadDigest`, `UploadFile` and `UploadResource` annotations and an `UploadSource` label.
- The Space carries the labels `Variant=base` and `Namespace=redis`, and the annotation `ExternalSourceRef=redis.yaml`.
- Each Unit starts at revision 2. Revision 1 is an empty revision that precedes the first content.
- The upload records one ChangeSet and two Tags (`upload-<time>-start` and `upload-<time>-end`).

## Check 3. Upload the same file again

```
$ cub variant upload --component cwlive-1008-redis --variant base \
    --space-pattern 'template:{{.Component.Slug}}-{{.Labels.Variant}}' \
    --namespace redis --unit-annotation cwlive/check=upload-1008 redis.yaml
Space cwlive-1008-redis-base (Unchanged)
  Unchanged 13 Unit(s)
broke selector link redis-headless-redis-service -> redis-master-statefulset to resolve cycle: redis-master-statefulset -> redis-headless-redis-service
broke selector link redis-headless-redis-service -> redis-replicas-statefulset to resolve cycle: redis-headless-redis-service -> redis-replicas-statefulset
... (Secret and unresolved-reference notes trimmed)
```

The Space still held 13 Units, 16 Links, 2 Tags and 1 ChangeSet, and every Unit was still at revision 2. An upload creates or updates, and an unchanged upload writes nothing.

## Check 4. Create variants and see what is copied

A validating Trigger was created in the base Space first, so that copying could be observed.

```
$ cub trigger create --space cwlive-1008-redis-base cwlive-1008-complete Mutation Kubernetes/YAML vet-placeholders
Successfully created trigger cwlive-1008-complete (17ca4ec1-7a56-42dd-bfb5-8af27489954b)

$ cub variant create dev cwlive-1008-redis-base
Created variant space cwlive-1008-redis-dev (ID: bd602121-1ec7-40c8-bbcf-e78743725105)
Awaiting triggers...

Bulk create operation completed:
  Success: 13 unit(s)

$ cub variant create qa cwlive-1008-redis-base \
    --space-pattern 'template:cwlive-1008-pattern-{{.Labels.Variant}}-{{.SourceEntitySlug}}'
Created variant space cwlive-1008-pattern-qa-cwlive-1008-redis-base (ID: 5c88b313-f303-4b72-940b-41d5866ac17e)
Awaiting triggers...

Bulk create operation completed:
  Success: 13 unit(s)
```

The default Space name is `<component>-<variant>`, which gave `cwlive-1008-redis-dev`. `cub variant create` has no `--dry-run` flag in v0.8.7. The default name already carried the session prefix, so the command was run for real.

```
$ cub trigger list --space cwlive-1008-redis-base
NAME                    SPACE                     WORKER    EVENT       VALIDATING    DISABLED    WARN     TOOLCHAIN-TYPE     FUNCTION-NAME       NUM-ARGS    INVOCATION
cwlive-1008-complete    cwlive-1008-redis-base              Mutation    true          false       false    Kubernetes/YAML    vet-placeholders    0

$ cub trigger list --space cwlive-1008-redis-dev
NAME    SPACE    WORKER    EVENT    VALIDATING    DISABLED    WARN    TOOLCHAIN-TYPE    FUNCTION-NAME    NUM-ARGS    INVOCATION

$ cub space get cwlive-1008-redis-base -o jq='.Space | {Slug, SpaceID, Labels, WhereTrigger, TriggerFilterID, Permissions}'
{
  "Labels": { "Namespace": "redis", "Variant": "base" },
  "Permissions": {
    "Manage": { "UserIDs": { "<user-id>": true } },
    "ManageChildren": { "UserIDs": { "<user-id>": true } }
  },
  "Slug": "cwlive-1008-redis-base",
  "SpaceID": "ccf72467-aced-4c06-b505-437128bd569a",
  "TriggerFilterID": null,
  "WhereTrigger": null
}

$ cub space get cwlive-1008-redis-dev -o jq='.Space | {Slug, SpaceID, Labels, WhereTrigger, TriggerFilterID, Permissions}'
{
  "Labels": { "Namespace": "redis", "Variant": "dev" },
  "Permissions": {
    "Manage": { "UserIDs": { "<user-id>": true } },
    "ManageChildren": { "UserIDs": { "<user-id>": true } }
  },
  "Slug": "cwlive-1008-redis-dev",
  "SpaceID": "bd602121-1ec7-40c8-bbcf-e78743725105",
  "TriggerFilterID": null,
  "WhereTrigger": "SpaceID = 'ccf72467-aced-4c06-b505-437128bd569a'"
}
```

The second clone printed the same result, with the same `WhereTrigger`.

What this shows.

- Triggers are not copied. Both clones list no Triggers of their own.
- The trigger selection is carried over. The base had no `WhereTrigger` and no `TriggerFilterID`, so each clone received a `WhereTrigger` that selects the Triggers in the base Space by its SpaceID. The help says this, and the server did it.
- Permissions are copied unchanged.
- Each clone held 13 Units and 29 Links. Sixteen are the copied links between Units and thirteen are the UpgradeUnit links to the base Units.

## Check 5. Change the base, preview the promotion, promote

```
$ cub function get --space cwlive-1008-redis-base --unit redis-replicas --quiet --show output get-replicas
  Value: 3  Path: spec.replicas  Resource: redis/redis-replicas  Type: apps/v1/StatefulSet

$ cub function set --space cwlive-1008-redis-base --unit redis-replicas \
    --change-desc "cwlive check 5: base replicas 3 to 4" set-replicas 4
Function(s) succeeded on unit cwlive-1008-redis-base/redis-replicas (4595e2b8-c4db-4077-aa00-093932004a16)
Config data changed
Awaiting triggers...

$ cub variant promote cwlive-1008-redis-dev --dry-run -o mutations
Changes to unit redis-replicas from promote:
Resource: apps/v1/StatefulSet redis/redis-replicas
  ~ [Update] spec.replicas
      3 → 4

$ cub variant promote cwlive-1008-redis-dev --dry-run
Would upgrade 1 unit(s) behind their upstream
Would add 0 unit(s) from upstream

$ cub variant promote cwlive-1008-redis-dev --change-desc "cwlive check 5: promote replicas 4 to dev"
Upgraded 1 unit(s) behind their upstream
Adding 0 unit(s) from upstream

$ cub function get --space cwlive-1008-redis-dev --unit redis-replicas --quiet --show output get-replicas
  Value: 4  Path: spec.replicas  Resource: redis/redis-replicas  Type: apps/v1/StatefulSet

$ cub revision list --space cwlive-1008-redis-dev redis-replicas
NUM    UNIT              SOURCE         CHANGESET    CHANGEORDERS    TAGS    DESCRIPTION
3      redis-replicas    UpgradeUnit                                         cwlive check 5: promote replicas 4 to dev
2      redis-replicas    CloneUnit                                           Cloned from ccf72467-aced-4c06-b505-437128bd569...
1      redis-replicas    CloneUnit                                           Empty revision preceding the unit's first content
```

The dry run with `-o mutations` prints the one changed path. The real promotion wrote one new revision on one Unit in dev, and the other 12 Units did not change.

## Check 6. `cub variant approve`

```
$ cub variant approve cwlive-1008-redis-dev --dry-run
Nothing to record in cwlive-1008-redis-dev: no unit has the selected revision

$ cub variant approve cwlive-1008-redis-dev
Nothing to record in cwlive-1008-redis-dev: no unit has the selected revision

$ cub variant approve cwlive-1008-redis-dev --all --dry-run
Would record pass Approval attestation in cwlive-1008-redis-dev, covering 13 revision(s)

$ cub variant approve cwlive-1008-redis-dev --all --note "cwlive-1008 live check 6"
Recorded pass Approval attestation d8c12c1b-c057-4f86-a2ab-7987afb4cf75 in cwlive-1008-redis-dev, covering 13 revision(s)

$ cub attestation list --space cwlive-1008-redis-dev
ATTESTATION-ID                          TYPE        RESULT    REVOKES    USER-ID      CREATED
d8c12c1b-c057-4f86-a2ab-7987afb4cf75    Approval    Pass                 <user-id>    2026-10-08 05:16:49.278122 +0000 UTC
```

Without `--all` the command approves only Units that have a Target. A Space with no Target therefore records nothing, and the command exits 0. With `--all` it records one Approval attestation for the Space that covers the head revision of every Unit.

A later follow-up Space confirmed the `--revision ChangeSet:<slug>` form in a dry run.

```
$ cub variant approve cwlive-1008-redis2-base --all --revision ChangeSet:upload-20261008-052647 --dry-run
Would record pass Approval attestation in cwlive-1008-redis2-base, covering 13 revision(s)
```

## Check 7. `cub unit set-protection` and a protected path under promotion

```
$ cub unit set-protection --space cwlive-1008-redis-dev redis-replicas \
    --protect "apps/v1/StatefulSet:redis/redis-replicas:spec.replicas"
Protection set on unit redis-replicas (3639e511-36c9-4c22-bfcd-d7fb44eed08d)
[
  {
    ...
    "PathMutationMap": {
      "spec.replicas": {
        "Index": 2,
        "MutationType": "Update",
        "Protected": true,
        "Value": "4\n"
      }
    },
    "Resource": {
      "ResourceCategory": "Resource",
      "ResourceName": "redis/redis-replicas",
      "ResourceNameWithoutScope": "redis-replicas",
      "ResourceType": "apps/v1/StatefulSet"
    },
    ... (the whole resource body is printed as well, trimmed here)
  }
]
```

The base then received two changes on the same Unit. One touches the protected path and one touches an unprotected path.

```
$ cub function set --space cwlive-1008-redis-base --unit redis-replicas \
    --change-desc "cwlive check 7: base replicas 4 to 5" set-replicas 5
Function(s) succeeded on unit cwlive-1008-redis-base/redis-replicas (4595e2b8-c4db-4077-aa00-093932004a16)
Config data changed
Awaiting triggers...

$ cub function set --space cwlive-1008-redis-base --unit redis-replicas \
    --change-desc "cwlive check 7: base revisionHistoryLimit 10 to 7" \
    set-int-path apps/v1/StatefulSet spec.revisionHistoryLimit 7
Function(s) succeeded on unit cwlive-1008-redis-base/redis-replicas (4595e2b8-c4db-4077-aa00-093932004a16)
Config data changed
Awaiting triggers...

$ cub variant promote cwlive-1008-redis-dev --dry-run -o mutations
Changes to unit redis-replicas from promote:
Resource: apps/v1/StatefulSet redis/redis-replicas
  ~ [Update] spec.revisionHistoryLimit
      10 → 7

$ cub variant promote cwlive-1008-redis-dev --change-desc "cwlive check 7: promote with replicas protected"
Upgraded 1 unit(s) behind their upstream
Adding 0 unit(s) from upstream

$ cub function get --space cwlive-1008-redis-dev --unit redis-replicas --show output get-yq '.spec.replicas, .spec.revisionHistoryLimit'
4 7

$ cub function get --space cwlive-1008-redis-base --unit redis-replicas --show output get-yq '.spec.replicas, .spec.revisionHistoryLimit'
5 7
```

The protected path survived. Dev kept `spec.replicas: 4` while the base moved to 5, and the unprotected change to `spec.revisionHistoryLimit` arrived. The dry run already left the protected path out of its preview.

`cub unit --help` lists `set-protection` and `set-guard`. It lists no `set-predicates`.

## Check 8. `cub unit diff` revision names

The base Unit `redis-replicas` had five revisions at this point.

```
$ cub revision list --space cwlive-1008-redis-base redis-replicas
NUM    UNIT              SOURCE           CHANGESET                 CHANGEORDERS    TAGS                            DESCRIPTION
5      redis-replicas    Invoke                                                                                     cwlive check 7: base revisionHistoryLimit 10 to...
4      redis-replicas    Invoke                                                                                     cwlive check 7: base replicas 4 to 5| Functions...
3      redis-replicas    Invoke                                                                                     cwlive check 5: base replicas 3 to 4| Functions...
2      redis-replicas    MergeExternal    upload-20261008-051433                    upload-20261008-051433-end      MergeExternal; from redis.yaml
1      redis-replicas    MergeExternal    upload-20261008-051433                    upload-20261008-051433-start    Empty revision preceding the unit's first conte...
```

```
$ cub unit diff --space cwlive-1008-redis-base redis-replicas -u
Failed: revision LastReleasedRevisionNum not found or is invalid

$ cub unit diff --space cwlive-1008-redis-base redis-replicas --from=LastReleasedRevisionNum --to=2
Failed: revision LastReleasedRevisionNum not found or is invalid

$ cub unit diff --space cwlive-1008-redis-base redis-replicas --from=2 --to=HeadRevisionNum -u
--- cwlive-1008-redis-base/redis-replicas/2
+++ cwlive-1008-redis-base/redis-replicas/5
@@ -12,8 +16,2 @@
     helm.sh/chart: redis-25.5.3
     app.kubernetes.io/component: replica
 spec:
-  replicas: 3
-  revisionHistoryLimit: 10
+  replicas: 5
+  revisionHistoryLimit: 7
   selector:
     matchLabels:
       app.kubernetes.io/instance: redis

$ cub unit diff --space cwlive-1008-redis-base redis-replicas 3 4 -o mutations
Resource: apps/v1/StatefulSet redis/redis-replicas
  ~ [Update] spec.replicas
      4 → 5

$ cub unit diff --space cwlive-1008-redis-base redis-replicas --from=-2 --to=-1 -o mutations
Resource: apps/v1/StatefulSet redis/redis-replicas
  ~ [Update] spec.replicas
      4 → 5

$ cub unit diff --space cwlive-1008-redis-base redis-replicas --from=-1 -o mutations
Resource: apps/v1/StatefulSet redis/redis-replicas
  ~ [Update] spec.revisionHistoryLimit
      10 → 7

$ cub unit diff --space cwlive-1008-redis-base redis-replicas --from=Tag:upload-20261008-051433-end --to=HeadRevisionNum -o mutations
Failed: invalid revision reference 'Tag:9e77f50a-313b-4545-88ee-10dc8a7e5234': must be a revision number, -N (relative to head), or one of HeadRevisionNum/LastReleasedRevisionNum

$ cub unit diff --space cwlive-1008-redis-base redis-replicas --from=ChangeSet:upload-20261008-051433 --to=HeadRevisionNum -o mutations
Failed: invalid revision reference 'ChangeSet:1a744d8a-efec-4a2c-a492-19c7e8536baa': must be a revision number, -N (relative to head), or one of HeadRevisionNum/LastReleasedRevisionNum

$ cub unit diff --space cwlive-1008-redis-base redis-replicas --with-unit cwlive-1008-redis-dev/redis-replicas -o mutations
Resource: apps/v1/StatefulSet redis/redis-replicas
  ~ [Update] spec.replicas
      5 → 4
```

The follow-up Space checked two more forms the site shows.

```
$ cub unit diff cwlive-1008-redis2-base/redis-replicas --from=1 --to=2 -o mutations
Resource: apps/v1/StatefulSet redis/redis-replicas  (added)
    ... (the whole resource follows, trimmed)

$ cub unit diff --space cwlive-1008-redis2-base
Failed: accepts between 1 and 3 arg(s), received 0
```

Which names work.

| Reference | Result |
| --- | --- |
| A revision number, as `--from=2` or as a positional argument | Works. |
| `HeadRevisionNum` | Works. |
| `-1`, `-2` relative to head | Works. `-1` is one revision before head. |
| `LastReleasedRevisionNum` | The name is accepted, and it fails on a Unit that has never been released. It is also the default `--from`, so a bare `cub unit diff <unit>` fails on a never-released Unit. |
| `Tag:<slug>` | Refused by the server, although the help lists it. |
| `ChangeSet:<slug>` | Refused by the server, although the help lists it. |
| `--with-unit <space>/<unit>` | Works across Spaces. |
| `<space>/<unit>` as the positional name with no `--space` | Works. |
| `--space <space>` with no Unit name | Refused. A Unit name is required. |

## Check 9. Release publish with no release Target, release list, live state

```
$ cub release publish cwlive-1008-redis-dev
Failed: HTTP 400 for req <request-id>: cannot release a Space without a ReleaseTargetID

$ cub release list --space cwlive-1008-redis-dev
NUM    TAG    PUBLISHED    DIGEST    LIVE    CREATED
```

`cub unit --help` lists these subcommands in v0.8.7.

```
blame, cancel, conflicts, create, data, data-edit, delete, diff, explain, get, list,
move, mutation-sources, open, set-guard, set-protection, set-target, tag, tree, update
```

There is no `cub unit livestate`, no `cub unit apply` and no `cub unit set-predicates`. No option in `cub unit data` or `cub unit get` help mentions live state. The top-level command list has `unit-action`, `unit-event`, `resource` and `release`. None of them could be exercised without a Target, so this run names no replacement for live state.

```
$ cub unit livestate --space cwlive-1008-redis-dev redis-replicas
The unit subcommands are used to manage units.
... (the group help follows, and the exit status is 0)
```

## Check 10. The gpu-operator walk

### Three chart versions as three variants of one component

Each input file holds 24 objects and no Secret.

```
$ cub variant upload --component cwlive-1008-gpu-operator --variant v25-10-1 \
    --namespace gpu-operator --unit-annotation chart-version=v25.10.1 gpu-v25.10.1.yaml
Space cwlive-1008-gpu-operator-v25-10-1 (Create)
  Create    clusterpolicies.nvidia.com-crd
  Create    nvidiadrivers.nvidia.com-crd
  Create    nodefeatures.nfd.k8s-sigs.io-crd
  Create    nodefeaturegroups.nfd.k8s-sigs.io-crd
  Create    nodefeaturerules.nfd.k8s-sigs.io-crd
  Create    node-feature-discovery-serviceaccount
  Create    gpu-operator-serviceaccount
  ... (14 more Create lines trimmed)
  Create    gpu-operator
  Create    cluster-policy-clusterpolicy
  linked    cluster-policy-clusterpolicy -> clusterpolicies.nvidia.com-crd (crd)
  ... (16 more linked lines and the unresolved-reference notes trimmed)

$ cub variant upload --component cwlive-1008-gpu-operator --variant v26-3-2 \
    --namespace gpu-operator --unit-annotation chart-version=v26.3.2 gpu-v26.3.2.yaml
Space cwlive-1008-gpu-operator-v26-3-2 (Create)
  ... (24 Create lines, 17 linked lines, trimmed)

$ cub variant upload --component cwlive-1008-gpu-operator --variant v26-3-3 \
    --namespace gpu-operator --unit-annotation chart-version=v26.3.3 gpu-v26.3.3.yaml
Space cwlive-1008-gpu-operator-v26-3-3 (Create)
  ... (24 Create lines, 17 linked lines, trimmed)

$ cub space list --component cwlive-1008-gpu-operator
NAME                                 COMPONENT                   OWNER    VARIANT     STAGE    ENVIRONMENT    REGION    LAYER    #UNITS
cwlive-1008-gpu-operator-v25-10-1    cwlive-1008-gpu-operator             v25-10-1                                               24
cwlive-1008-gpu-operator-v26-3-3     cwlive-1008-gpu-operator             v26-3-3                                                24
cwlive-1008-gpu-operator-v26-3-2     cwlive-1008-gpu-operator             v26-3-2                                                24
```

A second upload with the same `--component` and a different `--variant` creates a second Space in the same Component. The Space name is `<component>-<variant>`. The three Spaces held the same 24 Unit names.

### The ClusterPolicy Unit between versions

`cub unit diff --with-unit <space>/<unit>` compares the same Unit in two Spaces.

```
$ cub unit diff --space cwlive-1008-gpu-operator-v26-3-2 cluster-policy-clusterpolicy \
    --with-unit cwlive-1008-gpu-operator-v26-3-3/cluster-policy-clusterpolicy -o mutations
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
```

```
$ cub unit diff --space cwlive-1008-gpu-operator-v25-10-1 cluster-policy-clusterpolicy \
    --with-unit cwlive-1008-gpu-operator-v26-3-2/cluster-policy-clusterpolicy -o mutations
Resource: nvidia.com/v1/ClusterPolicy /cluster-policy
  ~ [Update] metadata.labels.helm~1sh/chart
      gpu-operator-v25.10.1 → gpu-operator-v26.3.2
  - [Delete] spec.operator.initContainer
      repository: nvcr.io/nvidia
      image: cuda
      version: "13.0.1-base-ubi9"
      imagePullPolicy: IfNotPresent
  ~ [Update] spec.validator.version
      v25.10.1 → v26.3.2
  ~ [Update] spec.driver.version
      580.105.08 → 580.126.20
  ~ [Update] spec.driver.manager.version
      v0.9.1 → v0.11.0
  ~ [Update] spec.ccManager.enabled
      false → true
  ~ [Update] spec.ccManager.defaultMode
      off → on
  ~ [Update] spec.toolkit.version
      v1.18.1 → v1.19.1
  ~ [Update] spec.devicePlugin.version
      v0.18.1 → v0.19.2
  + [Add] spec.sandboxWorkloads.mode
      kubevirt
  + [Add] spec.kataSandboxDevicePlugin
      enabled: true
      repository: nvcr.io/nvidia/cloud-native
      image: nvidia-sandbox-device-plugin
      version: "v0.0.3"
      imagePullPolicy: IfNotPresent
  ... (24 more changed paths trimmed; the full diff has 35)
```

### The whole version, across two Spaces

No single command compares two Spaces in v0.8.7. `cub space` has no `diff`, and `cub variant diff` compares one Space at two points in its own history. A serial loop over the Unit names does the whole comparison with the command above.

```
$ A=cwlive-1008-gpu-operator-v26-3-2; B=cwlive-1008-gpu-operator-v26-3-3
$ cub unit list --space $A --no-headers -o jq='.[].Unit.Slug' | sort > slugs.txt
$ while read -r u; do cub unit diff --space $A "$u" --with-unit "$B/$u" -o mutations; done < slugs.txt
```

Changed paths per Unit, v26.3.2 to v26.3.3 (7 Units, 22 paths, and 17 Units print "No changes").

```
7  cluster-policy-clusterpolicy
5  gpu-operator
2  gpu-operator-clusterrole
2  gpu-operator-clusterrolebinding
2  gpu-operator-role
2  gpu-operator-rolebinding
2  gpu-operator-serviceaccount
```

Changed paths per Unit, v25.10.1 to v26.3.2 (21 Units, 132 paths).

```
35  cluster-policy-clusterpolicy
42  clusterpolicies.nvidia.com-crd
10  gpu-operator
5   gpu-operator-node-feature-discovery-worker
5   nvidiadrivers.nvidia.com-crd
4   gpu-operator-node-feature-discovery-master
3   gpu-operator-node-feature-discovery-gc
2   each of 14 more Units (labels only)
0   nodefeaturegroups, nodefeaturerules and nodefeatures CRDs
```

### The driver base as a fourth variant

```
$ cub variant upload --component cwlive-1008-gpu-operator --variant v25-10-1-driver-580-126-20 \
    --namespace gpu-operator --unit-annotation chart-version=v25.10.1 gpu-v25.10.1-driver.yaml
Space cwlive-1008-gpu-operator-v25-10-1-driver-580-126-20 (Create)
  ... (24 Create lines, 16 linked lines, trimmed)
  link FAILED gpu-operator-rolebinding -> gpu-operator-serviceaccount: exceeded maximum quota for entity type Link
```

The loop over all 24 Units printed one change and 23 "No changes" lines.

```
$ cub unit diff --space cwlive-1008-gpu-operator-v25-10-1 cluster-policy-clusterpolicy \
    --with-unit cwlive-1008-gpu-operator-v25-10-1-driver-580-126-20/cluster-policy-clusterpolicy -o mutations
Resource: nvidia.com/v1/ClusterPolicy /cluster-policy
  ~ [Update] spec.driver.version
      580.105.08 → 580.126.20

$ cub unit diff -u --space cwlive-1008-gpu-operator-v25-10-1 cluster-policy-clusterpolicy \
    --with-unit cwlive-1008-gpu-operator-v25-10-1-driver-580-126-20/cluster-policy-clusterpolicy
--- cwlive-1008-gpu-operator-v25-10-1/cluster-policy-clusterpolicy/2
+++ cwlive-1008-gpu-operator-v25-10-1-driver-580-126-20/cluster-policy-clusterpolicy/2
@@ -53,7 +57,1 @@
     usePrecompiled: false
     repository: nvcr.io/nvidia
     image: driver
-    version: "580.105.08"
+    version: "580.126.20"
     imagePullPolicy: IfNotPresent
     startupProbe:
       failureThreshold: 120
```

### The driver base as a change to the v25.10.1 variant

Uploading a different file into an existing variant updates only the Units whose content changed. `cub variant diff` then shows the whole Space between the upload's tags in one command.

```
$ cub variant upload --dry-run --component cwlive-1008-gpu-operator --variant v25-10-1 \
    --namespace gpu-operator --unit-annotation chart-version=v25.10.1 \
    --change-desc "driver 580.126.20 base" gpu-v25.10.1-driver.yaml
Dry run: nothing was written.
Space cwlive-1008-gpu-operator-v25-10-1 (Update)
  Update    cluster-policy-clusterpolicy
  Unchanged 23 Unit(s)

$ cub variant upload --component cwlive-1008-gpu-operator --variant v25-10-1 \
    --namespace gpu-operator --unit-annotation chart-version=v25.10.1 \
    --change-desc "driver 580.126.20 base" gpu-v25.10.1-driver.yaml
Space cwlive-1008-gpu-operator-v25-10-1 (Update)
  Update    cluster-policy-clusterpolicy
  Unchanged 23 Unit(s)
...
Revert this upload of cwlive-1008-gpu-operator-v25-10-1 with:
  cub unit update --patch --space cwlive-1008-gpu-operator-v25-10-1 --restore Before:ChangeSet:upload-20261008-052324 --where "Labels.UploadSource = 'cwlive-1008-gpu-operator'"

$ cub changeset list --space cwlive-1008-gpu-operator-v25-10-1
NAME                      SPACE                                STATE     DESCRIPTION
upload-20261008-052324    cwlive-1008-gpu-operator-v25-10-1    Closed    Upload from gpu-v25.10.1-driver.yaml
upload-20261008-051941    cwlive-1008-gpu-operator-v25-10-1    Closed    Upload from gpu-v25.10.1.yaml

$ cub variant diff cwlive-1008-gpu-operator-v25-10-1 upload-20261008-051941-end -o mutations
=== cwlive-1008-gpu-operator-v25-10-1/cluster-policy-clusterpolicy/2 -> cwlive-1008-gpu-operator-v25-10-1/cluster-policy-clusterpolicy/3
Resource: nvidia.com/v1/ClusterPolicy /cluster-policy
  ~ [Update] spec.driver.version
      580.105.08 → 580.126.20
1 of 24 unit(s) changed between upload-20261008-051941-end and HeadRevisionNum in cwlive-1008-gpu-operator-v25-10-1 (23 unchanged, 0 at neither)

$ cub variant diff -u cwlive-1008-gpu-operator-v25-10-1 Before:ChangeSet:upload-20261008-052324 ChangeSet:upload-20261008-052324
--- cwlive-1008-gpu-operator-v25-10-1/cluster-policy-clusterpolicy/2
+++ cwlive-1008-gpu-operator-v25-10-1/cluster-policy-clusterpolicy/3
@@ -53,7 +57,1 @@
     usePrecompiled: false
     repository: nvcr.io/nvidia
     image: driver
-    version: "580.105.08"
+    version: "580.126.20"
     imagePullPolicy: IfNotPresent
     startupProbe:
       failureThreshold: 120
1 of 24 unit(s) changed between Before:ChangeSet:upload-20261008-052324 and ChangeSet:upload-20261008-052324 in cwlive-1008-gpu-operator-v25-10-1 (0 unchanged, 23 at neither)
```

### One Space that takes each version in turn

A single variant named `rolling` received v25.10.1, then v26.3.2, then v26.3.3. Each upload is one ChangeSet, and `cub variant diff` shows a whole version step in one command.

```
$ cub variant upload --component cwlive-1008-gpu-operator --variant rolling --namespace gpu-operator --change-desc "chart v25.10.1" gpu-v25.10.1.yaml
Space cwlive-1008-gpu-operator-rolling (Create)
  ... (24 Create lines, then 17 "link FAILED ... exceeded maximum quota for entity type Link" lines)

$ cub variant upload --component cwlive-1008-gpu-operator --variant rolling --namespace gpu-operator --change-desc "chart v26.3.2" gpu-v26.3.2.yaml
Space cwlive-1008-gpu-operator-rolling (Update)
  ... (21 Update lines)
  Unchanged 3 Unit(s)
  ... (17 link FAILED lines)

$ cub variant upload --component cwlive-1008-gpu-operator --variant rolling --namespace gpu-operator --change-desc "chart v26.3.3" gpu-v26.3.3.yaml
Space cwlive-1008-gpu-operator-rolling (Update)
  Update    gpu-operator-serviceaccount
  Update    gpu-operator-clusterrole
  Update    gpu-operator-clusterrolebinding
  Update    gpu-operator-role
  Update    gpu-operator-rolebinding
  Update    gpu-operator
  Update    cluster-policy-clusterpolicy
  Unchanged 17 Unit(s)
  ... (17 link FAILED lines)

$ cub changeset list --space cwlive-1008-gpu-operator-rolling
NAME                      SPACE                               STATE     DESCRIPTION
upload-20261008-052433    cwlive-1008-gpu-operator-rolling    Closed    Upload from gpu-v26.3.3.yaml
upload-20261008-052401    cwlive-1008-gpu-operator-rolling    Closed    Upload from gpu-v26.3.2.yaml
upload-20261008-052352    cwlive-1008-gpu-operator-rolling    Closed    Upload from gpu-v25.10.1.yaml

$ cub variant diff cwlive-1008-gpu-operator-rolling Before:ChangeSet:upload-20261008-052433 ChangeSet:upload-20261008-052433 -o mutations
=== cwlive-1008-gpu-operator-rolling/cluster-policy-clusterpolicy/3 -> cwlive-1008-gpu-operator-rolling/cluster-policy-clusterpolicy/4
=== cwlive-1008-gpu-operator-rolling/gpu-operator/3 -> cwlive-1008-gpu-operator-rolling/gpu-operator/4
=== cwlive-1008-gpu-operator-rolling/gpu-operator-clusterrole/3 -> cwlive-1008-gpu-operator-rolling/gpu-operator-clusterrole/4
=== cwlive-1008-gpu-operator-rolling/gpu-operator-clusterrolebinding/3 -> cwlive-1008-gpu-operator-rolling/gpu-operator-clusterrolebinding/4
=== cwlive-1008-gpu-operator-rolling/gpu-operator-role/3 -> cwlive-1008-gpu-operator-rolling/gpu-operator-role/4
=== cwlive-1008-gpu-operator-rolling/gpu-operator-rolebinding/3 -> cwlive-1008-gpu-operator-rolling/gpu-operator-rolebinding/4
=== cwlive-1008-gpu-operator-rolling/gpu-operator-serviceaccount/3 -> cwlive-1008-gpu-operator-rolling/gpu-operator-serviceaccount/4
7 of 24 unit(s) changed between Before:ChangeSet:upload-20261008-052433 and ChangeSet:upload-20261008-052433 in cwlive-1008-gpu-operator-rolling (0 unchanged, 17 at neither)
(the per-path lines are trimmed; the output holds 22 changed paths, the same 7 Units and 22 paths as the loop across two Spaces)

$ cub variant diff cwlive-1008-gpu-operator-rolling upload-20261008-052352-end -o mutations
... (trimmed)
21 of 24 unit(s) changed between upload-20261008-052352-end and HeadRevisionNum in cwlive-1008-gpu-operator-rolling (3 unchanged, 0 at neither)

$ cub variant diff cwlive-1008-gpu-operator-rolling upload-20261008-052352-end upload-20261008-052433-end -o mutations
=== cwlive-1008-gpu-operator-rolling/cluster-policy-clusterpolicy/2 -> cwlive-1008-gpu-operator-rolling/cluster-policy-clusterpolicy/4
=== cwlive-1008-gpu-operator-rolling/clusterpolicies.nvidia.com-crd/2 -> cwlive-1008-gpu-operator-rolling/clusterpolicies.nvidia.com-crd/absent
... (trimmed; 17 Units show "absent" on the right side)
24 of 24 unit(s) changed between upload-20261008-052352-end and upload-20261008-052433-end in cwlive-1008-gpu-operator-rolling (0 unchanged, 0 at neither)
```

### What is and is not available for a diff between versions

- A diff of one Unit across two variant Spaces is available with `cub unit diff --space <A> <unit> --with-unit <B>/<unit>`, as text, unified text or `-o mutations`.
- A diff of two whole variant Spaces in one command is not available. A loop over the Unit names with the command above covers it when the Unit names match.
- A diff of one whole Space between two uploads is available with `cub variant diff <space> Before:ChangeSet:<upload> ChangeSet:<upload>`, or with `cub variant diff <space> <earlier-upload>-end` to compare an earlier upload with the head.
- A diff between the end tags of two different uploads is misleading. An upload tags only the Units it writes, so a Unit the later upload left unchanged shows as "absent" and reads as a whole removal.

## Check 11. Clean up

The clones were deleted before their base, and each delete named one Space.

```
$ cub space delete --recursive cwlive-1008-redis-dev
Successfully deleted space cwlive-1008-redis-dev (bd602121-1ec7-40c8-bbcf-e78743725105)
$ cub space delete --recursive cwlive-1008-pattern-qa-cwlive-1008-redis-base
Successfully deleted space cwlive-1008-pattern-qa-cwlive-1008-redis-base (5c88b313-f303-4b72-940b-41d5866ac17e)
$ cub space delete --recursive cwlive-1008-redis-base
Successfully deleted space cwlive-1008-redis-base (ccf72467-aced-4c06-b505-437128bd569a)
$ cub space delete --recursive cwlive-1008-gpu-operator-rolling
Successfully deleted space cwlive-1008-gpu-operator-rolling (dde654c5-c1c0-4aae-94ac-5d8b6b0ee71a)
$ cub space delete --recursive cwlive-1008-gpu-operator-v25-10-1-driver-580-126-20
Successfully deleted space cwlive-1008-gpu-operator-v25-10-1-driver-580-126-20 (ba955841-6d0d-40ce-901f-7e4dd31b4225)
$ cub space delete --recursive cwlive-1008-gpu-operator-v25-10-1
Successfully deleted space cwlive-1008-gpu-operator-v25-10-1 (5d53eaf0-b46b-434f-a7ba-80475a349525)
$ cub space delete --recursive cwlive-1008-gpu-operator-v26-3-2
Successfully deleted space cwlive-1008-gpu-operator-v26-3-2 (9cb9d2a7-ea6a-4e72-913e-533739ebffb5)
$ cub space delete --recursive cwlive-1008-gpu-operator-v26-3-3
Successfully deleted space cwlive-1008-gpu-operator-v26-3-3 (823a77e4-8ac3-4ec3-ab74-7aa952845822)
$ cub component delete cwlive-1008-redis
Successfully deleted component cwlive-1008-redis (092a71d5-250e-474e-9b00-c124ddd302bd)
$ cub component delete cwlive-1008-gpu-operator
Successfully deleted component cwlive-1008-gpu-operator (30aba121-dbd4-4caf-80ed-7d36b8c8e59e)
```

A ninth Space, `cwlive-1008-redis2-base` in the Component `cwlive-1008-redis2`, was created afterwards for the three follow-up commands in checks 6 and 8. It was then deleted the same way.

```
$ cub space delete --recursive cwlive-1008-redis2-base
Successfully deleted space cwlive-1008-redis2-base (d22424f8-be77-4b4a-b13b-1c25d93927ef)
$ cub component delete cwlive-1008-redis2
Successfully deleted component cwlive-1008-redis2 (9f205984-1029-4d98-97bb-55a56ae5a870)
```

Final verification.

```
$ cub space list --include-hidden --where "Slug LIKE 'cwlive-1008-%'" --no-headers | wc -l
       0
$ cub component list --where "Slug LIKE 'cwlive-1008-%'" --no-headers | wc -l
       0
$ cub unit list --space '*' --include-hidden --where "Labels.UploadSource LIKE 'cwlive-1008-%'" --no-headers | wc -l
       0
$ cub trigger list --space '*' --where "Slug LIKE 'cwlive-1008-%'" --no-headers | wc -l
       0
$ cub attestation list --where "AttestationID = 'd8c12c1b-c057-4f86-a2ab-7987afb4cf75'"
ATTESTATION-ID    TYPE    RESULT    REVOKES    USER-ID    CREATED
$ cub space list --no-headers -o jq='.[].Space.Slug' | wc -l
      44
$ cub component list --no-headers | wc -l
      12
```

The sorted list of Space names after the run is identical to the list taken before it, and so is the list of Component names.

Everything created in the session, all of it now deleted.

- Nine Spaces. They were `cwlive-1008-redis-base`, `cwlive-1008-redis-dev`, `cwlive-1008-pattern-qa-cwlive-1008-redis-base`, `cwlive-1008-gpu-operator-v25-10-1`, `cwlive-1008-gpu-operator-v26-3-2`, `cwlive-1008-gpu-operator-v26-3-3`, `cwlive-1008-gpu-operator-v25-10-1-driver-580-126-20`, `cwlive-1008-gpu-operator-rolling` and `cwlive-1008-redis2-base`.
- Three Components. They were `cwlive-1008-redis`, `cwlive-1008-gpu-operator` and `cwlive-1008-redis2`.
- One Trigger, `cwlive-1008-complete`, in the redis base Space.
- One Approval attestation in the redis dev Space. It went with the Space.
- The Units, Links, Tags and ChangeSets inside those Spaces.

## What went wrong

1. The session used up the organization's Link quota. The first seven Spaces held 141 Links between them, and the upload of the driver variant then reported `link FAILED gpu-operator-rolebinding -> gpu-operator-serviceaccount: exceeded maximum quota for entity type Link`. The three uploads into the rolling Space created no Links at all. The quota was exhausted for a few minutes, from the driver variant upload until cleanup began, and any other work in the organization that created a Link in that window would have been refused. A walk of this size needs Link headroom checked first, or fewer Spaces alive at once.
2. `cub variant upload` exits 0 when Links fail on quota. The Units were written and only the `link FAILED` lines say that something is missing. The failure was first missed here because only the first and last lines of the output were being read.
3. `cub unit diff` help lists `Tag:<slug>` and `ChangeSet:<slug>` as revision references. The server refuses both and says a reference must be a revision number, `-N`, `HeadRevisionNum` or `LastReleasedRevisionNum`. `cub variant diff` does accept Tags and ChangeSets.
4. A bare `cub unit diff <unit>` fails on a Unit that has never been released, because the default `--from` is `LastReleasedRevisionNum`. The message is `Failed: revision LastReleasedRevisionNum not found or is invalid`. In a Space with no release Target, every example that relies on that default or names `LastReleasedRevisionNum` fails this way.
5. `cub unit diff --space <space>` with no Unit name is refused with `Failed: accepts between 1 and 3 arg(s), received 0`. One user doc showed that form at the time of the run.
6. `cub variant approve <space>` without `--all` prints `Nothing to record in <space>: no unit has the selected revision` when the real reason is that no Unit has a Target. It exits 0.
7. A subcommand that does not exist, such as `cub unit livestate` or `cub unit set-predicates`, prints the group help and exits 0. There is no "unknown command" error, so a script that calls a removed command does not fail.
8. `cub variant create` has no `--dry-run` flag. The default Space name could only be observed by creating the Space.
9. When the base Space has no trigger selection, the clone is given a `WhereTrigger` that points at the base Space. "The selection is copied" is therefore true only in the sense the help gives. A clone of a base that has its own Triggers ends up running the base's Triggers, with a `WhereTrigger` the base itself does not have.
10. On an unchanged repeat upload, the "broke selector link" lines name Units as `redis-headless-redis-service` and `redis-master-statefulset`. Those are not the Unit names. The first upload printed the real names, `redis-headless-service` and `redis-master`.
11. `cub variant diff` between the end tags of two different uploads shows every Unit the later upload left unchanged as "absent". The ChangeSet form, or an earlier tag against the head, gives the true diff.
12. With `--change-desc`, a promotion records that description on the new revision in the variant. The description of the upstream change is not carried, which differs from the default the help describes.
13. `cub unit set-protection` prints the Unit's whole mutation record, including the full resource body, on success. `--quiet` is advisable in a guide.
14. `cub function get --quiet --show values get-yq '<expr>'` printed nothing, while the same command with `--show output` and no `--quiet` printed the values.
15. Rendered Secrets are skipped by design. The redis file has 14 objects and the Space has 13 Units, so "every resource becomes its own Unit" needs the words "except Secrets".
16. The top-level help tells AI agents to set `CONFIGHUB_AGENT=1` for help output. This run did not set it, so the help quoted here is the help a person sees.
17. Two commands in this session were run in one shell call, each to completion before the next started (the plain dry run and the real promotion in check 5). Nothing ran in parallel or in the background.
