# Make a stack from Catalog entries

Pick three Catalog entries for GPU nodes, compose them into one local stack, and
check them together. The entries are NVIDIA's gpu-operator, nvsentinel and
cluster-readiness-engine. Each is published in the Catalog as its own flattened
bundle. This Guide changes one part and checks again, then says what the check
leaves out.

Every step runs on your machine with `cub`, with no account and no cluster.
Compose reads the live Catalog index and pulls the three public bundles
anonymously with `oras`. It writes files into a new directory and applies
nothing. The check reads those files only.

You can run the steps yourself or
[give an assistant the task](#a-task-for-an-assistant).

## Set up the tools

Install [the cub CLI](https://confighub.github.io/helm-expt/site/try.html#install-cub)
and [ORAS](https://oras.land/docs/installation). Then install the Workshop
plugin release this Guide was checked with (version 0.6.57).

```sh
cub plugin install confighub/cub-workshop@v0.6.57
```

Every command below was run with plugin v0.6.57. The previous release, v0.6.56,
refuses these entries. It stops with `receiptUrl is not a supported GitHub
receipt URL`.

## 1. Find the three entries

List the entries that the Catalog files under the `gpu` role.

```sh
cub config list --role gpu | grep -E '^  nvidia-(cluster-readiness-engine-v0-6-0|nvsentinel-v1-25-0|gpu-operator-v26-3-3)-default '
```

```text
  nvidia-cluster-readiness-engine-v0-6-0-default (v0.6.0) — operator: https://confighub.github.io/helm-expt/site/listings/nvidia-cluster-readiness-engine-v0-6-0-default.json
  nvidia-gpu-operator-v26-3-3-default (v26.3.3) — operator: https://confighub.github.io/helm-expt/site/listings/nvidia-gpu-operator-v26-3-3-default.json
  nvidia-nvsentinel-v1-25-0-default (v1.25.0) — agent: https://confighub.github.io/helm-expt/site/listings/nvidia-nvsentinel-v1-25-0-default.json
```

The `grep` keeps three lines. The full list held 44 entries on the day of the
run, and it grows with the Catalog.

An entry id is the name of one base of one version. It reads
`<chart>-<version>-<base>`, with the dots of the version written as dashes. The
id `nvidia-gpu-operator-v26-3-3-default` names the `default` base of version
v26.3.3 of the gpu-operator chart.

Read the ids on the Catalog's chart pages. Open the chart page for
[gpu-operator](https://confighub.github.io/helm-expt/site/charts/nvidia-gpu-operator.html),
[nvsentinel](https://confighub.github.io/helm-expt/site/charts/nvidia-nvsentinel.html)
or
[cluster-readiness-engine](https://confighub.github.io/helm-expt/site/charts/nvidia-cluster-readiness-engine.html)
to see its versions. Open a version page to see its bases under Available
Configurations. The page for each entry also holds the five steps under "Use
this entry in ConfigHub", and its id appears there.

A role listing returns candidates for you to inspect. It does not choose one
and says nothing about whether the three work together. Step 3 checks that.

## 2. Compose them into a workspace

Name each entry with `--entry`, name the stack, and give a new directory.

```sh
cub stack compose --entry nvidia-gpu-operator-v26-3-3-default --entry nvidia-nvsentinel-v1-25-0-default --entry nvidia-cluster-readiness-engine-v0-6-0-default --name gpu-node --out ./gpu-node
```

```text
gpu-node: 3 retained catalog component(s) saved as an editable workspace. Files: <your directory>/gpu-node
```

The command exits `0`. The path at the end is the absolute path of your own
directory. List what it wrote.

```sh
find gpu-node -type f | sort
```

```text
gpu-node/components/01-nvidia-cluster-readiness-engine-v0-6-0-default.yaml
gpu-node/components/02-nvidia-gpu-operator-v26-3-3-default.yaml
gpu-node/components/03-nvidia-nvsentinel-v1-25-0-default.yaml
gpu-node/evidence/01-nvidia-cluster-readiness-engine-v0-6-0-default/companions/01-crd-ordering.yaml
gpu-node/evidence/01-nvidia-cluster-readiness-engine-v0-6-0-default/metadata.json
gpu-node/evidence/01-nvidia-cluster-readiness-engine-v0-6-0-default/receipt.yaml
gpu-node/evidence/02-nvidia-gpu-operator-v26-3-3-default/companions/01-crd-ordering.yaml
gpu-node/evidence/02-nvidia-gpu-operator-v26-3-3-default/companions/02-lifecycle-actions.yaml
gpu-node/evidence/02-nvidia-gpu-operator-v26-3-3-default/metadata.json
gpu-node/evidence/02-nvidia-gpu-operator-v26-3-3-default/receipt.yaml
gpu-node/evidence/original-stack.yaml
gpu-node/provenance.json
gpu-node/rendered.yaml
gpu-node/result.json
gpu-node/stack.yaml
```

| File | What it holds |
| --- | --- |
| `stack.yaml` | The stack manifest. It lists the three components, each with the path of its file. Edit this file to change the stack. |
| `components/` | One file of Kubernetes objects for each entry. Those are the objects the Catalog retains for that entry: 43, 24 and 22, which add up to 89. |
| `rendered.yaml` | All 89 objects in one file, which is the input you would compare or hand to a tool. |
| `result.json` | The check result that compose recorded, with the hash of each file in the workspace. |
| `provenance.json` | The Catalog listing of each entry, as it was when you composed. |
| `evidence/` | For each entry that carries routes, the publication receipt with its bundle digest and the routes. nvsentinel carries none, so it has no folder. |
| `evidence/original-stack.yaml` | A copy of the manifest as compose wrote it. |

The routes are the Catalog's notes on work a chart needs beyond its objects.
For gpu-operator they name the CRD ordering and the `pre-upgrade` and
`post-delete` hook Jobs. The workspace keeps them as files and runs none of
them. Each carries the state `declared-unexecuted`.

## 3. Check them together

Check the stack manifest.

```sh
cub stack check ./gpu-node/stack.yaml
```

```text
Stack: gpu-node  —  Explicit catalog retained-object composition
Resolving 3 components: nvidia-cluster-readiness-engine-v0-6-0-default, nvidia-gpu-operator-v26-3-3-default, nvidia-nvsentinel-v1-25-0-default

Check
  [PASS] no resource conflicts across components (89 objects)
  [PASS] CRD ordering: 12 CRDs are delivered before the 5 custom resources that need them
  [PASS] served API versions: 5 custom resource(s) match their bundled CRD; target availability is not checked
  [WARN] 2 custom resource(s) rely on CRDs this stack does not deliver, which must already exist: monitoring.coreos.com (2)
  [PASS] no admission webhooks need a certificate
  [WARN] namespaces: 0 created, 2 must already exist (gpu-operator, nvcre)
  [WARN] schema validation not run: the flux schema plugin is not installed; next: `flux plugin install schema` (Flux 2.9 or later)
  => CHECKED
```

The command exits `0`. `CHECKED` means the check ran. It does not mean the
stack is ready to apply. Read each line.

| Line | What it checked | What you do |
| --- | --- | --- |
| PASS, no resource conflicts | No object is claimed by two components, and none appears twice in one component with different content. | Nothing. |
| PASS, CRD ordering | The stack carries 12 CRDs, and no custom resource sits in a component ahead of the one that ships its CRD. The five custom resources are the ClusterPolicy and four LogProfile objects. | Nothing. The check compares components, so it does not read the order of objects inside one file. |
| PASS, served API versions | Each of the 5 custom resources uses an API version and kind that its bundled CRD serves. | Nothing. The line says target availability is not checked. |
| WARN, `monitoring.coreos.com` | A ServiceMonitor from cluster-readiness-engine and a PodMonitor from nvsentinel need CRDs that no entry in the stack ships. | Install the Prometheus Operator CRDs on the target first. Otherwise the apply fails for those two objects. |
| PASS, no admission webhooks | No admission webhook object in the stack lacks a CA bundle. | Nothing. |
| WARN, namespaces | The objects write the namespaces `gpu-operator` and `nvcre`, and nothing in the stack creates them. | Create both namespaces before you apply. The nvsentinel objects write no namespace, so none appears for that entry. |
| WARN, schema validation | The check can validate the objects against their schemas, and the Flux schema plugin is not installed here. | Run the command the line prints, then check again. This Guide did not run it. |

A WARN is not a failure and not a pass. It names a fact about the target that
the stack cannot supply and the check cannot see.

## 4. Change a part and check again

Swap one `--entry` and compose into a new directory. Your first stack stays as
it was. The first swap moves nvsentinel to its `no-pod-monitor` base.

```sh
cub stack compose --entry nvidia-gpu-operator-v26-3-3-default --entry nvidia-nvsentinel-v1-25-0-no-pod-monitor --entry nvidia-cluster-readiness-engine-v0-6-0-default --name gpu-node --out ./gpu-node-no-pod-monitor
cub stack check ./gpu-node-no-pod-monitor/stack.yaml
```

```text
Stack: gpu-node  —  Explicit catalog retained-object composition
Resolving 3 components: nvidia-cluster-readiness-engine-v0-6-0-default, nvidia-gpu-operator-v26-3-3-default, nvidia-nvsentinel-v1-25-0-no-pod-monitor

Check
  [PASS] no resource conflicts across components (88 objects)
  [PASS] CRD ordering: 12 CRDs are delivered before the 5 custom resources that need them
  [PASS] served API versions: 5 custom resource(s) match their bundled CRD; target availability is not checked
  [WARN] 1 custom resource(s) rely on CRDs this stack does not deliver, which must already exist: monitoring.coreos.com (1)
  [PASS] no admission webhooks need a certificate
  [WARN] namespaces: 0 created, 2 must already exist (gpu-operator, nvcre)
  [WARN] schema validation not run: the flux schema plugin is not installed; next: `flux plugin install schema` (Flux 2.9 or later)
  => CHECKED
```

Two numbers moved. The stack holds 88 objects, and one custom resource relies
on the monitoring CRDs. The remaining ServiceMonitor comes from
cluster-readiness-engine, so that WARN stays. Compare the two stacks to see
the whole change.

```sh
cub config diff gpu-node/rendered.yaml gpu-node-no-pod-monitor/rendered.yaml | head -2
```

```text
Configuration diff: 0 added, 1 removed, 0 changed, 88 unchanged
  removed: monitoring.coreos.com/v1 PodMonitor (namespace unspecified)/nvsentinel
```

The only difference is the PodMonitor. The second swap moves gpu-operator back
to v25.10.1, with the other two entries as they were.

```sh
cub stack compose --entry nvidia-gpu-operator-v25-10-1-default --entry nvidia-nvsentinel-v1-25-0-default --entry nvidia-cluster-readiness-engine-v0-6-0-default --name gpu-node --out ./gpu-node-v25
cub stack check ./gpu-node-v25/stack.yaml
cub config diff gpu-node/rendered.yaml gpu-node-v25/rendered.yaml | grep -E 'Configuration diff|driver/version|toolkit/version'
```

The check printed the same seven lines as step 3, with 89 objects. The diff
printed three lines.

```text
Configuration diff: 0 added, 0 removed, 21 changed, 68 unchanged
    /spec/driver/version replace: "580.126.20" -> "580.105.08"
    /spec/toolkit/version replace: "v1.19.1" -> "v1.18.1"
```

The check gave no sign that 21 objects changed. It reads one stack at a time
and does not compare versions. Use `cub config diff` for that, as in the
[gpu-operator upgrade Guide](./workshop-gpu-operator-upgrade-guide.md). The
check also does not say that one version suits your nodes better than the
other.

## 5. Know what the check does not prove

### Nothing was applied

Compose wrote files and the check read them. No object reached a cluster,
and no cluster was contacted. The check line says target availability is not
checked, and `result.json` records application health as `not-checked`.

### A passing composition is not runtime compatibility

The check looks at names, kinds, ordering and references inside the files. It
does not show that the three run next to each other. It does not show that the
driver matches your hardware. Each entry carries its own publication proof, and the Catalog does not inherit
runtime proof from it.

### Routes are recorded and not executed

The workspace holds the CRD ordering routes and the gpu-operator hook routes as
files. It runs no hook. Whoever delivers the stack must decide who applies the
`pre-upgrade` Job, as the [hooks and CRDs Guide](./workshop-lifecycle-guide.md)
explains.

### The stack is not in ConfigHub

The workspace is a local directory. Nothing was uploaded to ConfigHub, no Space
or Unit exists for it, and nobody has approved it.

### One entry was delivered, and the stack was not

On 2026-10-08 the default base of gpu-operator v26.3.3 alone was deployed
through ConfigHub and Argo CD v3.5.4 to a kind cluster that had no GPUs. The
[walk log](./live-walk-entry-steps-2026-10-08.md) holds every command and its
output. Argo CD accepted all 25 objects in one sync, and the Application ended
Synced and Healthy. The ClusterPolicy reported `ready` with the reason
`NoGPUNodes`.

That run covers one entry. It did not include nvsentinel or
cluster-readiness-engine, and it did not run on a node with a GPU. The stack of
three has not been deployed.

## A task for an assistant

Start a fresh session in an empty directory with normal approvals.

```text
Install the Workshop plugin with cub plugin install confighub/cub-workshop@v0.6.57.
Run cub config list --role gpu and find the ids of the default bases of
NVIDIA gpu-operator v26.3.3, nvsentinel v1.25.0 and cluster-readiness-engine
v0.6.0. Compose them with cub stack compose, one --entry for each, --name
gpu-node and --out ./gpu-node. List the files it wrote. Run cub stack check
./gpu-node/stack.yaml and explain every PASS and WARN line in one sentence,
including what I must do about each warning. Then compose a second stack in a
new directory that swaps nvsentinel to its no-pod-monitor base, check it, and
compare the two rendered.yaml files with cub config diff. Report the exit codes
and counts you saw. Do not say the stack is compatible, ready or safe from a
passing check. Do not log in, upload, publish or apply anything, and do not
contact a cluster or ConfigHub.
```

## Where the next step belongs

You now hold a local stack, a check result and a comparison of two variants.
Nothing has left your machine.

To run a stack that ships with the plugin, follow
[Compose and check a stack](https://confighub.github.io/helm-expt/site/compose-a-stack.html).
To open a shipped stack as an editable workspace and review a change to it,
follow the [local stack Guide](./workshop-compose-guide.md).

To bring a single entry into ConfigHub, open its page and follow the five steps
under "Use this entry in ConfigHub", for example
[gpu-operator v26.3.3](https://confighub.github.io/helm-expt/site/charts/nvidia-gpu-operator-v26-3-3.html).
Those steps take one entry from its exact objects to a promoted change. This
Guide does not take a stack of three that far.
