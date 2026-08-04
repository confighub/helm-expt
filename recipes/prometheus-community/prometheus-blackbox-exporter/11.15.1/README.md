# prometheus-community/prometheus-blackbox-exporter 11.15.1 Proof

This is the exact-artifact root-retention proof for prometheus-community/prometheus-blackbox-exporter@11.15.1. It remains a catalog candidate, not a claim of production support or complete Kubara wrapper compatibility.

Variants:

- `default`: chart defaults; 4 Helm objects, 5 cub installer objects including Namespace.

What this proves:

- the exact upstream artifact digest is captured independently of a mutable repository index;
- the chart renders deterministically and the installer package preserves the rendered object set;
- additive root retention remains gated by the separately committed exact-version live-qualification receipt, and does not imply Kubara wrapper compatibility or production support.

Useful commands:

```sh
npm run kubara-catalog-promotion:stage
npm run kubara-catalog-promotion:stage:verify
npm run kubara-catalog-promotion:dry-run
```
