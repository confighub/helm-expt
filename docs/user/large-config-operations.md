# Large ConfigHub Operations

**UNOFFICIAL/EXPERIMENTAL.**

Some Helm charts become large ConfigHub components. Consul is the current
example: one base can involve roughly 100 Units, target facts, OCI delivery,
Argo reconciliation, workload checks, and a remaining controller-health watch.

The rule is simple: do not treat a quiet wait as a single mystery. Break the
operation into visible stages and record which stage is slow, passed, blocked,
or still under watch.

## What To Watch

Before upload or apply, note the object shape:

```sh
cub unit list --space <space>
kubectl --kubeconfig <kubeconfig> get all -A
```

During `cub installer upload`, check that the ConfigHub Space and Units are
appearing:

```sh
cub unit list --space <space>
cub unit tree --space <space>
```

During `cub unit apply --wait`, separate ConfigHub apply progress from cluster
and GitOps progress:

```sh
cub unit list --space <space>
cub unit livestate <unit> --space <space>
kubectl --kubeconfig <kubeconfig> get applications -n argocd
kubectl --kubeconfig <kubeconfig> get pods -A
```

For GitOps/OCI, check both the root application and the child resources:

```sh
kubectl --kubeconfig <kubeconfig> get applications -n argocd
kubectl --kubeconfig <kubeconfig> describe application <app> -n argocd
KUBECONFIG=<kubeconfig> cub-scout gitops status --json
```

## How To Read The Result

Use a funnel:

1. Rendered objects exist.
2. Units uploaded to ConfigHub.
3. OCI/GitOps source exists.
4. GitOps controller syncs.
5. Target facts and lifecycle prerequisites are present.
6. Workloads converge.
7. Controller aggregate health is explained.

If stages 1-6 pass but stage 7 remains unclear, the result is `watch`, not a
render-parity failure. Consul currently demonstrates this: the root Argo
Application can be `Synced/Healthy`, workloads can converge, semantic parity can
pass, and a child resource such as the UI Ingress can still leave controller
health in `Progressing`.

## What To Capture

For large charts, a useful receipt or issue comment should include:

- chart, version, base, target, and delivery path;
- Unit count and main Kubernetes kinds;
- elapsed time for upload, apply, GitOps sync, and workload convergence when
  available;
- the exact command that was waiting;
- the first resource that stayed pending, blocked, or progressing;
- whether the residue is a parity defect, target prerequisite, controller
  health watch, or missing product progress signal.

## Current Product Gap

The current CLI path does not always show enough progress for large operations.
The desired product behavior is a progress stream or receipt fields that show
which phase and Unit group are active. Until then, use the commands above to
make the funnel visible.

Tracked in [issue #714](https://github.com/confighub/helm-expt/issues/714).

## See Also

- [Live Parity](./live-parity.md)
- [Why Synced Is Not Working](./why-synced-is-not-working.md)
- [Target Prerequisites](./target-prerequisites.md)
- [Large app evidence funnel skill](../skills/large-app-evidence-funnel.md)
