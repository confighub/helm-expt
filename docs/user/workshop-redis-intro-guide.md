# Walk the whole model once, with Redis

This Guide is the front door. It walks one chart, Redis, through the whole
ConfigHub Workshop model in a single pass: the catalog entry, whether it can
be flattened, its OCI package, a derived variant, a promotion, a policy gate,
and a stack. Six steps, one chart, the whole shape.

It works two ways. Read it top to bottom yourself and run the copyable
commands, or hand it to an assistant in an AI session and watch it work
through the same six steps with you. Both are normal uses of this Guide;
neither is the fallback for the other. [Jump to the assistant
task](#give-an-assistant-the-whole-redis-walk). Complete the setup below
first if this is your first Guide.

Three of the six steps run entirely on your machine and need no account.
The other three start becoming shared, governed state that someone has to
keep and revisit later, a tracked variant, a promotion, a policy gate, so
those three start `cub server`, a local ConfigHub that comes up in about
twenty seconds. That is one command, not a hosted account or a signup form.
Each step below says which kind it is before it gives you the command:
**free and local**, or **start `cub server` here**.

## Set up the pinned tooling

Install the pinned Workshop plugin as described in the
[Adapt setup](./workshop-adapt-guide.md#prerequisites-and-setup). That gives
you the `cub-workshop` checkout this Guide calls the plugin checkout, and the
`cub config check`, `cub config diff`, `cub variant`, `cub trigger`, and
`cub stack` commands used below. Run this Guide's commands from the root of
this repository (`helm-expt`), which carries the catalog listing, the
retained records, and the exact rendered objects this Guide reads.

No account, credentials, cluster, or registry is needed for the first two
steps, or for the local half of the third and sixth. Starting `cub server`
for the first time needs nothing beyond the plugin checkout; it opens a
local ConfigHub with no external account.

## Check your agent the same way every time

Predicting the exit code and the one answering field before you run each
command is the same rule the skill states from the agent's side in
["Say What You Expect Before You Run It"](../../skills/config-workshop/SKILL.md#say-what-you-expect-before-you-run-it).
Make the agent cite full object identities
(`apps/v1|StatefulSet|redis|redis-master`, not "the StatefulSet"), compare
its answer with the retained listing or record that the step names, then run
the command and read the actual output before trusting a summary of it.

One habit matters more here than in a single-question Guide. This walk
crosses the local-to-server boundary three times, so before your agent runs
anything, make it say out loud which side of that boundary the next command
is on: a local read that changes nothing, or a write that starts or uses
`cub server`. An agent that glosses over that distinction is the one that
runs a server-side write believing it was still reading a file.

## 1. Find Redis in the catalog

**What it is.** The catalog listing and record for one exact Redis entry:
`bitnami/redis` version `25.5.3`, base `default`. A listing is generated
evidence, a compact JSON view over a longer record, and both are checked
into this repository so you can read them without running anything.

**Why Redis behaves this way.** Redis's chart mints its own password with
the shared Bitnami secret helper: it looks for an existing Secret and
generates one only if none is found. That lookup-or-generate construct is
exactly what a flattened, shared artifact must never freeze, so the catalog
records this base's flattening verdict as `unsafe-to-flatten`, action
`process-source-late`. Helm keeps running at install time for this chart;
the catalog retains the objects it produces rather than replacing Helm.

**Predict first.** Before you open the listing, ask your agent to name the
object count and the flattening verdict it expects for a chart that mints
its own credentials. Then open the listing and check.

Read [the listing](../../site/listings/bitnami-redis-25-5-3-default.json)
and [the record](../../data/base-variant-records/records/bitnami-redis-25-5-3-default.yaml).

**Read the result.** The listing names 14 retained objects at digest
`sha256:175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e`,
built from the pinned source package
`oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3@sha256:a216ce212424e05b341ef5000f1798e6014b72b8bc3dce9f315285871037af2a`.
That source-package OCI role is filled; the listing's `literal-config` OCI
bundle role is `not-published`, because publishing a flattened bundle for a
chart the verdict calls unsafe would contradict the verdict itself. The
installer package stays this base's certified route instead. The rationale
recorded in
[the flattening verdict](../../recipes/bitnami/redis/25.5.3/publication/flattening-safety-verdict.yaml)
names the credential construct directly: "the chart reads an existing
Secret and mints one when absent. That is the exact construct a public
flattened artifact must never freeze."

**Boundary.** Free and local. Reading a listing and a record needs no
account, no cluster, and no network call.

## 2. See what it installs

**What it is.** `cub config check` reads the retained objects for this base
and reports the object count, the namespaces that must already exist, and
four lifecycle counters: CRDs, Helm hooks, setup Jobs, and admission
webhooks needing a certificate.

**Why Redis behaves this way.** The 14 retained objects are 3 ConfigMaps, 1
NetworkPolicy, 2 PodDisruptionBudgets, 1 Secret, 3 Services, 2
ServiceAccounts, and 2 StatefulSets. None is a Namespace, a
CustomResourceDefinition, a Job, or a webhook configuration, and none
carries a `helm.sh/hook` annotation, so all four lifecycle counters read
zero for this chart. Every object's `metadata.namespace` reads `redis`,
which nothing in the set creates.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question, here the
namespace `cub config check` reports as required. Run it. If the result
matches, the explanation stands.

```sh
cub config check recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml
```

**Read the result.** Expect exit `0`. The 14 objects report as above, and
`redis` is the one namespace `cub config check` reports under the
namespaces that must already exist. All four lifecycle counters read zero.

**Boundary.** Free and local. `cub config check` reads the file you point
it at; it contacts nothing.

## 3. Compare two bases, then track one as a variant

**What it is.** The catalog holds two bases for this same chart and
version: `default` (14 objects) and `reuse-existing-secret` (13 objects),
and it holds the same pair for chart version `27.0.0` as well. Comparing
two bases with `cub config diff` shows exactly what one recipe choice
changes; retaining a base and deriving a tracked variant from it is how a
reviewed object set becomes something ConfigHub can promote later.

**Why Redis behaves this way.** `reuse-existing-secret` exists precisely to
discharge the credential hazard from step 1: instead of minting a Secret,
it points the two StatefulSets at a Secret you already manage. The diff
below shows that discharge as one removed object and two changed fields,
not a description of it.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question, here the
removed object and the count of changed objects. With `--exit-code`, a
found difference returns exit `1`, a finding rather than a failure.

```sh
cub config diff recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml --json --exit-code --out redis-base-diff.json
```

**Read the result.** Expect exit `1`: 14 objects before, 13 after, 0 added,
1 removed, 2 changed, 11 unchanged. The removed object is
`v1|Secret|redis|redis`. The two changed objects are the `redis-master` and
`redis-replicas` StatefulSets, each with two changed fields, because they
now read the existing Secret instead of the one the default base generates.
The same command works between chart versions `25.5.3` and `27.0.0` on
either base; [the Helm Guide's question
5](./workshop-helm-questions-guide.md#5-can-i-upgrade-this-chart-without-breaking-production)
runs that comparison and finds all 14 objects changed, none added or
removed.

**Boundary for the diff above.** Free and local. `cub config diff` compares
two files on disk.

**Start `cub server` here** for the rest of this step. Retaining a base and
deriving a variant from it puts state on a server someone has to keep, so
this is the first command in this Guide that needs one running. Copy
[the release objects](../../recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml)
into a local directory named `rendered`, preview the retention, then retain
it and derive a staging variant:

```sh
cub variant upload --dry-run --component bitnami-redis --variant default --space bitnami-redis-25-5-3-default --granularity minimal --annotation workshop.confighub.com/object-set-sha256=sha256:175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e ./rendered
cub variant upload --component bitnami-redis --variant default --space bitnami-redis-25-5-3-default --granularity minimal --annotation workshop.confighub.com/object-set-sha256=sha256:175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e ./rendered
cub variant create staging bitnami-redis-25-5-3-default --space-pattern template:bitnami-redis-25-5-3-default-staging --environment Staging --unit-annotation workshop.confighub.com/object-set-sha256=sha256:175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e
```

These three commands are the exact ones this base's own listing gives under
["How to make one"](../../site/listings/bitnami-redis-25-5-3-default.json),
so they are the catalog's own answer for this chart, not a generic template.
The dry run previews the retention without writing anything; the second
command retains it; the third clones it into a `Staging` variant with the
object-set hash carried as an annotation on both sides, so the accepted
identity travels with the copy.

## 4. Promote the variant toward staging

**What it is.** `cub variant promote --dry-run -o mutations` previews
exactly what a promotion would change in the target Space, without writing
anything. It is the review step between deriving a variant and letting it
actually move.

**Why Redis behaves this way.** The staging variant you just created
carries the same object-set annotation as the base it came from, so a clean
promotion preview should show no unexpected addition or deletion, only the
fields staging is meant to hold differently, if any.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question, here whether
the mutation preview shows any object added or removed rather than only
changed.

**Start `cub server` here.**

```sh
cub variant promote bitnami-redis-25-5-3-default-staging --dry-run -o mutations
```

**Read the result.** Expect exit `0` and a mutation preview naming the
Units the promotion would touch, with no stored data changed by a dry run.
This exact command, run against a live promotion of this same chart, is
recorded end to end in
[the Redis upgrade and rollback proof](../../data/redis-upgrade-app-proof/summary.md):
a promotion to `development` and then `staging` returned a mutation preview
and "left stored data unchanged" both times, then a published release
reconciled on two Argo CD clusters. That proof used its own environment
names and object-set digests for a different candidate change; read it
rather than expecting its exact numbers to reappear here.

**Boundary.** This proves the preview is honest about what it would change.
It does not itself deliver anything; the live proof above is the trial that
carries a promotion through to a running cluster, and it is a separate,
already-run trial, not a rerun of this Guide's own steps.

## 5. Gate the promotion behind an approval

**What it is.** `cub trigger create` attaches a policy check to a Space. The
catalog's own `catalog-standard` profile defines `platform/require-approval`
as a `block`-effect trigger, function `vet-approvedby`, requiring one
recorded approval before a Mutation is allowed to apply. This base's own
record already names that profile: policy `catalog-standard`, with
production adding `human-approval`.

**Why Redis behaves this way.** Nothing about Redis specifically demands
this gate; any Space holding production or system configuration gets it
under the catalog-standard profile. Attaching it here means the staging
Space you just created cannot be applied again until a named approver signs
off on the exact revision.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one fact that answers the question, here whether a
publish attempted before any approval is refused or allowed.

**Start `cub server` here.**

```sh
cub trigger create require-approval Mutation Kubernetes/YAML vet-approvedby 1 --space bitnami-redis-25-5-3-default-staging
```

**Read the result.** Expect exit `0`, and from then on a publish into that
Space is blocked until one approval is recorded against the exact revision.
One gotcha travels with cloning a variant: `cub variant create` copies the
upstream Space's `WhereTrigger`, so a trigger created inside the clone can
match nothing until the clone's own `WhereTrigger` names its own Space. The
fix is
`cub space update --patch bitnami-redis-25-5-3-default-staging --where-trigger "SpaceID='<the staging Space's own id>'" --refresh-triggers`.
This exact gate, and this exact gotcha, were both proven live against this
same chart's `reuse-existing-secret` base in
[the AI operator ladder proof](../../data/ai-operator-ladder/summary.md): a
publish went out ungated once, because the clone's `WhereTrigger` still
pointed at its upstream; pointing it at the clone's own Space gated all 13
units, the next publish was refused while gated, and 13 explicit unit
approvals cleared it before the release published at digest
`sha256:2de09898c4d4ff4b92decab661662f2341b6ec19982c1bf127aac9af7dda1678`.
That proof used the `reuse-existing-secret` base and its own Space names;
the mechanism is what carries over, not its digest.

**Boundary.** Creating and testing a gate on your own Space is real, local
governed state. Whether the named approver in your own organization is the
right person to hold that approval is a decision for your team, not
something this Guide can check.

## 6. Compose Redis into a certified stack

**What it is.** A stack composes several components' certified objects into
one platform, checked together instead of one at a time. `cub stack
certify` reads a stack definition and checks whether its components can be
combined without a resource conflict, a namespace surprise, or a CRD
ordering problem, and says yes or no before anything renders. `cub stack
sandbox` does the same check and then renders the whole composition to its
exact combined objects, on your machine, with no cluster.

**Why Redis behaves this way.** The pinned Workshop plugin checkout already
carries a `redis-platform` stack:
[`stacks/redis-platform.yaml`](https://github.com/confighub/cub-workshop/blob/main/stacks/redis-platform.yaml)
composes `redis`, `external-secrets`, and `kube-prometheus-stack`, three
digest-pinned OCI bundles, into one managed platform: the cache, its
secrets, and its monitoring. Redis is already one of the three; this step
does not add it, it certifies the composition Redis already belongs to.

**Predict first.** Before you run it, ask your agent whether it expects
`redis-platform` to certify cleanly or to report a conflict, and to name
which of the three components it thinks might collide, if any.

```sh
cub stack certify redis-platform
cub stack sandbox redis-platform
```

**Read the result.** Expect exit `0` from both. `certify` reports
`CERTIFIED`; this stack's published claim in the Workshop site's own stack
table names it `CERTIFIED` without a specific object count, unlike some
other example stacks that do carry one, so read the exact count yourself
from `sandbox`'s render rather than expecting one printed here. `sandbox`
performs the same certify check, then renders the combined objects for all
three components with no infrastructure involved.

**Boundary.** Free and local. Certifying and sandboxing a stack composition
runs entirely against files the plugin ships; delivering that composition
to a running cluster is `cub stack upload`, a separate step this Guide does
not run.

## Give an assistant the whole Redis walk

Start a fresh session with the plugin checkout and this repository prepared,
and ordinary tool approvals:

```text
Walk the six steps in docs/user/workshop-redis-intro-guide.md in order. For
each one, say out loud whether the next command reads local files or starts
or uses cub server, then run the command and report the actual exit code.
Name object identities in full, including API version, kind, namespace and
name. After step 1, compare your answer with the listing and the flattening
verdict named in that step. After step 3's diff, name the removed object and
the two changed StatefulSets before running the variant commands. Before
step 5's trigger command, state what a publish attempted before any approval
would do. State every boundary each step names as not proven, and mark
anything you did not run as not checked rather than passing. Do not run any
command beyond the ones this Guide names, and do not treat the live proofs
this Guide cites (the Redis upgrade and rollback proof, the AI operator
ladder proof) as something you rerun; read them, and say so when you are
quoting a recorded result rather than one you produced yourself.
```

Read the report against this Guide rather than accepting it. A step marked
"start cub server here" that the report glosses over as a local read is the
mistake worth catching first, because it is exactly the boundary this Guide
exists to keep visible.

## Know what this Guide does not settle

Six steps, one chart, one pass. That is a shape, not a substitute for the
Guides that go deeper on any one of them. The ten Helm questions, the field
edit that avoids a fork, the upgrade review, the hook and CRD checklist, and
the Timoni, plain-YAML, AICR, and Kubara paths each take one part of this
walk further than a single pass can.

Two boundaries stay explicit throughout. First, a local check, diff,
certify, or sandbox result is not a live-cluster proof; steps 4 and 5 name
the live proofs that exist for this same chart and point at them rather
than pretending a dry run reached a cluster. Second, this base's own
flattening verdict is `unsafe-to-flatten`, and that verdict means the chart
keeps running at install time for the destination you actually choose. It
is rechecked after the source, a lifecycle-sensitive variant field, the
destination, or the delivery runtime changes, the same recheck rule
[the record](../../data/base-variant-records/records/bitnami-redis-25-5-3-default.yaml)
states for every base in this catalog.
