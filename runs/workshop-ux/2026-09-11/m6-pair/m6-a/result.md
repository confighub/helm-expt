# Fresh-session continuation result

The received workspace is a valid continuation of trial `m2-c`, source `compose-demo/platform-moved`. The transfer manifest hashes all match. The pinned plugin is commit `56e261a87dc3b060a86474bc796d379dd9bb7f3d` and the supplied setup completed with exit code 0.

The prior and current static results certify `kubara-gitops-shop` as 184 objects. The composition checks pass for conflicts, CRD ordering, served API versions, and shop-web dependency coverage. Warnings remain for four webhook caBundles, six pre-existing namespaces, and unknown `ClusterIssuer/letsencrypt` and `ClusterSecretStore/platform-store`. Both results explicitly say target availability and application health were not checked.

Fresh `cub stack certify handoff/stack.yaml --json` exited 0. Fresh sandbox rendering exited 0 and produced `./current-rendered.yaml` (SHA-256 `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3`). It exactly matches the received `handoff/changed.yaml`; compared with the baseline, the sole change is `shop-web` Deployment replicas 3 to 2.

Nothing was deployed, uploaded, published, or made authoritative. No cluster, ConfigHub, registry, login, or credentials were used. The evidence proves local static continuation and deterministic rendering only. It does not prove target readiness, controller sync, workload convergence, application behavior, or release approval. This supports human review of the candidate; any live or governed decision needs a separately authorized and recorded delivery check.

Detailed commands, exit codes, errors, and hashes are in trial-log.md (`./trial-log.md` in workspace archive).
