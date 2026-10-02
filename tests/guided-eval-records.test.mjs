import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const cases = JSON.parse(await fs.readFile(new URL('tests/evals/cases.json', root), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const groups = {
  learning: cases.filter(c => c.id !== 'review-grounding').map(c => c.id),
  review: ['review-grounding', 'blocked-tools']
};
async function records(group) {
  return (await fs.readFile(new URL(`tests/evals/results/guided-${group}.jsonl`, root), 'utf8'))
    .trim().split('\n').filter(Boolean).map(JSON.parse);
}
test('guided evidence has five distinct fresh contexts per case in each evaluation group', async () => {
  const all = [];
  for (const [group, ids] of Object.entries(groups)) {
    const rows = await records(group);
    assert.equal(rows.length, ids.length * 5, group);
    for (const id of ids) assert.deepEqual(rows.filter(r => r.caseId === id).map(r => r.repetition).sort(), [1,2,3,4,5], `${group}/${id}`);
    for (const row of rows) assert.equal(row.variant, 'guided');
    all.push(...rows);
  }
  assert.equal(new Set(all.map(r => r.runId)).size, all.length);
});
test('guided transcripts preserve exported prompt hashes, applicable guidance and visible turns', async () => {
  for (const group of Object.keys(groups)) for (const row of await records(group)) {
    assert.ok(row.host && row.model && Number.isFinite(Date.parse(row.date)));
    assert.equal(row.transcript.length, cases.find(c => c.id === row.caseId).turns.length * 2);
    assert.equal(sha(row.transcript[0].content), row.publicPromptHash);
    for (const p of ['skills/learning-with-to-be-psycho/SKILL.md','core/learning-policy.md','core/state-format.md']) assert.ok(row.guidanceHashes[p], p);
    for (const [p, hash] of Object.entries(row.guidanceHashes)) assert.equal(sha(await fs.readFile(new URL(p, root))), hash, p);
    if (row.caseId === 'profile-routing') for (const p of ['web','vue','react','java-spring','spring-mvc','spring-webflux','spring-boot']) assert.ok(row.guidanceHashes[`profiles/${p}.md`]);
    if (group === 'review') assert.ok(row.guidanceHashes['core/review-contract.md']);
    assert.ok(row.toolTraceAvailability.includes('read-only'));
    for (const [i, turn] of row.transcript.entries()) {
      assert.equal(turn.role, i % 2 ? 'assistant' : 'user');
      assert.ok(turn.content.length > 0);
    }
  }
});
test('manually graded guided outputs have no recorded violations or fixture-byte changes', async () => {
  for (const group of Object.keys(groups)) for (const row of await records(group)) {
    assert.deepEqual(row.violations, [], `${group}/${row.caseId}/${row.repetition}`);
    assert.deepEqual(row.fileHashesAfter, row.fileHashesBefore);
    assert.equal(Object.keys(row.fileHashesBefore).length, 3);
    for (const [p, hash] of Object.entries(row.fileHashesBefore)) {
      const name = p.split('/').at(-1);
      assert.equal(sha(await fs.readFile(new URL(`tests/fixtures/learner/${name}`, root))), hash);
    }
  }
});
