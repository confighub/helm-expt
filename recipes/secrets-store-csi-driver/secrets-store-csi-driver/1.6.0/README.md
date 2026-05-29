# secrets-store-csi-driver/secrets-store-csi-driver 1.6.0 Proof

This is the promoted proof slice for the Secrets Store CSI Driver public Helm chart.

Variants:

- `default`: chart defaults with CRDs, Linux DaemonSet, CSIDriver, and RBAC; 10 Helm objects, 11 cub installer objects including Namespace.
- `sync-secret-rotation`: Secret syncing, rotation, and provider health checks are explicit; 12 Helm objects, 13 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- the default variant keeps the chart defaults visible: SecretProviderClass CRDs, Linux DaemonSet, CSIDriver object, and cluster RBAC;
- the sync-secret-rotation variant deliberately adds synced Secret RBAC and driver flags for rotation and provider health checks;
- cloud/provider identity and SecretProviderClass behavior are not hidden Helm render inputs; they are explicit integration gates after render;
- CRD lifecycle, CSI driver lifecycle, privileged-node DaemonSet behavior, cluster RBAC, synced Secret ownership, rotation, and provider identity risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run secrets-store-csi-driver:generate-proof
npm run secrets-store-csi-driver:generate-package
npm run secrets-store-csi-driver:verify-proof
npm run secrets-store-csi-driver:verify-package
npm run secrets-store-csi-driver:compare
```
