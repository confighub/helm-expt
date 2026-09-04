# Add a configuration check to CI

Use this when a pull request changes Helm values, generated Kubernetes YAML, an
OCI configuration, or another source that produces Kubernetes objects.

First produce a `workshop-result.json`. It binds the source, exact objects,
object-set hash, local findings, decisions, and checks that did not run. The
[website and command-line guide](../../data/config-workshop-command-contract/summary.md)
shows the same process for Helm and literal Kubernetes YAML.

Then create a short review comment:

```bash
npm run workshop:ci-report -- \
  --input workshop-result.json \
  --output comment.md
```

The command works locally and needs no ConfigHub account or server. It reports:

- the source and exact object-set hash;
- the objects changed by an optional comparison;
- the most important findings and their review decisions;
- required Secrets, CRDs, hooks, or other lifecycle work recorded with the source;
- checks that ran and checks that did not run;
- the next local step and the command handoff to ConfigHub.

By default, the command returns a non-zero exit status only when a recorded
decision or managed control blocks the object set. Use this stricter form when
unreviewed findings or omitted checks must also stop CI:

```bash
npm run workshop:ci-report -- \
  --input workshop-result.json \
  --output comment.md \
  --fail-on needs-review
```

Use `--format json` when another tool or AI assistant should consume the same
bounded result. Use `--extract-dir ./ci-artifacts` to extract the files embedded
in `workshop-result.json` for retention as CI artifacts.

## GitHub pull-request comment

The report is plain Markdown. A small GitHub Actions step can post it after your
existing render and check job has created `workshop-result.json`:

```yaml
- name: Build the review comment
  run: |
    npm run workshop:ci-report -- \
      --input workshop-result.json \
      --output comment.md \
      --extract-dir ci-artifacts \
      --fail-on blocked

- name: Post the review comment
  if: always()
  run: gh pr comment "${{ github.event.pull_request.number }}" --body-file comment.md
  env:
    GH_TOKEN: ${{ github.token }}

- name: Keep the complete result
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: config-workshop-result
    path: ci-artifacts/
```

The same `comment.md` can be used in GitLab, Jenkins, Buildkite, or a local review
script. GitHub Actions is an example, not a requirement.

## What the result means

The strongest clear result is **No blocker found in the completed checks**. It
does not say that the configuration is safe to deploy. Kubernetes admission,
destination prerequisites, delivery, workload health, drift, and rollback need
their own checks and receipts.

See the [worked NGINX, Redis, and literal-YAML reports](../../data/config-workshop-ci-report/summary.md).
The JSON form follows the [ConfigHub Workshop CI report schema](https://confighub.github.io/helm-expt/site/workshop-ci-report.schema.json).
