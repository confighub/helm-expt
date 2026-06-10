# bitnami/nginx 24.0.4 Proof

This is the promoted proof slice for the NGINX public Helm chart.

Variants:

- `http-clusterip`: image pinned by digest, TLS generation disabled, and service exposure kept internal; 5 Helm objects, 6 cub installer objects including Namespace.
- `existing-tls-ingress`: image pinned by digest and target TLS Secrets supply backend and ingress certificates; 6 Helm objects, 7 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart rendering is nondeterministic because Helm generates self-signed TLS material;
- `http-clusterip` disables generated TLS and renders a small internal service;
- `existing-tls-ingress` uses declared target TLS Secrets, does not render a Secret, and adds explicit ingress exposure;
- generated TLS, target fact, ingress, NetworkPolicy, PDB, deployment, static-site supply-chain, metrics, and raw/template extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run nginx:generate-proof
npm run nginx:generate-package
npm run nginx:verify-proof
npm run nginx:verify-package
npm run nginx:compare
```
