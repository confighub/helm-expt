# Credential own-goal — scoping (read-only)

**Date:** 2026-06-30 · **Status:** scoping only — **no recipe/package files were modified.** This documents a confirmed integrity gap and lays out fix options for a per-chart decision.

## The contradiction

The site sells a security promise — homepage Preview card and Get Started Step 3 ("Catch a classic mistake first"): *cub renders to files, so you catch a baked-in Secret and fix it before the cluster sees it.* But the **default** install path for the stateful charts ships exactly that footgun: a hardcoded, shared password.

## What's actually in the packages

For five charts, the `generated-passwords` base:

- is **`default: true`** — the base a normal `cub installer setup` uses;
- has a `kustomization.yaml` of just `resources: [upstream.yaml]` — **no transformer, no generation step**;
- carries a `kind: Secret` whose password is a **hardcoded, human-readable placeholder** (`confighub-<chart>-…-password`), base64-encoded in `data:`, **identical on every install**. Anyone can `base64 -d` the committed file and read it.

Each chart **also** ships a safe `existing-secret*` base (bring-your-own Secret) — but it is **not** the default.

### Per-chart table

| Chart | Versions with gen-pw | gen-pw = default? | Regen logic | Frozen Secret value(s), decoded | Safe sibling base | Helm fresh-install default\* |
|---|---|---|---|---|---|---|
| bitnami/postgresql | 18.6.7, 18.6.10, 18.7.0 | yes | none (frozen) | `postgres-password` = `confighub-postgres-password` | `existing-secret` | random per install |
| bitnami/mysql | 14.0.3 | yes | none (frozen) | `mysql-root-password` = `confighub-mysql-root-password`; `mysql-password` = `confighub-mysql-user-password` | `existing-secret` | random per install |
| bitnami/mongodb | 19.0.7, 19.0.9, 19.1.0 | yes | none (frozen) | `mongodb-root-password` = `confighub-mongodb-root-password` | `existing-secret-replicaset` | random per install |
| bitnami/rabbitmq | 16.0.14 | yes | none (frozen) | `rabbitmq-password` = `confighub-rabbitmq-password`; `rabbitmq-erlang-cookie` = `confighub-rabbitmq-erlang-cookie` | `existing-secret` | random per install |
| grafana/grafana | 10.5.15 | yes | none (frozen) | `admin-password` = `confighub-grafana-admin-password` | `existing-secret-ingress` | random admin password |

\* Helm's default is inferred from how these charts behave (Bitnami `common.secrets.passwords.manage` / grafana admin-password generation): on a fresh install with no password supplied and no existing secret, they generate a random password. **Confirm against the chart templates before relying on it in site copy.**

## Why it's an own-goal, not just a bug

A security reviewer doesn't read the marketing — they scan the rendered output. They find a Secret with a password that is **identical and decodable across every install**, under a base named "generated-passwords," shipped by the vendor selling "we catch baked credentials." That is worse than never making the claim. And on a fresh install plain Helm is **more** secure here, because it generates a random password per install.

The `rabbitmq` case is slightly worse: the **erlang cookie** (the cluster-membership shared secret) is frozen too, so every install of the default base trusts the same cluster secret.

## Fix options (same shape for every chart)

1. **Honesty-only (smallest, stops the contradiction):** rename `generated-passwords` → `static-passwords` / `demo-passwords` (the name lies — it generates nothing) and add a loud warning. Does not fix the weak default, but the label stops contradicting the bytes.
2. **Safer default:** make `existing-secret*` the `default: true` base and keep static-passwords as an explicitly-labelled demo. The default then ships **no** credential — which is what "we don't ship credentials" claims.
3. **Real generation (closest to the promise):** add a render-time function that generates a fresh password per install, so `generated-passwords` does what its name says. Keep `existing-secret*` for bring-your-own.

**Recommended:** **2 + 3** — default to `existing-secret`, and offer a renamed real-generation base — with **1** as the immediate stop-the-bleeding rename.

## Verification fallout (why execution is non-trivial)

Changing the rendered Secret re-renders those bases and re-records their receipts, which ripples into the matrix / frontier / audit surfaces (the recording cascade). Execution is a catalog-generation change with verification work, scoped per chart/version (~9 package versions in the table above).

## Not done here

No recipe or package files were modified. This is analysis only, to support a per-chart decision before any execution.
