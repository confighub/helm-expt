# Latest Top-20 Refresh

Generated: 2026-06-10T13:58:40.027Z

Helm client: `v4.1.4+g05fa379`

This snapshot compares the currently supported top-20 catalog proofs with the
latest versions available from the configured Helm repositories.

## Result

```text
Current chart proofs: 13 / 20
Update candidates: 7 / 20
```

## Update Candidates

| Rank | Chart | Current proof | Latest chart | Next action |
| ---: | --- | --- | --- | --- |
| 1 | `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | write target-scoped replacement decision before changing catalog support |
| 2 | `bitnami/mongodb` | `19.0.7` | `19.1.0` | refresh candidate from retained 19.0.9 proof to latest 19.1.0 before replacement decision |
| 4 | `bitnami/nginx` | `24.0.2` | `25.0.0` | refresh candidate from retained 24.0.4 proof to latest 25.0.0 before replacement decision |
| 5 | `bitnami/postgresql` | `18.6.7` | `18.7.0` | refresh candidate from retained 18.6.10 proof to latest 18.7.0 before replacement decision |
| 7 | `bitnami/redis` | `25.5.3` | `27.0.0` | promote candidate root paths and complete remaining proof lanes before replacement decision |
| 18 | `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | write target-scoped replacement decision before changing catalog support |
| 19 | `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | write target-scoped replacement decision before changing catalog support |

## Doctrine

An update candidate is not automatically a supported catalog entry. It becomes
supported only after the new chart version has its own recipe/package path,
source and dependency locks, supported variants, rendered objects,
Helm-equivalence receipt, scan/gate receipts, ConfigHub proof receipts, and live
e2e evidence.

No public catalog row should silently roll forward from the current proof version
to the latest chart version.

## Candidate Proofs

Some retained update candidates have proof-complete root paths under:

```text
recipes/
packages/
```

The retained candidate source artifacts remain under:

```text
data/latest-top20-refresh/candidates/
```

Verify them with:

```sh
npm run top20:latest-candidates:verify
npm run top20:latest-promote-root-paths:verify
npm run top20:latest-promotion-readiness:verify
npm run top20:latest-replacement-decisions:verify
```

Some retained candidates may already be behind the latest upstream chart
version. For those rows, refresh the candidate before making a replacement
decision. Some retained candidates may have render/package proof but no root
paths or live lanes yet. For those rows, promote the candidate root paths and
complete the remaining proof lanes before making a replacement decision. For
rows where the retained candidate still matches the latest upstream version and
has proof-complete root paths, the proof shows that the candidate has its own
recipe/package paths, rendered objects, Helm-equivalence evidence, ConfigHub
proof receipts, live e2e receipts, live parity receipts, production-disposition
boundary, catalog status, and top-100/top-500 refresh coverage.

They are still not catalog-supported replacements. The next step is a
target-scoped replacement decision that chooses whether to replace, defer, or
keep both versions.

The replacement-decision queue records that final review surface.


```text
update rows: 7
replacement-decision-ready candidates: 3
retained candidates superseded by newer upstream versions: 3
retained render/package candidates needing root/live work: 1
update rows without a retained candidate: 0
```


## Next Work

1. Write or accept a target-scoped replacement decision for each candidate.
2. If replacement is accepted, update the production support decision and
   catalog-supported state for that target scope.
3. Keep the previous chart version available for legacy patch and rollback
   review even after a newer version is accepted.
