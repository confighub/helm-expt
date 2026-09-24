import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { check, labelsMatch, parseDocs } from "./lib/proof-common.mjs";

const release = "kube-prometheus-stack";
const namespace = "monitoring";
const appName = "candidate-metrics-app";
const selfMonitorNames = new Set(["kube-prometheus-stack-operator", "kube-prometheus-stack-prometheus"]);
const requiredCrds = new Set([
  "alertmanagerconfigs.monitoring.coreos.com", "alertmanagers.monitoring.coreos.com", "podmonitors.monitoring.coreos.com",
  "probes.monitoring.coreos.com", "prometheusagents.monitoring.coreos.com", "prometheuses.monitoring.coreos.com",
  "prometheusrules.monitoring.coreos.com", "scrapeconfigs.monitoring.coreos.com", "servicemonitors.monitoring.coreos.com",
  "thanosrulers.monitoring.coreos.com",
]);

function named(docs, kind, name, objectNamespace = namespace) {
  return docs.find((doc) => doc.kind === kind && doc.metadata?.name === name && (objectNamespace === null || doc.metadata?.namespace === objectNamespace));
}

function noDisabledComponent(docs, name, kind) {
  check(!docs.some((doc) => (kind ? doc.kind === kind : true) && `${doc.metadata?.name ?? ""} ${JSON.stringify(doc.metadata?.labels ?? {})}`.toLowerCase().includes(name)), `minimal profile must not render ${name}`);
}

function matchLabelsOnly(selector, labels, description) {
  check(selector && typeof selector === "object" && !Array.isArray(selector), `${description} must be an object`);
  check(Object.keys(selector).length === 1 && Object.hasOwn(selector, "matchLabels"), `${description} uses an unsupported selector`);
  check(selector.matchLabels && typeof selector.matchLabels === "object" && !Array.isArray(selector.matchLabels), `${description} must use matchLabels`);
  check(Object.keys(selector.matchLabels).length > 0, `${description} must not be empty`);
  check(Object.values(selector.matchLabels).every((value) => typeof value === "string"), `${description} matchLabels values must be strings`);
  return labelsMatch(selector.matchLabels, labels);
}

function nonEmptyLabelMap(selector, labels, description) {
  check(selector && typeof selector === "object" && !Array.isArray(selector), `${description} must be a label map`);
  check(Object.keys(selector).length > 0, `${description} must not be empty`);
  check(Object.values(selector).every((value) => typeof value === "string"), `${description} values must be strings`);
  return labelsMatch(selector, labels);
}

function prometheusNamespaceSelectorIncludes(selector, expectedNamespace, prometheusNamespace, docs) {
  if (selector === null || selector === undefined) return expectedNamespace === prometheusNamespace;
  check(selector && typeof selector === "object" && !Array.isArray(selector), "Prometheus ServiceMonitor namespace selector must be an object");
  if (Object.keys(selector).length === 0) return true;
  check(Object.keys(selector).length === 1 && Object.hasOwn(selector, "matchLabels"), "Prometheus ServiceMonitor namespace selector uses an unsupported selector");
  const targetNamespace = named(docs, "Namespace", expectedNamespace, null);
  check(targetNamespace, `Prometheus ServiceMonitor namespace selector needs Namespace ${expectedNamespace} labels`);
  return matchLabelsOnly(selector, targetNamespace.metadata?.labels, "Prometheus ServiceMonitor namespace selector");
}

function serviceMonitorNamespaceSelectorIncludes(selector, expectedNamespace, monitorNamespace) {
  if (selector === null || selector === undefined) return expectedNamespace === monitorNamespace;
  check(selector && typeof selector === "object" && !Array.isArray(selector), "ServiceMonitor namespace selector must be an object");
  if (Object.keys(selector).length === 1 && selector.any === true) return true;
  if (Object.keys(selector).length === 1 && Array.isArray(selector.matchNames)) {
    check(selector.matchNames.length > 0 && selector.matchNames.every((name) => typeof name === "string"), "ServiceMonitor namespace selector matchNames must be nonempty strings");
    return selector.matchNames.includes(expectedNamespace);
  }
  throw new Error("ServiceMonitor namespace selector uses an unsupported selector");
}

export function verifyPrometheusOperatorMinimal(docs) {
  const crdNames = docs.filter((doc) => doc.kind === "CustomResourceDefinition").map((doc) => doc.metadata?.name);
  check(crdNames.length === requiredCrds.size, `expected ${requiredCrds.size} Prometheus Operator CRDs, found ${crdNames.length}`);
  check(new Set(crdNames).size === requiredCrds.size && crdNames.every((name) => requiredCrds.has(name)), "rendered CRDs must be the unique 10 Prometheus Operator CRDs");

  const operator = named(docs, "Deployment", "kube-prometheus-stack-operator");
  check(operator, "missing Prometheus Operator Deployment");
  const prometheus = named(docs, "Prometheus", "kube-prometheus-stack-prometheus");
  check(prometheus, "missing Prometheus custom resource");
  for (const jobName of ["kube-prometheus-stack-admission-create", "kube-prometheus-stack-admission-patch"]) {
    const job = named(docs, "Job", jobName);
    check(job, `missing admission lifecycle Job ${jobName}`);
    check(job.metadata?.annotations?.["helm.sh/hook"], `${jobName} must retain Helm hook evidence`);
  }
  for (const kind of ["MutatingWebhookConfiguration", "ValidatingWebhookConfiguration"]) check(named(docs, kind, "kube-prometheus-stack-admission", null), `missing ${kind}`);
  noDisabledComponent(docs, "grafana");
  noDisabledComponent(docs, "alertmanager", "Alertmanager");
  noDisabledComponent(docs, "kube-state-metrics");
  noDisabledComponent(docs, "node-exporter");
  check(!docs.some((doc) => doc.kind === "PrometheusRule"), "minimal profile must not render default rules");

  const serviceMonitors = docs.filter((doc) => doc.kind === "ServiceMonitor");
  const serviceMonitorNames = new Set(serviceMonitors.map((doc) => doc.metadata?.name));
  check(serviceMonitors.length === 3 && serviceMonitorNames.size === 3, "minimal profile must render the two self-monitors and candidate application ServiceMonitor");
  check([...selfMonitorNames, appName].every((name) => serviceMonitorNames.has(name)), "rendered ServiceMonitors must be the two self-monitors and candidate application ServiceMonitor");
  const serviceMonitor = serviceMonitors.find((doc) => doc.metadata?.name === appName);
  check(serviceMonitor, "missing candidate application ServiceMonitor");
  check((serviceMonitor.metadata?.labels ?? {}).release === release, "ServiceMonitor must select the release");
  check(matchLabelsOnly(prometheus.spec?.serviceMonitorSelector, serviceMonitor.metadata?.labels, "Prometheus ServiceMonitor selector"), "Prometheus must select the ServiceMonitor");
  check(prometheusNamespaceSelectorIncludes(prometheus.spec?.serviceMonitorNamespaceSelector, serviceMonitor.metadata?.namespace, prometheus.metadata?.namespace, docs), `Prometheus ServiceMonitor namespace selector must include ${serviceMonitor.metadata?.namespace}`);
  check(serviceMonitor.metadata?.namespace === namespace, "candidate application ServiceMonitor must be in monitoring");

  const service = named(docs, "Service", appName);
  const deployment = named(docs, "Deployment", appName);
  check(service, "missing candidate application Service");
  check(deployment, "missing candidate application Deployment");
  check(nonEmptyLabelMap(service.spec?.selector, deployment.spec?.template?.metadata?.labels, "Service selector"), "Service selector must match the Deployment pods");
  check(matchLabelsOnly(deployment.spec?.selector, deployment.spec?.template?.metadata?.labels, "Deployment selector"), "Deployment selector must match its pods");
  check(matchLabelsOnly(serviceMonitor.spec?.selector, service.metadata?.labels, "ServiceMonitor selector"), "ServiceMonitor selector must match the Service labels");
  check(serviceMonitorNamespaceSelectorIncludes(serviceMonitor.spec?.namespaceSelector, service.metadata?.namespace, serviceMonitor.metadata?.namespace), "ServiceMonitor namespace selector must include the Service namespace");
  const containerPortNames = new Set((deployment.spec?.template?.spec?.containers ?? []).flatMap((container) => (container.ports ?? []).map((port) => port.name)).filter(Boolean));
  for (const endpoint of serviceMonitor.spec?.endpoints ?? []) {
    const servicePort = (service.spec?.ports ?? []).find((port) => port.name === endpoint.port);
    check(typeof endpoint.port === "string" && servicePort, "ServiceMonitor endpoint must use a named Service port");
    check(typeof servicePort.targetPort === "string" && containerPortNames.has(servicePort.targetPort), "Service targetPort must resolve to a named container port");
  }
  check((serviceMonitor.spec?.endpoints ?? []).length > 0, "ServiceMonitor must define an endpoint");
  return true;
}

export function verifyPrometheusOperatorMinimalFile(path) {
  return verifyPrometheusOperatorMinimal(parseDocs(readFileSync(path, "utf8")));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  check(process.argv.length === 3, "usage: node scripts/verify-prometheus-operator-minimal.mjs <rendered.yaml>");
  verifyPrometheusOperatorMinimalFile(process.argv[2]);
  console.log("verified static minimal Prometheus Operator selection; no scrape success is claimed");
}
