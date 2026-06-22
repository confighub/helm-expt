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
`generated-passwords` must not quietly contain fixed shared credentials.

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
`cub-lk` is **kind under the hood** — one rig at a time (concurrent rigs starve nodes →
false blocks), torn down immediately after (`cub lk down --force`), orphan rigs/spaces
cleaned. Honest disposition throughout: `watch ≠ pass`; render parity ≠ live-ready;
promotion-proven ≠ production-proven.
