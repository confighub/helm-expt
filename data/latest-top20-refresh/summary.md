# Latest Top-20 Refresh

Generated: 2026-05-31T11:36:20.620Z

Helm client: `v4.1.4+g05fa379`

This snapshot compares the currently supported top-20 catalog proofs with the
latest versions available from the configured Helm repositories.

## Result

```text
Current chart proofs: 14 / 20
Update candidates: 6 / 20
```

## Update Candidates

| Rank | Chart | Current proof | Latest chart | Next action |
| ---: | --- | --- | --- | --- |
| 1 | `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | create new recipe/package version and rerun proof chain before catalog promotion |
| 2 | `bitnami/mongodb` | `19.0.7` | `19.0.9` | create new recipe/package version and rerun proof chain before catalog promotion |
| 4 | `bitnami/nginx` | `24.0.2` | `24.0.4` | create new recipe/package version and rerun proof chain before catalog promotion |
| 5 | `bitnami/postgresql` | `18.6.7` | `18.6.10` | create new recipe/package version and rerun proof chain before catalog promotion |
| 18 | `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | create new recipe/package version and rerun proof chain before catalog promotion |
| 19 | `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | create new recipe/package version and rerun proof chain before catalog promotion |

## Doctrine

An update candidate is not automatically a supported catalog entry. It becomes
supported only after the new chart version has its own recipe/package path,
source and dependency locks, supported variants, rendered objects,
Helm-equivalence receipt, scan/gate receipts, ConfigHub proof receipts, and live
e2e evidence.

No public catalog row should silently roll forward from the current proof version
to the latest chart version.

## Next Work

1. Regenerate or create proof artifacts for every update candidate under a new
   versioned recipe/package path.
2. Re-run regular Helm versus `cub installer` comparison for the new version.
3. Re-run ConfigHub upload, function scan, safe-ops, server-side variant, and
   live e2e proof lanes.
4. Re-run catalog status, production disposition, root catalog, top-100, and
   top-500 analysis after the new versions are promoted.
5. Keep the previous chart version available for legacy patch and rollback
   review until the new version is production-dispositioned.
