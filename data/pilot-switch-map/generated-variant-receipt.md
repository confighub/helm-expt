# Pilot-generated variant, parity receipt

**Intent:** A standalone redis cache with Prometheus metrics exposed.

**Switches Pilot mapped it to:** `architecture=standalone`, `metrics.enabled`

The intent is the only step an AI performed. The chart's renderer produced the
objects; the parity gate below certifies they are the genuine chart output.

## The gate

| Check | Result |
| --- | --- |
| Composition | +2 objects, -4 objects vs baseline (14); interaction observed: true |
| Determinism | byte-identical across two renders (`06bf02a9163204f1…`) |
| Route disposition | `monitoring.coreos.com/v1/ServiceMonitor/redis` |

**Objects added:** `v1/Service/redis-metrics`, `monitoring.coreos.com/v1/ServiceMonitor/redis`

**Objects removed:** `policy/v1/PodDisruptionBudget/redis-replicas`, `v1/ServiceAccount/redis-replica`, `v1/Service/redis-replicas`, `apps/v1/StatefulSet/redis-replicas`

## Routing

Renders a ServiceMonitor, which needs the Prometheus Operator CRDs on the target. Routed as a target prerequisite, not shipped silently.

## Verdict

**PASS.** Parity gate passed. The generated variant is the genuine chart output for these switches, reproducible, with routed quirks named. It may exist as a ConfigHub variant.

## Why this is not a hallucination

Pilot chose the switches. The chart rendered the objects. The gate proves the
object set is exactly the sum of the switch-effect map's predictions plus any
interaction it renders and reports, that the render is reproducible, and that
the one routed quirk is named. An AI that wrote this YAML directly could ship a
plausible but wrong object set; this flow cannot, because a wrong set fails
composition and a non-reproducible one fails determinism.
