import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { temp } from './test-helpers.mjs';
const api=await import('../core/snapshot.mjs').catch(()=>({
}));
const paths=['app.js','app.test.js','config.json','package-lock.json'];
const input={
  paths,environment:{
    nodeVersion:'22.0.0',os:'linux'
  },coverage:'complete'
};
async function setup(t){
  const root=await temp(t);
  await Promise.all(paths.map(p=>fs.writeFile(path.join(root,p),'original '+p)));
  return root;
}
const evidence=s=>({
  snapshotId:s.id,environmentId:s.environmentId
});
test('snapshot API exists',()=>{
  assert.equal(typeof api.captureSnapshot,'function');
  assert.equal(typeof api.evidenceFreshness,'function');
});
test('stable bytes and sorted environment make stable ids independent of order',async t=>{
  const r=await setup(t);
  const a=await api.captureSnapshot(r,input);
  const b=await api.captureSnapshot(r,{
    ...input,paths:[...paths].reverse(),environment:{
      os:'linux',nodeVersion:'22.0.0'
    }
  });
  assert.equal(a.id,b.id);
  assert.equal(a.environmentId,b.environmentId);
  assert.equal(a.coverage,'complete');
  assert.equal(api.evidenceFreshness(evidence(a),b),'current');
  assert.ok(Date.parse(a.capturedAt));
});
for(const p of paths) for(const operation of ['edit','delete']) test(`${operation} ${p} invalidates evidence without relying on git`,async t=>{
  const r=await setup(t),a=await api.captureSnapshot(r,input);
  if(operation==='edit')await fs.writeFile(path.join(r,p),'changed');
  else await fs.unlink(path.join(r,p));
  const b=await api.captureSnapshot(r,input);
  assert.notEqual(a.id,b.id);
  assert.notEqual(api.evidenceFreshness(evidence(a),b),'current');
});
test('changed environment makes complete evidence stale',async t=>{
  const r=await setup(t),a=await api.captureSnapshot(r,input),b=await api.captureSnapshot(r,{
    ...input,environment:{
      ...input.environment,nodeVersion:'24.0.0'
    }
  });
  assert.equal(a.id,b.id);
  assert.equal(api.evidenceFreshness(evidence(a),b),'stale');
});
test('unknown evidence ids or partial coverage never establish currentness',async t=>{
  const r=await setup(t),a=await api.captureSnapshot(r,input);
  for(const e of [{
    snapshotId:null,environmentId:a.environmentId
  },{
    snapshotId:a.id,environmentId:null
  }])assert.equal(api.evidenceFreshness(e,a),'unknown');
  assert.equal(api.evidenceFreshness(evidence(a),{
    ...a,coverage:'unknown'
  }),'unknown');
});
test('omitted inputs and unlisted executable/config files are unknown',async t=>{
  const r=await setup(t);
  for(const i of [{
    ...input,paths:[]
  },{
    ...input,paths:paths.slice(1)
  },{
    ...input,environment:{
    }
  },{
    ...input,coverage:'unknown'
  },{
  }])assert.equal((await api.captureSnapshot(r,i)).coverage,'unknown');
  await fs.writeFile(path.join(r,'outside-scope.js'),'affects result');
  assert.equal((await api.captureSnapshot(r,input)).coverage,'unknown');
});
test('own state and git metadata do not stale application evidence',async t=>{
  const r=await setup(t),a=await api.captureSnapshot(r,input);
  await fs.mkdir(path.join(r,'.to-be-psycho'));
  await fs.writeFile(path.join(r,'.to-be-psycho/state.json'),'state');
  await fs.mkdir(path.join(r,'.git'));
  await fs.writeFile(path.join(r,'.git/HEAD'),'ref');
  const b=await api.captureSnapshot(r,input);
  assert.equal(b.coverage,'complete');
  assert.equal(a.id,b.id);
});
test('read failures and links are unknown and never traverse external files',async t=>{
  const r=await setup(t);
  await fs.mkdir(path.join(r,'directory'));
  assert.equal((await api.captureSnapshot(r,{
    ...input,paths:[...paths,'directory']
  })).coverage,'unknown');
  await fs.symlink('/etc/passwd',path.join(r,'link'));
  const s=await api.captureSnapshot(r,{
    ...input,paths:[...paths,'link']
  });
  assert.equal(s.coverage,'unknown');
  assert.ok(!s.files.some(f=>f.path==='link'&&f.sha256));
});
test('a change between reads is detected (real IO wrapped by test)',async t=>{
  const r=await setup(t);
  const original=fs.readFile;
  let count=0;
  t.mock.method(fs,'readFile',async(...args)=>{
    const result=await original(...args);
    if(String(args[0])===path.join(r,'app.js')&&++count===1)await fs.writeFile(path.join(r,'app.js'),'changed mid scan');
    return result;
  });
  assert.equal((await api.captureSnapshot(r,input)).coverage,'unknown');
});
test('secret-like environment fields downgrade coverage and are not returned',async t=>{
  const r=await setup(t),s=await api.captureSnapshot(r,{
    ...input,environment:{
      TOKEN:'secret-value'
    }
  });
  assert.equal(s.coverage,'unknown');
  assert.ok(!JSON.stringify(s).includes('secret-value'));
});
test('an aliased root is not traversed after containment validation fails',async t=>{
  const r=await setup(t),outer=await temp(t),link=path.join(outer,'alias');
  await fs.symlink(r,link);
  let reads=0;
  const original=fs.readFile;
  t.mock.method(fs,'readFile',async(...args)=>{
    reads++;
    return original(...args);
  });
  const s=await api.captureSnapshot(link,input);
  assert.equal(s.coverage,'unknown');
  assert.equal(reads,0);
  assert.deepEqual(s.files,[]);
});
test('environment identity uses locale-independent key ordering across hosts',async t=>{
  const r=await setup(t);
  const environment={
    z:'1','ä':'2'
  };
  const s=await api.captureSnapshot(r,{
    ...input,environment
  });
  const {
    sha
  }
  =await import('./test-helpers.mjs');
  assert.equal(s.environmentId,sha(JSON.stringify([['z','1'],['ä','2']])));
});
test('null and non-object snapshot inputs are conservatively unknown',async t=>{
  const root=await setup(t);
  for(const input of [null,42,'paths']) assert.equal((await api.captureSnapshot(root,input)).coverage,'unknown');
});
test('evidence from an incomplete snapshot never becomes current after an unlisted file disappears', async t => {
  const root = await setup(t);
  await fs.writeFile(path.join(root, 'unlisted.config.json'), '{"enabled":true}');
  const before = await api.captureSnapshot(root, input);
  assert.equal(before.coverage, 'unknown');
  await fs.unlink(path.join(root, 'unlisted.config.json'));
  const after = await api.captureSnapshot(root, input);
  assert.equal(after.coverage, 'complete');
  assert.notEqual(before.id, after.id);
  assert.equal(api.evidenceFreshness(evidence(before), after), 'unknown');
});
test('explicit unknown coverage provenance survives a later complete capture of identical bytes', async t => {
  const root = await setup(t);
  const before = await api.captureSnapshot(root, {...input, coverage:'unknown'});
  const after = await api.captureSnapshot(root, input);
  assert.notEqual(before.id, after.id);
  assert.equal(api.evidenceFreshness(evidence(before), after), 'unknown');
});
