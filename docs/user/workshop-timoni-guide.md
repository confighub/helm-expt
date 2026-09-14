# Answer the questions Timoni users ask

A Timoni module is CUE compiled into Kubernetes objects. You pin an
immutable module by version and manifest digest, supply typed values, and
build the exact objects locally, with no cluster and no registry login for
the build step itself. The Workshop treats a Timoni entry the same way it
treats every other source: build the exact objects, check what they need,
keep the reviewed result, and carry its lifecycle routes with it rather than
losing them at the moment you flatten to plain YAML.

The Catalog holds two Timoni entries today. Redis 8.10.1 builds 7 objects.
Flux All-In-One 2.9.4-0 builds 21 objects, including 15 CustomResource-
Definitions. Both retained bases resolve from their listing first:
[site/listings/timoni-redis-8-10-1-default.json](../../site/listings/timoni-redis-8-10-1-default.json)
and
[site/listings/timoni-flux-aio-2-9-4-0-default.json](../../site/listings/timoni-flux-aio-2-9-4-0-default.json).
Read a listing before running anything; it names the pinned module, the
manifest digest, the object count, and the flattening verdict for that exact
entry.

This Guide answers five of the ten questions
[Answer the ten questions Helm users ask](./workshop-helm-questions-guide.md)
asks, in Timoni's own terms, and says plainly which five it does not answer
yet. Every command below runs on your machine. Building a module for the
first time needs network access to pull the pinned digest from its public
registry; reading the retained records and running their gates does not.

[Jump to the assistant task](#give-an-assistant-the-whole-timoni-path).
Complete the setup first if this is your first Guide.

## Set up the pinned tooling

Install the pinned Workshop plugin as described in the
[Adapt setup](./workshop-adapt-guide.md#prerequisites-and-setup). That gives
you the `cub-workshop` checkout this Guide calls the plugin checkout, and the
`cub config check` and `cub config diff` commands used below.

You also need the `timoni` CLI. The two retained entries were not built with
the same client version, and this Guide says which one each question needs:

| Entry | Built with | Source record |
| --- | --- | --- |
| Redis 8.10.1 | Timoni 0.33.0 | [source-lock.yaml](../../examples/timoni/redis-8-10-1/source-lock.yaml) |
| Flux All-In-One 2.9.4-0 | Timoni 0.34.0 | [source-lock.yaml](../../examples/timoni/flux-aio-2-9-4-0/source-lock.yaml) |

Run `timoni version` and confirm the `client:` line matches the entry you are
following before you build it. If you keep more than one Timoni binary
around, point `TIMONI_BIN` at the one you want; every generator script in
this repository reads that variable instead of assuming `timoni` on `PATH`.

Building either entry for the first time pulls the pinned module by digest
from `ghcr.io`, so that step needs network access. Reading a retained record,
hashing a committed file, or running a `--verify` or self-test script does
not; those commands only compare files already in this checkout.

## Check your agent the same way every time

Predicting the exit code and the one answering field before you run each
command is the same rule the skill states from the agent's side in
["Say What You Expect Before You Run It"](../../skills/config-workshop/SKILL.md#say-what-you-expect-before-you-run-it),
and the three moves in
[the Helm Guide's agent-checking section](./workshop-helm-questions-guide.md#check-your-agent-the-same-way-every-time)
apply here without change: make the agent cite full object identities
(`apps/v1|Deployment|redis|redis-replica`, not "the replica"), compare its
answer with the retained inventory or receipt file the question names, then
run that question's gate and confirm it rejects a wrong answer before you
trust that it accepts a right one.

One Timoni-specific habit sits beside those three. A typed CUE schema
rejects an unrecognized key or a wrongly typed value at build time, before
any object exists, so an agent that reports a silently ignored value should
be asked to reproduce the failure first. If the build did not fail, the
value was not simply dropped the way an unread Helm values key can be.

## 1. What will this build, and what must already exist?

Someone has a pinned Timoni module and wants the exact object list and the
destination prerequisites before choosing a namespace to point it at.

**Why Timoni does this.** The module's typed schema and its declared target
facts are two different things. The schema constrains what a value can be;
the target facts, recorded separately in the base's lifecycle record, say
what the destination must already provide. Building the objects answers the
first half of the question. The retained record answers the second half,
because a namespace or StorageClass a module merely assumes is never itself
one of the objects it builds.

**Run it in the plugin checkout**, using the Redis 8.10.1 entry.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, the object
count and the namespace `cub config check` reports as required). Run it. If
the result matches, the explanation stands. If it differs, the agent
guessed; read the real output before trusting it.

```sh
timoni -n redis build redis oci://ghcr.io/stefanprodan/modules/redis -v 8.10.1 -d sha256:7f24e8f7e49132c90789464dcf5b82eb137e378c97735eec36efbe0d1caeb872 -f examples/timoni/redis-8-10-1/selected-values.cue --mask-secrets > rendered-redis.yaml
cub config check ./rendered-redis.yaml
```

**Read the result.** Expect exit `0`. The build produces 7 objects: ConfigMap
x1, Deployment x2, PersistentVolumeClaim x1, Service x2, ServiceAccount x1.
None of the 7 is a Namespace object, so `cub config check` reports `redis`
under the namespaces that must already exist, the same way it reports
`kube-system` for the Helm metrics-server example. It does not report the
Kubernetes-version or StorageClass requirements, because those are declared
target facts, not object fields it can read out of the YAML. Those two live
in [the lifecycle route intent](../../examples/timoni/redis-8-10-1/lifecycle-route-intent.yaml):
Kubernetes 1.20.0 or newer, and a `standard` StorageClass for the default
persistent volume claim.

**Check the agent.** Ask it to name all 7 object identities and the required
namespace, then compare its answer with
[the retained object inventory](../../examples/timoni/redis-8-10-1/rendered/object-inventory.json),
which lists every identity in full. Then run the gate:

```sh
node scripts/generate-timoni-redis-pilot.mjs --verify
```

The command prints `verified Timoni Redis pilot (7 exact object(s))`. Unlike
the split verify-and-self-test pattern elsewhere in this repository, this one
command already exercises its self-tests inline: it rejects a duplicated
object identity, a wrong object count, rendered text that disagrees with the
inventory, and a lifecycle record whose declared namespace, StorageClass, or
Kubernetes-version requirement disagrees with what the objects actually use.

**What this does not prove.** Reading the objects and the lifecycle record
establishes nothing about a live cluster. The three destination facts are
recorded as `required-not-live-checked` in
[the BaseVariantRecord](../../data/base-variant-records/records/timoni-redis-8-10-1-default.yaml),
and Kubernetes schema validation, admission, apply, and workload health have
not been run for this entry.

**Where it goes next.** Retain the reviewed objects with the same command the
listing itself gives for making a variant:

```sh
cub variant upload --dry-run --component redis --variant default --space timoni-redis-8-10-1-default --granularity minimal --annotation workshop.confighub.com/object-set-sha256=sha256:10f21f387715146838bc531cba4ce921e8eca127b0ab69a065e4f66a2a146fc2 ./rendered
```

## 2. How does this build differ from another build, or from the module's defaults?

Someone has two values files for the same module and needs the exact object
change between them, not a guess from reading CUE.

**Why Timoni does this.** Timoni has no Helm-style release history to diff
against. Comparing two builds is how you see what one values choice changed,
the same way `cub config diff` compares two Helm renders in the Helm Guide's
question 2.

**Run it in the plugin checkout**, using the Redis entry's two retained
environment values files.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, the
changed object and the changed field). Run it. If the result matches, the
explanation stands. If it differs, the agent guessed; read the real output
before trusting it.

```sh
timoni -n redis build redis oci://ghcr.io/stefanprodan/modules/redis -v 8.10.1 -d sha256:7f24e8f7e49132c90789464dcf5b82eb137e378c97735eec36efbe0d1caeb872 -f examples/timoni/redis-8-10-1/environments/development.cue --mask-secrets > development.yaml
timoni -n redis build redis oci://ghcr.io/stefanprodan/modules/redis -v 8.10.1 -d sha256:7f24e8f7e49132c90789464dcf5b82eb137e378c97735eec36efbe0d1caeb872 -f examples/timoni/redis-8-10-1/environments/production.cue --mask-secrets > production.yaml
cub config diff development.yaml production.yaml --json --exit-code --out replica-diff.json
```

**Read the result.** Expect exit `1`, a finding rather than a failure: 7
objects on each side, 1 changed object, `apps/v1|Deployment|redis|redis-replica`,
with one changed field, `/spec/replicas` replaced from `1` to `2`. Every
other object is byte-for-byte identical, and the development build itself
reproduces the historical default output byte for byte.

**Check the agent.** Ask it to name the changed object and field, then
compare with
[the retained environment receipt](../../runs/timoni-redis-environments/receipt.json),
whose `expectedDelta` names the same path, before and after value. Run the
gate:

```sh
npm run timoni-redis:verify
npm run timoni-redis:self-test
```

`timoni-redis:verify` prints `verified Timoni Redis public OCI and ConfigHub
retention receipts`, checking the environment receipt among others.
`timoni-redis:self-test` prints `verified the Timoni Redis literal-configuration
OCI payload locally`; along the way it changes the container image inside the
production build and confirms the receipt check rejects that mutation, so a
real change hidden inside what looks like the same one-line replica bump does
not pass quietly.

**What this does not prove.** Comparing two local builds says nothing about a
live cluster. `cub config diff` compares arrays as whole values and states
its own boundary under `notChecked`, exactly as it does for the Helm Guide's
question 2.

**Where it goes next.** Retain whichever build you reviewed, using the same
`cub variant upload` pattern as question 1 with the matching object-set hash.

## 3. Which values are typed, and where does the schema constrain them?

Someone wants to know what a value is allowed to be before setting it, not
after a build fails or a field quietly stays at its default.

**Why Timoni does this.** A Timoni module ships a CUE schema instead of an
untyped values file. A value with the wrong shape, the wrong type, or a key
the schema does not declare is rejected when you build, not silently ignored
the way the Helm Guide's question 3 describes for an unread Helm values key.

**Run it anywhere with network access**, using the Redis module.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, whether
the fields it names as typed actually appear in the schema). Run it. If the
result matches, the explanation stands. If it differs, the agent guessed;
read the real output before trusting it.

```sh
timoni mod show config oci://ghcr.io/stefanprodan/modules/redis -v 8.10.1
```

**Read the result.** Expect exit `0` and the module's CUE schema as text. It
declares `maxmemory: *512 | int & >=64` (an integer, at least 64), `persistence:
{enabled: *true | bool, storageClass: *"standard" | string, size: *"8Gi" |
string}`, `image: {repository, tag, digest: *"sha256:becdda6c7f4b3fb42e42fd7f120bbf5c54c4caaaf16f26da24e4563d2c1f0576",
pullPolicy}`, and `test: {enabled: *false | bool}`, the field behind the
optional ping test the base's lifecycle route calls disabled by default.
Setting `test.enabled` to a string, or `maxmemory` to a value under 64, fails
the build before any object is produced.

**Check the agent.** Require it to point at the line in
[config-schema.cue](../../examples/timoni/redis-8-10-1/config-schema.cue) for
each field it names as typed, then hash the file and compare:

```sh
shasum -a 256 examples/timoni/redis-8-10-1/config-schema.cue
```

Expect `d29cd9857b78f3e593d16228bb45fdd9a6d41433efdc518528fc93f89fa5d4dc`,
matching `sourceSchema.sha256` in
[the generation receipt](../../examples/timoni/redis-8-10-1/generation-receipt.yaml).
A different hash means the fetched schema disagrees with the retained record,
and the disagreement needs to be resolved before either is trusted.

**What this does not prove.** A typed schema stops a wrongly shaped or
wrongly typed value. It does not stop a well-typed value that is
semantically wrong, such as a `maxmemory` setting that is valid CUE but too
small for the workload, and it validates nothing against a live cluster's
admission controllers.

**Where it goes next.** Keep the values file beside the module's pinned
version and digest; the check rung for a typed value is the same build used
in questions 1 and 2, not a separate step.

## 4. What lifecycle work must travel with the objects?

A GitOps operator has a module's exact objects and needs to know what order
they require and what a plain, unordered apply would miss.

**Why Timoni does this.** Both retained entries carry a `flatten-with-routes`
verdict: the exact objects can be kept literally, but ordering, waits, and
tests are lifecycle work that has to travel beside them.
[The processing model's Timoni row](../../skills/config-workshop/references/processing-model.md)
names exactly this: ordered apply sets, action annotations, waits, tests,
health checks, and prune behavior are what a source-format materialization
step is not allowed to drop.

**Run it in the plugin checkout**, using the Flux All-In-One entry.

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, the object
count, including how many are CustomResourceDefinitions). Run it. If the
result matches, the explanation stands. If it differs, the agent guessed;
read the real output before trusting it.

```sh
timoni -n flux-system build flux oci://ghcr.io/stefanprodan/modules/flux-aio -v 2.9.4-0 -d sha256:2fdfc00b5a1b59017f63ec0ab78be8b013fa7d542a57d6f1a6db4df64eab5a5a -f examples/timoni/flux-aio-2-9-4-0/selected-values.cue --mask-secrets > flux-aio.yaml
cub config check ./flux-aio.yaml
```

**Read the result.** Expect exit `0` and 21 objects: a Namespace, a
ResourceQuota, a ServiceAccount, a ClusterRole, a ClusterRoleBinding, one
controller Deployment, and 15 CustomResourceDefinitions. `cub config check`
counts the CRDs among the 21 objects because that is a plain object kind. It
cannot say that those 15 CRDs must become Established before any Flux custom
resource can be created, because that ordering is not a field on any object.
That is recorded separately, in
[the lifecycle route intent](../../examples/timoni/flux-aio-2-9-4-0/lifecycle-route-intent.yaml):
apply the CRDs before relying on controller reconciliation, then observe the
source, kustomize, helm, notification, and watcher controllers for
readiness. The smaller Redis entry carries its own ordering, master objects
first with a readiness wait, then the read-only replica, plus an optional
post-apply test disabled by default; both are recorded the same way, at a
much smaller scale.

**Check the agent.** Ask it to name both Flux routes and say who runs each
one. Both name `selected destination actor`, not Timoni and not ConfigHub,
because route resolution has not happened yet for this entry. Run the gate:

```sh
npm run timoni-flux-aio:verify
```

The command prints `verified Flux Timoni static proof: 21 objects, 15 CRDs;
manifest, layers, workflow and selected values bound`. It also runs
`scripts/test-timoni-flux-aio.mjs`, which mutates the retained manifest,
module layer, vendor layer, workflow file, module config file, selected
values, and rendered output in turn, plus swaps in a stub `timoni` binary
reporting a different client version, and confirms every one of those eight
mutations is rejected before it could reach the record.

**What this does not prove.** Retaining the CRD count and the route text is
not the same as watching those CRDs reach Established, or watching the five
named controllers report ready. Both remain destination-specific work the
record marks `not-run`.

**Where it goes next.** Resolve both routes for the destination you have
chosen before asking any controller to reconcile a Flux custom resource.
[The flattening verdict](../../examples/timoni/flux-aio-2-9-4-0/flattening-safety-verdict.yaml)
says to recheck this if the module version or manifest digest changes, if
controller enablement, persistence, security, or image values change, or if
the destination's Kubernetes version or controller policy changes.

## 5. Do the module version and manifest digest identify the same bytes?

A reviewer has a module reference and needs to know whether the retained
bytes actually match the digest that names them, not only whether the
version string looks right.

**Why Timoni does this.** An OCI tag like `redis:8.10.1` can in principle be
repointed at different bytes later, the same failure mode the Helm Guide's
question 9 describes for a chart repository reusing a version string. Both
retained Timoni entries build from an immutable manifest digest rather than
the tag alone, and the Flux All-In-One entry keeps the manifest and its two
content layers locally so the binding can be checked without a network call.

**Run it in the evidence checkout.**

**Predict first.** Before you run it, ask your agent what this will print:
the exit code, and the one field that answers the question (here, whether
each retained input still matches the digest that names it). Run it. If the
result matches, the explanation stands. If it differs, the agent guessed;
read the real output before trusting it.

```sh
node scripts/generate-timoni-flux-aio.mjs --verify
node scripts/test-timoni-flux-aio.mjs
```

**Read the result.** Expect exit `0` from both. The first reprints the same
`verified Flux Timoni static proof: 21 objects, 15 CRDs; manifest, layers,
workflow and selected values bound` line from question 4, because it is
checking the same bindings. The second prints `Flux static proof rejects
altered manifest, layers, workflow, schema source, values, output and
processor version` after altering each of those seven inputs in turn and
confirming the verifier throws every time, plus a client-version mismatch
that must be caught before a stale receipt is written.

**Check the agent.** Ask it which binding it would check first if asked
whether this module still looks the same, and require it to read the actual
digest values from
[source-lock.yaml](../../examples/timoni/flux-aio-2-9-4-0/source-lock.yaml)
rather than recite them from memory. The manifest digest is
`sha256:2fdfc00b5a1b59017f63ec0ab78be8b013fa7d542a57d6f1a6db4df64eab5a5a`; the
module and vendor content layers are pinned by their own separate digests in
the same file.

**What this does not prove.** This proves the retained bytes in this checkout
have not silently drifted from the digests recorded for them. It does not
prove that `ghcr.io/stefanprodan/modules/flux-aio` still serves those same
bytes at that tag today; that needs a fresh pull and a fresh digest
comparison, which is the live trial this Guide does not run. The Redis entry
records its manifest digest in the same way but does not retain local layer
copies, so only the Flux All-In-One entry can be checked this way offline
today.

**Where it goes next.** Name the manifest digest, not the version tag,
anywhere this module is referenced downstream. Recheck it after any source,
lifecycle-sensitive variant, destination, or delivery-runtime change, the
same recheck rule both flattening verdicts state.

## Where the ten Helm questions don't carry over

Five of the ten questions in
[the Helm Guide](./workshop-helm-questions-guide.md) have no grounded Timoni
answer in this repository yet, and this Guide says so rather than stretching
a command to fit.

- **The chart does not expose the field I need. Must I fork it?** No Timoni
  entry here has a custom-field edit retained the way question 4 of the Helm
  Guide retains one for Redis.
- **Can I upgrade this chart without breaking production?** Neither Timoni
  entry has a second pinned version recorded, so there is no retained
  before-and-after upgrade comparison to point at.
- **Where does this vulnerable image run, and how can I update it safely?**
  No fleet or blast-radius record exists for a Timoni source in this
  repository.
- **Can I roll back to exactly what ran before?** No rollback proof has been
  run for either Timoni entry.
- **AI wrote these values. What did they actually change?** No retained
  proposal-and-review pair exists for a Timoni values file the way one exists
  for Helm in question 10.

Question 3 above is the closest thing to an eleventh answer: it explains why
Helm's silently-ignored-value failure mostly does not reproduce for a typed
CUE field, rather than answering the same question a second way.

## Give an assistant the whole Timoni path

Start a fresh session with the plugin checkout prepared and ordinary tool
approvals:

```text
Walk the five questions in docs/user/workshop-timoni-guide.md in order. For
each one, run the given command, save its output to its own file, and report
the actual exit code. Name object identities in full, including API
version, kind, namespace and name. After each answer, compare it with the
retained file the question cites (object-inventory.json, the environment
receipt, config-schema.cue, the lifecycle-route-intent record, or
source-lock.yaml) and report any object or field you added or dropped. Then
run that question's verify and self-test commands and report both results
in full, including which specific mutation each self-test rejected. Do not
run any cub or timoni command beyond the ones this Guide names, and do not
contact a cluster, ConfigHub, or a registry beyond the one pull each build
needs. State every boundary each question lists as not proven, and mark
anything you did not run as not checked rather than passing.
```

Read the report against this Guide rather than accepting it. A passing gate
with no self-test result beside it is worth a second look, and so is a
boundary quietly dropped from the report, which is how a local build turns
into an approval nobody granted.

## Know what this Guide does not settle

Every answer above comes from a local build compared against retained bytes.
That build is a local result. It is not a ConfigHub record, a delivered
change, or a live-cluster proof, whatever the object count or exit code
says.

Both retained entries carry a `flatten-with-routes` verdict, and that verdict
means specifically that the lifecycle work named in questions 1 and 4 has to
be resolved for the destination you actually choose before any controller
reconciles the objects. Resolving it once does not resolve it again after
the module version, the manifest digest, a lifecycle-sensitive variant
field, the destination, or the delivery runtime changes; each flattening
verdict names its own recheck triggers.

The object counts, digests, and schema fields cited throughout this Guide
are the committed Catalog evidence for these two entries:
[the Redis BaseVariantRecord](../../data/base-variant-records/records/timoni-redis-8-10-1-default.yaml)
and
[the Flux All-In-One BaseVariantRecord](../../data/base-variant-records/records/timoni-flux-aio-2-9-4-0-default.yaml).
Running the commands above against a live destination, watching the CRDs
reach Established, and watching the five Flux controllers report ready are
the pending trial this Guide does not run. Missing coverage stays marked as
not checked, here and everywhere else.
