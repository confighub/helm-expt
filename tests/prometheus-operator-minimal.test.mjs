import assert from "node:assert/strict";
import test from "node:test";

import { verifyPrometheusOperatorMinimal } from "../scripts/verify-prometheus-operator-minimal.mjs";

const release = "kube-prometheus-stack";
const namespace = "monitoring";
const appLabels = { "app.kubernetes.io/name": "candidate-metrics-app", release };

function document(kind, name, spec = {}, metadata = {}) {
  return { apiVersion: "v1", kind, metadata: { name, namespace, ...metadata }, spec };
}

function fixture() {
  const crds = [
    "alertmanagerconfigs.monitoring.coreos.com", "alertmanagers.monitoring.coreos.com", "podmonitors.monitoring.coreos.com",
    "probes.monitoring.coreos.com", "prometheusagents.monitoring.coreos.com", "prometheuses.monitoring.coreos.com",
    "prometheusrules.monitoring.coreos.com", "scrapeconfigs.monitoring.coreos.com", "servicemonitors.monitoring.coreos.com",
    "thanosrulers.monitoring.coreos.com",
  ].map((name) => document("CustomResourceDefinition", name, {}, { namespace: undefined }));
  return [
    ...crds,
    document("Deployment", "kube-prometheus-stack-operator"),
    document("Prometheus", "kube-prometheus-stack-prometheus", { serviceMonitorSelector: { matchLabels: { release } }, serviceMonitorNamespaceSelector: {} }),
    document("Job", "kube-prometheus-stack-admission-create", {}, { annotations: { "helm.sh/hook": "pre-install,pre-upgrade" } }),
    document("Job", "kube-prometheus-stack-admission-patch", {}, { annotations: { "helm.sh/hook": "post-install,post-upgrade" } }),
    document("MutatingWebhookConfiguration", "kube-prometheus-stack-admission", {}, { namespace: undefined }),
    document("ValidatingWebhookConfiguration", "kube-prometheus-stack-admission", {}, { namespace: undefined }),
    document("ServiceMonitor", "kube-prometheus-stack-operator"),
    document("ServiceMonitor", "kube-prometheus-stack-prometheus"),
    document("Deployment", "candidate-metrics-app", {
      selector: { matchLabels: appLabels },
      template: { metadata: { labels: appLabels }, spec: { containers: [{ name: "metrics-app", ports: [{ name: "metrics", containerPort: 8080 }] }] } },
    }),
    document("Service", "candidate-metrics-app", { selector: appLabels, ports: [{ name: "metrics", port: 8080, targetPort: "metrics" }] }, { labels: appLabels }),
    document("ServiceMonitor", "candidate-metrics-app", { selector: { matchLabels: appLabels }, endpoints: [{ port: "metrics" }] }, { labels: { release } }),
  ];
}

test("accepts the static selection with chart self-monitors", () => {
  assert.equal(verifyPrometheusOperatorMinimal(fixture()), true);
});

test("accepts a null Prometheus namespace selector for the Prometheus namespace", () => {
  const docs = fixture();
  docs.find((doc) => doc.kind === "Prometheus").spec.serviceMonitorNamespaceSelector = null;
  assert.equal(verifyPrometheusOperatorMinimal(docs), true);
});

test("accepts a Prometheus namespace label selector when the Namespace labels are supplied", () => {
  const docs = fixture();
  docs.find((doc) => doc.kind === "Prometheus").spec.serviceMonitorNamespaceSelector = { matchLabels: { team: "monitoring" } };
  docs.push(document("Namespace", namespace, {}, { labels: { team: "monitoring" }, namespace: undefined }));
  assert.equal(verifyPrometheusOperatorMinimal(docs), true);
});

test("rejects a ServiceMonitor without the release label", () => {
  const docs = fixture();
  docs.find((doc) => doc.kind === "ServiceMonitor" && doc.metadata.name === "candidate-metrics-app").metadata.labels = {};
  assert.throws(() => verifyPrometheusOperatorMinimal(docs), /ServiceMonitor must select the release/);
});

test("rejects duplicate CRDs", () => {
  const docs = fixture();
  docs.find((doc) => doc.kind === "CustomResourceDefinition").metadata.name = "alertmanagers.monitoring.coreos.com";
  assert.throws(() => verifyPrometheusOperatorMinimal(docs), /unique 10 Prometheus Operator CRDs/);
});

test("rejects an unsupported Prometheus namespace selector", () => {
  const docs = fixture();
  docs.find((doc) => doc.kind === "Prometheus").spec.serviceMonitorNamespaceSelector = { matchNames: [namespace] };
  assert.throws(() => verifyPrometheusOperatorMinimal(docs), /unsupported selector/);
});

test("rejects a ServiceMonitor namespace selector that excludes its Service", () => {
  const docs = fixture();
  docs.find((doc) => doc.kind === "ServiceMonitor" && doc.metadata.name === "candidate-metrics-app").spec.namespaceSelector = { matchNames: ["other"] };
  assert.throws(() => verifyPrometheusOperatorMinimal(docs), /namespace selector must include the Service namespace/);
});

test("rejects a ServiceMonitor endpoint that does not name a Service port", () => {
  const docs = fixture();
  docs.find((doc) => doc.kind === "ServiceMonitor" && doc.metadata.name === "candidate-metrics-app").spec.endpoints[0].port = "wrong";
  assert.throws(() => verifyPrometheusOperatorMinimal(docs), /named Service port/);
});

test("rejects a Service targetPort without a matching named container port", () => {
  const docs = fixture();
  docs.find((doc) => doc.kind === "Service" && doc.metadata.name === "candidate-metrics-app").spec.ports[0].targetPort = "wrong";
  assert.throws(() => verifyPrometheusOperatorMinimal(docs), /targetPort must resolve/);
});

test("rejects a render without the Prometheus Operator", () => {
  const docs = fixture().filter((doc) => !(doc.kind === "Deployment" && doc.metadata.name === "kube-prometheus-stack-operator"));
  assert.throws(() => verifyPrometheusOperatorMinimal(docs), /missing Prometheus Operator Deployment/);
});
