# metrics-server/metrics-server 3.13.1 Proof

This is the promoted proof slice for the metrics-server public Helm chart.

Variants:

- `default`: chart defaults plus explicit kind-compatible kubelet TLS flag; 9 Helm objects, 10 cub installer objects including Namespace.
- `external-tls-ca`: target Secret plus explicit APIService CA bundle; 9 Helm objects, 10 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- the existing-secret TLS path avoids Helm lookup and generated certificate material by making the target Secret and matching APIService CA bundle explicit;
- APIService and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run kubara-catalog-promotion:stage
npm run kubara-catalog-promotion:stage:verify
npm run kubara-catalog-promotion:dry-run
```
