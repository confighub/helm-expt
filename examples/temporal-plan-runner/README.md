# Run a bundle's plan with Temporal

A Catalog bundle carries flattened objects and, beside them, a plan: the steps
plain objects cannot carry, written as data under `routes/`. Uploading a
bundle stores the plan and does not carry it out. Every plan document names
the runtimes that could carry it out, and none of them is proven.

This example tries Temporal as one more runtime. One generic workflow reads
any bundle's plan and runs it: it waits for a person to approve each step no
runtime may take on its own, applies the objects in the declared order, and
then runs each lifecycle stage in order. Temporal keeps the history, retries
a failed action, and holds the run while it waits.

The plan stays data. The workflow is the same for every bundle, so a gate can
still read and diff a bundle's plan, and Temporal adds the run and its record.

It was run once, on the gatekeeper 3.22.2 bundle, against a throwaway kind
cluster and Temporal's local development server. No account was needed.
[The run log](run-2026-10-26.md) has every command and its output.

## What it does with a plan

| Plan document | What the runner does |
| --- | --- |
| `routeKind: apply-ordering` | Applies each stage's objects in order, and waits for CRDs to be Established where the stage says so |
| `routeKind: lifecycle-job` | Runs each stage in order. The stage name chooses the action, and a name it does not know stops the run before it starts |
| `routeKind: recorded-plan-step` with `automatic: false` | Waits for a person to approve it, before anything reaches the cluster |
| Any other route kind | Stops before it starts. The plan says to stop rather than skip |

## Run it

You need `go`, `kubectl`, `kind`, `oras` and the
[Temporal CLI](https://docs.temporal.io/cli). Run each long-lived command in
its own terminal.

```sh
# The bundle, by digest
mkdir -p bundle && oras pull europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-gatekeeper-gatekeeper-3-22-2-default@sha256:8876d3568b8eb7cfde23096ce287b20b52ae36cfba3acc3cba48cec66421c930 -o bundle
tar -xzf bundle/*.tar.gz -C bundle

# See the plan the runner reads. This runs nothing.
go run . plan bundle

# A throwaway cluster and a local Temporal
kind create cluster --name plan-runner-proof
temporal server start-dev            # its own terminal
go run . worker --kube-context kind-plan-runner-proof    # its own terminal

# Start the run. It waits for the approvals and then prints its record.
go run . start --id plan-gatekeeper-3-22-2 bundle

# Approve each gate, as a person
temporal workflow signal --workflow-id plan-gatekeeper-3-22-2 --name approve --input '"preflight-or-presync"'
temporal workflow signal --workflow-id plan-gatekeeper-3-22-2 --name approve --input '"upgrade-action-with-receipt"'

# Clean up
kind delete cluster --name plan-runner-proof
```

The Temporal UI at `http://localhost:8233` shows each step, its attempts and
the approvals.

## What it does not show

- It is not ConfigHub's change workflow. Whether Temporal belongs under that
  workflow or beside it is still to be decided.
- It applies directly. Where Argo CD or Flux delivers, a plan runner must
  order around the controller, not apply beside it. That is not tried here.
- The pre-upgrade stages re-apply the same CRDs. No upgrade from one version
  to another was run.
- It ran one bundle, once, on Temporal's development server.
