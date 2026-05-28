# Generated Fact Receipts

Generated facts are values that must be chosen once and then reused:
passwords, tokens, certificate/key material, timestamps, UUIDs, or opaque
secret handles.

The receipt schema is:

```text
schemas/generated-fact-receipt.schema.json
```

The first concrete receipt is:

```text
recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/generated-fact-receipt.yaml
```

That receipt binds `auth.password` by digest before render. The same digest is
referenced from the Redis default `VariantRevision` and `RenderReceipt`, so a
silent password regeneration breaks `npm run p0:contracts`.

Supported fact kinds:

- `password`
- `token`
- `cert-key`
- `timestamp`
- `uuid`
- `opaque-secret-handle`

Supported material policies:

- `persisted`
- `secret-ref`
- `opaque-handle`
- `not-stored`
