# SelectableFields Capability Witness

This lane reruns the strict CRD capability question behind the Kubernetes 1.30
watchlist rows. It applies only the rendered CRDs that author
`spec.versions[].selectableFields` to a fresh `kindest/node:v1.35.0`
cluster, then reads the live CRDs back and compares those fields.

```text
pass: 2
blocked: 0
not-run: 0
```

| Chart | Base | Profile | Result | Selectable CRDs | Comparisons | Receipt |
| --- | --- | --- | --- | ---: | ---: | --- |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | kind-kubernetes-1.35 | pass | 4 | 4 | data/capability-profile-witnesses/selectablefields/receipts/jetstack-cert-manager-crds-enabled-kind-1.35.yaml |
| `external-secrets/external-secrets@2.5.0` | default | kind-kubernetes-1.35 | pass | 1 | 2 | data/capability-profile-witnesses/selectablefields/receipts/external-secrets-external-secrets-default-kind-1.35.yaml |

This does not erase the Kubernetes 1.30 watchlist rows. It proves that the same
rendered CRDs preserve `selectableFields` on the named Kubernetes 1.35 kind
profile. Broader production support still needs target-scoped evidence for the
target profile being claimed.
