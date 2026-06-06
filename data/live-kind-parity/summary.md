# Two-Cluster Helm-vs-Installer Kind Parity

This report tracks strict parity receipts that use two vanilla kind clusters:
regular Helm on one cluster and `cub installer` render/apply on the other.

```text
pass: 1
watch: 1
blocked: 0
```

| Chart | Base | Result | Receipt |
| --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | default | watch | runs/live-kind-parity/argo-cd-argo-cd-default/receipt.yaml |
| `bitnami/nginx@24.0.2` | http-clusterip | pass | runs/live-kind-parity/bitnami-nginx-http-clusterip/receipt.yaml |
