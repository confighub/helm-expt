EXPERIMENTAL

# Brief: one contract for every catalog entry

The catalog's doctrine grew in layers. The early questions were about Helm
quirks and Helm pain. Then came delivery and packaging, OCI as the single
transport, installer packages, per-chart pages, ConfigHub variants and
promotion. Most recently came flattening-safety verdicts, certified bundles,
and the register discipline. Each layer wrote down what it needed. No layer
wrote down what an entry owes in total.

This brief asks whether all of it can be restated as one contract that applies
to every entry, past and future. The answer is yes, with two additions the
current doctrine does not have and one honest correction about how well the
existing mechanism works.

Every number here was measured against the tree, not quoted from an earlier
document. Several earlier figures, including some in issue #1375, were counted
at the wrong paths and are corrected below.

## What the doctrine already says well

Four passages are worth keeping word for word.

`docs/reference/config-catalog-doctrine.md:186` states the shape of the whole
answer:

> Every real base must also state whether those surrounding records are complete:
> lifecycle work is either attached, explicitly unnecessary, or an actionable gap;
> target prerequisites are either declared, explicitly unnecessary, or an actionable gap;

and closes at `:198` with the sentence that turns a taxonomy into a contract:

> Missing information must not be presented as "nothing required."

`docs/reference/config-catalog-doctrine.md:384` forbids the inference that
makes silence look like a decision:

> It does not infer that a chart needs no route when none has been written.

`tests/doctrine.md:7` defines what an incomplete proof is:

> every proof must follow them, and a proof that skips one is incomplete, not just smaller.

`tests/doctrine.md:56` names the outcomes and forbids silence:

> Never silent — every outcome is named.

## The correction that has to come first

The three-state rule is already implemented for two obligations, in
`scripts/verify-helm-render-intent-contracts.mjs`, over 199 render intents,
inside `npm run verify`. It looks like the model to generalise. Measured, it is
weaker than it looks.

The lifecycle state is `no-route-required` on **184 of 199** records. All 184
carry one identical reason, generated unconditionally at
`scripts/generate-helm-render-intents.mjs:607`:

> The current catalog record has no source hook or separate lifecycle step for this base.

Zero of the 184 carry evidence. Zero carry a next action. That is inference from
absence written into a field, which is exactly what `config-catalog-doctrine.md:384`
forbids. The declaration exists; the decision does not.

The target-facts state has the opposite problem. The contract requires a
`declarationSource` before it accepts `no-target-facts-required`, which is the
right rule. **No record is in that state**, so the guard has never fired on a
real entry. The states in use are 132 actionable gaps and 67 attached.

So the mechanism to generalise is the *rule*, not its current implementation. A
generated default is not a declaration, and a guard with no subjects is not
evidence that a guard works.

## The contract

> Every catalog entry declares, for each obligation on its kind's list, one of
> three states. **Attached** names the record and its evidence path. **Explicitly
> unnecessary** names the source of the decision, never a generated default.
> **Actionable gap** names the next action. Silence is not a state. A lane
> enumerates entries directly, so an entry that declares nothing fails rather
> than disappearing. Any exception is a dated register entry that fails both
> when a subject is undeclared and when a declaration stops being true.

Two axes have to be added, because presence alone cannot express what the
recent work discovered.

**Permission**, from issue #1392. Some obligations are not merely optional, they
are forbidden. A `do-not-flatten` entry must never carry a certified bundle. An
auditor who sees 16 bundle receipts against 139 entries and concludes 123 are
missing has read a presence-only contract correctly and reached a false
conclusion. So each obligation is `required`, `permitted`, or `forbidden` for a
given entry, keyed on a decided lane, and the presence states apply only where
it is required or permitted.

**Limits**, from issue #1393. Each obligation states what its evidence does not
prove. The doctrine already has this instinct at `tests/doctrine.md:12`, where
render parity never proves a quirk. Generalised, it means a certified bundle
receipt says plainly that it covers packaging rather than runtime health, and a
route declaration says plainly that it is a declaration rather than an
execution.

## Are target facts needed for every route?

No, and the contract must not couple them. They are separate obligations that
meet at one point.

Of **53** recorded routes in `data/lifecycle-routes/routes.csv`, **4** are in
the `target-facts` quirk class. The rest are hook phases (23), delete policies
(8), CRD installs (5), hook tests (4), webhook readiness (4), weight ordering
(4), and one per-target hook. None of those requires a target fact.

Where they meet is as one option among several. `data/lifecycle-routes/contract.md:125`
offers `target-facts-or-preflight` as a way to satisfy a hook-phase
prerequisite, and `:137` offers `preflight-or-presync` as an alternative to a
target fact. A target fact is a mechanism a route may use to discharge a
prerequisite, not a thing every route owes.

The reverse is also common. **56** render intents have target facts attached
with no route at all, because needing a Secret or a namespace before apply says
nothing about needing a lifecycle action.

So the entry list carries both obligations independently, and a route
additionally records which mechanism discharges it.

## What an entry owes, by kind

| Obligation | Chart entry | Platform shape | Fleet example |
|---|---|---|---|
| Source and dependency pin | required | required | required |
| Installer package and publication receipt | required | required | required |
| Per-entry page and artifact index | required | required | required |
| Helm pain report | required | forbidden, the source is not Helm | forbidden |
| Lifecycle routes | required | required | required |
| Target prerequisites | required | required | required |
| Flattening-safety verdict | required | born-flattened, recorded once | forbidden |
| Certified bundle receipt | permitted, gated on the verdict; forbidden when `do-not-flatten` | permitted | forbidden |
| Packaged CRD bundle | required when a base declares a CRD prerequisite | conditional | forbidden |
| Licence record | required | required | required |
| Retention state | required | required | required |

The first three rows are the universal floor. Every one of the 139 entries
already satisfies them today, which is the fact that makes the contract
adoptable rather than aspirational.

## What it would cost today

Measured against 139 recipe roots.

| Obligation | Satisfied | Gap |
|---|---|---|
| Catalog views: status, artifact index, page | **139 of 139** | none |
| Installer package and publication receipt | 139 of 139 | none |
| Helm pain report | 130 of 139 | 9 entries |
| Render intent, which carries lifecycle and target-facts states | 110 of 139 | **29 entries holding 46 variants** |
| Lifecycle declared with a real decision | 15 of 199 intents | 184 generated defaults |
| Target facts declared attached | 67 of 199 intents | 132 actionable gaps |

The catalog views row corrects issue #1375, which reported 20 of 135 missing.
They are complete. The generators resolve them through `catalogDerivedPath()`
in `scripts/lib/catalog-derived-views.mjs`, which redirects immutable roots to
an overlay; counting raw in-root paths produced the wrong answer.

The largest genuine gap is the 29 orphan roots. They hold 46 variants that no
render intent covers, so no lifecycle or target-facts state exists for them at
all. They are not in the fourth state, they are outside the system that has
states.

## What it would break, and what to do about it

Two conventions coexist for reading catalog views. Only **8** scripts use
`catalogDerivedPath()`. Four analyses read the raw in-root path and fail on
every immutable root: `generate-production-disposition-lane`,
`run-legacy-patch-review`, `generate-top500-catalog-analysis`, and
`generate-top100-user-readiness`. Adopting a contract that enumerates entries
directly makes this a one-line fix per script rather than a mystery.

Two lanes assert fixed catalog sizes that stopped being true when the catalog
grew: `check(entries.length === 100)` in `generate-top100-catalog-analysis`
against 105, and `check(secretRows.length === 15)` in
`generate-attack-plan-workdown` against 12. Under the contract these become
derived counts, or declared expectations that say why the number is what it is.

The lane vocabulary disagrees with itself. `tests/doctrine.md:57` lists five
values, and `scripts/generate-disposition-frontier.mjs:50` admits six by adding
`fail`. One of them is wrong and the contract cannot be written until someone
says which.

## Data management, which the contract also has to settle

The obligations above say what an entry owes. Four questions are about how the
catalog holds that data, and they surfaced together while clearing the chain.

### Coverage: a matrix spans the catalog or says why not

The catalog's oldest surfaces are matrices, and they still carry the most
detail: `data/master-catalog-matrix/matrix.csv` holds **81 columns over 389
rows**, and `data/matrix-completion-audit/audit.csv` holds 657 rows.

Nothing has been lost. The only matrix file ever deleted is
`data/lane-test-matrix/summary.md`, removed deliberately in #514 when the
published lane surfaces were rationalised, and its CSV remains.

What has not happened is expansion. Measured against 112 distinct charts:

| matrix | charts covered |
|---|---|
| `lane-test-matrix/variant-lanes.csv` | **112 of 112** |
| `master-catalog-matrix/matrix.csv` | 100 of 112 |
| `matrix-completion-audit/audit.csv` | 100 of 112 |
| `live-matrix-burndown/work-items.csv` | 47 of 112 |

Twelve charts are absent from the master matrix: the three
aws-controllers-k8s charts, three cloudpirates charts, karpenter,
nvidia-device-plugin, valkey, metallb, oauth2-proxy, and policy-reporter. The
lane-test matrix proves full coverage is achievable, so the gap is not
structural.

The cause is shared with the render-intent gap. The master matrix derives from
render intents rather than enumerating entries, so a root with no intent is
invisible to it. Fixing the enumeration fixes both.

**Rule.** A matrix covers every entry, or names the entries it excludes and
why. A matrix that silently spans a subset reports a percentage against the
wrong denominator, which is how outcome coverage came to report 126 of 199
while the truth was 126 of 245.

### Duplication: one render, one copy

Nine variants declare `realizationStrategy: alias-of-default-render`. All nine
render byte-identically to their default, duplicating **67 KB** of rendered
objects across kube-state-metrics, prometheus-adapter, blackbox-exporter,
argo-workflows, istio gateway, filebeat and others.

Each alias buys a decision record: the render-time choices a reader should
understand, and what remains before catalog support. Each costs a second
revision and a second receipt set describing bytes that already exist once.

That cost is not theoretical. `argo-cd/argo-workflows/1.0.14` has two copies of
one render and two independent revisions, and when the variant was edited on
2026-07-29 only one side moved, which is the failure still open in the chain
today.

**Rule.** A reviewed decision that changes no bytes is metadata on the base it
reviews, not a second base. Keep the `usefulBase` record, attach it to the
default variant, and remove the duplicate render, revision and receipts.

### Derived order: declare it or assert it

No lane regenerates the derived views in dependency order. `npm run generate`
runs one generator. Nothing records that the pain reports feed chart facts,
which feed quirk coverage, model completeness and the image-digest workdown, or
that outcome coverage reads views its own first pass rebuilds.

The practical consequence is that a maintainer regenerates, sees three lanes
still red, and cannot tell whether that is drift or ordering. Running twice
happens to settle it today, which is folklore rather than a contract.

**Rule.** Either a lane regenerates in a declared order, or each generator
asserts its inputs are fresh before it runs. The second is preferable, because
it fails with the name of the input that is stale rather than requiring the
maintainer to know the graph.

### Retention: a recorded column is never dropped silently

The matrices are the catalog's memory of questions asked earlier: quirk
classes, hook phases, lane outcomes, promotion state. The retention rule that
governs published versions applies to recorded columns too. A column may be
superseded, and superseding it is a decision with a record. It may not simply
stop being written.

**Rule.** Removing a recorded column or row set is a declared change with a
reason, in the same register shape used for package drift and lane roles.

## What not to do

Do not enrol the 184 generated lifecycle defaults by keeping them. Deleting the
unconditional fall-through at `generate-helm-render-intents.mjs:607` moves 184
records from a false declaration to an honest gap, and the count of gaps will
rise sharply. That is the correct direction. A contract measured by how few gaps
it shows is a contract that rewards silence.

Do not require a certified bundle per entry. The verdict decides, and three
entries are `do-not-flatten` today.

Do not couple target facts to routes. The measurement above shows 49 of 53
routes need none, and 56 intents need target facts with no route.

## The first increment

1. Fix the four raw-path readers. It clears four chain failures and costs a line
   each.
2. Enrol the 29 orphan roots so every entry has the states, before adding any
   new obligation to the list.
3. Replace the generated lifecycle default with an honest gap, and accept the
   rise in the gap count.
4. Settle the lane vocabulary.
5. Only then extend the three-state rule to the remaining obligations, with the
   permission and limits axes, one obligation at a time, each with a lane that
   enumerates entries directly.

## Related

Issue #1375 records the analysis-layer gap, with its numbers corrected in a
comment. Issues #1391, #1392 and #1393 supply the permission and limits axes
from the certified-bundle work. Issue #1359 records the chain blocker that hid
most of this until today.
