# Check and promote configuration with your own AI assistant

Use **Check my config** when you have a new chart, values file, AICR recipe, OCI
package, or Kubernetes YAML. Use **Promote my config** when you have an accepted
configuration and a proposed next version or environment.

Both pages run in the browser. They do not send your YAML to ConfigHub, an AI service,
or Kubernetes. You may download the exact objects and review record, then give them to
Claude, Codex, or another assistant you already use.

Check my config also downloads one `workshop-result.json`. It contains the exact
candidate, optional comparison, optional Catalog source and intent record, review,
file hashes, and canonical object-set identity. See the
[anonymous browser guide](./anonymous-browser-workshop.md).

## Check a new configuration

1. Open [Check my config](https://confighub.github.io/helm-expt/site/ask.html).
2. Choose the practical question you need answered.
3. Add the rendered Kubernetes YAML. Add the current or trusted YAML when you want a
   comparison.
4. If the configuration came from the Catalog, add its `BaseVariantRecord`. This adds
   the known source, prerequisites, hooks, CRDs, policy, and evidence status.
5. Run `cub check --format json --output cub-check.json <rendered-path>` when you
   want the shared local checks. Add that result to the page. It is accepted only
   when it names the same canonical object set.
6. Run the browser check and download `candidate.yaml` with
   `workshop-review.json`.

The browser parses the YAML as data. It inventories the objects, hides formatting-only
changes, checks a small set of manifest risks, and lists what it did not test. It does
not run the source tool, contact a cluster, execute hooks, or prove application health.

The generated AI prompt asks your assistant to confirm the file hashes, keep private
inputs local, separate computed findings from Catalog evidence, retain stable scanner
finding IDs, and write any proposed fix to a new file. The assistant does not get to
turn an unrun check into a pass or a local advisory result into ConfigHub validation.

## Review a promotion

Open [Promote my config](https://confighub.github.io/helm-expt/site/promote.html)
after Check my config, or load the current and proposed YAML directly.

For a source-aware result, provide four files:

| File | What it tells the review |
| --- | --- |
| Old source render | What the old chart or source produced before later edits |
| Old accepted configuration | What you actually accepted and kept |
| New source render | What the new chart, values, or source produces |
| Proposed accepted configuration | What you intend to move |

The result separates source changes from later object edits. It marks a field for
review when the source and a later edit both affect it. It also carries Catalog
prerequisites and lifecycle work into the test plan when a `BaseVariantRecord` is
supplied.

Add one result per staging or fleet target in this form:

```text
staging-eu | pass | rollout and smoke test passed | sha256:...
prod-us | not-run | waiting for approval |
```

The digest must match the proposed configuration. A passing target does not make an
untested target pass, so a mixed fleet remains partial.

## Keep the accepted result in ConfigHub

The free result remains useful as local files or OCI. Use ConfigHub when the accepted
objects, source record, variants, approvals, release digest, and target results need to
remain connected for a team.

The promotion page generates current `cub` commands. It starts with
`cub variant upload --dry-run` to preview a source refresh and
`cub variant promote --dry-run -o mutations` to preview each downstream Space. Review
those outputs before any write. After approval, record the source refresh, promote the
same candidate, publish the release OCI, and add each target result to the review.

The generated upload annotation carries the same canonical object-set hash as
the browser or CLI result. This does not replace the OCI digest or ConfigHub
revision identity. It connects the accepted Kubernetes objects across the
handoff. See the [generated Helm and plain-YAML command contract](../../data/config-workshop-command-contract/summary.md).

ConfigHub records desired configuration. A successful upload or promotion does not by
itself prove Kubernetes admission, hook execution, application health, data migration,
or rollback of external effects.

For a complete measured example, see
[Test candidates before promotion](./test-candidates-before-promotion.md). It runs
three exact NGINX configurations on one target, rejects the candidate that does not
meet the destination requirement, selects the smallest passing candidate, and checks
that ConfigHub and Argo CD use that same object set.

## Public records

- [ConfigurationReview schema](https://confighub.github.io/helm-expt/site/review.schema.json)
- [WorkshopResult schema](https://confighub.github.io/helm-expt/site/workshop-result.schema.json)
- [PromotionReview schema](https://confighub.github.io/helm-expt/site/promotion-review.schema.json)
- [Catalog BaseVariantRecord index](https://confighub.github.io/helm-expt/site/base-variant-records.json)
- [Promotion diff classes](../reference/promotion-diff-classes.md)
- [Measured promotion proof](../../data/measured-promotion-proof/summary.md)
