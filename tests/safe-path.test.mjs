import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { temp } from './test-helpers.mjs';
const api=await import('../core/safe-path.mjs').catch(()=>({
}));
test('safe resolver exists and accepts spaces Korean and portable separators',async t=>{
  assert.equal(typeof api.resolveInside,'function');
  const r=await temp(t);
  assert.equal(await api.resolveInside(r,'폴더 name\\state.json'),path.join(r,'폴더 name','state.json'));
});
for(const p of ['../outside','/etc/passwd','C:\\outside','C:relative','\\\\host\\share','a/../b','a//b','./a','a/','a\0b','x:stream','CON','a/NUL.txt','a.','a ','a/COM1'])test(`rejects unsafe path ${JSON.stringify(p)}`,async t=>{
  const r=await temp(t);
  await assert.rejects(api.resolveInside(r,p),{
    code:'UNSAFE_PATH'
  });
});
test('rejects external, internal and broken links conservatively',async t=>{
  const r=await temp(t);
  await fs.mkdir(path.join(r,'real'));
  for(const [name,target] of [['outer','/tmp'],['inner',path.join(r,'real')],['broken',path.join(r,'absent')]]){
    await fs.symlink(target,path.join(r,name));
    await assert.rejects(api.resolveInside(r,`${name}/x`),{
      code:'UNSAFE_PATH'
    });
  }
});
test('rejects aliases and non-directory parents',async t=>{
  const r=await temp(t);
  await fs.writeFile(path.join(r,'State'),'owned');
  await assert.rejects(api.resolveInside(r,'state'),{
    code:'UNSAFE_PATH'
  });
  await assert.rejects(api.resolveInside(r,'State/child'),{
    code:'UNSAFE_PATH'
  });
});
test('rejects hardlinked destinations and symlink root',async t=>{
  const r=await temp(t),outside=await temp(t);
  await fs.writeFile(path.join(outside,'x'),'outside');
  await fs.link(path.join(outside,'x'),path.join(r,'hard'));
  await assert.rejects(api.resolveInside(r,'hard'),{
    code:'UNSAFE_PATH'
  });
  await fs.symlink(r,path.join(outside,'root'));
  await assert.rejects(api.resolveInside(path.join(outside,'root'),'x'),{
    code:'UNSAFE_PATH'
  });
});
for(const p of ['line\nbreak','tab\tname','control\u0001','CONIN$','CONOUT$','COM¹','LPT².txt'])test(`rejects Windows special/control alias ${JSON.stringify(p)}`,async t=>{
  const r=await temp(t);
  await assert.rejects(api.resolveInside(r,p),{
    code:'UNSAFE_PATH'
  });
});
