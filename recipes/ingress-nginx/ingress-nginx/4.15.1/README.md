# ingress-nginx/ingress-nginx 4.15.1 Proof

This is the promoted proof slice for the ingress-nginx public Helm chart.

Variants:

- `default`: chart defaults; 11 Helm objects, 12 cub installer objects including Namespace.
- `admission-disabled`: controller admission webhook disabled; 9 Helm objects, 10 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- the admission-disabled variant deliberately removes admission webhook objects;
- admission webhook, Helm hook lifecycle, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run ingress-nginx:generate-proof
npm run ingress-nginx:generate-package
npm run ingress-nginx:verify-proof
npm run ingress-nginx:verify-package
npm run ingress-nginx:compare
```
