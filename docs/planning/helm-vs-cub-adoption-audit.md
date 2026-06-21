# Helm vs cub: where would a user go back to Helm — and is it managed?

**UNOFFICIAL/EXPERIMENTAL.** The bar that actually matters for adoption: people want something
*better* than `helm install`, but they **avoid anything different or confusing**. So the gaps
worth hunting are not "cub is incomplete" — they are **"cub is worse than, or more confusing
than, plain Helm on the common journey, such that a user bails back to Helm."** And for each,
the question is: is it **solved** (as easy as Helm), or at least **managed** (guided, graceful,
surfaced), or an **unmanaged footgun**?

This audit scores the common chart journey. Evidence is the gap-hunt PRs (#1008–#1015) plus
direct CLI checks. It is deliberately balanced — cub wins are listed too.

## The scorecard

| Journey step | Helm as-is | cub today | Winner | Managed? | Evidence |
| --- | --- | --- | --- | --- | --- |
| **Install with defaults** (e.g. redis) | generates a **random per-install** password; runs + is unique | ships a **fixed shared** password (`confighub-redis-password`, same for everyone, committed) | **Helm** | ❌ **unmanaged** — base named `generated-passwords` misleads; no "replace me" warning | #1012 |
| **Customize one value** (`--set replicaCount=3`) | one flag, works | `--input replicaCount=3` → **rejected** (unknown input); must edit the base's kustomize | **Helm** | ❌ **unmanaged** — error is `unknown flag/input`, 0/72 idioms guided | #1009 |
| **Upgrade that removes a resource** | tracks release state, **prunes** the removed object | cub-direct (`kubectl apply`) **orphans** it | **Helm** (vs cub-direct) | ⚠️ **partial** — Argo/Flux prune; cub-direct is silent | #1013 |
| **First install of a CRD chart** (cert-manager) | installs CRDs first, works | cub-direct **fails** (CR before CRD established) | **Helm** (vs cub-direct) | ⚠️ **partial** — controllers handle it; cub-direct fails | #1015 |
| **Uninstall** (`helm uninstall x`) | one command, per release | `cub unit destroy` (+ delete/space cleanup); per-unit, Unit/Space concepts | **Helm** (ergonomics) | ⚠️ **partial** — capability exists, no `uninstall` verb | CLI check |
| **Rollback** (`helm rollback x 2`) | one command, per release | `cub unit apply --revision N`; per-unit, revision numbers | **Helm** (ergonomics) | ⚠️ **partial** — capability exists, **no `rollback` verb** | CLI check |
| **Typo a value** (`--set replicaCont=3`) | **silently absorbed** (Helm's footgun) | **rejected** (`unknown input`) | **cub** | ✅ caught at the tool | #1008 |
| **Review what will change** before apply | none native (diff plugin) | **deterministic** config-as-data diff | **cub** | ✅ | #1011 |
| **Detect drift** after deploy | nothing | `cub-scout` detects (misses env, but real) | **cub** (net-new) | ✅ partial | #1014 |

## The pattern that decides adoption

cub's wins are **downstream** — config review, determinism, typo-catching. Its losses are in the
**first three steps a user takes** — install, customize, upgrade — and those losses are
**unmanaged** (a silent shared password, an opaque `unknown flag`, a silent orphan). A Helm user
evaluating cub hits the *losses first* and **bails before ever reaching the wins.** That is the
adoption trap: "better, but I bounced off the confusing part."

So the rule this audit argues for: **a worse-than-Helm step is only acceptable if it is managed.**
Unmanaged worse-than-Helm steps on the first-run path are adoption-fatal regardless of how good
the downstream model is.

## What "managed well" looks like (the fixes)

| Loss | Solve (make it as easy as Helm) | …or manage (guide / graceful / surfaced) |
| --- | --- | --- |
| Shared default password (#1012) | generate real per-install entropy in the default base | rename `generated-passwords` → `placeholder-passwords`; print "this is a placeholder, replace before prod" at setup |
| Customize friction (#1009) | expose the common values (replicas, resources, image) as declared inputs | migration guidance in errors (`--set` → "use `--input`/edit the base; see `cub installer doc`"); the cheat-sheet (#1010) |
| cub-direct upgrade orphans (#1013) | the cub-direct applier uses `kubectl apply --prune` (allowlist) | default users to a controller for upgrades; state cub-direct's limits in the doctrine |
| cub-direct CRD first-install (#1015) | apply CRDs first + wait in the cub-direct applier | same — default to a controller for CRD-bearing charts |
| Uninstall / rollback ergonomics | add `cub rollback` / `cub uninstall` aliases over `unit apply --revision` / `unit destroy` | cover them in the migration cheat-sheet so a Helm user finds them |

## Honest: where cub genuinely beats Helm (so we don't only sell the model on these)

Typo-catching (declared inputs reject what Helm absorbs, #1008), deterministic renders that make
a config-as-data diff trustworthy (#1011), and drift detection Helm doesn't have (#1014). These
are real — but they are **earned after** the first-run friction is managed, not before.

## Next hunts (still under this lens: worse-than-Helm + managed?)

- A concrete **side-by-side journey proof**: same task (install redis, set one value, upgrade)
  via Helm vs via cub, counting steps + outcomes.
- Secret **rotation** (change a password): one `helm upgrade` vs the cub flow.
- Server-side-apply **field-ownership** conflicts on re-apply (cub-direct vs Helm).
