# Helm Quirk Support Matrix

**UNOFFICIAL/EXPERIMENTAL**

This page says, for each Helm quirk class, what happens to it at each of the
seven lifecycle stages — and what is *not* claimed. Cells use cautious verbs:

```text
detected   the analysis stage records that the quirk exists
routed     the quirk is classified and sent down a named path
rendered   the quirk's output is part of the exact rendered object set
proven     a committed receipt or parity lane covers it
recorded   the requirement is written down with the package/variant
checked    a live lane verifies it against a cluster
manual     a human decision is required; the repo says so instead of guessing
```

The seven stages:

```text
1 source/chart analysis    2 recipe/package creation   3 render parity
4 ConfigHub upload         5 derived variants          6 GitOps/OCI delivery
7 live observation / operations
```

## The Matrix

| Quirk | 1 Analysis | 2 Recipe/package | 3 Render parity | 4 Upload | 5 Derived variants | 6 Delivery | 7 Live |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CRDs | detected | split into explicit bases (`crds` / `no-crds`) | rendered + proven against the pinned capability profile | stored as Units | ownership change routes back to a base | CRD owner is a recorded prerequisite | presence/established checked; capability mismatches become watchlist rows |
| Helm hooks | detected + phase classified | routed: desired objects, pre-install prerequisite, post-install lifecycle, controller-owned runtime, or unsupported/manual | hook objects rendered when routed as desired objects | stored when routed as objects | no hook semantics added post-render | the hook route decides what ships | hook **route** receipts exist; hook **execution** receipts do not yet |
| Generated secrets/certs/passwords | detected | rendered, then separated out of the publishable artifact | secret objects included in parity | references recorded; secret material **not** uploaded | references bind via target facts | separated secrets applied out-of-band first | presence checked pre-flight; missing-secret false greens caught at runtime |
| `lookup` | detected | lifted into declared target facts; no live reads at render | deterministic render proven (no hidden cluster reads) | facts recorded with the package | facts bound per target | facts are recorded prerequisites | facts checked live before reliance |
| `.Capabilities` | detected | pinned to a named capability profile | proven **against that profile only** | profile recorded | n/a post-render | target cluster must match the profile, or re-render | profile mismatches surface as watch/blocked rows, not silent passes |
| `tpl` | detected | rendered normally (render-time construct) | covered by render parity | stored like any objects | user-payload `tpl` routes to extension-slot review | ships as reviewed output | no special live handling; field provenance through templates is not claimed |
| Raw manifests / extraObjects (extension slots) | detected | empty slots stay in base; populating one creates a **new reviewed base** | populated slot output enters parity | stored | populating a slot post-render routes back to a base | ships as reviewed | closed-world live check can flag unexpected extra objects |
| RBAC | detected | rendered explicitly and reviewable | proven, with server-normalization cases routed to the watchlist | stored | RBAC edits route back to a base | cluster-permission review is a recorded prerequisite | strict witness compares rendered vs live RBAC |
| Webhooks | detected | rendered; cert/CA wiring classified as controller-owned runtime state | authored fields proven; controller-populated fields excluded by design | stored | n/a | webhook/cert readiness is a recorded prerequisite | controller-owned behavior demonstrated by lifecycle observations on selected charts |
| Storage / PVCs | detected | storage choices are base variants; StorageClass is a target fact | proven | stored | class/size binding via facts where the base exposes them | StorageClass is a recorded prerequisite | PVC binding checked at runtime |
| External dependencies / target facts | detected | recorded as installer requirements and variant target facts | parity covers references, not the external thing itself | requirements recorded; no external material stored | bound per target | recorded prerequisites | checked live pre-flight |

## What Is Proven Versus Routed, Per Quirk

Honest status, with the evidence trail:

- **Hooks are classified and routed, not solved.** Five of five maintained
  hook-bearing top-100 charts have hook *route* receipts; zero have hook
  *execution or observation* receipts. The routes are: desired objects,
  pre-install prerequisites, post-install lifecycle, controller-owned runtime
  state, or unsupported/manual. See
  [Hook Lifecycle Strategy](../user/hook-lifecycle-strategy.md) and
  [data/hook-lifecycle](../../data/hook-lifecycle/summary.md).
- **`.Capabilities` claims are profile-bounded.** Parity is proven against the
  pinned Kubernetes capability profile, currently 1.30. The strict witness
  caught real consequences: cert-manager and External Secrets CRDs author
  `selectableFields`, which the 1.30 API drops — routed as watchlist rows, and
  parity for that profile is *not* claimed. A follow-up live witness proves the
  same rendered CRDs preserve `selectableFields` on the
  `kind-kubernetes-1.35` profile, so the route is capability-profile-specific
  evidence rather than silent normalization. See
  [What We Refuse To Claim](../user/what-we-refuse-to-claim.md).
- **Generated secrets never hide in the artifact.** They are rendered for
  parity, separated out of the publishable set, recorded as expected external
  references, and verified live pre-flight. The missing-secret
  silent-false-green class is caught at runtime by the strict witness. See
  [Why Synced Is Not Working](../user/why-synced-is-not-working.md).
- **`lookup` is removed, not emulated.** Charts that read the cluster at
  render time are re-expressed with declared target facts so renders stay
  deterministic; the facts are then checked against the real cluster before
  anyone relies on them.
- **RBAC and server normalization are watch material, not silent passes.**
  Where the API server normalizes authored RBAC (for example, empty rules),
  the strict witness blocks and the row is routed to the watchlist until the
  behavior is modeled or accepted.
- **Webhook CA wiring is deliberately out of the authored claim.**
  Controller-populated fields are classified as controller-owned runtime
  state; lifecycle observations on cert-manager and External Secrets
  demonstrate the pattern. That demonstrates the observation pattern, not
  universal webhook support.
- **`tpl` and template provenance:** rendered output is fully covered by
  parity, but tracing a live field back to the template line or values key
  that produced it is not claimed.
- **Extension slots are a routing rule, not a feature claim.** Leaving a slot
  empty stays inside a supported base; populating one creates a new install
  shape that must re-enter review. See
  [Extension Slots](../user/extension-slots.md).

## How To Read A Gap

A quirk cell that says *routed*, *recorded*, or *manual* is not a euphemism
for "works." It means the repo knows about the case, has a named path for it,
and will not silently pretend it passed. The generated status pages say which
charts currently sit on which path:
[top-100 user readiness](../../data/top100-user-readiness/summary.md),
[the watchlist](../../data/live-e2e/cub-scout-watchlist.md), and
[current proof status](../user/current-proof-status.md).
