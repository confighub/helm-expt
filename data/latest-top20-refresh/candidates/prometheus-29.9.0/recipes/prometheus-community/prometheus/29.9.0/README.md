# prometheus-community/prometheus 29.9.0 Proof

This is the promoted proof slice for the Prometheus public Helm chart.

Variants:

- `default`: chart defaults with server, Alertmanager, exporters, PVC, and RBAC; 23 Helm objects, 24 cub installer objects including Namespace.
- `server-only-ephemeral`: only the Prometheus server is rendered and persistence is disabled; 6 Helm objects, 7 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- the default variant keeps the bundled monitoring stack visible: Prometheus server, Alertmanager, kube-state-metrics, node-exporter, pushgateway, server PVC, services, and cluster RBAC;
- the server-only-ephemeral variant deliberately removes bundled components and server persistence;
- scrape config, remote read/write, ingress, network policy, PDB, and extra manifests are not hidden Helm behavior; they are explicit variant/review surfaces;
- dependency ownership, storage/retention, workload rollout, cluster RBAC, and scrape-config risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run prometheus:generate-proof
npm run prometheus:generate-package
npm run prometheus:verify-proof
npm run prometheus:verify-package
npm run prometheus:compare
```
