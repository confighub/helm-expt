// Shared extraction and rendering logic for the platform-to-model membership
// contract: which inference platform can run which model shape, joined only
// through an explicit, delivery-scoped attachment.
//
// The platform set is discovered by scanning examples/aicr/<id>/recipe.yaml
// for `criteria.intent: inference`, plus the one KServe reference entry that
// carries no recipe.yaml at all (kserve-nim-inference is a delivery
// mechanism documented directly here, not a recipe-driven platform). The
// sixteen KServe model shapes are read from
// scripts/lib/aicr-nim-model-profile-catalog.mjs's buildCatalog(), which is
// itself the single source of truth for that shape data; this module does
// not re-derive a shape's slug, GPU profile, GPU count, or image. The one
// authored NIMService model is read directly from its own file.
//
// The join rule this module encodes and asserts: a KServe model shape
// attaches only to kserve-nim-inference, the authored NIMService attaches
// only to its home platform eks-h100-inference-nim, and no model ever
// crosses from one delivery mechanism to another. Every emitted membership
// row is checked against its platform's own delivery before this module
// returns, so a future edit that tried to cross-attach a model would fail
// buildReport() outright rather than produce a quietly wrong contract.
//
// The generator and the verifier both call buildReport(), so they cannot
// disagree. Everything here reads committed bytes only: no network, no
// cluster, no NGC contact, and no wall-clock time enters the output.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot } from "./proof-common.mjs";
import { buildCatalog } from "./aicr-nim-model-profile-catalog.mjs";
import { PROFILES_DIR } from "./aicr-nim-model-profiles.mjs";

const AICR_DIR = join("examples", "aicr");
const KSERVE_ENTRY = "kserve-nim-inference";
const KSERVE_PROFILE_PATH = join(AICR_DIR, KSERVE_ENTRY, "profile", "model-profile.yaml");
const NIM_HOME_PLATFORM = "eks-h100-inference-nim";
const NIM_AUTHORED_FILE = join(AICR_DIR, NIM_HOME_PLATFORM, "authored", "nimservice-llama-3-1-8b.yaml");

export const OUTPUT_ROOT = join("data", "aicr-nim-model-profiles");
export const CSV_PATH = join(OUTPUT_ROOT, "platform-members.csv");
export const MD_PATH = join(OUTPUT_ROOT, "platform-members.md");

const CSV_HEADERS = [
  "platform_id",
  "platform_delivery",
  "platform_accelerator",
  "model_slug",
  "model_delivery",
  "model_accelerator",
  "gpu_count",
  "member_source",
  "source_ref",
];

const DELIVERY_ORDER = ["kserve", "nim", "dynamo", "any"];
const DELIVERY_LABEL = { kserve: "KServe", nim: "NIM", dynamo: "Dynamo", any: "Any" };
// The adjective each delivery reads as mid-sentence: KServe and NIM are
// acronyms that stay capitalized, Dynamo is a proper name, and "any" reads
// better as the plain adjective "delivery-agnostic" than as the raw
// criteria.platform value "any" repeated back at the reader.
const DELIVERY_ADJECTIVE = { kserve: "KServe", nim: "NIM", dynamo: "Dynamo", any: "delivery-agnostic" };

const EMPTY_REASON_BY_DELIVERY = {
  nim: "no NIMService models generated for this platform yet",
  dynamo: "no Dynamo model shapes retained",
  any: "base substrate, no serving layer bound",
};

// Every model-shape slug this catalog retains ends in a GPU profile segment
// of the form <count>x<tag> (a digit count, a literal "x", then a GPU tag:
// "gpu" generic, or a product name such as "a100"/"h100"). The catalog
// already derives and lowercases that segment as `gpuProfile`; this reads
// the tag half of it back out rather than re-deriving it from the slug.
const GPU_PROFILE_TAG_PATTERN = /^\d+x([a-z0-9]+)$/i;

function acceleratorFromGpuProfile(gpuProfile) {
  const match = gpuProfile.match(GPU_PROFILE_TAG_PATTERN);
  check(match, `gpuProfile does not match <count>x<tag>: ${gpuProfile}`);
  return match[1].toLowerCase();
}

// Scan examples/aicr/<id>/recipe.yaml for every entry whose criteria.intent
// is "inference", plus kserve-nim-inference (which carries no recipe.yaml;
// it is documented here as the KServe reference entry, delivery "kserve",
// accelerator-agnostic). Fails closed if a recipe.yaml later appears under
// kserve-nim-inference, since that would make its criteria a second,
// possibly disagreeing, source of truth for an entry this module already
// defines by hand.
function discoverPlatforms(root) {
  const aicrAbsDir = join(root, AICR_DIR);
  const entryNames = readdirSync(aicrAbsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const kserveRecipePath = join(aicrAbsDir, KSERVE_ENTRY, "recipe.yaml");
  check(
    !existsSync(kserveRecipePath),
    `${relativeRepo(kserveRecipePath)} now exists; kserve-nim-inference is documented as recipe-less in scripts/lib/aicr-platform-members.mjs and must be reconciled with its new recipe.yaml`,
  );

  const platforms = [];
  for (const name of entryNames) {
    const recipePath = join(aicrAbsDir, name, "recipe.yaml");
    if (!existsSync(recipePath)) continue;
    const doc = readYaml(recipePath);
    const criteria = doc.criteria ?? {};
    if (criteria.intent !== "inference") continue;
    const delivery = criteria.platform;
    const accelerator = criteria.accelerator;
    check(delivery, `${relativeRepo(recipePath)}: criteria.platform is missing`);
    check(accelerator, `${relativeRepo(recipePath)}: criteria.accelerator is missing`);
    check(
      DELIVERY_ORDER.includes(delivery),
      `${relativeRepo(recipePath)}: criteria.platform "${delivery}" is not one of ${DELIVERY_ORDER.join(", ")}`,
    );
    platforms.push({ platformId: name, delivery, accelerator });
  }
  check(
    platforms.length === 43,
    `expected 43 examples/aicr/*/recipe.yaml entries with criteria.intent: inference, found ${platforms.length}`,
  );

  platforms.push({ platformId: KSERVE_ENTRY, delivery: "kserve", accelerator: "any" });
  check(platforms.length === 44, `expected 44 inference platforms after adding ${KSERVE_ENTRY}, found ${platforms.length}`);

  const seen = new Set();
  for (const platform of platforms) {
    check(!seen.has(platform.platformId), `two inference platforms share the id ${platform.platformId}`);
    seen.add(platform.platformId);
  }

  return platforms;
}

function platformOrderKey(platform) {
  const deliveryIndex = DELIVERY_ORDER.indexOf(platform.delivery);
  check(deliveryIndex !== -1, `unknown delivery for ordering: ${platform.delivery}`);
  return [deliveryIndex, platform.platformId];
}

function sortPlatforms(platforms) {
  return [...platforms].sort((a, b) => {
    const [ai, aid] = platformOrderKey(a);
    const [bi, bid] = platformOrderKey(b);
    if (ai !== bi) return ai - bi;
    return aid < bid ? -1 : aid > bid ? 1 : 0;
  });
}

// The sixteen KServe model-shape members, read from the shared catalog
// (scripts/lib/aicr-nim-model-profile-catalog.mjs) rather than re-derived.
// Exactly one carries its own hand-authored profile
// (examples/aicr/kserve-nim-inference/profile/model-profile.yaml); the other
// fifteen carry a generated profile under data/aicr-nim-model-profiles/profiles/.
function buildKserveMembers(root, kservePlatform) {
  const catalog = buildCatalog(root);
  check(catalog.candidates.length === 16, `expected 16 KServe model-shape candidates, found ${catalog.candidates.length}`);

  const authoredProfilePath = join(root, KSERVE_PROFILE_PATH);
  check(existsSync(authoredProfilePath), `missing pre-existing authored profile: ${relativeRepo(authoredProfilePath)}`);
  const authoredDoc = readYaml(authoredProfilePath);
  const authoredSlug = authoredDoc.metadata?.name;
  check(authoredSlug, `${relativeRepo(authoredProfilePath)}: metadata.name is missing`);

  const members = catalog.candidates
    .map((candidate) => {
      const isAuthored = candidate.slug === authoredSlug;
      const sourceRef = isAuthored ? relativeRepo(authoredProfilePath) : join(PROFILES_DIR, `${candidate.slug}.yaml`);
      if (!isAuthored) {
        const generatedAbsPath = join(root, PROFILES_DIR, `${candidate.slug}.yaml`);
        check(existsSync(generatedAbsPath), `missing generated profile: ${relativeRepo(generatedAbsPath)}`);
      }
      return {
        platformId: kservePlatform.platformId,
        platformDelivery: kservePlatform.delivery,
        platformAccelerator: kservePlatform.accelerator,
        modelSlug: candidate.slug,
        modelDelivery: "kserve",
        modelAccelerator: acceleratorFromGpuProfile(candidate.gpuProfile),
        gpuCount: candidate.gpuCount,
        memberSource: isAuthored ? "authored-profile" : "generated-profile",
        sourceRef,
      };
    })
    .sort((a, b) => (a.modelSlug < b.modelSlug ? -1 : a.modelSlug > b.modelSlug ? 1 : 0));

  check(members.some((member) => member.memberSource === "authored-profile"), `no KServe member matched the authored slug ${authoredSlug}`);
  check(
    members.filter((member) => member.memberSource === "authored-profile").length === 1,
    "more than one KServe member matched the authored slug",
  );

  return members;
}

// The one authored NIMService model, read directly from its own file. It is
// a member of its home platform (eks-h100-inference-nim) only.
function buildNimServiceMember(root, nimHomePlatform) {
  const filePath = join(root, NIM_AUTHORED_FILE);
  check(existsSync(filePath), `missing authored NIMService file: ${relativeRepo(filePath)}`);
  const doc = readYaml(filePath);
  check(
    doc.apiVersion === "apps.nvidia.com/v1alpha1" && doc.kind === "NIMService",
    `${relativeRepo(filePath)}: expected a NIMService`,
  );

  const modelSlug = doc.metadata?.name;
  check(modelSlug, `${relativeRepo(filePath)}: metadata.name is missing`);

  const gpuLimit = doc.spec?.resources?.limits?.["nvidia.com/gpu"];
  check(gpuLimit, `${relativeRepo(filePath)}: spec.resources.limits["nvidia.com/gpu"] is missing`);
  const gpuCount = Number.parseInt(gpuLimit, 10);
  check(Number.isInteger(gpuCount) && gpuCount > 0, `${relativeRepo(filePath)}: gpu count did not parse to a positive integer`);

  return {
    platformId: nimHomePlatform.platformId,
    platformDelivery: nimHomePlatform.delivery,
    platformAccelerator: nimHomePlatform.accelerator,
    modelSlug,
    modelDelivery: "nim",
    modelAccelerator: nimHomePlatform.accelerator,
    gpuCount,
    memberSource: "authored-nimservice",
    sourceRef: relativeRepo(filePath),
  };
}

// The join rule, asserted over every emitted row rather than trusted from
// construction: a member's delivery must equal the delivery of the platform
// it is attached to. A row that ever broke this would mean a KServe shape
// reached a nim/dynamo/any platform, or a NIMService reached a
// kserve/dynamo/any platform -- an uncertified portability claim this
// contract must never make silently.
function assertJoinRule(rows) {
  for (const row of rows) {
    check(
      row.modelDelivery === row.platformDelivery,
      `join rule violated: ${row.modelSlug} (delivery ${row.modelDelivery}) attached to ${row.platformId} (delivery ${row.platformDelivery})`,
    );
  }
}

function reasonFor(platform) {
  const reason = EMPTY_REASON_BY_DELIVERY[platform.delivery];
  check(reason, `no empty-platform reason defined for delivery ${platform.delivery}`);
  return reason;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function renderCsv(rows) {
  const lines = rows.map((row) =>
    [
      row.platformId,
      row.platformDelivery,
      row.platformAccelerator,
      row.modelSlug,
      row.modelDelivery,
      row.modelAccelerator,
      row.gpuCount,
      row.memberSource,
      row.sourceRef,
    ]
      .map(csvCell)
      .join(","),
  );
  return `${CSV_HEADERS.join(",")}\n${lines.join("\n")}\n`;
}

function membersTable(rows) {
  const header = "| Model slug | GPU count | Accelerator | Member source | Source file |\n| --- | --- | --- | --- | --- |";
  const body = rows
    .map((row) => `| \`${row.modelSlug}\` | ${row.gpuCount} | ${row.modelAccelerator} | ${row.memberSource} | \`${row.sourceRef}\` |`)
    .join("\n");
  return `${header}\n${body}`;
}

function emptyPlatformsTable(platforms) {
  const header = "| Platform | Accelerator | Reason |\n| --- | --- | --- |";
  const body = platforms.map((platform) => `| \`${platform.platformId}\` | ${platform.accelerator} | ${reasonFor(platform)} |`).join("\n");
  return `${header}\n${body}`;
}

function renderDeliverySection(delivery, platforms, membersByPlatform) {
  const label = DELIVERY_LABEL[delivery];
  const adjective = DELIVERY_ADJECTIVE[delivery];
  const populated = platforms.filter((platform) => (membersByPlatform.get(platform.platformId) ?? []).length > 0);
  const empty = platforms.filter((platform) => (membersByPlatform.get(platform.platformId) ?? []).length === 0);

  const parts = [`## ${label} delivery (${platforms.length} platform${platforms.length === 1 ? "" : "s"})`];

  for (const platform of populated) {
    const rows = membersByPlatform.get(platform.platformId);
    parts.push(
      `\`${platform.platformId}\` (accelerator ${platform.accelerator}) carries ${rows.length} member${rows.length === 1 ? "" : "s"}.\n\n${membersTable(rows)}`,
    );
  }

  if (empty.length > 0) {
    const verb = empty.length === 1 ? "carries" : "carry";
    const lead =
      populated.length > 0
        ? `The other ${empty.length} ${adjective} platform${empty.length === 1 ? "" : "s"} ${verb} no members yet.`
        : `None of the ${empty.length} ${adjective} platform${empty.length === 1 ? "" : "s"} ${verb} a member yet.`;
    parts.push(`${lead}\n\n${emptyPlatformsTable(empty)}`);
  }

  return parts.join("\n\n");
}

function renderMarkdown(platforms, membersByPlatform, counts, emptyByDelivery) {
  const sections = DELIVERY_ORDER.map((delivery) =>
    renderDeliverySection(
      delivery,
      platforms.filter((platform) => platform.delivery === delivery),
      membersByPlatform,
    ),
  );
  const waitingOnAModel = emptyByDelivery.nim + emptyByDelivery.dynamo;

  return `# Platform-to-model membership for the AICR inference catalog

This is a delivery-scoped join between every inference platform in the AICR
catalog and the model shapes it can actually run. This catalog names
${counts.totalPlatforms} inference platforms, and ${counts.populatedPlatforms} of them carry a member
today: the KServe reference entry with its sixteen retained model shapes,
and the one h100 NIM platform that carries an authored NIMService.
Attachment follows each model's own delivery mechanism. A KServe model
shape attaches only to the KServe platform. A NIMService attaches only to
the NIM platform it was authored against. No model ever crosses from one
delivery mechanism to another, and this contract's verifier checks that
boundary on every row it reads.

The remaining ${counts.emptyPlatforms} platforms carry no member yet, and each one states why.
${waitingOnAModel} of them, the other NIM platforms and the Dynamo
platforms, are waiting on a model that has not yet been generated or
retained. The other ${emptyByDelivery.any} are base substrate with no serving layer
bound at all.

${sections.join("\n\n")}

## Regenerate and verify

\`\`\`sh
npm run aicr-platform-members:generate
npm run aicr-platform-members:verify
\`\`\`
`;
}

// The pure function the generator and the verifier both call. It reads
// committed bytes only under `root`, asserts the join rule and the platform
// count inline via `check`, and returns the exact text every output file
// must hold, plus the structured membership data.
export function buildReport(root = repoRoot) {
  const platforms = discoverPlatforms(root);
  const sortedPlatforms = sortPlatforms(platforms);

  const kservePlatform = sortedPlatforms.find((platform) => platform.platformId === KSERVE_ENTRY);
  check(kservePlatform, `${KSERVE_ENTRY} did not survive platform discovery`);
  const nimHomePlatform = sortedPlatforms.find((platform) => platform.platformId === NIM_HOME_PLATFORM);
  check(nimHomePlatform, `${NIM_HOME_PLATFORM} did not survive platform discovery`);

  const kserveMembers = buildKserveMembers(root, kservePlatform);
  const nimMember = buildNimServiceMember(root, nimHomePlatform);

  const allRows = [...kserveMembers, nimMember];
  assertJoinRule(allRows);

  const membersByPlatform = new Map(sortedPlatforms.map((platform) => [platform.platformId, []]));
  membersByPlatform.set(kservePlatform.platformId, kserveMembers);
  membersByPlatform.set(nimHomePlatform.platformId, [nimMember]);

  for (const platform of sortedPlatforms) {
    if (platform.platformId === KSERVE_ENTRY || platform.platformId === NIM_HOME_PLATFORM) continue;
    check(
      (membersByPlatform.get(platform.platformId) ?? []).length === 0,
      `${platform.platformId} unexpectedly carries a member; only ${KSERVE_ENTRY} and ${NIM_HOME_PLATFORM} should`,
    );
  }
  check(kserveMembers.length === 16, `expected 16 members for ${KSERVE_ENTRY}, found ${kserveMembers.length}`);
  check(
    (membersByPlatform.get(NIM_HOME_PLATFORM) ?? []).length === 1,
    `expected 1 member for ${NIM_HOME_PLATFORM}, found ${(membersByPlatform.get(NIM_HOME_PLATFORM) ?? []).length}`,
  );

  const csvRows = sortedPlatforms.flatMap((platform) => membersByPlatform.get(platform.platformId) ?? []);
  check(csvRows.length === 17, `expected 17 total member rows, found ${csvRows.length}`);

  const populatedPlatforms = sortedPlatforms.filter((platform) => (membersByPlatform.get(platform.platformId) ?? []).length > 0).length;
  const counts = {
    totalPlatforms: sortedPlatforms.length,
    populatedPlatforms,
    emptyPlatforms: sortedPlatforms.length - populatedPlatforms,
    totalMemberRows: csvRows.length,
  };
  check(counts.emptyPlatforms === 42, `expected 42 empty platforms, found ${counts.emptyPlatforms}`);

  const emptyByDelivery = Object.fromEntries(
    DELIVERY_ORDER.map((delivery) => [
      delivery,
      sortedPlatforms.filter((platform) => platform.delivery === delivery && (membersByPlatform.get(platform.platformId) ?? []).length === 0)
        .length,
    ]),
  );

  return {
    platforms: sortedPlatforms,
    membersByPlatform,
    counts,
    csvPath: join(root, CSV_PATH),
    csvText: renderCsv(csvRows),
    mdPath: join(root, MD_PATH),
    mdText: renderMarkdown(sortedPlatforms, membersByPlatform, counts, emptyByDelivery),
  };
}
