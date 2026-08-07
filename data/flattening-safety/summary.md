# Flattening-safety verdicts

Each audited chart version gets one receipted answer to one question: what happens if you ship it as literal rendered YAML instead of running Helm? Findings come from a template-level scan of the pinned chart package (the witnesses directory), joined with the catalog's recorded hook and lifecycle evidence. The verdict schema is schemas/flattening-safety-verdict.schema.json and the model it feeds is docs/reference/certified-bundle-spec.md.

| chart | version | base | lane | verdict |
| --- | --- | --- | --- | --- |
| traefik/traefik | 41.0.2 | default | flatten-with-routes | recipes/traefik/traefik/41.0.2/publication/flattening-safety-verdict.yaml |
| jetstack/cert-manager | v1.21.0 | default | flatten-with-routes | recipes/jetstack/cert-manager/v1.21.0/publication/flattening-safety-verdict.yaml |
| external-secrets/external-secrets | 2.8.0 | default | flatten-with-routes | recipes/external-secrets/external-secrets/2.8.0/publication/flattening-safety-verdict.yaml |
| prometheus-community/kube-prometheus-stack | 87.19.2 | default | do-not-flatten | recipes/prometheus-community/kube-prometheus-stack/87.19.2/publication/flattening-safety-verdict.yaml |
| metrics-server/metrics-server | 3.13.1 | default | safe-to-flatten | recipes/metrics-server/metrics-server/3.13.1/publication/flattening-safety-verdict.yaml |
| kyverno/kyverno | 3.8.1 | default | do-not-flatten | recipes/kyverno/kyverno/3.8.1/publication/flattening-safety-verdict.yaml |
| aws-controllers-k8s/ec2-chart | 1.18.4 | eks-inference | flatten-with-routes | recipes/aws-controllers-k8s/ec2-chart/1.18.4/publication/flattening-safety-verdict.yaml |
| aws-controllers-k8s/iam-chart | 1.7.3 | eks-inference | flatten-with-routes | recipes/aws-controllers-k8s/iam-chart/1.7.3/publication/flattening-safety-verdict.yaml |
| aws-controllers-k8s/eks-chart | 1.16.3 | eks-inference | flatten-with-routes | recipes/aws-controllers-k8s/eks-chart/1.16.3/publication/flattening-safety-verdict.yaml |
| karpenter/karpenter | 1.14.0 | eks-inference | flatten-with-routes | recipes/karpenter/karpenter/1.14.0/publication/flattening-safety-verdict.yaml |
| nvidia/nvidia-device-plugin | 0.19.3 | eks-inference | safe-to-flatten | recipes/nvidia/nvidia-device-plugin/0.19.3/publication/flattening-safety-verdict.yaml |
| karpenter/karpenter | 1.14.0 | crds-managed | safe-to-flatten | recipes/karpenter/karpenter/1.14.0/publication/flattening-safety-verdict-crds-managed.yaml |
| nvidia/nvidia-device-plugin | 0.19.3 | nfd-enabled | flatten-with-routes | recipes/nvidia/nvidia-device-plugin/0.19.3/publication/flattening-safety-verdict-nfd-enabled.yaml |
| bitnami/redis | 27.0.0 | default | do-not-flatten | recipes/bitnami/redis/27.0.0/publication/flattening-safety-verdict.yaml |

A lane holds for the audited base named in the verdict. The variantScope block records how other values move the finding set; a different base deserves its own verdict, which is why certified bundles key on chart version and recipe variant together.

This lane scans helm.sh/resource-policy at template level, which the catalog's quirk coverage recorded as a missing axis (data/quirk-coverage/coverage.csv). The seven charts here now have that axis answered from source; the catalog-wide rendered-object scan remains open.

Witnesses are recorded once per pinned package by scripts/scan-flattening-witness.mjs, which needs the chart tarball and so runs outside the verify chain. Every witness hash is checked against the recipe source-lock here. Regenerate with `npm run flattening-safety`. Verify with `npm run flattening-safety:verify`.
