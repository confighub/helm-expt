# Hard Chart Production Packets

This generated packet set gathers the evidence for the charts most likely to
raise serious production questions. It does not create new support claims. It
joins existing production support decisions, production disposition rows, base
readiness, chart-use guidance, extension-slot routing, and per-chart pain
reports.

Use this when a reviewer asks whether the model survives hard Helm charts:
operators, CRDs, hooks, webhooks, storage, security-sensitive systems, GitOps
control planes, and high-fanout monitoring stacks.

## Summary

```text
packet charts: 8
supported for a declared target scope: 6
rejected for production support: 1
superseded: 0
production-disposition blocked: 1
```

## Packets

| Chart | Supported base | Decision | Production disposition | Safe today | Packet |
| --- | --- | --- | --- | --- | --- |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | supported | production-review-ready | Use the default base only inside the declared support scope while keeping the target-scoped evidence fresh. Treat no-crds and h... | [packet](./packets/prometheus-community-kube-prometheus-stack.md) |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | supported | production-review-ready | Use crds-enabled as the first supported base. Treat issuer/provider/hardened resource shapes as separate bases or derived varia... | [packet](./packets/jetstack-cert-manager.md) |
| `external-secrets/external-secrets@2.5.0` | default | draft | production-review-ready | Use default for the controller install with the recorded separated-Secret prerequisite. The disposable fake-provider round trip... | [packet](./packets/external-secrets-external-secrets.md) |
| `argo-cd/argo-cd@9.5.15` | default | supported | production-review-ready | Use default for the declared proof scope. Hardened, self-managed, repository-credential, SSO, or backup/restore paths need sepa... | [packet](./packets/argo-cd-argo-cd.md) |
| `grafana/loki@7.0.0` | single-binary-filesystem | supported | production-review-ready | Use single-binary-filesystem for the declared local proof scope. Object-store, retention, backup, restore, tenant, and hardened... | [packet](./packets/grafana-loki.md) |
| `hashicorp/consul@2.0.0` | default-control-plane | supported | production-review-ready | Use default-control-plane for the declared proof scope. Secure mesh, TLS, ACL, gateway, UI, production quorum, and digest-pinne... | [packet](./packets/hashicorp-consul.md) |
| `hashicorp/vault@0.32.0` | dev-mode | rejected | blocked | Use dev-mode only for local/demo proof. A production Vault base must cover init/unseal, storage, TLS, backup/restore, and opera... | [packet](./packets/hashicorp-vault.md) |
| `longhorn/longhorn@1.11.2` | default | supported | production-review-ready | Use default only inside the declared privileged storage proof scope. Backup/restore, upgrade, replica policy, UI ingress, and h... | [packet](./packets/longhorn-longhorn.md) |

## How To Read These

- `supported` means target-scoped support for the named base and target scope.
- `rejected` means the evidence remains useful, but the base is not a
  production support offer.
- A hard chart can pass render parity and live evidence while still requiring a
  separate support decision for another base, target, storage mode, provider, or
  overlay.
- These packets should be regenerated after support decisions, production
  disposition, base readiness, or chart pages change.

Regenerate:

~~~sh
npm run hard-charts:packets
npm run hard-charts:packets:verify
~~~
