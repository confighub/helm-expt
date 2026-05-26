# hashicorp/consul 2.0.0 Proof

This is the promoted proof slice for the Consul public Helm chart.

Variants:

- `default-control-plane`: chart-default control plane with server, injector, webhook cert manager, CRDs, and RBAC; 70 Helm objects, 71 cub install objects including Namespace.
- `secure-mesh-existing-secrets`: TLS, ACLs, gossip encryption, mesh gateways, and UI ingress with existing Secrets; 99 Helm objects, 100 cub install objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub install setup`, plus the explained Namespace support object;
- `default-control-plane` captures the chart-default Consul posture, including disabled TLS/ACLs, server StatefulSet, injector webhook, webhook cert manager, 28 CRDs, and RBAC;
- `secure-mesh-existing-secrets` enables TLS, ACLs, gossip encryption, mesh gateways, and UI ingress using declared target Secrets;
- CRD ownership, cluster RBAC, admission webhooks, lifecycle Jobs, rendered Secrets, StatefulSet storage, gateway topology, UI ingress, and raw/template extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run consul:generate-proof
npm run consul:generate-package
npm run consul:verify-proof
npm run consul:verify-package
npm run consul:compare
```
