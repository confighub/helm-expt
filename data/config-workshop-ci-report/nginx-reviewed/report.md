# Config Workshop check: Needs review

**Source:** helm: bitnami/nginx@24.0.2
**Exact objects:** 5 objects · `sha256:502d8c85470455fa4152f8d0abb9d1582552e830148e90335e9649cbfd42f397`
**Result:** 1 finding; 5 checks not run. Review them before this change progresses.

This report covers the exact Kubernetes objects and the completed checks listed in this report. It does not prove destination acceptance, deployment, workload health, drift, and rollback unless separate receipts are linked.

## What changed

- Added: 0
- Removed: 0
- Changed: 2 (Deployment/nginx/nginx, Service/nginx/nginx)

## Findings

| Severity | Finding | Object | Decision |
| --- | --- | --- | --- |
| info | `CCVE-2025-3745`: Volume empty-dir uses emptyDir without sizeLimit; may exhaust node disk | Deployment/nginx/nginx | approved-exception |

## Before deployment

- nginx/ai-provider-credentials: The destination must supply the AI provider Secret before delivery.

## Checks

Completed:
- Kubernetes object inventory
- shared local configuration checks from a matching cub check result
- semantic comparison with the supplied object set
- Catalog source and lifecycle record retained with the result
- finding decisions bound to the accepted object set

Not checked:
- source rendering and values provenance beyond the supplied source record
- Kubernetes schema and admission behavior
- hook execution and CRD establishment
- live workload health and drift
- database migrations and external services
- destination acceptance, delivery, and runtime status

## Next actions

- CCVE-2025-3745: recheck the approved exception when its object set, scope, or review date changes.
- nginx/ai-provider-credentials: The destination must supply the AI provider Secret before delivery.
- Run destination and live checks separately before deployment.
- Keep this result with the change, or publish candidate.yaml as OCI using the local tools you already use. Reopen the decision when the object set, destination, or review date changes.
- Retain candidate.yaml in ConfigHub with annotation workshop.confighub.com/object-set-sha256=sha256:502d8c85470455fa4152f8d0abb9d1582552e830148e90335e9649cbfd42f397 when the result needs shared history, validation, variants, promotion, release, or live comparison.

## Artifacts

- [candidate.yaml](./candidate.yaml) · `sha256:ec4195803615b2e0d31e82488a16e0ab190ade8ddb0d3b892ceee6c3a724c8b6`
- [comparison.yaml](./comparison.yaml) · `sha256:ae6bc63d5005bfef5fb62400619290bafe56d5bd9e2e58922f21757882ee1593`
- [source-and-intent.yaml](./source-and-intent.yaml) · `sha256:1841c109d0d1c6e932bc46d02b082cb964f129015366d6b16c803466ff0fd163`
- [cub-check.json](./cub-check.json) · `sha256:3c0ed08754dd08296949cb0308f8c16952769d6dd266afe0e9e17dec3ec58b96`
- [configuration-decision.yaml](./configuration-decision.yaml) · `sha256:4689f859fd85e52beb7c9ca34dadf88e7621ac11ac5f98757603f1cd7e640b2a`
- [workshop-review.json](./workshop-review.json) · `sha256:092f1276a8f318b51410975b88c9541a8631c7d8e21e1173c504bef505560ed9`
- [Catalog record](https://confighub.github.io/helm-expt/site/charts/bitnami-nginx-24-0-2.html)
