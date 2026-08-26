# Redis: Helm and cub produce the same working result

This live test starts with the public Redis installer package and its recommended `reuse-existing-secret` preset. It uses a fresh client with no ConfigHub token, organization, user, or registry login.

**Result: pass.** With no ConfigHub account or registry login, cub installer pulled the public Redis package and rendered the recommended existing-Secret base. Its 13 chart objects matched Helm field-for-field; cub added only the explicit Namespace. The installer wrote and verified a rendered OCI, and both the Helm and cub lanes reached a ready Redis that answered PING.

## What was compared

| Check | Result |
| --- | --- |
| Public installer package | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3` |
| Published package digest | `sha256:a216ce212424e05b341ef5000f1798e6014b72b8bc3dce9f315285871037af2a` |
| Helm inputs | Redis 25.5.3; pinned image digest; existing Secret `redis-existing-secret` key `redis-password` |
| Helm chart objects | 13 |
| cub objects | 14: the same 13 chart objects plus an explicit Namespace |
| Full object comparison | 13/13; no differing fields |
| Rendered OCI | `sha256:47722bab563bd53478ae6c780da2e2bd08bcc4bf838824be4f3b4ce3a5ac328f` |
| Rendered OCI object set | `sha256:518db60ad92b59818c9e84042b12cc7b3d850a583ab7ca565bbf09f6806e4324` |
| OCI pull-back | verified; pulled objects matched the files |
| ConfigHub account | not used |

## What ran

| Lane | Master | Replicas | Redis command | Result |
| --- | --- | --- | --- | --- |
| Helm install | 1/1 ready | 3/3 ready | PONG | pass |
| cub render, then kubectl apply | 1/1 ready | 3/3 ready | PONG | pass |

Both namespaces received a freshly generated `redis-existing-secret` before the workloads were installed. The selected preset, rendered files, rendered OCI, and receipt stored no password. The multi-preset source package also carries a clearly labeled static-password demo base for comparison; this run did not select it.

The rendered OCI in this test was a temporary local layout. The companion [NGINX OCI-to-Flux proof](../serverless-oci-gitops-proof/summary.md) publishes a rendered OCI to a registry and verifies that Flux applies its exact digest.

Receipt: `runs/serverless-install-parity-proof/receipt.yaml`.
