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
- **No controller** → **pull the OCI bundle and `kubectl apply`** (or let `cub` apply
  it directly). OCI still triggers the apply — it is the single source of truth.

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

## 6a. The careless-dev assumption (why lane G exists)
Most real breakage is **ordinary, not adversarial** — devs break tools through silly
choices we never anticipated, again and again. The evidence is the whole argument in one
number: Helm catches **~1%** of careless decisions at render; **~66%** vanish silently
(the `--set` footgun); **~33%** leak to the k8s API. So we fuzz random bad decisions **at
volume** and **name every outcome** — the careless dev, not the skeptic, is the most common
breaker, and a tool that silently swallows their mistakes is the failure mode to catch.

## 7. Live runs are serial and ephemeral
`cub-lk` is **kind under the hood** — one rig at a time (concurrent rigs starve nodes →
false blocks), torn down immediately after (`cub lk down --force`), orphan rigs/spaces
cleaned. Honest disposition throughout: `watch ≠ pass`; render parity ≠ live-ready;
promotion-proven ≠ production-proven.
