# Trial log

Guide discovered from `http://127.0.0.1:8768/site/index.html`; the installed plugin task and README supplied the local-only workflow and the served API-version rule.

All `cub` commands below used `CUB_CONFIG=./cli/config.yaml` and ran with shell workdir `.`.

1. `cp -R handoff platform` — exit 0. The supplied handoff remains unchanged; the copy is the working recovery workspace.
2. `cub stack certify ./platform/stack.yaml --json` — exit 0. Proves the copied changed stack is statically certified; receipt: `platform/changed-result.json`.
3. `cub stack sandbox ./platform/stack.yaml --out ./platform/changed.yaml` — exit 0. Proves a 184-object recovery render was produced.
4. `git diff --no-index platform/rendered.yaml platform/changed.yaml` — exit 1 (expected difference). Proves the rendered diff is exactly `shop-web` Deployment `spec.replicas: 3 -> 2`.
5. `cp -R platform incompatible` — exit 0. Preserves the changed candidate as a separate refusal trial.
6. Edited only `incompatible/components/06-shop-web.yaml`, changing ExternalSecret `apiVersion` from `external-secrets.io/v1` to `external-secrets.io/v1beta1`.
7. `cub stack certify ./incompatible/stack.yaml --json > ./incompatible/refusal.json` — exit 1. Proves refusal is retained: `certified:false`; `version-not-served`; bundled `externalsecrets.external-secrets.io` serves `v1`.

Evidence locations and what they prove:

- `handoff/` — original supplied handoff, preserved.
- `platform/rendered.yaml` and `platform/result.json` — retained 3-replica baseline and baseline receipt.
- `platform/changed.yaml` and `platform/changed-result.json` — recovered 2-replica render and certified receipt.
- `incompatible/refusal.json` — failed attempt retained; no repair or incompatible render was run.
- `plugin/` — pinned installed plugin checkout, revision `56e261a87dc3b060a86474bc796d379dd9bb7f3d`.

No cluster, ConfigHub, registry, credentials, login, or GitOps controller was contacted. Certification is static. Namespace existence, ClusterIssuer/letsencrypt, ClusterSecretStore/platform-store, webhook readiness, target API availability, workload convergence, and application HTTP response remain unverified. The fixture therefore does not prove that the app runs. Friction: the supplied handoff already contained the 2-replica changed candidate, so the trial copied it to preserve the original rather than re-editing it.
