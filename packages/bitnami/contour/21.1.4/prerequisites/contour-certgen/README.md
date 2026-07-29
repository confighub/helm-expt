# Contour certificate setup

Contour and Envoy use mutual TLS for the xDS connection between them. The Helm
chart creates `contourcert` and `envoycert` with a pre-install and pre-upgrade
Job. Those Secrets are runtime outputs, so they are not present in a normal
`helm template --no-hooks` render.

This directory makes that chart step explicit. `run.sh` applies the
ServiceAccount, Role, RoleBinding, and Job rendered from the locked
`bitnami/contour@21.1.4` chart, waits for both Secrets, and removes the temporary
resources. Existing Secrets are left alone unless
`CONTOUR_CERTGEN_FORCE=1` is set.

The proof route uses the frozen `docker.io/bitnamilegacy` image because the
original free Bitnami image is no longer pullable. Production users should
mirror and review the image before adopting this route.

Run it for a namespace:

```sh
bash run.sh default
```

The route is chart-specific on purpose. It keeps the Helm chart and reproduces
the setup work that this version of the chart actually performs.
