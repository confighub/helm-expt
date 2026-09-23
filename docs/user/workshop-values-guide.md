# Find why a Helm value did not change the output

Helm accepts keys that a chart never reads, and it says nothing. Start with
your own chart. Check every key in one run, keep the checked result, and make
the next change from it. The teaching exercise after that shows how the check
works on a small chart you can read in full.

[Check your own chart](#check-your-own-chart), or
[jump to the teaching exercise](#learn-how-the-check-works).

## Check your own chart

This section needs Workshop plugin 0.6.38 or later, which adds `--out` and
`--render-out`. It was checked with plugin 0.6.38, cub 0.5.3 and Helm `v4.1.4`
on the public oauth2-proxy chart. Install [the cub CLI](https://confighub.github.io/helm-expt/site/try.html#install-cub),
then the plugin at the exact source revision below (version 0.6.41). The plugin
publishes no release yet, so the Guide pins a revision.

```sh
cub plugin install confighub/cub-workshop@22f272cb771e55a0161c557429fe3817ac2d8012 --source-repo
```

Use a new directory, and name the chart the way you install it. For a chart
in a registry, pass its `oci://` address and leave out `--repo`. Add the
`--namespace` and `--release` you use today, because some charts render
differently with them.

```sh
mkdir oauth2-proxy-review && cd oauth2-proxy-review
cp /absolute/path/to/my-values.yaml my-values.yaml
cub config values oauth2-proxy --repo https://oauth2-proxy.github.io/manifests --version 10.7.0 \
  --values my-values.yaml --out values-report.json --render-out candidate.yaml --exit-code
```

The plugin renders the chart with your values, then once more for each value
with that value taken out. A key the chart has no place for comes back
`IGNORED`. A key the chart reads but another setting switches off comes back
`NO EFFECT`. A key that matches the chart's own default comes back `DEFAULT`.
A key that changed the objects comes back `APPLIED`, with the objects it
changed. With `--exit-code`, exit 1 means at least one value did nothing, and
exit 2 means the check could not finish; resolve that error before you draw
any conclusion. No value is printed.

`APPLIED` means the rendered objects changed, not that Kubernetes accepts the
change. Some charts copy a block such as `resources` into the object as
written, so a misspelled field inside that block still reports `APPLIED`.
Read the changed field in the candidate before you accept it.

On oauth2-proxy 10.7.0, a values file that sets `replicas: 2` reports that key
as `IGNORED`, because this chart reads `replicaCount`. The plugin does not
suggest the replacement key for that case, so read the chart's defaults to
find the key it does read:

```sh
helm show values oauth2-proxy --repo https://oauth2-proxy.github.io/manifests --version 10.7.0
```

After the fix, every key reports `APPLIED` and the command exits 0.

### Ask an assistant to do it

Paste this into Claude Code or Codex, opened in the review directory, after
filling in the brackets:

```text
My Helm values for <chart> <version> from <repository or oci:// address> do
not do what I asked: <what you asked for, and what happened instead>. The
values are in my-values.yaml. Use cub config values to check every key
against that exact chart and version, saving the report and the rendered
candidate. Fix only what the check and the chart's own values show, and check
again until it exits 0. Show me which keys changed which objects, and the
diff between the first and final candidates. Do not print secret values,
contact a cluster, or sign in to anything.
```

### Keep the result

Keep `my-values.yaml`, `values-report.json` and `candidate.yaml` together.
The report records the chart, its version, a hash of your values file and a
hash of the render, and it holds no values. The candidate is the exact set of
objects the chart produced, Secrets included, so keep it private and out of
Git. Commit the values file as you do today.

### Make the next change

In a later session, edit the values, check them again into a new candidate,
and compare the two:

```sh
cub config values oauth2-proxy --repo https://oauth2-proxy.github.io/manifests --version 10.7.0 \
  --values my-values.yaml --out values-report-next.json --render-out candidate-next.yaml --exit-code
cub config diff candidate.yaml candidate-next.yaml
```

The diff lists every changed field and every object the chart added or
removed. A value can switch on a whole object: on oauth2-proxy, raising
`replicaCount` above 1 adds a PodDisruptionBudget. Read the added objects as
well as the changed fields. Keep the new files beside the old ones rather
than overwriting them.

To check a saved candidate without rendering again, run
`cub config check candidate.yaml`. An edit made directly to a saved candidate
does not change your values file, so the next render drops it.

### What this proves, and what comes next

These are local, static checks. They show which keys changed the rendered
objects for these exact inputs. They do not show that the objects will
install, start or behave well on a cluster, and a value that changes nothing
here may still matter under other settings, capabilities or Kubernetes versions.

Files are enough while one person changes one chart. ConfigHub helps once the
configuration is shared, or changed by more than one person or tool. It keeps
deliberate edits as recorded changes and carries them through the next chart
version or AI rewrite, with a history, an approval before release, and
delivery to Argo CD or Flux by digest. The
[My fixes survive demo](https://github.com/monadic/workshop-demo/tree/main/2-my-fixes-survive)
shows that on a ConfigHub server, which needs an account or a server you run
yourself.

## Learn how the check works

Render a small teaching chart three ways: with its defaults, with a misspelled
key, and with the correct key. Keep the renders and compare the actual objects.
This is a controlled local experiment, not a claim about every chart or a
production installation. No cluster or registry is contacted.

The teaching exercise is checked with Workshop plugin version `0.6.21`, source
revision `56e261a87dc3b060a86474bc796d379dd9bb7f3d`. Use that pin in the
linked setup.

[Jump to the assistant task](#ask-an-assistant-to-investigate).
Complete the setup below first if this is your first Guide.

### Set up

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

### Compare the misspelled key with the baseline

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

### Use the correct key as a positive control

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

### Ask an assistant to investigate

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

### Finish with a useful result

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
