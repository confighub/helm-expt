# Trial log

1. Opened the local site and followed `Build a platform` to the retained `Compose and review a local workshop stack` Guide.
2. Ran `cub stack sandbox .../plugin/stacks/kubara-gitops-shop.yaml --workspace .../compose-demo/platform`; first attempted an unavailable plugin-local cub path (exit 127), then used the supplied installed CLI at `$HOME/.confighub/bin/cub` (exit 0). No files were lost.
3. Moved the complete workspace to `platform-moved` and certified `stack.yaml` to `resume.json` (exit 0).
4. Edited only `components/06-shop-web.yaml` replica count 3→2. Candidate certify/sandbox passed; `git diff --no-index` exit 1 showed the one intended change.
5. Copied to `incompatible`, changed only ExternalSecret API v1→v1beta1, and retained refusal (exit 1, version-not-served).
6. Copied to `recovered`, restored v1, and certified (exit 0).

Help needed: none after correcting the initial CLI path. Next: review generated YAML against the intended cluster, satisfy prerequisites, bind Git and delivery, then perform live reconciliation and application checks with appropriate authorization.
