# Config Workshop check: Needs review

**Source:** kubernetes-yaml: examples/plain-yaml/acme-web@source-r001
**Exact objects:** 4 objects · `sha256:4c7fac59248636842c560c5fcb2076bf9ffe2ed2e4576ff754b51c8dc21fed6c`
**Result:** 10 findings; 5 checks not run. Review them before this change progresses.

This report covers the exact Kubernetes objects and the completed checks listed in this report. It does not prove destination acceptance, deployment, workload health, drift, and rollback unless separate receipts are linked.

## Findings

| Severity | Finding | Object | Decision |
| --- | --- | --- | --- |
| critical | `CCVE-2025-3733`: Container nginx does not set runAsNonRoot: true | Deployment/acme-web/acme-web | unreviewed |
| critical | `CCVE-2025-3734`: Container nginx does not set allowPrivilegeEscalation: false | Deployment/acme-web/acme-web | unreviewed |
| warning | `CCVE-2025-3726`: Deployment omits pod and container securityContext settings | Deployment/acme-web/acme-web | unreviewed |
| warning | `CCVE-2025-3728`: Deployment containers omit resource limits | Deployment/acme-web/acme-web | unreviewed |
| warning | `CCVE-2025-3732`: Deployment containers omit resource requests; HPA and scheduler decisions will be unreliable | Deployment/acme-web/acme-web | unreviewed |
| warning | `CCVE-2025-3735`: Container nginx does not set readOnlyRootFilesystem: true | Deployment/acme-web/acme-web | unreviewed |
| warning | `CCVE-2025-3736`: Container nginx does not drop ALL capabilities | Deployment/acme-web/acme-web | unreviewed |
| warning | `CCVE-2025-3746`: Deployment does not set automountServiceAccountToken: false; pods get unnecessary API credentials | Deployment/acme-web/acme-web | unreviewed |
| warning | `CCVE-2025-3763`: Namespace acme-web lacks pod-security.kubernetes.io/enforce label | Namespace/default/acme-web | unreviewed |
| info | `CCVE-2025-3740`: Deployment has replicas: 1; no high availability | Deployment/acme-web/acme-web | unreviewed |

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

- CCVE-2025-3733: Set securityContext.runAsNonRoot to true at pod or container level
- CCVE-2025-3734: Set securityContext.allowPrivilegeEscalation to false on every container
- CCVE-2025-3726: Add pod-level securityContext defaults where appropriate
- CCVE-2025-3728: Add resources.limits for memory and CPU to each container
- CCVE-2025-3732: Set resources.requests.cpu and resources.requests.memory on every container
- CCVE-2025-3735: Set securityContext.readOnlyRootFilesystem to true on every container
- CCVE-2025-3736: Set securityContext.capabilities.drop to ["ALL"] on every container
- CCVE-2025-3746: Set automountServiceAccountToken to false in the pod spec
- CCVE-2025-3763: Add pod-security.kubernetes.io/enforce label with baseline or restricted value
- CCVE-2025-3740: Set replicas to at least 2 for services requiring availability
- Run destination and live checks separately before deployment.
- Review every finding before you call this result accepted. Keep the result with the change, or publish candidate.yaml as OCI using the local tools you already use.
- Retain candidate.yaml in ConfigHub with annotation workshop.confighub.com/object-set-sha256=sha256:4c7fac59248636842c560c5fcb2076bf9ffe2ed2e4576ff754b51c8dc21fed6c when the result needs shared history, validation, variants, promotion, release, or live comparison.

## Artifacts

- [candidate.yaml](./candidate.yaml) · `sha256:78e3bacb58e6ee82be42420379c6376b71870c0b294d2241553026e45ac229c5`
- [source-and-intent.yaml](./source-and-intent.yaml) · `sha256:3ebbd72d8f222795ab4e823970d4146aa1996951518b95031f83deb7ef393dcc`
- [cub-check.json](./cub-check.json) · `sha256:7ce01333e504a5189d46afefa295eaec0633cabec5ac08094f234cc943aabf3f`
- [workshop-review.json](./workshop-review.json) · `sha256:22a40445de04a6ef0b66f69bcaa8ce81d7ec1cba322665d613cdebf0c7571ca7`
- [Related guide](https://confighub.github.io/helm-expt/site/entry-path-reference.html#plain-yaml)
