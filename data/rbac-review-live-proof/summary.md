# Review and fix an RBAC permission

The starting configuration gives the `report-reader` service account read
access to ConfigMaps and Secrets in one namespace. It only needs the ConfigMaps.

The review found that extra Secret access and proposed one change: remove
`secrets` from the Role's resource list. No other Kubernetes field changed.
ConfigHub stored the corrected revision and blocked its dry-run apply until that
exact revision was approved.

After approval, ConfigHub published its release OCI. The same approved objects were
also packaged as a portable OCI that the throwaway cluster could read without
borrowing another cluster's credentials. Argo CD reconciled the portable digest on
an isolated cluster. The service account can still list ConfigMaps and can no longer
list Secrets.

| Check | Before | After |
| --- | --- | --- |
| Secret-read finding | Found | Cleared |
| List Secrets | Allowed | Denied |
| List ConfigMaps | Allowed | Allowed |
| ConfigHub apply check | Not attempted for the imported state | Blocked before approval, allowed after approval |
| ConfigHub release OCI | - | `sha256:9a1c9b52efaf39493d783fe3d9674102bef18ab1c2ccee7a95f951c276144ebf` |
| Portable OCI | - | `sha256:92c3fa146b7b510d047a459ad9402177ae696405137fcca4d7fd234120c448d8`; pulled back and matched |
| Argo CD | - | Synced and Healthy; portable digest matched |
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

The existing catalog OCI target was used for the policy checks and release
publication. `kubectl` created the deliberately unsafe starting state. It did not
deliver the correction. After approval, ConfigHub published its private release OCI.
The proof also built a temporary portable OCI from the same approved data, pulled it
back to compare the objects, and let Argo CD apply it without copying a
target-scoped credential between organizations. This proves one correction on one
throwaway cluster; it does not prove a permanent public registry, Flux delivery, or
a fleet rollout. The temporary registry, Spaces, and cluster were removed.

- [Starting configuration](../../examples/apps/rbac-review/before.yaml)
- [Reviewed correction](../../examples/apps/rbac-review/after.yaml)
- [Human walkthrough](../../docs/demo/apps/rbac-review.md)
- [Committed live receipt](../../runs/rbac-review-live-proof/receipt.yaml)
- [Catalog-wide RBAC report](../app-readiness/summary.md)
