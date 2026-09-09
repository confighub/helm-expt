// Shared extraction and rendering logic for the platform-to-model membership
// contract: which inference platform retains which model shape, joined only
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
// authored NIMService model is read directly from its own file. The
// retained NIM-Operator sample corpus (NVIDIA's own k8s-nim-operator
// config/samples/nim/serving tree) is read from
// scripts/lib/aicr-nim-operator-models.mjs's buildReport(), which is the
// single source of truth for that corpus; this module does not re-derive a
// sample's slug, gpuCount, image, or accelerator.
//
// The join rule this module encodes and asserts: a KServe model shape
// attaches only to kserve-nim-inference, and a NIMService (authored or
// retained) attaches only to platform=nim inference platforms; no model
// ever crosses from one delivery mechanism to another. Within the NIM
// delivery, the authored NIMService stays attached to its home platform
// eks-h100-inference-nim only, the way it always has. The retained corpus
// adds a wider attachment: every retained NIMService in this corpus is
// accelerator-generic (see aicr-nim-operator-models.mjs's module header for
// why), so each one attaches to all four platform=nim inference platforms
// rather than to one home platform; buildReport() fails closed if a future
// retained sample ever turns out to be accelerator-specific, rather than
// silently attaching it everywhere. Every emitted membership row is checked
// against its platform's own delivery before this module returns, so a
// future edit that tried to cross-attach a model would fail buildReport()
// outright rather than produce a quietly wrong contract.
//
// The retained Dynamo corpus (scripts/lib/aicr-dynamo-models.mjs) attaches
// to the ten platform=dynamo inference platforms by an accelerator match
// rather than a blanket join: that corpus is NOT accelerator-generic (see
// its own module header), so a recipe with no accelerator pin (generic)
// reaches every platform=dynamo platform, and a recipe pinned to a GPU
// product reaches only the platform(s) whose own criteria.accelerator names
// that product. Raw GPU-product strings are normalized to platform
// accelerator tokens through a fixed, fail-closed map; a raw string outside
// that map must stop buildReport() rather than be silently treated as
// generic. A recipe whose accelerator has no matching platform (today, H200
// -- there is no platform=dynamo platform with that token) stays profiled
// but attaches nowhere, and that absence is asserted below rather than left
// to fall out of the join unexamined.
//
// The generator and the verifier both call buildReport(), so they cannot
// disagree. Everything here reads committed bytes only: no network, no
// cluster, no NGC contact, and no wall-clock time enters the output.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot } from "./proof-common.mjs";
import { buildCatalog } from "./aicr-nim-model-profile-catalog.mjs";
import { PROFILES_DIR } from "./aicr-nim-model-profiles.mjs";
import { buildReport as buildNimOperatorModelsReport, PROFILES_DIR as NIM_OPERATOR_PROFILES_DIR } from "./aicr-nim-operator-models.mjs";
import { buildReport as buildDynamoModelsReport, PROFILES_DIR as DYNAMO_PROFILES_DIR } from "./aicr-dynamo-models.mjs";

const AICR_DIR = join("examples", "aicr");
const KSERVE_ENTRY = "kserve-nim-inference";
const KSERVE_PROFILE_PATH = join(AICR_DIR, KSERVE_ENTRY, "profile", "model-profile.yaml");
const NIM_HOME_PLATFORM = "eks-h100-inference-nim";
const NIM_AUTHORED_FILE = join(AICR_DIR, NIM_HOME_PLATFORM, "authored", "nimservice-llama-3-1-8b.yaml");

// The ten platform=dynamo inference platforms, each carrying a fixed
// criteria.accelerator token read from its own recipe.yaml. Hand-named here
// (not only discovered) so a future recipe.yaml edit that changed, added,
// or removed one of these platforms fails buildReport() outright instead of
// silently reshaping the accelerator join below.
const DYNAMO_PLATFORM_ACCELERATORS = {
  "b200-gke-cos-inference-dynamo": "b200",
  "gb200-eks-ubuntu-inference-dynamo": "gb200",
  "gb200-oke-ubuntu-inference-dynamo": "gb200",
  "gb300-eks-ubuntu-inference-dynamo": "gb300",
  "h100-aks-ubuntu-inference-dynamo": "h100",
  "h100-eks-ubuntu-inference-dynamo": "h100",
  "h100-gke-cos-inference-dynamo": "h100",
  "h100-kind-inference-dynamo": "h100",
  "rtx-pro-6000-eks-ubuntu-inference-dynamo": "rtx-pro-6000",
  "vr200-rke2-ubuntu-inference-dynamo": "vr200",
};

// Raw GPU-product strings the retained Dynamo corpus's `accelerator` field
// records (an nvidia.com/gpu.product nodeSelector or node-affinity value),
// normalized to the short token the AICR recipe criteria use. Fails closed:
// a raw string this map does not name must never be silently treated as
// generic.
const DYNAMO_ACCELERATOR_TOKEN = {
  "NVIDIA-B200": "b200",
  "NVIDIA-GB200": "gb200",
  "NVIDIA-GB300": "gb300",
  "NVIDIA-H100-80GB-HBM3": "h100",
  "NVIDIA-H200": "h200",
};

// The expected shape of the retained Dynamo corpus's accelerator split,
// checked below rather than assumed: 54 of 157 recipes carry no accelerator
// pin at all (generic, reaching every platform=dynamo platform), and the
// other 103 carry exactly one of these five normalized tokens. h200 has no
// matching platform=dynamo platform today, so every h200 recipe stays
// profiled but attaches nowhere.
const DYNAMO_GENERIC_MEMBER_COUNT = 54;
const DYNAMO_ACCELERATOR_FACT_COUNTS = { b200: 35, gb200: 23, gb300: 7, h100: 7, h200: 31 };

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

// Reject malformed quantities rather than truncating a hardware requirement.
export function parseGpuCount(value) {
  const validType = typeof value === "number" || typeof value === "string";
  check(validType && /^[1-9][0-9]*$/.test(String(value)), "GPU count must be a positive whole-number quantity");
  const count = Number(value);
  check(Number.isSafeInteger(count), "GPU count must be a safe integer");
  return count;
}

// The authored NIMService belongs only to its home platform.
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
  const gpuCount = parseGpuCount(gpuLimit);

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

// The retained NIM-Operator sample corpus, read from
// scripts/lib/aicr-nim-operator-models.mjs's buildReport(). Every fact in
// that corpus is accelerator-generic today (its own module fails closed the
// day that stops being true), so each one attaches to every platform=nim
// inference platform rather than to a single home platform the way the one
// authored NIMService does. `modelAccelerator` is recorded as "any" for
// these rows: the model itself carries no accelerator requirement, even on
// a row attached to an h100 or rtx-pro-6000 platform, so the row should not
// claim an accelerator match the retained sample never asserted.
function buildRetainedNimServiceMembers(root, nimPlatforms) {
  const report = buildNimOperatorModelsReport(root);
  check(report.facts.length === 38, `expected 38 retained NIMService facts, found ${report.facts.length}`);

  const rows = [];
  for (const fact of report.facts) {
    check(
      fact.accelerator === null,
      `retained NIMService ${fact.slug} carries an accelerator ("${fact.accelerator}"); extend buildRetainedNimServiceMembers in scripts/lib/aicr-platform-members.mjs to match it to specific nim platforms instead of attaching it to all four`,
    );
    const generatedAbsPath = join(root, NIM_OPERATOR_PROFILES_DIR, `${fact.slug}.yaml`);
    check(existsSync(generatedAbsPath), `missing generated NIM-Operator profile: ${relativeRepo(generatedAbsPath)}`);
    const sourceRef = join(NIM_OPERATOR_PROFILES_DIR, `${fact.slug}.yaml`);

    for (const platform of nimPlatforms) {
      rows.push({
        platformId: platform.platformId,
        platformDelivery: platform.delivery,
        platformAccelerator: platform.accelerator,
        modelSlug: fact.slug,
        modelDelivery: "nim",
        modelAccelerator: "any",
        gpuCount: fact.gpuCount,
        memberSource: "retained-nimservice",
        sourceRef,
      });
    }
  }

  return rows.sort((a, b) =>
    a.platformId === b.platformId ? (a.modelSlug < b.modelSlug ? -1 : a.modelSlug > b.modelSlug ? 1 : 0) : a.platformId < b.platformId ? -1 : 1,
  );
}

// Normalizes one Dynamo fact's raw `accelerator` field (null, or a
// non-empty list of raw GPU-product strings) to null (accelerator-generic)
// or a Set of platform accelerator tokens. Fails closed on any raw string
// outside DYNAMO_ACCELERATOR_TOKEN rather than treating it as generic.
function normalizeDynamoAccelerator(fact) {
  if (fact.accelerator === null) return null;
  check(Array.isArray(fact.accelerator) && fact.accelerator.length > 0, `${fact.slug}: accelerator is neither null nor a non-empty list`);
  const tokens = fact.accelerator.map((raw) => {
    const token = DYNAMO_ACCELERATOR_TOKEN[raw];
    check(
      token,
      `${fact.slug}: accelerator "${raw}" is not one of ${Object.keys(DYNAMO_ACCELERATOR_TOKEN).join(", ")}; extend ` +
        "DYNAMO_ACCELERATOR_TOKEN in scripts/lib/aicr-platform-members.mjs rather than silently treating it as generic",
    );
    return token;
  });
  return new Set(tokens);
}

// The retained ai-dynamo/dynamo recipes corpus, read from
// scripts/lib/aicr-dynamo-models.mjs's buildReport(). Unlike the retained
// NIM-Operator corpus, this one is NOT accelerator-generic (see that
// module's header): a generic recipe reaches every platform=dynamo
// platform, and an accelerator-specific recipe reaches only the platform(s)
// whose own criteria.accelerator its normalized token set names. A row's
// own modelAccelerator records the matching platform's own token, or
// "generic" for a generic recipe -- never a whole set, since a row is
// always the join of exactly one recipe with exactly one platform.
function buildDynamoMembers(root, dynamoPlatforms) {
  const report = buildDynamoModelsReport(root);
  check(report.facts.length === 157, `expected 157 retained Dynamo facts, found ${report.facts.length}`);

  const rows = [];
  let genericCount = 0;
  const specificCounts = new Map();

  for (const fact of report.facts) {
    const normalized = normalizeDynamoAccelerator(fact);
    const generatedAbsPath = join(root, DYNAMO_PROFILES_DIR, `${fact.slug}.yaml`);
    check(existsSync(generatedAbsPath), `missing generated Dynamo profile: ${relativeRepo(generatedAbsPath)}`);
    const sourceRef = join(DYNAMO_PROFILES_DIR, `${fact.slug}.yaml`);

    if (normalized === null) {
      genericCount += 1;
      for (const platform of dynamoPlatforms) {
        rows.push({
          platformId: platform.platformId,
          platformDelivery: platform.delivery,
          platformAccelerator: platform.accelerator,
          modelSlug: fact.slug,
          modelDelivery: "dynamo",
          modelAccelerator: "generic",
          gpuCount: fact.gpuRequests,
          memberSource: "retained-dynamographdeployment",
          sourceRef,
        });
      }
      continue;
    }

    for (const token of normalized) {
      specificCounts.set(token, (specificCounts.get(token) ?? 0) + 1);
    }
    for (const platform of dynamoPlatforms) {
      if (!normalized.has(platform.accelerator)) continue;
      rows.push({
        platformId: platform.platformId,
        platformDelivery: platform.delivery,
        platformAccelerator: platform.accelerator,
        modelSlug: fact.slug,
        modelDelivery: "dynamo",
        modelAccelerator: platform.accelerator,
        gpuCount: fact.gpuRequests,
        memberSource: "retained-dynamographdeployment",
        sourceRef,
      });
    }
  }

  check(
    genericCount === DYNAMO_GENERIC_MEMBER_COUNT,
    `expected ${DYNAMO_GENERIC_MEMBER_COUNT} accelerator-generic Dynamo recipes, found ${genericCount}`,
  );
  for (const [token, expected] of Object.entries(DYNAMO_ACCELERATOR_FACT_COUNTS)) {
    const found = specificCounts.get(token) ?? 0;
    check(found === expected, `expected ${expected} Dynamo recipes normalized to accelerator ${token}, found ${found}`);
  }
  const knownTokens = new Set(Object.keys(DYNAMO_ACCELERATOR_FACT_COUNTS));
  for (const token of specificCounts.keys()) {
    check(knownTokens.has(token), `Dynamo recipes normalized to an unexpected accelerator token ${token}; extend DYNAMO_ACCELERATOR_FACT_COUNTS`);
  }
  check(
    genericCount + [...specificCounts.values()].reduce((sum, n) => sum + n, 0) === report.facts.length,
    "generic and accelerator-specific Dynamo fact counts do not sum to the corpus size",
  );

  const h200Attached = rows.some((row) => row.modelAccelerator === "h200");
  check(!h200Attached, "an h200 Dynamo recipe attached to a platform, but no platform=dynamo platform carries accelerator h200");

  return rows.sort((a, b) =>
    a.platformId === b.platformId ? (a.modelSlug < b.modelSlug ? -1 : a.modelSlug > b.modelSlug ? 1 : 0) : a.platformId < b.platformId ? -1 : 1,
  );
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

// A plain-language sentence naming which deliveries still have empty
// platforms waiting on a model, built from whichever of {nim, dynamo}
// actually have a nonzero empty count today. Returns null when neither
// does, so the caller can drop the sentence entirely rather than claim
// platforms are waiting when none are. Phrased separately for "only one
// delivery is short a model" versus "both are" so the count is never
// restated redundantly next to its own label.
function waitingOnAModelSentence(emptyByDelivery) {
  const nim = emptyByDelivery.nim;
  const dynamo = emptyByDelivery.dynamo;
  if (nim === 0 && dynamo === 0) return null;
  const verbFor = (n) => (n === 1 ? "is" : "are");
  if (nim > 0 && dynamo > 0) {
    const count = nim + dynamo;
    return (
      `${count} of them, the other ${nim} NIM platform${nim === 1 ? "" : "s"} and the ` +
      `${dynamo} Dynamo platform${dynamo === 1 ? "" : "s"}, ${verbFor(count)} waiting on a ` +
      "model that has not yet been generated or retained."
    );
  }
  if (nim > 0) {
    return `The other ${nim} NIM platform${nim === 1 ? "" : "s"} ${verbFor(nim)} waiting on a model that has not yet been generated or retained.`;
  }
  return `The ${dynamo} Dynamo platform${dynamo === 1 ? "" : "s"} ${verbFor(dynamo)} waiting on a model that has not yet been generated or retained.`;
}

function renderMarkdown(platforms, membersByPlatform, counts, emptyByDelivery) {
  const sections = DELIVERY_ORDER.map((delivery) =>
    renderDeliverySection(
      delivery,
      platforms.filter((platform) => platform.delivery === delivery),
      membersByPlatform,
    ),
  );
  const waitingSentence = waitingOnAModelSentence(emptyByDelivery);

  return `# Platform-to-model membership for the AICR inference catalog

This is a delivery-scoped join between every inference platform in the AICR
catalog and its retained model configurations. This catalog names
${counts.totalPlatforms} inference platforms, and ${counts.populatedPlatforms} of them carry a member
today: the KServe reference entry with its sixteen retained model shapes,
all four NIM platforms, which together carry one authored NIMService plus
the retained k8s-nim-operator sample corpus (accelerator-generic in this
corpus, so every retained sample reaches every NIM platform), and all ten
Dynamo platforms, which carry the retained ai-dynamo/dynamo recipes corpus
joined by an accelerator match rather than a blanket join. Attachment
follows each model's own delivery mechanism. A KServe model shape attaches
only to the KServe platform. A NIMService attaches only to a NIM platform,
either its authored home platform or, for the retained corpus, every NIM
platform its accelerator allows. A retained Dynamo recipe with no
accelerator pin attaches to every Dynamo platform; a recipe pinned to a GPU
product attaches only to the Dynamo platform(s) whose own accelerator that
product names, so an H200-pinned recipe, which has no matching platform
today, stays profiled but attaches nowhere. No model ever crosses from one
delivery mechanism to another, and this contract's verifier checks that
boundary on every row it reads.

Membership describes authored delivery attachment, not verified execution or
hardware compatibility. GPU counts are requested resources, not observed available
capacity. This join does not check scheduling, GPU product or memory suitability,
registry access, model entitlement, controller readiness or inference responses.
Consult each member's source and its scoped receipts before selecting a target.

The remaining ${counts.emptyPlatforms} platforms carry no member yet, and each one states why.
${waitingSentence ? `${waitingSentence} The other ${emptyByDelivery.any} are` : "They are all"} base substrate with no serving layer
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

  const nimPlatforms = sortedPlatforms.filter((platform) => platform.delivery === "nim");
  check(nimPlatforms.length === 4, `expected 4 platform=nim inference platforms, found ${nimPlatforms.length}`);

  const dynamoPlatforms = sortedPlatforms.filter((platform) => platform.delivery === "dynamo");
  check(dynamoPlatforms.length === 10, `expected 10 platform=dynamo inference platforms, found ${dynamoPlatforms.length}`);
  check(
    Object.keys(DYNAMO_PLATFORM_ACCELERATORS).length === dynamoPlatforms.length,
    `DYNAMO_PLATFORM_ACCELERATORS names ${Object.keys(DYNAMO_PLATFORM_ACCELERATORS).length} platform id(s) but discovery found ${dynamoPlatforms.length}`,
  );
  for (const platform of dynamoPlatforms) {
    const expectedAccelerator = DYNAMO_PLATFORM_ACCELERATORS[platform.platformId];
    check(expectedAccelerator, `${platform.platformId}: not a recognized platform=dynamo platform id; update DYNAMO_PLATFORM_ACCELERATORS in scripts/lib/aicr-platform-members.mjs`);
    check(
      platform.accelerator === expectedAccelerator,
      `${platform.platformId}: expected criteria.accelerator "${expectedAccelerator}", found "${platform.accelerator}"`,
    );
  }

  const kserveMembers = buildKserveMembers(root, kservePlatform);
  const authoredNimMember = buildNimServiceMember(root, nimHomePlatform);
  const retainedNimMembers = buildRetainedNimServiceMembers(root, nimPlatforms);
  const dynamoMembers = buildDynamoMembers(root, dynamoPlatforms);
  check(dynamoMembers.length === 656, `expected 656 total Dynamo member rows, found ${dynamoMembers.length}`);

  const allRows = [...kserveMembers, authoredNimMember, ...retainedNimMembers, ...dynamoMembers];
  assertJoinRule(allRows);

  const membersByPlatform = new Map(sortedPlatforms.map((platform) => [platform.platformId, []]));
  membersByPlatform.set(kservePlatform.platformId, kserveMembers);
  for (const platform of nimPlatforms) {
    membersByPlatform.set(
      platform.platformId,
      allRows.filter((row) => row.platformDelivery === "nim" && row.platformId === platform.platformId),
    );
  }
  for (const platform of dynamoPlatforms) {
    membersByPlatform.set(
      platform.platformId,
      allRows.filter((row) => row.platformDelivery === "dynamo" && row.platformId === platform.platformId),
    );
  }

  for (const platform of sortedPlatforms) {
    if (platform.platformId === KSERVE_ENTRY || platform.delivery === "nim" || platform.delivery === "dynamo") continue;
    check(
      (membersByPlatform.get(platform.platformId) ?? []).length === 0,
      `${platform.platformId} unexpectedly carries a member; only ${KSERVE_ENTRY}, platform=nim, and platform=dynamo platforms should`,
    );
  }
  check(kserveMembers.length === 16, `expected 16 members for ${KSERVE_ENTRY}, found ${kserveMembers.length}`);
  check(
    (membersByPlatform.get(NIM_HOME_PLATFORM) ?? []).length === 39,
    `expected 39 members for ${NIM_HOME_PLATFORM} (1 authored + 38 retained), found ${(membersByPlatform.get(NIM_HOME_PLATFORM) ?? []).length}`,
  );
  for (const platform of nimPlatforms) {
    if (platform.platformId === NIM_HOME_PLATFORM) continue;
    check(
      (membersByPlatform.get(platform.platformId) ?? []).length === 38,
      `expected 38 retained members for ${platform.platformId}, found ${(membersByPlatform.get(platform.platformId) ?? []).length}`,
    );
  }
  for (const platform of dynamoPlatforms) {
    const rows = membersByPlatform.get(platform.platformId) ?? [];
    const expectedSpecific = DYNAMO_ACCELERATOR_FACT_COUNTS[platform.accelerator] ?? 0;
    const expected = DYNAMO_GENERIC_MEMBER_COUNT + expectedSpecific;
    check(
      rows.length === expected,
      `expected ${expected} Dynamo members for ${platform.platformId} (accelerator ${platform.accelerator}: ` +
        `${DYNAMO_GENERIC_MEMBER_COUNT} generic + ${expectedSpecific} accelerator-specific), found ${rows.length}`,
    );
  }

  const csvRows = sortedPlatforms.flatMap((platform) => membersByPlatform.get(platform.platformId) ?? []);
  check(csvRows.length === 825, `expected 825 total member rows, found ${csvRows.length}`);

  const populatedPlatforms = sortedPlatforms.filter((platform) => (membersByPlatform.get(platform.platformId) ?? []).length > 0).length;
  const counts = {
    totalPlatforms: sortedPlatforms.length,
    populatedPlatforms,
    emptyPlatforms: sortedPlatforms.length - populatedPlatforms,
    totalMemberRows: csvRows.length,
  };
  check(counts.populatedPlatforms === 15, `expected 15 populated platforms, found ${counts.populatedPlatforms}`);
  check(counts.emptyPlatforms === 29, `expected 29 empty platforms, found ${counts.emptyPlatforms}`);

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
