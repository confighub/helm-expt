# Trial log

All commands below ran with workdir `.` and the required prefix `CUB_CONFIG=./cli/config.yaml` for `cub` commands.

## Provenance and handoff integrity

- `jq` of `transfer.json`: source `m2-c`, source subdirectory `compose-demo/platform-moved`, destination `handoff`.
- `git -C plugin log -1 --format='%H %s'`: exit 0; `56e261a87dc3b060a86474bc796d379dd9bb7f3d proof: retain direct and assistant GPU Match trials (#17)`.
- `sha256sum` of all 13 transferred handoff paths: exit 0; all hashes matched the corresponding `transfer.json` entries.
- Supplied setup recorded exitCode 0 and pluginSha `56e261a87dc3b060a86474bc796d379dd9bb7f3d`.

## Prior result inspection

- `jq` on `handoff/result.json`, `handoff/changed-result.json`, and `handoff/resume.json`: each reports `name: kubara-gitops-shop`, `certified: true`, `objectCount: 184`, `scope.mode: static-composition`, `scope.targetAvailability: not-checked`, `scope.applicationHealth: not-checked`.
- Prior checks: no conflicts; CRD ordering pass (59 CRDs before 2 dependent custom resources); served API versions pass; app needs pass; warnings for 4 admission webhook caBundles, 6 pre-existing namespaces, and unknown `ClusterIssuer/letsencrypt` plus `ClusterSecretStore/platform-store`.
- `handoff/changed.diff` records only `shop-web` Deployment `spec.replicas: 3 -> 2`.

## Fresh continuation checks

- `CUB_CONFIG=./cli/config.yaml ./plugin/bin/cub-stack list`: exit 0; lists `kubara-gitops-shop` and the shipped stacks.
- `CUB_CONFIG=./cli/config.yaml ./plugin/bin/cub-stack certify handoff/stack.yaml --json > ./certify-current.json 2> ./certify-current.err`: exit 0. JSON sha256 `c3566fffcf3fcb8ab64e3c4054e38bb0a789456255dc1c803f026ba19e9d4774`; stderr sha256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty). Result again certified, 184 objects, static composition, target/application not checked.
- `CUB_CONFIG=./cli/config.yaml ./plugin/bin/cub-stack sandbox handoff/stack.yaml --out ./current-rendered.yaml > ./sandbox-current.stdout 2> ./sandbox-current.stderr`: exit 0. Output sha256 `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3`; stdout sha256 `2361df789bebefc06015815342e3d19714088afb2f840ae0d60b1066faaa1064`; stderr sha256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty).
- `cmp -s handoff/changed.yaml ./current-rendered.yaml`: exit 0; fresh output exactly matches the received changed candidate.
- `diff -u handoff/rendered.yaml ./current-rendered.yaml`: exit 1 (expected difference); only the `shop-web` replica change appears.

## Limits and next action

Proven: provenance, bundle hashes, plugin availability, static certification, deterministic resume rendering, and the intended one-field candidate diff. Unknown: target namespaces and prerequisite objects, webhook readiness, controller synchronization, workload convergence, service response, and any publication or governance state. Not run by instruction: login, cluster, ConfigHub, registry, upload, publish, or credentials. No deployment or authoritative release was made; all outputs are local files in this trial. This helps decide that the handoff can safely continue as a reviewable local edit, while a live or governed claim still requires target and delivery evidence. Next action is human review of `current-rendered.yaml` and, if authorized later, a separately recorded target/delivery lane.
