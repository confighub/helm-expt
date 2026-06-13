# Target Facts And Lifecycle Skill

UNOFFICIAL/EXPERIMENTAL

Use this skill when a base depends on cluster state that is not produced by the
rendered object set.

Common target facts:

- existing Secrets;
- existing CRDs;
- APIService aggregation readiness;
- webhook serving certificates;
- storage classes and PVC behavior;
- Kubernetes topology, such as a minimum number of schedulable nodes;
- generated runtime state that must be staged or observed.

## Route

1. Check the base variant:

```sh
open recipes/<repo>/<chart>/<version>/variants/<base>/variant.yaml
```

2. Check the package target-fact support:

```sh
open packages/<repo>/<chart>/<version>/installer.yaml
```

3. Check whether the prerequisite is already visible in generated status:

```sh
open data/status-dashboard/summary.md
open data/secret-lifecycle/summary.md
open data/lifecycle-boundary/summary.md
open data/apiservice-coverage/summary.md
```

4. If the prerequisite changes rendered Kubernetes objects, create a new
   `cub installer` base and rerun render parity.

5. If the prerequisite is target state, record it as a target fact, staging
   step, lifecycle observation, or explicit refusal.

## Target Topology

Target topology means Kubernetes scheduling and platform behavior. For example,
Consul secure mesh needs three schedulable Kubernetes nodes because its server
pods use anti-affinity and quorum. That is not a ConfigHub worker requirement.
ConfigHub remains workerless from the target cluster's point of view.
