# Trial result

Mission completed locally from the Kubara Guide at `http://127.0.0.1:8767/site/d/docs/user/workshop-compose-guide.html`.

Artifacts are retained under `./compose-demo/`:

- `platform-moved/`: baseline materialized workspace, including `stack.yaml`, `rendered.yaml`, components, `result.json`, and `resume.json`.
- `platform-moved/changed-result.json`, `changed.yaml`, and `replica.diff`: candidate changing only `shop-web` Deployment `spec.replicas` from 3 to 2.
- `incompatible/refusal.json`: preserved failed candidate.
- `recovered/recovery.json`: separate copy restored to `external-secrets.io/v1`.

Commands used the required prefix `CUB_CONFIG=./cli/config.yaml` for every `cub` invocation. Baseline sandbox and resume certification exited 0; candidate certification and sandbox exited 0; `git diff --no-index` exited 1 because it found the intended replica difference; incompatible certification exited 1 with `certified: false`; recovery certification exited 0.

The refusal reason is recorded in `incompatible/refusal.json`: `external-secrets.io/v1beta1|ExternalSecret|shop|shop-web-db: version-not-served; externalsecrets.external-secrets.io serves v1`.

This established static source resolution, composition, certification, materialization, a controlled change, and refusal/recovery evidence. It helped decide that the saved directory must travel as a complete workspace, and that an incompatible API should be preserved as a separate evidence copy before recovery.

Still required for a real target: six namespaces must exist (`argocd`, `cert-manager`, `external-secrets`, `kube-system`, `shop`, `traefik`); `ClusterIssuer/letsencrypt` and `ClusterSecretStore/platform-store` must be available; webhook CA bundles need issuance; a repository binding, delivery wiring/Argo reconciliation, target cluster availability, controller health, secret store, ingress, and application health checks are required. No cluster, ConfigHub, registry, credentials, publication, or live delivery was run.

Proven: 184-object static composition, 59 CRDs ordered before 2 dependent custom resources, no resource conflicts, app dependency coverage, exact replica diff, and refusal of the unavailable API version. Unknown/not-run: target readiness, namespaces and prerequisite resources, GitOps reconciliation, controller health, secrets, ingress behavior, and shop application response.
