# Redis ConfigHub Function Scan Lane

## Purpose

This lane proves that the Helm-derived Redis objects uploaded to ConfigHub can
be checked with current ConfigHub function validators. It is not a replacement
for external scanners such as Trivy, Snyk, kube-linter, or kubeconform. It is
the ConfigHub-native scan layer that runs against uploaded Units.

## Acceptance Contract

Accepted when:

- the scan runs against ConfigHub Units, not only local files;
- the selected Units are the Redis Units from the `helm-redis-use-more-now`
  proof space;
- every scanned Unit is bound by `HeadRevisionNum` and `DataHash`;
- at least three current validating functions pass;
- failures or missing executors are recorded as blockers, not hidden.

## Run

Run date: 2026-05-27

Context:

```text
Organization: Kubara
Server: https://hub.confighub.com
Space: helm-redis-use-more-now
Selector: Labels.Proof = 'redis-use-more-now'
```

Commands:

```sh
CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub function vet vet-format \
  --space helm-redis-use-more-now \
  --where "Labels.Proof = 'redis-use-more-now'" \
  --output json \
  --wait

CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub function vet vet-placeholders \
  --space helm-redis-use-more-now \
  --where "Labels.Proof = 'redis-use-more-now'" \
  --output json \
  --wait

CUB_CONFIG=/Users/alexis/.confighub/config.yaml cub function vet vet-merge-keys \
  --space helm-redis-use-more-now \
  --where "Labels.Proof = 'redis-use-more-now'" \
  --output json \
  --wait
```

Result:

| Function | What It Checks | Units | Failures |
| --- | --- | ---: | ---: |
| `vet-format` | YAML format hazards such as anchors, duplicate keys, empty values, truthy strings, and old octals | 14 | 0 |
| `vet-placeholders` | unresolved ConfigHub placeholder values | 14 | 0 |
| `vet-merge-keys` | duplicate Kubernetes strategic merge keys such as duplicate container or env names | 14 | 0 |

Receipt:

```text
runs/redis-use-more-now/latest/function-scan-receipt.yaml
```

## Interpretation

This proves current ConfigHub functions can scan the uploaded Redis Units in
place. It is deliberately modest: these checks catch real apply and review
hazards, but they do not claim full production security approval.

Production readiness still needs the external scanner and policy disposition
already represented by the Redis recipe scan and install gate.

