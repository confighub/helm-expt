# Deploy the GPU Operator from the Catalog

Install NVIDIA's GPU Operator on a Kubernetes cluster in two commands. Then
keep it up to date across your environments, and test it on a GPU node.

## Three terms

| Term | Meaning |
| --- | --- |
| Recipe | A chart, its version, and one set of values. |
| Bundle | The Kubernetes objects that a recipe produces, with a plan for the steps that objects cannot do. It is one OCI artifact. |
| Variant | Your copy of a bundle for one environment, such as dev or QA. |

## What you need

- Steps 1 and 2: `kubectl` and a cluster.
- Steps 3 and 4: a ConfigHub account and the `cub` CLI.
- Step 5: a node with an NVIDIA GPU.

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
BUNDLE=oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-2-default:r001@sha256:0f6f399365cb045906854c9b568afa8dcb960d7898db5e5b47a317a3eed10484
cub variant upload --component gpu-operator --variant base --namespace gpu-operator "$BUNDLE"
```

```text
Space gpu-operator-base (Create)
  Create    gpu-operator
  Create    cluster-policy-clusterpolicy
  ... (25 more Units)
```

Make a variant for dev, and one for QA that follows dev.

```bash
cub variant create dev gpu-operator-base --environment Dev
cub variant create qa gpu-operator-dev --environment QA
```

```text
Created variant space gpu-operator-dev
Bulk create operation completed:
  Success: 27 unit(s)
```

## Step 4. Take a new version and promote it

Upload v26.3.3 over the base. ConfigHub lists what changes.

```bash
BUNDLE=oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-default:r001@sha256:408cfa607e699388f62c1859f3f0daeecc99b8110f8cee076f06855be2d8ea1e
cub variant upload --yes --component gpu-operator --variant base --namespace gpu-operator "$BUNDLE"
```

```text
Space gpu-operator-base (Update)
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
cub variant promote gpu-operator-dev --dry-run
cub variant promote gpu-operator-dev
cub variant promote gpu-operator-qa
```

```text
Would upgrade 10 unit(s) behind their upstream
Upgraded 10 unit(s) behind their upstream
```

Each environment now holds v26.3.3, and each change is recorded.

## Step 5. Test it on a GPU node

This step needs a node with an NVIDIA GPU. It is NVIDIA's own check, from the
[GPU Operator documentation](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/getting-started.html).

Check that the operator's pods are up. All of them should be `Running` or
`Completed`.

```bash
kubectl get pods -n gpu-operator
kubectl get clusterpolicy
```

Run NVIDIA's sample workload, which asks for one GPU.

```bash
cat > cuda-vectoradd.yaml <<'YAML'
apiVersion: v1
kind: Pod
metadata:
  name: cuda-vectoradd
spec:
  restartPolicy: OnFailure
  containers:
    - name: cuda-vectoradd
      image: "nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0-ubuntu22.04"
      resources:
        limits:
          nvidia.com/gpu: 1
YAML
kubectl apply -f cuda-vectoradd.yaml
kubectl logs pod/cuda-vectoradd
```

The log ends with `Test PASSED` when the pod has used the GPU.

## Where to go next

- [The GPU Operator entry](../../site/charts/nvidia-gpu-operator-v26-3-3.html) has the plan, the other presets, and the bundle's address.
- [See what a gpu-operator upgrade changes](./workshop-gpu-operator-upgrade-guide.md) compares versions field by field.
- [The model](./model-and-vocabulary.md) defines recipe, bundle, and variant in full.

## Technical notes and disclaimers

- UNOFFICIAL/EXPERIMENTAL.
- Steps 1 to 4 were run, and each output block is what the command printed, shortened. A line that starts with `...` marks a cut.
- Steps 1 and 2 ran on a local kind cluster with no GPUs, on 11 October 2026. The [log](./live-walk-test-plain-objects-2026-10-11.md) has every line.
- Steps 3 and 4 ran in a ConfigHub organization on 9 October 2026, under the name `cwwalk-1009-gpu-operator` and with a description on each change. The [log](./live-walk-gpu-operator-dev-qa-2026-10-09.md) has every line.
- Step 5 has not been run by the Catalog, which has no GPU. The commands and the sample pod are NVIDIA's.
- The plan has two more steps, one before an upgrade and one after a delete. The script in step 1 does not run them. The entry page lists them.
