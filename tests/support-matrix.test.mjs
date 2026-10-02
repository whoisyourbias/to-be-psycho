import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const matrix=()=>fs.readFile(new URL('../docs/support-matrix.json',import.meta.url),'utf8').then(JSON.parse);
function validate(row){
  for(const key of['host','hostVersion','model','os','osVersion','executionMode','nodeVersion','permissionConfig','packageSha256','checkedAt','status','evidencePaths','limitations'])assert.ok(Object.hasOwn(row,key),key);
  assert.ok(['passed','failed','not-tested'].includes(row.status));
  assert.ok(Array.isArray(row.evidencePaths));
  assert.ok(Array.isArray(row.limitations));
  assert.match(row.packageSha256,/^[a-f0-9]{64}$/);
  assert.ok(Number.isFinite(Date.parse(row.checkedAt)));
  if(row.status==='passed'){
    assert.ok(row.evidencePaths.length);
    for(const key of['hostVersion','model','osVersion','nodeVersion','permissionConfig'])assert.ok(typeof row[key]==='string'&&row[key]&&!/unknown|not.tested/i.test(row[key]),key);
  }
}
test('all four native target combinations have explicit support records',async()=>{
  const rows=await matrix();
  assert.equal(rows.length,4);
  for(const h of['claude','codex'])for(const os of['Windows','macOS'])assert.ok(rows.some(r=>r.host===h&&r.os===os&&r.executionMode==='native'));
  rows.forEach(validate);
});
test('unverified acceptance cannot be promoted to passed without real evidence',async()=>{
  for(const row of await matrix()){
    validate(row);
    if(row.status==='not-tested')assert.throws(()=>validate({
      ...row,status:'passed'
    }));
    for(const key of['host','hostVersion','os','osVersion','permissionConfig']){
      const bad={
        ...row
      };
      delete bad[key];
      assert.throws(()=>validate(bad));
    }
  }
});
test('claimed acceptance evidence paths exist',async()=>{
  for(const row of await matrix())for(const p of row.evidencePaths)await fs.access(new URL('../'+p,import.meta.url));
});
test('README and acceptance clearly distinguish tests from live host support',async()=>{
  const readme=await fs.readFile(new URL('../README.md',import.meta.url),'utf8'),acceptance=await fs.readFile(new URL('../docs/acceptance.md',import.meta.url),'utf8');
  assert.ok(readme.includes('미검증'));
  assert.ok(acceptance.includes('not-tested'));
  assert.ok(acceptance.includes('Linux'));
});
