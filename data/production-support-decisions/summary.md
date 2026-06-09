# Production Support Decisions

This generated report records target-scoped production support decisions. It is
separate from production disposition closure.

Disposition closure means the pre-review evidence exists. A production support
decision names the supported base, target scope, delivery path, accepted risks,
live evidence rule, and operator-owned boundaries.

## Summary

```text
decision artifacts: 1
supported decisions: 0
draft decisions: 1
```

## Decisions

| Chart | Base | Decision | Target scope | Live evidence decision | Next action |
| --- | --- | --- | --- | --- | --- |
| `bitnami/nginx@24.0.2` | http-clusterip | draft | vanilla-kubernetes; namespace=nginx; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | Refresh target-scoped ConfigHub OCI/GitOps evidence, then change this decision from draft to supported if the receipt passes for the declared scope. |

## Rule

A `draft` decision is useful because it names the proposed support boundary.
It is not a production support claim. A row can move to `supported` only when
fresh target-scoped evidence for the declared delivery path is recorded and the
decision no longer has `requiredBeforeFinal` entries.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
