# Answer the ten questions Helm users ask

Ten questions cover most of what a Helm user decides before a chart reaches a
cluster. This Guide walks them as one known path. Each question names the Helm
behaviour underneath it, gives the exact local command that answers it, and
gives a check you run on your agent's answer before you accept it.

Work through it with an agent beside you. You and the agent use the same
interface, which is `cub` and the Workshop plugin, so every answer the agent
produces is one you can rerun yourself. The agent reads and explains, you
verify, and the committed evidence decides. That is the whole method.

Every command here runs on your machine, with no ConfigHub account and no
cluster. Two questions reach past what local files can settle, and those
questions say so instead of pretending otherwise.

The Workshop plugin used here is version `0.6.21`, source revision
`56e261a87dc3b060a86474bc796d379dd9bb7f3d`. Use that pin in the setup below.

[Jump to the assistant task](#give-an-assistant-the-whole-path).
Complete the setup first if this is your first Guide.

## Set up the two pinned checkouts

You need Node.js, Git, and `cub` on your `PATH`. Python 3 with PyYAML runs the
evidence gates. Cloning the two checkouts needs network access, and so does
question 9, which fetches a public chart archive. Everything else works
offline. No account, credentials, cluster, registry, or Docker is needed.

Missing a tool? Install [Node.js](https://nodejs.org/en/download),
[Git](https://git-scm.com/downloads), and the
[cub CLI](https://docs.confighub.com/get-started/setup/#install-the-cli). For
the CLI version used in the retained local trials, choose the matching
[cub v0.4.4 release binary](https://github.com/confighub/sdk/releases/tag/v0.4.4).

Choose one empty parent directory and put both checkouts in it side by side.
Two commands below hash a file across the pair, so the sibling layout keeps
their relative paths working.

Install the pinned Workshop plugin in that parent directory as described in the
[Adapt setup](./workshop-adapt-guide.md#prerequisites-and-setup). That gives you
a `cub-workshop` checkout, which this Guide calls the plugin checkout. Skip the
Adapt exercise itself.

Return to the parent directory, then obtain the pinned evidence checkout:

```sh
git clone https://github.com/confighub/helm-expt.git
cd helm-expt
git checkout ed7efffe485b582b41f8d48dc568c8b85492fb74
```

Keep both checkouts. Commands that render or compare configuration run in the
plugin checkout. Commands that verify a claim against retained evidence run in
the evidence checkout. Each question below says which one it needs.

One habit makes every trial repeatable. `cub config diff --out` refuses to
overwrite an existing file, so choose a new output name for each run and never
replace an earlier result.

## Check your agent the same way every time

An agent answers these questions quickly and reads a render more patiently than
a person does. It also states a wrong answer in the same confident voice as a
right one, which is why you check it. Use the same three moves every time.

1. **Make the agent cite object identities.** An answer that names
   `apps/v1|StatefulSet|redis|redis-master` can be checked. An answer that says
   "the Redis workload" cannot.
2. **Compare the answer with the retained facts file.** Every question below
   points at a committed `render-facts.yaml` or matrix that was derived from the
   same bytes. Read both and look for an object the agent added or dropped.
3. **Run the gate and its self-test.** The gate checks a recorded answer against
   the render. The self-test mutates that answer and confirms the gate rejects
   the mutation, so you learn whether the check has teeth before you rely on it.

The self-test is the move people skip. A gate that passes proves nothing until
you have watched it fail on a wrong answer.

Predicting the exit code and the one answering field before you run each
command is the first of these moves, and the skill's
["Say What You Expect Before You Run It"](../../skills/config-workshop/SKILL.md#say-what-you-expect-before-you-run-it)
section states the same rule from the agent's side.

## See how the fifteen pains sit beneath the ten questions

The ten questions are what people ask. The fifteen pain points are why they
have to ask. Each pain has an id, a status, and an evidence path in
[pain-points.csv](../../data/pain-point-coverage/pain-points.csv), explained in
[Helm Pain Points](./helm-pain-points.md) and summarised in the
[coverage report](../../data/pain-point-coverage/summary.md).

| Question | Pain ids beneath it |
| --- | --- |
| 1. What will this install, and what must already exist? | `go-templated-yaml`, `crd-handling`, `secrets` |
| 2. How is this candidate different from production? | `history-without-diffs`, `values-sprawl` |
| 3. I set a value. Why did the rendered object not change? | `values-sprawl`, `template-language-limits`, `field-level-governance` |
| 4. The chart does not expose the field I need. Must I fork it? | `fork-burden`, `template-language-limits` |
| 5. Can I upgrade this chart without breaking production? | `failed-upgrades`, `dry-run-reality-gap` |
| 6. How should Argo CD or Flux handle this chart's hooks and CRDs? | `hooks`, `crd-handling`, `gitops-mismatch` |
| 7. Where does this vulnerable image run, and how can I update it safely? | `multi-env-promotion`, `values-sprawl` |
| 8. Can I roll back to exactly what ran before? | `release-state-in-cluster`, `history-without-diffs` |
| 9. Do these version and digest records identify the same bytes? | `dependency-hell` is the nearest of the fifteen, and question 9 explains why |
| 10. AI wrote these values. What did they actually change? | `go-templated-yaml`, `field-level-governance`, `secrets` |

One root cause runs under most of them. Helm is a generator that turns one
chart and one values set into many objects, and the output no longer explains
which input produced which field. Recovering that explanation is what every
command below does.

The question order follows a review of 40 recent public Helm discussions
recorded on 2026-08-14, kept in
[configuration-questions.mjs](../../scripts/lib/configuration-questions.mjs).
That is a small research sample taken before outreach, not site usage data.

## 1. What will this install, and what must already exist?

A newcomer is about to run `helm install` on a chart nobody on the team has
read, and wants the object list and the prerequisites first.

**Why Helm does this.** A chart is a program that prints YAML, so its structure
exists only while it runs. Pain `go-templated-yaml` records that the structure
is discarded after render. The prerequisites are worse, because a namespace, a
Secret, or a cluster role the chart merely references never appears in the
output at all. Pain `secrets` covers the credential case. Pain `crd-handling`
covers a chart that ships CRDs, which this one does not, and the counter below
reports that either way.

**Run it in the plugin checkout.**

**Predict first.** Before you run it, ask your agent what this will print: the
exit code, and the one field that answers the question (here, the object
count). Run it. If the result matches, the explanation stands. If it differs,
the agent guessed; read the real output before trusting it.

```sh
cub config check metrics-server
```

**Read the result.** Expect exit `0`. The command reports 9 objects with their
kinds, reports `kube-system` under the namespaces that must already exist, and
reports four lifecycle counters for CRDs, Helm hooks, setup Jobs, and admission
webhooks needing a certificate. All four are zero for this chart.

**Check the agent.** Ask it what the render requires, then compare its answer
with [the retained facts](../../data/ai-install-shape/render-facts.yaml) and
[the worked answer](../../data/ai-install-shape/summary.md). The retained answer
names four prerequisites.

- The `kube-system` namespace is used but never created, so it must exist.
- The render registers an aggregated API, `v1beta1.metrics.k8s.io`, so the API
  aggregation layer must be available.
- Two roles the bindings reference are not created by the render.
- The installer needs permission to create cluster-scoped RBAC.

Then show that the plugin rendered the same bytes the evidence describes, and
run the gate. These four commands run in the evidence checkout.

```sh
shasum -a 256 ../cub-workshop/renders/metrics-server.yaml
shasum -a 256 data/adversarial10/charts/metrics-server-metrics-server-3.13.0/rendered/default.yaml
npm run ai-install-shape:verify
npm run ai-install-shape:self-test
```

Both hashes are
`22dc022aedee5c41c2eac80d4ff8b849a123931e9d3f2914b14951aec38b057e`, so the
plugin ships the render the evidence was derived from. The gate prints
`verified AI install-shape example` and the self-test prints
`ai install-shape self-test passed`. The self-test invents an object, invents a
Secret prerequisite, and drops a namespace prerequisite, and the gate rejects
all three. If a hash differs, keep both files and stop rather than reconciling
the numbers by hand.

**What this does not prove.** Reading a render establishes nothing about the
cluster. Admission control, defaulting, webhooks, and API availability change
what is stored, which is pain `dry-run-reality-gap`. A chart whose render is not
reproducible adds a second gap, so read its receipt. The metrics-server receipt
records `deterministicAcrossTwoLocalRenders: true`, while the Redis and
kube-prometheus-stack receipts record `false`, because those charts generate
credentials on every render.

**Where it goes next.** This is the check rung. Upload the reviewed object set
with `cub variant upload` when a team needs to share it.

## 2. How is this candidate different from production?

Someone holds two configurations and needs the few differences that matter,
not a text diff of two rendered files.

**Why Helm does this.** Helm records revisions without durable object-level
explanations, which is pain `history-without-diffs`. Chart defaults, values
files, globals, and subchart values then make the effective input hard to see
at all, which is pain `values-sprawl`. So the comparison has to happen on the
objects, after render.

**Run it in the evidence checkout.**

**Predict first.** Before you run it, ask your agent what this will print: the
exit code, and the one field that answers the question (here, the changed
pointers and object counts by category). Run it. If the result matches, the
explanation stands. If it differs, the agent guessed; read the real output
before trusting it.

```sh
cub config diff recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml --json --out redis-secret-diff.json
```

**Read the result.** Expect exit `0` and a JSON result with 14 objects before,
13 after, and a summary of 0 added, 1 removed, 2 changed, and 11 unchanged. The
removed object is `v1|Secret|redis|redis`. The two changed objects are the
`redis-master` and `redis-replicas` StatefulSets, each with two changed fields,
because they now read an existing Secret instead of the generated one. The
result also retains a `sha256` for each input file.

**Check the agent.** Ask the agent to classify every object as added, removed,
changed, or unchanged, then compare with
[the retained diff answer](../../data/ai-config-diff/summary.md). The mistake to
look for is a misclassification rather than a miscount, because reporting a
changed object as added reads as harmless and is not. Run the gate:

```sh
npm run ai-config-diff:verify
npm run ai-config-diff:self-test
```

The gate prints `verified AI config-diff example`. Its self-test invents an
added object, drops a removed object, and relabels an unchanged object as
changed.

**What this does not prove.** This compares two desired configurations. It says
nothing about the live cluster, and `cub config diff` names that boundary in its
own output under `notChecked`, along with Kubernetes schema validity and
protected-field preservation. Arrays are compared as whole values, so a
one-element change inside a list appears as one replacement of the list.

**Where it goes next.** Check, then upload both sides so the comparison has a
retained identity rather than living in a local file.

## 3. I set a value. Why did the rendered object not change?

Someone set a value, Helm accepted it without complaint, and the object looks
the same.

**Why Helm does this.** Helm accepts any values key, including one no template
reads, so a typo is silent. Pain `values-sprawl` covers the sprawl that hides
the real path. Pain `template-language-limits` covers helpers and conditionals
that consume a value without emitting it. Pain `field-level-governance` covers
the missing inverse, because the render does not say which input produced which
field.

**Run it in the plugin checkout.** Build the three fixture files from the
[values Guide](./workshop-values-guide.md), which is the controlled version of
this experiment. Then render the chart three ways and compare both candidates
against the baseline.

**Predict first.** Before you run it, ask your agent what this will print: the
exit code, and the one field that answers the question (here, the `equal`
field in each diff, true or false). Run it. If the result matches, the
explanation stands. If it differs, the agent guessed; read the real output
before trusting it.

```sh
helm template review values-review/chart --namespace workshop > values-review/baseline.yaml
helm template review values-review/chart --namespace workshop --set-string mesage=reviewed > values-review/typo.yaml
helm template review values-review/chart --namespace workshop --set-string message=reviewed > values-review/corrected.yaml
cub config diff values-review/baseline.yaml values-review/typo.yaml --json --out values-review/typo-diff.json
cub config diff values-review/baseline.yaml values-review/corrected.yaml --json --out values-review/corrected-diff.json
```

**Read the result.** All five commands exit `0`. The typo comparison reports
`equal: true` with one unchanged object. The corrected comparison reports one
changed object, ConfigMap `workshop/values-review`, with one replacement at
`/data/message`. The supplied literal `reviewed` does not appear in the output,
because the template uppercases it.

**Check the agent.** The failure mode here is a confident causal claim, so ask
the agent for its method rather than its conclusion. A useful answer names the
correct key, shows the with-and-without pair that demonstrates it, and refuses
to generalise from one fixture. Compare with
[the retained literal check](../../data/ai-ignored-values/summary.md), which
labels two supplied values effective and two ignored on a real Redis render, and
run its gate:

```sh
npm run ai-ignored-values:verify
npm run ai-ignored-values:self-test
```

The gate prints `verified AI ignored-values example`. Read that summary's own
limit section with the agent, because it states plainly that literal presence
is not causation.

**What this does not prove.** A literal search cannot settle influence in
either direction. A template can transform a value or branch on it without
emitting it, and the same literal can appear for an unrelated reason. Even a
clean with-and-without pair only establishes no observed effect for the inputs
you controlled, which is why the fixture pins the chart, dependencies, release
name, namespace, and capabilities.

**Where it goes next.** Fix the source key and rerun the check. Nothing is
uploaded from a diagnosis.

## 4. The chart does not expose the field I need. Must I fork it?

An application team needs one field on a rendered object, and the chart offers
no value for it.

**Why Helm does this.** A chart exposes the values its authors chose, so a small
local requirement can force a fork or a fragile overlay. That is pain
`fork-burden`, and pain `template-language-limits` explains why an extension
slot is not always a safe answer.

**Run it in the plugin checkout.** Write the render to a file, copy it, add the
one field to the copy, then compare:

```sh
cub config check redis --out redis-base.yaml
cp redis-base.yaml redis-annotated.yaml
```

Open `redis-annotated.yaml` and add `example.com/backup-policy: nightly` under
`spec.template.metadata.annotations` on the `redis-master` StatefulSet. Change
nothing else, then run:

**Predict first.** Before you run it, ask your agent what this will print: the
exit code, and the one field that answers the question (here, the changed
object count, expect 1). Run it. If the result matches, the explanation
stands. If it differs, the agent guessed; read the real output before
trusting it.

```sh
cub config diff redis-base.yaml redis-annotated.yaml --json --out custom-field-diff.json
```

**Read the result.** Expect exit `0` with 1 changed object and 13 unchanged. The
one change is an `add` at
`/spec/template/metadata/annotations/example.com~1backup-policy` on
`apps/v1|StatefulSet|redis|redis-master`, and the slash in the annotation key is
escaped as `~1` because the path is a JSON pointer. A second changed field means
your editor reformatted something, so start again from a fresh copy. The chart
stays unchanged, which is the point. You now hold an object-level change you can
review, rather than a fork you have to maintain.

**Check the agent.** Ask the agent to propose the smallest edit and to name the
object it targets. Then apply the two tests the
[retained answer](../../data/ai-custom-field/summary.md) applies. The target
object must exist in the render, and the field must not already be there, so the
edit is a real addition rather than a no-op or a collision. Run the gate:

```sh
npm run ai-custom-field:verify
npm run ai-custom-field:self-test
```

The gate prints `verified AI custom-field example`. Its self-test targets a
missing object and adds a field the render already carries, and the gate
rejects both.

**What this does not prove.** Whether the chart truly exposes no value for the
field is the premise, not a result, because that needs the chart's values
schema. The retained proof says so. Upgrade overlap is the other open edge. A
later chart change to the same object has to be detected rather than silently
lost, and the [field-restore Guide](./workshop-field-restore-guide.md) shows
how an object replacement surfaces in that comparison.

**Where it goes next.** Upload the base, then keep the edit as a derived
variant with `cub variant create` so the next chart version is compared against
it rather than over it.

## 5. Can I upgrade this chart without breaking production?

An application team has a new chart version and a running production release.

**Why Helm does this.** Helm's upgrade path merges old and new state, and a
failed or interrupted upgrade can leave the release wedged. That is pain
`failed-upgrades`. Pain `dry-run-reality-gap` explains why a clean render is not
a clean upgrade.

**Run it in the evidence checkout.**

**Predict first.** Before you run it, ask your agent what this will print: the
exit code, and the one field that answers the question (here, the counts of
added, removed, changed, and unchanged objects). Run it. If the result
matches, the explanation stands. If it differs, the agent guessed; read the
real output before trusting it.

```sh
cub config diff recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml recipes/bitnami/redis/27.0.0/revisions/default/r001/rendered/release-objects.yaml --json --out upgrade-comparison.json
```

**Read the result.** Expect exit `0`, with 14 objects on each side and a summary
of 0 added, 0 removed, 14 changed, and 0 unchanged. Every object changes and no
object disappears. Both StatefulSets carry five changed fields; the other twelve
objects carry two or three each, mostly version metadata.

**Check the agent.** Ask the agent for the breaking signals, which are removed
objects, changed immutable fields such as a selector, service name, or volume
claim template, and changed container images. Compare with
[the retained verdict](../../data/ai-upgrade-risk/summary.md), which is `low`
because none of the three signals fires. Then run the gate:

```sh
npm run ai-upgrade-risk:verify
npm run ai-upgrade-risk:self-test
```

The gate prints `verified AI upgrade-risk example`. Its self-test invents an
immutable change, invents a removed object, and flips the verdict. A low verdict
that an agent inflates to elevated is also a wrong answer, and the gate catches
that direction too.

**What this does not prove.** Object comparison cannot see an in-application
data migration, and a low verdict is not production approval. The live evidence
for this exact pair is the
[Redis upgrade and rollback proof](../../data/redis-upgrade-app-proof/summary.md),
which reconciled the upgrade on two Argo CD clusters without recreation. The
[upgrade Guide](./workshop-upgrade-guide.md) turns this comparison into a review
packet that keeps the missing evidence visible.

**Where it goes next.** Check, upload, then release and promote through one
limited environment before the rest.

## 6. How should Argo CD or Flux handle this chart's hooks and CRDs?

A GitOps operator has to place a chart's setup work into sync waves or
dependencies, and needs to know what that work is.

**Why Helm does this.** Helm hooks depend on phase, ordering, cluster state, and
delete policy, none of which is plain desired YAML. That is pain `hooks`. Helm
also installs CRDs specially and does not upgrade them cleanly, which is pain
`crd-handling`. A controller that applies or re-renders under its own context
adds pain `gitops-mismatch`.

**Run it in the plugin checkout.**

**Predict first.** Before you run it, ask your agent what this will print: the
exit code, and the one field that answers the question (here, the lifecycle
counters for CRDs, hooks, jobs, and webhooks). Run it. If the result matches,
the explanation stands. If it differs, the agent guessed; read the real
output before trusting it.

```sh
cub config check kube-prometheus-stack
```

**Read the result.** Expect exit `0` and 124 objects. The lifecycle counters
report 10 CRDs, 0 Helm hooks, 0 setup Jobs, and 2 admission webhooks needing a
certificate. The CRD and webhook lines are marked as notes rather than passes,
because both need work around ordinary apply.

**Check the agent.** Ask the agent to order the work and to say who performs
each step. The [retained answer](../../data/ai-lifecycle-work/summary.md) sets
the standard it has to meet.

- 10 CRDs go first and must become Established before any custom resource, or
  the custom resources fail to apply.
- 50 custom resources follow them, counted as 1 Alertmanager, 1 Prometheus, 35
  PrometheusRule, and 13 ServiceMonitor.
- 2 admission webhooks ship an empty `caBundle`, so a controller or cert-manager
  must fill it before either webhook can admit anything.

Verify the render and run the gate.

```sh
shasum -a 256 ../cub-workshop/renders/kube-prometheus-stack.yaml
npm run ai-lifecycle-work:verify
npm run ai-lifecycle-work:self-test
```

The hash is
`a9df6a24768af1e03b22e6a3b5a6ebd0873fe3e7fbae43c6113b24fe4311b238`, matching
`data/adversarial10/charts/prometheus-community-kube-prometheus-stack-85.3.3/rendered/default.yaml`.
The gate prints `verified AI lifecycle-work example`, and its self-test invents
a CRD, gets a custom-resource count wrong, and invents a Helm hook.

**What this does not prove.** Reading objects reports the lifecycle work
present in a render, not the runtime behaviour of applying it. This render
carries no Helm hooks, so it teaches CRD ordering rather than hook execution.
The [lifecycle Guide](./workshop-lifecycle-guide.md) renders a hook fixture with
and without `--no-hooks` and shows that rendering a hook Job never runs it. The
[hook lifecycle data](../../data/hook-lifecycle/summary.md) records which
routes have been observed and which remain doctrine.

**Where it goes next.** Check, then release through the controller you already
run. A route needs an owner and an order before delivery, not after.

## 7. Where does this vulnerable image run, and how can I update it safely?

A platform SRE has an image to replace and needs every environment it reaches
before changing anything.

**Why Helm does this.** Helm values files give no durable variant model and no
promotion record, so the estate lives in copied files. That is pain
`multi-env-promotion`, compounded by pain `values-sprawl` when an environment
pins its own override.

**Run it in the plugin checkout.** A fleet manifest expands placements locally,
without touching a server:

**Predict first.** Before you run it, ask your agent what this will print: the
exit code, and the one field that answers the question (here, the placement
count after expanding stacks). Run it. If the result matches, the explanation
stands. If it differs, the agent guessed; read the real output before
trusting it.

```sh
cub fleet plan demo-platform
```

**Read the result.** Expect exit `0`. The header reports 2 clusters and 6
placements after expanding stacks, because the manifest places one five-part
stack on both clusters and one app on `demo-dev` alone. Each following
line names a component, its cluster count, and the image digest or path it comes
from, and the last line says this is a dry run. That answers where a component
is placed. It does not answer which environments an image change reaches, which
needs the recorded overrides.

**Check the agent.** Read
[the blast-radius matrix](../../data/blast-radius-fleet/matrix.csv) with the
agent and make it answer per environment. For `image.digest` on Redis 25.5.3,
the change propagates to `dev`, `prod-us-east`, and `staging`, two objects each,
and is shielded in `prod-eu-west` by an override that pins the digest there.
The [retained answer](../../data/ai-fleet-image/summary.md) explains why the
shielded environment is the trap. Run the gate:

```sh
npm run ai-fleet-image:verify
npm run ai-fleet-image:self-test
```

The gate prints `verified AI fleet-image example`. Its self-test calls a
shielded environment reachable, gets an affected-object list wrong, and drops an
environment entirely. Dropping an environment is the failure that matters,
because a missing row reads as a clean answer.

**What this does not prove.** This is the weakest local rung of the ten. The
matrix is a recorded desired-configuration inventory, not a scan of a live
cluster or registry, and no local command computes it from your own estate.
Scoping a real change needs ConfigHub or another complete inventory, which the
pain row for `multi-env-promotion` records as `partial`.

**Where it goes next.** Upload, release, then promote in waves. The shielded
environment needs its own deliberate change.

## 8. Can I roll back to exactly what ran before?

An operator wants the previous objects back, not a fresh render of the previous
version string.

**Why Helm does this.** Helm keeps release history as cluster state in Secrets,
which is pain `release-state-in-cluster`, and that history records revisions
without durable object-level explanations, which is pain
`history-without-diffs`. A version label and a re-render are not the same thing
as retained bytes.

**Run it in the evidence checkout.** Hash a retained render, then read what the
receipt for that chart version recorded.

**Predict first.** Before you run it, ask your agent what this will print: the
exit code, and the one field that answers the question (here, whether the two
hashes match). Run it. If the result matches, the explanation stands. If it
differs, the agent guessed; read the real output before trusting it.

```sh
shasum -a 256 recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml
grep -n "firstRenderSHA256" data/adversarial10/charts/bitnami-redis-25.5.3/render-receipt.yaml
```

**Read the result.** Both commands exit `0`. The recipe render hashes to
`175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e`. The
receipt's recorded hash,
`811d26533430a0f9adb6296bffb1c819a50a7ad8635f5b9b29ed694dbce178ae`, belongs to a
different render profile of the same chart version, and the same receipt records
`deterministicAcrossTwoLocalRenders: false`. Two hashes for one chart version is
the lesson, not an error. Rollback has to name a retained object set, because
the version string does not identify one.

**Check the agent.** Ask the agent what it would restore and require it to name
the retained revision or digest. Compare with
[the retained rollback answer](../../data/ai-rollback-history/summary.md), where
a change set restored 14 units to revision 4, moved the chart from 27.0.0 back
to 25.5.3, and left 1 unchanged unit alone. Run the gate:

```sh
npm run ai-rollback-history:verify
npm run ai-rollback-history:self-test
```

The gate prints `verified AI rollback-history example`. Its self-test uses a
wrong target version, a wrong restored count, and a wrong change set. Reject any
agent answer that offers a re-render as history.

**What this does not prove.** Restoring objects does not reverse database data
or an irreversible migration, and the retained proof says so in its own limit.
The live evidence is the
[Redis upgrade and rollback proof](../../data/redis-upgrade-app-proof/summary.md),
which published the restored configuration as its own OCI artifact and
reconciled both clusters back to chart 25.5.3. That ran under ConfigHub with
Argo CD, so it is not something the local rung establishes.

**Where it goes next.** Release by digest, and keep the prior digest. External
state needs its own recovery plan alongside the object rollback.

## 9. Do these version and digest records identify the same bytes?

A reviewer has two records naming one chart version and needs to know whether
they describe the same artifact.

**Why Helm does this.** A chart repository serves a version string, and nothing
stops a publisher reusing it for different bytes. The fifteen pain points do not
name upstream version reuse directly. The nearest is pain `dependency-hell`,
whose answer is the recorded source and dependency locks. This is the one
question whose pain layer sits outside the fifteen, and saying so is better than
stretching a row to fit it.

**Run it anywhere with network access.** Fetch the archive and hash it.

**Predict first.** Before you run it, ask your agent what this will print: the
exit code, and the one field that answers the question (here, the digest of
the fetched archive). Run it. If the result matches, the explanation stands.
If it differs, the agent guessed; read the real output before trusting it.

```sh
helm pull goldilocks --repo https://charts.fairwinds.com/stable --version 10.3.0
shasum -a 256 goldilocks-10.3.0.tgz
```

**Read the result.** Expect exit `0`. The
[upstream drift record](../../data/upstream-drift/summary.md) expects
`3e51ce8032b0217d667b7e9084d36c76262b4ea566151f8fa47d422cbbd475db` from the
publisher, while the recipe locks
`9498a6f49cdea77f8777e9f8640a7711c63644fd1d5f7c8c81c313902190f2fd`. Two digests
for one version string means the digest identifies the bytes and the version
does not. A third value means the publisher has moved again, which is a finding
worth keeping rather than a failure.

**Check the agent.** Ask the agent whether the records describe the same bytes
and make it show both digests. Compare with
[the retained drift answer](../../data/ai-supply-drift/summary.md), whose
decision is `retained-exact`, meaning the catalog keeps the bytes it locked
because every proof it holds was produced from them. Run the gate:

```sh
npm run ai-supply-drift:verify
npm run ai-supply-drift:self-test
```

The gate prints `verified AI supply-drift example`. Its self-test calls the two
digests the same bytes and changes the retained digest.

**What this does not prove.** The committed record compares digests already
fetched and hashed on a recorded date. It does not prove what a registry serves
you now, which is exactly why you run `helm pull` and hash it yourself. Two
charts are recorded as republished, so this is a real behaviour with a small
recorded sample rather than a survey.

**Where it goes next.** Pin the digest, not the version, wherever the reviewed
input is named. `cub config verify` re-hashes a published OCI bundle against its
receipt when the reviewed input has been published that way.

## 10. AI wrote these values. What did they actually change?

Someone has a candidate an agent produced and wants the exact object changes
before it goes anywhere.

**Why Helm does this.** An agent edits values or objects, and the render loses
which input produced which field, which is pain `go-templated-yaml` and pain
`field-level-governance`. Pain `secrets` is the one that bites, because a
credential can sit in a candidate as a placeholder and still render cleanly.

**Run it in the evidence checkout.**

**Predict first.** Before you run it, ask your agent what this will print: the
exit code, and the one field that answers the question (here, the changed
object count and the changed field count). Run it. If the result matches, the
explanation stands. If it differs, the agent guessed; read the real output
before trusting it.

```sh
cub config diff data/ai-change-review/proposal.yaml data/ai-change-review/reviewed.yaml --json --out ai-values-diff.json
```

**Read the result.** Expect exit `0`, one changed object, and two changed
fields. The first is `/spec/mlPolicy/numNodes`, replaced from `8` to `4`. The
second is `/spec/template/spec/replicatedJobs`, reported as one replacement of
the whole array. That second line is the lesson. The image swap and the
credential both live inside that array, and the summary does not itemise them,
because `cub config diff` compares arrays as whole values and says so in its
own `comparison` note.

**Check the agent.** Require the agent to open the replaced array and name what
changed inside it. The
[retained change review](../../data/ai-change-review/summary.md) names three
things the unchecked proposal did, which are asking for more nodes than the
recorded target allows, replacing a digest-pinned image with a mutable tag, and
leaving the API key as an unfilled placeholder. An agent that reports "one array
replaced" has answered the diff and not the question. Run the gate:

```sh
npm run ai-change-review:verify
npm run ai-change-review:self-test
```

The gate prints `verified AI change review example`. Watch what the reviewed
candidate does with the credential. It reads the key from an existing Secret
instead of carrying a placeholder, and that is the change a human should insist
on.

**What this does not prove.** The local receipt stops before ConfigHub, so no
approval boundary is exercised here. The proposal and the reviewed candidate are
a deterministic example rather than a transcript from a named model. The
[command contract](../../data/config-workshop-command-contract/summary.md)
records the rest of the path, including the accepted object-set hash and the
promotion preview, and marks which stages have actually run.

**Where it goes next.** Check, upload, release, promote, then govern. An
agent-authored change is made safe by the gate saying yes, not by the agent
sounding confident.

## Give an assistant the whole path

Start a fresh session with both checkouts prepared and ordinary tool approvals:

```text
Walk the ten Helm questions in docs/user/workshop-helm-questions-guide.md in
order. For each one, run the given command, save its output to its own file,
and report the actual exit code. Name object identities in full, including
API version, kind, namespace and name. After each answer, compare it with the
retained facts file the question cites and report any object you added or
dropped. Then run that question's verify and self-test scripts and report both
results. Do not repair an input to make a comparison look clean, and do not
present a re-render as history. State every boundary the question lists as not
proven, and mark anything you did not run as not checked rather than passing.
Do not contact a cluster, ConfigHub or a registry, publish, approve, apply or
deploy anything. Question 9 fetches one public chart archive and hashes it;
keep the archive and its hash.
```

Read the report against this Guide rather than accepting it. Two failures are
worth looking for. The first is a passing gate with no self-test beside it. The
second is a boundary quietly dropped, which is how a local comparison turns into
an approval nobody granted.

## Follow one answer up the ladder

Each answer sits on a rung, and the rungs need progressively more than your
laptop.

| Rung | What it does | The command | What it needs |
| --- | --- | --- | --- |
| check | Read the exact objects and the work around them. | `cub config check`, `cub config diff` | Your machine. |
| upload | Retain the reviewed object set with an identity. | `cub variant upload` | A ConfigHub organization. |
| release | Publish the reviewed release by digest. | `cub release publish` | A release target and its gates. |
| promote | Move the reviewed change to the next environment. | `cub variant promote` | A derived variant per environment. |
| govern | Approve, gate, and compare desired against live. | ConfigHub approvals and observation | An account, and a cluster for live comparison. |

Questions 1, 2, 3, 4, 9, and 10 are answered at the check rung. Questions 5, 7,
and 8 start there and finish above it. Question 6 is answered at check and
delivered by the controller you already run. The
[command contract](../../data/config-workshop-command-contract/summary.md) holds
the exact commands for the upper rungs, with the status of each stage.

## Know what this Guide does not settle

Every question above answers from retained bytes. That is the strength and the
limit at the same time.

Local comparison never establishes live behaviour. Admission control,
defaulting, controllers, webhooks, and API availability all change what a
cluster stores, which the
[verification lanes](./verification-lanes.md) keep as separate evidence. A
green comparison reports a comparison and approves nothing.

Two questions are honestly weaker than the other eight. Question 7 has no local
command that computes blast radius from your own estate, so it reads a recorded
matrix. Question 8 verifies retained bytes locally, while the rollback that
actually ran needed ConfigHub and Argo CD. Both say so in place.

Coverage per pain point, with its current status and remaining gap, is in the
[coverage report](../../data/pain-point-coverage/summary.md). What the project
refuses to claim at all is in
[What We Refuse To Claim](./what-we-refuse-to-claim.md). Missing coverage stays
marked as not checked, here and everywhere else.
