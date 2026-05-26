# hashicorp/vault 0.32.0 Proof

This is the promoted proof slice for the Vault public Helm chart.

Variants:

- `default`: chart defaults with server StatefulSet and injector webhook; 12 Helm objects, 13 cub install objects including Namespace.
- `ha-raft-ui`: HA Raft storage and UI service are explicit; 18 Helm objects, 19 cub install objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub install setup`, plus the explained Namespace support object;
- the default variant keeps the chart defaults visible: Vault StatefulSet, injector webhook, ClusterRole permissions, services, and TLS-disabled listener config;
- the ha-raft-ui variant deliberately adds HA Raft discovery, PDB, active/standby services, and UI service exposure;
- Vault init/unseal and recovery material are not hidden Helm render inputs; they are explicit operate-policy gates after render;
- TLS posture, injector webhook, RBAC, service exposure, StatefulSet storage, and Secret/env extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run vault:generate-proof
npm run vault:generate-package
npm run vault:verify-proof
npm run vault:verify-package
npm run vault:compare
```
