# grafana/tempo 1.24.4 Proof

This is the promoted proof slice for the Tempo public Helm chart.

Variants:

- `local-persistent`: local backend with explicit WAL/traces PVC settings and kind-compatible StorageClass; 4 Helm objects, 5 cub installer objects including Namespace.
- `s3-query-observability`: S3 backend with external credential Secret, object-store dependency, query ingress, NetworkPolicy, and ServiceMonitor; 8 Helm objects, 9 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- the literal `grafana/tempo` chart is deprecated, and the proof records that fact instead of hiding it;
- `local-persistent` captures local single-binary storage and PVC settings;
- `s3-query-observability` uses a declared target Secret for S3 credentials, does not render a Secret, and adds query ingress, NetworkPolicy, and ServiceMonitor;
- `s3-query-observability` needs a reachable object-store endpoint and bucket for live readiness; this is recorded as a runtime prerequisite, not hidden as a Helm/ConfigHub mismatch;
- `s3-query-observability` records the Prometheus Operator ServiceMonitor CRD as a target prerequisite instead of hiding it in apply-time failure;
- storage backend, target fact, object-store runtime, ingress, NetworkPolicy, ServiceMonitor capability, StatefulSet runtime, chart deprecation, and raw/template extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run tempo:generate-proof
npm run tempo:generate-package
npm run tempo:verify-proof
npm run tempo:verify-package
npm run tempo:compare
```
