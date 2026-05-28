# Upgrade And Rollback Simulation Receipts

Upgrade and rollback receipts make day-2 risk explicit before an operator
promotes or rolls back a rendered variant revision.

The receipt schema is:

```text
schemas/upgrade-rollback-receipt.schema.json
```

The first concrete Redis receipts are:

```text
recipes/bitnami/redis/25.5.3/operations/default-to-reuse-existing-secret/upgrade-simulation-receipt.yaml
recipes/bitnami/redis/25.5.3/operations/reuse-existing-secret-to-default/rollback-simulation-receipt.yaml
```

These receipts model the first Redis day-2 transition:

```text
default rendered Secret
-> reuse existing target Secret
-> rollback to the default generated fact
```

Each receipt records:

- before and after variant revision
- before and after rendered object digest
- diff digest
- preserved changes
- dropped changes
- required operator decisions
- hook, CRD, PVC, and generated-fact risks
- conflicts
- result

The next expansion is true old-chart-version simulation, but the receipt shape
and verifier contract are now concrete.
