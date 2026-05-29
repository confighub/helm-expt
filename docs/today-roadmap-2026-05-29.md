# Today Roadmap - 2026-05-29

This is the working roadmap for today. It is deliberately tactical: answer the
current product questions, turn them into proof artifacts, and avoid expanding
scope until the path is crisp.

## Goal For Today

Make the Helm story easier to explain to Jesper, Brian, and a Helm user:

```text
cub helm install is the quick one-shot render/import action.
cub install recipes are durable, verified, variant-aware catalog artifacts.
helm-expt proves when and why the second path is worth it.
```

The output today should make three things clear:

```text
1. How this differs from cub helm install.
2. Whether we need cub install import helm.
3. How a real wrapper-chart catalog, such as Kubara, maps into the model.
```

## Current Sync State

As of this roadmap:

```text
main is synced with origin/main
no open helm-expt PRs
no stray codex/* branches
```

## Workstream 1 - Answer Jesper's Challenge

Question:

```text
How is this different from and better than cub helm install?
```

Answer we need to document:

```text
cub helm install = render this chart now into ConfigHub Units.
cub install recipe = reusable product artifact with locks, variants, receipts,
verification, scans, promotion, upgrade, and support scope.
```

Today's artifact:

```text
docs/cub-helm-vs-install-recipes.md
```

Acceptance:

- Explain the difference without attacking `cub helm install`.
- Treat `cub helm install` as a useful quick path and ancestor.
- Explain when a user should use each path.
- Explain how a one-shot Helm install can graduate into a maintained recipe.
- Include Kubara as an example of why one-shot render is not enough for a
  maintained platform catalog.

## Workstream 2 - Decide The Import Shape

Question:

```text
Do we need import for recipes?
```

Proposed answer:

```text
Yes, but as a bridge into the recipe/package world, not as a replacement for
cub helm install.
```

Preferred shape:

```sh
cub install import helm ...
```

or, if the command hierarchy needs to be more explicit:

```sh
cub install recipe import helm ...
```

Meaning:

```text
import = create a recipe/package candidate from Helm inputs
install = render/apply/upload a selected recipe/base/variant
```

Today's artifact:

```text
docs/helm-import-roadmap.md
```

Acceptance:

- Define import inputs:
  - chart URL/path/version/digest
  - dependency lock
  - values files / overlays
  - kube version / API profile
  - target facts / generated facts policy
  - namespace / release name
- Define import outputs:
  - source lock
  - dependency lock
  - effective values
  - control-point report
  - candidate recipe/package
  - base variants
  - render receipt
  - Helm equivalence check
  - scan/check plan
- State that import can start with AI/harness assistance, but the product goal
  is a repeatable `cub install` capability.

## Workstream 3 - Kubara Catalog Test Case

Question:

```text
Can managed-service-catalog/helm map into ConfigHub using helm-expt?
```

Finding from today's inspection:

```text
Yes, but the mapping unit is wrapper chart + customer values overlay, not just
upstream public chart.
```

Kubara shape:

```text
managed-service-catalog/helm/<chart>
  + customer-service-catalog/helm/<cluster>/<chart>/values.yaml
  -> deterministic render
  -> recipe/package candidate
  -> ConfigHub Units and variants
```

Important smoke-test result:

```text
managed chart values only: 12/15 rendered
managed chart + kubara-demo customer overlay: 15/15 rendered
```

The three managed-only failures were meaningful, not random:

| Chart | Why managed-only render failed | Model home |
| --- | --- | --- |
| `cert-manager` | Missing `clusterIssuer.*` values. | customer/env variant inputs and target facts |
| `external-dns` | Webhook provider image repository/tag missing. | provider variant and credential target facts |
| `loki` | Storage/bucket values missing. | storage-mode variant |

Today's artifact:

```text
docs/kubara-catalog-mapping.md
```

Acceptance:

- List the Kubara managed charts and dependencies at a high level.
- Explain wrapper chart vs public chart.
- Explain customer overlay as install/deployment variant input.
- Identify target facts:
  - `ClusterSecretStore`
  - ExternalSecret remote refs
  - image pull secret
  - DNS provider credentials
  - ACME issuer settings
  - MetalLB address pools
  - ingress class / Traefik CRDs
- Identify proof gaps:
  - dependency locks are ignored in Kubara's repo and must be captured by import
  - live proof needs CRDs/controllers present
  - Argo multi-source value behavior must be reproduced by the import receipt

## Workstream 4 - First Kubara Golden

Do not try to import all Kubara charts today. Pick one small but meaningful
golden.

Recommended first choices:

| Candidate | Why |
| --- | --- |
| `metrics-server` | Small, already overlaps helm-expt, good wrapper-chart baseline. |
| `external-dns` | Exercises provider values, ExternalSecret, credentials, and target facts. |
| `cert-manager` | Exercises ClusterIssuer, CRDs, capability-gated monitoring, and customer overlay. |

Today's recommended first golden:

```text
external-dns
```

Reason:

```text
It demonstrates the value beyond cub helm install most clearly: managed wrapper
chart + customer overlay + provider-specific values + ExternalSecret target
facts.
```

Acceptance:

- Create a Kubara analysis note for `external-dns`.
- Capture render command and result.
- Classify values into:
  - recipe/source lock
  - managed defaults
  - customer overlay
  - target facts
  - post-render variant fields
- Define what a recipe import would need to record.
- Define the eventual verification golden.

## Workstream 5 - Keep The Proof Discipline

Every document or artifact added today should respect the existing verification
doctrine:

```text
same blueprint
same inputs
same preview
same checks
same receipts
across UX, AX, and FX
```

For Helm import specifically:

```text
same chart source
same values overlays
same dependency lock
same capability profile
same rendered objects
same proof receipts
```

Acceptance:

- `git diff --check` passes.
- `npm run verify` passes after doc/artifact changes.
- Any new claim about Kubara is backed by an inspected file path or smoke-test
  result.

## Today Done Means

By the end of today, this repo should answer:

```text
Why not just cub helm install?
What does cub install import helm need to create?
Can Kubara-style wrapper charts map into this?
Which Kubara chart proves the path first?
What invariants/goldens verify the path continuously?
```

Today's target PRs:

```text
1. Roadmap and positioning docs.
2. Kubara catalog mapping doc.
3. Optional first Kubara golden analysis, if time allows.
```
