// What data/upstream-availability/observations.yaml says about an entry's
// upstream source today. A source lock keeps the address the Catalog fetched
// from at the time; a new fetch asks fetchRepositoryURL, which answers with the
// address the repository moved to, where one was observed.

import { join } from "node:path";

import { check, readYaml, repoRoot } from "./proof-common.mjs";

export const OBSERVATIONS_PATH = "data/upstream-availability/observations.yaml";
export const STATUSES = ["moved", "removed-upstream"];

let cached = null;
export function upstreamObservations(root = repoRoot) {
  if (cached && root === repoRoot) return cached;
  const doc = readYaml(join(root, OBSERVATIONS_PATH));
  check(doc.kind === "UpstreamAvailabilityObservations", `${OBSERVATIONS_PATH}: expected kind UpstreamAvailabilityObservations`);
  const rows = doc.spec?.observations ?? [];
  if (root === repoRoot) cached = rows;
  return rows;
}

// The observation for a chart ("repo/chart") at a version, or null.
export function upstreamObservation(chart, version, root = repoRoot) {
  return upstreamObservations(root).find((row) => row.chart === chart && String(row.version) === String(version)) ?? null;
}

// The repository a new fetch of this lock should use.
export function fetchRepositoryURL(lockPath, lock, root = repoRoot) {
  const row = upstreamObservations(root).find((entry) => entry.lock === lockPath);
  return row?.status === "moved" ? row.fetchFrom : lock.repositoryURL;
}
