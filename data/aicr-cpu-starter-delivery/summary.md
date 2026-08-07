# CPU starter kind delivery proof

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live
receipt. Rerun the throwaway-cluster proof with
`npm run aicr-starter-delivery:run`; verify it without external access with
`npm run aicr-starter-delivery:verify`.

The seven derived CPU starter Applications traveled as one OCI artifact from a
temporary local registry, were pulled back byte-faithful, and were applied to
a throwaway kind cluster running Argo CD v3.4.5
from the pinned upstream manifest. All 7
Applications were accepted with their specs and sync-waves intact.

The boundary was proven, not asserted. The retained Applications carry
upstream automated sync policies, so the application controller was held at
zero replicas for the entire run: after a 30-second
settle it was still at zero, 0 sync
operations appeared, and every component destination namespace
(cert-manager, kai-scheduler, monitoring, node-feature-discovery) stayed absent. Delivery
cannot begin until a human scales the controller up. The governed
configuration arrived; nothing beyond it happened.

The starter's committed platform digest at the time of the run was
`sha256:d4c19c203ba379690c8de8716b29712b14d69006ae928136f410f634a4a80564`, derived from the training entry's
`sha256:3f9ec2a69619682d151937fe77d3bba21c336f598678e05f2fdd4d53ba142f2e`. The run happened on
2026-08-07T09:08:19.982Z; the cluster, registry, and working files were
removed afterward.

## Limits

- This run proves config-plane delivery only: the Applications were accepted and no sync started. It claims no application sync, no workload behavior, and no component health.
- The retained Applications carry upstream automated sync policies, so the application controller was deliberately held at zero replicas for the entire run. Delivery cannot begin until a human scales the controller up; automatic stays false until earned.
- This run used a temporary local registry; it does not prove public registry publication.
- No ConfigHub organization was involved in this run; the ConfigHub import and reviewed-change story is the separate variant proof receipt.
