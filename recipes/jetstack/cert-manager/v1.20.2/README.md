# jetstack/cert-manager v1.20.2 Proof

This is the promoted proof slice for the cert-manager public Helm chart.

Variants:

- `default`: chart defaults; 42 Helm objects, 43 cub install objects including Namespace.
- `crds-enabled`: cert-manager CRDs included; 48 Helm objects, 49 cub install objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub install setup`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- the crds-enabled variant deliberately adds the six cert-manager CRDs;
- CRD lifecycle, admission webhook, Helm hook lifecycle, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run cert-manager:generate-proof
npm run cert-manager:generate-package
npm run cert-manager:verify-proof
npm run cert-manager:verify-package
npm run cert-manager:compare
```
