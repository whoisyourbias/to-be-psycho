import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { temp,stateFixture,bytesTree,sha } from './test-helpers.mjs';
const api=await import('../core/state-store.mjs').catch(()=>({
}));
const statePath=r=>path.join(r,'.to-be-psycho/state.json');
async function start(t){
  const r=await temp(t);
  await api.saveState(r,await stateFixture(),null);
  return r;
}
test('store API exists',()=>{
  for(const n of ['loadState','saveState','recoverState'])assert.equal(typeof api[n],'function');
});
test('absent state alone returns null and initial save uses revision zero',async t=>{
  const r=await temp(t);
  assert.equal(await api.loadState(r),null);
  const s=await api.saveState(r,await stateFixture(),null);
  assert.equal(s.revision,0);
  assert.deepEqual(await api.loadState(r),s);
});
test('save increments revision and backs up exact previous valid bytes',async t=>{
  const r=await start(t),old=await fs.readFile(statePath(r));
  const n=await stateFixture();
  n.stage.nextAction='Try again';
  assert.equal((await api.saveState(r,n,0)).revision,1);
  assert.deepEqual(await fs.readFile(statePath(r)+'.bak'),old);
});
test('stale or absent expected revision cannot overwrite current state',async t=>{
  const r=await start(t),before=await fs.readFile(statePath(r));
  for(const rev of [null,1,-1])await assert.rejects(api.saveState(r,await stateFixture(),rev),{
    code:'REVISION_CONFLICT'
  });
  assert.deepEqual(await fs.readFile(statePath(r)),before);
});
test('parallel writers allow only one and leave valid monotonic state',async t=>{
  const r=await start(t),s=await stateFixture();
  const results=await Promise.allSettled([api.saveState(r,s,0),api.saveState(r,s,0)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.ok(['STATE_BUSY','REVISION_CONFLICT'].includes(results.find(x=>x.status==='rejected').reason.code));
  assert.equal((await api.loadState(r)).revision,1);
});
test('abandoned lock is not automatically deleted',async t=>{
  const r=await start(t);
  await fs.writeFile(path.join(r,'.to-be-psycho/state.lock'),'owner');
  await assert.rejects(api.saveState(r,await stateFixture(),0),{
    code:'STATE_BUSY'
  });
  assert.equal(await fs.readFile(path.join(r,'.to-be-psycho/state.lock'),'utf8'),'owner');
});
test('corrupt JSON stays intact and unsupported schema remains distinct',async t=>{
  const r=await start(t);
  for(const [bytes,code]of [['{broken','STATE_CORRUPT'],[JSON.stringify({
    ...await stateFixture(),schemaVersion:2
  }),'UNSUPPORTED_SCHEMA']]){
    await fs.writeFile(statePath(r),bytes);
    await assert.rejects(api.loadState(r),{
      code
    });
    await assert.rejects(api.saveState(r,await stateFixture(),0),{
      code
    });
    assert.equal(await fs.readFile(statePath(r),'utf8'),bytes);
  }
});
test('read errors are not absence',async t=>{
  const r=await start(t),original=fs.readFile;
  t.mock.method(fs,'readFile',async(p,...args)=>{
    if(p===statePath(r))throw Object.assign(new Error('denied'),{
      code:'EACCES'
    });
    return original(p,...args);
  });
  await assert.rejects(api.loadState(r),{
    code:'EACCES'
  });
});
for(const method of ['open','rename'])test(`${method} failure keeps current state valid and learner bytes untouched`,async t=>{
  const r=await start(t);
  await fs.writeFile(path.join(r,'source.js'),'learner');
  const before=await fs.readFile(statePath(r));
  const original=fs[method];
  t.mock.method(fs,method,async(...args)=>{
    if(method==='open'&&String(args[0]).includes('.tmp-')||method==='rename'&&args[1]===statePath(r))throw Object.assign(new Error('injected failure'),{
      code:'EIO'
    });
    return original(...args);
  });
  await assert.rejects(api.saveState(r,await stateFixture(),0),{
    code:'EIO'
  });
  assert.deepEqual(await fs.readFile(statePath(r)),before);
  assert.equal(await fs.readFile(path.join(r,'source.js'),'utf8'),'learner');
});
test('backup recovery requires explicit matching approval and preserves corrupt bytes',async t=>{
  const r=await start(t);
  await api.saveState(r,await stateFixture(),0);
  const bak=await fs.readFile(statePath(r)+'.bak');
  await fs.writeFile(statePath(r),'{broken');
  for(const a of [null,{
    confirmed:false,backupSha256:sha(bak)
  },{
    confirmed:true,backupSha256:'changed'
  }])await assert.rejects(api.recoverState(r,a),{
    code:'RECOVERY_CHANGED'
  });
  const recovered=await api.recoverState(r,{
    confirmed:true,backupSha256:sha(bak)
  });
  assert.equal(recovered.revision,0);
  const preserved=(await fs.readdir(path.dirname(statePath(r)))).find(n=>n.startsWith('state.json.corrupt-'));
  assert.ok(preserved);
  assert.equal(await fs.readFile(path.join(path.dirname(statePath(r)),preserved),'utf8'),'{broken');
  assert.deepEqual(await fs.readFile(statePath(r)),bak);
});
test('healthy state cannot be rolled back through recovery',async t=>{
  const r=await start(t);
  await api.saveState(r,await stateFixture(),0);
  const bak=await fs.readFile(statePath(r)+'.bak');
  await assert.rejects(api.recoverState(r,{
    confirmed:true,backupSha256:sha(bak)
  }),{
    code:'RECOVERY_CHANGED'
  });
});
test('linked state folder refuses writes and reads',async t=>{
  const r=await temp(t),other=await temp(t);
  await fs.symlink(other,path.join(r,'.to-be-psycho'));
  await assert.rejects(api.saveState(r,await stateFixture(),null),{
    code:'UNSAFE_PATH'
  });
  await assert.rejects(api.loadState(r),{
    code:'UNSAFE_PATH'
  });
  assert.deepEqual(await bytesTree(other),{
  });
});
test('save never changes source tests policy config or gitignore',async t=>{
  const r=await temp(t);
  for(const p of ['app.js','app.test.js','AGENTS.md','CLAUDE.md','config.json','.gitignore'])await fs.writeFile(path.join(r,p),p);
  const before=await bytesTree(r);
  await api.saveState(r,await stateFixture(),null);
  const after=await bytesTree(r);
  for(const [p,h]of Object.entries(before))assert.equal(after[p],h);
});
test('failed temporary write preserves state and cleans its temporary file',async t=>{
  const r=await start(t),before=await fs.readFile(statePath(r)),original=fs.open;
  t.mock.method(fs,'open',async(...args)=>{
    const h=await original(...args);
    if(String(args[0]).includes('.tmp-'))h.writeFile=async()=>{
      throw Object.assign(new Error('write failure'),{
        code:'EIO'
      });
    };
    return h;
  });
  await assert.rejects(api.saveState(r,await stateFixture(),0),{
    code:'EIO'
  });
  assert.deepEqual(await fs.readFile(statePath(r)),before);
  assert.ok(!(await fs.readdir(path.dirname(statePath(r)))).some(n=>n.includes('.tmp-')));
});
test('noncooperating edit after revision read is detected before replacement',async t=>{
  const r=await start(t),original=fs.rename;
  const changed={
    ...await stateFixture(),revision:7
  };
  t.mock.method(fs,'rename',async(...args)=>{
    const out=await original(...args);
    if(args[1]===statePath(r)+'.bak')await fs.writeFile(statePath(r),JSON.stringify(changed));
    return out;
  });
  await assert.rejects(api.saveState(r,await stateFixture(),0),{
    code:'REVISION_CONFLICT'
  });
  assert.equal((await api.loadState(r)).revision,7);
});
test('recovery refuses a state changed while corrupt copy was preserved',async t=>{
  const r=await start(t);
  await api.saveState(r,await stateFixture(),0);
  const bak=await fs.readFile(statePath(r)+'.bak');
  await fs.writeFile(statePath(r),'{broken');
  const original=fs.open;
  t.mock.method(fs,'open',async(...args)=>{
    const h=await original(...args);
    if(String(args[0]).includes('.corrupt-'))await fs.writeFile(statePath(r),JSON.stringify({
      ...await stateFixture(),revision:9
    }));
    return h;
  });
  await assert.rejects(api.recoverState(r,{
    confirmed:true,backupSha256:sha(bak)
  }),{
    code:'RECOVERY_CHANGED'
  });
  assert.equal((await api.loadState(r)).revision,9);
});
test('save guards the destination after the temporary state has been flushed', async t => {
  const root = await start(t);
  const originalOpen = fs.open;
  t.mock.method(fs, 'open', async (...args) => {
    const handle = await originalOpen(...args);
    if (String(args[0]).startsWith(statePath(root) + '.tmp-')) {
      const originalSync = handle.sync.bind(handle);
      handle.sync = async () => {
        await originalSync();
        await fs.writeFile(statePath(root), JSON.stringify({...await stateFixture(), revision:7}));
      };
    }
    return handle;
  });
  await assert.rejects(api.saveState(root, await stateFixture(), 0), {code:'REVISION_CONFLICT'});
  assert.equal((await api.loadState(root)).revision, 7);
});
test('initial save refuses a state created while its temporary file is written', async t => {
  const root = await temp(t), originalOpen = fs.open;
  t.mock.method(fs, 'open', async (...args) => {
    const handle = await originalOpen(...args);
    if (String(args[0]).startsWith(statePath(root) + '.tmp-')) {
      await fs.writeFile(statePath(root), JSON.stringify({...await stateFixture(), revision:8}));
    }
    return handle;
  });
  await assert.rejects(api.saveState(root, await stateFixture(), null), {code:'REVISION_CONFLICT'});
  assert.equal((await api.loadState(root)).revision, 8);
});
test('recovery guards both original and approved backup after temporary write', async t => {
  for (const changed of ['original', 'backup']) {
    const root = await start(t);
    await api.saveState(root, await stateFixture(), 0);
    const backup = await fs.readFile(statePath(root) + '.bak');
    await fs.writeFile(statePath(root), '{broken');
    const originalOpen = fs.open;
    const mock = t.mock.method(fs, 'open', async (...args) => {
      const handle = await originalOpen(...args);
      if (String(args[0]).startsWith(statePath(root) + '.tmp-')) {
        await fs.writeFile(statePath(root) + (changed === 'backup' ? '.bak' : ''), JSON.stringify({...await stateFixture(), revision:9}));
      }
      return handle;
    });
    await assert.rejects(api.recoverState(root, {confirmed:true, backupSha256:sha(backup)}), {code:'RECOVERY_CHANGED'});
    if (changed === 'original') assert.equal((await api.loadState(root)).revision, 9);
    else assert.equal(await fs.readFile(statePath(root), 'utf8'), '{broken');
    mock.mock.restore();
  }
});
