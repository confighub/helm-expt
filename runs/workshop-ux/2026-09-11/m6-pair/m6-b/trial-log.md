# Fresh-session continuation log

Guide discovery: `curl -fsS http://127.0.0.1:8767/site/index.html` exited 0 and returned the ConfigHub Workshop page.

Source identification: `./transfer.json` says the bundle came from trial `m2-d`, source subdirectory `compose-demo/platform-moved`, destination `handoff`. `setup.json` records the pinned plugin revision `56e261a87dc3b060a86474bc796d379dd9bb7f3d`; setup was supplied and excluded (`exitCode: 0`).

Prior retained result: `handoff/result.json` certified `kubara-gitops-shop`, 184 objects, static composition, with 4 PASS and 4 WARN checks. Target availability and application health were `not-checked`; six namespaces and ClusterIssuer/letsencrypt and ClusterSecretStore/platform-store remained unknown. The retained replica diff records only `shop-web` Deployment replicas 3 -> 2. The received bundle hashes match `transfer.json` (checked before work; received files were unchanged).

Fresh checks (all commands run from `./plugin`, each prefixed as required):

```text
CUB_CONFIG=./cli/config.yaml ./bin/cub-stack certify ./handoff/stack.yaml --json
exit 0; output saved as ./fresh-certify.json

CUB_CONFIG=./cli/config.yaml ./bin/cub-stack sandbox ./handoff/stack.yaml --out ./fresh-rendered.yaml
exit 0; output saved as ./fresh-sandbox.out
```

Fresh certification again reported 184 objects and `certified: true`, with the same PASS/WARN checks. Fresh render is 5,592,959 bytes, SHA-256 `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3`. The retained baseline render is the same size, SHA-256 `e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6`. `diff -u` found exactly one content change: `shop-web` Deployment `spec.replicas` 3 -> 2. `cmp` exited 1 because that expected change exists. No command contacted ConfigHub, Kubernetes, a cluster, registry, or publication service.
