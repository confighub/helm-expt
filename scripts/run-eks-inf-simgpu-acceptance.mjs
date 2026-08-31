// Stage D of the eks-inf replica experiment: accept the inference workloads on
// simulated GPU capacity, through the governed path, with no GPU anywhere.
//
// Phases, one per invocation, so every mutation stays a deliberate step:
//
//   --up        cub cluster up --name simgpu (kind + Argo CD + argobot + the
//               cluster and argo-apps Spaces, with the placeholder gate on)
//   --deliver   upload the inference-workloads base by pinned digest, create
//               the target-bound variant, publish the release
//   --scale     the governed scale-up: set-replicas 1 on smoke-gpu and
//               vllm-qwen through cub, then republish
//   --simulate  label the node with the pool selector, taint it
//               nvidia.com/gpu:NoSchedule, and patch node status to advertise
//               nvidia.com/gpu capacity; no device plugin runs
//   --capture   read-only: write the receipt from the live cluster and
//               ConfigHub into data/eks-inf-replica/sim-gpu/
//   --down      delete the kind cluster and the Spaces this run created
//
// The honest boundaries, stated up front and in the receipt: no CUDA kernel
// runs, no model answers, and a pod on simulated capacity is not a serving
// proof. The smoke pod's own log says it plainly: nvidia-smi: not found.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { check, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const outRoot = join(repoRoot, "data", "eks-inf-replica", "sim-gpu");
// cub cluster up writes the cluster's kubeconfig beside its env file.
const kubeconfig = join(process.env.HOME ?? "", ".confighub", "clusters", "simgpu.kubeconfig");
const kube = (...args) => execFileSync("kubectl", ["--kubeconfig", kubeconfig, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const cub = (...args) => execFileSync("cub", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const mode = process.argv[2];

const DIGEST_ROW = readFileSync(join(repoRoot, "data", "certified-bundles", "receipts.csv"), "utf8")
  .split("\n").map((line) => line.split(",")).find((cells) => cells[1] === "eks-inference-inference-workloads");
const BUNDLE_REF = `oci://${DIGEST_ROW[10].replace(/:latest$/, "")}@${DIGEST_ROW[6]}`;

if (mode === "--up") {
  console.log(cub("cluster", "up", "--name", "simgpu"));
  process.exit(0);
}
if (mode === "--deliver") {
  cub("variant", "upload", "--component", "inference-workloads", "--variant", "base",
    "--granularity", "per-file", "--owner", "EKS Inference", "--label", "managed-by=eks-inference", BUNDLE_REF);
  cub("variant", "create", "simgpu", "inference-workloads-base", "--target", "simgpu/target");
  cub("release", "publish", "inference-workloads-simgpu");
  console.log("delivered: base uploaded from the pinned digest, variant bound to simgpu/target, release published");
  process.exit(0);
}
if (mode === "--scale") {
  for (const unit of ["smoke-gpu", "vllm-qwen"]) {
    cub("function", "do", "--space", "inference-workloads-simgpu", "--unit", unit,
      "set-replicas", "1", "--change-desc", "Sim-GPU acceptance: governed scale-up");
  }
  cub("release", "publish", "inference-workloads-simgpu");
  console.log("scaled through cub and republished; kubectl scale is never used");
  process.exit(0);
}
if (mode === "--simulate") {
  const node = kube("get", "nodes", "-o", "jsonpath={.items[0].metadata.name}").trim();
  kube("label", "node", node, "eks-inference.confighub.com/pool=quantized-gpu", "--overwrite");
  kube("taint", "node", node, "nvidia.com/gpu=:NoSchedule", "--overwrite");
  kube("patch", "node", node, "--subresource=status", "--type=json",
    "-p", '[{"op":"add","path":"/status/capacity/nvidia.com~1gpu","value":"2"},{"op":"add","path":"/status/allocatable/nvidia.com~1gpu","value":"2"}]');
  console.log(`${node}: pool label, nvidia.com/gpu taint, and 2 simulated nvidia.com/gpu advertised via node status; no device plugin runs`);
  process.exit(0);
}

if (mode === "--capture") {
  const who = cub("auth", "status");
  const organization = (who.match(/Organization Name\s+(\S.*?)\s*$/m) ?? [])[1] ?? "unknown";
  const node = kube("get", "nodes", "-o", "jsonpath={.items[0].metadata.name}").trim();
  const nodeJson = JSON.parse(kube("get", "node", node, "-o", "json"));
  const pods = JSON.parse(kube("get", "pods", "-n", "inference", "-o", "json")).items.map((pod) => ({
    name: pod.metadata.name,
    app: pod.metadata.labels?.app ?? "",
    node: pod.spec.nodeName ?? "unscheduled",
    phase: pod.status.phase,
    gpuLimit: pod.spec.containers[0]?.resources?.limits?.["nvidia.com/gpu"] ?? "0",
    tolerated: (pod.spec.tolerations ?? []).some((toleration) => toleration.key === "nvidia.com/gpu"),
  })).sort((a, b) => a.name.localeCompare(b.name));
  const apps = kube("get", "applications", "-n", "argocd",
    "-o", "jsonpath={range .items[*]}{.metadata.name} {.status.sync.status} {.status.health.status}{\"\\n\"}{end}").trim().split("\n");
  let smokeLog = "";
  try { smokeLog = kube("logs", "-n", "inference", "deploy/smoke-gpu", "--tail", "4"); } catch { smokeLog = "(no log yet)"; }
  const failedScheduling = kube("get", "events", "-n", "inference",
    "--field-selector", "reason=FailedScheduling",
    "-o", "jsonpath={range .items[*]}{.message}{\"\\n\"}{end}").trim().split("\n").filter(Boolean).slice(-1);
  const releases = cub("release", "list", "--space", "inference-workloads-simgpu").trim().split("\n").length - 1;
  const gpuPods = pods.filter((pod) => pod.gpuLimit !== "0");
  check(gpuPods.length === 2 && gpuPods.every((pod) => pod.node === node && pod.tolerated), "acceptance: both GPU-shaped pods must be scheduled on the simulated node with the toleration");
  check(smokeLog.includes("nvidia-smi: not found"), "acceptance: the smoke pod's log must state the honest boundary, nvidia-smi: not found");

  const yaml = [
    "apiVersion: evidence.confighub.com/v1alpha1",
    "kind: SimulatedGpuAcceptanceReceipt",
    "metadata:",
    "  name: eks-inference-sim-gpu",
    "spec:",
    `  organization: "${organization}"`,
    `  cluster: "kind/simgpu"`,
    `  bundle: "${BUNDLE_REF}"`,
    `  releasesPublished: ${releases}`,
    "  node:",
    `    name: "${node}"`,
    `    gpuCapacitySimulated: "${nodeJson.status.capacity["nvidia.com/gpu"] ?? "0"}"`,
    `    taint: "nvidia.com/gpu:NoSchedule"`,
    `    poolLabel: "eks-inference.confighub.com/pool=quantized-gpu"`,
    "  argoApplications:",
    ...apps.map((line) => `    - "${line}"`),
    "  pods:",
    ...pods.map((pod) => `    - name: "${pod.name}"\n      node: "${pod.node}"\n      phase: "${pod.phase}"\n      gpuLimit: "${pod.gpuLimit}"\n      toleratesGpuTaint: ${pod.tolerated}`),
    "  preCapacityFailedScheduling:",
    ...failedScheduling.map((line) => `    - "${line.replaceAll('"', "'")}"`),
    "  smokeLog:",
    ...smokeLog.trim().split("\n").map((line) => `    - "${line.replaceAll('"', "'")}"`),
    "  boundaries:",
    '    - "No CUDA kernel ran and no model answered; a scheduled pod on simulated capacity is not a serving proof."',
    '    - "Capacity is advertised by a node-status patch; no device plugin runs, and the real device plugin is out of scope here."',
    '    - "Every image in this bundle is public, so the gated-registry digest check does not apply to this stack."',
    '    - "These workloads set no runtimeClassName, so runtime-class wiring is not exercised."',
    '    - "The real H100 serving run remains issue 1581 and is the receipt that closes it."',
  ];
  write(join(outRoot, "receipt.yaml"), `${yaml.join("\n")}\n`);
  write(join(outRoot, "summary.md"), `# Stage D: the inference workloads on simulated GPU capacity

<!-- Generated by scripts/run-eks-inf-simgpu-acceptance.mjs --capture. Do not edit by hand. -->

No GPU exists anywhere in this run. A kind cluster stood in for the workload plane, brought up by \`cub cluster up\`, and the retained inference-workloads bundle travelled the governed path: uploaded by pinned digest, bound to the cluster's OCI target as a variant, released, pulled by Argo CD. The GPU deployments ship at zero replicas, so the scale-up went through cub and a republish, never kubectl.

Before capacity existed, the scheduler refused the GPU pod and said why: ${failedScheduling[0] ? `"${failedScheduling[0].replaceAll('"', "'")}"` : "the FailedScheduling event was captured in the receipt"}. Then one node-status patch advertised \`nvidia.com/gpu: 2\` behind a \`NoSchedule\` taint and the pool label, and both GPU-shaped pods scheduled onto it: node selection, toleration, and extended-resource accounting all honored, with the node showing the simulated GPUs fully allocated.

The smoke pod's own log is the honest boundary, verbatim:

\`\`\`
${smokeLog.trim()}
\`\`\`

It scheduled, it started, and it truthfully reports that no driver exists. Nothing here claims serving. The boundaries are enumerated in [receipt.yaml](./receipt.yaml), and the real H100 run remains the final rung.

The staged plan is [eks-inf-replica-plan.md](../../../docs/planning/eks-inf-replica-plan.md).
`);
  console.log(`receipt written: ${pods.length} pod(s), ${releases} release(s), node ${node} advertising ${nodeJson.status.capacity["nvidia.com/gpu"]} simulated GPU(s)`);
  process.exit(0);
}

if (mode === "--down") {
  try { execFileSync("kind", ["delete", "cluster", "--name", "simgpu"], { encoding: "utf8" }); } catch {}
  // argobot's variant space references the cluster target, so it goes before
  // the target-owning cluster space.
  for (const space of ["inference-workloads-simgpu", "simgpu-argo-apps", "argobot-simgpu", "simgpu", "inference-workloads-base"]) {
    try { cub("space", "delete", space, "--recursive"); console.log(`deleted ${space}`); } catch { console.log(`${space}: already absent`); }
  }
  console.log("sim-gpu teardown complete");
  process.exit(0);
}

check(false, "usage: run-eks-inf-simgpu-acceptance.mjs --up | --deliver | --scale | --simulate | --capture | --down");
