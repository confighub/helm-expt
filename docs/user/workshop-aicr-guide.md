# Answer the questions AICR users ask

NVIDIA AICR selects and composes a recipe into component configuration. It
does not hand you one chart's values; it picks fifteen or sixteen components
for a named accelerator, intent, OS, and platform, orders them, and generates
the wrapper objects a GitOps controller reconciles. The Workshop treats an
AICR entry the same way it treats every other source: compose the exact
objects, check what they need, and carry the lifecycle work forward with them
instead of losing it once the wrapper objects apply.

You can work through this Guide two ways, and both use the same commands.
Read it top to bottom yourself and run each command as it appears, or hand
the whole Guide to an agent with the assistant task below and check its
answers against the same retained files. Composing a recipe for the first
time needs the `aicr` CLI and network access to pull component charts; every
command below reads only committed files and needs neither.

The Catalog retains four AICR entries for one recipe,
`eks-h100-training-kubeflow`, an EKS, H100, Ubuntu, Kubeflow training
platform: a raw `v0.14.0` base rendered for Flux, and three Argo CD wrapper
bases at `v0.14.0`, `v0.19.0`, and `v0.20.0`. Each retained base resolves from
its listing first, for example
[site/listings/aicr-eks-h100-training-kubeflow-v0-14-0-argocd.json](../../site/listings/aicr-eks-h100-training-kubeflow-v0-14-0-argocd.json).
Read a listing before running anything; it names the recipe, the criteria,
the object count, and the flattening verdict for that exact entry.

[Jump to the assistant task](#give-an-assistant-the-whole-aicr-path).
Complete the setup first if this is your first Guide.

## Set up

Install the pinned Workshop plugin as described in the
[Adapt setup](./workshop-adapt-guide.md#prerequisites-and-setup). That gives
you the `cub` command surface this Guide uses. Every command below runs in the
evidence checkout, this repository, against the committed AICR entries under
[examples/aicr](../../examples/aicr). Composing a recipe from scratch with the
`aicr` CLI needs network access to pull the named component charts; reading
the retained recipe, rendered objects, and receipts does not.

## Check your agent the same way every time

Predicting the exit code and the one answering field before you run each
command is the same rule the skill states from the agent's side in
["Say What You Expect Before You Run It"](../../skills/config-workshop/SKILL.md#say-what-you-expect-before-you-run-it),
and the three moves in
[the Helm Guide's agent-checking section](./workshop-helm-questions-guide.md#check-your-agent-the-same-way-every-time)
apply here without change: make the agent cite full object identities
(`argoproj.io/v1alpha1|Application|argocd|gpu-operator`, not "the GPU
operator app"), compare its answer with the retained inventory or receipt the
question names, then run that question's gate and confirm it rejects a wrong
answer before you trust that it accepts a right one.

One AICR-specific habit sits beside those three. Every retained entry here is
an Argo CD **wrapper**: one root Application and sixteen component
Applications that each still name a Helm chart or a local chart path. An
agent that reports "AICR rendered the workload" without naming which sixteen
sources Argo CD still has to process later has answered a smaller question
than the one this Guide asks.

## 1. What does this recipe compose, and what must already exist?

Someone has a pinned AICR recipe and wants the exact object list and the
destination prerequisites before choosing a cluster to point it at.

**Why AICR does this.** The recipe's criteria (`accelerator: h100`,
`intent: training`, `os: ubuntu`, `platform: kubeflow`, `service: eks`)
select fifteen components and order them; composing the recipe with a
deployer turns that selection into exact wrapper objects. Reading the wrapper
objects answers what will exist as literal bytes. It does not answer what the
destination must already provide, because Argo CD itself, its Application
CRD, and the storage and node facts the recipe assumes are never among the
objects the wrapper renders.

**Run it in the evidence checkout**, using the `v0.14.0` Argo CD entry.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, the object
count and the namespace `cub config check` reports as required). Run it. If
the result matches, the explanation stands. If it differs, the agent guessed;
read the real output before trusting it.

```sh
cat examples/aicr/eks-h100-training-kubeflow/argocd-rendered/templates/*.yaml > eks-h100-v0-14-0-argocd.yaml
cub config check ./eks-h100-v0-14-0-argocd.yaml
```

**Read the result.** Expect exit `0`. The command reports 17 objects, all
`Application` (argoproj.io/v1alpha1), and reports `argocd` under the
namespaces that must already exist, because none of the 17 objects is a
Namespace object. It reports zero CRDs, because none of the 17 objects is a
CustomResourceDefinition; that count says nothing about whether a CRD needs
to exist elsewhere; it counts CRD objects present in this file, and none is.
The real CRD dependency is that Argo CD's own `Application` custom resource
must already be served before any of these 17 objects means anything, which
is exactly why it is recorded separately as a target fact rather than left
for the object counter to discover.

**Check the agent.** Ask it what this composition assumes beyond the 17
objects, then compare its answer with
[the v0.19.0 route intent](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/route-intent.yaml),
whose target facts apply to this recipe lineage: Argo CD and its Application
CRD must exist, the target must be an EKS cluster with H100 nodes running
Ubuntu, a `gp3` StorageClass must be available, and GPU nodes must carry
`nvidia.com/gpu.present=true`. Then run the gate:

```sh
npm run aicr-argocd-example:verify
```

The command prints `verified AICR Argo CD OCI example (54 source files, 17
Applications, 2 local OCI layouts)` for this `v0.14.0` entry, checking the
source bundle and rendered checksums that back the object count above. Read
[the generation receipt](../../examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml)
alongside it: the claim is that AICR generated a portable Argo CD Helm chart
and 17 exact Application objects, both OCI artifacts are publicly pullable at
their recorded digests, and Argo CD reconciliation and GPU-cluster health
have not run.

**What this does not prove.** Reading 17 wrapper objects establishes nothing
about the cluster, and it does not prove the sixteen referenced charts render
cleanly. [The nested-source table](../../data/aicr-v0-20-0-nested-sources/summary.md)
for the newer `v0.20.0` entry shows all sixteen local renders captured, eight
of them containing CRDs of their own, zero containing Helm hook objects; that
table is the closest local answer to "what do the component charts actually
need," and it is not claimed for `v0.14.0`.

**Where it goes next.** Retain the reviewed object set with the same command
the listing itself gives:

```sh
cub variant upload --dry-run --component eks-h100-training-kubeflow --variant argocd --space aicr-eks-h100-training-kubeflow-v0-14-0-argocd --granularity minimal --annotation workshop.confighub.com/object-set-sha256=sha256:fc03b2950c81db63a4853424fcb30942e9ecf0e94e54f7474439421dcc254801 ./rendered
```

## 2. How does one AICR version differ from another?

A platform team has retained `v0.14.0`, `v0.19.0`, and `v0.20.0` of the same
recipe and needs the exact object and field that moved between them, not a
changelog.

**Why AICR does this.** Every retained version was composed from the same
criteria, so a version bump changes component chart versions, sync-wave
placement, or embedded health checks, not the component list. Comparing the
exact rendered Applications is how you see which of those three things
actually moved for a given upgrade.

**Run it in the evidence checkout**, using the ConfigHub-exported single-file
release for `v0.19.0` and `v0.20.0`.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, the count
of changed Applications and which ones). Run it. If the result matches, the
explanation stands. If it differs, the agent guessed; read the real output
before trusting it.

```sh
cub config diff examples/aicr/eks-h100-training-kubeflow-v0-19-0/confighub-release/aicr-eks-h100-training-kubeflow.yaml examples/aicr/eks-h100-training-kubeflow-v0-20-0/confighub-release/aicr-eks-h100-training-kubeflow.yaml --json --exit-code --out v19-v20-diff.json
```

**Read the result.** Expect exit `1`, a finding rather than a failure: 17
objects on each side, 0 added, 0 removed. Every one of the 17 reports changed,
because each carries ConfigHub's own recorded `confighub.com/origin`
annotation naming the space and revision it was retained from, and that
annotation differs between the `v0.19.0` staging export and the `v0.20.0`
production export. Read past that recorded bookkeeping field to the object's
other changed paths, and only 4 of the 17 carry one:
`aicr-stack` (`/spec/source/repoURL`, `/spec/source/targetRevision`,
`/spec/source/helm/valuesObject/repoURL`), `kubeflow-trainer-post` and
`nodewright-customizations` (`/spec/source/repoURL`,
`/spec/source/targetRevision`), and `nvsentinel`
(`/spec/source/targetRevision`, from `v1.9.0` to `v1.20.0`). The other 13
Applications are byte-identical apart from the provenance annotation.

**Check the agent.** Ask it to separate the recorded provenance annotation
from the recipe-driven change before it reports a count, then compare its
answer with
[the retained version-diff record](../../data/aicr-version-diff/summary.md),
which computes the same v0.19.0-to-v0.20.0 transition from committed bytes:
4 of 17 component Applications changed version, 0 changed sync-wave, and
NVSentinel's own health check tightened its timeout from `5m` to `90s` and
added 2 DaemonSet checks. Then run the gate:

```sh
npm run aicr-version-diff:verify
```

The command reprints `verified 5 retained AICR versions; latest transition
v0.20.0 -> v0.21.0 changes 5 of 17 component Applications`. That printed line
covers the newest retained pair, a fourth entry beyond the three this Guide
walks; the v0.19.0-to-v0.20.0 numbers above come from the same underlying
`data/aicr-version-diff/diff.json` record, which retains every adjacent
transition, not only the latest one.

**What this does not prove.** A version/wave-unchanged component can still
carry a changed values block the classifier does not itemize; the record's
own closing note says a full comparison retains `objectComparisons` with
every changed JSON-pointer path for exactly this reason. Neither this
comparison nor its gate runs anything against EKS.

**Where it goes next.** Read the four real changes against
[the v0.20.0 flattening verdict](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/flattening-safety-verdict.yaml)
before promoting; a `repoURL` or `targetRevision` change is exactly the kind
of edit that verdict's recheck rule names.

## 3. Does this workload fit the H100 accelerator target?

Someone has this recipe's declared accelerator, `h100`, and a candidate
destination, and needs to know whether the two actually match before
delivery.

**Why AICR does this differently from a generic GPU match.** The
[Match Guide](./workshop-match-guide.md) answers this question for one
`InferenceService` compared against a supplied Node snapshot, using a
retained `model.yaml` and `nodes.yaml` pair built for that exercise. No
equivalent pairing exists in this repository for this recipe's own 17
Applications, so this Guide does not invent one. What is retained instead is
the fit question itself, recorded as a named lifecycle route.

**Read the record**, in the evidence checkout:
[the v0.20.0 route intent](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/route-intent.yaml)
names `source-variant-target-match` as a route: "compare observed destination
facts with the intended NVIDIA source variant," owned by "platform operator
or admission policy," with status `recorded-not-run`, requiring "target
snapshot, selected source-catalog digest, and an explained match or
exception." The selected source variant itself is recorded in
[the source-catalog record](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/source-catalog/source-catalog-record.yaml):
`h100-eks-ubuntu-training-kubeflow`, structural status `pass`, with the
overlays applied to reach it listed in order.

**Check the agent.** Ask it to name the two things a real fit check would
need to compare, then confirm it names the recipe's `criteria` block
(`accelerator: h100`, `service: eks`, `os: ubuntu`, `platform: kubeflow`) on
one side and an observed target snapshot on the other, not a generic "does
this have a GPU" question. There is no gate to run here, because
`source-variant-target-match` is recorded `not-run`; running the Match
Guide's generic exercise would check a different model against different
node facts, not this recipe's own fit question.

**What this does not prove.** This question stays open in this repository.
The recipe names its intended target; nothing here observes a real cluster's
node facts and runs the comparison. Treat "the criteria say H100" as the
recipe's declared intent, not as a passed match.

**Where it goes next.** Collect a target snapshot from the destination
cluster, then run the fit comparison the route already names before treating
this recipe as validated for that cluster. That snapshot-and-compare step is
the pending live trial, not a local rung this Guide can complete today.

## 4. What component order, nested sources, and prerequisites travel with this base?

A GitOps operator has the 17 wrapper objects and needs to know what order
they require, which sixteen still name an external source, and what the
destination must provide before any of it reconciles.

**Why AICR does this.** AICR assigns every component Application a
`deploymentOrder` and a sync-wave annotation, but the wrapper objects
themselves still name Helm charts or local chart paths for Argo CD to
process later. Both facts have to travel with the 17 objects, or a plain
unordered apply misses work the recipe already decided.

**Run it in the evidence checkout**, using the `v0.20.0` entry.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, the number
of distinct sync-waves and how many components define one). Run it. If the
result matches, the explanation stands. If it differs, the agent guessed;
read the real output before trusting it.

```sh
grep -c "argocd.argoproj.io/sync-wave" examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-rendered/templates/*.yaml
```

**Read the result.** Expect exit `0`, with 16 files reporting exactly one
match each and `aicr-stack.yaml` (the root Application) reporting none; the
root has no sync-wave, because it deploys first by definition.
[The recipe](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/recipe.yaml)
`deploymentOrder` names the same sixteen components in the order their
`dependencyRefs` require: storage and networking first
(`aws-ebs-csi-driver`, `aws-efa`), then `cert-manager` and `nfd`, then
`gpu-operator` and its dependents, ending with `nvsentinel` and
`prometheus-adapter`.
[The v0.20.0 route intent](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/route-intent.yaml)
records this as the `component-order` route, owned by Argo CD, status
`recorded-not-run`, and records a fourth route, `downstream-chart-lifecycle`,
for the CRDs, hooks, certificates, and setup Jobs each of the sixteen
referenced charts may carry on its own.

**Check the agent.** Ask it to name which of the sixteen components render
their own CRDs, then compare its answer with
[the nested-sources table](../../data/aicr-v0-20-0-nested-sources/summary.md):
`cert-manager` (6 CRDs), `gpu-operator` (2), `kai-scheduler` (6),
`kubeflow-trainer` (4), `nfd` (4), `nodewright-operator` (2),
`nvidia-dra-driver-gpu` (2), and `prometheus-operator-crds` (10), for 8 of
the 16 in total, with 0 Helm hook objects found in any of the sixteen. There
is no separate gate for this question beyond the route-intent record itself;
[the v0.20.0 generation receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/generation-receipt.yaml)
is the retained source for the exact command that produced these bytes.

**What this does not prove.** A local render capturing a CRD is not the same
as watching that CRD reach Established, and "no Helm hook objects found" in
this rendering pass does not certify that no future chart version adds one.
`aicr-node-inspection` and `aicr-configuration-validation`, the last two
routes the same record names, are recorded `available-not-run-for-this-entry`
and `not-run`.

**Where it goes next.** Resolve `argocd-prerequisite` and `component-order`
for the destination you have chosen before relying on Argo CD reconciliation,
then work through `downstream-chart-lifecycle` chart by chart using each
referenced chart's own flattening decision, the same rule
[the v0.20.0 flattening verdict](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/flattening-safety-verdict.yaml)
states.

## Give an assistant the whole AICR path

Start a fresh session with this checkout prepared and ordinary tool
approvals:

```text
Walk the four questions in docs/user/workshop-aicr-guide.md in order. For
each one, run the given command, save its output to its own file, and report
the actual exit code. Name object identities in full, including API version,
kind, namespace, and name. For question 1, compare your answer with
examples/aicr/eks-h100-training-kubeflow-v0-19-0/route-intent.yaml and run
npm run aicr-argocd-example:verify. For question 2, separate the recorded
confighub.com/origin annotation from the recipe-driven change before you
report a changed-object count, compare with data/aicr-version-diff/summary.md,
and run npm run aicr-version-diff:verify, reporting the exact printed line.
For question 3, read
examples/aicr/eks-h100-training-kubeflow-v0-20-0/route-intent.yaml and report
the source-variant-target-match route's status exactly as recorded; do not
report a match result that was not run. For
question 4, read the recipe's deploymentOrder and the nested-sources table
and report which components render their own CRDs. Do not run the aicr CLI
or any cub command beyond the ones this Guide names, and do not contact a
cluster, ConfigHub, or a registry. State every boundary each question lists
as not proven, and mark anything you did not run as not checked rather than
passing.
```

Read the report against this Guide rather than accepting it. An agent that
reports question 3 as "matched" or "fits" has invented a result the record
does not contain; the honest answer is that the fit check is recorded and not
run.

## Know what this Guide does not settle

Every answer above comes from reading composed wrapper objects and retained
comparisons. That is a local result. It is not a ConfigHub record, a
delivered change, or a live-cluster proof, whatever the object count or exit
code says.

All four retained entries carry a `flatten-with-routes` verdict: the exact
wrapper objects can be kept literally, but the component order, the nested
Helm sources, the accelerator-target fit, and the CRD and hook work inside
those sixteen sources are lifecycle work that has to travel beside them.
Resolving it once does not resolve it again after the recipe version, the
destination, or the delivery runtime changes; each flattening verdict names
its own recheck triggers.

The object counts and digests cited throughout this Guide are the committed
Catalog evidence for these entries:
[the v0.14.0 Argo CD BaseVariantRecord](../../data/base-variant-records/records/aicr-eks-h100-training-kubeflow-v0-14-0-argocd.yaml),
[the v0.19.0 record](../../data/base-variant-records/records/aicr-eks-h100-training-kubeflow-v0-19-0-argocd.yaml),
and
[the v0.20.0 record](../../data/base-variant-records/records/aicr-eks-h100-training-kubeflow-v0-20-0-argocd.yaml).
Collecting a real target snapshot, running the accelerator-fit comparison,
and watching Argo CD reconcile these objects and the sixteen charts they
reference on an actual EKS cluster are the pending trial this Guide does not
run. Missing coverage stays marked as not checked, here and everywhere else.
