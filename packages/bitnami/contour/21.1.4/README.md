# Contour 21.1.4 installer package

This package contains three checked Contour configurations:

- `default` keeps the chart defaults, including the original Bitnami images.
- `no-crds` leaves the five Contour CRDs under another platform owner.
- `legacy` uses the frozen `bitnamilegacy` images so the old public chart can
  still be tested. It is proof material, not a production image recommendation.

Contour also needs two TLS Secrets before its workloads start. Helm normally
creates them with a pre-install hook that is not part of the ordinary rendered
YAML. This package includes the same chart-specific certificate action at
`prerequisites/contour-certgen/run.sh`. The generated catalog `try.sh` runs it
before applying the Contour objects and checks its outputs.

Render without touching a cluster:

```sh
cub installer setup \
  --pull ./packages/bitnami/contour/21.1.4 \
  --base legacy \
  --work-dir ./contour-legacy \
  --non-interactive
```

The strict live receipt compares ordinary Helm on one fresh cluster with the
packaged action plus `cub installer` output on another:

```text
runs/live-kind-parity/bitnami-contour-legacy/receipt.yaml
```
