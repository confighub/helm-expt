# Find why a Helm value did not change the output

Render a small teaching chart three ways: with its defaults, with a misspelled
key, and with the correct key. Keep the renders and compare the actual objects.
This is a controlled local experiment, not a claim about every chart or a
production installation. No cluster or registry is contacted.

The Workshop plugin used here is version `0.6.21`, source revision
`56e261a87dc3b060a86474bc796d379dd9bb7f3d`. Use that pin in the linked setup.

[Jump to the assistant task](#ask-an-assistant-to-investigate).
Complete the setup below first if this is your first Guide.

## Set up

You need Git, Node.js, `cub`, and Helm. This exercise is checked with Helm
`v4.1.4`; record `helm version --short` if using another version. Install the
pinned Workshop plugin as described in the [Adapt setup](./workshop-adapt-guide.md#prerequisites-and-setup),
then return to that `cub-workshop` checkout root. Skip the Adapt exercise itself.

Use a new directory. If it exists, choose another trial name and use it
consistently; never overwrite an earlier result.

```sh
mkdir -p values-review/chart/templates
cat > values-review/chart/Chart.yaml <<'YAML'
apiVersion: v2
name: values-review
version: 0.1.0
YAML
cat > values-review/chart/values.yaml <<'YAML'
message: hello
YAML
cat > values-review/chart/templates/config.yaml <<'YAML'
apiVersion: v1
kind: ConfigMap
metadata:
  name: values-review
  namespace: {{ .Release.Namespace }}
data:
  message: {{ .Values.message | upper | quote }}
YAML
```

These complete chart inputs are the source of this exercise. The template reads
`message` and converts it to uppercase. It has no dependencies, cluster lookup
or random input. Keep all three chart files with your results.

## Compare the misspelled key with the baseline

Run each command separately and retain its exit code:

```sh
helm template review values-review/chart --namespace workshop > values-review/baseline.yaml
helm template review values-review/chart --namespace workshop --set-string mesage=reviewed > values-review/typo.yaml
cub config diff values-review/baseline.yaml values-review/typo.yaml --json --out values-review/typo-diff.json
```

All three should exit `0`. Both renders contain one ConfigMap with
`data.message: HELLO`. The comparison has `equal: true`, one unchanged object
and no changes. The supplied key was `mesage`; this template reads `message`.
Inspecting that source and comparing controlled renders establishes why this
particular misspelling has no effect in this fixture. Helm accepting the input
is not evidence that the intended field changed.

## Use the correct key as a positive control

```sh
helm template review values-review/chart --namespace workshop --set-string message=reviewed > values-review/corrected.yaml
cub config diff values-review/baseline.yaml values-review/corrected.yaml --json --out values-review/corrected-diff.json
```

Both should exit `0`. Expect exactly one changed object, ConfigMap
`workshop/values-review`, with one replacement at `/data/message` from `HELLO`
to `REVIEWED`. Keep the typo result alongside the corrected result.

The supplied literal `reviewed` does not appear unchanged in the output:
the template transforms it. This is why searching for a literal cannot by
itself establish whether a chart used a key. Conversely, a matching literal
could have come from a different input.

Check repeatability with the same inputs:

```sh
helm template review values-review/chart --namespace workshop > values-review/baseline-repeat.yaml
cmp values-review/baseline.yaml values-review/baseline-repeat.yaml
```

Both should exit `0`. If either fails, preserve the output and investigate;
do not attribute differences to your value until other changing inputs are
controlled. For a real chart, pin its archive/dependencies, values, Helm
version, release name, namespace and capabilities, and account for generated
credentials, timestamps and lookup-dependent output.

## Ask an assistant to investigate

Prepare a fresh directory containing the three chart files above. Start Claude
Code or Codex there with ordinary tool approvals:

```text
Use the supplied chart without editing its templates or defaults. Render it
with Helm using release review and namespace workshop: once with defaults,
once with mesage=reviewed, and once with message=reviewed. Save separate YAML
outputs and compare each candidate against the baseline using cub config diff,
retaining JSON results. Report exit codes, object identity, changed fields and
hashes. Read the template to explain the misspelling and uppercase transform.
Rerender the baseline and check byte equality. Keep every input and output.
Do not deploy, contact a cluster or registry, read credentials, or generalize
this fixture result into a claim that a setting is unused in every chart.
```

## Finish with a useful result

Your complete result is the chart, all four renders and both JSON comparisons.
Source ownership stays with the chart and its values; no ConfigHub Component or
Unit is created, and delivery and runtime checks are not run. The next edit is
to the correct source key. For a field the real chart does not expose, inspect
its source and use a maintained values/overlay strategy; the
[field-edit Guide](./workshop-field-restore-guide.md) shows how to preserve and
review an explicit local edit.

If a render fails, stop before comparison and retain its error. If a comparison
contains extra changes, keep it on review hold. A successful diff reports a
comparison; it does not approve a deployment.
