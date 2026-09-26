// Read-only observations, not a replacement for native workflow evaluation.
import { check } from "./proof-common.mjs";

export function observeApprovalAttestations(unit, revisionRow, rows, now = Date.now()) {
  const revision = revisionRow?.Revision ?? revisionRow;
  check(Array.isArray(rows), "attestation list did not return an array");
  check(typeof revision?.RevisionID === "string" && revision.RevisionID.length > 0
    && typeof unit.UnitID === "string" && unit.UnitID.length > 0
    && typeof unit.DataHash === "string" && unit.DataHash.length > 0, "revision identity is incomplete");
  check(revision?.UnitID === unit.UnitID && revision?.RevisionNum === unit.HeadRevisionNum
    && revision?.DataHash === unit.DataHash, `${unit.Slug}: revision does not match the observed Unit head`);
  const links = revision.Attestations;
  check(links && typeof links === "object" && !Array.isArray(links), `${unit.Slug}: revision has no attestation links`);
  const records = rows.map((row) => row.Attestation ?? row);
  check(records.every((row) => row && typeof row.AttestationID === "string"), "malformed attestation record");
  const revoked = new Set(records.map((row) => row.RevokedAttestationID).filter(Boolean));
  // Revision.Attestations values have no defined meaning in the native model;
  // membership comes from its keys, and Type comes from each fetched entity.
  const active = records.filter((row) => Object.hasOwn(links, row.AttestationID)
    && row.SpaceID === unit.SpaceID && row.Type === "Approval"
    && !revoked.has(row.AttestationID) && !row.RevokedAttestationID
    && (!Object.hasOwn(row, "ExpiresAt")
      || typeof row.ExpiresAt === "string" && Date.parse(row.ExpiresAt) > now));
  check(!active.some((row) => row.Result === "Fail"), `${unit.Slug}: an active rejection covers the observed revision`);
  const passing = active.filter((row) => row.Result === "Pass");
  check(passing.length > 0, `${unit.Slug}: no active passing Approval attestation covers the observed revision`);
  return { unitID: unit.UnitID, revisionID: revision.RevisionID, revisionNum: revision.RevisionNum,
    dataHash: revision.DataHash, attestationIDs: passing.map((row) => row.AttestationID).sort() };
}
