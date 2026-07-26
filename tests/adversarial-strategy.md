# Depth-probe strategy — adversarial, multi-persona, tier-aware

_The adversarial-persona UX-test layer of the [helm-expt test map](README.md)._

**Status:** DRAFT (2026-06-01). Proves *how users actually use the catalog in ConfigHub* (not just
that it installs) before broadening 20→100. Output = a usage-readiness scorecard that becomes the
admission check for the 100.

**Core move:** *persona-drivers* run each archetype the way a real user would, at a given **tier**;
*multi-lens adversaries* try to refute that it worked **and** that it beat the tier-appropriate
alternative. A cell is PROVEN only if it survives every lens.

## Tiers (must work free AND paid)
| Tier | What it is | Unlocks | The "better than…" bar |
|---|---|---|---|
| **T0 — local/free** | no/minimal account; render + local kind install; secret-free or out-of-band secret | install · Helm-equivalence · default fork | better than **plain `helm install`** locally |
| **T1 — connected (free account)** | authenticated ConfigHub Spaces/Units/OCI/Argo | derived variants · env promotion · gates/approvals · revisions/rollback · parameterized fills | better than **Helm + manual review/GitOps** |
| **T2 — paid/managed/enterprise** | ConfigHub Server, managed overlays, ESO+Vault+rotation, fleet/promotion-waves | managed/customer overlays · paid secret rungs · fleet ops | the paid delta is **worth it over T1 + DIY** |

The probe runs the tiers available in the environment (`args.tiers`, default `["T0","T1"]`). T2 cells
without a paid env are marked **`REQUIRES-PAID`**, not faked. The free path must be a *complete, honest*
experience — never a teaser that breaks at a paywall (that's what adversary **A4** hunts).

## Matrix: archetypes × usage-dimensions × tiers
| Archetype | role |
|---|---|
| nginx | stateless web |
| postgresql | secret-needing DB |
| cert-manager / external-secrets | CRD operator |
| vault *or* loki | HA stateful |

| Usage dimension | tiers |
|---|---|
| install + Helm-equivalence (the floor) | T0 |
| derived variant → env promotion + gates/approvals | T1, T2 |
| parameterized base + placeholder fills | T1 |
| day-2 edit (image/replicas) → **rollback** | T1 |
| governed secret fork (existing-secret + required-secret gate) | T1; ESO+Vault rotation = T2 |

## Persona drivers (Sonnet, rig-bound — *run it as that user, at their tier*)
- **Newcomer / app-dev (T0→T1):** default just-works + one fill. Tests honest-default + obvious-steps.
- **Platform engineer (T1):** derive → promote `default → prod-us-east`, set gates/labels/approvals. Tests the derived-variant value.
- **SRE (T1):** day-2 image/replica edit, then **rollback**; recover from a break. Tests day-2/upgrade/rollback.
- **Security/governance (T1, T2):** existing-secret fork + required-secret gate + approve-before-apply + delete gate; ESO/Vault rung at T2. Tests F3-fix + governance teeth.
Drivers **discover the exact `cub` commands** (via `--help` / the `cub-mutate`/`cub-apply`/`create-initiative` skills) — they must NOT invent flags.

## Adversaries (Opus, read-only / no-rig — *refute the claim*)
- **A1 · False-green hunter** — prove it *live*: promotion actually landed in `prod-us-east` (kubectl that env), the gate actually blocked an unapproved apply, rollback actually reverted the *running* field, the secret is actually consumed. Three-way + receipts.
- **A2 · "Better-than-the-alternative" critic (tier-aware thesis adversary)** — build the tier-appropriate alternative and compare:
  - T0 vs `helm install`; T1 vs `helm + manual GitOps/review`; T2 vs `T1 + DIY`.
  - Did ConfigHub add real value (reviewable diff, approval, provenance, drift-heal, env-promotion, fleet) — or just ceremony? If no net gain → **`WORSE-THAN-ALTERNATIVE`** (a thesis failure — weighed heavier than a crash).
- **A3 · Chaos adversary** — manual `kubectl` drift (self-heals + surfaces?), apply-without-approval (blocked?), a fill that *secretly changes object shape* (caught as boundary violation?), upgrade schema-diff, wrong-env target.
- **A4 · Tier-honesty critic** — does the free-tier path complete end-to-end, or hit a *silent* paywall / a feature that looks available but needs paid? Is each tier's boundary explicit and honest? Flags **`PAYWALL-SURPRISE`**.

## Cell protocol & verdicts
Persona drives live (at tier) → emits receipts → A1–A4 attack independently → verdict:
`PROVEN` (survives all) · `FINDING` (≥1 substantive refute) · `WORSE-THAN-ALTERNATIVE` (A2) · `PAYWALL-SURPRISE` (A4) · `REQUIRES-PAID` (T2 cell, no paid env).

## Scorecard → admission check for the 100
Output: `archetype × usage-dim × tier → verdict`, plus a per-tier thesis verdict ("is ConfigHub better than the alternative at T0 / T1 / T2?"). Usage patterns that come back PROVEN at a tier become **required cells in the 100-chart admission check at that tier** — so we broaden only on usage that's proven *and tier-honest*, not just installable.

## Capacity & free-tier execution
- Runs **now at free tier** (`cub cluster up` = free account + kind = T0/T1). T2 cells need a paid env → `REQUIRES-PAID` until one is supplied.
- **Cluster-bound:** process archetypes **sequentially** (one cub-managed cluster per archetype, reused across its usage dimensions); adversaries are read-only → fan out freely. ~4 archetypes × ~4 usage dimensions ≈ 16 cells — multi-hour but bounded; heavy archetypes such as Vault get a dedicated cluster.

## Runnable Shape

Use an agent workflow or equivalent runner to fan out by tier:
drive the scenario, run the adversarial checks, then synthesize the scorecard.
The runner should accept inputs equivalent to:

```text
tiers: ["T0", "T1"]
archetypes: [...]
```
