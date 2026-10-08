// Open questions a Helm chart entry carries, per chart version and base.
//
// If in doubt, flag the entry. An entry with a question here is marked watch:
// the materialization stage of its base-variant record and of its listing says
// watch, the stage's answer is the question, and the record's limits name it.
// watch is the existing assessment word for a checked result with a limit to
// review, and it is never a pass. An AICR entry is flagged from its ordering
// evidence and a NIMService variant from its sample bytes; a Helm chart entry
// has no such computed source, so its questions are authored here, beside the
// reason, and the proof writes them into the recipe's chart dossier.
//
// A question is one sentence. It stays until someone answers it and removes
// the row; prose elsewhere does not clear it.
//
// The rows below belong to the charts the retained AICR EKS training entries
// pin (scripts/lib/aicr-nested-charts-coverage.mjs).

export const HELM_OPEN_QUESTION_NEXT_ACTION =
  "Review the exact object set and its digest, and settle the open question before relying on this base.";

const kaiConfig =
  "The kai-config object that tells the operator which scheduler services to run is delivered by a Helm hook, and no base holds it, so should it be part of the base instead of a lifecycle action that nothing runs automatically?";
const draDefault =
  "The chart refuses to render its own defaults, so the default base sets resources.gpus.enabled false: is that the right meaning of default for this entry, or should the entry have no default base?";
const draApiVersion =
  "The DeviceClass objects are rendered as resource.k8s.io/v1, which Kubernetes serves from 1.34, although the chart accepts 1.32: does the Catalog need bases for clusters that serve only v1beta1 or v1beta2?";
const trainerSecrets =
  "Two webhook certificate Secrets render with empty data and the controllers fill them in at run time, so does a delivery that applies the base again overwrite the certificates the controllers wrote?";
const kpsAdmissionRoute =
  "The other versions of this chart in the Catalog carry a packaged admission-webhook setup route with the hook image pinned by digest, and this version's hook image digest was not looked up, so should 84.4.0 get that route or keep its hooks as recorded lifecycle actions?";
const kpsPassword =
  "The AICR values set the Grafana admin password to the literal value admin, and this base carries it in a Secret byte for byte: should a Catalog base ship a well-known credential?";

const kaiRows = [{ bases: ["default", "aicr-eks-training"], question: kaiConfig }];
const draRows = [
  { bases: ["default"], question: draDefault },
  { bases: ["default", "gpu-resources", "aicr-eks-training"], question: draApiVersion },
];
const aicrPair = ["aicr-eks-training-v0-20-0", "aicr-eks-training-v1-0-0"];

// component ("<repository>/<chart>") -> version -> rows of { bases, question }.
export const HELM_OPEN_QUESTIONS = Object.freeze({
  "kai-scheduler/kai-scheduler": { "v0.14.1": kaiRows, "v0.16.9": kaiRows },
  "dra-driver-nvidia/dra-driver-nvidia-gpu": { "0.4.1": draRows, "0.5.0": draRows },
  "kubeflow/kubeflow-trainer": { "2.2.0": [{ bases: ["default", ...aicrPair], question: trainerSecrets }] },
  "prometheus-community/kube-prometheus-stack": {
    "84.4.0": [
      { bases: ["default", ...aicrPair], question: kpsAdmissionRoute },
      { bases: aicrPair, question: kpsPassword },
    ],
  },
});

// The rows of one chart version, for the recipe's chart dossier.
export function helmOpenQuestionRows(component, version) {
  return HELM_OPEN_QUESTIONS[component]?.[version] ?? [];
}

// The questions one base carries, in order. An unflagged base returns none.
export function helmOpenQuestionsFor(component, version, base) {
  return helmOpenQuestionRows(component, version)
    .filter((row) => row.bases.includes(base))
    .map((row) => row.question);
}

// The same, read from a base-variant record's labels, as one answer.
export function helmOpenQuestionFor(record) {
  if (record?.spec?.source?.type !== "helm") return "";
  const labels = record.metadata?.labels ?? {};
  return helmOpenQuestionsFor(labels.component, labels.sourceVersion, labels.base).join(" ");
}

export function testHelmOpenQuestions() {
  const check = (condition, message) => {
    if (!condition) throw new Error(`helm open questions self-test failed: ${message}`);
  };
  const record = (component, sourceVersion, base, type = "helm") => ({
    metadata: { labels: { component, sourceVersion, base } },
    spec: { source: { type } },
  });
  check(helmOpenQuestionFor(record("kai-scheduler/kai-scheduler", "v0.16.9", "default")) === kaiConfig, "a flagged base returns its question");
  check(
    helmOpenQuestionFor(record("dra-driver-nvidia/dra-driver-nvidia-gpu", "0.5.0", "default")) === `${draDefault} ${draApiVersion}`,
    "a base with two questions returns both, in order",
  );
  check(
    helmOpenQuestionFor(record("dra-driver-nvidia/dra-driver-nvidia-gpu", "0.5.0", "gpu-resources")) === draApiVersion,
    "a base carries only the questions that name it",
  );
  check(helmOpenQuestionFor(record("prometheus-community/kube-prometheus-stack", "88.6.3", "default")) === "", "another version of a flagged chart is not flagged");
  check(helmOpenQuestionFor(record("nvidia/nvsentinel", "v1.9.0", "default")) === "", "an unflagged chart is not flagged");
  check(helmOpenQuestionFor(record("kai-scheduler/kai-scheduler", "v0.16.9", "default", "aicr")) === "", "a record of another source type is not flagged here");
  for (const [component, versions] of Object.entries(HELM_OPEN_QUESTIONS)) {
    check(/^[a-z0-9-]+\/[a-z0-9-]+$/.test(component), `${component} is not <repository>/<chart>`);
    for (const rows of Object.values(versions)) {
      for (const row of rows) {
        check(row.bases.length > 0 && /\?$/.test(row.question) && !/[.!?] [A-Z]/.test(row.question), `${component}: a question must be one sentence that names its bases`);
      }
    }
  }
}
