# Compare two GPU nodes with AICR

Use this path when you already have GPU nodes and want to know what differs
between them. AICR records the current node state. ConfigHub Workshop keeps the
diff beside the intended role for each node, so a difference is judged in the
right context.

This matters because different is not the same as wrong. A node used for
Mellanox RDMA may need `iommu=pt` and `nvidia_peermem`. A node with standard
networking may correctly omit both.

## 1. Record the nodes

`aicr snapshot` creates a temporary collector Job, ServiceAccount, and RBAC on
the selected cluster. It writes the measured state to a local YAML file. It
does not need an AICR recipe and does not deploy a platform bundle.

```bash
aicr snapshot --output baseline.yaml
# Select the other node, or repeat after a change.
aicr snapshot --output current.yaml
```

Read the files before continuing. They can contain detailed information about
the operating system and hardware.

## 2. Find what differs

```bash
aicr diff --baseline baseline.yaml --target current.yaml
```

The diff answers **what changed?** It does not answer **which node is right?**
That second answer needs the intended configuration for each node.

## 3. Select the intended role

The maintained example uses two demonstration profiles:

| Profile | Intended node | RDMA settings |
| --- | --- | --- |
| `l40-mellanox-rdma` | L40 with a Mellanox RDMA role | Required |
| `l40-standard-networking` | L40 with standard networking | Not required |

These profiles show how a platform provider records target-specific intent.
They are not NVIDIA AICR leaves or production hardware advice. NVIDIA curates
the built-in AICR variants; a platform team or another catalog provider can
maintain additional target profiles for its own hardware and workloads.

Run the maintained comparison:

```bash
npm run aicr-snapshot-review:verify
```

The two snapshot files differ in two places. Both nodes pass their selected
profile. If the target node is assigned the RDMA profile instead, the same two
fields become findings.

| Node and profile | Result |
| --- | --- |
| Baseline with Mellanox RDMA | Pass |
| Target with standard networking | Pass; the two RDMA settings do not apply |
| Target with Mellanox RDMA | Two findings |

Open the [generated summary](../../../data/aicr-snapshot-review/summary.md) or
the complete [machine-readable review](../../../data/aicr-snapshot-review/review.yaml).
The review keeps both snapshot hashes, the profile-catalog hash, the upstream
AICR source-record hash, every observed difference, and every field decision.

## 4. Review your own snapshots

From a local `helm-expt` checkout:

```bash
npm run aicr-snapshot-review -- \
  --baseline ./baseline.yaml \
  --target ./current.yaml \
  --baseline-profile l40-mellanox-rdma \
  --target-profile l40-standard-networking \
  --output ./review.yaml
```

Omit the two profile flags if you only want an observed diff. The output then
says that intended state is still missing; it does not invent a verdict.

Your organization can replace the demonstration profile catalog with its own:

```bash
npm run aicr-snapshot-review -- \
  --baseline ./baseline.yaml \
  --target ./current.yaml \
  --profiles ./my-node-profiles.yaml \
  --baseline-profile my-rdma-profile \
  --target-profile my-standard-profile \
  --output ./review.yaml
```

## 5. Keep the review as files or OCI

Add `--output-oci` to put the two snapshots, profile catalog, and review in one
local OCI artifact:

```bash
npm run aicr-snapshot-review -- \
  --baseline ./baseline.yaml \
  --target ./current.yaml \
  --baseline-profile l40-mellanox-rdma \
  --target-profile l40-standard-networking \
  --output ./review.yaml \
  --output-oci ./aicr-node-review.oci:reviewed
```

This needs ORAS but no ConfigHub account. The artifact is a review record. It
is not deployable Kubernetes configuration.

## 6. Keep it in ConfigHub when the comparison must continue

Store the two observations and their interpretation as non-deployable Units:

```bash
cub space create aicr-node-review \
  --component aicr-node-state --variant reviewed --stage Review
cub unit create --space aicr-node-review --provider None \
  baseline-snapshot ./baseline.yaml
cub unit create --space aicr-node-review --provider None \
  target-snapshot ./current.yaml
cub unit create --space aicr-node-review --provider None \
  snapshot-review ./review.yaml
```

Use ConfigHub when the team needs to compare the next snapshot with the same
accepted intent, review a proposed correction, or relate observed state to a
retained platform configuration. Uploading the review does not deploy it.

## A later check needs a deployment

AICR's `expected-resources` check answers whether resources declared by a
selected AICR configuration exist and are healthy. It can run only after those
components have been deployed. If they are absent and the check times out,
record it as blocked and not run. That result is not failed GPU conformance.

No GPU workload, RDMA transfer, model request, or performance test ran in this
sanitized example.

