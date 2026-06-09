# argo-cd/argo-cd 9.5.15 Proof

This is the promoted proof slice for the Argo CD public Helm chart.

Variants:

- `default`: chart defaults; 49 Helm objects, 50 cub installer objects including Namespace.
- `no-crds`: Argo CD CRDs disabled; 46 Helm objects, 47 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default and no-crds variants make CRD ownership explicit;
- generated Secrets, built-in Redis, StatefulSet behavior, dependency metadata, and cluster RBAC are visible as scan/gate findings;
- extraObjects is a tpl-powered extension slot and remains empty in promoted variants;
- Argo CD can be installed as a chart while the ConfigHub OCI handoff remains the default delivery path for other catalog entries.

Useful commands:

```sh
npm run argo-cd:generate-proof
npm run argo-cd:generate-package
npm run argo-cd:verify-proof
npm run argo-cd:verify-package
npm run argo-cd:compare
```
