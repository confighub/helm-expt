# NGINX Use-More-Now Target Plan

## Decision

NGINX is the next live evidence target after Redis.

## Why NGINX

NGINX is the right next chart because it is the easiest happy-path contrast
with Helm:

```text
install a common web component
see the exact objects
scan the uploaded Units
prove target facts for the TLS/Ingress variant
stop before live apply unless a target exists
```

It is also not trivial. The current recipe has two candidate variants:

| Variant | Why It Matters |
| --- | --- |
| `http-clusterip` | simple baseline that should feel easier than Helm |
| `existing-tls-ingress` | proves target facts for existing TLS Secrets and ingress exposure |

## Acceptance Contract

Before NGINX can become catalog-supported, the live evidence lane should prove:

- `cub install doc/setup/render/package/vet/plan/upload` for `http-clusterip`;
- ConfigHub function scan over uploaded Units;
- safe-ops lane with changeset, approval, and blocked/no-target apply behavior;
- target-fact visibility for `existing-tls-ingress`;
- no production support claim until ingress, TLS Secret ownership,
  NetworkPolicy, PDB, deployment rollout, and extension-slot warnings have
  explicit dispositions.

## Current Status

NGINX is currently a `catalog-candidate`, not catalog-supported. The machine
proof already shows Helm equivalence:

```text
http-clusterip: 5 Helm objects, 6 cub install objects including Namespace
existing-tls-ingress: 6 Helm objects, 7 cub install objects including Namespace
```

The next PR should repeat the Redis use-more-now transcript shape for NGINX,
starting with `http-clusterip`.

