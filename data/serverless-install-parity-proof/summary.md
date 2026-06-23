# Serverless render parity AND install parity (no ConfigHub account)

**UNOFFICIAL/EXPERIMENTAL.** Live receipt by `scripts/run-serverless-install-parity-proof.mjs`; do not hand-edit. Regenerate with `npm run serverless-install-parity:proof`.

**Claim.** With NO ConfigHub account, the serverless cub path matches Helm on BOTH render and install. Render parity: `cub installer setup` produces the same Kubernetes object kinds as `helm template`. Install parity: `helm install redis` brings Redis up, and applying the cub render with plain `kubectl apply` brings the same Redis up — both reach a working (Ready) redis-master on one kind cluster, neither logging into ConfigHub. (The oci+gitops install path is proven in run-serverless-oci-gitops-proof.mjs.)

| Step | OK | Detail |
| --- | --- | --- |
| Render parity (cub render == helm render) | yes | helm template vs cub render: identical object kinds (helm 14 objs, cub 15 objs incl. an explicit Namespace), no account |
| Helm install -> working Redis | yes | helm install redis -> redis-master Ready (working) |
| cub render -> kubectl apply -> working Redis | yes | cub render -> kubectl apply -> redis-master Ready (working), no account |
| No ConfigHub account used | yes | neither path runs cub login / cub auth; no ConfigHub token used |

Overall: **pass**. Proven: a no-login user gets render parity (same objects as Helm) AND install parity (a working Redis) from cub — via plain kubectl here, via oci+gitops in the companion proof. 'Serverless' is not render-only; it installs and works, both ways, with no account.

- This is the half users actually want to see: **it installs and works**, not just "here's the YAML." Both `helm install` and the cub serverless render reach a working Redis, with no login.
- The **oci+gitops** install path (push the rendered bundle to OCI, let your existing Argo/Flux apply it) is proven in the companion [serverless-oci-gitops proof](../serverless-oci-gitops-proof/summary.md).
- Receipt: `runs/serverless-install-parity-proof/receipt.yaml`.
