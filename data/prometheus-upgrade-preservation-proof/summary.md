# Prometheus upgrade preservation proof

This live ConfigHub run kept one reviewed Kubernetes edit while the upstream Prometheus chart changed.

## Result

- Chart: `prometheus-community/prometheus`
- Preset config: `server-only-ephemeral`
- Upgrade: `29.8.0` to `29.9.0`
- Reviewed edit: `Deployment/monitoring/prometheus-server spec.replicas`, from `1` to `2`
- Base after upgrade: chart `29.9.0`, image `quay.io/prometheus/prometheus:v3.12.0`, replicas `2`
- Staging after promotion: chart `29.9.0`, image `quay.io/prometheus/prometheus:v3.12.0`, replicas `2`

The installer rendered the candidate chart with its normal one-replica value. ConfigHub had already recorded the two-replica edit as a protected local change. The upgrade plan changed the chart labels and Prometheus image but did not reset `spec.replicas`.

The staging promotion was previewed first. The preview showed the chart and image changes, did not include a replica reset, and did not change stored staging data. The real promotion then moved staging to chart `29.9.0` while keeping two replicas.

## Exact packages

| Version | OCI manifest | Package layer |
| --- | --- | --- |
| `29.8.0` | `sha256:5cf6400c75d1cafc06fee5ddaada47651926bdab3a9d674a9f966540b29edd26` | `sha256:ac86e0bf7ec6ab8d8e8c66298fb32791be696756480116fe833a4459e5bcc9e1` |
| `29.9.0` | `sha256:e68a4d9604798ee51833670ba84c20ebe4c7f8eea17d9f35cb8a7e64a4c434cc` | `sha256:05ad4d8e8867b8240e1e1f5fa8efd112469e689651c72dbcbc62466a1b96e4e9` |

## Limits

- This run used ConfigHub records only. It did not deliver Prometheus to Kubernetes.
- The run used the chart's monitoring namespace for both versions. Custom-namespace upgrade behavior is not part of this receipt.
- The selected preset has no Helm hooks or CRDs, so this receipt does not test lifecycle work.
- This proves one protected Deployment field across one Prometheus source upgrade and one staging promotion. It does not prove every field or chart.

The machine receipt is [`runs/prometheus-upgrade-preservation-proof/receipt.yaml`](../../runs/prometheus-upgrade-preservation-proof/receipt.yaml).
