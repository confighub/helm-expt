# Fleet Blast-Radius Demo

This generated surface shows a fleet-wide base change as data: for a base config promoted across a fleet of environment variants, which rendered objects a base-value change would touch in each environment, and which environments are **shielded by an override** (override protection).

The per-environment object set is the *predicted* blast radius from each chart's `value-source-map`, which [`data/blast-radius-accuracy`](../blast-radius-accuracy/summary.md) proves accurate (13/13 recorded cases). An environment that pins a value via an override is shielded from a base change to that value: its explicit choice wins. Re-rendering each environment to confirm the prediction is the rigor upgrade (see *Next*).

## bitnami/redis@25.5.3

A fleet of governed environment variants derived from the redis default base. It mirrors the real ConfigHub promotion helm-redis-mapping-default -> helm-redis-mapping-prod-us-east (Kubara), extended to a four-environment fleet. Each environment that pins a value via an override is shielded from a base change to that value: its explicit choice wins (override-protection).

Environments and the values each one pins:

| Environment | Pins (overrides) |
| --- | --- |
| `dev` | _(tracks base)_ |
| `staging` | `replica.replicaCount` |
| `prod-us-east` | `replica.replicaCount`, `auth.password` |
| `prod-eu-west` | `replica.replicaCount`, `auth.password`, `image.digest` |

Blast radius of each base change, per environment:

| Base change | `dev` | `staging` | `prod-us-east` | `prod-eu-west` |
| --- | --- | --- | --- | --- |
| `image.digest` | 2 objects | 2 objects | 2 objects | **shielded** |
| `auth.password` | 3 objects | 3 objects | **shielded** | **shielded** |
| `replica.replicaCount` | 1 object | **shielded** | **shielded** | **shielded** |

Objects each change touches where it propagates:

- `image.digest` (bump the redis image digest in the base): `apps/v1|StatefulSet|redis|redis-master`, `apps/v1|StatefulSet|redis|redis-replicas`
- `auth.password` (rotate the generated redis auth secret): `apps/v1|StatefulSet|redis|redis-master`, `apps/v1|StatefulSet|redis|redis-replicas`, `v1|Secret|redis|redis`
- `replica.replicaCount` (change the base replica count): `apps/v1|StatefulSet|redis|redis-replicas`

## How to read this

- **N objects**: the environment inherits the base change; those N rendered objects change there.
- **shielded**: the environment pins that value via an override, so the base change does not reach it. This is the bounded, override-protected case: the fleet-wide change is contained *before* it ships.

## Next (rigor upgrade)

- Re-render each environment (base + overrides) before/after the change and diff, like `scripts/record-blast-radius-case.mjs`, to confirm the predicted set against an actual render per environment.
- Add fleets for `bitnami/nginx@24.0.2` and `prometheus-community/kube-prometheus-stack@85.3.3` (the other charts with a value-source-map) by dropping in a `fleet.yaml` — no code change.
- Tie the redis fleet to the live ConfigHub promotion (`helm-redis-mapping-default` -> `helm-redis-mapping-prod-us-east`).

## Regenerate

~~~sh
npm run blast-radius-fleet:generate
npm run blast-radius-fleet:verify
~~~
