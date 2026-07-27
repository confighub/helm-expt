# Review and fix an RBAC permission

The starting configuration gives the `report-reader` service account read
access to ConfigMaps and Secrets in one namespace. It only needs the ConfigMaps.

The review found that extra Secret access and proposed one change: remove
`secrets` from the Role's resource list. No other Kubernetes field changed.
ConfigHub stored the corrected revision and blocked its dry-run apply until that
exact revision was approved.

After approval, the proof applied the stored ConfigHub data to an isolated cluster.
The service account can still list ConfigMaps and can no longer list Secrets.

| Check | Before | After |
| --- | --- | --- |
| Secret-read finding | Found | Cleared |
| List Secrets | Allowed | Denied |
| List ConfigMaps | Allowed | Allowed |
| ConfigHub apply check | Not attempted for the imported state | Blocked before approval, allowed after approval |
| Live Role matches approved data | - | Yes |

## What changed

- Object: `rbac.authorization.k8s.io/v1|Role|rbac-review|report-reader`
- Field: `/rules/0/resources`
- Removed: `secrets`
- Retained: `configmaps`
- Imported revision: 2
- Corrected revision: 4

## Limits

This is a small namespaced fixture. The catalog-wide report uses conservative rules,
so a finding asks for review rather than declaring that a chart is wrong. This run
does not resolve binding graphs across a fleet or modify a production chart.

The ConfigHub target was used for dry-run policy checks. After approval, the proof
read the exact Unit data and handed it to `kubectl apply`. Automated ConfigHub,
Argo CD, or Flux delivery was not tested. The temporary Space and cluster were
removed.

- [Starting configuration](../../examples/apps/rbac-review/before.yaml)
- [Reviewed correction](../../examples/apps/rbac-review/after.yaml)
- [Human walkthrough](../../docs/demo/apps/rbac-review.md)
- [Committed live receipt](../../runs/rbac-review-live-proof/receipt.yaml)
- [Catalog-wide RBAC report](../app-readiness/summary.md)
