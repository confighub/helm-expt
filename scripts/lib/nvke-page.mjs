// The NVKE page. NVKE is NVIDIA's Kubernetes engine, and its source is public.
// The page reports one lab run of 2 November 2026 whose record is not public
// yet, and it says so. Nothing here is a Catalog claim, and no lane reads it.
// When the record is published, read these facts from it and drop the notice.

export const NVKE_PAGE_FILE = "nvke.html";
export const NVKE_PAGE_TITLE = "See GPU add-ons on NVKE clusters";
export const NVKE_RUN_DATE = "2 November 2026";
const NVKE_REPO = "https://github.com/dsx-ai-factory/nvke";

const LAYERS = [
  ["The cluster, which is created, scaled and deleted", "NVKE", "Not covered by these tests"],
  ["Add-ons, which are the GPU Operator, the device plugin, cert-manager and metrics-server", "AICR chooses, Helm renders, and Flux or Argo CD applies", "Tested, with no GPUs"],
  ["Apps, such as an inference service", "The same path as add-ons", "Not tested on NVKE"],
];

const TESTS = [
  ["A starting point", "Both NVKE clusters are Ready and attached, and Flux has applied."],
  ["Configuration for each cluster", "The device plugin differs between the two clusters only in its MIG strategy, which is how a GPU is split between workloads. The GPU Operator is the same on both."],
  ["Inputs kept as data, over OCI", "Every Flux source reads an oci:// address in ConfigHub."],
  ["Add-ons across platform and workload clusters", "After the handover, every Argo CD Application is Synced and reads from ConfigHub, and nothing was removed."],
  ["A record of what agents propose", "Each cluster's node pool count is shown with the reason it was set."],
  ["Promotion and rollback", "Replicas change in stage order after each approval, and a rolled-back cluster is on the earlier version within two minutes."],
  ["One cluster held on an older approved release", "The agent's own approval and its write are refused, and the cluster moves only after a named person approves."],
  ["A test loop driven by an agent", "Each attempt is kept with its reason and result, and a failed one is rolled back."],
];

const HELD_CLUSTER_OUTPUT = [
  "ok: the agent's own approval was refused",
  "ok: the agent's write to my-cluster-2 was refused",
  "ok: the promotion before approval was refused",
  "ok: my-cluster-2 is held on: nvcr.io/nvidia/k8s-device-plugin:v0.20.0",
  "…",
  "ok: my-cluster-2 runs 0.20.1, after 5 s",
  "ok: my-cluster stays on: nvcr.io/nvidia/k8s-device-plugin:v0.20.0",
  "ok: my-cluster-2 keeps its own MIG strategy: mixed",
];

export function nvkePage({ escapeHtml, markdownLikeTable, technicalNoteHtml }) {
  const body = `<section aria-labelledby="nvke-lab">
      <h2 id="nvke-lab">What the lab is</h2>
      <p>NVKE's own quickstart runs in a VM on a laptop, with two NVKE clusters and no GPUs. ConfigHub holds the clusters' GPU add-ons as plain Kubernetes objects, and Flux pulls them from ConfigHub over OCI. The lab ran on ${NVKE_RUN_DATE}.</p>
      <p class="notice"><strong>You can't check or repeat this run yet.</strong> Its scripts and its record are not public. This page reports what the run printed, and it will link the record when that is published.</p>
    </section>
    <section aria-labelledby="nvke-layers">
      <h2 id="nvke-layers">Who does what</h2>
      ${markdownLikeTable([["Layer", "What does the work", "With ConfigHub in the lab"], ...LAYERS])}
      <p>AICR says what to run for this hardware and workload, as a chart version and its values. Helm turns that into Kubernetes objects. ConfigHub holds those objects, with every change and approval, and neither AICR nor Helm manages clusters.</p>
    </section>
    <section aria-labelledby="nvke-tests">
      <h2 id="nvke-tests">What the eight tests checked</h2>
      <p>All eight passed on ${NVKE_RUN_DATE}, from a VM that did not exist before the run.</p>
      ${markdownLikeTable([["What it shows", "It passes when"], ...TESTS])}
      <p>The seventh test printed this, shortened where the line reads "…".</p>
      <pre><code>${HELD_CLUSTER_OUTPUT.map((line) => escapeHtml(line)).join("\n")}</code></pre>
    </section>
    ${[
      `<strong>No GPUs.</strong> The NVKE lab's clusters run in a VM, so "delivered" means applied and reconciled. It does not mean a GPU was found.`,
      `<strong>Part of the AICR recipe.</strong> The NVKE lab uses only the recipe's GPU Operator.`,
      `<strong>No inference service.</strong> No app, model or NIM runs in the NVKE lab.`,
      `<strong>No cluster management.</strong> NVKE's own API creates and scales the clusters in these tests, and ConfigHub does not.`,
      `<strong>A dated run.</strong> NVKE changes daily, and this run is pinned to ${NVKE_RUN_DATE}.`,
    ].map((note) => technicalNoteHtml(".", note)).join("\n    ")}
    <section aria-labelledby="nvke-next">
      <h2 id="nvke-next">Where to go next</h2>
      <p><a href="./try-aicr.html">Try NVIDIA AICR for GPUs</a> shows how AICR chooses the add-ons, with recipes you can read today. <a href="./d/docs/user/deploy-gpu-operator-from-catalog.html">Deploy the GPU Operator</a> takes the same operator from the Catalog. <a href="./eks-inference.html">Try an EKS GPU inference platform</a> checks a whole GPU platform on your laptop.</p>
    </section>`;
  return {
    title: NVKE_PAGE_TITLE,
    eyebrow: "An example",
    lead: `NVKE is NVIDIA's Kubernetes engine. It creates clusters and node pools for GPU work, and <a href="${NVKE_REPO}">its source is public</a>. This page shows what ConfigHub does for the add-ons on NVKE clusters, from one lab run.`,
    ask: `Read this page and <a href="${NVKE_REPO}">NVKE's public repository</a>. Tell me which layer ConfigHub covers on NVKE clusters, and what this lab run did not show. Run nothing.`,
    body,
  };
}
