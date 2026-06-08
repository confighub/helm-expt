# External Scan Lane

This lane runs a market-standard rendered-manifest scanner against the exact
supported top-20 rendered object sets.

It is additive to the existing local scan/gate receipts. It does not replace
ConfigHub function checks or chart-specific production dispositions.

## Tool Status

| Tool | Available | Version |
| --- | --- | --- |
| kube-linter | yes | 0.8.3 |
| Trivy | no | n/a |
| kubeconform | no | n/a |

## Summary

```text
charts scanned: 20
variant rendered object sets scanned: 40
pass: 0
warn: 40
fail: 0
total findings: 317
```

## Most Common Findings

| Check | Count |
| --- | ---: |
| `unset-memory-requirements` | 90 |
| `unset-cpu-requirements` | 85 |
| `no-read-only-root-fs` | 40 |
| `dangling-service` | 20 |
| `pdb-unhealthy-pod-eviction-policy` | 19 |
| `run-as-non-root` | 16 |
| `sensitive-host-mounts` | 9 |
| `latest-tag` | 7 |
| `liveness-port` | 6 |
| `readiness-port` | 6 |
| `privilege-escalation-container` | 4 |
| `privileged-container` | 4 |

## Chart Workdown

The chart workdown groups variant findings into the next production action.
Use it with [production-disposition](../production-disposition/summary.md)
when closing `scan/gate warning disposition`.

| Chart | Variants | Findings | Priority | Top checks | Next action |
| --- | ---: | ---: | --- | --- | --- |
| `prometheus-community/kube-prometheus-stack@85.3.3` | 2 | 54 | high | dangling-service:14;unset-cpu-requirements:12;unset-memory-requirements:12;no-read-only-root-fs:6;sensitive-host-mounts:6;host-network:2;host-pid:2 | record security acceptance or create a hardened base; review service selectors and runtime endpoints; add production resource policy or accept chart defaults for local-test only; review pod security posture for the production target |
| `longhorn/longhorn@1.11.2` | 2 | 48 | high | no-read-only-root-fs:10;run-as-non-root:10;unset-cpu-requirements:10;unset-memory-requirements:10;dangling-service:4;privilege-escalation-container:2;privileged-container:2 | record security acceptance or create a hardened base; review service selectors and runtime endpoints; add production resource policy or accept chart defaults for local-test only; review pod security posture for the production target |
| `prometheus-community/prometheus@29.8.0` | 2 | 27 | high | unset-cpu-requirements:8;unset-memory-requirements:8;no-read-only-root-fs:6;sensitive-host-mounts:3;host-network:1;host-pid:1 | record security acceptance or create a hardened base; add production resource policy or accept chart defaults for local-test only; review pod security posture for the production target |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | 2 | 16 | high | no-read-only-root-fs:6;run-as-non-root:6;privilege-escalation-container:2;privileged-container:2 | record security acceptance or create a hardened base; review pod security posture for the production target |
| `bitnami/mongodb@19.0.7` | 2 | 8 | high | latest-tag:5;pdb-unhealthy-pod-eviction-policy:3 | pin image tag or digest in the installer base; accept PDB behavior or add a reviewed patch where the chart supports it |
| `bitnami/postgresql@18.6.7` | 2 | 4 | high | latest-tag:2;pdb-unhealthy-pod-eviction-policy:2 | pin image tag or digest in the installer base; accept PDB behavior or add a reviewed patch where the chart supports it |
| `bitnami/nginx@24.0.2` | 2 | 2 | standard | pdb-unhealthy-pod-eviction-policy:2 | accept PDB behavior or add a reviewed patch where the chart supports it |

## Interpretation

`warn` means the external scanner found issues that must receive a production
disposition before catalog production support is claimed. The rendered digest
is recorded per row, so each scanner result is bound to the exact objects we
would publish or install.
