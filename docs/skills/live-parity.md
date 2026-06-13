# Live Parity Skill

UNOFFICIAL/EXPERIMENTAL

Use this skill when running live Helm-vs-ConfigHub parity, GitOps/OCI evidence,
kind clusters, cub-scout observations, or chart-specific live blockers.

The goal is to produce a live receipt with a precise outcome:

- `pass`: live evidence proves the named lane for the chart, version, base, and
  target profile.
- `watch`: the main path works, but a named controller, lifecycle, or target
  residue still needs review.
- `blocked`: the run cannot proceed until a named prerequisite, target shape, or
  tool gap is fixed.

## Rules

- Run only one live lane at a time.
- Do not start a live run while `tests/live-helm-confighub-parity-test` is
  active.
- Never delete another lane's cluster.
- Use the current `cub installer` command family.
- Do not claim production support from render parity or from a single local
  cluster receipt.

## Flow

Preflight first:

```sh
npm run live-parity:run -- --preflight \
  --recipe recipes/<repo>/<chart>/<version> \
  --base <base> \
  --target-profile <profile>
```

Run only after preflight passes:

```sh
npm run live-parity:run -- \
  --recipe recipes/<repo>/<chart>/<version> \
  --base <base> \
  --target-profile <profile>
```

Inspect progress:

```sh
cat runs/live-helm-confighub-compare/<slug>/stage.txt
kind get clusters
kubectl --kubeconfig <kubeconfig> get applications -n argocd
kubectl --kubeconfig <kubeconfig> get pods,jobs,pvc -A
```

Use cub-scout when controller state or live object state needs to be summarized:

```sh
KUBECONFIG=<kubeconfig> cub-scout gitops status --json
KUBECONFIG=<kubeconfig> cub-scout scan -n <namespace> --json
```

After a run, verify the committed evidence:

```sh
npm run live-parity:verify
npm run live-parity:rerun-plan:verify
git diff --check
```

## Output

The expected output is a receipt under:

```text
runs/live-helm-confighub-compare/<chart-base>/receipt.yaml
```

If the row does not pass, update the rerun plan and keep the named `watch` or
`blocked` reason visible in the status surfaces.
