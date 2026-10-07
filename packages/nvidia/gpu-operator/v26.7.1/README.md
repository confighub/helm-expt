# nvidia/gpu-operator v26.7.1 Installer Package

This package is generated from the gpu-operator proof artifacts. It has not been
published or run on a cluster.

- `default` holds 27 objects, 8 of them CRDs: chart defaults: the bundled node-feature-discovery on, driver 595.91.07.

The chart also renders Helm hook objects. Helm runs them when a release is
upgraded or deleted, so they are not in the bases. They are kept in
`prerequisites/gpu-operator-lifecycle`, and `prerequisites/gpu-operator-lifecycle/lifecycle-actions.yaml`
records when each one applies. Nothing runs them automatically.

Regenerate and check every reviewed version with:

```sh
npm run nvidia-gpu-stack-coverage:generate -- --only gpu-operator
npm run nvidia-gpu-stack-coverage:verify -- --only gpu-operator
```
