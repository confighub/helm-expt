# When to flatten a Helm chart

Flattening means rendering a Helm chart into literal Kubernetes objects and keeping
those objects as the configuration that will be reviewed and delivered. Helm remains
the package source. It does not run in the later delivery path.

This is useful because the generated objects can be read, compared, scanned, changed
one field at a time, stored as OCI, or retained as ConfigHub Units. It is not safe to
assume that every chart can be flattened without more work.

## The three decisions

| Decision | Use it when | What must travel with the YAML |
| --- | --- | --- |
| Flatten | The exact chart configuration has no required Helm runtime behavior outside the rendered objects. | Pinned source inputs, object inventory, digest, checks, and evidence. |
| Flatten with recorded setup | The objects are usable after named CRDs, hooks, certificates, Secrets, setup Jobs, or ordering steps are handled deliberately. | The same records, plus each prerequisite or lifecycle action, its owner, order, check, and receipt. |
| Keep rendering late | The chart depends on live lookup, unsafe generated state, destructive lifecycle behavior, or another mechanism that has no adequate route for this use case. | The source and values remain authoritative. Record why the literal path was refused and what still needs checking at deployment time. |

The decision belongs to an exact chart version, configuration, and target. A verdict
for one preset does not automatically cover every values combination or later chart
version.

## How this matches the Golden Path model

The ConfigHub Golden Path example makes the generated configuration independent of
the tool that created it. The tool chooses useful defaults, then writes ordinary AWS
or Kubernetes objects. A user can later change a field that the tool never exposed.
The data remains after the tool is changed or replaced.

The Config Workshop follows the same rules:

1. Keep the original source, version, values, capabilities, and checksums.
2. Keep the rendered objects in their native Kubernetes schema.
3. Count and hash the output so a missing document cannot pass unnoticed.
4. Record which later edits came from ConfigHub rather than the source render.
5. On source refresh, keep non-conflicting recorded edits and require review when both
   sources changed the same field.
6. Refuse unresolved placeholders before release.
7. Do not hide Helm behavior that is absent from ordinary rendered YAML.

That last rule is important. `helm template` does not execute hooks, preserve Helm's
resource-policy semantics, or guarantee that `lookup()` saw the intended cluster. It
can also render webhook configurations before their certificates exist. These are not
minor annotations. They can decide whether the result works.

## What Config Workshop adds

The EKS inference example uses a strict guard: it accepts the ACK controller charts
that are clean for its exact use, refuses hazards unless their handling is written
down, pins Kubernetes capabilities, and checks that every rendered document survived.

Config Workshop applies the same discipline across a larger catalog:

- `BaseVariantRecord` connects the source and intent record to the literal objects,
  OCI references, policy, lifecycle work, target facts, and current evidence.
- Per-base flattening verdicts distinguish ordinary literal output, output that needs
  recorded routes, and output that should not be flattened for the stated path.
- Catalog configurations make chart-specific decisions. They do not claim that one
  universal rewrite can replace Helm runtime behavior.
- Argo CD, Flux, direct apply, and ConfigHub release OCI remain separate delivery
  claims. Evidence for one does not prove the others.

## Kubara and other composers

Kubara remains responsible for selecting components, combining catalogs, and writing
its generated platform. ConfigHub does not reconstruct that platform from individual
chart pages. Instead, the Kubara `config.yaml`, catalogs, generated files, and source
lock stay together. The companion source-and-intent record links exact component
versions to Config Workshop evidence and records the lifecycle checks needed for the
generated platform.

The same boundary applies to AICR and other source tools. Their native input model
stays authoritative. Literal Kubernetes output becomes a ConfigHub base only when the
source, intent, omitted runtime behavior, and evidence remain connected to it.

## AI-assisted changes

An AI assistant can propose values or edit a rendered object, but it should not blur
the two. A promotion review needs the old source render, old accepted configuration,
new source render, and proposed accepted configuration. That lets the review identify:

- fields changed by the new source;
- post-render edits that should remain;
- fields changed by both and requiring a decision; and
- formatting changes that do not alter the objects.

Hooks, CRDs, target prerequisites, and unrun checks remain visible in the result. An AI
explanation cannot turn missing evidence into a pass.

## Related sources

- [Golden Path tools that finally work](https://confighub.com/blog/golden-path-tools-that-finally-work)
- [The EKS inference flattening contract](https://github.com/confighub/eks-inference/blob/main/docs/flattening.md)
- [Config catalog doctrine](./config-catalog-doctrine.md)
- [Check and promote with AI](../user/check-and-promote-with-ai.md)
- [Flattening safety results](../../data/flattening-safety/summary.md)

