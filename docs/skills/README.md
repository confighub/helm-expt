# Helm-Expt Skills

UNOFFICIAL/EXPERIMENTAL

These skills are reusable operating knowledge for humans and agents working on
helm-expt. They are not product proof tables, and they do not make Pilot or any
other external demo runner part of helm-expt.

Use them when a chart needs more than a static render check:

| Skill | Use when |
| --- | --- |
| [Live Parity](./live-parity.md) | Running Helm-vs-ConfigHub live parity, GitOps/OCI evidence, kind clusters, or cub-scout observations. |
| [Large App Evidence Funnel](./large-app-evidence-funnel.md) | A chart has many Units and a single pass/fail status hides where the operation is stuck. |
| [Target Facts And Lifecycle](./target-facts-and-lifecycle.md) | A base needs Secrets, CRDs, APIService readiness, topology, storage, or generated runtime state before apply. |
| [Hook And Secret Lifecycle](./hook-and-secret-lifecycle.md) | A chart uses Helm hooks, webhook certificates, service-account token Secrets, or generated Secret material. |
| [Serious Chart Playbooks](./serious-chart-playbooks.md) | Working on kube-prometheus-stack, Consul, cert-manager, External Secrets, Loki, or other hard charts. |

## Common Rules

- Keep live lanes serial.
- Use the current `cub installer` command family.
- Do not turn `watch` or `blocked` into `pass` unless the receipt contains the
  evidence.
- Target shape means Kubernetes topology and prerequisites, not ConfigHub worker
  architecture.
- ConfigHub OCI/GitOps delivery remains workerless from the target cluster's
  point of view: Argo or Flux pulls desired state from the published artifact.
- Scoped checks are normal while working. Run full `npm run verify` only for a
  release gate or when explicitly requested.

Regenerate or verify the skill set:

```sh
npm run skills:verify
```
