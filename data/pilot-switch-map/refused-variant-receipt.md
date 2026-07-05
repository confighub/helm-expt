# Pilot-generated variant, parity receipt

**Intent:** A standalone redis with TLS on, certs auto-generated

**Switches the agent mapped it to:** `architecture=standalone`, `tls.enabled`

**Mapped by:** claude (live mapping)

The intent is the only step an AI performed. The chart's renderer produced the
objects; the parity gate below certifies they are the genuine chart output.

## The gate

| Check | Result |
| --- | --- |
| Composition | +1 objects, -4 objects vs baseline (14); interaction observed: true |
| Determinism | DIVERGED (`15d839c1bf9fb864…`) |
| Route disposition | none |

**Objects added:** `v1/Secret/redis-crt`

**Objects removed:** `policy/v1/PodDisruptionBudget/redis-replicas`, `v1/ServiceAccount/redis-replica`, `v1/Service/redis-replicas`, `apps/v1/StatefulSet/redis-replicas`

## Routing

No routed quirks introduced by these switches.

## Verdict

**FAIL.** Parity gate FAILED. The variant is not allowed to exist as mapped. The correct route forward is named in this receipt.

## The correct route forward

Render-time TLS generation mints new certificates on every render, so the output can never be reproducible config. Keep certificate material out of the render. Use the chart's existing-secret form (for redis: tls.enabled with tls.existingSecret and the cert/key/CA filenames) against a pre-staged Secret, or let cert-manager own issuance and rotation on the target. Then regenerate: the render becomes deterministic, the Secret lives in a SecretStore instead of the rendered output, and the variant can exist.

A refusal is not a wall. The block names the failing check; this section names
what to do instead in this paradigm, so the next attempt is the right one.


## Why this is not a hallucination

Pilot chose the switches. The chart rendered the objects. The gate proves the
object set is exactly the sum of the switch-effect map's predictions plus any
interaction it renders and reports, that the render is reproducible, and that
the one routed quirk is named. An AI that wrote this YAML directly could ship a
plausible but wrong object set; this flow cannot, because a wrong set fails
composition and a non-reproducible one fails determinism.
