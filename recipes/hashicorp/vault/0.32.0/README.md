# hashicorp/vault 0.32.0 Proof

This is the promoted proof slice for the Vault public Helm chart.

Variants:

- `dev-mode`: Vault dev server starts initialized and unsealed for local proof/demo use; 11 Helm objects, 12 cub installer objects including Namespace.
- `default`: chart defaults with server StatefulSet and injector webhook; 12 Helm objects, 13 cub installer objects including Namespace.
- `ha-raft-ui`: HA Raft storage and UI service are explicit; 18 Helm objects, 19 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- the default variant keeps the chart defaults visible: Vault StatefulSet, injector webhook, ClusterRole permissions, services, and TLS-disabled listener config;
- the ha-raft-ui variant deliberately enables integrated Raft HA and UI exposure;
- the dev-mode variant deliberately uses the upstream local dev server path so Vault can be tried without pretending init/unseal is solved;
- init, unseal, recovery material, and seal migration are not hidden Helm render inputs; they are post-render operating controls;
- the HA Raft variant is explicit about target topology: three server replicas need an appropriate target, while one-node kind remains a parity target;
- TLS posture, injector webhook, RBAC, service exposure, StatefulSet storage, and Secret/env extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run vault:generate-proof
npm run vault:generate-package
npm run vault:verify-proof
npm run vault:verify-package
npm run vault:compare
```
