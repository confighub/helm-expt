# Pilot: switch-effect map and generate-on-demand with a parity gate

A prototype of the model where an AI agent (Pilot) navigates a chart's switch
space and generates variants on demand, and ConfigHub holds and governs them.
Pilot is the author of intent; the chart renderer authors the objects; parity
authors the trust. Run on redis, 2026-07-04.

## 1. The switch-effect map (classified by rendering, not by hand)

`scripts/pilot-switch-effect-map.mjs` renders redis with each top-level feature
toggle flipped and diffs the object set against the baseline. The verdict is the
diff, not an opinion. See [redis.md](./redis.md).

- **6 structural** switches change the object set: `architecture=standalone`
  (removes 4 replica objects), `sentinel.enabled` (+4 -8, swaps the topology),
  `metrics.enabled` (+1), `tls.enabled` (+1), `networkPolicy.enabled=false`
  (-1), `serviceBindings.enabled` (+1).
- **4 field** switches change only values, including the two controls
  `replica.replicaCount` and `master.count`, which prove the classifier does
  not call everything structural.

Structural switches are base-variant territory; field switches are data edits.
Nobody curated the list. The machine decided by rendering.

## 2. Generate one variant on demand, gated by parity

`scripts/pilot-generate-variant.mjs` takes a plain-English intent, maps it to
switches (the only AI step), renders, and refuses to let the variant exist
unless parity holds. See [generated-variant-receipt.md](./generated-variant-receipt.md).

- **Intent:** a standalone redis cache with Prometheus metrics.
- **Switches:** `architecture=standalone`, `metrics.enabled` + serviceMonitor.
- **Composition:** +2 -4 objects; interaction observed and reported, because
  the rendered combination is not a clean sum of the per-switch deltas. The tool
  renders the real combination rather than trusting the map.
- **Determinism:** two renders byte-identical.
- **Route disposition:** renders a `ServiceMonitor`, which needs the Prometheus
  Operator CRDs. Named as a target prerequisite, not shipped silently.
- **Gate: PASS.**

## 3. Live landing check (ConfigHub stores it faithfully)

Uploaded the generated variant to a throwaway Space via `cub variant upload`,
compared the stored object set to the helm render, then deleted the Space
(org at 978/1000 links; nothing left behind).

- 11 of 12 objects stored identically.
- The one difference is `Secret/redis`: `cub variant upload` deliberately never
  stores rendered Secrets, which go out-of-band via a SecretStore. This is a
  documented, safer-than-Helm behavior, not a parity discrepancy. All
  non-Secret objects matched exactly.

## Why this is the answer to "should Pilot manage ad-hoc variants"

Pilot generated a variant nobody pre-blessed, from an intent in words, and it
arrived with a proof that it is the genuine chart output: composition against
the map, determinism, a named route, and faithful ConfigHub storage. An AI that
wrote the YAML directly could ship a plausible but wrong object set. This flow
cannot, because a wrong set fails composition and a non-reproducible one fails
determinism. Pilot authors the intent; parity certifies the render; ConfigHub
governs the result.
