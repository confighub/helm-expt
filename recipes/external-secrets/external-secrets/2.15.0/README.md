# external-secrets/external-secrets 2.15.0 Proof

This is the promoted proof slice for the external-secrets public Helm chart.

Variants:

- `default`: chart defaults, CRDs marked for server-side apply, and a Job that creates the webhook Secret; 49 Helm objects, 50 cub installer objects including Namespace.
- `no-crds`: external-secrets CRDs disabled, with a Job that creates the webhook Secret; 24 Helm objects, 25 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- the no-crds variant deliberately removes the 23 external-secrets CRDs;
- CRD lifecycle, admission webhook, webhook Secret, disabled dependency, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
node scripts/package-updates.mjs --update external-secrets/external-secrets 2.15.0
node scripts/package-updates.mjs --verify-update external-secrets/external-secrets 2.15.0
```
