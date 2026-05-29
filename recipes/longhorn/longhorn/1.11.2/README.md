# longhorn/longhorn 1.11.2 Proof

This is the promoted proof slice for the Longhorn public Helm chart.

Variants:

- `default`: chart defaults with CRDs, manager DaemonSet, driver deployer, UI, and storage settings; 41 Helm objects, 42 cub installer objects including Namespace.
- `ui-ingress`: default Longhorn plus an explicit UI Ingress; 42 Helm objects, 43 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- both variants render the 22 Longhorn CRDs as ordinary, digest-bound objects;
- the ui-ingress variant deliberately adds Longhorn UI exposure with host and ingress class captured before render;
- CRD lifecycle, pre-upgrade hook lifecycle, admission/recovery observation, cluster RBAC, privileged storage workload, StorageClass/default-setting, and UI ingress risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run longhorn:generate-proof
npm run longhorn:generate-package
npm run longhorn:verify-proof
npm run longhorn:verify-package
npm run longhorn:compare
```
