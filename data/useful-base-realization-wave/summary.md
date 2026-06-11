# Useful Base Realization Wave

Generated. Do not edit by hand.

This wave turns selected useful-base proposals into real recipe variants and
`cub installer` package bases. Every row in this first wave is an
`alias-of-default-render`: the Kubernetes object set is intentionally identical
to the already-proved default render, but users now get a named start path that
matches the job they are trying to do.

These rows are not production-supported catalog offers yet. They still need the
ConfigHub proof lane, selected live evidence, and production disposition before
they can be promoted.

## Summary

~~~text
realized bases: 10
strategy: alias-of-default-render
remaining status: candidate base, not production support
~~~

## Rows

| Chart | Base | Strategy | Remaining before catalog |
| --- | --- | --- | --- |
| prometheus-community/kube-state-metrics@7.4.0 | cluster-metrics-readonly | alias-of-default-render | ConfigHub proof lane; selected live lane; production disposition |
| prometheus-community/prometheus-blackbox-exporter@11.10.0 | cluster-metrics-readonly | alias-of-default-render | ConfigHub proof lane; selected live lane; production disposition |
| prometheus-community/prometheus-adapter@5.3.0 | cluster-metrics-readonly | alias-of-default-render | ConfigHub proof lane; selected live lane; production disposition |
| stakater/reloader@2.2.12 | controller-default-reviewed | alias-of-default-render | ConfigHub proof lane; selected live lane; production disposition |
| autoscaler/cluster-autoscaler@9.57.0 | controller-default-reviewed | alias-of-default-render | ConfigHub proof lane; selected live lane; production disposition |
| argo-cd/argo-workflows@1.0.14 | controller-default-reviewed | alias-of-default-render | ConfigHub proof lane; selected live lane; production disposition |
| elastic/filebeat@8.5.1 | node-or-cluster-collector | alias-of-default-render | ConfigHub proof lane; selected live lane; production disposition |
| istio/gateway@1.30.0 | controller-default-reviewed | alias-of-default-render | ConfigHub proof lane; selected live lane; production disposition |
| nats/surveyor@0.20.9 | default-reviewed | alias-of-default-render | ConfigHub proof lane; selected live lane; production disposition |
| vm/victoria-metrics-single@0.39.0 | default-reviewed | alias-of-default-render | ConfigHub proof lane; selected live lane; production disposition |

## Reading Rule

- Use these bases as clearer start paths, not as production guarantees.
- The rendered YAML matches the default render by design.
- If a future useful base changes values or objects, it must be rendered and
  proved as its own object set rather than treated as an alias.

Machine-readable form:

- [wave.csv](./wave.csv)

Regenerate:

~~~sh
npm run top100:useful-base-realization
npm run top100:useful-base-realization:verify
~~~
