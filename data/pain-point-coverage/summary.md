# Helm Pain Point Coverage

This generated report maps the 15 common Helm pain points to the current
helm-expt catalog, the ConfigHub desired-state graph, `cub installer`, and
`cub-scout`.

The purpose is not to claim every pain is fully solved today. The purpose is to
show where each pain is handled now, where it is a handoff, and what evidence or
work remains.

## Status Counts

- partial: 5
- partial-doctrine: 1
- partial-handoff: 1
- partial-known-gap: 1
- partial-live-dependent: 1
- partial-live-lane: 1
- partial-product-lane: 1
- partial-strong-on-redis: 1
- strong-current-proof: 1
- strong-for-supported-bases: 1
- strong-static-partial-operational: 1

## Claim Buckets

| Bucket | Count | Pain points | Meaning |
| --- | ---: | --- | --- |
| Strong static proof | 3 | Go-templated YAML<br>values.yaml sprawl<br>History without diffs | The repo has useful static or base-scoped proof today. This is not a blanket live-production claim. |
| Partial with current evidence | 6 | Failed upgrades wedge releases<br>CRD handling<br>Subchart and dependency hell<br>No field-level governance<br>Multi-environment promotion is DIY<br>Templating language limits | The model is working for examples or parts of the lifecycle, but the proof is not broad enough yet. |
| Live-dependent | 2 | GitOps impedance mismatch<br>Dry-run does not match reality | The answer depends on cluster, GitOps, runtime, or observation receipts. |
| Product or handoff lane | 2 | State lives in cluster secrets<br>Chart ownership and fork burden | The repo explains the route, but the durable value belongs in ConfigHub Server, cub-scout, or a product workflow. |
| Known gap or doctrine only | 2 | No native secrets story<br>Hooks are brittle | The repo has the policy and detection path, but not complete execution receipts yet. |

## Root Cause Model

Helm is a 1-to-many generator. One chart plus one values set can produce many
objects, and one high-density value can touch many fields across those objects.
After render, Helm loses the inverse: the output no longer explains which input
produced each field. Multiple generators such as Helm, Kustomize, GitOps
controllers, and agents multiply the problem unless their outputs and provenance
enter one graph.

## Pain Points And Next Actions

| Pain point | Current status | Remaining gap | Next action |
| --- | --- | --- | --- |
| Go-templated YAML | `strong-current-proof` | Complex template behavior is still chart-specific; provenance is not field-complete for every chart. | Use edge recovery and variant-path coverage to track where template behavior affects fields. |
| values.yaml sprawl | `strong-for-supported-bases` | Arbitrary user values and wrapper overlays need managed import or a new base variant. | Add variant-path coverage rows for custom values, overlays, and managed imports. |
| State lives in cluster secrets | `partial-handoff` | Queryable operation history and authority are ConfigHub Server concerns, not helm-expt alone. | Keep chain-of-proof status per chart/base/variant-path so desired and live claims remain separate. |
| Failed upgrades wedge releases | `partial` | Real upgrade/prune behavior and rollback semantics require live controller evidence. | Track upgrade and rollback as variant paths with their own proof links. |
| CRD handling | `partial` | CRD upgrade behavior remains an operator-reviewed lifecycle path. | Keep CRD install, no-crds, and CRD-upgrade as separate variant-path outcomes. |
| Subchart and dependency hell | `partial` | Dependency aliases and import-values need stronger scanner coverage. | Add alias, import-values, and library-chart axes to chart facts and quirk coverage. |
| No field-level governance | `partial-strong-on-redis` | Field-complete provenance is not yet available for every chart. | Expand value-source-map and edge recovery coverage chart by chart. |
| No native secrets story | `partial-known-gap` | Secret delivery on GitOps paths needs hard gates and production policy. | Track generated-fact and target-fact edges per variant path. |
| Hooks are brittle | `partial-doctrine` | Hook execution receipts are not complete for the hook-bearing catalog. | Separate pre-install, post-install, upgrade, and delete hooks in variant-path coverage. |
| Multi-environment promotion is DIY | `partial` | High-fanout propagation and override-protection need a stronger demo. | Use Prometheus/kube-prometheus-stack for the main high-fanout variant demo. |
| GitOps impedance mismatch | `partial-live-lane` | Controller-specific live proof is not complete for every base variant. | Keep GitOps live status separate from local render parity in all matrices. |
| History without diffs | `strong-static-partial-operational` | Fleet-wide query and operation history belong in ConfigHub Server. | Tie diffs and operations into variant-path coverage. |
| Templating language limits | `partial` | Not every template-language feature is field-provenanced yet. | Add scanner axes and require clear disposition for each extension slot. |
| Dry-run does not match reality | `partial-live-dependent` | Admission/defaulting parity is target-specific and requires live observation. | Add target/live requirements to variant-path coverage rather than hiding them in notes. |
| Chart ownership and fork burden | `partial-product-lane` | Creator UX and managed imports are product work beyond current static catalog proof. | Keep base, derived, and managed overlay paths explicit in user docs and coverage rows. |

## What To Open

| File | Purpose |
| --- | --- |
| [pain-points.csv](./pain-points.csv) | One row per pain point with current answer, handoff, evidence, and remaining gap. |
| [../../docs/user/helm-pain-points.md](../../docs/user/helm-pain-points.md) | User-facing explanation of the same matrix. |
| [../outcome-coverage/summary.md](../outcome-coverage/summary.md) | Outcome and proof-lane status per chart/base/feature. |
| [../variant-path-coverage/summary.md](../variant-path-coverage/summary.md) | Per chart/base/path proof status. |

## Regenerate

~~~sh
npm run pain-points:generate
npm run pain-points:verify
~~~
