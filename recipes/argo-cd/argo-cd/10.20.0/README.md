# argo-cd/argo-cd 10.20.0 Proof

This is the promoted proof slice for the Argo CD public Helm chart.

Variants:

- `default`: chart defaults; 54 Helm objects, 55 cub installer objects including Namespace.
- `no-crds`: Argo CD CRDs disabled; 51 Helm objects, 52 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default and no-crds variants make CRD ownership explicit;
- generated Secrets, built-in Redis, StatefulSet behavior, dependency metadata, and cluster RBAC are visible as scan/gate findings;
- extraObjects is a tpl-powered extension slot and remains empty in promoted variants;
- Argo CD can be installed as a chart while the ConfigHub OCI handoff remains the default delivery path for other catalog entries.

Useful commands:

```sh
node scripts/package-updates.mjs --update argo-cd/argo-cd 10.20.0
node scripts/package-updates.mjs --verify-update argo-cd/argo-cd 10.20.0
```
