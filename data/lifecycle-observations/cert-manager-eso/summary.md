# Cert-Manager And External Secrets Lifecycle Observations

This lane checks the lifecycle mechanisms that a config-only Helm import cannot
prove from rendered YAML alone: CRD ownership, post-apply API readiness,
webhook CA bundle injection, and controller-populated webhook Secret data.

```text
pass: 4
blocked: 0
not-run: 0
```

| Chart | Base | Result | CRD policy | Hook/lifecycle policy | Receipt |
| --- | --- | --- | --- | --- | --- |
| `jetstack/cert-manager@v1.20.2` | default | pass | external-crds-required | startupapicheck-becomes-post-apply-api-dry-run | runs/lifecycle-observations/cert-manager-eso/jetstack-cert-manager-default/receipt.yaml |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | pass | crds-rendered-by-base-variant | startupapicheck-becomes-post-apply-api-dry-run | runs/lifecycle-observations/cert-manager-eso/jetstack-cert-manager-crds-enabled/receipt.yaml |
| `external-secrets/external-secrets@2.5.0` | default | pass | crds-rendered-by-base-variant | no-helm-hook | runs/lifecycle-observations/cert-manager-eso/external-secrets-external-secrets-default/receipt.yaml |
| `external-secrets/external-secrets@2.5.0` | no-crds | pass | external-crds-required | no-helm-hook | runs/lifecycle-observations/cert-manager-eso/external-secrets-external-secrets-no-crds/receipt.yaml |
