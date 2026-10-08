# Model Support Report (Level 2)

Generated from recipe / pain-report / receipt / catalog-status artifacts. A chart is **supported (Level 2)**
when all 6 support criteria pass — every Helm quirk modeled or explicitly disclosed (`needs-operator-decision`
/ `blocked` are honest dispositions, not gaps).

This is a model-support report, not the whole live outcome. Full chart-choice support still needs the
outcome coverage: Helm-equivalence, ConfigHub proof, local live observation, ConfigHub OCI/Argo or Flux,
and live Helm-vs-ConfigHub parity for each supported default or declared main choice.

**Variant richness is a separate enhancement metric** until a choice is declared supported. Once declared
supported, that choice must be tracked as its own chart-recipe-variant row in `data/lane-test-matrix/`.

## Headline

```text
charts: 180
supported (Level 2, all 6): 162
not yet supported: 18
variant-rich (enhancement, >1 variant): 119
```

## Per-criterion coverage (the 6 support criteria)

- `render_equivalent`: 180/180
- `behaviorally_complete`: 175/180
- `readable`: 167/180
- `usable`: 180/180
- `verifiable`: 180/180
- `honestly_scoped`: 180/180
- _enhancement_ `variant_complete`: 119/180  (not a support criterion)

## Gap by criterion (how many charts each one blocks)

- `readable`: 13
- `behaviorally_complete`: 5

## Not yet supported (the work queue)

| Chart | Score | Missing support criteria |
| --- | ---: | --- |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.59.0` | 5/6 | readable |
| `dra-driver-nvidia/dra-driver-nvidia-gpu@0.4.1` | 5/6 | readable |
| `dra-driver-nvidia/dra-driver-nvidia-gpu@0.5.0` | 5/6 | readable |
| `eks/aws-efa-k8s-device-plugin@v0.5.29` | 5/6 | readable |
| `external-secrets/external-secrets@2.10.0` | 5/6 | behaviorally_complete |
| `external-secrets/external-secrets@2.5.0` | 5/6 | behaviorally_complete |
| `external-secrets/external-secrets@2.7.0` | 5/6 | behaviorally_complete |
| `external-secrets/external-secrets@2.8.0` | 5/6 | behaviorally_complete |
| `jetstack/cert-manager@v1.20.2` | 5/6 | behaviorally_complete |
| `k8s-ephemeral-storage-metrics/k8s-ephemeral-storage-metrics@1.19.2` | 5/6 | readable |
| `kai-scheduler/kai-scheduler@v0.14.1` | 5/6 | readable |
| `kai-scheduler/kai-scheduler@v0.16.9` | 5/6 | readable |
| `kubeflow/kubeflow-trainer@2.2.0` | 5/6 | readable |
| `node-feature-discovery/node-feature-discovery@0.19.0` | 5/6 | readable |
| `nvidia/nodewright@v0.17.1` | 5/6 | readable |
| `nvidia/nodewright@v0.19.0` | 5/6 | readable |
| `prometheus-community/kube-prometheus-stack@84.4.0` | 5/6 | readable |
| `prometheus-community/prometheus-operator-crds@28.0.1` | 5/6 | readable |

## Notes

- **Supported (Level 2)** = the 6 criteria above all pass: render-equivalent · quirks accounted (pain report,
  no unknown/unhandled) · readable · usable · verifiable · honestly scoped. Quirks left as
  `needs-operator-decision` are *disclosed*, not silent — the human-review residue, tracked per chart in
  `helm-pain-report.yaml`; they do not block Level-2 support.
- **`variant_complete` is an ENHANCEMENT for the Level-2 model report.** A default-only chart can have a
  complete model for its declared scope, but it is not fully live-supported for unbuilt or undeclared
  main choices. Once a non-default choice is declared supported, it must get its own lane evidence.
- Re-run `npm run completeness:generate` after any chart's pain report, receipts, or catalog-status change.
