# Trial result

Mission completed locally from the Kubara Guide at `http://127.0.0.1:8767/site/d/docs/user/workshop-compose-guide.html`.

The retained `kubara-gitops-shop` stack materialized successfully with 184 objects across cert-manager, traefik, metrics-server, external-secrets, argo-cd, and shop-web. Baseline workspace was saved at `./compose-demo/platform`, then moved intact to `./compose-demo/platform-moved` and resumed successfully.

The candidate changed only `shop-web` Deployment `spec.replicas` from 3 to 2. Candidate certification and render exited 0; `git diff --no-index` exited 1 as expected and shows only that replica change. The incompatible copy changed only ExternalSecret `apiVersion` from `external-secrets.io/v1` to `external-secrets.io/v1beta1`; certification exited 1 with `version-not-served` because the bundled CRD serves v1. The failed attempt is retained at `./compose-demo/incompatible/refusal.json`. A separate recovered copy restored v1 and certified with exit 0.

Artifacts: `./compose-demo/platform-moved/` (stack, components, baseline rendered.yaml/result.json, resume.json, changed.yaml, changed-result.json, changed.diff), `./compose-demo/incompatible/`, and `./compose-demo/recovered/`.

Proven: local source resolution, static conflict/API/app-needs checks, 184-object materialization, workspace move/resume, field-level diff, refusal preservation, and recovery. Unknown: target namespaces, ClusterIssuer/letsencrypt, ClusterSecretStore/platform-store, admission webhook CA readiness, CRD/API availability on the target, GitOps reconciliation, Argo health, shop application response, secrets, ingress, and certificate issuance. Not run: cluster, Docker, login, ConfigHub, registry, OCI publication, or deployment.

To run on a real target, create/verify the six namespaces and referenced issuer/secret store, verify target APIs and webhook/CRD readiness, provide secrets and ingress/DNS/TLS prerequisites, commit the reviewed files to Git, connect Argo CD or another reconciler, and then observe application health.

This helped decide that the retained stack is useful as a reviewable, resumable materialized baseline and that incompatible API changes are caught before delivery, while certification alone cannot establish target readiness or application health. Next I would review generated objects against the intended cluster and wire delivery in a controlled environment.
