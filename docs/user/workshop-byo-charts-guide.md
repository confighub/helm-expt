# Render your own chart to exact objects, adapt them as data, and keep them

You have a Helm chart or a values file that is not a Catalog entry. It might
be a chart your team maintains, a public chart with your own values, or
values an AI assistant wrote or changed for you. That last case is the normal
one this Guide is built for, not a special or risky one. An assistant that
proposes a values change is doing the same job a teammate does when they open
a pull request, and the four moves below are how you look at the result
before you rely on it, whoever or whatever wrote it.

This Guide walks four moves on your own chart and values. Render the chart to
the exact Kubernetes objects it produces and see what those objects need.
Compare two versions of your values or chart and see exactly what changed,
object by object and field by field, so an assistant's edit is a diff you can
read rather than a sentence you have to trust. When the chart has no field
for something you need, edit the rendered object directly instead of forking
the chart or writing a Kustomize overlay. Keep the reviewed objects with an
identity so the Argo CD or Flux you already run can keep delivering them
without re-templating the chart itself.

Every command through the third move runs on your machine with no ConfigHub
account and no cluster; the first move needs network access once, to pull
the chart. The fourth move is where an account first matters, and this Guide
says exactly where that starts. It works the same way read top to bottom by a
person, or run end to end by an AI assistant with you watching the result;
[jump to the assistant task](#give-an-assistant-the-whole-path) if that is
how you want to start. Complete the setup below first if this is your first
Guide.

The concrete example throughout is this repository's own bring-your-own
NGINX case: `bitnami/nginx` 24.0.2 with values an AI proposed, and the values
a person reviewed before keeping them. Run the same commands on your own
chart and values by swapping the chart reference, the values file, and the
namespace; the flag shapes stay the same.

## Set up the pinned tooling

You need Node.js, Git, and `cub` on your `PATH`. Install
[Node.js](https://nodejs.org/en/download), [Git](https://git-scm.com/downloads),
and the [cub CLI](https://docs.confighub.com/get-started/setup/#install-the-cli).
For the CLI version used in the retained local trials, choose the matching
[cub v0.4.4 release binary](https://github.com/confighub/sdk/releases/tag/v0.4.4).

Install the pinned Workshop plugin as described in the
[Adapt setup](./workshop-adapt-guide.md#prerequisites-and-setup). That gives
you `cub config check` and `cub config diff`, used in every move below.

You also need `cub helm template`, part of the separate `cub-helm` command
surface described in
[Direct Cub Helm Model](../reference/direct-cub-helm-model.md). It renders an
arbitrary chart locally, needs no ConfigHub server connection, and includes
CRDs unless you pass `--skip-crds`. The first render of a chart pulls it from
its repository, so that step needs network access; rereading a file you
already rendered does not.

No account, credentials, cluster, registry, or Docker is needed for the
first three moves. The fourth move names exactly where that changes.

## Check your agent the same way every time

Predicting the exit code and the one answering field before you run each
command is the same rule the skill states from the agent's side in
["Say What You Expect Before You Run It"](../../skills/config-workshop/SKILL.md#say-what-you-expect-before-you-run-it),
and the three moves in
[the Helm Guide's agent-checking section](./workshop-helm-questions-guide.md#check-your-agent-the-same-way-every-time)
apply here without change: make the agent cite full object identities
(`apps/v1|Deployment|nginx|nginx`, not "the Deployment"), compare its answer
with the retained file the move names, then run that move's command and read
the actual output before trusting the agent's summary of it.

One habit matters more here than elsewhere, because the values under review
may be the agent's own work. Ask it to name the exact object and field path
it changed, not the outcome it intended, then run the diff in move 2 and
check that its answer names the same objects the diff reports. An agent that
describes what it meant to do is not the same as one that can point at what
it actually did.

## 1. Render your chart and see what it needs

You have a chart and a values file, and you want the exact object list and
the destination prerequisites before you point either at a namespace.

**Why Helm does this.** A chart is a program that prints YAML, so its
structure exists only while it runs; a namespace, a Secret, or a role the
chart merely references never appears in that output at all. Rendering
first, then checking the render, is how you see both halves before anything
is created.

**Run it in this checkout.**

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, the object
count and the namespace `cub config check` reports as required). Run it. If
the result matches, the explanation stands. If it differs, the agent guessed;
read the real output before trusting it.

```sh
cub helm template nginx nginx --repo https://charts.bitnami.com/bitnami --version 24.0.2 --namespace nginx --values examples/byo-helm-values/reviewed-values.yaml --output-dir ./rendered
cub config check ./rendered
```

`cub config diff`, used in moves 2 and 3, compares two local files rather than
two directories, so keep a single merged copy of this render beside the
directory:

```sh
find ./rendered -name '*.yaml' | sort | xargs cat > ./rendered-nginx.yaml
```

**Read the result.** Expect exit `0`. The render produces 5 objects: a
Deployment, a NetworkPolicy, a PodDisruptionBudget, a Service, and a
ServiceAccount, all in the `nginx` namespace. None of the 5 is a Namespace
object, so `cub config check` reports `nginx` under the namespaces that must
already exist. The four lifecycle counters it reports for CRDs, Helm hooks,
setup Jobs, and admission webhooks needing a certificate are all zero for
this chart.

**Check the agent.** Ask it to name all 5 object identities and the required
namespace, then compare its answer with
[the retained review record](../../data/byo-helm-values-review/review.yaml),
which lists the same objects. `cub config check` reads object fields; it does
not read a values file the objects never mention. The reviewed values also
supply `extraEnvVarsSecret: ai-provider-credentials`, which the Deployment
consumes as an `envFrom` reference. That Secret is a declared target fact,
recorded in
[the retained source-and-intent record](../../data/config-workshop-command-contract/helm/promoted-workshop-result.json),
not a field `cub config check` can read out of the render, the same
distinction [the Timoni Guide draws](./workshop-timoni-guide.md#1-what-will-this-build-and-what-must-already-exist)
for a module's declared target facts.

**What this does not prove.** Reading the render establishes nothing about
your cluster. Admission control, defaulting, and API availability change
what is actually stored, and a chart that generates credentials or names on
every render adds a reproducibility question this check does not answer;
read the chart's own render behavior before trusting a second render to
match the first.

**Where it goes next.** Move 2 compares this render against another version
of the same chart's values. Move 4 keeps this exact render as governed data.

## 2. See exactly what your AI changed

You have two versions of your values or chart, one an AI proposed and one a
person reviewed, and you want the exact object and field changes between
them, not a description of what someone intended.

**Why Helm does this.** Helm keeps no durable, object-level explanation of
why a render looks the way it does, so an agent's summary of its own edit is
the only account you have unless you compare the two renders directly.
Comparing objects, not values files, also catches a change the chart itself
introduces in response to a value, which a values-file diff alone would
miss.

**Run it in this checkout**, using the two retained renders from this
repository's own bring-your-own NGINX example: the AI's original proposal
and the values a person reviewed before keeping them.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, which
objects changed and which stayed the same). Run it. If the result matches,
the explanation stands. If it differs, the agent guessed; read the real
output before trusting it.

```sh
cub config diff data/byo-helm-values-review/proposed-render.yaml data/byo-helm-values-review/reviewed-render.yaml --json --exit-code --out byo-values-diff.json
```

**Read the result.** Expect exit `1`, a finding rather than a failure: 5
objects on each side, 0 added, 0 removed, 2 changed, and 3 unchanged. The
changed objects are `apps/v1|Deployment|nginx|nginx` and
`v1|Service|nginx|nginx`; the `NetworkPolicy`, `PodDisruptionBudget`, and
`ServiceAccount` are untouched. Open `byo-values-diff.json` for the full
field list rather than trusting a summary of it. Two changes are worth
reading in full because they are not simple value swaps.
[The retained review](../../data/byo-helm-values-review/review.yaml) names
what each one is: the Service's `spec.type` moves from `LoadBalancer` to
`ClusterIP`, and on the Deployment, the literal `AI_API_KEY` environment
value is replaced by an `envFrom` reference to the existing
`ai-provider-credentials` Secret, which is a change to two different array
fields, not one. Restoring a read-only root filesystem on this chart also
adds an `initContainers` entry the proposed render never had, because the
chart itself adds a log-symlink step only when that setting is on; that is
the chart reacting to a value, not a value quietly doing nothing.

**Check the agent.** Require it to open the array-valued changes rather than
report "one field replaced," the same requirement
[the Helm Guide's question 10](./workshop-helm-questions-guide.md#10-ai-wrote-these-values-what-did-they-actually-change)
makes, because `cub config diff` compares an array as one whole value and
says so under its own `comparison` note. An agent that reports only the
`spec.type` change and misses the credential and image changes inside the
container array has answered the easy half of the diff.

**What this does not prove.** Comparing two local renders says nothing about
a live cluster, and `cub config diff` states its own boundary under
`notChecked` for schema validity and protected-field preservation. A clean
diff also is not an approval; it is the record an approval is made against.

**Where it goes next.** Run this same comparison on your own two versions
before you decide whether to keep either one. Move 4 shows how to keep the
version you accept with an identity that names exactly this comparison.

## 3. Adapt a field the chart does not expose

The chart offers no value for one field you need, and forking the chart or
maintaining a Kustomize overlay is more machinery than a single field is
worth.

**Why Helm does this.** A chart exposes only the values its authors chose.
A small local requirement that falls outside that set forces a fork or a
fragile overlay unless you treat the rendered object itself as the thing you
edit.

**Run it in this checkout.** Copy the merged render from move 1, so one copy
stays the untouched original:

```sh
cp ./rendered-nginx.yaml ./rendered-original.yaml
cp ./rendered-nginx.yaml ./rendered-adapted.yaml
```

Open `rendered-adapted.yaml` and add
`example.com/backup-policy: nightly` under
`spec.template.metadata.annotations` on the `nginx` Deployment document.
Change nothing else, then compare:

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, the
changed object count, expect 1). Run it. If the result matches, the
explanation stands. If it differs, the agent guessed; read the real output
before trusting it.

```sh
cub config diff rendered-original.yaml rendered-adapted.yaml --json --out backup-policy-diff.json
```

**Read the result.** Expect exit `0` with 1 changed object and the rest
unchanged. The one change is an `add` at
`/spec/template/metadata/annotations/example.com~1backup-policy` on the
Deployment, with the slash in the annotation key escaped as `~1` because the
path is a JSON pointer. A second changed field means your editor reformatted
something; start again from a fresh copy. The chart stays unchanged, which
is the point: you now hold an object-level change you can review instead of
a fork you have to maintain. This is the same technique
[question 4 of the Helm Guide](./workshop-helm-questions-guide.md#4-the-chart-does-not-expose-the-field-i-need-must-i-fork-it)
and the [field-restore Guide](./workshop-field-restore-guide.md) walk in
full, applied here to your own render instead of a catalog one.

**Check the agent.** Ask it to propose the smallest edit and name the object
it targets, then apply the same two tests
[the retained answer](../../data/ai-custom-field/summary.md) applies: the
target object must exist in the render, and the field must not already be
there, so the edit is a real addition rather than a no-op or a collision.

**What this does not prove.** Whether the chart truly exposes no equivalent
value is the premise, not something this diff checks; read the chart's
values schema before assuming there is no supported path. A later chart
version can replace the same object outright, silently dropping your edit,
which is the upgrade-overlap edge the field-restore Guide names.

**Where it goes next.** Keep the adapted render the same way move 4 keeps
any reviewed render, so the next chart version is compared against your edit
rather than rendered over it.

## 4. Keep the reviewed objects and let your existing GitOps deliver them

You have a render you have checked, diffed, and adapted, and you want to
keep it with an identity your team can reuse, without asking Argo CD or Flux
to stop running or your pipeline to re-template the chart on every sync.

**Why this needs an account.** The first three moves compare files on your
machine. Retaining a result with an identity, deriving a variant for another
environment, and previewing a promotion are managed operations, and this is
the one move in this Guide where that is true. `cub server install` runs
ConfigHub yourself, locally, in about twenty seconds, with no account signup
beyond that local server; a hosted organization works the same way if you
already have one.

**Run it in this checkout**, using the accepted object set from move 1.
Preview every mutating command before you run it for real.

```sh
cub server install
cub variant upload --dry-run --component byo-nginx-ai-values --variant reviewed --space byo-nginx-ai-values-24-0-2-reviewed --granularity minimal --annotation workshop.confighub.com/object-set-sha256=sha256:502d8c85470455fa4152f8d0abb9d1582552e830148e90335e9649cbfd42f397 ./rendered
```

**Read the result.** The dry run reports what `cub variant upload` would
retain without writing anything. Run the same command without `--dry-run`
when you are ready to keep the result, then bind the accepted identity so
the annotation travels with the Unit:

```sh
cub variant upload --component byo-nginx-ai-values --variant reviewed --space byo-nginx-ai-values-24-0-2-reviewed --granularity minimal --annotation workshop.confighub.com/object-set-sha256=sha256:502d8c85470455fa4152f8d0abb9d1582552e830148e90335e9649cbfd42f397 ./rendered
cub unit update byo-nginx-ai-values --space byo-nginx-ai-values-24-0-2-reviewed --annotation workshop.confighub.com/object-set-sha256=sha256:502d8c85470455fa4152f8d0abb9d1582552e830148e90335e9649cbfd42f397 --change-desc "Bind the accepted object set"
```

Derive a variant for another environment the same way, then preview a
promotion before running it:

```sh
cub variant create staging byo-nginx-ai-values-24-0-2-reviewed --space-pattern template:byo-nginx-ai-values-24-0-2-staging --environment Staging --unit-annotation workshop.confighub.com/object-set-sha256=sha256:502d8c85470455fa4152f8d0abb9d1582552e830148e90335e9649cbfd42f397
cub variant promote byo-nginx-ai-values-24-0-2-staging --dry-run -o mutations
```

[The retained promotion proof](../../data/config-workshop-command-contract/live-promotion.md)
shows what a preview like this reports for the same base: a later candidate
that moved replicas from 3 to 4 and added an `emptyDir` size limit showed up
in the mutation preview as exactly those two changes, with the stored data
and revision unchanged until the promotion itself was approved and run.

**Keep your existing delivery.** Nothing above asks Argo CD or Flux to stop
running. Point the controller you already operate at the reviewed OCI
artifact or the ConfigHub-backed path instead of re-templating the chart
yourself; this repository's own proof did exactly that; Argo CD delivered the
retained base and its staging promotion on separate throwaway kind clusters,
recorded in
[the first deployment receipt](../../data/byo-helm-values-deploy-proof/summary.md)
and
[the staging deployment receipt](../../data/byo-helm-values-staging-deploy-proof/summary.md).
Flux delivery of this exact example has not run. `cub release publish`
[requires a release target and its gates](../../data/config-workshop-command-contract/command-map.json)
before it runs, whichever controller you point at the result, and that
requirement is not something this Guide proves for you.

**What this does not prove.** `cub release publish` needs a release target
and its own checks and approvals before it runs; this Guide previews the
promotion mutation and stops there. The required `ai-provider-credentials`
Secret is supplied by the destination and is not part of what gets uploaded;
recheck it, and any other lifecycle-sensitive change, for every new
destination you point this at.

**Where it goes next.** Approve the promotion, publish the release when a
target and its gates are ready, and let your Argo or Flux reconcile the
result. Repeat move 2 whenever the source chart or values change again, so
the next AI-proposed edit gets the same read before it is kept.

## Give an assistant the whole path

Start a fresh session in this checkout with ordinary tool approvals:

```text
Walk the four moves in docs/user/workshop-byo-charts-guide.md in order, using
the bitnami/nginx example files this repository already retains
(examples/byo-helm-values/reviewed-values.yaml,
data/byo-helm-values-review/proposed-render.yaml, and
data/byo-helm-values-review/reviewed-render.yaml). For each move, run the
given command, save its output to its own file, and report the actual exit
code. Name object identities in full, including API version, kind,
namespace, and name. After move 2, open the full field list in the diff
output and report every changed path, not just the object names. After move
3, confirm the chart's rendered objects are otherwise unchanged. Preview
every mutating command in move 4 with its --dry-run flag first, and do not
run cub server install, cub variant upload without --dry-run, cub variant
create, cub variant promote without --dry-run, or cub release publish
without saying so and waiting for me to confirm. State every boundary each
move lists as not proven, and mark anything you did not run as not checked
rather than passing.
```

Read the report against this Guide rather than accepting it. A diff summary
that names one changed field when the record shows two array-valued changes
is the mistake most worth catching, and so is a mutating command run without
its dry-run preview first.

## Know what this Guide does not settle

Every answer above compares files on your machine, or, in move 4, previews
a managed operation without approving it. That is useful and it is not a
live-cluster proof.

Local comparison never establishes live behavior. Admission control,
defaulting, controllers, and API availability all change what a cluster
actually stores, which stays separate evidence in the
[verification lanes](./verification-lanes.md). The retained facts cited
throughout this Guide come from this repository's own bring-your-own NGINX
proof:
[the review record](../../data/byo-helm-values-review/review.yaml),
[the local check and OCI receipt](../../runs/byo-helm-values-proof/receipt.yaml),
and
[the promotion and delivery receipts](../../data/config-workshop-command-contract/live-promotion.md).
Running any of this against your own destination, watching the required
Secret actually resolve, and watching your own Argo CD or Flux reconcile the
result are the pending trial this Guide does not run. Missing coverage stays
marked as not checked, here and everywhere else.
