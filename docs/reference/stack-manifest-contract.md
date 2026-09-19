# Compose and check a stack

A person and an agent use the same Stack YAML and the same `cub` commands.
The caller chooses parts; the command checks the explicit composition. A
checked stack is not evidence of a running cluster or a safe rollout.

## Compose from reviewed entries

Start with reviewed candidates instead of hand-authoring their object sources:

```sh
cub config list --role metrics --json
cub stack compose \
  --entry prometheus-community-prometheus-29-9-0-default \
  --entry grafana-promtail-6-17-1-default \
  --name platform --out ./platform --json
```

The role listing is a candidate shortlist, not a support verdict. Inspect the
retained stack, its source provenance and the composition result, then resume
with the normal check:

```sh
cub stack check ./platform/stack.yaml --json
```

This example contains 28 objects and still needs namespaces and a logging
backend. Static composition cannot establish target health, so it makes no
complete platform claim. Unsafe or routed flattening remains refused, and an
operator is not an instance. The [consumer CI guide](https://github.com/confighub/cub-workshop/tree/main/examples/stack-ci)
runs the same static check for each proposed edit and retains refused results.

Read the [public Stack schema](https://confighub.github.io/helm-expt/site/stack-manifest.schema.json)
for the complete format. Workshop 0.6.34 or newer supports these commands.
`cub stack schema` prints its exact installed contract without a network.
The schema is maintained with the plugin's runtime validation.

## Select parts and preserve their boundaries

Read the [Catalog index](https://confighub.github.io/helm-expt/site/listings/index.json)
and then each candidate's individual listing. Discovery roles help shortlist
parts. Compare bases, exact versions, flattening verdicts, prerequisites and
coverage before choosing. A database operator needs its database custom
resource; a log collector needs a storage destination. A role does not supply
those dependencies or establish compatibility.

A component can use exactly one source:

- `bundle`: an OCI reference pinned by SHA-256, with an explicit `receipt` file
  or a receipt discoverable from the artifact. An installer package containing
  several bases is not automatically a literal object bundle for one base.
- `render`: a local file containing rendered Kubernetes objects.
- `authored`: a local Kubernetes object file that the stack author supplies.

Local files resolve relative to the manifest, with the plugin's shipped files
as a fallback. Adding a local file does not give it a Catalog review or receipt.
Entries without published object bundles require an explicit materialization
step; do not invent a bundle address or treat a planned reference as published.

## Make a small manifest

With the Workshop plugin installed, save this as `stack.yaml`. It reuses the
plugin's two teaching ConfigMaps, so it needs no registry or account. These are
an executable format example, not a deployed application.

```yaml
apiVersion: helm-expt.confighub.com/v1alpha1
kind: Stack
metadata:
  name: my-first-stack
spec:
  components:
    - name: frontend
      authored: components/frontend-config.yaml
    - name: backend
      authored: components/backend-config.yaml
```

Check it, inspect the structured result, then write the combined objects:

```sh
cub stack check ./stack.yaml
cub stack check ./stack.yaml --json
cub stack sandbox ./stack.yaml --out ./objects.yaml
```

`CHECKED` means the implemented static checks found no blocking problem.
`REFUSED` means repair the reported issue before continuing. Read warnings and
omitted checks too. None of these commands applies objects to a cluster.

For a larger example, inspect the plugin's
[EKS inference manifest](https://github.com/confighub/cub-workshop/blob/main/stacks/eks-inference.yaml).
It combines components across `hub`, `mgmt` and `workload` planes; `order`
breaks ties within a plane. The delivery system still owns convergence and
readiness between planes. New stacks can use these same tools without matching
a shipped example.

## Validation and compatibility

A manifest names its API version, kind, metadata name and component list.
Components must name exactly one source, with supported types and fields.
Mixed sources and misspelled properties are rejected rather than silently
ignored. The public schema describes the validator; it does not execute a check.

Kubara's existing `spec.source` provenance is retained. `spec.fullVerdict` is
historical metadata; the CLI does not execute the referenced verdict.
The old `certify` command remains an alias for `check`.

Continue into ConfigHub Server when configurations become shared state,
managed variants or governed changes. Patch, rollout and rollback confidence
requires the relevant comparisons and target receipts, beyond this static
composition check.
