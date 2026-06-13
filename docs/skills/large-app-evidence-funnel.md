# Large App Evidence Funnel Skill

UNOFFICIAL/EXPERIMENTAL

Use this skill when a chart produces many Units and one status bit hides the
real state of the operation.

Large apps should be reported as a funnel:

1. Units are rendered and uploaded.
2. OCI source is published or pulled.
3. GitOps controller syncs the desired state.
4. Target facts and lifecycle prerequisites are present at the right time.
5. Workloads converge.
6. Controller aggregate health is explained.

Consul `secure-mesh-existing-secrets` is the current example. It reaches regular
Helm, ConfigHub direct apply, ConfigHub OCI/Argo sync, target prerequisites,
workload convergence, and semantic parity, but it remains `watch` until Argo
aggregate `Progressing` health is explained.

## Commands

Open the active queue:

```sh
npm run live-parity:rerun-plan:verify
open data/live-parity-rerun-plan/summary.md
```

Read the current large-app support artifact:

```sh
open recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml
```

Inspect ConfigHub Units when the run is live:

```sh
cub unit list --space <space>
cub unit data <unit> --space <space>
```

Inspect GitOps state when the run is live:

```sh
kubectl --kubeconfig <kubeconfig> get applications -n argocd
kubectl --kubeconfig <kubeconfig> describe application <name> -n argocd
KUBECONFIG=<kubeconfig> cub-scout gitops status --json
```

## Reading Rule

Do not collapse the funnel to a vague failure. If five stages pass and one
controller health rule remains unexplained, record that as `watch` with the
exact residue. If the object comparison fails, that is a parity defect and must
be named separately.
