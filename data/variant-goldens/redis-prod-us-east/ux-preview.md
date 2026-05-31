# Redis Creator UX Preview

```text
Create variant
From: redis/default
Blueprint: Environment clone
Target: prod-us-east
Fill: environment=prod, region=us-east, namespace=redis-prod, target=prod-us-east
Preview: 15 Units, 3 changed paths, 1 link change
Checks: pass with carried Redis scan warning
Create
```

The Redis Secret mode is not a free-form fill value in this preview. The source
base determines the Secret model. Use `redis/reuse-existing-secret` when the
variant must bind `redis-existing-secret`.
