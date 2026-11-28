# jetstack/cert-manager v1.21.3 Proof

This is the promoted proof slice for the cert-manager public Helm chart.

Variants:

- `default`: cert-manager CRDs included; 46 Helm objects, 47 cub installer objects including Namespace.
- `crds-enabled`: cert-manager CRDs included, the same as default; 46 Helm objects, 47 cub installer objects including Namespace.
- `no-crds`: chart defaults, which leave the CRDs out; 40 Helm objects, 41 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- the default and crds-enabled variants render the six cert-manager CRDs, and the no-crds variant leaves them out;
- CRD lifecycle, admission webhook, Helm hook lifecycle, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
node scripts/package-updates.mjs --update jetstack/cert-manager v1.21.3
node scripts/package-updates.mjs --verify-update jetstack/cert-manager v1.21.3
```
