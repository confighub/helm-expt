// One place to declare that a published installer package has deliberately
// changed since it was published.
//
// Two lanes need the same fact. The publication-drift lane compares each
// package against the sourceTreeSHA256 its publication receipt recorded, and
// the Kubara release acceptance compares recorded package files against the
// release scope manifest. Both should refuse a silent edit and accept a
// declared one, and they should agree about which is which, so the declaration
// lives here rather than in either of them.
//
// An entry is a debt with a date on it. It says what changed, why, and what
// clears it. Republishing the package clears it, at which point the entry is
// removed and both lanes go back to demanding an exact match.
export const DECLARED_PACKAGE_DRIFT = Object.freeze({});

export function packageDriftReason(packagePath) {
  return DECLARED_PACKAGE_DRIFT[packagePath] ?? "";
}
