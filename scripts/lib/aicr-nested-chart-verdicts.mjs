// The flattening-safety verdicts for the charts the retained AICR EKS training
// entries pin (scripts/lib/aicr-nested-charts-coverage.mjs). One row per chart
// version and base, read by scripts/generate-flattening-safety-verdicts.mjs.
//
// Each verdict is a hand read of the locked chart archive against the base's own
// committed render: its hooks, CRDs, Secrets, generated state and ordering. A
// base that differs from another only by values that reach no hazard takes that
// base's findings and says what the difference is. No hook named here has been
// run on a cluster: every lifecycle route is a packaged lifecycle action,
// recorded and not observed, and every certificate route is the chart's own
// run-time behaviour, read from its templates and not observed.

const verdictFile = (base) => (base === "default" ? {} : { verdictFile: `flattening-safety-verdict-${base}.yaml` });
const noRoute = "no route needed for the audited base";
const crdBundle = "ordering declaration ships with the bundle: the base's target facts name the CRDs and the package carries them as a CRD bundle";
const notRun = "No lifecycle action has been run on a cluster, and no receipt says a flattened install, upgrade or delete behaves like the Helm one.";

const row = (repo, chart, version, base, body) => ({
  repo,
  chart,
  version,
  recipe: `recipes/${repo}/${chart}/${version}`,
  auditedBase: base,
  ...verdictFile(base),
  ...body,
});

// ---------------------------------------------------------------------------
// kai-scheduler
// ---------------------------------------------------------------------------

function kaiRows(version) {
  const old = version === "v0.14.1";
  const preCount = old ? "ten" : "nine";
  const configDelivery = old
    ? "the kai.scheduler/v1 Config object named kai-config is one of the pre-install and pre-upgrade hook objects"
    : "a post-install and post-upgrade hook Job applies the kai.scheduler/v1 Config object named kai-config with kubectl from a hook ConfigMap";
  const configRoute = old
    ? "pre-install and pre-upgrade lifecycle action that holds the Config object the operator needs, the CRD upgrader Job and the topology migration Job; required on a first install, recorded in the package and not yet run"
    : "post-install and post-upgrade lifecycle action that applies the Config object the operator needs; required on a first install, recorded in the package and not yet run";
  const one = (base, { postDelete, values, rationale, variantScope }) =>
    row("kai-scheduler", "kai-scheduler", version, base, {
      overrides: {
        "helm-hooks": {
          detail: `with ${values} the chart renders ${preCount} pre-install and pre-upgrade hook objects${old ? "" : ", five post-install and post-upgrade hook objects"}${postDelete ? " and four post-delete hook objects" : ""}, and none is in the base. They are not maintenance only: ${configDelivery}, and until that object exists the operator deploys no scheduler${postDelete ? "" : ". The post-delete cleanup set does not render because postCleanup.enabled is false"}`,
          disposition:
            "packaged lifecycle actions under prerequisites/kai-scheduler-lifecycle, each marked not automatic; none has been run on a cluster",
        },
        "resource-policy-keep": {
          detail:
            "four objects in the base carry helm.sh/resource-policy: keep: the kai-resource-reservation Namespace, the two default Queue objects and the default SchedulingShard. Helm leaves them on uninstall; a flattened delete removes them with everything else",
          disposition: "named companion required: prune protection for the four keep-annotated objects; none is packaged",
        },
        lookup: {
          detail:
            "the base's own templates call lookup, and the calls are reached. The kai-resource-reservation Namespace and ServiceAccount render only when the cluster does not already have them, and OpenShift settings render when the cluster has the ClusterVersion CRD. An offline render answers no to all three, so the base holds the Namespace and the ServiceAccount, which is safe to apply over existing ones, and holds no OpenShift SecurityContextConstraints, which is wrong on OpenShift. The remaining lookups are inside the hook templates",
          disposition: "the base is the fresh-install, non-OpenShift answer; an OpenShift target needs its own render",
        },
        "crd-ordering": {
          detail: "six CRDs render in this base beside two Queue objects and one SchedulingShard, which are instances of three of them",
          disposition: crdBundle,
        },
        "namespace-creation": {
          detail:
            "one Namespace object, kai-resource-reservation, is in the base. The second Namespace template, for the scaling pod, renders only when global.clusterAutoscaling is true, which these values leave false. Because the base holds a Namespace, the installer package adds none for the release namespace",
          disposition: "the kai-resource-reservation Namespace ships in the base; the kai-scheduler namespace must already exist on the target",
        },
      },
      lane: "flatten-with-routes",
      routes: [
        "CRD ordering declaration: the six CRDs are established before the two Queue objects, the SchedulingShard and the operator, from the packaged CRD bundle",
        configRoute,
        ...(old
          ? []
          : ["pre-install and pre-upgrade lifecycle action for the CRD upgrader Job and the topology migration Job, recorded in the package and not yet run"]),
        ...(postDelete ? ["post-delete lifecycle action for the cleanup Job, recorded in the package and not yet run"] : []),
        "prune protection for the keep-annotated Namespace, Queues and SchedulingShard; not packaged",
      ],
      rationale,
      variantScope,
    });
  const scope = (postDelete) => [
    postDelete
      ? { values: "postCleanup.enabled false", effect: "the post-delete cleanup hook leaves the render; the AICR values set this" }
      : { values: "postCleanup.enabled true (the default base)", effect: "adds the post-delete cleanup Job with its ServiceAccount, ClusterRole and ClusterRoleBinding" },
    {
      values: "global.clusterAutoscaling true",
      effect: "adds a second lookup-gated Namespace for the scaling pod; that base needs a fresh verdict",
    },
    {
      values: "a render against a live cluster, or on OpenShift",
      effect: "the lookups answer differently: an existing kai-resource-reservation Namespace and ServiceAccount leave the render, and OpenShift adds SecurityContextConstraints and changes the hook Jobs' security contexts",
    },
  ];
  const lead = `Hand read of the chart against this base's render. No Secret and no webhook configuration renders, and nothing is generated at render time. Three things make this a flatten with routes and not a plain flatten. The operator does nothing until a Config object exists, and ${configDelivery}, so a base alone installs an operator that deploys no scheduler. The chart asks the cluster three questions with lookup, and the base holds the offline answers. And four objects are keep-annotated, which a flattened delete does not honour. The hook objects are packaged as lifecycle actions and the CRDs as a bundle, so the lane names companions that exist in the package, except prune protection, which does not. ${notRun} Whether the Config belongs in the base instead is recorded as an open question on the entry.`;
  return [
    one("default", { postDelete: true, values: "chart defaults", rationale: lead, variantScope: scope(true) }),
    one("aicr-eks-training", {
      postDelete: false,
      values: "these values",
      rationale: `${lead} This base uses the values the AICR ${old ? "v0.20.0" : "v1.0.0"} EKS training entry supplies. Against the default base it adds no object and removes none, and changes only the kai-operator Deployment; the values turn the post-delete cleanup hook off. ${old ? "The objects equal the AICR nested render of the same archive once its ten hook objects are set aside." : "The AICR v1.0.0 entry retains these values and no render of this component, so this base was not compared with an AICR render."}`,
      variantScope: scope(false),
    }),
  ];
}

// ---------------------------------------------------------------------------
// nodewright
// ---------------------------------------------------------------------------

function nodewrightRows(version) {
  const old = version === "v0.17.1";
  const crds = old ? "two" : "four";
  const namespace = old ? "skyhook" : "nodewright";
  const one = (base, { rationale }) =>
    row("nvidia", "nodewright", version, base, {
      overrides: {
        "helm-hooks": {
          detail:
            "this base's values render six hook objects and none is in the base: a pre-upgrade Job that deletes the controller-manager Deployment when its immutable selector would change, with a ServiceAccount, Role and RoleBinding, and two pre-delete Jobs, one that deletes every custom resource of the operator's kinds and one that removes the webhook configurations and the certificate Secret",
          disposition:
            "packaged lifecycle actions under prerequisites/nodewright-lifecycle, each marked not automatic; none has been run on a cluster",
        },
        ...(old
          ? {}
          : {
              "resource-policy-keep": {
                detail:
                  "two of the four CRDs in the base, nodewrights.nodewright.nvidia.com and deploymentpolicies.nodewright.nvidia.com, carry helm.sh/resource-policy: keep. Helm leaves them on uninstall; a flattened delete removes them and every custom resource they hold",
                disposition: "named companion required: prune protection for the two keep-annotated CRDs; none is packaged",
              },
            }),
        "webhook-ca": {
          detail:
            "a MutatingWebhookConfiguration and a ValidatingWebhookConfiguration render in this base with failurePolicy Fail and no caBundle, and no template supplies one. The operator mints a self-signed certificate at run time, stores it in a Secret named webhook-cert that is not in the base, and writes the CA into both configurations. Nothing is generated at render time",
          disposition:
            "certificate route run by the operator itself once it starts; read from the chart's templates and not observed. A delivery that applies the base again must not strip the CA bundle the operator wrote",
        },
        "crd-ordering": {
          detail: `${crds} CRDs render in this base, from the chart's templates directory; no object in the base is an instance of them`,
          disposition: crdBundle,
        },
        "immutable-fields": {
          detail:
            "cross-version property; see boundedness. The chart itself ships the pre-upgrade Job because the controller-manager Deployment's selector is immutable and has changed between chart versions",
        },
      },
      lane: "flatten-with-routes",
      routes: [
        `CRD ordering declaration: the ${crds} CRDs are established before the operator starts, from the packaged CRD bundle`,
        "pre-upgrade lifecycle action that deletes the operator Deployment when its selector would change, recorded in the package and not yet run",
        "pre-delete lifecycle actions that delete the custom resources and the webhook configurations while the operator still runs, recorded in the package and not yet run",
        "webhook certificate route run by the operator at run time; not observed",
        ...(old ? [] : ["prune protection for the two keep-annotated CRDs; not packaged"]),
      ],
      rationale,
      variantScope: [
        {
          values: "webhook.enable false",
          effect: "both webhook configurations and the pre-delete webhook cleanup Job leave the render, and with them the certificate route",
        },
        {
          values: "fullnameOverride",
          effect: "renames most objects and moves no finding; the AICR base sets it to skyhook-operator",
        },
        {
          values: "controllerManager.selectors or tolerations",
          effect: "change where the operator pod runs and move no finding",
        },
      ],
    });
  const lead = `Hand read of the chart against this base's render, as release nodewright-operator in namespace ${namespace}. Nothing is decided at render time: the chart has no lookup, no capability branch, no generated value and no subchart, and no Secret renders. What flattening drops is the six hook objects, and what it needs is the CRDs before the operator and a certificate the operator writes for itself after it starts. Until then the webhooks, which fail closed, reject writes to the operator's custom resources. The hook objects are packaged as lifecycle actions and the CRDs as a bundle, so the lane names companions that exist in the package${old ? "" : ", except prune protection for the two keep-annotated CRDs, which does not"}. ${notRun} The PodDisruptionBudget carries no namespace, so a flattened copy must be applied into ${namespace}; that is a precondition, not a route.`;
  return [
    one("default", { rationale: lead }),
    one("aicr-eks-training", {
      rationale: `${lead} This base uses the values the AICR ${old ? "v0.20.0" : "v1.0.0"} EKS training entry supplies. They set fullnameOverride to skyhook-operator, which renames most objects, and add resource settings, tolerations${old ? "" : ", a node selector"} and LimitRange defaults. The base has the same number of objects, the same CRDs and the same hook set as the default base, so the default base's reading carries over. ${old ? "The objects equal the AICR nested render of the same archive once its six hook objects are set aside." : "The AICR v1.0.0 entry retains these values and no render of this component, so this base was not compared with an AICR render."}`,
    }),
  ];
}

// ---------------------------------------------------------------------------
// dra-driver-nvidia-gpu
// ---------------------------------------------------------------------------

function draRows(version) {
  const aicrRelease = version === "0.4.1" ? "v0.20.0" : "v1.0.0";
  const one = (base, { deviceClasses, rationale, variantScope }) =>
    row("dra-driver-nvidia", "dra-driver-nvidia-gpu", version, base, {
      overrides: {
        "webhook-ca": {
          finding: "present-gated",
          detail:
            "the chart's ValidatingWebhookConfiguration, with its cert-manager or user-supplied certificate, renders only when webhook.enabled is true, which these values leave false. The base renders a ValidatingAdmissionPolicy and its binding instead, which need no certificate",
          disposition: noRoute,
        },
        "capabilities-api-versions": {
          detail: `the chart picks the resource.k8s.io version of its ${deviceClasses} DeviceClass objects from the API versions the render reports, newest first, and resourceApiVersion is left empty. An offline Helm render reports resource.k8s.io/v1 whatever --kube-version says, so the base holds v1 objects, which Kubernetes serves from 1.34 although the chart accepts 1.32. A second branch adds OpenShift RBAC when the cluster reports SecurityContextConstraints, which an offline render does not`,
          disposition:
            "render inputs pin Kubernetes 1.34.0 and the base's target facts say the target must serve resource.k8s.io/v1; a cluster that serves only v1beta1 or v1beta2 needs its own render",
        },
        "crd-ordering": {
          detail: "two resource.nvidia.com CRDs render in this base, from the chart's crds directory; no object in the base is an instance of them",
          disposition: crdBundle,
        },
      },
      lane: "flatten-with-routes",
      routes: [
        "CRD ordering declaration: the two resource.nvidia.com CRDs are established before the controller starts, from the packaged CRD bundle",
      ],
      rationale,
      variantScope,
    });
  const scope = (gpus) => [
    gpus
      ? {
          values: "resources.gpus.enabled false (the default base)",
          effect: "the three GPU DeviceClass objects leave the render and the kubelet plugin stops publishing GPUs; the driver may then share a node with the standard GPU device plugin",
        }
      : {
          values: "gpuResourcesEnabledOverride true with resources.gpus.enabled true (the gpu-resources base)",
          effect: "adds three DeviceClass objects for GPUs, MIG devices and VFIO GPUs and changes the kubelet plugin DaemonSet; the driver must then not share a node with the standard GPU device plugin",
        },
    {
      values: "resourceApiVersion set",
      effect: "the DeviceClass objects render at that resource.k8s.io version instead of v1; the finding set does not move",
    },
    {
      values: "webhook.enabled true",
      effect:
        "adds a ValidatingWebhookConfiguration, a webhook Deployment and Service, and either cert-manager objects or a Secret reference; that base needs its own verdict",
    },
  ];
  const lead =
    "Hand read of the chart against this base's render. The chart has no hook, no lookup, no generated value, no keep annotation, no Namespace template and no subchart, and no Secret renders. One thing is decided at render time: the resource.k8s.io version of the DeviceClass objects, which follows the render's capability set and is v1 here. So the companions are the two CRDs before the controller, and a target that serves resource.k8s.io/v1, recorded as a target fact. The kubelet plugin also needs NVIDIA drivers on the node, which this chart does not install.";
  return [
    one("default", {
      deviceClasses: "two",
      rationale: `${lead} The chart refuses to render its own defaults: it stops while resources.gpus.enabled is true and gpuResourcesEnabledOverride is false. This base sets resources.gpus.enabled false, so the driver serves ComputeDomains only and publishes no GPU. Whether that is the right default base is recorded as an open question on the entry.`,
      variantScope: scope(false),
    }),
    one("gpu-resources", {
      deviceClasses: "five",
      rationale: `${lead} This base sets gpuResourcesEnabledOverride true, the switch the chart requires before it renders with GPU allocation on. Against the default base it adds three DeviceClass objects and changes the kubelet plugin DaemonSet; the proof checks the added set. The chart says the driver must then not share a node with the standard GPU device plugin. Nothing in the base checks that.`,
      variantScope: scope(true),
    }),
    one("aicr-eks-training", {
      deviceClasses: "two",
      rationale: `${lead} This base uses the values the AICR ${aicrRelease} EKS training entry supplies. Like the default base it has resources.gpus.enabled false and gpuResourcesEnabledOverride false. The values also rename the objects, point the driver root at /run/nvidia/driver, select the kubelet plugin onto GPU nodes and add tolerations and annotations; none reaches a hazard. ${version === "0.4.1" ? "The objects equal the AICR nested render of the same archive." : "The AICR v1.0.0 entry retains these values and no render of this component, so this base was not compared with an AICR render."}`,
      variantScope: scope(false),
    }),
  ];
}

// ---------------------------------------------------------------------------
// kubeflow-trainer
// ---------------------------------------------------------------------------

function trainerRows() {
  const one = (base, rationale) =>
    row("kubeflow", "kubeflow-trainer", "2.2.0", base, {
      overrides: {
        "webhook-ca": {
          detail:
            "four webhook configurations render in this base, a mutating and a validating one for the trainer and for JobSet, with no caBundle. Two Secrets, kubeflow-trainer-webhook-cert and jobset-webhook-server-cert, render with four empty data keys each. Each controller generates its certificate at run time, writes it into its Secret and writes the CA into its configurations. Nothing is generated at render time. The other two webhook configurations in the archive belong to the lws subchart, which is off",
          disposition:
            "certificate route run by the two controllers once they start; read from the chart and not observed. The two Secrets must be created once and their data must not be overwritten by a later apply of the base",
        },
        "generated-secrets": {
          finding: "present",
          detail:
            "no template generates a value at render time, and the witness finds none. The base still renders two Secrets, kubeflow-trainer-webhook-cert and jobset-webhook-server-cert, each with the keys ca.crt, ca.key, tls.crt and tls.key present and empty. Their contents are generated at run time by the two controllers, so the Secrets are run-time state that the base only creates",
          disposition:
            "named companion required: the two Secrets are created once and then owned by the controllers, so a later apply of the base must not overwrite their data; no such protection is packaged, and it was not observed",
        },
        "capabilities-api-versions": {
          finding: "present-gated",
          detail:
            "the one capability check is in the JobSet subchart's ServiceMonitor template, which renders only when jobset.prometheus.enable is true; these values leave it false",
          disposition: noRoute,
        },
        "crd-ordering": {
          detail:
            "four CRDs render in this base, three from the chart's crds directory and the JobSet CRD from its subchart; no object in the base is an instance of them. The fifth CRD in the archive belongs to the lws subchart, which is off",
          disposition: crdBundle,
        },
        "subchart-conditions": {
          disposition:
            "the flatten step must render with the audited base's condition set: jobset.install true, which brings in the JobSet controller, and dataCache.enabled false, which leaves lws out",
        },
      },
      lane: "flatten-with-routes",
      routes: [
        "CRD ordering declaration: the four CRDs are established before the two controllers start, from the packaged CRD bundle",
        "webhook certificate route run by the trainer and JobSet controllers at run time, into two Secrets the base creates empty; not observed",
      ],
      rationale,
      variantScope: [
        {
          values: "jobset.install false",
          effect: "the JobSet controller, its CRD, webhooks and certificate Secret leave the render; the target must then run JobSet itself",
        },
        {
          values: "dataCache.enabled true",
          effect: "brings in the lws subchart with its own CRD and webhooks, and the data cache runtime; that base needs its own verdict",
        },
        {
          values: "runtimes.defaultEnabled true",
          effect: "adds ClusterTrainingRuntime objects, instances of a CRD in the base, which strengthens the CRD ordering requirement",
        },
        {
          values: "jobset.prometheus.enable true",
          effect: "the JobSet subchart fails the render unless the capability set reports the ServiceMonitor API, which an offline render does not",
        },
      ],
    });
  const lead =
    "Hand read of the chart against this base's render. The chart has no hook, no lookup, no generated value, no keep annotation and no Namespace template. What flattening needs is the four CRDs before the two controllers, and the controllers' own certificates: the base creates two Secrets empty and four webhook configurations with no CA, and each controller fills them in after it starts. The trainer webhooks fail closed, so until then TrainJob and runtime writes are rejected. The hazard a flattened delivery adds is the second apply: the Secrets are in the base with empty data, and a delivery that overwrites them erases the certificates. Whether a given delivery path does that was not observed, and it is recorded as an open question on the entry.";
  return [
    one("default", lead),
    one(
      "aicr-eks-training-v0-20-0",
      `${lead} This base uses the values the AICR v0.20.0 EKS training entry supplies. Against the default base it adds no object and removes none, and changes only the two controller Deployments. Several keys in those values are not defined in the chart's values.yaml. The objects equal the AICR nested render of the same archive.`,
    ),
    one(
      "aicr-eks-training-v1-0-0",
      `${lead} This base uses the values the AICR v1.0.0 EKS training entry supplies. Against the default base it adds no object and removes none, and changes only the two controller Deployments. The AICR v1.0.0 entry retains these values and no render of this component, so this base was not compared with an AICR render.`,
    ),
  ];
}

// ---------------------------------------------------------------------------
// node-feature-discovery
// ---------------------------------------------------------------------------

function nodeFeatureDiscoveryRows() {
  const one = (base, { crds, rationale }) =>
    row("node-feature-discovery", "node-feature-discovery", "0.19.0", base, {
      overrides: {
        "helm-hooks": {
          detail:
            "four post-delete hook objects render with this base's values and none is in the base: the prune Job, which runs nfd-master -prune, with its ServiceAccount, ClusterRole and ClusterRoleBinding. The Job removes the labels, annotations, taints and extended resources NFD put on every node",
          disposition:
            "packaged lifecycle action under prerequisites/node-feature-discovery-lifecycle, marked not automatic; it has not been run on a cluster. A delete that skips it leaves the node labels in place",
        },
        "crd-ordering": {
          detail: `${crds} CRDs render in this base and no object in the base is an instance of them. The master reads NodeFeatureRule objects and the workers write NodeFeature objects as soon as they start`,
          disposition: crdBundle,
        },
      },
      lane: "flatten-with-routes",
      routes: [
        `CRD ordering declaration: the ${crds} CRDs are established before the master and the workers start, from the packaged CRD bundle`,
        "post-delete lifecycle action that runs the prune Job, recorded in the package and not yet run",
      ],
      rationale,
      variantScope: [
        {
          values: "postDeleteCleanup false",
          effect: "the four prune hook objects leave the render and with them the post-delete route; node labels then stay on a delete",
        },
        {
          values: "topologyUpdater.enable and topologyUpdater.createCRDs",
          effect: "add the topology updater DaemonSet with its ServiceAccount, ClusterRole, ClusterRoleBinding and ConfigMap, and the fourth CRD, noderesourcetopologies.topology.node.k8s.io",
        },
        {
          values: "master.nodeSelector, gc.nodeSelector and tolerations",
          effect: "change where the pods run and move no finding",
        },
      ],
    });
  const lead =
    "Hand read of the chart against this base's render, as release nfd in namespace node-feature-discovery. The packaged chart has no lookup, no capability branch, no generated value, no keep annotation, no webhook, no Namespace template and no subchart, and the render agrees: no Secret and no Job. Nothing is decided at render time. What flattening drops is the four post-delete hook objects, and what it needs is the CRDs applied before the master and the workers start. The namespace is named on the namespaced objects and no Namespace object is rendered, so it must exist before the base is applied. The worker (and the topology updater, where it renders) reads the host through hostPath mounts; that is the chart's design and moves no flattening finding.";
  const aicr = (old) =>
    `${lead} This base uses the values the AICR ${old ? "v0.20.0" : "v1.0.0"} EKS training entry supplies. Against the default base it adds the topology updater (a DaemonSet, a ServiceAccount, a ClusterRole, a ClusterRoleBinding, a ConfigMap and the noderesourcetopologies CRD, which comes from a chart template and not from the crds directory), gives the worker and the garbage collector a tolerate-everything toleration and gives the master the same in place of the control-plane toleration. ${
      old
        ? "The base renders 23 objects."
        : "It renders the same 23 objects as the v0.20.0 base and adds a nodeGroup: system-worker node selector to the master and the garbage collector."
    }`;
  return [
    one("default", {
      crds: "three",
      rationale: `${lead} The base renders 17 objects: 3 CustomResourceDefinitions, 3 ServiceAccounts, 2 ConfigMaps, 2 ClusterRoles, 2 ClusterRoleBindings, 1 Role, 1 RoleBinding, 1 DaemonSet and 2 Deployments.`,
    }),
    one("aicr-eks-training-v0-20-0", { crds: "four", rationale: aicr(true) }),
    one("aicr-eks-training-v1-0-0", { crds: "four", rationale: aicr(false) }),
  ];
}

// ---------------------------------------------------------------------------
// aws-efa-k8s-device-plugin
// ---------------------------------------------------------------------------

function awsEfaRows() {
  const one = (base, rationale) =>
    row("eks", "aws-efa-k8s-device-plugin", "v0.5.29", base, {
      overrides: {},
      lane: "safe-to-flatten",
      routes: [],
      rationale,
      variantScope: [
        {
          values: "securityContext, nodeSelector, tolerations and supportedInstanceLabels",
          effect: "change how privileged the pod is and which nodes it lands on; the finding set does not move",
        },
        {
          values: "image.repository and image.tag",
          effect: "the image is in a regional Amazon ECR registry; another region or another cloud needs the reference changed",
        },
      ],
    });
  const lead =
    "Hand read of the chart against this base's render. The packaged chart has one template that renders an object, a DaemonSet, and it has no hook, no lookup, no capability branch, no generated value, no keep annotation, no webhook, no CRD, no Namespace template and no subchart. The render agrees: one DaemonSet, no Secret, no Job and no RBAC. Nothing is decided at render time. The DaemonSet carries no metadata.namespace because the template leaves it to Helm, so the delivery must apply it into kube-system; that is recorded as a precondition, not a route. The pod runs on the host network and mounts the kubelet device plugin directory, /dev/infiniband and /opt/aws/neuron from the host, which is the chart's design.";
  return [
    one(
      "default",
      `${lead} This base uses the chart defaults, which run the container privileged as user 0 and allow node affinity over the long list of EFA instance types in the chart.`,
    ),
    one(
      "aicr-eks-training",
      `${lead} This base uses the values both retained AICR EKS training entries supply. They set fullnameOverride to aws-efa-k8s-device-plugin, select the DaemonSet onto nodes labelled nvidia.com/gpu.present, tolerate every taint, match nodes by the nodeGroup and nvidia.com/gpu.present labels instead of the instance type list, and run the container unprivileged with all capabilities dropped. The base has the same one object as the default base.`,
    ),
  ];
}

// ---------------------------------------------------------------------------
// k8s-ephemeral-storage-metrics
// ---------------------------------------------------------------------------

function ephemeralStorageRows() {
  const one = (base, rationale) =>
    row("k8s-ephemeral-storage-metrics", "k8s-ephemeral-storage-metrics", "1.19.2", base, {
      overrides: {},
      lane: "safe-to-flatten",
      routes: [],
      rationale,
      variantScope: [
        {
          values: "prometheus.enable false",
          effect: "removes the ServiceMonitor and with it the Prometheus Operator CRD precondition",
        },
        {
          values: "deploy_type DaemonSet",
          effect: "the workload renders as a DaemonSet instead of a Deployment; the finding set does not move",
        },
      ],
    });
  const lead =
    "Hand read of the chart against this base's render. The packaged chart has no hook, no lookup, no capability branch, no generated value, no keep annotation, no webhook, no CRD, no Namespace template and no subchart, and the render agrees: six objects, no Secret. Nothing is decided at render time. One thing stays outside the bundle and is recorded as a precondition, not a route: the Prometheus Operator ServiceMonitor CRD must exist on the target.";
  return [
    one("default", lead),
    one(
      "aicr-eks-training-v0-20-0",
      `${lead} This base uses the values the AICR v0.20.0 EKS training entry supplies. Against the default base it changes only the Deployment. The objects equal the AICR nested render of the same archive.`,
    ),
    one(
      "aicr-eks-training-v1-0-0",
      `${lead} This base uses the values the AICR v1.0.0 EKS training entry supplies. Against the default base it changes only the Deployment. The AICR v1.0.0 entry retains these values and no render of this component, so this base was not compared with an AICR render.`,
    ),
  ];
}

// ---------------------------------------------------------------------------
// aws-ebs-csi-driver
// ---------------------------------------------------------------------------

function ebsRows() {
  const one = (base, rationale, scope) =>
    row("aws-ebs-csi-driver", "aws-ebs-csi-driver", "2.59.0", base, {
      overrides: {
        "helm-hooks": {
          finding: "present",
          detail: "5 hook occurrence(s) in the packaged chart, all test hooks (values: test)",
          disposition: "pruned from any bundle",
        },
        "capabilities-api-versions": {
          detail:
            "three branches are reached. From Kubernetes 1.33 the chart adds the MutableCSINodeAllocatableCount feature gate to the attacher sidecar and nodeAllocatableUpdatePeriodSeconds to the CSIDriver object; this base is rendered for 1.33.0 and holds both. The snapshot sidecar renders only when the capability set reports the snapshot.storage.k8s.io API, which an offline render does not, so the base has no snapshot sidecar. And the provisioner and resizer sidecars get --feature-gates=VolumeAttributesClass=false unless the capability set reports the VolumeAttributesClass API, which an offline render also does not, so the base turns that feature off",
          disposition:
            "render inputs pin Kubernetes 1.33.0 and an offline capability set; a target older than 1.33, or one that wants the snapshot sidecar or VolumeAttributesClass support, needs its own render",
        },
        "immutable-fields": {
          detail:
            "cross-version property; see boundedness. The base holds a CSIDriver object, whose spec is largely immutable, so moving between chart versions that change it means deleting and recreating that object",
        },
      },
      lane: "safe-to-flatten",
      routes: [],
      rationale,
      variantScope: scope,
    });
  const scope = (aicr) => [
    aicr
      ? { values: "defaultStorageClass.enabled false (the default base)", effect: "the default StorageClass leaves the render" }
      : {
          values: "defaultStorageClass.enabled true",
          effect: "adds a StorageClass annotated as the cluster default; the AICR bases set this",
        },
    aicr
      ? { values: "node.enableWindows true (the default base)", effect: "adds the Windows node DaemonSet" }
      : { values: "node.enableWindows false", effect: "removes the Windows node DaemonSet; the AICR bases set this" },
    {
      values: "sidecars.snapshotter.forceEnable true",
      effect: "adds the snapshot sidecar without asking the capability set, and with it a dependency on the external snapshot CRDs",
    },
  ];
  const lead =
    "Hand read of the chart against this base's render. The packaged chart has no lookup, no generated value, no keep annotation, no webhook, no CRD, no Namespace template and no subchart, and its only hooks are helm test Pods, which no base holds. No Secret renders. What is decided at render time is the Kubernetes version and the capability set: the base is the render for 1.33.0 and later with no snapshot sidecar and with VolumeAttributesClass support turned off, as the AICR nested render also is. That is a render input, recorded in the base, not something a companion has to supply. The controller needs AWS permissions the chart does not grant; that is a precondition, not a route.";
  return [
    one("default", lead, scope(false)),
    one(
      "aicr-eks-training-v0-20-0",
      `${lead} This base uses the values the AICR v0.20.0 EKS training entry supplies. Against the default base it adds a default StorageClass, removes the Windows node DaemonSet and changes the controller Deployment and the Linux node DaemonSet; the proof checks the added and removed sets. A cluster that already has a default StorageClass then has two. The objects equal the AICR nested render of the same archive.`,
      scope(true),
    ),
    one(
      "aicr-eks-training-v1-0-0",
      `${lead} This base uses the values the AICR v1.0.0 EKS training entry supplies. Against the default base it adds a default StorageClass, removes the Windows node DaemonSet and changes the controller Deployment and the Linux node DaemonSet; the proof checks the added and removed sets. A cluster that already has a default StorageClass then has two. The AICR v1.0.0 entry retains these values and no render of this component, so this base was not compared with an AICR render.`,
      scope(true),
    ),
  ];
}

// ---------------------------------------------------------------------------
// kube-prometheus-stack
// ---------------------------------------------------------------------------

function kubePrometheusStackRows() {
  const one = (base, { crdsInBase, secretName, password, rationale }) =>
    row("prometheus-community", "kube-prometheus-stack", "84.4.0", base, {
      overrides: {
        "helm-hooks": {
          detail: `this base's values render seven hook objects and none is in the base: an admission-create Job that runs before an install or upgrade and writes a self-signed certificate into the Secret ${secretName}, an admission-patch Job that runs afterwards and writes the CA into the two webhook configurations, and the ServiceAccount, ClusterRole, ClusterRoleBinding, Role and RoleBinding both use. They are not maintenance only: the operator Deployment mounts that Secret and cannot start without it. The hooks of the crds subchart's upgrade Job sit behind crds.upgradeJob.enabled, which is false`,
          disposition:
            "packaged lifecycle actions under prerequisites/kube-prometheus-stack-lifecycle, each marked not automatic; none has been run on a cluster. The hook image is referenced by tag, not by digest",
        },
        lookup: {
          finding: "present-gated",
          detail:
            "all four lookup calls are in the Grafana subchart and none is reached: the admin-password lookup runs only when grafana.adminPassword is empty, and this base sets it; the volume lookup needs persistence.lookupVolumeName, and the image-renderer lookup needs the image renderer, both off",
          disposition: noRoute,
        },
        "webhook-ca": {
          detail:
            "a MutatingWebhookConfiguration and a ValidatingWebhookConfiguration render in this base with failurePolicy Ignore and no caBundle. The admission-patch hook Job is what writes the CA. Until it runs the API server cannot call the webhooks and admits PrometheusRule and AlertmanagerConfig objects unvalidated",
          disposition:
            "certificate route is the two packaged admission lifecycle actions, recorded and not yet run. A delivery that applies the base again can strip the CA bundle, and the patch action must then run again",
        },
        "generated-secrets": {
          finding: "present",
          detail: `nothing is generated at render time: both random-value calls are in the Grafana subchart's lookup-or-generate helpers, and neither is reached, for the same reasons as the lookups. The base still renders two Secrets that carry data, both written from values: the Alertmanager configuration, and the Grafana admin credentials with ${password}`,
          disposition:
            "the two Secrets ship with the base and the installer keeps them apart from the other objects; the Grafana Secret holds a fixed password that anyone who can read this repository knows, so it must be replaced before the base is used for anything real",
        },
        "capabilities-api-versions": {
          detail:
            "the chart and its subcharts read the Kubernetes version and the capability set in many templates, mostly to choose which dashboards and rules render and which API versions optional objects use. This base is rendered for Kubernetes 1.30.0, the version every other Catalog version of this chart uses",
          disposition: "render inputs pin Kubernetes 1.30.0; recorded in the base",
        },
        "crd-ordering": crdsInBase
          ? {
              detail:
                "ten Prometheus Operator CRDs render in this base beside 50 objects that are instances of four of them: a Prometheus, an Alertmanager, 35 PrometheusRule objects and 13 ServiceMonitors",
              disposition: crdBundle,
            }
          : {
              finding: "present-gated",
              detail:
                "the ten Prometheus Operator CRDs are in the crds subchart, which crds.enabled false leaves out, so this base holds none. It still holds 50 instances of four of them, so the CRDs must be on the target first; the AICR entries install prometheus-operator-crds 28.0.1 for that",
              disposition:
                "ordering declaration ships with the bundle: the base's target facts name the ten CRDs and the package carries a copy of them from the prometheus-operator-crds 28.0.1 entry",
            },
        "subchart-conditions": {
          disposition: crdsInBase
            ? "the flatten step must render with the audited base's condition set: crds, kube-state-metrics, the node exporter and Grafana on, the Windows exporter off"
            : "the flatten step must render with the audited base's condition set: kube-state-metrics, the node exporter and Grafana on, crds and the Windows exporter off",
        },
      },
      lane: "flatten-with-routes",
      routes: [
        crdsInBase
          ? "CRD ordering declaration: the ten Prometheus Operator CRDs are established before the 50 custom resources in the base, from the packaged CRD bundle"
          : "CRD ordering declaration: the ten Prometheus Operator CRDs are on the target before the 50 custom resources in the base, from the packaged copy of the prometheus-operator-crds 28.0.1 CRDs",
        `pre-install and pre-upgrade lifecycle action that creates the admission Secret ${secretName}, with the RBAC it runs under; required on a first install, recorded in the package and not yet run`,
        "post-install and post-upgrade lifecycle action that writes the CA into the two webhook configurations, recorded in the package and not yet run",
      ],
      rationale,
      variantScope: [
        {
          values: "grafana.adminPassword empty",
          effect: "the Grafana subchart looks the Secret up and otherwise generates a random password, so the render is no longer repeatable; that base is unsafe to flatten",
        },
        {
          values: "grafana.admin.existingSecret set",
          effect: "the Grafana Secret leaves the render and the credentials come from a Secret the target owns; the later Catalog versions of this chart offer that as the existing-secret base",
        },
        crdsInBase
          ? { values: "crds.enabled false", effect: "the ten CRDs leave the render and must already be on the target; the AICR bases set this" }
          : { values: "crds.enabled true (the default base)", effect: "the ten CRDs render in the base" },
        {
          values: "prometheusOperator.admissionWebhooks.certManager.enabled true",
          effect: "cert-manager issues the webhook certificate and injects the CA, and the seven hook objects leave the render; that base needs its own verdict",
        },
        {
          values: "prometheusOperator.admissionWebhooks.enabled false",
          effect: "both webhook configurations and the seven hook objects leave the render; that base needs its own verdict",
        },
      ],
    });
  const lead =
    "Hand read of the chart against this base's render. The other Catalog versions of this chart carry a mechanical verdict of unsafe to flatten, because the archive calls lookup and no base was read against it. This read finds every lookup and every random value in the Grafana subchart, behind switches this base does not set, so nothing is looked up or generated at render time. What flattening drops is the seven admission hook objects, and they matter at install: the operator cannot start until the first Job has created its Secret. What it needs besides is the ten CRDs before the 50 custom resources. The hook objects are packaged as lifecycle actions and the CRDs as a bundle, so the lane names companions that exist in the package.";
  const routeQuestion =
    "The later versions carry a packaged, scripted admission route with the hook image pinned by digest; this version does not, and whether it should is recorded as an open question on the entry.";
  return [
    one("default", {
      crdsInBase: true,
      secretName: "kube-prometheus-stack-admission",
      password: "a placeholder password",
      rationale: `${lead} ${notRun} ${routeQuestion} The Grafana admin password is bound to a placeholder, as in the other Catalog versions, because chart defaults generate a random one on every render.`,
    }),
    ...[
      ["aicr-eks-training-v0-20-0", "v0.20.0", "The objects equal the AICR nested render of the same archive once its seven hook objects are set aside."],
      ["aicr-eks-training-v1-0-0", "v1.0.0", "The AICR v1.0.0 entry retains these values and no render of this component, so this base was not compared with an AICR render."],
    ].map(([base, release, compared]) =>
      one(base, {
        crdsInBase: false,
        secretName: "kube-prometheus-admission",
        password: "the literal password admin",
        rationale: `${lead} ${notRun} ${routeQuestion} This base uses the values the AICR ${release} EKS training entry supplies. They turn the chart's CRDs off, rename most objects with fullnameOverride, and set the Grafana admin password to the literal value admin, which the base carries in a Secret; whether a Catalog base should is a second open question. ${compared}`,
      }),
    ),
  ];
}

// ---------------------------------------------------------------------------
// prometheus-operator-crds
// ---------------------------------------------------------------------------

function prometheusOperatorCRDRows() {
  const one = (base, rationale) =>
    row("prometheus-community", "prometheus-operator-crds", "28.0.1", base, {
      overrides: {
        "crd-ordering": {
          detail: "ten Prometheus Operator CRDs render in this base, from the templates of the vendored crds subchart, and nothing else; no object in the base is an instance of them",
          disposition: "ordering declaration ships with the bundle",
        },
      },
      lane: "flatten-with-routes",
      routes: ["CRD ordering declaration for the 10 definition(s) this base renders"],
      rationale,
      variantScope: [
        {
          values: "crds.<name>.enabled false",
          effect: "that CRD leaves the render; anything on the target that uses it must get it from somewhere else",
        },
      ],
    });
  const lead =
    "Hand read of the chart against this base's render. The packaged chart has no hook, no lookup, no capability branch, no generated value, no keep annotation, no webhook and no Namespace template, and the base is ten CRDs and nothing else. The definitions are the only construct needing a companion: whatever uses them, such as the kube-prometheus-stack 84.4.0 AICR bases, must be applied after they are established. Deleting the delivered objects deletes the CRDs and every custom resource of these kinds; that is a property of the entry, not of flattening.";
  return [
    one("default", lead),
    one(
      "aicr-eks-training",
      `${lead} This base uses the values both retained AICR EKS training entries supply: one key, enabled: true, which the chart does not read. The render equals the default base object for object, and the proof checks that. It also equals the AICR v0.20.0 nested render of the same archive.`,
    ),
  ];
}

export function aicrNestedChartVerdicts() {
  return [
    ...kaiRows("v0.14.1"),
    ...kaiRows("v0.16.9"),
    ...nodewrightRows("v0.17.1"),
    ...nodewrightRows("v0.19.0"),
    ...draRows("0.4.1"),
    ...draRows("0.5.0"),
    ...trainerRows(),
    ...nodeFeatureDiscoveryRows(),
    ...awsEfaRows(),
    ...ephemeralStorageRows(),
    ...ebsRows(),
    ...kubePrometheusStackRows(),
    ...prometheusOperatorCRDRows(),
  ];
}
