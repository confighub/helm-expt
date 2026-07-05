# Pilot-generated variant, parity receipt

**Intent:** A standalone redis with TLS, certificates from a pre-staged Secret (the route the refusal named)

**Switches the agent mapped it to:** `architecture=standalone`, `tls.enabled+existingSecret`

**Mapped by:** claude (corrected mapping, following the refusal's route)

The intent is the only step an AI performed. The chart's renderer produced the
objects; the parity gate below certifies they are the genuine chart output.

## The gate

| Check | Result |
| --- | --- |
| Composition | +0 objects, -4 objects vs baseline (14); interaction observed: false |
| Determinism | byte-identical across two renders (`22ede17bddc59615…`) |
| Route disposition | none |

**Objects added:** none

**Objects removed:** `policy/v1/PodDisruptionBudget/redis-replicas`, `v1/ServiceAccount/redis-replica`, `v1/Service/redis-replicas`, `apps/v1/StatefulSet/redis-replicas`

## Routing

No routed quirks introduced by these switches.

## Verdict

**PASS.** Parity gate passed. The generated variant is the genuine chart output for these switches, reproducible, with routed quirks named. It may exist as a ConfigHub variant.


## Why this is not a hallucination

Pilot chose the switches. The chart rendered the objects. The gate proves the
object set is exactly the sum of the switch-effect map's predictions plus any
interaction it renders and reports, that the render is reproducible, and that
the one routed quirk is named. An AI that wrote this YAML directly could ship a
plausible but wrong object set; this flow cannot, because a wrong set fails
composition and a non-reproducible one fails determinism.
