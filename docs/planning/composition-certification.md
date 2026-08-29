# Composition certification, the moat under custom stacks

This is a proposal, not a decision. It answers the one question that
[custom-stacks-and-apps.md](./custom-stacks-and-apps.md) names but does not solve.
That proposal says the value of a `cub stack` verb is the certify step, not the
component picker, "because composing components correctly is where the work is."
This brief says what that certify step actually checks, what already exists to
build it on, and how to prove it on real stacks before it becomes a headline.

It extends two lines that already exist. Item 30 of the
[certified bundle backlog](./certified-bundle-track-backlog.md) asks for a
composition digest so a consumer can verify a platform rather than a component.
Theme 6 of the same backlog asks the consumers, starting with eks-inference, to
replace their build-time guard with the receipt. This brief joins those into one
engine.

## The idea in one line

The certify step already exists three times at three strengths, and the four gates
it still needs are already designed. The moat is not new machinery. It is lifting
one composition verdict out of each private producer into the shared certifying
layer, keyed by the composition digest the producers already compute.

## The certify step exists three times already

Three producers each compose components into a running system, and each enforces a
different slice of the same job. Reading them together shows the whole shape.

| Producer | How it certifies a composition today | How strong |
| --- | --- | --- |
| **Kubara** | `generate-kubara-wiring.mjs` recovers a provides-and-needs graph from the rendered manifests, with a closed status vocabulary (`resolved-rendered`, `resolved-runtime`, `ambiguous`, `unresolved`, `optional-unprovided`, `target-prerequisite`, `external`). | It classifies. It labels an unmet or duplicated need and then downgrades it to an operator-attested target fact rather than failing. |
| **eks-inference** | A blocking `vet-placeholders` trigger refuses any release that still carries an unfilled `confighubplaceholder`, and a `PlatformProfile` owns each shared value once and fans it into consumers through `TransformPaths` links. | It gates one dimension, live. A value that was literal-copied into a second component instead of linked passes the gate unseen. |
| **AICR** | Bundle generation refuses a conflicting value and refuses to expose a profile-owned path as an install-time parameter (`aicr-composition-model.md:76`). | It refuses hardest, at build time, and is the rule the other two should adopt. |

The three are points on one spectrum. Kubara has the richest model of what needs
what and gates none of it. eks-inference gates the least and enforces it live.
AICR refuses the most and does it earliest. A composition verdict unifies the
model, the live enforcement, and the refusal into one gate set that all three run.

## What already exists to build on

The engine does not start from zero. Four pieces are reusable as they stand.

The per-component floor is done. Every component carries a `FlatteningSafetyVerdict`
keyed by chart, version, and audited base, over eleven quirk classes (helm-hooks,
resource-policy-keep, lookup, webhook-ca, capabilities-api-versions,
generated-secrets, crd-ordering, immutable-fields, namespace-creation,
subchart-conditions, test-hooks), and a `CertifiedBundleReceipt` with seven
sections. The strict verifier `verify-certified-bundle.mjs` re-hashes every file
and refuses a verdict that calls a class absent when its own render contains it.
A composition verdict takes these per-component verdicts as inputs and never
recomputes them.

The composition digest is done, inside each producer. Kubara computes
`platformDigest` as a hash over the source tree, topology, component packages, the
whole wiring plan, and the materialization contract, deliberately excluding
destination bindings so the same content yields the same digest in any
organization. It already refuses a republish, apply, or transition whose digest
does not match. AICR computes an equivalent `platformDigest` over source and member
set with a `--verify` recompute and a mutation self-test. This is a working "one
digest pins the platform" primitive to adopt, not invent.

The fact extractor is done. Kubara's wiring pass walks every rendered object,
emits a typed need for each reference (pod secret and config refs, ingress class
and issuer, external-secret store and keys, certificate issuer, RBAC subjects,
webhook and CRD-conversion services, a custom resource's requirement of its own
CRD), matches label selectors against rendered labels, and resolves each need
against a deduplicated provider index. It is deterministic and offline.

The live gate is done, once. eks-inference's `vet-placeholders` is a blocking
Validating trigger on the Mutation event. It proves the pattern that a composition
gate can refuse a release at the ConfigHub boundary rather than at build time.

## The composition verdict check set

Eight checks make up the verdict. Each states what it verifies across components,
what enforces it today, and whether it is genuinely new or a promotion of
something that already classifies or asserts. The first four gates match the four
that Kubara's composition strategy already names as planned. The last four come
from what eks-inference, AICR, and backlog item 30 add.

| # | Check | What it verifies across components | State today |
| --- | --- | --- | --- |
| 1 | **Closure** | Every need is met by exactly one enabled provider, or by one declared target fact. An unmet need fails. A duplicated provider fails. | Kubara labels `unresolved` and `ambiguous`, then downgrades both to target facts. eks-inference's placeholder gate is a partial closure check. The failing gate is prose in the strategy doc. |
| 2 | **Single owner** | Each shared value has one owner, and every consumer takes it through a link, never a literal copy. | eks-inference's profile links eight owners into twenty-seven paths, but a literal copy slips past the placeholder gate. AICR already refuses a conflicting value. New as a general check, with AICR's rule as the model. |
| 3 | **CRD and API-version compatibility** | Each custom resource's `apiVersion` is served by a CRD inside the composition at a compatible version. | Recorded as a need edge only. eks-inference hardcodes `capabilities-api-versions` and `immutable-fields` as not-evaluated. Genuinely new. |
| 4 | **Conflict** | No two components collide on a namespace, a name, a port, or an object they both own. | Nothing checks it in either stack. Both repositories record real collisions as hand-authored matrix departures. Genuinely new. |
| 5 | **Ordering** | CRD-before-CR and hook routes are computed as apply waves across the whole composition, including across planes. | Within-component routes exist and are marked unproven. Cross-plane ordering, such as the management plane going live before the workload plane, is prose. |
| 6 | **Parity** | Re-rendering each component reproduces its bundle, differing only at the declared wiring paths. | Per-component render parity exists as a gate. Composition-level parity is prose in the strategy doc. |
| 7 | **Policy** | Pluggable vet functions refuse a release that breaks a stated rule. | eks-inference's `vet-placeholders` is one live instance. Named as a gate, otherwise unbuilt. |
| 8 | **Digest binding** | The verdict and the member receipts are bound by the composition digest, and the verifier recomputes it and confirms every member receipt is present and hash-matches. | The digest is computed and verified inside each producer, rides the certified-bundle receipt off-schema, and the strict verifier never reads it. This is backlog item 30. |

Checks one through five and eight are cross-component. Six and seven inherit
per-component work and widen it to the set.

## The staged plan

The plan proves the engine on known-good stacks first, then hardens it against a
broken one, then hands it to a consumer. It never ships a picker before the
verdict is real.

Stage one builds the composition verdict producer and proves it on what already
works. The producer consumes the two artifacts that already exist, Kubara's wiring
graph and eks-inference's sandbox-proof receipt, and emits a `CompositionVerdict`
over the eight checks. It runs over the eks-inference stack of eight components
across three planes and over one Kubara platform of cert-manager, Traefik, and
metrics-server. Both are known-good, so most checks pass. The proof is that the
verdict goes red exactly where curation already caught a defect by hand. The Kubara
strategy doc already lists those defects. An undeclared cluster secret store is
referenced by three services. A metrics-server service monitor is shipped while its
monitor is disabled. An external-secrets component redundantly owns the default
namespace. In eks-inference, karpenter-aws hardcodes the cluster name that the
profile owns instead of linking it. A certify engine that cannot catch what
curation caught is not real, so catching these four is the acceptance test for
stage one. Stage one also closes item 30 by promoting `platformDigest` into the
receipt schema and teaching `verify-certified-bundle.mjs` to recompute it and
confirm the member set.

Stage two turns the four named gates from prose into code, hardest first. Closure
comes first and changes the Kubara behavior from downgrade to fail. Conflict comes
next because it is new and high value. CRD and API-version compatibility follows.
Parity and computed ordering waves come last because they extend existing
per-component work. Single owner adopts AICR's refuse-on-conflict rule across all
producers. Stage two proves itself on a third stack that is deliberately broken.
Injecting a namespace collision, a version skew, and an unfilled dependency must
drive the verdict red on each, one check at a time.

Stage three hands the verdict to a consumer. `cub stack` reads the composition
receipt and digest to install a stack by name. `sandbox` renders the whole stack
for free with no infrastructure, which keeps the anonymous first-look promise at
stack altitude. eks-inference retires its five-pattern grep guard and consumes the
receipt instead, which is Theme 6 item 42.

## The one sequencing rule

Build the verdict before the picker. A component picker with no real certify step
ships the composition problem to the user. Every composition carries a receipt
bound by its digest, and a composition that fails a check is refused with the
finding rather than shipped in silence. This is the same discipline the
per-component verdict already keeps, widened to the set.

## What to prove first

Prove that the verdict catches the four defects curation already caught, on the two
known-good stacks, before writing a line of consumer surface. If the engine holds
across eks-inference and one Kubara platform, and goes red on a deliberately broken
third stack, the self-serve flow rests on something real. If it does not, no picker
or verb is worth building yet.

## Where the assistant fits

A user brings their own AI, most often Claude, and wants it to make this one click.
The assistant has two jobs here, and the composition verdict is what makes both
safe to trust.

The first job is composing a candidate stack from a goal. A person says what they
want, and the assistant selects components from the catalog and proposes a stack.
An assistant can propose a plausible composition that is wrong, the same way it can
write a plausible chart that is wrong. The verdict is the answer. An
assistant-composed stack passes exactly the same eight checks as a curated one, so
its proposal is an input the engine validates rather than a result taken on faith.
This is the same wedge as turning one AI-produced chart into a trustworthy result,
one level up. The engine does not care whether a human or an assistant chose the
components. It cares only whether the composition passes.

The second job is being the interface across the whole surface. The person should
not have to type the commands or learn where one tool ends and the next begins. The
assistant reads the catalog, runs cub and its plugins, calls ConfigHub, and moves
through the Config Workshop as one seamless surface. It reads the verdict, explains
a red finding in plain language, installs the stack, publishes the release, and
helps govern the platform, while ConfigHub keeps the records of what was proposed,
what passed, and what was applied. Seamless here rests on the surface being legible
to a machine. Structured cub output, the committed catalog, and an agent skill
layer let the assistant read state and drive exact commands rather than guess at
them, which is the same discipline that lets the verdict be trusted. The one click
is the assistant carrying the person through the ladder the site already lays out,
not a new path around it.

One guardrail holds both jobs. The assistant composes and drives, and it never
certifies. The engine certifies, and custody stays with ConfigHub. The assistant
computes from today's bytes, and ConfigHub keeps the records. That boundary is what
lets a fallible assistant be trusted with a one-click install, because the gate,
not the assistant, is what says yes.

## Where this fits the tracks

This brief lifts the four gates out of Kubara's composition strategy, where they
are described for one producer, into the shared certifying layer, so eks-inference,
Kubara, and AICR are certified by one engine and one receipt. It closes backlog
item 30 and enables Theme 6 items 42 and 43. It pairs with
[custom-stacks-and-apps.md](./custom-stacks-and-apps.md) as the answer to that
proposal's open moat. Every claim it makes rests on committed evidence, which is
rule 10 of [the doctrine](../../tests/doctrine.md).

## Open questions

- Where the composition verdict producer lives. It reads a producer's wiring graph
  and the per-component receipts, so it can sit beside the certified bundle
  receipts in this repository, with each producer feeding it.
- Whether the verdict blocks or annotates at first. A blocking gate matches the
  doctrine, but a first cut that annotates and reports would let the four
  known-good defects be triaged before the gate is armed.
- Whether the assistant composes and certifies in one loop, proposing a stack,
  running the verdict, reading the red findings, and recomposing until it passes,
  or hands a single proposal to the gate. The tighter loop is more useful and asks
  more of the verdict's findings being legible to a machine.
