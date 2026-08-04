# jetstack/cert-manager v1.21.0 Proof

This is the promoted proof slice for the cert-manager public Helm chart.

Variants:

- `default`: chart defaults; 40 Helm objects, 41 cub installer objects including Namespace.
- `crds-enabled`: cert-manager CRDs included; 46 Helm objects, 47 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- the crds-enabled variant deliberately adds the six cert-manager CRDs;
- CRD lifecycle, admission webhook, Helm hook lifecycle, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run kubara-catalog-promotion:stage
npm run kubara-catalog-promotion:stage:verify
npm run kubara-catalog-promotion:dry-run
```
