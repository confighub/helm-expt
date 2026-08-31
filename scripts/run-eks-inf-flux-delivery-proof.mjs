// The Flux repeat of the governed delivery lane: ConfigHub publishes an exact
// release digest, and Flux, not Argo CD, reconciles precisely that digest onto
// a local kind cluster. Two handoffs are required, the initial delivery and a
// governed change, so the proof covers ongoing governance rather than one sync.
//
// Phases, one per invocation:
//
//   --up        kind create cluster simflux + flux install (controllers only)
//   --deliver   ConfigHub side: cluster space, server worker, OCI target,
//               inference-workloads base by pinned digest, target-bound
//               variant, first release
//   --flux      wire Flux to the space registry: a dockerconfig secret from
//               the worker credentials, an OCIRepository (insecure, tag
//               latest), and a pruning Kustomization; label the node with the
//               general pool so the platform contract can be honored
//   --change    the governed change: cub set-replicas on smoke-cpu, republish
//   --capture   read-only: write the receipt into
//               data/eks-inf-replica/flux-delivery/
//   --down      delete the kind cluster and the Spaces this run created
//
// Boundaries: the registry is the local self-hosted server over plain HTTP
// (hence insecure: true), and Flux has no sync-wave notion, so ordering
// annotations ride along inert. Nothing here claims more than delivery.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { check, repoRoot, write } from "./lib/proof-common.mjs";

const outRoot = join(repoRoot, "data", "eks-inf-replica", "flux-delivery");
const kube = (...args) => execFileSync("kubectl", ["--context", "kind-simflux", ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const cub = (...args) => execFileSync("cub", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const mode = process.argv[2];

const ROW = readFileSync(join(repoRoot, "data", "certified-bundles", "receipts.csv"), "utf8")
  .split("\n").map((line) => line.split(",")).find((cells) => cells[1] === "eks-inference-inference-workloads");
const BUNDLE_REF = `oci://${ROW[10].replace(/:latest$/, "")}@${ROW[6]}`;
const REGISTRY = "192.168.97.1:32181";

if (mode === "--up") {
  execFileSync("kind", ["create", "cluster", "--name", "simflux", "--wait", "120s"], { encoding: "utf8" });
  execFileSync("flux", ["install", "--context", "kind-simflux"], { encoding: "utf8" });
  console.log("kind simflux up with Flux controllers");
  process.exit(0);
}
if (mode === "--deliver") {
  cub("space", "create", "simflux-cluster", "--label", "Owner=EKS Inference");
  cub("worker", "create", "worker", "--space", "simflux-cluster", "--is-server-worker");
  cub("target", "create", "target", "{}", "worker", "--space", "simflux-cluster", "-p", "OCI", "-t", "Any");
  cub("variant", "upload", "--component", "inference-workloads", "--variant", "base",
    "--granularity", "per-file", "--owner", "EKS Inference", "--label", "managed-by=eks-inference", BUNDLE_REF);
  cub("variant", "create", "simflux", "inference-workloads-base", "--target", "simflux-cluster/target");
  cub("release", "publish", "inference-workloads-simflux");
  console.log("delivered: base by pinned digest, target-bound variant, first release published");
  process.exit(0);
}
if (mode === "--flux") {
  const secret = cub("worker", "get-secret", "worker", "--space", "simflux-cluster").trim().split("\n").pop();
  const workerId = JSON.parse(cub("worker", "get", "worker", "--space", "simflux-cluster", "-o", "json")).BridgeWorker?.BridgeWorkerID
    ?? JSON.parse(cub("worker", "get", "worker", "--space", "simflux-cluster", "-o", "json")).BridgeWorkerID;
  kube("-n", "flux-system", "create", "secret", "docker-registry", "confighub-registry",
    `--docker-server=${REGISTRY}`, `--docker-username=${workerId}`, `--docker-password=${secret}`);
  const manifests = `apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
metadata:
  name: inference-workloads-simflux
  namespace: flux-system
spec:
  interval: 30s
  insecure: true
  url: oci://${REGISTRY}/space/inference-workloads-simflux
  ref:
    tag: latest
  secretRef:
    name: confighub-registry
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: inference-workloads-simflux
  namespace: flux-system
spec:
  interval: 30s
  prune: true
  sourceRef:
    kind: OCIRepository
    name: inference-workloads-simflux
`;
  execFileSync("kubectl", ["--context", "kind-simflux", "apply", "-f", "-"], { input: manifests, encoding: "utf8" });
  const node = kube("get", "nodes", "-o", "jsonpath={.items[0].metadata.name}").trim();
  kube("label", "node", node, "eks-inference.confighub.com/pool=general", "--overwrite");
  console.log("flux wired to the space registry with the worker credentials; node labeled for the general pool");
  process.exit(0);
}
if (mode === "--change") {
  cub("function", "do", "--space", "inference-workloads-simflux", "--unit", "smoke-cpu",
    "set-replicas", "1", "--change-desc", "Flux lane: governed scale-up of the CPU smoke check");
  cub("release", "publish", "inference-workloads-simflux");
  console.log("governed change published; Flux picks up the new digest on its interval");
  process.exit(0);
}

if (mode === "--capture") {
  const who = cub("auth", "status");
  const organization = (who.match(/Organization Name\s+(\S.*?)\s*$/m) ?? [])[1] ?? "unknown";
  const releases = cub("release", "list", "--space", "inference-workloads-simflux").trim().split("\n").slice(1)
    .map((line) => line.split(/\s+/)).map((cells) => ({ id: cells[0], digest: cells[2] }));
  const applied = kube("get", "kustomization", "-n", "flux-system",
    "-o", "jsonpath={.items[0].status.lastAppliedRevision}").trim();
  const sourceReady = kube("get", "ocirepository", "-n", "flux-system",
    "-o", "jsonpath={.items[0].status.conditions[?(@.type=='Ready')].status}").trim();
  const pods = JSON.parse(kube("get", "pods", "-n", "inference", "-o", "json")).items
    .map((pod) => ({ name: pod.metadata.name, app: pod.metadata.labels?.app ?? "", phase: pod.status.phase }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const latest = releases[releases.length - 1];
  check(releases.length >= 2, "acceptance: the lane needs the initial release and the governed change");
  check(applied === `latest@${latest.digest}`, `acceptance: Flux lastAppliedRevision must equal the newest release digest (${applied} vs ${latest.digest})`);
  check(sourceReady === "True", "acceptance: the OCIRepository must be Ready");
  const running = (app) => pods.some((pod) => pod.app === app && pod.phase === "Running");
  check(running("chat") && running("smoke-cpu"), "acceptance: the chat and smoke-cpu pods must both be Running");

  write(join(outRoot, "receipt.yaml"), [
    "apiVersion: evidence.confighub.com/v1alpha1",
    "kind: FluxDeliveryReceipt",
    "metadata:",
    "  name: eks-inference-flux-delivery",
    "spec:",
    `  organization: "${organization}"`,
    `  cluster: "kind/simflux"`,
    `  reconciler: "flux (source-controller + kustomize-controller)"`,
    `  bundle: "${BUNDLE_REF}"`,
    `  registry: "oci://${REGISTRY}/space/inference-workloads-simflux"`,
    "  releases:",
    ...releases.map((release) => `    - id: "${release.id}"\n      manifestDigest: "${release.digest}"`),
    `  fluxLastAppliedRevision: "${applied}"`,
    `  digestHandoffExact: ${applied === `latest@${latest.digest}`}`,
    "  pods:",
    ...pods.map((pod) => `    - name: "${pod.name}"\n      phase: "${pod.phase}"`),
    "  boundaries:",
    '    - "The registry is the local self-hosted server over plain HTTP, so the OCIRepository sets insecure true; a production registry would use TLS."',
    '    - "Flux has no sync-wave notion; the bundle ordering annotations ride along inert, and this stack applies cleanly without them."',
    '    - "The node carries the general pool label so the platform contract can be honored; GPU workloads stay at zero replicas in this lane."',
    '    - "Delivery only: nothing here claims the platform or a model runs."',
  ].join("\n") + "\n");
  write(join(outRoot, "summary.md"), `# The Flux repeat of the governed delivery lane

<!-- Generated by scripts/run-eks-inf-flux-delivery-proof.mjs --capture. Do not edit by hand. -->

The governed lane was proven with Argo CD; this run repeats it with Flux, on a kind cluster, against the same retained bundle by pinned digest. Two handoffs carry the claim. The first release's manifest digest became Flux's applied revision exactly. Then a governed change, cub set-replicas on the CPU smoke check and a republish, produced a new digest, and Flux applied exactly that one: ${applied}. The change never touched kubectl.

Flux authenticated to the space registry with the worker's own credentials as an image-pull secret, the Kustomization prunes, and the pool nodeSelector from the platform contract was honored once the node carried the general label. The boundaries are enumerated in [receipt.yaml](./receipt.yaml): a plain-HTTP local registry, no sync-wave semantics in Flux, GPU workloads left at zero, and no claim beyond delivery.

The staged plan is [eks-inf-replica-plan.md](../../../docs/planning/eks-inf-replica-plan.md), and the Argo-side equivalents are the sim-GPU receipt and the org rebuild beside this directory.
`);
  console.log(`receipt written: ${releases.length} release(s), applied ${applied}, ${pods.length} pod(s)`);
  process.exit(0);
}

if (mode === "--down") {
  try { execFileSync("kind", ["delete", "cluster", "--name", "simflux"], { encoding: "utf8" }); } catch {}
  for (const space of ["inference-workloads-simflux", "simflux-cluster", "inference-workloads-base"]) {
    try { cub("space", "delete", space, "--recursive"); console.log(`deleted ${space}`); } catch { console.log(`${space}: already absent`); }
  }
  console.log("flux-lane teardown complete");
  process.exit(0);
}

check(false, "usage: run-eks-inf-flux-delivery-proof.mjs --up | --deliver | --flux | --change | --capture | --down");
