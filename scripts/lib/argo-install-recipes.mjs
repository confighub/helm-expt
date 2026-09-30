const CHART = Object.freeze({
  name: "argo-cd/argo-cd", version: "10.2.1",
  sha256: "27e930e366d22c999002008ad5ec7961bda00410a84287210d0fffbee8150885",
});
const CONTROL_NAMESPACES = new Set(["default", "argocd", "kube-system", "kube-public", "kube-node-lease"]);
const RECIPES = new Set(["demo-in-cluster", "demo-hub", "hardened-in-cluster", "hardened-hub"]);
const text = (value, name) => {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || /[\x00-\x20\x7f]/.test(value)) throw new Error(`${name} must be a non-empty safe string`);
  return value;
};
const exact = (object, keys, name) => {
  if (!object || Array.isArray(object) || typeof object !== "object") throw new Error(`${name} must be an object`);
  for (const key of Object.keys(object)) if (!keys.includes(key)) throw new Error(`${name}.${key} is not allowed`);
};
const url = (value, name, scheme = "https:") => {
  text(value, name);
  let parsed; try { parsed = new URL(value); } catch { throw new Error(`${name} must be a URL`); }
  if (parsed.protocol !== scheme || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash || /[*\[\]{}!]/.test(value)) {
    throw new Error(`${name} must be a credential-free ${scheme} URL without query or fragment`);
  }
  return parsed.toString().replace(/\/$/, "");
};
const name = (value, label) => {
  text(value, label);
  if (value.length > 63 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) throw new Error(`${label} must be a DNS label`);
  return value;
};
const identity = (value, label) => {
  text(value, label);
  if (!/^[A-Za-z0-9._:@/-]+$/.test(value)) throw new Error(`${label} contains unsafe identity characters`);
  return value;
};
function validate(input) {
  exact(input, ["recipe", "target", "teams", "oidc", "ingress", "delivery", "syncWindow"], "input");
  if (!RECIPES.has(input.recipe)) throw new Error("recipe must be one of the four named recipes");
  exact(input.target, ["server", "namespace", "remoteServer"], "target");
  const target = { server: url(input.target.server, "target.server"), namespace: name(input.target.namespace, "target.namespace") };
  const hardened = input.recipe.startsWith("hardened-");
  const hub = input.recipe.endsWith("-hub");
  if (hardened && CONTROL_NAMESPACES.has(target.namespace)) throw new Error("hardened tenant namespace cannot be a control-plane namespace");
  if (hub) {
    target.remoteServer = url(input.target.remoteServer, "target.remoteServer");
    if (target.remoteServer === target.server) throw new Error("hub requires a distinct remote cluster");
  }
  if (!hub && (target.server !== "https://kubernetes.default.svc" || input.target.remoteServer !== undefined)) throw new Error("in-cluster requires the local service address and no remoteServer");
  const teams = input.teams ?? [];
  if (!Array.isArray(teams) || !teams.length) throw new Error("recipes require one or more teams");
  const seen = new Set();
  const checkedTeams = teams.map((team, i) => {
    exact(team, ["name", "repository", "namespace", "developerGroup"], `teams[${i}]`);
    const teamName = name(team.name, `teams[${i}].name`);
    if (teamName.length > 48) throw new Error("team name exceeds project-name limit");
    if (seen.has(teamName)) throw new Error("team names must be unique"); seen.add(teamName);
    const namespace = name(team.namespace, `teams[${i}].namespace`);
    if (hardened && CONTROL_NAMESPACES.has(namespace)) throw new Error("hardened team namespace cannot be a control-plane namespace");
    if (hardened && !team.developerGroup) throw new Error("hardened teams require developerGroup");
    return { name: teamName, repository: url(team.repository, `teams[${i}].repository`), namespace, ...(team.developerGroup ? { developerGroup: identity(team.developerGroup, `teams[${i}].developerGroup`) } : {}) };
  });
  if (hardened && (new Set(checkedTeams.map(t => t.namespace)).size !== checkedTeams.length || checkedTeams.some(t => t.namespace === target.namespace))) throw new Error("hardened tenant destinations must be distinct from one another and platform destinations");
  let oidc, ingress, syncWindow;
  if (hardened) {
    exact(input.oidc, ["issuer", "clientId", "groups"], "oidc"); exact(input.oidc.groups, ["platform", "readonly"], "oidc.groups");
    for (const key of ["platform", "readonly"]) identity(input.oidc.groups[key], `oidc.groups.${key}`);
    oidc = { issuer: url(input.oidc.issuer, "oidc.issuer"), clientId: identity(input.oidc.clientId, "oidc.clientId"), groups: Object.fromEntries(Object.entries(input.oidc.groups).map(([k, v]) => [k, identity(v, `oidc.groups.${k}`)])) };
    if (checkedTeams.some(t => t.developerGroup === oidc.groups.platform) || oidc.groups.readonly === oidc.groups.platform) throw new Error("platform group must be separate from tenant and readonly groups");
    const roleGroups = [oidc.groups.platform, oidc.groups.readonly, ...checkedTeams.map(t => t.developerGroup)];
    if (new Set(roleGroups).size !== roleGroups.length) throw new Error("hardened role groups must be pairwise distinct");
    exact(input.ingress, ["hostname", "tlsSecretRef"], "ingress");
    exact(input.syncWindow, ["schedule", "duration"], "syncWindow");
    if (!/^(?:[0-9*,\/-]+ ){4}[0-9*,\/-]+$/.test(input.syncWindow.schedule) || !/^[1-9][0-9]*(m|h)$/.test(input.syncWindow.duration)) throw new Error("syncWindow requires a five-field cron schedule and positive m/h duration");
    const fields = input.syncWindow.schedule.split(" ");
    const bounds = [[0,59],[0,23],[1,31],[1,12],[0,6]];
    if (fields.some((field,i) => field !== "*" && (!/^\d+$/.test(field) || Number(field) < bounds[i][0] || Number(field) > bounds[i][1]))) throw new Error("syncWindow supports only bounded numeric or wildcard cron fields");
    syncWindow = { kind: "deny", schedule: input.syncWindow.schedule, duration: input.syncWindow.duration, applications: ["*"], manualSync: true };
    ingress = { hostname: (() => { const value = text(input.ingress.hostname, "ingress.hostname"); if (value.length > 253 || !value.split(".").every(label => label.length <= 63 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label))) throw new Error("ingress.hostname must be a hostname"); return value; })(), tlsSecretRef: name(input.ingress.tlsSecretRef, "ingress.tlsSecretRef") };
  } else if (input.oidc || input.ingress || input.syncWindow) throw new Error("demo recipes do not accept hardened identity or ingress facts");
  let delivery;
  if (input.delivery !== undefined) {
    exact(input.delivery, ["gateway", "source", "enableHelm"], "delivery");
    const gateway = url(input.delivery.gateway, "delivery.gateway");
    if (checkedTeams.length !== 1) throw new Error("delivery currently supports exactly one tenant per candidate");
    if (new URL(gateway).pathname !== "/") throw new Error("delivery.gateway must be an origin without a path");
    const source = url(input.delivery.source, "delivery.source", "oci:");
    if (source !== input.delivery.source) throw new Error("delivery.source must use its exact canonical path");
    if (!source.startsWith(`oci://${new URL(gateway).host}/space/`) || !/^\/space\/[a-z0-9][a-z0-9-]*$/.test(new URL(source).pathname)) throw new Error("delivery.source must be one exact ConfigHub oci space under delivery.gateway");
    if (input.delivery.enableHelm !== undefined && typeof input.delivery.enableHelm !== "boolean") throw new Error("delivery.enableHelm must be boolean");
    delivery = { gateway, source, enableHelm: input.delivery.enableHelm === true };
  }
  return { recipe: input.recipe, target, teams: checkedTeams, oidc, ingress, delivery, hardened, hub, syncWindow };
}
const project = (name, sourceRepos, destinations, spec = {}) => ({ apiVersion: "argoproj.io/v1alpha1", kind: "AppProject", metadata: { name, namespace: "argocd" }, spec: { sourceRepos, destinations, ...spec } });
export function buildRecipe(input) {
  const data = validate(input);
  const sourceRepos = data.delivery ? [data.delivery.source] : data.teams.map((team) => team.repository);
  const destinations = [{ server: data.target.server, namespace: data.target.namespace }];
  if (data.hub) destinations.push({ server: data.target.remoteServer, namespace: data.target.namespace });
  const projects = [project("default", [], [])];
  if (data.hardened) {
    projects.push(project("platform-infrastructure", [], destinations, { clusterResourceWhitelist: [{ group: "", kind: "Namespace" }, { group: "rbac.authorization.k8s.io", kind: "ClusterRole" }, { group: "rbac.authorization.k8s.io", kind: "ClusterRoleBinding" }] }));
    for (const team of data.teams) projects.push(project(`team-${team.name}`, data.delivery ? sourceRepos : [team.repository], [{ server: data.target.server, namespace: team.namespace }, ...(data.hub ? [{ server: data.target.remoteServer, namespace: team.namespace }] : [])], { syncWindows: [data.syncWindow], clusterResourceWhitelist: [], clusterResourceBlacklist: [{ group: "*", kind: "*" }], namespaceResourceWhitelist: [{ group: "", kind: "ConfigMap" }, { group: "", kind: "Service" }, { group: "apps", kind: "Deployment" }, { group: "apps", kind: "StatefulSet" }] }));
  } else for (const team of data.teams) projects.push(project(`team-${team.name}`, data.delivery ? sourceRepos : [team.repository], [{ server: data.target.server, namespace: team.namespace }, ...(data.hub ? [{ server: data.target.remoteServer, namespace: team.namespace }] : [])]));
  const values = { configs: {} };
  if (data.hardened) {
    values.configs.cm = { "admin.enabled": "false", url: `https://${data.ingress.hostname}`, "oidc.config": JSON.stringify({ name: "OIDC", issuer: data.oidc.issuer, clientID: data.oidc.clientId, clientSecret: "$argocd-oidc:clientSecret", requestedScopes: ["openid", "profile", "email", "groups"], requestedIDTokenClaims: { groups: { essential: true } } }) };
    const policies = [`g, ${data.oidc.groups.platform}, role:admin`, `g, ${data.oidc.groups.readonly}, role:readonly`];
    for (const team of data.teams) policies.push(`g, ${team.developerGroup}, role:team-${team.name}-developer`, `p, role:team-${team.name}-developer, applications, get, team-${team.name}/*, allow`, `p, role:team-${team.name}-developer, applications, sync, team-${team.name}/*, allow`);
    values.configs.rbac = { "policy.default": "role:readonly", "policy.csv": policies.join("\n") };
    values.configs.params = { "server.log.level": "info", "controller.log.level": "info", "reposerver.log.level": "info" };
    values.server = { ingress: { enabled: true, ingressClassName: "nginx", hostname: data.ingress.hostname, tls: false, annotations: { "nginx.ingress.kubernetes.io/backend-protocol": "HTTPS" }, extraTls: [{ secretName: data.ingress.tlsSecretRef, hosts: [data.ingress.hostname] }] } };
  }
  if (data.delivery?.enableHelm) values.configs.cm = { ...values.configs.cm, "kustomize.buildOptions": "--enable-helm" };
  const prerequisites = { candidateOnly: true, helm: { chart: CHART.name, version: CHART.version, packageSHA256: CHART.sha256 }, prerequisites: ["Render and behavioural verification have not run.", "Create the Argo CD and each team namespace before applying these projects.", ...(data.hardened ? ["Verify the configured deny sync window and manual override behavior. Provide ingress-nginx with TLS, a working IdP and argocd-oidc Secret labeled app.kubernetes.io/part-of=argocd before disabling admin. Readonly grants global read access."] : []), ...(data.hub ? ["Register each remote cluster out of band; cluster credentials are never accepted or emitted."] : []), ...(data.delivery ? ["Create repo-creds and worker/argobot secrets out of band. This generator does not install argobot or emit credentials.", "This candidate is scoped to one tenant. Do not apply a separately generated candidate over a running shared control plane; merge the authoritative project and RBAC definitions first."] : [])] };
  return { values, projects, prerequisites };
}
export { CHART };
