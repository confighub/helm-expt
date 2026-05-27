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
total findings: 325
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
| `latest-tag` | 15 |
| `sensitive-host-mounts` | 9 |
| `liveness-port` | 6 |
| `readiness-port` | 6 |
| `privilege-escalation-container` | 4 |
| `privileged-container` | 4 |

## Interpretation

`warn` means the external scanner found issues that must receive a production
disposition before catalog production support is claimed. The rendered digest
is recorded per row, so each scanner result is bound to the exact objects we
would publish or install.
