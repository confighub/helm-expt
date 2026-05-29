# grafana/loki 7.0.0 Proof

This is the promoted proof slice for the Loki public Helm chart.

Variants:

- `single-binary-filesystem`: single-binary Loki with filesystem storage and explicit schema config; 19 Helm objects, 20 cub installer objects including Namespace.
- `simple-scalable-minio`: simple scalable Loki with explicit object-storage buckets and MinIO enabled; 36 Helm objects, 37 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart rendering is blocked until Loki storage bucket/schema values are supplied, and that blocker is recorded;
- the single-binary-filesystem variant provides the smallest local-test topology with filesystem storage;
- the simple-scalable-minio variant provides an object-storage path with explicit bucket names and a chart-owned MinIO fixture;
- storage/schema, dependency lock, object-store Secret, ClusterRole/RBAC, StatefulSet/PVC, lifecycle, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run loki:generate-proof
npm run loki:generate-package
npm run loki:verify-proof
npm run loki:verify-package
npm run loki:compare
```
