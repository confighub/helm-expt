# Deploy the GPU Operator from the Catalog

Install NVIDIA's GPU Operator on a Kubernetes cluster in two commands. Then
keep it up to date across your environments with two more steps.

Every command on this page was run, and the output shown is what it printed.

## Three terms

| Term | Meaning |
| --- | --- |
| Recipe | A chart, its version, and one set of values. |
| Bundle | The Kubernetes objects that a recipe produces, with a plan for the steps that objects cannot do. It is one OCI artifact. |
| Variant | Your copy of a bundle for one environment, such as dev or QA. |

## What you need

- Steps 1 and 2: `kubectl` and a cluster.
- Steps 3 and 4: a ConfigHub account and the `cub` CLI.

## Step 1. Install it

The Catalog gives each bundle a script. It downloads the objects, checks their
SHA-256, applies the CRDs, and then applies the rest.

```bash
curl -fsSL -o try-objects.sh https://confighub.github.io/helm-expt/site/sh/nvidia-gpu-operator-v26-3-3/default/try-objects.sh
bash try-objects.sh
```

```text
>> Check the file against the SHA-256 in the listing
The file matches: sha256 73ebb5f6de3d1f010330d266db11b99b508be84dfc92b9d5deb01a39b66fee7c
>> A CRD is missing, so apply the file's CRDs first
>> Apply the other 19 objects
>> Done. The 5 CRDs were applied first. kubectl applied the other 19 objects of this entry's retained file.
```

## Step 2. Check that it is running

```bash
kubectl -n gpu-operator rollout status deployment/gpu-operator --timeout=300s
```

```text
deployment "gpu-operator" successfully rolled out
```

The operator's ClusterPolicy reported `ready` about a minute later.

## Step 3. Store it in ConfigHub and make a variant for each environment

Upload the bundle. ConfigHub makes one Unit for each object and keeps the plan
beside them. This example starts one version back, at v26.3.2, so that step 4
has a new version to take.

```bash
cub variant upload --component cwwalk-1009-gpu-operator --variant base --namespace gpu-operator --change-desc 'Seed the base at v26.3.2 default' oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-2-default:r001@sha256:0f6f399365cb045906854c9b568afa8dcb960d7898db5e5b47a317a3eed10484
```

```text
Space cwwalk-1009-gpu-operator-base (Create)
  Create    gpu-operator
  Create    cluster-policy-clusterpolicy
  ... (25 more Units)
```

Make a variant for dev, and one for QA that follows dev.

```bash
cub variant create dev cwwalk-1009-gpu-operator-base --environment Dev --change-desc 'Clone the base as dev'
cub variant create qa cwwalk-1009-gpu-operator-dev --environment QA --change-desc 'Clone dev as qa'
```

```text
Created variant space cwwalk-1009-gpu-operator-dev
Bulk create operation completed:
  Success: 27 unit(s)
```

## Step 4. Take a new version and promote it

Upload v26.3.3 over the base. ConfigHub lists what changes.

```bash
cub variant upload --yes --component cwwalk-1009-gpu-operator --variant base --namespace gpu-operator --change-desc 'Move the base to v26.3.3 default' oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-default:r001@sha256:408cfa607e699388f62c1859f3f0daeecc99b8110f8cee076f06855be2d8ea1e
```

```text
Space cwwalk-1009-gpu-operator-base (Update)
  Update    gpu-operator-serviceaccount
  Update    gpu-operator-clusterrole
  Update    gpu-operator-clusterrolebinding
  Update    gpu-operator-role
  Update    gpu-operator-rolebinding
  Update    gpu-operator
  Update    cluster-policy-clusterpolicy
  ... (6 lines for the plan documents)
  Unchanged 17 Unit(s)
```

Seven objects changed and 17 did not. Dev and QA still hold the old version.
Preview the promotion, then promote dev, then QA.

```bash
cub variant promote cwwalk-1009-gpu-operator-dev --dry-run
cub variant promote cwwalk-1009-gpu-operator-dev --change-desc 'Take v26.3.3 from the base'
cub variant promote cwwalk-1009-gpu-operator-qa --change-desc 'Take v26.3.3 from dev'
```

```text
Would upgrade 10 unit(s) behind their upstream
Upgraded 10 unit(s) behind their upstream
```

Each environment now holds v26.3.3, and each change is recorded.

## Where to go next

- [The GPU Operator entry](../../site/charts/nvidia-gpu-operator-v26-3-3.html) has the plan, the other presets, and the bundle's address.
- [See what a gpu-operator upgrade changes](./workshop-gpu-operator-upgrade-guide.md) compares versions field by field.
- [The model](./model-and-vocabulary.md) defines recipe, bundle, and variant in full.

## Technical notes and disclaimers

- UNOFFICIAL/EXPERIMENTAL.
- Steps 1 and 2 ran on a local kind cluster with no GPUs, on 11 October 2026. The [log](./live-walk-test-plain-objects-2026-10-11.md) has every line. The script was fetched from the site on 12 October and matched the copy that ran.
- Steps 3 and 4 ran in a ConfigHub organization on 9 October 2026. The [log](./live-walk-gpu-operator-dev-qa-2026-10-09.md) has every line. The name `cwwalk-1009-gpu-operator` is from that run. Use your own.
- The output blocks are shortened. A line that starts with `...` marks a cut.
- The plan has two more steps, one before an upgrade and one after a delete. The script in step 1 does not run them. The entry page lists them.
