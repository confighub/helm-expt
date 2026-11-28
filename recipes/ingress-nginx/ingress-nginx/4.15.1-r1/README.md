# ingress-nginx/ingress-nginx 4.15.1-r1 Proof

This is the promoted proof slice for the ingress-nginx public Helm chart.

Variants:

- `default`: chart defaults; 18 Helm objects, 19 cub installer objects including Namespace.
- `admission-disabled`: controller admission webhook disabled; 9 Helm objects, 10 cub installer objects including Namespace.
- `internal-clusterip`: admission webhook disabled and controller Service set to ClusterIP; 9 Helm objects, 10 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- the admission-disabled variant deliberately removes admission webhook objects;
- the internal-clusterip variant keeps the admission-disabled object set and fits targets without external LoadBalancer assignment;
- the default base keeps the admission certificate Jobs, and differs from Helm only where its kustomization says;
- admission webhook, Helm hook lifecycle, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
HELM_EXPT_PACKAGE_REVISION=1 node scripts/ingress-nginx-proof.mjs --generate-proof
HELM_EXPT_PACKAGE_REVISION=1 node scripts/ingress-nginx-proof.mjs --generate-package
HELM_EXPT_PACKAGE_REVISION=1 node scripts/ingress-nginx-proof.mjs --verify-proof
HELM_EXPT_PACKAGE_REVISION=1 node scripts/ingress-nginx-proof.mjs --verify-package
```
