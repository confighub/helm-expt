# helm-expt Doctrine — delivery transport + quirk testing

_A layer of the [helm-expt test map](README.md)._

**UNOFFICIAL/EXPERIMENTAL.** Standing principles for how we deliver and test —
especially the **non-recipe quirks** (hooks, lifecycle, CRDs, target facts,
lookup). These are doctrine: every proof must follow them, and a proof that
skips one is incomplete, not just smaller.

## 1. Render parity proves the recipe; everything else is a routed quirk
The recipe is the static rendered object set. Anything that does **not** survive a
config-only render — hooks, lifecycle actions, CRD installs, target facts, `lookup()` —
is a **routed quirk** and must be proven separately. Render parity alone never
proves a quirk.

## 2. Prove quirks through k8s **and** ConfigHub, every time
A quirk validated only via raw `kubectl` / Argo / Flux is **not** proven the way the
catalog claims. It must flow through the real product path: `cub installer` →
ConfigHub Units → OCI → a live cluster — and the routed quirk executed + observed
**on that cluster**, receipted. Local-kind-only observation is not enough.

## 3. OCI is the single transport
ConfigHub publishes the bundle **once to OCI**; every consumer pulls that **same
artifact**:
- **Argo** → OCI `Application` source (`oci://oci.hub.confighub.com/...`).
- **Flux** → an `OCIRepository` at the same URL + the `confighub-oci-creds` secret.
- **No controller** → **pull the OCI bundle and use the managed cub-direct applier**.
  OCI is still the single source of truth. Bare `kubectl apply` is the baseline we
  test against, not the product path for serious installs.
  For upgrades, the managed cub-direct path must prune removed resources with a
  safe selector/allowlist or an equivalent delete-set, otherwise deleted desired
  objects remain orphaned. For first installs of bundles that contain CRDs and
  custom resources, it must install CRDs first and wait for them to establish.
  For server-side-apply conflicts, it must show a plain reconcile choice instead
  of leaving the user with a raw Kubernetes error. If any of those are not in
  scope, route the chart to Argo or Flux.

Re-rendering locally and `kubectl apply`-ing **bypasses OCI** — that is the
*no-ConfigHub* fallback only, never the ConfigHub path. A *continuous* "OCI push
auto-applies" without a controller is just reinventing Argo/Flux; so the
no-controller mode is a **one-shot pull+apply** (or cub's agent).

## 4. Every hook/quirk check = Argo + Flux + kubectl, always
Not whichever controller a given path happens to use. A hook is only proven once
all three delivery paths run it (each sourced from the same OCI bundle, per #3).

## 5. Hooks: observe → execute → emit; nothing automatic until earned
- **observe** — a live receipt the route happened.
- **execute** — the routed action run live (e.g. the Job), receipted (`executor`).
- **emit** — the controller-native step (Argo PreSync/PostSync, Flux `OCIRepository`/test).
- `automatic: false` until the **product** executes the route **and** committed
  evidence proves it ([#688](https://github.com/confighub/helm-expt/issues/688)).
- The **selector/executor** (choosing + running a route via CLI/AI/function/GUI) is a
  **runtime module in cub/cub-scout**, not the static catalog.

## 6. Never silent — every outcome is named
- Lanes: `pass · watch · blocked · refused · n/a` (`todo` only as a named next step).
- **Two distinct adversarial lanes, not one:**
  - **F — deliberate breakers** (torture suite, adversarial-10): a skeptic *trying* to break
    the model → a named refusal or route.
  - **G — careless-dev randomness** (`run-bad-decisions-fuzz`): an *ordinary* dev making
    unexpected silly decisions, **repeatedly, at volume**. Each ends `rejected` (caught at
    render) · `leaked` (the k8s API is the backstop) · `absorbed` (the silent `--set` no-op
    footgun, surfaced). **0 unclassified / 0 silent**, by construction.
- **cub-installer fuzz** tests our own CLI with bad and weird input. Serious bugs
  are crashes, injection, or silent swallowing. Rough edges are still findings,
  even when the result is a pass.
- **H — Helm-fluent migrant friction** tests correct Helm habits applied to cub.
  Safe rejection is not enough for adoption; the useful outcome is rejection
  with a pointer to the cub model.

## 6a. The careless-dev assumption (why lane G exists)
Most real breakage is **ordinary, not adversarial** — devs break tools through silly
choices we never anticipated, again and again. The evidence is the whole argument in one
number: Helm catches **~1%** of careless decisions at render; **~66%** vanish silently
(the `--set` footgun); **~33%** leak to the k8s API. So we fuzz random bad decisions **at
volume** and **name every outcome** — the careless dev, not the skeptic, is the most common
breaker, and a tool that silently swallows their mistakes is the failure mode to catch.

## 6b. The Helm-migrant assumption
Many users will arrive fluent in Helm and type normal Helm flags first:
`--set`, `--set-string`, `-f values.yaml`, `--values`, and image paths expressed
as Helm values. `cub installer` should reject what it does not support, but the
error should teach the cub route: declared `--input`s, `--set-image`, named
bases, or a base edit. A generic "unknown flag" is safe but opaque.

## 6c. Default credentials are never silent
Deterministic rendering is good for reviewable diffs, but a deterministic Secret
value is not a generated password. If a demo/default base ships a fixed
placeholder credential, the row stays `watch` until the name, warning, and
recommended production route make that obvious. A base named
`static-passwords` must not quietly contain fixed shared credentials.

## 6f. Gated artifacts are referenced, never mirrored
Some artifacts a catalog entry names are gated: they need an entitlement and a
credential the reader has and this repository does not. The rules are the same
whichever vendor gates them.

Reference, never mirror. Retained configuration names the artifact and the
catalog holds nothing of its bytes, so no proof pulls one and no lane depends
on being able to. The credential that reaches a gated registry belongs to the
cluster that pulls, never to this repository, which is what the
credential-boundary lane enforces across every producer.

Publish no vendor performance numbers for a gated runtime. The catalog has run
none, and repeating a vendor's would pass off a claim it cannot verify.

Name the terms a page listed on a date; never tell a reader which entitlement
or tier they need. That is a reading of their situation rather than a fact
about an artifact.

Enumerate every gated reference, because an artifact nobody listed is an
artifact nobody checked the terms for. Re-reading is tied to the reference
rather than to a calendar: entries are keyed by the exact tag, so a version bump
produces a reference nobody enumerated and the lane refuses it. A date-based
cadence goes stale quietly, because nothing fails when a date passes.

## 6g. A provenance claim may not degrade silently
A claim that an artifact's provenance was verified is only worth making if its
withdrawal is as visible as its assertion. An upstream that stops signing, or a
chart that moves to a transport where the old signature does not apply, changes
what the catalog can honestly say, and nothing about that change announces
itself.

So provenance is surveyed against a committed snapshot, and each run records
every artifact whose verdict moved since the last one. A publisher who stops
signing leaves a record rather than a silence, and the catalog withdraws the
claim in the same place it made it.

An unanswered question is not a negative answer. An artifact whose provenance
could not be asked about is recorded as unknown, never as unsigned, because
counting a refused request as evidence of absence would overstate the one thing
this discipline exists to keep honest.

## 6d. Drift detection must state field coverage
`cub-scout compare three-way --dry-from` can detect meaningful drift, but field
coverage is part of the claim. A lane that catches replica or image drift but
misses container environment drift is still useful, but it stays `watch` until
the covered fields are explicit and the missing pod-spec fields are added or
refused with a reason.

## 6e. Server-side apply conflicts must be product-readable
ConfigHub/cub delivery uses server-side apply. That can be safer than Helm's
silent overwrite when someone has edited a live field by hand, because the API
can report field ownership conflict instead of hiding it. The adoption UX bar is
not the raw Kubernetes error. The managed path must show a plain reconcile
choice, such as keep live, accept desired, or force with an explicit receipt.

## 7. Live runs are serial and ephemeral
`cub cluster up` creates a local **kind** cluster — one at a time (concurrent
clusters starve nodes → false blocks), torn down immediately after
(`cub cluster down --force`), orphan clusters/Spaces
cleaned. Honest disposition throughout: `watch ≠ pass`; render parity ≠ live-ready;
promotion-proven ≠ production-proven.

## 8. Humans read websites; agents read docs; operators read the org
Every load-bearing explanation or check publishes to **all three surfaces**, in the
form each reader actually uses:
- **The website** gets the human form: styled pages with the tables and the context
  under them, in the site's own chrome — not a link to a raw file.
- **The docs and data files** get the agent form: the same facts as markdown, CSV,
  and JSON that a tool can read and a verifier can check.
- **The org** gets the operator form: labels, warnings, and gates on real Spaces and
  Units, wired to real checks — never decorative. A gate that does not reflect a
  real validation is a lie in the UI.
A truth that exists on only one surface is not published; it is buried. When the
three surfaces disagree, the disagreement is itself a finding to surface, not to
paper over.

## 9. Agents author intent, never YAML; parity decides whether the result may exist
When an AI agent (Pilot or any other) produces a chart variant, the agent's
only output is the **intent and the switch settings**. The chart's own
renderer produces the objects. A generated variant is allowed to exist only
when the parity gate passes, and the gate has three parts:
- **Provenance** — the recipe points at a real upstream chart at a pinned
  version; the thing rendered is the thing claimed.
- **Render parity** — a live double-render equality check computed at
  generation time (no pre-blessed baseline needed): same inputs,
  byte-identical output, and the object-set delta reconciled against the
  switch-effect map, with interactions reported rather than assumed.
- **Route disposition** — anything the switches introduce that does not
  survive a config-only render (a CRD dependency, a hook) is named as a
  route, never shipped silently (per #1).

**A refusal must name the correct route forward, never just the block** (the
same rule 6b applies to Helm migrants): the receipt says what to do instead in
this paradigm — an existing-secret reference, a routed prerequisite, a declared
input — so the next attempt is the right one. The proof that this works is the
receipt trilogy: the refusal named the existing-secret route, the corrected
mapping followed it, and the gate passed with determinism identical
([corrected-route-receipt](../data/pilot-switch-map/corrected-route-receipt.md)).

**Refusal is a first-class outcome with a receipt.** The first live refusal
is the canonical example: an agent mapped "TLS with auto-generated certs",
the render was plausible, and determinism diverged because the chart mints
new certificates on every render — exactly the nondeterminism that breaks
config-as-data. The variant was refused with the reason named
([refused-variant-receipt](../data/pilot-switch-map/refused-variant-receipt.md)).

**The agent is the author, never the authority.** A generated variant becomes
an ordinary governed object (versioned, gated, promotable) once accepted; an
agent must not continuously mutate a live variant, and every receipt records
who mapped the intent (`mappedBy`). The switch-effect maps follow the same
rule: classifications are computed by rendering, never asserted
([data/pilot-switch-map/](../data/pilot-switch-map/summary.md)).

## 10. A claim must be openable, or it is not a claim
Every recorded boolean or status names the artifact that earned it, or it reads
false. `proven: true` on a route requires `provenBy` pointing at a receipt that
exists; strict ingest refuses it otherwise.

This rule exists because we broke it. Eight routes claimed a runtime was proven
to execute them and cited nothing, while the run that looked like the proof
recorded `syncOperationsObserved: 0` and stated in its own limits that no sync
started. **Surviving delivery is not being executed.** The overclaim was inside
the model built to prevent overclaiming, so grep our own artifacts for claim
fields on a cadence, not only other people's.

## 10a. Declare a debt; never read one out of prose
`companionRequired` names the `routeKind` a disposition owes. Inferring that
from the disposition's wording was implemented and reverted: it reported four
resolutions as debts, because a namespace shipping inside its own bundle reads
like a namespace that is missing.

A check that cries wolf teaches readers to skip it. Where evidence cannot settle
a class, leave the field absent and say so — never guess and never infer intent
from a sentence.

## 10b. A check that stops checking is worse than no check
Tamper-test every gate the moment it is written, and keep the tamper as a
self-test. A gate reporting zero findings is a hypothesis until you break
something and watch it fail.

Four ways ours went blind, all silent:
- comparing two **local** files, so upstream drift was undetectable;
- selecting a fixture by sort order (`[0]`), which stopped selecting the fixture
  under test the moment new records landed;
- reading a CSV by **column index** after the columns moved;
- a mutation that rewrote a producer's **wording** rather than the structure the
  check reads.

## 10c. Evidence is not a decision, and one scanner never settles everything
A witness scans a packaged chart; a verdict decides a lane. The pages say which
they have, and that undecided is not the same as safe.

- **A scan reports what an artifact contains, not what it calls.** All six
  bitnami charts package the lookup-or-generate credential helper; five call it.
- **Each scanner has a blind spot, so cross-check with a different one.** The
  witness sees *generated* credentials and is blind to a literal one:
  minio-operator/tenant renders `MINIO_ROOT_PASSWORD` from values and its
  witness reports zero generated secrets. `verdict-render-parity:verify` now
  refuses any verdict calling a class absent that its own render contains.

## 10d. Follow the artifact, not its family
memcached and zookeeper call the same credential helper as postgresql and redis.
Their auth is off by default, so their base renders no Secret, and they are safe
to flatten while the databases are not. **The lane follows what the base
renders, not what the chart could render.**

Precedent selects the question to ask. It never supplies the answer.

## 10e. State what the artifact does not cover
A receipt certifies rendering and packaging, never runtime health. Convergence
is a separate record that does not exist yet.

A bundle's bytes are fixed and the images those bytes name are not: most
references in the catalog's bundles are tags, which can be repushed. The receipt
records every reference with how it is pinned and a boundary sentence, rather
than letting a reader assume a certified bundle certifies what it starts.
## 11. Permission is derived from the property, never asserted per entry
An artifact can be **required**, **permitted**, or **forbidden** for a given
entry, and those are not the same as present, unnecessary, or missing. Collapsing
the two makes an absence unreadable: a reader counting bundles against catalog
entries sees a shortfall where most of the gap is correct and some of it is
prohibited.

For the certified bundle the mapping is computed from the flattening lane, so
nobody records a judgment twice:

| lane | a certified bundle is |
| --- | --- |
| `safe-to-flatten` | permitted |
| `flatten-with-routes` | permitted, once it ships the companions its verdict names |
| `unsafe-to-flatten` | **forbidden** |
| undecided | forbidden until a lane is decided |

`scripts/publish-certified-bundles.mjs` already refuses on the lane, so the rule
describes what the code does rather than adding a step. The installer package is
the certified route for everything in the bottom two rows, which is why a
forbidden bundle is not a gap in coverage.

This is why the lane reads `unsafe-to-flatten` and not `do-not-flatten`. A lane
is a **property of the chart**, in the same family as `safe-to-flatten` and
`born-flattened`; an imperative invites someone to decide otherwise, and a
property is what permission can be computed from. It says unsafe rather than
impossible on purpose: `helm template` runs fine on these charts, and what fails
is the guarantee, not the renderer.

## 11a. Absence must say which kind it is
Never let a reader infer why something is not there. Every absence is one of
three things, and the surface says which: **not needed here**, **not permitted
here**, or **not done yet**. The third is the only one that is work.
