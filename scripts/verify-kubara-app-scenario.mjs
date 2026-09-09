import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { parseDocs, repoRoot } from './lib/proof-common.mjs';
import { checkStackApiVersions } from './lib/stack-api-compatibility.mjs';

const root = join(repoRoot, 'runs/workshop-kubara-app/2026-09-09');
const receipt = JSON.parse(readFileSync(join(root, 'receipt.json'), 'utf8'));
for (const [path, digest] of Object.entries(receipt.files)) {
  assert.equal(createHash('sha256').update(readFileSync(join(root, path))).digest('hex'), digest, `receipt bytes changed: ${path}`);
}
const rendered = gunzipSync(readFileSync(join(root, 'rendered.yaml.gz')));
assert.equal(createHash('sha256').update(rendered).digest('hex'), receipt.renderedSha256);
const docs = parseDocs(rendered.toString());
assert.equal(docs.length, 135);
assert.deepEqual(checkStackApiVersions(docs).incompatible, [{
  identity: 'external-secrets.io/v1beta1|ExternalSecret|shop|shop-web-db',
  crds: ['externalsecrets.external-secrets.io'], servedVersions: ['v1'], reason: 'version-not-served',
}]);
assert.deepEqual(receipt.commands.map(command => command.argv), [
  ['cub', 'stack', 'certify', 'kubara-shop-first-try'],
  ['cub', 'stack', 'certify', 'kubara-shop-platform'],
  ['cub', 'stack', 'sandbox', 'kubara-shop-platform', '--out', 'rendered.yaml'],
]);
assert.equal(receipt.commands[0].exitCode, 1);
assert.equal(receipt.commands[1].exitCode, 0);
assert.equal(receipt.commands[2].exitCode, 0);
assert.match(readFileSync(join(root, 'first-try.log'), 'utf8'), /=> REJECTED/);
assert.match(readFileSync(join(root, 'repaired.log'), 'utf8'), /=> CERTIFIED/);
assert.equal(receipt.scope, 'static-local-no-target');

// Correcting only the unserved version clears this check, without claiming readiness.
const corrected = structuredClone(docs);
corrected.find(x => x.kind === 'ExternalSecret' && x.metadata.name === 'shop-web-db').apiVersion = 'external-secrets.io/v1';
assert.deepEqual(checkStackApiVersions(corrected).incompatible, []);
const crd = docs.find(x => x.kind === 'CustomResourceDefinition' && x.spec.names.kind === 'ExternalSecret');
const cr = docs.find(x => x.kind === 'ExternalSecret');
assert.equal(checkStackApiVersions([crd, cr]).incompatible[0].reason, 'version-not-served');
assert.equal(checkStackApiVersions([crd, { ...cr, kind: 'UnrelatedKind' }]).checked.length, 0, 'group alone is insufficient');
assert.equal(checkStackApiVersions([cr]).checked.length, 0, 'absent CRD is not checked');
assert.equal(checkStackApiVersions([crd, structuredClone(crd), cr]).incompatible[0].reason, 'ambiguous-crd');
console.log('verified retained Kubara app API mismatch and served-version regression cases; live readiness not checked');
