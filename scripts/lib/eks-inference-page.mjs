// The page "Try an EKS GPU inference platform on your laptop". It shows the
// eks-inference stack the Workshop plugin ships: its eight parts, where each
// one is applied, and the one command that checks the whole platform locally.
//
// Every fact on the page comes from a committed file. The parts, their planes
// and their order come from the stack's closure table, what each part is from
// the snapshot of the stack's own component manifest, and the object counts
// and the command output from the dated run log. The builder checks that the
// log and the closure table name the same parts, so the page cannot show a part
// or a count that neither holds.

export const EKS_INFERENCE_PAGE_FILE = "eks-inference.html";
export const EKS_INFERENCE_PAGE_TITLE = "Try an EKS GPU inference platform on your laptop";
export const EKS_INFERENCE_RUN_LOG = "docs/user/eks-inference-sandbox-run-2026-10-27.md";
export const EKS_INFERENCE_CLOSURE = "data/eks-inf-replica/closure.csv";
export const EKS_INFERENCE_MANIFEST = "data/eks-inf-replica/source/components-manifest.yaml";

const RUN_DATE = "2026-10-27";
const COMMAND = "cub stack sandbox eks-inference";
const EVIDENCE = "https://github.com/confighub/helm-expt/blob/main/data/eks-inf-replica";

// The three planes, in the order a reader meets them, in plain words.
const PLANES = [
  { id: "hub", heading: "Held in ConfigHub", note: "Values the other parts share. Never applied to any cluster." },
  { id: "mgmt", heading: "Applied by a small local kind cluster", note: "It creates the AWS network and the EKS cluster through AWS Controllers for Kubernetes (ACK)." },
  { id: "workload", heading: "Applied by the new EKS cluster", note: "Everything that runs on the cluster once it exists." },
];

// The Catalog charts each part is rebuilt from, as chart page names. A part
// the closure table marks as a retained bundle has no chart.
const CATALOG_CHART_PAGES = {
  "catalog-aws-controllers-k8s-ec2-chart-1.18.4-eks-inference": ["aws-controllers-k8s/ec2-chart", "aws-controllers-k8s-ec2-chart"],
  "catalog-aws-controllers-k8s-eks-chart-1.16.3-eks-inference": ["aws-controllers-k8s/eks-chart", "aws-controllers-k8s-eks-chart"],
  "catalog-aws-controllers-k8s-iam-chart-1.7.3-eks-inference": ["aws-controllers-k8s/iam-chart", "aws-controllers-k8s-iam-chart"],
  "catalog-karpenter-karpenter-1.14.0-eks-inference": ["karpenter/karpenter", "karpenter-karpenter"],
  "catalog-nvidia-nvidia-device-plugin-0.19.3-eks-inference": ["nvidia/nvidia-device-plugin", "nvidia-nvidia-device-plugin"],
};

// The charts whose eks-inference base is a part of this platform, so their
// chart pages can point here.
export const EKS_INFERENCE_CHARTS = Object.values(CATALOG_CHART_PAGES).map(([chart]) => chart);

// The command and its output, as the run log holds them.
function runOutput(runLog, check) {
  const block = runLog.match(/```\n(\$ [^\n]+)\n([\s\S]*?)```/);
  check(Boolean(block), `${EKS_INFERENCE_RUN_LOG} must hold the run as one fenced block`);
  check(block[1] === `$ ${COMMAND}`, `${EKS_INFERENCE_RUN_LOG} must record ${COMMAND}`);
  return block[2].split("\n");
}

export function eksInferencePage({ closureRows, manifest, runLog, stackRow, plugin, check, escapeHtml, commandBlock, markdownLikeTable, workshopInstall }) {
  const lines = runOutput(runLog, check);
  const counts = new Map();
  for (const line of lines) {
    const match = line.match(/^\s{6}([a-z-]+): (\d+)\s+\[(hub|mgmt|workload)/);
    if (match) counts.set(match[1], { objects: Number(match[2]), plane: match[3] });
  }
  const total = Number(lines.find((line) => /^\s+\d+ objects total$/.test(line))?.trim().split(" ")[0]);
  check(lines.some((line) => line.trim() === "=> CHECKED"), `${EKS_INFERENCE_RUN_LOG} must record a CHECKED result`);
  const descriptions = new Map(manifest.components.map((component) => [component.name, component.description]));
  const parts = closureRows.map((row) => ({ ...row, order: Number(row.order), description: descriptions.get(row.component), ...counts.get(row.component) }));
  check(parts.length === counts.size, `${EKS_INFERENCE_CLOSURE} and ${EKS_INFERENCE_RUN_LOG} must name the same number of parts`);
  for (const part of parts) {
    check(Boolean(part.description), `${EKS_INFERENCE_MANIFEST} has no description for ${part.component}`);
    check(Number.isInteger(part.objects), `${EKS_INFERENCE_RUN_LOG} has no object count for ${part.component}`);
    check(part.plane === counts.get(part.component).plane, `${part.component}: the closure table and the run log disagree on its plane`);
  }
  check(parts.reduce((sum, part) => sum + part.objects, 0) === total, `${EKS_INFERENCE_RUN_LOG}: the parts do not add up to ${total} objects`);
  const spell = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const partCount = spell[parts.length] ?? String(parts.length);

  const source = (part) => {
    if (part.supply_mode !== "rebuild-from-catalog") return "A retained bundle, pinned by its digest.";
    const charts = part.catalog_inputs.split(" + ").map((input) => {
      const page = CATALOG_CHART_PAGES[input];
      check(Boolean(page), `${part.component}: no chart page is known for ${input}`);
      return `<a href="./charts/${page[1]}.html">${escapeHtml(page[0])}</a>`;
    });
    return `Rebuilt from the Catalog's eks-inference base of ${charts.join(", ").replace(/, ([^,]*)$/, " and $1")}.`;
  };
  const columns = PLANES.map((plane) => {
    const cards = parts.filter((part) => part.plane === plane.id).sort((a, b) => a.order - b.order).map((part) => `
          <li class="eksi-part">
            <p class="eksi-name"><code>${escapeHtml(part.component)}</code> <span class="eksi-count">${part.objects} object${part.objects === 1 ? "" : "s"}</span></p>
            <p>${escapeHtml(part.description)}.</p>
            <p class="eksi-source">${source(part)}</p>
          </li>`).join("");
    return `
      <div class="eksi-plane">
        <h3>${escapeHtml(plane.heading)}</h3>
        <p class="eksi-plane-note">${escapeHtml(plane.note)}</p>
        <ol>${cards}
        </ol>
      </div>`;
  }).join(`<div class="eksi-arrow" aria-hidden="true">&darr;</div>`);

  const shown = lines.filter((line) => /^\s+(\[(PASS|WARN)\]|=>|\d+ objects total|Rendered, but)/.test(line) || /^\s{6}apiextensions/.test(line));
  const runBlock = commandBlock([
    { cmd: workshopInstall },
    { cmd: COMMAND, out: shown },
  ], { title: "one install, one command", label: "One install, one command" });

  const evidenceRows = [
    [`<a href="${EVIDENCE}/stack-sandbox/summary.md">The check, as a receipt</a>`, `The same check, recorded with every part pulled by digest and every file compared with its receipt before it was read.`],
    [`<a href="${EVIDENCE}/composition-verdict.md">Eight checks over the whole platform</a>`, "A fuller review of the eight parts together. It names values that are copied between parts instead of linked, and inputs the destination must supply."],
    [`<a href="${EVIDENCE}/sim-gpu/summary.md">Delivery onto a simulated GPU node</a>`, "The inference part, released through ConfigHub and pulled by Argo CD onto a kind cluster that pretends to have two GPUs. The pods schedule, and the smoke test reports that <code>nvidia-smi</code> is not found, because no GPU driver exists."],
    [`<a href="${EVIDENCE}/flux-delivery/summary.md">The same delivery through Flux</a>`, "A release, then a change, each applied by Flux at exactly the digest ConfigHub published."],
    [`<a href="${EVIDENCE}/org-rebuild/comparison.md">The ConfigHub organization, rebuilt</a>`, "The platform's ConfigHub Spaces, rebuilt with generic cub commands and compared with the plugin's own build."],
  ];

  const body = `
    <section aria-labelledby="eksi-check">
      <h2 id="eksi-check">1. Check it on your laptop</h2>
      <p>Install the Workshop plugin, then run one command in an empty directory. It pulls the ${partCount} parts, checks them together and lays out every object. It needs no AWS account, no ConfigHub account, no cluster and no GPU.</p>
      ${runBlock}
      <p>The check passed. The ${partCount} parts hold ${total} objects, and no two parts claim the same object. Read the two warnings before you go further. Three ACK controller charts inside one part each carry the same two CRDs, so <code>cub stack upload</code> refuses that part until it is rebuilt with one copy. The stack also expects the <code>kube-system</code> namespace to exist already.</p>
      <p class="eksi-dated">This output is from one run on ${RUN_DATE}, recorded in <a href="https://github.com/confighub/helm-expt/blob/main/${EKS_INFERENCE_RUN_LOG}">a dated log</a>.</p>
    </section>

    <section aria-labelledby="eksi-parts">
      <h2 id="eksi-parts">2. What is in it</h2>
      <p>The platform runs GPU inference on Amazon EKS. It is ${partCount} parts in three places. A small kind cluster on your side creates the AWS network and the EKS cluster. The EKS cluster then installs its own node autoscaler, the NVIDIA device plugin and the inference workload. One part only holds shared values in ConfigHub.</p>
      <div class="eksi-planes">${columns}
      </div>
      <p>The kind cluster must finish before the EKS cluster exists to apply its own parts, so the stack records the order of every part. Argo CD sync waves cannot express a wait that spans two clusters.</p>
    </section>

    <section aria-labelledby="eksi-limits">
      <h2 id="eksi-limits">3. What the check does not do</h2>
      <p>It does not create an EKS cluster, call AWS, or start anything on a GPU. It reads the configuration and tells you whether the parts fit together. The Workshop has not yet run this platform on a real GPU. That run is tracked in <a href="https://github.com/confighub/helm-expt/issues/1581">issue 1581</a>.</p>
    </section>

    <section aria-labelledby="eksi-real">
      <h2 id="eksi-real">4. Build it in AWS</h2>
      <p>Building the platform for real takes an AWS account, a ConfigHub account and the ${escapeHtml(plugin.name)} plugin, <code>${escapeHtml(plugin.commands.join(", "))}</code>. Its repository, <a href="https://github.com/${escapeHtml(plugin.repository)}">${escapeHtml(plugin.repository)}</a>, holds the steps.</p>
      <pre class="home-cmd"><code>${escapeHtml(plugin.install)}</code></pre>
      <p>The stack definition the check reads is <a href="${escapeHtml(stackRow.source)}">${escapeHtml(stackRow.name)}</a> in the Workshop plugin.</p>
    </section>

    <section aria-labelledby="eksi-evidence">
      <h2 id="eksi-evidence">5. What has been proved, and where</h2>
      <p>Each record below is a committed file on GitHub.</p>
      ${markdownLikeTable([["Record", "What it shows"], ...evidenceRows], { rawColumns: [0, 1] })}
    </section>

    <section aria-labelledby="eksi-next">
      <h2 id="eksi-next">6. Where to go next</h2>
      <p><a href="./try-aicr.html">Try NVIDIA AICR for GPUs</a> to compare your GPU nodes with NVIDIA's recipes. <a href="./compose-a-stack.html">Compose and check a stack</a> shows how to build your own. <a href="./stack.html">Every stack</a> lists the other stacks you can check the same way.</p>
    </section>
`;

  const css = `
  .eksi-planes { display: grid; gap: 6px; margin: 16px 0; }
  .eksi-plane { border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; background: var(--surface); min-width: 0; }
  .eksi-plane h3 { margin: 0 0 2px; font-size: 1rem; }
  .eksi-plane-note { margin: 0 0 10px; color: var(--muted); font-size: .88rem; }
  .eksi-plane ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .eksi-part { border-left: 3px solid var(--accent); padding: 4px 0 4px 10px; min-width: 0; }
  .eksi-part p { margin: 0 0 4px; font-size: .88rem; }
  .eksi-name code { font-weight: 700; }
  .eksi-count { color: var(--muted); font-size: .82rem; white-space: nowrap; }
  .eksi-source { color: var(--muted); }
  .eksi-arrow { justify-self: center; color: var(--muted); font-size: 1.2rem; line-height: 1; }
  .eksi-dated { color: var(--muted); font-size: .88rem; }
`;

  return {
    title: EKS_INFERENCE_PAGE_TITLE,
    eyebrow: "A stack",
    lead: `A whole platform for GPU inference on Amazon EKS, in ${partCount} tested parts: the AWS network and cluster, Karpenter GPU node pools, the NVIDIA device plugin and a sample vLLM deployment. Check all of it on your laptop in one command, with no AWS account and no GPU.`,
    opening: `    <p><a href="#eksi-check">Check it</a> · <a href="#eksi-parts">See the ${partCount} parts</a> · <a href="#eksi-real">Build it in AWS</a></p>\n`,
    ask: `Install the ConfigHub Workshop plugin with <code>${escapeHtml(workshopInstall)}</code>, run <code>${COMMAND}</code> in an empty directory, and tell me what the platform contains, which checks passed, and what the warnings mean before I build it in AWS.`,
    body,
    css,
  };
}
