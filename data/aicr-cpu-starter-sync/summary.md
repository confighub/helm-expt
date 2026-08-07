# CPU starter reviewed-component sync proof

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live
receipt. Rerun the throwaway-cluster proof with
`npm run aicr-starter-sync:run`; verify it without external access with
`npm run aicr-starter-sync:verify`.

The reviewed change from the
[variant receipt](../../runs/aicr-cpu-starter-variant/receipt.yaml) became
real on a cluster. The committed `kube-prometheus-stack` bytes with the
reviewed `gp3` to
`standard` storage-class override traveled as one OCI
artifact with the six untouched components, and Argo CD
v3.4.5 on a throwaway kind cluster synced the
`prometheus-operator-crds` CRD prerequisite first and then the
reviewed component, in the order the sync-waves state. Both reached Synced and
Healthy, and every Prometheus volume claim bound with the
`standard` class the review selected
(`prometheus-kube-prometheus-prometheus-db-prometheus-kube-prometheus-prometheus-0`).

Scope was proven, not implied: exactly two Applications existed on the
cluster, and every other component destination namespace
(cert-manager, kai-scheduler, node-feature-discovery) stayed absent. The run took
460 seconds on 2026-08-07T09:21:25.154Z; the
cluster, registry, and working files were removed afterward.

## Limits

- This receipt syncs exactly one reviewed component plus its declared CRD prerequisite. The other five starter components stay config-plane and were proven absent.
- The sync ran on a throwaway kind cluster; it claims nothing about production clusters, AWS, or GPU nodes.
- The reviewed change came from the committed variant receipt; this run realizes that change, it does not re-review it.
- Upstream charts were fetched from their public repository during the sync; their contents are pinned by the Application targetRevision, not re-verified here.
