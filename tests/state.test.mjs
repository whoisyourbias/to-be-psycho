import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stateFixture } from './test-helpers.mjs';
const api = await import('../core/state.mjs').catch(()=>({
}));
test('state validator exists and accepts portable fixture without modifying it',async()=>{
  assert.equal(typeof api.assertState,'function');
  const s=await stateFixture(),before=JSON.stringify(s);
  assert.equal(api.assertState(s),s);
  assert.equal(JSON.stringify(s),before);
});
test('rejects unsupported schema distinctly',async()=>{
  assert.equal(typeof api.assertState,'function');
  assert.throws(()=>api.assertState({
    ...awaitable,schemaVersion:2
  }),{
    code:'UNSUPPORTED_SCHEMA'
  });
});
const awaitable = await stateFixture();
for(const [label,change] of [
['negative revision',s=>s.revision=-1],['fractional revision',s=>s.revision=1.5],['string revision',s=>s.revision='0'],['missing session',s=>delete s.sessionId],['bad stage',s=>s.stage.status='passed'],['invalid timestamp',s=>s.hints[0].at='yesterday'],['nonexistent attempt',s=>s.hints[0].attemptId='missing'],['duplicate hints',s=>s.hints.push({
  ...s.hints[0]
})],['invented execution source',s=>s.evidence[0].actor='harness'],['bad result',s=>s.evidence[0].result='verified'],['unknown field',s=>s.apiKey='do-not-store'],['unconfirmed active stage',s=>s.scope.confirmed=false]
]) test(`rejects ${label}`,async()=>{
  assert.equal(typeof api.assertState,'function');
  const s=await stateFixture();
  change(s);
  assert.throws(()=>api.assertState(s),{
    code:'STATE_CORRUPT'
  });
});
test('rejects malformed/non-object input',()=>{
  assert.equal(typeof api.assertState,'function');
  for(const s of [null,[],'{broken'])assert.throws(()=>api.assertState(s),{
    code:'STATE_CORRUPT'
  });
});
test('state format names every canonical top-level field',async()=>{
  const doc=await readFile(new URL('../core/state-format.md',import.meta.url),'utf8');
  for(const k of Object.keys(await stateFixture()))assert.ok(doc.includes(k),k);
});
