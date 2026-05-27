# Legacy Patch Review

This generated review creates the lane for valuable old-version patch support.
It does not claim old-version support yet.

## Summary

```text
recipes reviewed: 100
legacy patch lanes open: 6
old versions selected: 0
```

## Open Lanes

| Chart | Status | Next action |
| --- | --- | --- |
| `bitnami/nginx@24.0.2` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `bitnami/postgresql@18.6.7` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `bitnami/redis@25.5.3` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `ingress-nginx/ingress-nginx@4.15.1` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `jetstack/cert-manager@v1.20.2` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `metrics-server/metrics-server@3.13.0` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |

## Required Proof Before Selling Old-Version Patches

- old-version source lock and dependency lock
- old-version recipe and installer package
- old-version rendered revision digest
- patch diff against the supported current recipe
- scan/gate result for the patched rendered objects
- upgrade and rollback receipts
- explicit support window and scope
