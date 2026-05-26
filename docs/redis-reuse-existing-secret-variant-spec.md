# Redis Reuse Existing Secret Variant Spec

This slice proves the first easy variant path after `default`.

The variant is named `reuse-existing-secret`.

Purpose:

```text
Move Redis credential ownership out of Helm-generated Secret output and into
an explicit target secret requirement.
```

## Helm Values

The variant must set:

```yaml
auth:
  existingSecret: redis-existing-secret
  existingSecretPasswordKey: redis-password
```

It must not set or store `auth.password`.

## Required Files

```text
recipes/bitnami/redis/25.5.3/
  effective-values-reuse-existing-secret.yaml
  variants/reuse-existing-secret/variant.yaml
  revisions/reuse-existing-secret/r001/
    variant-revision.yaml
    rendered/release-objects.yaml
    rendered/object-inventory.yaml
    receipts/helm-equivalence-receipt.yaml
    receipts/render-receipt.yaml
    receipts/scan-receipt.yaml
    receipts/install-gate.yaml
```

## Invariants

The verifier must prove:

```text
variant metadata.name == reuse-existing-secret
rendered Helm object count == 13
rendered Secret count == 0
target secret requirement is recorded
regular Helm output and cub install setup output are semantically equivalent
cub install adds only the Namespace support object
```

The proof must make the happy path visible:

```text
default variant: Helm renders Redis Secret
reuse-existing-secret variant: Helm does not render Redis Secret
safe operation: target must provide redis-existing-secret/redis-password
```
