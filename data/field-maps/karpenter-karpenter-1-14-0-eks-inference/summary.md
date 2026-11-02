# Which rendered field does each Helm value control: karpenter/karpenter 1.14.0, base eks-inference

An experiment on one chart, not a Catalog claim about any other chart. Only `helm template` ran. No ConfigHub, no cluster.

Script: `scripts/measure-value-field-map.mjs`.
Re-run: `node scripts/measure-value-field-map.mjs karpenter/karpenter/1.14.0 --base eks-inference --out <dir> [--jobs 4] [--pairs]`.
Outputs are sorted and byte-identical across runs except `timing*.json` (checked: two full runs gave identical `value-effects.json`, `field-inverse.json`, `value-source-map.measured.yaml`).

## Method

1. Read the recorded render contract: `helm-render-intent.yaml`, `variants/eks-inference/variant.yaml` (namespace `kube-system`, release `karpenter`), `render-receipt.yaml` (flags `--include-crds --skip-tests --no-hooks`, kube version 1.31.0), `source-lock.yaml`.
2. Pull `oci://public.ecr.aws/karpenter/karpenter` 1.14.0. Package sha256 equals the source lock.
3. Baseline: render with `spec.values` of `effective-values-eks-inference.yaml`. Compared to the retained `release-objects.yaml` by parsed object (18 identities, every object equal), by recorded digest `27259c2a...db64c` (equal) and byte for byte (identical). Rendering the full merged values (chart defaults plus effective values) as one file also reproduces the baseline, so every perturbation below is applied to the full merged values.
4. Leaves of the merged values: scalars and nulls; empty maps and empty lists; non-empty lists are descended element by element (`tolerations[0].key`). Lists were not tested as whole lists (no element added or removed from a non-empty list).
5. One perturbation per value, type preserving: string gets suffix `-fm` (empty string gets `fm-probe`), number +1, boolean flipped, null gets `1` then `fm-probe`, empty map gets `{fm-probe: fm-probe}`, empty list gets `[{name: fm-probe}]` then `["fm-probe"]`. A later attempt runs only if the earlier one failed to render or showed nothing.
6. Diff of parsed objects: object added, removed, renamed (paired by a name substitution learned from kinds with one leftover each side, else by name similarity), and per paired object a structural field diff. Field paths use the ValueSourceMap notation (`spec.template.spec.containers[controller].image`, lists of named maps keyed by name). A removed and an added list element count as a rename only when everything but the name is at least 80 percent unchanged.
7. Values that showed nothing alone get a second context, in order: (a) the chart's own gate (`enabled`/`create` false boolean whose parent path contains the value) turned on; (b) API versions the templates test with `Capabilities.APIVersions.Has` added (`monitoring.coreos.com/v1`; the recorded render passes none); (c) one other "off" value (false, null, empty) switched on at a time, 41 candidates. Each is compared against that context's own render.
8. Inversion: every leaf field of the 18 baseline objects, with the values that changed or removed it. A field inside a removed object counts as reached "by object removal" and is reported separately.
9. `--pairs`: all pairs of values that had an effect alone (81 values, 3240 pairs) perturbed together, joint change set compared with the union of the two single change sets.

## Numbers (one run, this machine)

| | |
| --- | --- |
| Baseline matched retained render | yes: objects, digest, bytes |
| Value paths (leaves) | 88 (40 string, 15 boolean, 13 empty map, 9 number, 9 empty list, 2 null). 11 are set by the effective values, 77 are chart defaults. |
| Effect | 88 |
| No effect | 0 |
| Failed to render | 0 |
| Effect at the first perturbation | 81 |
| Effect only in a second context | 7 (all conditional, see limits) |
| Values that changed existing baseline fields or removed an object | 55 |
| Values that only added fields or objects (nothing in the baseline moved) | 33 |
| Values that changed the object set | 6: 4 renamed objects (`fullnameOverride` 11, `nameOverride` 11, `podDisruptionBudget.name` 1, `serviceAccount.name` 1), `serviceAccount.create` removed the ServiceAccount, `serviceMonitor.enabled` added a ServiceMonitor (only with the monitoring API version) |
| Baseline objects | 18 (5 are CRDs). 13 reached by at least one value, the 5 CRDs by none. |
| Baseline leaf fields | 1746: 384 outside CRDs, 1362 in CRDs |
| Fields reached by at least one value | 99 of 1746 (5.7 percent); 99 of 384 outside CRDs (25.8 percent). 91 by a field-level change, 8 only because their object was removed (the ServiceAccount). |
| Fields not reached by any value | 1647 (1362 CRD fields, 285 others: RBAC rules, probes, ports, most of the Deployment, Service and PDB structure) |
| Fields reached by more than one value | 20: 16 name/label fields of `fullnameOverride` and `nameOverride`, the `FEATURE_GATES` env value (6 feature gates), the container image string (repository, tag, digest), a ServiceAccount field (`create` and `name`), a ServiceAccount label (`nameOverride` and `create`) |
| Renders | 161 for the per-value pass (94 first pass including baseline and merged-values check, 67 for second contexts); 3240 more for pairs |
| Wall clock | per-value pass 15.5 s with 4 parallel renders, including the chart pull; median render 265 ms, 42 s of render time in total. Pair pass 298 s with 6 parallel renders (3401 renders in total, 314 s). |

## Limits found

- Gates outside the values. `serviceMonitor.*` (6 values) showed nothing until the render was given `--api-versions monitoring.coreos.com/v1`. The recorded render has no API versions, so no value can create a ServiceMonitor in the retained baseline. The method found it only because the script scans templates for `APIVersions.Has`. A gate hidden in a helper or a `lookup` call would not be found.
- Values that matter only when another value is on. `controller.sidecarVolumeMounts` is rendered only inside `controller.sidecarContainer`. It showed nothing alone and was found by switching on each of 41 off values in turn (67 extra renders for 7 values). That search is values-squared in the worst case.
- Interactions. Of 3240 pairs, 41 gave a joint result different from the union of the two single results. By my reading of the output (not computed), 25 are real: 15 feature-gate pairs (one shared string), 3 image pairs, `fullnameOverride` with `nameOverride` (one masks the other), 5 pairs where `serviceAccount.create: false` removes the object the other value edits, and `extraVolumeMounts` with `sidecarContainer`. 16 are artifacts of the diff: when one list element is renamed or removed while another is added, name-keyed matching cannot tell rename from remove plus add. Higher-order interactions (three or more values) were not tested.
- Perturbations are guesses. `-fm` suffixes, `+1`, `fm-probe` are not valid cluster values (a digest `sha256:...-fm`). Rendering does not validate them, so "effect" means the template copies or branches on the value, not that the value is safe. The lists were never tested with real element shapes. Free-form maps (`additionalLabels`, `podAnnotations`) were tested with one key, so which keys matter is not known.
- Value-dependent shape. One perturbation of a number or string never tests a threshold or a branch such as `if eq .Values.x "foo"`. 88 of 88 values rendered, so no value was left unexplained by a render failure, but a branch on a specific string would show as no effect.
- Undeclared values. The templates reference `affinity.podAffinity`, which is not in the merged defaults. It was listed, not tested. Nothing outside the defaults is enumerated.
- Reached means "changed when perturbed". The 285 non-CRD fields no value reached are fixed by the chart for the tested perturbations. The method cannot say a field is unreachable.
- Pairing of renamed objects is a heuristic (substitution learned from `Deployment` and `Service`, then name similarity). The 4 rename results looked right on inspection (all 11 renamed objects were the expected ones) but the pairing is not proven.
- Wet paths of the form `Kind/seg/seg` (cub-gen) collide: the 91 measured baseline fields collapse to 77 distinct paths, because fields of different objects of one kind share a path (`ClusterRole/metadata/name` for three ClusterRoles).

## Against cub-gen

`cub-gen gitops import --space platform --json` on the same chart directory returned one `field_origin_map` entry: `dry_path values.image.tag`, `wet_path Deployment/spec/template/spec/containers[0]/image`, `source_path <helm-default>:values.image.tag`, `transform helm-default`, `confidence 0.4`. In `helm_provenance.go`, `helmImageTagDefaultOrigin()` returns that entry as a fixed literal. The chart has no top-level `image` in `values.yaml`; the image is `controller.image.repository`, `.tag` and `.digest`, and cub-gen's own `edit_hint` says the field "is not set in the observed Helm values files". The measured result for the same field is `controller.image.{repository,tag,digest}` reaching `spec.template.spec.containers[controller].image` (all three, as one string).

The measured data fits the shape (`model.FieldOrigin`: `dry_path`, `wet_path`, `source_path`, optional `source_layer`, `transform`, `confidence`, optional `hops`). `field-origin-map.cubgen-shape.json` has 114 entries for 54 value paths covering 91 distinct baseline fields (the 8 object-removal fields are not included). Gaps:

- `transform` vocabulary: cub-gen has `helm-default`, `helm-builtin`, `helm-nondeterministic`. I added `helm-measured:identity` (79), `:embedded` (32), `:removed` (3) and a `:conditional` suffix. They need to be agreed.
- `confidence` has no defined meaning for a measurement. I used 1.0 for an effect seen alone and 0.7 for one seen only in a second context. Those two numbers are placeholders.
- `wet_path` carries no apiVersion, namespace or name, and uses `/` as the separator, which label keys such as `app.kubernetes.io/name` also contain. cub-gen cannot distinguish the three ClusterRoles. The object identity is kept in an extra `object` field in my file.
- Added fields and objects (33 values only add) have no baseline `wet_path`. The shape fits them (the wet path exists in the perturbed render) but I did not emit them.
- No place for "needs another value or a capability to take effect" or for the perturbed value that was tried.

## Files

`summary.json` holds the numbers above. `value-source-map.measured.yaml` holds the per-value result in ValueSourceMap shape. `field-origin-map.cubgen-shape.json` holds the same data in cub-gen's `field_origin_map` shape. `pair-interactions.json` holds the pairs of values that interact. A re-run writes the fuller per-field files.
