# metrics-server/metrics-server 3.13.0 Proof

This is the promoted proof slice for the metrics-server public Helm chart.

Variants:

- `default`: chart defaults; 9 Helm objects, 10 cub install objects including Namespace.
- `external-tls-ca`: target Secret plus explicit APIService CA bundle; 9 Helm objects, 10 cub install objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub install setup`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- the existing-secret TLS path avoids Helm lookup and generated certificate material by making the target Secret explicit;
- APIService and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run metrics-server:generate-proof
npm run metrics-server:generate-package
npm run metrics-server:verify-proof
npm run metrics-server:verify-package
npm run metrics-server:compare
```
