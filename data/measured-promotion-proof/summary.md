# Test candidates, then promote the selected configuration

This live test compared three exact NGINX configurations on one throwaway kind
cluster. Every candidate served the same page. The destination also required at
least two ready replicas.

| Candidate | Ready replicas | HTTP results | p95 | Destination requirement | Decision |
| --- | ---: | ---: | ---: | --- | --- |
| replicas-1 | 1 | 60/60 | 0.958 ms | blocked | blocked |
| replicas-2 | 2 | 60/60 | 0.815 ms | pass | pass |
| replicas-3 | 3 | 60/60 | 0.737 ms | pass | pass |

The test selected **replicas-2** because it was the
smallest candidate that passed every fixed check and the destination
requirement. Its object-set hash is
`sha256:0ce8c7ab639ac03bd5cf4aa137416cea52315b25681cd5ee345aea9697a4a99c`.

That exact object set became the ConfigHub base, staging variant, and production
variant. ConfigHub published release OCI
`sha256:5f16fa15700d0aecdd2b449077e6bbe1f66b8392a83076957270881fc57f248d`. Argo CD reported
Synced/Healthy at the same digest, and the
delivered Deployment had 2 ready replicas.

## What this proves

- A test result can select one exact configuration rather than a vague set of values.
- The stated destination requirement can reject a configuration that still serves traffic.
- ConfigHub can keep and promote the selected object set without changing it.
- Argo CD can pull the resulting ConfigHub release OCI and reconcile it on Kubernetes.

## Limits

- This is one fixed HTTP and capacity test on one local kind target. It is not a performance benchmark or production capacity recommendation.
- The example has no hooks, CRDs, Secrets, migrations, storage, or cloud prerequisites. Charts with those requirements need additional tests and explicit lifecycle work.
- The target requirement was two ready replicas. A different destination or service-level objective can produce a different accepted configuration.
- The test selected among three known candidates. It did not search every possible Kubernetes or Helm setting.

The fixture is in `examples/promotion/nginx-candidate-test/`. The complete
machine receipt is `runs/measured-promotion-proof/receipt.yaml`.
