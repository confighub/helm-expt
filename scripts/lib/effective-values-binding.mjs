import { createHash } from "node:crypto";

// #1052 renamed only metadata.name in these EffectiveValues documents. The
// historical input hashes still describe the pre-rename bytes; no receipt is
// rewritten. Only these exact paths and historical hashes permit that rename.
export const renamedValuesWitnesses = new Map([
  ["recipes/bitnami/mongodb/19.0.7/effective-values.yaml", "942cc15801c09c1e350a99a45ba105fb8f5bb889e6b9979e39d6eca553ad4c0c"],
  ["recipes/bitnami/mongodb/19.0.9/effective-values.yaml", "8fdac8c50f36a1f3ac14caf27dfedc2e98e24043ab3438ddb8f7263431d76f94"],
  ["recipes/bitnami/mongodb/19.1.0/effective-values.yaml", "2bc25f8b0dcbfcc803ad778eb24fa0cebf93f3612bd285c90dc7d535718c697a"],
  ["recipes/bitnami/mysql/14.0.3/effective-values.yaml", "6cd13d74fc2369f4916119601f8eead83eecf461183f0f28ab1ed95fa7a07c46"],
  ["recipes/bitnami/postgresql/18.6.10/effective-values.yaml", "6c43a43284ab6cd6687fb8a4a159c4b388b35b597d0def8c9b1c23bc19e3e486"],
  ["recipes/bitnami/postgresql/18.6.7/effective-values.yaml", "7fb5e18f35043fe658aadbb3db59749a92275dec6e1e0b41b0eac51c39577d11"],
  ["recipes/bitnami/postgresql/18.7.0/effective-values.yaml", "f2301e287062c59e25ac0e7e465d669f6a949ae60e40aab5e413a631412b1953"],
  ["recipes/bitnami/rabbitmq/16.0.14/effective-values.yaml", "9334ae11bf2c0103fa0f38f5e00bf7ff5dd756d882fdc2184ea7e3fa460d54e7"],
  ["recipes/grafana/grafana/10.5.15/effective-values.yaml", "05912d4e7fc038372d4f0a157728173586f98f126768f27bd8066c52d403ebb2"],
  ["data/latest-top20-refresh/candidates/mongodb-19.0.9/recipes/bitnami/mongodb/19.0.9/effective-values.yaml", "8fdac8c50f36a1f3ac14caf27dfedc2e98e24043ab3438ddb8f7263431d76f94"],
  ["data/latest-top20-refresh/candidates/mongodb-19.1.0/recipes/bitnami/mongodb/19.1.0/effective-values.yaml", "2bc25f8b0dcbfcc803ad778eb24fa0cebf93f3612bd285c90dc7d535718c697a"],
  ["data/latest-top20-refresh/candidates/postgresql-18.6.10/recipes/bitnami/postgresql/18.6.10/effective-values.yaml", "6c43a43284ab6cd6687fb8a4a159c4b388b35b597d0def8c9b1c23bc19e3e486"],
  ["data/latest-top20-refresh/candidates/postgresql-18.7.0/recipes/bitnami/postgresql/18.7.0/effective-values.yaml", "f2301e287062c59e25ac0e7e465d669f6a949ae60e40aab5e413a631412b1953"],
]);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function verifyEffectiveValuesBinding(path, bytes, revisionHash, renderHash) {
  const actual = sha(bytes);
  if (revisionHash === actual && renderHash === actual) return "exact";
  const historical = renamedValuesWitnesses.get(path);
  if (historical && revisionHash === historical && renderHash === historical) {
    const text = bytes.toString("utf8");
    const prior = text.replace(/^(metadata:\n  name: "[^"\n]*)-static-passwords("\n)/m, "$1-generated-passwords$2");
    if (prior !== text && sha(prior) === historical) return "historical-metadata-rename";
  }
  throw new Error(`${path}: effective values digest mismatch against revision/render receipt`);
}
