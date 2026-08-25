#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--generate", "--verify"].includes(mode), "use --generate or --verify");
const version = process.env.AICR_CHAIN_VERSION?.trim() || "0.19.0";
check(["0.19.0", "0.20.0"].includes(version), `unsupported AICR chain version ${version}`);
const versionSlug = `v${version.replaceAll(".", "-")}`;
const hasProduction = version === "0.20.0";

const exampleRoot = join(
  repoRoot,
  "examples",
  "aicr",
  `eks-h100-training-kubeflow-${versionSlug}`,
);
const paths = {
  generation: join(exampleRoot, "generation-receipt.yaml"),
  publicOci: join(exampleRoot, "public-oci-receipt.yaml"),
  upload: join(exampleRoot, "confighub-upload-receipt.yaml"),
  policy: join(exampleRoot, "apply-policy-receipt.yaml"),
  promotion: join(exampleRoot, "promotion-readiness-receipt.yaml"),
  releaseOci: join(exampleRoot, "confighub-release-oci-receipt.yaml"),
  flattening: join(exampleRoot, "flattening-safety-verdict.yaml"),
  route: join(exampleRoot, "route-intent.yaml"),
  fields: join(exampleRoot, "field-policy-assessment.yaml"),
  nestedSources: join(repoRoot, "data", `aicr-${versionSlug}-nested-sources`, "summary.md"),
  routeResolution: join(
    repoRoot,
    "data",
    "lifecycle-route-resolutions",
    `aicr-eks-h100-training-kubeflow-${versionSlug}-staging-argo-cd.yaml`,
  ),
};
const outputRoot = join(repoRoot, "data", `aicr-${versionSlug}-chain`);
const outputJson = join(outputRoot, "chain.json");
const outputSummary = join(outputRoot, "summary.md");

for (const [name, path] of Object.entries(paths)) {
  check(existsSync(path), `${name} record is missing: ${relativeRepo(path)}`);
}

const records = Object.fromEntries(
  Object.entries(paths).map(([name, path]) => [
    name,
    name === "nestedSources" ? readFileSync(path, "utf8") : readYaml(path),
  ]),
);
const chain = buildChain(records);
const json = `${JSON.stringify(chain, null, 2)}\n`;
const summary = renderSummary(chain);

if (mode === "--generate") {
  write(outputJson, json);
  write(outputSummary, summary);
  console.log(`wrote ${relativeRepo(outputSummary)}`);
} else {
  check(existsSync(outputJson), `${relativeRepo(outputJson)} is missing; run the generate command`);
  check(readFileSync(outputJson, "utf8") === json, `${relativeRepo(outputJson)} is stale`);
  check(readFileSync(outputSummary, "utf8") === summary, `${relativeRepo(outputSummary)} is stale`);
  console.log(`verified the AICR v${version} source-to-promotion chain`);
}

function buildChain({
  generation,
  publicOci,
  upload,
  policy,
  promotion,
  releaseOci,
  flattening,
  route,
  fields,
  nestedSources,
  routeResolution,
}) {
  check(generation.spec?.source?.version === `v${version}`, "AICR source version changed");
  check(generation.status?.upstreamSignatureVerified === true, "upstream signature is not verified");
  check(generation.status?.publicOciPublication === "pass", "public OCI publication is not pass");
  check(generation.status?.configHubUpload === "pass", "ConfigHub upload is not pass");
  check(generation.status?.promotion === "pass", "ConfigHub promotion is not pass");
  check(generation.status?.configHubReleaseOci === "pass", "ConfigHub release OCI is not pass");
  check(publicOci.status?.result === "pass", "public OCI receipt is not pass");
  check(publicOci.status?.anonymousPull === "pass", "anonymous OCI pull is not pass");
  check(upload.status?.configHubBaseVariantUpload === "pass", "base upload is not pass");
  check(
    policy.status?.requiredApprovalBlockedReleasePublish === "pass",
    "approval check is not pass",
  );
  check(promotion.status?.result === "pass", "promotion receipt is not pass");
  check(
    releaseOci.status?.result === "pass"
      && releaseOci.status?.registryPull === "pass"
      && releaseOci.status?.promotedConfigurationMatched === "pass",
    "approved ConfigHub release OCI is not pass",
  );
  check(
    flattening.spec?.verdict?.lane === "flatten-with-routes",
    "flattening verdict changed",
  );
  check(
    routeResolution.status?.decision === "blocked"
      && routeResolution.status?.evidence === "partly-observed",
    "staging route resolution must remain blocked until the EKS/H100 run",
  );
  check(
    typeof nestedSources === "string" && nestedSources.includes("16/16"),
    "nested source summary does not record all sixteen sources",
  );
  check(
    route.status?.configurationGenerated === true
      && route.status?.routesExecuted === false,
    "route intent status changed",
  );
  check(
    fields.status?.configPlaneOnly === true
      && fields.status?.targetContacted === false,
    "field policy assessment boundary changed",
  );

  const literal = publicOci.spec.artifacts.literalConfiguration;
  const source = publicOci.spec.artifacts.sourcePackage;
  check(literal.digest === upload.spec.source.digest, "public and uploaded configuration digests differ");
  check(literal.digest === promotion.spec.source.literalConfiguration.digest, "promotion source digest changed");
  check(source.digest === promotion.spec.source.sourcePackage.digest, "promotion source-package digest changed");

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "ConfigurationProcessingChain",
    metadata: { name: `aicr-eks-h100-training-kubeflow-${versionSlug}` },
    spec: {
      sourceAndIntent: {
        type: "AICR source variant",
        version: generation.spec.source.version,
        commit: generation.spec.source.commit,
        criteria: generation.spec.sourceAndIntent.criteria,
        receipt: relativeRepo(paths.generation),
      },
      materialize: {
        result: "17 exact Argo CD Application objects",
        objectCount: generation.spec.result.renderedApplications,
        receipt: relativeRepo(paths.generation),
      },
      flatten: {
        verdict: flattening.spec.verdict.lane,
        exactBoundary: "The 17 Argo CD Application wrapper objects are retained as literal configuration.",
        lateBoundary: "Sixteen nested component sources remain separate processing boundaries and are processed later by Argo CD.",
        record: relativeRepo(paths.flattening),
        nestedSourceResult: "All 16 nested sources rendered locally; eight outputs contain CRDs.",
        nestedSourceRecord: relativeRepo(paths.nestedSources),
      },
      lifecycle: {
        result: "staging-resolution-blocked",
        explanation: "The staging resolution binds the promoted object digest to EKS, H100, and Argo CD. It remains blocked until the destination facts, nested chart routes, and runtime checks have receipts.",
        routeIntent: relativeRepo(paths.route),
        stagingResolution: relativeRepo(paths.routeResolution),
      },
      protection: {
        result: "source ownership assessed",
        fieldPolicy: relativeRepo(paths.fields),
      },
      publicOci: {
        sourcePackage: source,
        literalConfiguration: literal,
        receipt: relativeRepo(paths.publicOci),
      },
      configHub: {
        base: upload.spec.space.slug,
        baseId: upload.spec.space.id,
        sourceOciDigest: upload.spec.source.digest,
        dataHash: upload.spec.unit.dataHash,
        objectIdentitiesMatched: upload.spec.provenanceBinding.objectIdentitiesMatched,
        provenanceBinding: upload.spec.provenanceBinding.method,
        approvalGate: policy.spec.policy.gate,
        policyResult: "unapproved release publication refused",
        uploadReceipt: relativeRepo(paths.upload),
        policyReceipt: relativeRepo(paths.policy),
      },
      variants: {
        development: promotion.spec.chain.development.space,
        staging: promotion.spec.chain.staging.space,
        ...(hasProduction
          ? { production: promotion.spec.chain.production.space }
          : {}),
        change: {
          resource: promotion.spec.change.resource,
          from: promotion.spec.change.from,
          to: promotion.spec.change.to,
        },
        result: hasProduction
          ? "The reviewed development change was promoted through staging and production."
          : "The reviewed development change was promoted to staging.",
        receipt: relativeRepo(paths.promotion),
      },
      releaseOci: {
        reference: releaseOci.spec.release.reference,
        manifestDigest: releaseOci.spec.release.manifestDigest,
        bundleDigest: releaseOci.spec.release.bundleDigest,
        objectCount: releaseOci.spec.content.configuration.objectCount,
        promotedConfigurationMatched:
          releaseOci.status.promotedConfigurationMatched === "pass",
        receipt: relativeRepo(paths.releaseOci),
      },
      notRun: [
        `Argo CD reconciliation for this v${version} configuration`,
        `Flux delivery for this v${version} configuration`,
        "EKS or H100 execution",
        "A training workload or model request",
        "An exact runtime rollback",
      ],
    },
    status: { result: "pass" },
  };
}

function renderSummary(record) {
  const spec = record.spec;
  return `# AICR v${version}: from source to an approved release

This page follows one configuration from NVIDIA AICR v${version} into ConfigHub.
The earlier retained AICR versions remain available for comparison.

## What was completed

| Step | Result |
| --- | --- |
| Source and intent | AICR selected the provider-curated EKS, H100, Ubuntu, Kubeflow training source variant at commit \`${spec.sourceAndIntent.commit}\`. |
| Materialize | AICR and Helm produced ${spec.materialize.objectCount} exact Argo CD Applications. |
| Flatten | The 17 wrapper Applications were retained as literal configuration. All 16 nested sources also rendered locally; eight contain CRDs. Each nested source still needs its own flattening and lifecycle decision. |
| Route lifecycle work | The staging resolution binds the promoted configuration to an EKS/H100/Argo CD destination. It remains blocked until the destination facts, nested routes, and runtime checks have receipts. |
| Protect fields | AICR source-owned fields and later ConfigHub changes are kept separate. |
| Publish OCI | The source package and literal configuration are publicly pullable without an account. |
| Retain in ConfigHub | ConfigHub recorded the literal OCI digest, retained the same 17 object identities, and recorded its own data hash for the Unit. |
| Check policy | ConfigHub refused to publish an unapproved release. |
| Change and promote | Development changed one Grafana setting to use an existing Secret. The reviewed result was promoted ${hasProduction ? "through staging and production" : "to staging"}. |
| Publish the approved release | After approval, ConfigHub published the ${hasProduction ? "production" : "staging"} result as OCI. A pull by manifest digest matched all 17 promoted Applications. |

## Exact references

| Record | Exact value |
| --- | --- |
| Source package | \`${spec.publicOci.sourcePackage.reference}@${spec.publicOci.sourcePackage.digest}\` |
| Literal configuration | \`${spec.publicOci.literalConfiguration.reference}@${spec.publicOci.literalConfiguration.digest}\` |
| ConfigHub Unit data hash | \`${spec.configHub.dataHash}\` |
| ConfigHub base | \`${spec.configHub.base}\` |
| Development | \`${spec.variants.development}\` |
| Staging | \`${spec.variants.staging}\` |
${hasProduction ? `| Production | \`${spec.variants.production}\` |\n` : ""}| ConfigHub release OCI | \`${spec.releaseOci.reference}\` |

## What did not run

${spec.notRun.map((item) => `- ${item}`).join("\n")}

## Records

- [Source generation receipt](../../${spec.sourceAndIntent.receipt})
- [Flattening verdict](../../${spec.flatten.record})
- [Route intent](../../${spec.lifecycle.routeIntent})
- [Staging route resolution](../../${spec.lifecycle.stagingResolution})
- [Nested source processing](../../${spec.flatten.nestedSourceRecord})
- [Field policy](../../${spec.protection.fieldPolicy})
- [Public OCI receipt](../../${spec.publicOci.receipt})
- [ConfigHub upload receipt](../../${spec.configHub.uploadReceipt})
- [Apply-policy receipt](../../${spec.configHub.policyReceipt})
- [Promotion receipt](../../${spec.variants.receipt})
- [Approved ConfigHub release OCI receipt](../../${spec.releaseOci.receipt})
`;
}
