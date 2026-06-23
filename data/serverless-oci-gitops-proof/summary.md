# Serverless render → OCI → existing Flux (no ConfigHub login)

**UNOFFICIAL/EXPERIMENTAL.** Live receipt by `scripts/run-serverless-oci-gitops-proof.mjs`; do not hand-edit. Regenerate with `npm run serverless-oci-gitops:proof`.

**Claim.** A SERVERLESS cub flow can publish to OCI for an existing GitOps controller instead of kubectl-applying. With no ConfigHub login: cub installer setup renders the catalog Redis base locally; `flux push artifact` pushes the RENDERED bundle (manifests + the Secret) to an OCI registry; an existing Flux (OCIRepository + Kustomization) pulls it FROM OCI and applies it. The Secret is delivered because it is in the bundle — the tradeoff being it then lives in the registry, unlike the ConfigHub path which separates secret material. `cub installer push` is NOT this path (it pushes the un-rendered installer package); the rendered-bundle push is the GitOps-consumable one.

| Step | OK | Detail |
| --- | --- | --- |
| 1. Render (serverless, no account) | yes | cub installer setup --base default -> 14 manifest file(s) + 1 secret file(s), no account |
| 2. Push rendered bundle to OCI | yes | flux push artifact -> oci://localhost:5000/redis-serverless:v1 (rendered bundle incl. Secret) |
| 3. Existing Flux installed | yes | flux source + kustomize controllers installed (an existing controller) |
| 4. Flux pulls from OCI + applies | yes | OCIRepository Ready=True + Flux applied the serverless-pushed bundle: redis StatefulSet/Service present in ns redis |
| 5. Secret delivered via bundle | yes | Secret delivered through the OCI bundle (secret/redis) — serverless push ships it; tradeoff: it lives in the registry |
| 6. Redis workload Ready (best-effort) | pass | a redis pod reached Ready |

Overall: **pass**. Proven: a no-login serverless render pushed to an OCI registry was pulled and applied by an existing Flux controller — no kubectl apply of the workload from us. The Secret rode along in the bundle (delivered, but now in the registry). So the 'push to OCI for existing Argo/Flux' mode works serverlessly for a vanilla chart; the honest caveats are secret-in-registry and that hook/CRD charts still need the lifecycle routes.

- **What this means for the page:** the "serverless mode that pushes to OCI for your existing Argo/Flux" is real for a vanilla chart — render locally with no login, `flux push artifact` the rendered bundle, your controller reconciles it.
- **Honest caveats (do not drop these on the page):** (a) **secrets** — the serverless push delivers the Secret by including it in the bundle, so it lives in the OCI registry (the ConfigHub path separates secret material instead); (b) **`cub installer push` is the wrong tool** — it pushes the un-rendered installer package, not GitOps-consumable manifests; (c) hook/CRD charts still need their lifecycle routes (this proof is a vanilla chart).
- Receipt: `runs/serverless-oci-gitops-proof/receipt.yaml`.
