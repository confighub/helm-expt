# Config Workshop check: Needs review

**Source:** helm: bitnami/redis@25.5.3
**Exact objects:** 13 objects · `sha256:815817e7aa3e110a81158d38ca2f38864c39d2b57927e5f625e630ad74b59cae`
**Result:** 4 findings; 5 checks not run. Review them before this change progresses.

This report covers the exact Kubernetes objects and the completed checks listed in this report. It does not prove destination acceptance, deployment, workload health, drift, and rollback unless separate receipts are linked.

## Findings

| Severity | Finding | Object | Decision |
| --- | --- | --- | --- |
| critical | `CCVE-2025-5019`: Container redis sets ALLOW_EMPTY_PASSWORD directly; use valueFrom.secretKeyRef | StatefulSet/redis/redis-master | unreviewed |
| critical | `CCVE-2025-5019`: Container redis sets ALLOW_EMPTY_PASSWORD directly; use valueFrom.secretKeyRef | StatefulSet/redis/redis-replicas | unreviewed |
| warning | `CCVE-2025-5013`: Helm-managed StatefulSet with volumeClaimTemplates is missing Delete/Delete PVC retention policy and can orphan storage on release lifecycle operations | StatefulSet/redis/redis-master | unreviewed |
| warning | `CCVE-2025-5013`: Helm-managed StatefulSet with volumeClaimTemplates is missing Delete/Delete PVC retention policy and can orphan storage on release lifecycle operations | StatefulSet/redis/redis-replicas | unreviewed |

## Before deployment

- redis/redis-existing-secret: Redis authentication password

## Checks

Completed:
- Kubernetes object inventory
- shared local configuration checks from a matching cub check result
- Catalog source and lifecycle record retained with the result

Not checked:
- source rendering and values provenance beyond the supplied source record
- Kubernetes schema and admission behavior
- hook execution and CRD establishment
- live workload health and drift
- database migrations and external services
- destination acceptance, delivery, and runtime status

## Next actions

- CCVE-2025-5019: Remove the literal value from the workload object
- CCVE-2025-5013: Set persistentVolumeClaimRetentionPolicy to Delete/Delete for ephemeral lifecycle expectations
- redis/redis-existing-secret: Redis authentication password
- Run destination and live checks separately before deployment.
- Review every finding before you call this result accepted. Keep the result with the change, or publish candidate.yaml as OCI using the local tools you already use.
- Retain candidate.yaml in ConfigHub with annotation workshop.confighub.com/object-set-sha256=sha256:815817e7aa3e110a81158d38ca2f38864c39d2b57927e5f625e630ad74b59cae when the result needs shared history, validation, variants, promotion, release, or live comparison.

## Artifacts

- [candidate.yaml](./candidate.yaml) · `sha256:123e671feac230dc6ca46a2bd75a1102beb5c3d832795c4884d81d346f5280e1`
- [source-and-intent.yaml](./source-and-intent.yaml) · `sha256:6e1dedfa42612e8a1fe00365e3bd34deb91f209f790eb6b20e47c73fc06b8ec1`
- [cub-check.json](./cub-check.json) · `sha256:9bf4cdd9258adeeaf105da266c790e1cc22038054b1befae40dc9f20e62d7d38`
- [workshop-review.json](./workshop-review.json) · `sha256:1d182e853a60ff95fefc17bfe2e79c6b8a0da85bd7e42f86d3436000efd12250`
- [Catalog record](https://confighub.github.io/helm-expt/site/charts/bitnami-redis-25-5-3.html)
