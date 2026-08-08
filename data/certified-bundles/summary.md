# Certified bundle receipts

One receipt shape covers a bundle from every producer. These four reference receipts prove it: the catalog's flattened traefik render, a Kubara component definition, a bundle eks-inference published to its own registry, and the Sveltos example's literal ClusterProfile. The spec lives at docs/reference/certified-bundle-spec.md and the schema at schemas/certified-bundle-receipt.schema.json.

| producer | component | source | OCI | lane | status |
| --- | --- | --- | --- | --- | --- |
| config-workshop-catalog | traefik-traefik-41.0.2-default | traefik 41.0.2 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-traefik-traefik-41-0-2-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | jetstack-cert-manager-v1.21.0-crds-enabled | cert-manager v1.21.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-jetstack-cert-manager-v1-21-0-crds-enabled:latest` | flatten-with-routes | certified |
| config-workshop-catalog | gatekeeper-gatekeeper-3.22.2-default | gatekeeper 3.22.2 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-gatekeeper-gatekeeper-3-22-2-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | projectcalico-tigera-operator-v3.32.0-default | tigera-operator v3.32.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-projectcalico-tigera-operator-v3-32-0-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | argo-cd-argo-cd-9.5.15-default | argo-cd 9.5.15 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-argo-cd-argo-cd-9-5-15-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | aws-controllers-k8s-ec2-chart-1.18.4-default | ec2-chart 1.18.4 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-aws-controllers-k8s-ec2-chart-1-18-4-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | aws-controllers-k8s-ec2-chart-1.18.4-eks-inference | ec2-chart 1.18.4 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-aws-controllers-k8s-ec2-chart-1-18-4-eks-inference:latest` | flatten-with-routes | certified |
| config-workshop-catalog | aws-controllers-k8s-eks-chart-1.16.3-default | eks-chart 1.16.3 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-aws-controllers-k8s-eks-chart-1-16-3-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | aws-controllers-k8s-eks-chart-1.16.3-eks-inference | eks-chart 1.16.3 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-aws-controllers-k8s-eks-chart-1-16-3-eks-inference:latest` | flatten-with-routes | certified |
| config-workshop-catalog | aws-controllers-k8s-iam-chart-1.7.3-default | iam-chart 1.7.3 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-aws-controllers-k8s-iam-chart-1-7-3-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | aws-controllers-k8s-iam-chart-1.7.3-eks-inference | iam-chart 1.7.3 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-aws-controllers-k8s-iam-chart-1-7-3-eks-inference:latest` | flatten-with-routes | certified |
| config-workshop-catalog | external-secrets-external-secrets-2.5.0-default | external-secrets 2.5.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-external-secrets-external-secrets-2-5-0-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | external-secrets-external-secrets-2.8.0-default | external-secrets 2.8.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-external-secrets-external-secrets-2-8-0-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | fluent-fluent-bit-0.57.6-default | fluent-bit 0.57.6 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-fluent-fluent-bit-0-57-6-default:latest` | safe-to-flatten | certified |
| config-workshop-catalog | hashicorp-vault-0.32.0-default | vault 0.32.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-hashicorp-vault-0-32-0-default:latest` | safe-to-flatten | certified |
| config-workshop-catalog | jetstack-cert-manager-v1.20.2-default | cert-manager v1.20.2 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-jetstack-cert-manager-v1-20-2-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | jetstack-cert-manager-v1.21.0-default | cert-manager v1.21.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-jetstack-cert-manager-v1-21-0-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | karpenter-karpenter-1.14.0-crds-managed | karpenter 1.14.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-karpenter-karpenter-1-14-0-crds-managed:latest` | safe-to-flatten | certified |
| config-workshop-catalog | karpenter-karpenter-1.14.0-default | karpenter 1.14.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-karpenter-karpenter-1-14-0-default:latest` | flatten-with-routes | certified |
| config-workshop-catalog | karpenter-karpenter-1.14.0-eks-inference | karpenter 1.14.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-karpenter-karpenter-1-14-0-eks-inference:latest` | flatten-with-routes | certified |
| config-workshop-catalog | metrics-server-metrics-server-3.13.0-default | metrics-server 3.13.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-metrics-server-metrics-server-3-13-0-default:latest` | safe-to-flatten | certified |
| config-workshop-catalog | metrics-server-metrics-server-3.13.1-default | metrics-server 3.13.1 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-metrics-server-metrics-server-3-13-1-default:latest` | safe-to-flatten | certified |
| config-workshop-catalog | nvidia-nvidia-device-plugin-0.19.3-default | nvidia-device-plugin 0.19.3 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-nvidia-device-plugin-0-19-3-default:latest` | safe-to-flatten | certified |
| config-workshop-catalog | nvidia-nvidia-device-plugin-0.19.3-eks-inference | nvidia-device-plugin 0.19.3 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-nvidia-device-plugin-0-19-3-eks-inference:latest` | safe-to-flatten | certified |
| config-workshop-catalog | prometheus-community-prometheus-blackbox-exporter-11.15.1-default | prometheus-blackbox-exporter 11.15.1 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-prometheus-community-prometheus-blackbox-exporter-11-15-1-default:latest` | safe-to-flatten | certified |
| config-workshop-catalog | prometheus-community-prometheus-29.8.0-default | prometheus 29.8.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-prometheus-community-prometheus-29-8-0-default:latest` | safe-to-flatten | certified |
| config-workshop-catalog | secrets-store-csi-driver-secrets-store-csi-driver-1.6.0-default | secrets-store-csi-driver 1.6.0 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-secrets-store-csi-driver-secrets-store-csi-driver-1-6-0-default:latest` | flatten-with-routes | certified |
| kubara | current-platform-metrics-server | metrics-server 3.13.1 | not published | safe-to-flatten | certified |
| eks-inference | platform-profile | literal-yaml | `ghcr.io/confighub/configs/eks-inference/platform-profile:latest` | born-flattened | certified |
| eks-inference | ack-controllers | helm-chart | `ghcr.io/confighub/configs/eks-inference/ack-controllers:latest` | flatten-with-routes | certified |
| eks-inference | aws-network | literal-yaml | `ghcr.io/confighub/configs/eks-inference/aws-network:latest` | born-flattened | certified |
| eks-inference | eks-cluster | literal-yaml | `ghcr.io/confighub/configs/eks-inference/eks-cluster:latest` | born-flattened | certified |
| eks-inference | karpenter-aws | literal-yaml | `ghcr.io/confighub/configs/eks-inference/karpenter-aws:latest` | born-flattened | certified |
| eks-inference | karpenter | helm-chart | `ghcr.io/confighub/configs/eks-inference/karpenter:latest` | flatten-with-routes | certified |
| eks-inference | gpu-runtime | helm-chart | `ghcr.io/confighub/configs/eks-inference/gpu-runtime:latest` | safe-to-flatten | certified |
| eks-inference | inference-workloads | literal-yaml | `ghcr.io/confighub/configs/eks-inference/inference-workloads:latest` | born-flattened | certified |
| sveltos-example | kyverno-fleet-clusterprofile | confighub-unit | `oci://127.0.0.1:32807/sveltos-kyverno-staging:pilot` | born-flattened | certified |
| aicr | aicr-eks-h100-training-kubeflow | aicr-entry | not published | flatten-with-routes | certified |
| aicr | aicr-eks-h100-inference-nim | aicr-entry | not published | flatten-with-routes | certified |
| aicr | aicr-cpu-starter | aicr-entry | not published | flatten-with-routes | certified |
| aicr | aicr-kserve-nim-inference | retained-upstream-tree | not published | born-flattened | certified |

The OCI column states where the bundle is published, and says so plainly when it is not. A bundle without a published reference is still certified: the receipt describes committed bytes, and publication adds a digest to the same receipt shape rather than changing what it claims.

A provisional verdict states what current evidence supports and names its open questions in the receipt. The flattening-safety audit certifies lanes; a lane moves when its receipt changes, never by hand.

The eight eks-inference receipts certify artifacts this repository did not build. Each witness records the pulled manifest and layer digests, and every extracted file hashed identically to the producer's committed render at the recorded commit. Their five literal components are born flattened; the three chart-sourced ones carry the lane their charts' verdicts decided, and where a component wraps several charts the strictest lane governs.

The Kubara receipt reads the byte-faithful mirror under examples/kubara. Its canonicalHome block pins the maintained copy in kubara-confighub, so removing the mirror re-points the generator instead of breaking it silently.

Regenerate with `npm run certified-bundles`. Verify with `npm run certified-bundles:verify`.
