# Redis Variant Diff Spec

This slice makes the easy variant path visible.

Input:

```text
default/r001 rendered object set
reuse-existing-secret/r001 rendered object set
reuse-existing-secret target fact requirement
```

Output:

```text
recipes/bitnami/redis/25.5.3/diffs/default-to-reuse-existing-secret.yaml
```

The diff must show:

```text
removed Helm object: v1|Secret|redis|redis
added Helm objects: none
changed Helm objects:
- apps/v1|StatefulSet|redis|redis-master
- apps/v1|StatefulSet|redis|redis-replicas
added target fact: Secret redis/redis-existing-secret key redis-password
```

The verifier must recompute the object-level diff from the two rendered object
sets and reject the artifact if the summary lies.
