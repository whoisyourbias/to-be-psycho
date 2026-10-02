import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const cases = JSON.parse(await readFile(new URL('./evals/cases.json', import.meta.url)));
const readRecords = async () => (await readFile(new URL('./evals/results/control.jsonl', import.meta.url), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
test('eight fixed distinct scenarios exist', () => {
  assert.equal(cases.length, 8);
  assert.equal(new Set(cases.map(c=>c.id)).size,8);
});
test('each baseline has at least five actual fresh-context records', async()=>{
  const records=await readRecords();
  for(const c of cases) assert.ok(records.filter(r=>r.caseId===c.id&&r.variant==='control').length>=5,c.id);
});
test('records preserve nonempty visible transcripts and run identity',async()=>{
  for(const r of await readRecords()){
    assert.ok(r.transcript.length>0);
    for(const k of ['host','model','date','runId']) assert.ok(r[k],k);
    assert.ok(Array.isArray(r.violations));
    assert.deepEqual(r.fileHashesBefore,r.fileHashesAfter);
  }
});
test('repetitions and contexts are unique',async()=>{
  const rs=await readRecords();
  assert.equal(new Set(rs.map(r=>`${r.caseId}:${r.variant}:${r.repetition}`)).size,rs.length);
  assert.equal(new Set(rs.map(r=>r.runId)).size,rs.length);
});
