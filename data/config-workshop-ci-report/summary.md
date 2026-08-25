# Pull-request reports from Config Workshop results

This command turns one source-neutral `WorkshopResult` into a short pull-request
comment. It reports the exact object-set hash, what changed, local findings,
lifecycle requirements, checks that ran, and checks that did not run.

Start with the [CI guide](../../docs/user/ci-render-check.md) for the local command
and optional GitHub Actions example.

It does not label a static check as deployment or runtime proof. The strongest
clear result says **No blocker found in the completed checks**. Destination,
delivery, health, drift, and rollback remain separate until their receipts exist.

## Run it

```bash
npm run workshop:ci-report -- \
  --input workshop-result.json \
  --output comment.md \
  --fail-on blocked
```

Use `--fail-on needs-review` when unresolved findings or omitted checks must stop
CI. Use `--format json` when another tool or AI assistant should consume the
same report.

The JSON form follows the [Config Workshop CI report schema](https://confighub.github.io/helm-expt/site/workshop-ci-report.schema.json).

## Worked reports

| Example | What it shows | Result | Files |
| --- | --- | --- | --- |
| nginx-reviewed | AI-written Helm values corrected, reviewed, and retained with one scoped exception. | Needs review | [Markdown](nginx-reviewed/report.md) · [JSON](nginx-reviewed/report.json) · [complete result](nginx-reviewed/workshop-result.json) |
| kubernetes-yaml | Literal Kubernetes YAML checked with the same report contract; rendering is a no-op. | Needs review | [Markdown](kubernetes-yaml/report.md) · [JSON](kubernetes-yaml/report.json) · [complete result](kubernetes-yaml/workshop-result.json) |
| redis-reuse-existing-secret | A Redis Catalog configuration checked for storage and credential handling before use. | Needs review | [Markdown](redis-reuse-existing-secret/report.md) · [JSON](redis-reuse-existing-secret/report.json) · [complete result](redis-reuse-existing-secret/workshop-result.json) |

The Redis report satisfies the original chart-analysis use case without making
the format Helm-specific. Helm, AICR, Timoni, OCI, and literal YAML can all use
this report after they have produced exact Kubernetes objects and a
`WorkshopResult`.
