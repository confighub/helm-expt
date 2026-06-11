# Top-100 Hook Dispositions

Generated. Do not edit by hand.

```sh
node scripts/generate-hook-dispositions.mjs            # regenerate
node scripts/generate-hook-dispositions.mjs --verify   # completeness gate
```

One row per hook-bearing source-top-100 chart, with one selected disposition. The verify mode fails if any hook-bearing chart lacks a disposition, so hooks cannot regress into a static count. Vocabulary and claim boundaries: [what hook support means](../../docs/reference/what-hook-support-means.md). Full table: [top100-hook-dispositions.csv](./top100-hook-dispositions.csv).

| Disposition | Charts | Meaning |
| --- | --- | --- |
| observed | 3 | A maintained hook lifecycle receipt exists from a live run. |
| routed | 5 | A route is selected and worked evidence exists (rendered hook resources; live attempted or explicitly blocked). |
| per-target | 1 | The right route depends on the target cluster class; no single route claim is honest. |
| recipe-needed | 2 | A route plan exists but the chart has no recipe, so no maintained lifecycle work can attach yet. |

| # | Chart | Hooks | Dependency source | Disposition | Live status |
| --- | --- | --- | --- | --- | --- |
| 1 | prometheus-community/kube-prometheus-stack@85.3.0 | 2 (post-install, post-upgrade, pre-install, pre-upgrade) | chart-own | observed | observed |
| 9 | k8s-dashboard/kubernetes-dashboard@7.14.0 | 2 (post-upgrade, pre-upgrade) | vendored (kong) | routed | none (default base is hook-inert; no rehearsal needed for it) |
| 13 | gitlab/gitlab@10.0.0 | 1 (post-install, post-upgrade) | vendored (traefik) | recipe-needed | none |
| 23 | bitnami/kafka@32.4.3 | 1 (post-install, post-upgrade) | chart-own | routed | blocked: pinned default image tag no longer exists upstream (see blocker receipt) |
| 32 | bitnami/minio@17.0.21 | 1 (post-install, post-upgrade) | chart-own | routed | blocked: pinned MinIO image tags no longer resolve upstream (see rehearsal receipt) |
| 38 | kyverno/kyverno@3.8.1 | 8 (post-upgrade, pre-delete, test) | chart-own + vendored (reports-server) | observed | observed |
| 42 | fluent/fluent-bit@0.57.6 | 1 (test) | chart-own | observed | observed |
| 43 | datadog/datadog@3.214.0 | 3 (post-install, post-upgrade, pre-install, pre-upgrade) | chart-own + vendored (datadog-csi-driver) | per-target | none |
| 44 | bitnami/thanos@17.3.1 | 1 (post-install, post-upgrade) | vendored (minio) | recipe-needed | none |
| 84 | airflow-helm/airflow@8.9.0 | 5 (post-install, post-upgrade) | chart-own | routed | blocked before attempt: dependency closure + image-availability preconditions (see blocker receipt) |
| 97 | kong/kong@3.2.0 | 2 (post-upgrade, pre-upgrade) | chart-own | routed | none (postgres-mode rehearsal needs a database and pullable images) |

Notes:

- Dependency-provided hooks are first-class: the dependency_source column names the vendored subchart that ships the hook.
- The maintained queue also observes charts outside the source top-100 (tigera-operator, gatekeeper); they are tracked in data/hook-lifecycle/, not here.
- bitnami/minio reuses the shared provisioning-Job route shape; its live rehearsal is blocked on stale upstream image tags, not on hook classification.
