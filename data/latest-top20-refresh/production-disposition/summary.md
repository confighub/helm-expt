# Retained Candidate Production Disposition

This report records the production boundary for retained proof-complete update
candidates.

It does not promote these versions and does not claim production support. It
states that the candidate proof lanes are present, then lists the decision
topics that still need a target-scoped support decision before a candidate can
replace the current supported catalog version.

```text
candidate charts: 7
proof-complete: 6 / 7
not production-supported: 7 / 7
```

| Candidate | Primary base | Proof status | Production support | Decision topics | Scan gate | Next action |
| --- | --- | --- | --- | ---: | --- | --- |
| `argo-cd/argo-cd@9.5.17` | default | proof-complete | not-production-supported | 7 | warn-production-blocked | review 7 production decision topic(s), then decide whether argo-cd/argo-cd@9.5.17 can replace 9.5.15 |
| `bitnami/mongodb@19.0.9` | generated-passwords | proof-complete | not-production-supported | 7 | warn-production-blocked | review 7 production decision topic(s), then decide whether bitnami/mongodb@19.0.9 can replace 19.0.7 |
| `bitnami/nginx@24.0.4` | http-clusterip | proof-complete | not-production-supported | 5 | warn-production-blocked | review 5 production decision topic(s), then decide whether bitnami/nginx@24.0.4 can replace 24.0.2 |
| `bitnami/postgresql@18.6.10` | generated-passwords | proof-complete | not-production-supported | 7 | warn-production-blocked | review 7 production decision topic(s), then decide whether bitnami/postgresql@18.6.10 can replace 18.6.7 |
| `bitnami/redis@27.0.0` | default | proof-incomplete | not-production-supported | 5 | warn-production-blocked | finish live parity before production review |
| `prometheus-community/kube-prometheus-stack@86.1.0` | default | proof-complete | not-production-supported | 6 | warn-production-blocked | review 6 production decision topic(s), then decide whether prometheus-community/kube-prometheus-stack@86.1.0 can replace 85.3.3 |
| `prometheus-community/prometheus@29.9.0` | server-only-ephemeral | proof-complete | not-production-supported | 4 | warn-production-blocked | review 4 production decision topic(s), then decide whether prometheus-community/prometheus@29.9.0 can replace 29.8.0 |

## Evidence

The machine-readable form is:

```text
data/latest-top20-refresh/production-disposition/candidate-production-disposition.yaml
```

The spreadsheet form is:

```text
data/latest-top20-refresh/production-disposition/summary.csv
```
