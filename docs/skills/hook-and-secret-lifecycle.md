# Hook And Secret Lifecycle Skill

UNOFFICIAL/EXPERIMENTAL

Use this skill when rendered YAML is not enough because the chart relies on
Helm hooks, webhook certificate material, service-account token Secrets, or
controller-generated state.

## Hook Rule

Hooks are not proven by render parity. A hook must be routed as one of:

- rendered desired config;
- target prerequisite;
- pre-sync or post-sync lifecycle operation;
- observation check;
- explicit refusal for the selected base or target.

Read:

```sh
open data/hook-coverage/summary.md
open data/hook-lifecycle/summary.md
open data/lifecycle-boundary/summary.md
```

## Secret Rule

Do not treat all Kubernetes Secrets the same.

User credential material includes passwords, tokens, TLS keys, object-store
credentials, and existing Secret references. It must be delivered, separated,
staged, or target-fact-bound.

Kubernetes lifecycle state includes webhook serving certificates and
service-account token Secrets. It must be staged, observed, or refused before
stronger live or production claims.

Read:

```sh
open data/secret-lifecycle/summary.md
open docs/reference/secret-lifecycle.md
```

## Current Hard Rows

The current Secret lifecycle survey names rows that still need lane support.
Treat those as real work, not as generic documentation debt.
