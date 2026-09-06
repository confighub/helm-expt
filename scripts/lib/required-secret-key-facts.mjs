// Derive required Secret keys explicitly selected by pod environments or volume
// items. Whole-Secret imports, image-pull, CSI, and custom-controller requirements
// need separate review: their required keys cannot be inferred from these fields.
import { check } from "./proof-common.mjs";

export function requiredSecretKeyFacts(docs, defaultNamespace) {
  const supplied = new Map(docs.filter((doc) => doc.kind === "Secret" && doc.apiVersion === "v1").map((doc) => [
    `${doc.metadata?.namespace ?? defaultNamespace}/${doc.metadata?.name}`,
    new Set([...Object.keys(doc.data ?? {}), ...Object.keys(doc.stringData ?? {})]),
  ]));
  const required = new Map();
  for (const doc of docs) {
    let pod;
    if (doc.apiVersion === "v1" && doc.kind === "Pod") pod = doc.spec;
    else if (doc.apiVersion === "apps/v1" && ["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet"].includes(doc.kind)) pod = doc.spec?.template?.spec;
    else if (doc.apiVersion === "batch/v1" && doc.kind === "Job") pod = doc.spec?.template?.spec;
    else if (doc.apiVersion === "batch/v1" && doc.kind === "CronJob") pod = doc.spec?.jobTemplate?.spec?.template?.spec;
    else if (doc.apiVersion === "v1" && doc.kind === "ReplicationController") pod = doc.spec?.template?.spec;
    if (!pod) continue;
    const namespace = doc.metadata?.namespace ?? defaultNamespace;
    check(typeof namespace === "string" && namespace.length > 0, "environment Secret namespace is missing");
    const add = (name, keys, optional) => {
      check(typeof name === "string" && name.length > 0 && keys.every((key) => typeof key === "string" && key.length > 0), "Secret reference needs a name and explicit keys");
      check(optional === undefined || typeof optional === "boolean", "Secret optional must be boolean");
      if (optional === true || keys.length === 0) return;
      const identity = `${namespace}/${name}`;
      if (supplied.has(identity)) {
        check(keys.every((key) => supplied.get(identity).has(key)), "rendered Secret is missing a required key");
        return;
      }
      if (!required.has(identity)) required.set(identity, { namespace, name, keys: new Set() });
      for (const key of keys) required.get(identity).keys.add(key);
    };
    for (const container of [...(pod.initContainers ?? []), ...(pod.containers ?? []), ...(pod.ephemeralContainers ?? [])]) {
      for (const env of container.env ?? []) {
        const ref = env.valueFrom?.secretKeyRef;
        if (!ref) continue;
        check(!Object.hasOwn(env, "value"), "environment variable has both inline value and Secret reference");
        add(ref.name, [ref.key], ref.optional);
      }
    }
    for (const volume of pod.volumes ?? []) {
      if (volume.secret) add(volume.secret.secretName, (volume.secret.items ?? []).map((item) => item.key), volume.secret.optional);
      for (const source of volume.projected?.sources ?? []) {
        if (source.secret) add(source.secret.name, (source.secret.items ?? []).map((item) => item.key), source.secret.optional);
      }
    }
  }
  return [...required.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, fact]) => ({
    namespace: fact.namespace, name: fact.name, keys: [...fact.keys].sort(),
    purpose: "Required by an explicit pod Secret key reference",
  }));
}
