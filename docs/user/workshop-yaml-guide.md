# Answer the questions plain Kubernetes YAML users ask

Plain Kubernetes YAML is the simplest source the Catalog holds. There is no
chart, no module, and no recipe standing between the file and the object it
describes. Reading the file already tells you the object. That does not make
plain YAML free of questions: you still need to know what a file will create,
how two files differ, and what work travels with the objects beyond `kubectl
apply`.

You can work through this Guide two ways, and both use the same commands. Read
it top to bottom yourself and run each command as it appears, or hand the
whole Guide to an agent with the assistant task below and check its answers
against the same retained files. Nothing here needs a cluster, a ConfigHub
account, or network access once the checkout is on disk.

The Catalog holds one plain-YAML entry today: `plain-yaml-acme-web`, four
files that describe one small web application. Its retained base resolves
from its listing first:
[site/listings/kubernetes-yaml-acme-web-base.json](../../site/listings/kubernetes-yaml-acme-web-base.json).
Read the listing before running anything; it names the source files, the
object-set digest, and the flattening verdict for this exact entry.

[Jump to the assistant task](#give-an-assistant-the-whole-yaml-path).
Complete the setup first if this is your first Guide.

## Set up

Install the pinned Workshop plugin as described in the
[Adapt setup](./workshop-adapt-guide.md#prerequisites-and-setup). That gives
you the `cub` command surface this Guide uses. Every command below runs in the
evidence checkout, this repository, against the four files in
[examples/plain-yaml/acme-web](../../examples/plain-yaml/acme-web). No chart
build, module build, or recipe composition step comes first, so nothing here
needs network access once you have this checkout.

## Check your agent the same way every time

Predicting the exit code and the one answering field before you run each
command is the same rule the skill states from the agent's side in
["Say What You Expect Before You Run It"](../../skills/config-workshop/SKILL.md#say-what-you-expect-before-you-run-it),
and the three moves in
[the Helm Guide's agent-checking section](./workshop-helm-questions-guide.md#check-your-agent-the-same-way-every-time)
apply here without change: make the agent cite full object identities
(`v1|Namespace||acme-web`, not "the namespace"), compare its answer with the
retained receipt the question names, then run that question's gate and
confirm it rejects a wrong answer before you trust that it accepts a right
one.

Plain YAML removes one whole category of failure the other Guides check for.
There is no template and no schema between the file and the object, so an
agent cannot blame a silently ignored value or an unread key. If it does,
that is the tell that it has not actually read the file.

## 1. What will this install, and what must already exist?

Someone has four YAML files and wants to know the exact objects and the
prerequisites before pointing them at a namespace.

**Why plain YAML does this differently.** A Helm chart or a Timoni module can
reference a namespace, a Secret, or a StorageClass it never creates. Plain
YAML has no template step to hide that gap behind, so whatever the four files
declare is the whole candidate. Whether anything is still missing depends on
what the files actually contain, not on a generator's assumptions.

**Run it in the evidence checkout.**

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, the object
count and whichever namespaces `cub config check` reports as required). Run
it. If the result matches, the explanation stands. If it differs, the agent
guessed; read the real output before trusting it.

```sh
for f in examples/plain-yaml/acme-web/*.yaml; do echo '---'; cat "$f"; done > acme-web.yaml
cub config check ./acme-web.yaml
```

**Read the result.** Expect exit `0`. The command reports 4 objects: Namespace
x1, ConfigMap x1, Deployment x1, Service x1. It reports no required-existing
namespace, because the fourth object is the `acme-web` Namespace itself. It
also reports zero CRDs, zero Helm hooks, zero setup Jobs, and zero admission
webhooks, because none of the four files declare one. The only prerequisite
`cub config check` cannot read out of the YAML is pull access to the
Deployment's digest-pinned image,
`registry-1.docker.io/bitnami/nginx@sha256:805bcc863fc3f602589fc75cae91eeedebad234d5ce5a476c96b03a747821e7f`.

**Check the agent.** Ask it to name all 4 object identities, then compare its
answer with
[the retained upload receipt](../../runs/literal-yaml-upload-proof/receipt.yaml),
which lists every identity ConfigHub stored:
`v1|Namespace||acme-web`, `v1|ConfigMap|acme-web|acme-web-content`,
`apps/v1|Deployment|acme-web|acme-web`, and `v1|Service|acme-web|acme-web`.
Then run the gate:

```sh
npm run literal-config-examples:verify
```

The command prints `verified the permanent plain-YAML and existing-OCI
examples`, checking this base's stored object count, its digest, and its
source-match against the committed receipt, among the other retained
literal-configuration examples it covers in the same pass. There is no
separate self-test for this gate;
treat a pass as "the retained receipt still matches these bytes," not as a
mutation-rejection proof the way the Timoni and AICR gates below provide one.

**What this does not prove.** Reading four files establishes nothing about the
cluster. Admission control, the image registry actually serving that digest,
and Deployment rollout health are not checked by any command on this page.

**Where it goes next.** Retain the reviewed object set with the same command
the listing itself gives:

```sh
cub variant upload --dry-run --component plain-yaml-acme-web --variant base --space kubernetes-yaml-acme-web-base --granularity minimal --annotation workshop.confighub.com/object-set-sha256=sha256:963bf5420b78fbbfa43be7adbb1ced299edef0b2baf0f36850992a6bf66c1926 ./rendered
```

## 2. How do two YAML files, or two versions of the same file, differ?

Someone has a candidate change to one of the four files and wants the exact
object and field that moved, not a text diff that also reports every
reformatted line.

**Why plain YAML does this differently.** There is no build step to rerun, so
comparing two versions of a plain-YAML source is comparing the files
themselves. `cub config diff` still does the useful part: it identifies
objects, not lines, so moving a key or reindenting a file reports no change
while an actual field edit does.

**Run it in the evidence checkout.** Build the baseline from the retained
files, copy it, then make one deliberate edit.

```sh
for f in examples/plain-yaml/acme-web/*.yaml; do echo '---'; cat "$f"; done > acme-web-base.yaml
cp acme-web-base.yaml acme-web-candidate.yaml
```

Open `acme-web-candidate.yaml` and change only the Deployment's
`spec.replicas` from `1` to `2`. Leave every other line untouched, including
whitespace.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, the changed
object and the changed field). Run it. If the result matches, the explanation
stands. If it differs, the agent guessed; read the real output before
trusting it.

```sh
cub config diff acme-web-base.yaml acme-web-candidate.yaml --json --exit-code --out acme-web-diff.json
```

**Read the result.** Expect exit `1`, a finding rather than a failure: 4
objects on each side, 1 changed object, `apps/v1|Deployment|acme-web|acme-web`,
with one changed field, `/spec/replicas` replaced from `1` to `2`. The other 3
objects report unchanged. Run the same command again with the untouched copy
of `acme-web-candidate.yaml` you made before editing it, and confirm it exits
`0` with `equal: true`, so you have seen both outcomes before trusting either.

**Check the agent.** Ask it to name the changed object and field before you
show it the JSON, then compare its answer with the file you just produced.
There is no separate retained fixture for this comparison, because the edit
is one you make yourself; the check is whether the agent's prediction matches
the diff it is about to read, not a fixed answer key.

**What this does not prove.** Comparing two local files says nothing about a
live cluster, and `cub config diff` states its own boundary under
`notChecked` in the JSON output. Arrays are compared as whole values, the
same limit every other Guide's diff question names.

**Where it goes next.** Retain whichever file you reviewed using the same
`cub variant upload` pattern as question 1, with a new object-set hash for the
edited file.

## 3. What lifecycle work is declared for this base?

An operator wants to know whether anything beyond a plain `kubectl apply`
needs to happen before or after these four objects land, and in what order.

**Why plain YAML does this differently.** The other formats in this Catalog
generate objects from a template, a module, a recipe, or a platform
description, and each of those source types can declare ordering, waits, or
setup work that has to travel with the exact objects. Plain YAML has no
generation step to declare that work during, so the Catalog records this
base's lifecycle-route status as a gap rather than as "none needed."

**Read the record**, in the evidence checkout:
[the BaseVariantRecord](../../data/base-variant-records/records/kubernetes-yaml-acme-web-base.yaml).
Its `lifecycle.requirements.status` is `"gap"`, its `routeIntent.status` is
`"gap"`, and both `items` and `routes` are empty lists. That is a real
finding, not a placeholder: nobody has recorded destination facts or
lifecycle-route work for this exact base, so a gap in the record is the
honest state, not proof that no such work exists once you point these four
objects at a real destination.

**Check the agent.** Ask it whether "no CRDs, no hooks, no Jobs" from question
1 is the same claim as "no lifecycle route work." It is not: question 1
reports what `cub config check` can read out of the object fields, and this
question reports what the Catalog has separately assessed and recorded for
this base. A gap in one does not fill the gap in the other. There is no gate
to run for this question, because there is no recorded routing decision yet
to check an agent's answer against.

**What this does not prove.** A gap in the lifecycle-route fields is not a
green light. The record's own `resolution` rule says to re-resolve after a
destination is assigned, the same rule every other base in this Catalog
carries.

**Where it goes next.** Choose a destination, record its facts, and resolve
the lifecycle-route question before treating this base as ready to apply, the
same next step the record itself names.

## Give an assistant the whole YAML path

Start a fresh session with this checkout prepared and ordinary tool
approvals:

```text
Walk the three questions in docs/user/workshop-yaml-guide.md in order. For
each one, run the given command, save its output to its own file, and report
the actual exit code. Name object identities in full, including API version,
kind, namespace, and name. For question 1, compare your answer with
runs/literal-yaml-upload-proof/receipt.yaml and run
npm run literal-config-examples:verify, reporting the exact printed line. For
question 2, predict the changed object and field before you read the diff
JSON, then report whether your prediction matched. For question 3, read
data/base-variant-records/records/kubernetes-yaml-acme-web-base.yaml and
report the lifecycle.requirements.status and routeIntent.status fields
exactly as recorded, without rephrasing "gap" as "none." Do not run any cub
command beyond the ones this Guide names, and do not contact a cluster,
ConfigHub, or a registry. State every boundary each question lists as not
proven.
```

Read the report against this Guide rather than accepting it. An agent that
reports question 3's gap as "no lifecycle work required" has answered a
different, easier question than the one this Guide asks.

## Know what this Guide does not settle

Every answer above comes from reading four committed files and one
self-produced comparison. That is a local result. It is not a ConfigHub
record, a delivered change, or a live-cluster proof, whatever the object
count or exit code says.

This base carries a `born-flattened` verdict: the four files already are the
exact objects, so there is no separate materialization step to recheck after
a source change the way a chart render or a module build needs one. There is
still a destination to choose, target facts to record, and the lifecycle-route
gap from question 3 to resolve before any controller applies these objects.

The object counts and digests cited throughout this Guide are the committed
Catalog evidence for this one entry:
[the BaseVariantRecord](../../data/base-variant-records/records/kubernetes-yaml-acme-web-base.yaml).
Choosing a destination, recording its facts, and watching these objects reach
a live cluster are the pending trial this Guide does not run. Missing
coverage stays marked as not checked, here and everywhere else.
