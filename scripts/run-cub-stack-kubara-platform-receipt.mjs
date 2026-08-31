// The second producer through the same verbs: the composition proposal's
// stage-one Kubara platform, cert-manager, Traefik, and metrics-server,
// composed from the catalog's certified renders and run through
// `cub stack sandbox kubara-platform`. The eks-inference stack proved the
// bundle form; this one proves the render form, so the manifest is
// producer-neutral in fact, not only in design.

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { check, repoRoot, write } from "./lib/proof-common.mjs";

const outRoot = join(repoRoot, "data", "eks-inf-replica", "stack-sandbox");
const result = execFileSync("node", [join(repoRoot, "scripts", "cub-stack.mjs"), "sandbox", "kubara-platform"], { encoding: "utf8" });

check(result.includes("=> CERTIFIED"), "acceptance: the platform must certify");
check(result.includes("86 objects total"), "acceptance: the sandbox must render the full composition");
check(result.includes("cert-manager is in the stack and can issue it"), "acceptance: the webhook warning must carry its cert-manager note");
check(result.includes("3 must already exist"), "acceptance: the namespace prerequisites must be named, not hidden");

write(join(outRoot, "kubara-platform-receipt.yaml"), [
  "apiVersion: evidence.confighub.com/v1alpha1",
  "kind: StackSandboxReceipt",
  "metadata:",
  "  name: cub-stack-kubara-platform",
  "spec:",
  '  command: "node scripts/cub-stack.mjs sandbox kubara-platform"',
  '  stackDefinition: "examples/cub-stack/stacks/kubara-platform.yaml"',
  "  certified: true",
  "  transcript:",
  ...result.trimEnd().split("\n").map((line) => `    - "${line.replaceAll('"', "'")}"`),
  "  boundaries:",
  '    - "The components are the catalog\'s committed certified renders, which the verify chain re-checks on every pull request; the receipt fields carry the provenance."',
  '    - "This platform creates no namespaces; cert-manager, kube-system, and traefik must exist at the destination, and the certify step says so."',
  '    - "A certified sandbox is a free look at the composition, not a deployment."',
].join("\n") + "\n");
console.log("receipt written: kubara-platform certified, 3 components, 86 objects, prerequisites named");
