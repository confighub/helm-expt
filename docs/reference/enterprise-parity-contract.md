# Enterprise Parity Contract

**UNOFFICIAL/EXPERIMENTAL**

This contract extends the two-cluster parity model to private enterprise
estates that do not arrive as one tidy public Helm chart. It is for estates
that combine first-party Helm charts, values-only repositories, and Argo CD
Applications or ApplicationSets.

The goal is narrow. Prove that ConfigHub can preserve the rendered outcome the
operator already depends on, then show what ConfigHub adds around that outcome:
reviewability, bounded blast radius, rollback, audit evidence, and later
runtime proof.

This is not a blanket production or fleet claim. It is a way to find the
strongest proof boundary for one selected slice.

## Starting Rule

Use the existing lane discipline.

```text
render parity
ConfigHub proof
local live proof
GitOps or OCI delivery proof
runtime observation
production support decision
```

Do not collapse those into one word such as tested. Each stage answers a
different question, and the report must say which boundary was reached.

For the public chart version of the model, see
[Two-Cluster Helm Parity Harness](./two-cluster-parity-harness.md). For the
lane vocabulary, see [Verification Lanes](../user/verification-lanes.md).

## Private Estate Inputs

An enterprise parity intake can include:

- one or more first-party Helm charts;
- a values-only repository with environment, provider, cluster, tenant, or
  region layers;
- Argo CD Applications or ApplicationSets that pass chart and values inputs to
  a controller;
- rendered YAML that is already checked into Git;
- target facts such as CRDs, admission Secrets, storage classes, APIService
  availability, controller-owned fields, and namespace policy;
- generated fan-out where one source definition reaches many live targets.

The first pass should classify source shape before recommending a route. A
values-only repository is not the same thing as a chart. An ApplicationSet is
not the same thing as one deployed Application. A rendered manifest directory
is not the same thing as the source that generated it.

## Privacy Boundary

The contract must have a privacy mode.

For customer-safe public or reusable artifacts:

- do not print customer names, internal service names, hostnames, internal
  URLs, credentials, or Secret values;
- use aggregate counts, source-shape types, digest references, and anonymized
  target identifiers;
- keep raw manifests and values out of public artifacts unless the customer has
  explicitly approved publication;
- state when the analysis is repo-only and when no live ConfigHub, controller,
  or Kubernetes proof has been collected.

## Proof Shape

The enterprise parity test has ten steps.

1. Intake the private source estate without leaking raw names or values.
2. Classify each input as first-party Helm chart, Helm values, Argo
   Application, Argo ApplicationSet, rendered YAML, Kustomize, or mixed.
3. Pick one safe slice with meaningful fan-out.
4. Reconstruct the current render path from chart, values, and controller
   source fields.
5. Produce a ConfigHub candidate path for the same rendered object set.
6. Compare semantic rendered objects before any live change.
7. Record target facts and prerequisites separately from render parity.
8. If approved, run live proof in a safe target or disposable target.
9. Produce a receipt that states the strongest proof boundary reached.
10. Report fan-out, density, target facts, proof gaps, non-claims, and next
    safe action.

## Required Packet Fields

The enterprise parity packet must include these fields or their moral
equivalent:

| Field | Meaning |
| --- | --- |
| Source shape summary | Counts and types for charts, values, Applications, ApplicationSets, rendered YAML, and mixed inputs. |
| Privacy mode | Whether output is internal, customer-safe aggregate, or customer-approved raw evidence. |
| Chart and values input digests | Digest references for chart packages and values layers, without raw private data in public artifacts. |
| Argo source reference shape | Whether the route uses Application, ApplicationSet, list generator, cluster generator, matrix generator, or mixed source fields. |
| Base or variant route decision | Whether the slice should become an installer base, a ConfigHub derived variant, a target-fact route, or a blocked route. |
| Rendered object count | The number of rendered Kubernetes objects compared for the selected slice. |
| Semantic diff result | Pass, watch, blocked, or not-run, with the comparison boundary named. |
| Fan-out | The number of live or generated targets reached by the selected source definition. |
| Density | The number of breakable fields, values, rules, monitors, or other mutable inputs in the selected unit. |
| Blast radius | Density multiplied by fan-out, with the unit named. |
| Target facts | Required CRDs, Secrets, storage classes, controllers, namespace policy, and runtime prerequisites. |
| Proof boundary reached | The strongest true boundary, such as repo-only render design, render parity, local live, GitOps live, or runtime observed. |
| Proof gaps | Missing evidence that prevents a stronger claim. |
| Non-claims | Claims the packet refuses to make. |
| Next safe action | The smallest action that would move the proof forward. |

## Density And Fan-Out

Density is how much breakable surface exists per unit. Examples include values
fields, alerting rules, ServiceMonitors, dashboards, remote write settings,
retention settings, generated Secrets, or target facts.

Fan-out is how many places that unit lands. Examples include generated
Applications per ApplicationSet, clusters per values layer, environments per
base, or targets reached by a promotion.

The product metric is:

```text
density x fan-out = blast radius
```

The enterprise packet should report density and fan-out even when the numbers
are partial. If a number is not measured, the packet must say what evidence is
missing and how to measure it.

## Target Facts

Target facts are not render parity. They are conditions the target must satisfy
before a rendered object set can be called live-ready.

Examples:

- compatible CRDs already exist or will be managed by the selected route;
- admission webhook Secret material is present, generated, or explicitly
  blocked;
- a required storage class exists;
- an APIService dependency is available;
- a controller owns fields that must be ignored, observed, or handed off;
- namespace policy, Pod Security, or admission policy permits the rendered
  workload.

Keep target facts in the packet even when render parity passes.

## Non-Claims

The enterprise parity test must refuse these claims until separately proven:

- Do not claim field-complete provenance on day one.
- Do not claim fleet-wide bounded propagation unless the target set is
  explicitly enumerated or queried.
- Do not claim production support without a target-scoped decision.
- Do not claim GitOps delivery from render parity alone.
- Do not claim runtime readiness from controller sync alone.
- Do not publish customer-identifying evidence in public artifacts.

## Synthetic Fixture

The fixture under `tests/enterprise-parity-fixture/packet.json` is a
customer-safe stand-in for a private observability estate. It exercises:

- one first-party Helm chart;
- one values-only source with layered values;
- one ApplicationSet source shape with generated target fan-out;
- density, fan-out, and blast-radius calculation;
- target facts, proof gaps, non-claims, and next safe action.

It is not a live proof. It is a contract fixture that keeps the required
enterprise parity output shape testable without publishing private material.

Verify the contract with:

```sh
npm run kind-parity:enterprise-contract:verify
```
