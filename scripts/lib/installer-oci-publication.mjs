import { existsSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot } from "./proof-common.mjs";
import {
  installerOciDigestRef,
  installerOciName,
  installerOciRef,
  installerOciTag,
} from "./installer-oci.mjs";

export function installerOciPublication(chart, version, options = {}) {
  const { required = true } = options;
  const tagRef = installerOciRef(chart, version);
  const receiptPath = join(
    repoRoot,
    "runs",
    "installer-oci",
    installerOciName(chart),
    installerOciTag(version),
    "installer-package-publication-receipt.yaml",
  );

  if (!existsSync(receiptPath)) {
    check(!required, `${relativeRepo(receiptPath)} is missing for ${chart}@${version}`);
    return {
      published: false,
      tagRef,
      exactRef: "",
      manifestDigest: "",
      layerDigest: "",
      packageDigest: "",
      receiptPath: "",
    };
  }

  const receipt = readYaml(receiptPath);
  const receiptRef = String(receipt?.spec?.ref ?? "");
  const packageDigest = String(receipt?.spec?.package?.sha256 ?? "");
  const pushOutput = String(receipt?.spec?.outputs?.push ?? "");
  const manifestDigest = String(
    receipt?.spec?.outputs?.manifestDigest
      ?? pushOutput.match(/manifest:\s+(sha256:[0-9a-f]{64})/u)?.[1]
      ?? "",
  );
  const layerDigest = String(
    receipt?.spec?.outputs?.layerDigest
      ?? pushOutput.match(/layer:\s+(sha256:[0-9a-f]{64})/u)?.[1]
      ?? "",
  );

  check(receiptRef === tagRef, `${relativeRepo(receiptPath)} ref does not match ${tagRef}`);
  check(/^[0-9a-f]{64}$/u.test(packageDigest), `${relativeRepo(receiptPath)} has no valid package digest`);
  check(/^sha256:[0-9a-f]{64}$/u.test(manifestDigest), `${relativeRepo(receiptPath)} has no valid manifest digest`);
  check(/^sha256:[0-9a-f]{64}$/u.test(layerDigest), `${relativeRepo(receiptPath)} has no valid layer digest`);
  check(layerDigest === `sha256:${packageDigest}`, `${relativeRepo(receiptPath)} layer and package digests differ`);

  return {
    published: true,
    tagRef,
    exactRef: installerOciDigestRef(tagRef, manifestDigest),
    manifestDigest,
    layerDigest,
    packageDigest,
    receiptPath: relativeRepo(receiptPath),
  };
}

export function installerOciConsumerRef(chart, version, options = {}) {
  const publication = installerOciPublication(chart, version, options);
  return publication.exactRef || publication.tagRef;
}
