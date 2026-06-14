# Where Does My Hook Go?

**UNOFFICIAL/EXPERIMENTAL** — analysis and solution proposal.

*...and every other Helm behavior that isn't in the rendered YAML.*

This doc starts from one real user question about hooks and works down to a
complete model for every Helm behavior that does not survive a config-only
render. It is an analysis of the problem we are solving and a detailed solution
proposal. It is deliberately broader than hooks: hooks are the first and
clearest case of a general gap.

The canonical per-hook treatment lives in
[hook-lifecycle-strategy.md](../user/hook-lifecycle-strategy.md). This doc does
not replace it. It generalizes it.

---

## 0. The question that started this

> "What I don't understand: if I use a helm chart which has hooks, but I use the
> ConfigHub version, then how do I learn where to deploy my hook, and how does
> it get set up for me?"

This is the right question, and it is bigger than hooks. The same two
sub-questions apply to every Helm behavior that is not plain rendered
configuration:

1. **Where does the behavior go?** Helm used to *do* this at runtime. The
   ConfigHub version renders desired-state objects. So where did the behavior
   go, and how do I find out without reading Helm's source?
2. **How does it get set up for me?** What does the product do automatically,
   what must I decide, and what will it deliberately not do?

**Short answer for hooks:** you learn where your hook goes by reading the
chart's **disposition** in the catalog — one of *observed / routed / per-target
/ refused*. `observed` means the route has live evidence. `routed` means the
route is known and named, but the chart page or receipt must still say whether
that route is executed by the current product flow or is a setup step the user
must perform. You never reverse-engineer Helm's engine.

The rest of this doc explains why that is the model, extends it to every other
hidden Helm behavior, and is honest about what we still have to build before the
answer actually beats "helm just runs."

---

## 1. The problem

### 1.1 Two models in collision

Helm is an **imperative engine**. `helm install` does things at runtime that are
not in the rendered YAML: it fires hooks, installs CRDs once, reads the live
cluster with `lookup`, generates passwords and certificates, branches on
install-vs-upgrade, and can be reshaped by a post-renderer.

ConfigHub is **desired-state**. The rendered object set is the artifact. The
catalog renders deliberately **without hooks** (`--no-hooks` render contract) so
that the proof is the desired configuration, not a side effect of running an
engine.

These two models are both correct, but they collide on exactly the behaviors
that are not expressible as static rendered YAML.

### 1.2 The behaviors do not vanish

This is the crux. When you "use the ConfigHub version," every behavior Helm used
to perform imperatively still has to happen **somewhere** — or be deliberately
not done. A `pre-install` migration Job does not stop being necessary because we
rendered the chart differently. A generated admin password is still required.
The CRDs still have to exist before the custom resources.

If we render config-only and say nothing about where those behaviors went, the
user is **more lost than with Helm**, not less. Helm at least "just runs." We
rendered twelve manifests and went quiet about the hook. That is a worse
experience unless we close the loop explicitly.

### 1.3 Why "helm just runs" is the bar — and the trap

"Helm just runs" is the competitor and the bar. One command, the behaviors
happen, you get a running thing. We must respect that convenience.

But "helm just runs" is also a **trap**, because it runs by hiding outcomes:

- the hook fails and the release still reports success (silent-green);
- the CRD does not upgrade and the operator quietly drifts;
- the required Secret is missing and the pod waits forever;
- the upgrade renders differently from the install and nobody sees the diff.

So the bar is not "be as opaque as Helm." The bar is **match Helm's
convenience, and replace its opacity with a verified disposition** — without
charging the user effort for visibility they did not ask for.

### 1.4 The taxonomy of hidden behaviors (all the bases)

Hooks are one class. The harness already tracks **26 quirk axes**
(`data/quirk-coverage/coverage.csv`). Grouped by *how a user gets confused*:

**Tier 1 — silent footguns** (green status, broken or surprising result):

| Behavior | The "huh?" moment |
| --- | --- |
| CRDs / CRD upgrade | "Applied fine, operator crash-loops" / "my CRD never upgraded" |
| `lookup` / `getHostByName` | "This field is empty/wrong" — render read a cluster I don't have |
| Generated facts (passwords, certs, random) | "Where's my password, and is it stable across re-renders?" |
| Target prerequisites (Secret, StorageClass, creds) | "Applied fine, won't start" |
| `install` vs `upgrade` branching | "The upgrade did something the install didn't" |
| Hooks (phase / delete-policy / weight) | "Where does my hook go, and did it run?" |
| `required` / `fail` inputs | "Render just errored" |
| `resource-policy: keep` | "I deleted it but it's still there" |
| Webhooks / admission mutation | "What landed isn't what I applied" |

**Tier 2 — hidden provenance** ("where does my thing go / come from?"):

| Behavior | The "huh?" moment |
| --- | --- |
| Extension slots (`tpl`, raw manifests, sidecars) | "Where do I put my custom config/sidecar?" |
| Subchart plumbing (`import-values`, aliases, library charts, `global`) | "Where did this value come from / how do I override it?" |
| `post-renderer` | "The output doesn't match the templates" |
| `.Files.Get` | "A bundled file changed my config and it's not in values" |

**Tier 3 — render-context honesty** ("will the catalog's render match *my*
setup?"):

| Behavior | The "huh?" moment |
| --- | --- |
| Capability / Helm-version branching | "The catalog's render isn't valid for my cluster/Helm" |
| `semverCompare` | "Render depends on a version I didn't pin" |
| Helm flag profile | "Different flags → different output" |
| Non-determinism (`now`, uuid) | "Your parity proof can't be real" |
| `values.schema.json` / required inputs | "What must I provide?" |
| Dependency lock | "Which subchart versions did this render assume?" |

The full per-axis catalog with current treatment is in **Appendix A**.

---

## 2. Necessary vs sufficient

Informative docs pages, an updated master matrix, and supporting corpus are
**necessary** — they win the trust and legibility argument. They are **not
sufficient** to beat "helm just runs."

A page that says *"here is the route you must set up yourself"* is, from the
user's chair, **more work than Helm for less convenience**. The skeptic reads
it as: "so I now do manually what Helm did automatically, and I should be
grateful it's documented?" That is a losing trade.

The product target requires three things beyond docs and the matrix:

1. **Executed routes, not documented routes.** A route that can be executed by
   the product should resolve to an operation the installer or ConfigHub flow
   performs, not a paragraph. If the disposition is only a paragraph, the docs
   are the interface and we lose. If it is an operation, the docs are just the
   explanation.
2. **A one-command happy path** that is ~as easy as `helm install`: resolve
   prerequisites, run the routed lifecycle steps, report.
3. **Actionable preflight, not diagnostic preflight.** A missing CRD/secret
   should surface as "install it now? [Y/n]" or `--install-prerequisites`, not
   as a `blocked` status that sends you to a doc.

And one strategic rule:

> **Match Helm on the easy path. Win decisively on the hard path. Never charge
> the user effort for visibility they did not ask for.**

- Trivial chart (no hooks, no prereqs): `helm install` is one command and fine.
  The catalog must *match* that, not exceed it.
- Hard chart (hooks, CRDs, generated secrets, divergent upgrades, admission
  mutation): this is where "helm just runs" is actually "helm just *appears* to
  run." This is the entire ballgame. Win it with verified dispositions.
- Day-2 (gates, promotion, fleet): not competing with `helm install` at all —
  competing with "helm install + a pile of homegrown scripts." The extra steps
  here are the product, and they are wanted.

---

## 3. The solution: the disposition model, generalized

### 3.1 The vocabulary

Every hidden behavior, for every chart, carries exactly one **disposition**:

| Disposition | Meaning | What the user does |
| --- | --- | --- |
| **observed** | Converted to an explicit lifecycle route **and** proven by live evidence (a receipt with a runtime result, timestamp, freshness). | Nothing — it runs and is proven. |
| **routed** | The route is known and named. The chart must also say whether the current flow executes it or whether the user must set it up. Live evidence is not yet captured. | Follows the chart's execution mode; knows it is not yet proven. |
| **per-target** | The route depends on the target platform or policy; the catalog **names the decision** (it may *recommend* an option, but never silently picks one — see §3.7). | Makes one explicit choice. |
| **refused** | Deliberately not run automatically; the chart **says why**. | Does the named manual step knowingly, or accepts the boundary. |

As of [#684](https://github.com/confighub/helm-expt/pull/684), these four words
are the **published user-facing contract** for hooks in
[hook-lifecycle-strategy.md](../user/hook-lifecycle-strategy.md). This doc adopts
the same four words and generalizes them to every quirk class. It also
generalizes the canonical hook *engineering* status vocabulary
(`inventoried → render-proven → route-selected → lifecycle-observed → blocked`).
The mapping:

- `route-selected` → **routed**
- `lifecycle-observed` → **observed**
- `blocked-for-safety` → **refused**
- `blocked-because-target-dependent` → **per-target**
- `inventoried` / `render-proven` are *pre-disposition* — the behavior is known
  but has no route yet. These are temporary and must converge to one of the four.

A `blocked` that is merely "not yet mapped" is **not a final disposition**. It is
a `todo` with a named next action, and it counts against the disposition
frontier (`data/disposition-frontier/`).

### 3.2 Named routes

A disposition points at a **named route**, never an ad-hoc explanation. The
route catalog (hooks today, generalized):

```text
preflight-or-presync            run-before-apply setup (Job / PreSync)
postsync-check-or-observation   after-apply check or live observation
upgrade-action-with-receipt     upgrade-only lifecycle action + receipt
preserve-ordering               sync-wave / weight-equivalent sequencing
preserve-cleanup-policy         keep delete/cleanup semantics
delete-cleanup-policy           orphan-on-delete / prune policy
target-facts-or-preflight       value the target must supply (lookup, prereq)
generated-fact-policy           generated password/cert disclosure + binding
crd-install / crd-upgrade       CRD-before-CR ordering; separate upgrade path
capability-envelope             which kube/Helm profiles a render is valid for
extension-slot-control-point    named place to inject custom config/sidecar
value-source-map                provenance: where a rendered field came from
explicit-managed-action         a managed action we run on your behalf
refusal-with-reason             we will not do this automatically; here is why
```

The point: a finite, fixed set of routes. The user learns the routes **once**,
then every chart is read against the same vocabulary.

### 3.3 From hooks to all the bases

The hooks model becomes the template for every quirk class. Each chart row
carries a small set of **per-quirk dispositions**:

| Quirk class | Default route | Typical disposition | Who acts |
| --- | --- | --- | --- |
| Hook (pre/post install) | preflight-or-presync / postsync-check | observed / routed | product target |
| Hook (upgrade) | upgrade-action-with-receipt | routed | product target (gated) |
| Hook (delete/cleanup) | delete/preserve-cleanup-policy | per-target | product + user |
| CRDs | crd-install (CRD-before-CR) | observed / per-target | product or target |
| CRD upgrade | crd-upgrade (separate path) | per-target / refused | user-reviewed |
| `lookup` / `getHostByName` | target-facts-or-preflight | per-target / refused | user supplies |
| Generated facts | generated-fact-policy | observed / per-target | product or user |
| Target prerequisites | target-facts-or-preflight | per-target | user (or auto) |
| install-vs-upgrade | upgrade-action-with-receipt | routed | product target |
| Webhook / admission | postsync-check-or-observation | observed | product |
| `required` / `fail` | required-inputs (typed prompt) | per-target | user supplies |
| `resource-policy: keep` | delete-cleanup-policy | routed (disclosed) | product discloses |
| Extension slots | extension-slot-control-point | routed | user fills slot |
| Subchart provenance | value-source-map | routed | product discloses |
| `post-renderer` | explicit-managed-action / refusal | routed / refused | product or refused |
| Capability / Helm version | capability-envelope | per-target | product declares |
| Non-determinism | generated-fact-policy + `deterministic:false` | observed | product discloses |

This is what "covering all the bases" means: **one vocabulary, one route
catalog, one badge shape — applied uniformly to every hidden behavior**, so a
user reads one chart row and knows what is automatic, what they must provide,
what depends on their target, and what we refuse to do silently.

### 3.4 The three sufficiency mechanisms

**(a) Executed routes.** The intended product direction is that routable
Tier-1 behaviors become operations:

- preflight/PreSync routes run as a real preflight Job or sync step;
- generated-fact routes capture the value once and bind it (or accept an
  existing Secret), so it is stable and disclosed;
- CRD routes install CRDs before custom resources, as part of apply;
- the receipt is the proof the route ran.

If the current product does not execute a route, the chart must say so plainly.
If a route can only be documented, its honest disposition is **per-target**,
**refused**, or a `todo` with a next action — never a *routed* that secretly
means "you do it" without saying so.

**(b) One-command happy path.** Today `cub installer setup` renders and verifies.
The gap is auto-satisfying routed prerequisites and running the lifecycle
actions in the same flow. Target shape:

```text
cub installer setup --pull <pkg> --base <base> --namespace <ns> \
  --install-prerequisites      # resolve Tier-1 blockers in the same command
# → renders, satisfies prereqs (CRDs/namespace/placeholder secret),
#   runs routed lifecycle steps, writes receipts, reports dispositions.
```

**(c) Actionable preflight.** Turn diagnostic `blocked` into one-keystroke
resolution:

```text
needs CRD monitoring.coreos.com/Prometheus  →  install it now? [Y/n]
needs Secret redis-auth (generated)         →  generate and store? [Y/n]
needs namespace redis                        →  create? [Y/n]
```

A blocker the tool can resolve is convenience. A blocker that sends you to a doc
is friction. This is the single highest convenience-per-effort win.

### 3.5 Where the user reads it (surfaced-first, never reverse-engineered)

```text
chart row (matrix.html / chart page)
   └─ per-quirk disposition badges:  hook ● observed   crd ● per-target   secret ● observed
        └─ click → route page: exactly where the behavior goes + the decision (if any)
             └─ receipt: proof it ran (runtime result, timestamp, freshness)
```

The invariant: **the disposition is read off the chart row first**. The user
never reverse-engineers Helm's engine, never greps the chart source, never
guesses. If a behavior exists and is not on the row, that is a bug in the
catalog, not a task for the user.

### 3.6 Invariants that keep this from collapsing

1. **Fixed vocabulary.** Four dispositions, one finite route catalog. No chart
   invents its own status.
2. **No silent green.** A chart with an un-routed Tier-1 behavior cannot be
   "production-supported." Render parity is necessary, never sufficient.
3. **`--no-hooks` render contract.** The catalog renders config-only on
   purpose; hooks and hook-like behaviors become explicit catalog facts, never
   smuggled into the render proof.
4. **Disposition is required for support.** Every Tier-1 behavior a chart has
   must carry a final disposition (not `todo`) before that chart/base can claim
   production support. This is what the disposition frontier measures.

### 3.7 Defaults need a legible off-ramp (humans and agents)

The happy path is "a default that just works" (§2, §3.4). That is the right
convenience move — but a default is only safe if **leaving it is just as easy
and legible**. Otherwise we replace Helm's "nothing is legible" with "only the
default is legible," and the first non-standard need — a different `per-target`
route, a stricter base, overriding a `refused` default — becomes a cliff.

Every applied default must therefore be:

1. **Disclosed** — at decision time you can see that a default was chosen and
   what it was. No invisible choices.
2. **Alternatived** — the named alternatives are listed next to it, not hidden.
   (`per-target` already promises this; generalize it to any auto-chosen route,
   base, or value.)
3. **Selectable by a human** — a discoverable flag / UI control, and docs that
   show the non-default path as a first-class example, not a footnote.
4. **Selectable by an agent** — the route list, the default, the alternatives,
   each alternative's requirements, and the selection mechanism must be
   machine-readable and stable, so an agent can enumerate and choose
   programmatically.

Point 4 is not optional: the catalog is positioned as agent-ready. If only a
human can find the off-ramp (through prose or a UI), every agent is stuck on the
default — which defeats the positioning. The off-ramp must be symmetric, and it
is an acceptance requirement of Phases 2–3, not a later add-on. Concrete loop
actions are in Appendix C, note 4.

---

## 4. Worked example A — target experience for a routed hook

A chart has a `pre-install` migration Job hook. You use the ConfigHub version.

1. **Catalog tells you it exists.** The chart row shows `hook ● routed` with the
   phase (`pre-install`) — before you install anything.
2. **The route page tells you where it goes.** Route = `preflight-or-presync`:
   the migration belongs before the rendered objects apply. No
   reverse-engineering.
3. **The route page states the execution mode.** If the current product flow can
   run it, the command is shown there. If it needs a decision (for example, the
   migration needs database credentials), the catalog marks it *per-target* and
   names the choice. If it is not executable yet, it remains a `todo` or
   `refused` case rather than pretending to be automatic.
4. **The receipt closes the loop.** Once the route has run with live evidence,
   the disposition flips `routed → observed`: it ran, here is the result, here
   is when, here is the freshness.

Contrast with Helm: it ran the hook, and you do not know what it did or whether
it worked unless you go digging. The product goal is the same convenience, plus
the truth.

## 5. Worked example B — a non-hook chart (same machinery)

A chart with CRDs, a generated admin password, and a `lookup` for a StorageClass.
The chart row shows three badges, read the same way:

```text
crd ● per-target      route: crd-install — install CRDs now, or target owns them? (default: install)
secret ● observed     route: generated-fact-policy — password generated once, stored, disclosed
lookup ● per-target   route: target-facts — supply your StorageClass (default: cluster-default)
```

The target product flow resolves all three. The user makes two named choices
(who owns CRDs; which StorageClass), the password is handled and disclosed, and
every decision has a receipt. The point: **hooks were not special.** Every
hidden behavior is read and resolved through the same four-state, named-route
model.

---

## 6. Phased plan

Each phase names what to build, why, when it is done, and which existing repo
asset it extends.

**Phase 0 — inventory + disclosure (exists today).**
`data/quirk-coverage/`, `data/chart-facts/`, `data/hook-lifecycle/`,
`data/hook-disposition/`, `data/disposition-frontier/`. We can already say what
behaviors a chart has and disclose them. *Done.*

**Phase 1 — per-quirk disposition on the chart row.**
Extend the hooks disposition pattern to the Tier-1 quirks (CRDs, lookup,
generated-facts, target-prereqs, install-vs-upgrade). Surface a small set of
disposition badges on the chart row (matrix/chart page).
*Done when:* every Tier-1 behavior a maintained chart has shows a final
disposition badge, sourced from data, gated against staleness.
*Extends:* `generate-master-catalog-matrix.mjs`, `chart-facts.csv`.

**Phase 2 — actionable preflight.**
`cub installer setup --install-prerequisites` offers to create the CRDs /
namespace / placeholder-secret a chart's disposition declares.
*Done when:* the common Tier-1 blockers resolve in one command, with a captured
transcript (like `first-run-walkthrough.md`).
*Extends:* the installer plugin + the runner's `blocked-prerequisite` causality.

**Phase 3 — executed routes on the happy path.**
*observed*/*routed* dispositions run as real operations (preflight/PreSync,
generated-fact binding, CRD-before-CR) inside the one-command flow, each writing
a receipt.
*Done when:* a hook/CRD/secret chart goes chart→running in one command with
receipts, no manual route setup.

**Phase 4 — close the visibility gaps.**
Promote the scanned-but-hidden and not-scanned axes to the front door so no
Tier-1/Tier-2 behavior is invisible:
- scanned-not-surfaced → front-door: hook-delete-policy, hook-weight-ordering,
  `semverCompare`, `.Files.Get`, time/uuid functions.
- not-scanned → detected: `getHostByName`, `resource-policy: keep`,
  `post-renderer`, Helm-version branching, `global`/`import-values`.
*Done when:* coverage.csv has no `not-scanned` Tier-1/Tier-2 axis and the
disposition frontier accounts for each.
*Extends:* the source scanner + `quirk-coverage/coverage.csv`.

Sequencing rationale: **Tier 1 first** — it is where confusion does damage and
where "production-supported" being *real* is at stake. Within Tier 1:
CRDs → lookup → generated-facts/target-prereqs.

---

## 7. Honest current state

What is real today vs planned (from `data/quirk-coverage/coverage.csv`):

| Visibility | Axes | Meaning |
| --- | --- | --- |
| **Surfaced** | lookup, generated-facts, crds, install-vs-upgrade, dependency-lock, required-or-fail, values-schema, tpl/extension slots | User can read it today (mostly as a *fact/disclosure*, not yet an *executed route*) |
| **Partly tracked** | capability-profile, helm-flag-profile, hook-phase | In newer receipts only; older ones need backfill/classification |
| **Disclosed, incomplete** | crd-upgrade-behavior | Presence tracked; upgrade behavior not fully modeled |
| **Scanned, not surfaced** | hook-delete-policy, hook-weight-ordering, semverCompare, files-get, time/uuid | Scanner sees it; user does not |
| **Not scanned** | import-values, getHostByName, resource-policy-keep, post-renderer, helm-version-branching, global-values | Invisible today |

The uncomfortable conclusion: **the docs and matrix work is necessary groundwork,
but the thing that actually beats "helm just runs" is a product/CLI gap, not a
docs gap** — executed routes + one-command + actionable preflight (Phases 2–3).

The canonical "convenience leaking the wrong way" example is **#96**: the
installer `--namespace` flag does not rewrite namespace references embedded in
the spec. That is exactly the kind of edge that makes the happy path feel less
trustworthy than `helm install`, and it is the class of thing Phase 2 must not
reproduce.

---

## 8. Open decisions (for review)

1. **Vocabulary — resolved by [#684](https://github.com/confighub/helm-expt/pull/684).**
   *observed / routed / per-target / refused* is now the published user-facing
   contract in [hook-lifecycle-strategy.md](../user/hook-lifecycle-strategy.md);
   this doc adopts it. The remaining cleanup (data values + the older 5-state
   engineering list) is **Appendix C, note 3** and tracked by
   [#688](https://github.com/confighub/helm-expt/issues/688).
2. **Surface.** Do per-quirk disposition badges live on `matrix.html`, on the
   per-chart page, or both?
3. **Tier-1 order.** Confirm CRDs → lookup → generated-facts/target-prereqs as
   the Phase-1 order.
4. **Ownership.** The installer preflight/executed-route work (Phases 2–3) is
   product/CLI, not catalog. Who owns it, and what is the smallest end-to-end
   slice worth a captured walkthrough first? (Proposal: actionable preflight for
   one Tier-1 chart, e.g. a CRD chart, with a real transcript.)
5. **Refusal honesty.** Where a route can only be documented, do we commit to
   labeling it *per-target*/*refused* rather than letting it masquerade as
   *routed*?
6. **The default off-ramp (§3.7).** If the happy path is "a default that just
   works," confirm the off-ramp (disclosed default + named alternatives +
   human-selectable + agent-selectable) is a Phase-2/3 acceptance requirement,
   for both humans and agents.

The review of #684 and the concrete notes for the loop are in **Appendix C**.

---

## Appendix A — full quirk-class catalog

All 26 axes (`data/quirk-coverage/coverage.csv`), with the confusion moment, the
disposition the user needs, and current visibility.

| Axis | Danger tier | Confusion moment | Target disposition | Visibility today |
| --- | --- | --- | --- | --- |
| crds | 1 | "operator crash-loops after a clean apply" | observed / per-target | surfaced |
| crd-upgrade-behavior | 1 | "my CRD never upgraded" | per-target / refused | disclosed, incomplete |
| lookup-target-facts | 1 | "this field is empty/wrong" | per-target / refused | surfaced |
| getHostByName | 1 | "render depends on DNS I don't have" | refused / per-target | not scanned |
| generated-facts | 1 | "where's my password; is it stable?" | observed / per-target | surfaced |
| time-uuid-functions | 1 | "your parity proof can't be real" | observed (`deterministic:false`) | scanned, not surfaced |
| install-vs-upgrade | 1 | "upgrade did something install didn't" | routed | surfaced |
| hook-phase | 1 | "where does my hook go; did it run?" | observed / routed | partly tracked |
| hook-delete-policy | 1 | "cleanup/rerun behaved unexpectedly" | per-target | scanned, not surfaced |
| hook-weight-ordering | 1 | "things ran in the wrong order" | routed (sync-wave) | scanned, not surfaced |
| required-or-fail | 1 | "render just errored" | per-target (typed input) | surfaced |
| resource-policy-keep | 1 | "I deleted it but it's still there" | routed (disclosed) | not scanned |
| tpl-extension-slots | 2 | "where do I put custom config?" | routed | surfaced |
| explicit-extension-slot-control-points | 2 | "where's the supported injection point?" | routed | surfaced |
| import-values | 2 | "where did this value come from?" | routed (value-source-map) | not scanned |
| dependency-alias | 2 | "which subchart produced this object?" | routed | tracked by lock, not front door |
| library-chart | 2 | "where is this template defined?" | routed | tracked by lock, not front door |
| global-values | 2 | "one value changed many objects" | routed (value-source-map) | not scanned |
| post-renderer | 2 | "output doesn't match the templates" | routed / refused | not scanned |
| files-get | 2 | "a bundled file changed my config" | routed | scanned, not surfaced |
| capability-profile | 3 | "render isn't valid for my cluster" | per-target (envelope) | partly tracked |
| helm-version-branching | 3 | "output varies by Helm version" | per-target | not scanned |
| helm-flag-profile | 3 | "different flags → different output" | per-target | partly tracked |
| semver-compare | 3 | "render depends on a version I didn't pin" | per-target | scanned, not surfaced |
| values-schema | 3 | "what must I provide?" | per-target (input contract) | surfaced |
| dependency-lock | 3 | "which subchart versions did this assume?" | routed (pinned) | surfaced |

## Appendix B — vocabulary and mapping

**Dispositions:** observed (route + live receipt), routed (route named and
execution mode declared, evidence pending), per-target (catalog names the
decision; may recommend, never auto-picks), refused (not run automatically;
reason given).

**Hook-state → disposition mapping:** `route-selected → routed`;
`lifecycle-observed → observed`; `blocked-for-safety → refused`;
`blocked-target-dependent → per-target`; `inventoried`/`render-proven` are
pre-disposition and must converge.

**Related docs:** [hook-lifecycle-strategy.md](../user/hook-lifecycle-strategy.md)
(canonical hooks), `data/quirk-coverage/coverage.csv` (axis source of truth),
`data/disposition-frontier/` (the 99% instrument),
`data/chart-facts/chart-facts.csv` (per-chart facts),
[choose-your-path.md](../user/choose-your-path.md) (which surface to use).

## Appendix C — Review of #684 and notes for the loop

[#684](https://github.com/confighub/helm-expt/pull/684) ("Clarify hook routes
and expand promotion evidence") is a strong step. It publishes the user-facing
contract (`observed / routed / per-target / refused`), puts "read the chart row
first" in writing, states the no-silent-green production gate ("perfect render
parity and still incomplete if the route is only inventoried"), and adds four
honest variant-promotion receipts (external-secrets, ingress-nginx, cert-manager,
metrics-server) — each marked `watch`, with explicit `not-tested` limitations,
tracked to [#682](https://github.com/confighub/helm-expt/issues/682). Verifiers
green; generated views regenerated together.

The following are constructive follow-ups, **not blockers**. They are addressed
to the loop.

### Note 1 — answer "how does it get set up *for me*", not only "where"

**What #684 did:** the contract names *where* a hook goes (preflight, post-apply
Job, Argo hook, sync wave, ConfigHub check, target prerequisite).

**The gap:** the prose is passive about *who executes the route* ("it must be set
up as an explicit lifecycle operation"). The original user question had two
halves — *where does my hook go* (answered) and *how does it get set up for me*
(not yet). For `routed`, the honest current answer is "the route is named, but
**you** set it up." That is the necessary-vs-sufficient gap (§2): product/CLI
work, not a doc fix.

**Suggested action:** for each route, state whether the catalog executes it or
the user does. Where the catalog will execute it, that is Phase 3 (executed
routes). Until then, label it honestly so `routed` never reads as "automatic."

### Note 2 — split `refused` (final) from `blocked` (often unfinished)

**What #684 did:** the contract row is "`refused` or `blocked` — the public
catalog does not run that hook automatically."

**The gap:** these differ in a way that matters for the frontier. `refused` is a
deliberate, final decision. `blocked` can mean (a) unsafe/ambiguous (≈ refused),
(b) target-dependent (should be `per-target`), or (c) **not yet mapped** — which
is a `todo`, not a final disposition. If `blocked` reads as intentional,
unfinished work hides as a decision and the disposition frontier over-counts
completeness.

**Suggested action:** keep `refused` = deliberate/final (with the recorded
"why"); do not let `blocked`-as-unmapped count as a complete disposition — route
it to `per-target`, `refused`, or an explicit `todo` with a next action.

### Note 3 — one machine-readable vocabulary; retire the drift

**What #684 did:** published `observed / routed / per-target / refused` as the
user-facing words.

**The gap:** three vocabularies are now in play:
- the **published contract**: `observed / routed / per-target / refused`;
- the doc's older **engineering status list**:
  `inventoried / render-proven / route-selected / lifecycle-observed / blocked`;
- the **data** in `data/master-catalog-matrix/matrix.csv` `hook_disposition`,
  which currently carries `observed` (9 rows) and **`candidate-route`** (2 rows)
  — and `candidate-route` is not one of the four published words (closest:
  `routed`). `per-target` / `refused` are defined but not yet applied to any row.

**Suggested action:** make the data values *be* the published vocabulary (map
`candidate-route → routed`), or publish the mapping next to the contract table so
a reader — and an agent — can join the column to the words without guessing. This
is the literal prerequisite for Note 4.

### Note 4 — a default that just works needs a legible off-ramp (humans + agents)

**Context:** the proposed solution — and the spirit of competing with "helm just
runs" — is *a default that just works*: the installer picks a base, runs the
routes the current product flow can execute, names the routes it cannot yet
execute, and you get a running thing in one command when the chart's
disposition allows it.

**The requirement:** a default is only safe if **leaving it is just as easy and
legible** — for both humans and agents. Otherwise we trade Helm's total opacity
for "only the default is legible," and the first non-standard need is a cliff:
a different `per-target` route, a stricter/hardened base, supplying a non-default
value, or knowingly overriding a `refused` default. This is §3.7. Concretely,
for the loop:

- **Record alternatives, not just the chosen route.** Extend the `hook_*` columns
  (and the per-quirk disposition data behind them) to carry: the default route,
  the named alternatives, and each alternative's requirements/consequences.
- **Define one selection interface, two readers.**
  - *Human:* a discoverable flag (`cub installer setup --route <name>` /
    `--base <name>` / `--set ...`) and a first-class "follow a non-default route"
    walkthrough (sibling to `first-run-walkthrough.md`).
  - *Agent:* a stable machine-readable listing — routes + default + alternatives
    + requirements (e.g. `cub installer routes --json`, or in package metadata)
    — so an agent can enumerate and select without scraping prose.
- **Make `refused` overridable-with-acknowledgement**, distinct from `blocked`:
  the non-default "run it anyway" path should show the recorded reason and require
  an explicit acknowledgement — a switch a human or agent can flip knowingly.
  `blocked`-as-unmapped is not a switch (Note 2).
- **Depends on Note 3:** an agent cannot follow a non-default path if the route
  values are not a clean, stable enumeration.

**Done when:** for at least one Tier-1 chart, a human and an agent can each (a)
see the default that would be applied, (b) list the alternatives, and (c) select
a non-default route — with a captured transcript for each.

**Status:** a first machine-readable cut of this contract now exists in
[data/lifecycle-routes/](../../data/lifecycle-routes/summary.md) — every
hook/lifecycle row with its route, execution mode, default, alternatives, and
human/agent off-ramp, with
[routes.json](../../data/lifecycle-routes/routes.json) as the agent listing. See
[#688](https://github.com/confighub/helm-expt/issues/688).
