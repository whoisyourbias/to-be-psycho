import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import{
  temp,bytesTree,sha
}
from './test-helpers.mjs';
const api=await import('../install/package.mjs').catch(()=>({
}));
const source=fileURLToPath(new URL('../',import.meta.url));
const skill=host=>`${host==='claude'?'.claude':'.agents'}/skills/learning-with-to-be-psycho`;
async function bundle(t,host='codex'){
  const r=await temp(t),out=path.join(r,'bundle');
  await api.buildPackage(source,host,out);
  return out;
}
async function installed(t,host='codex'){
  const b=await bundle(t,host),r=await temp(t),p=await api.planInstall(b,r,'install');
  assert.deepEqual(p.conflicts,[]);
  assert.equal((await api.applyInstall(p)).status,'applied');
  return{
    b,r
  };
}
test('package library exists without adding a CLI',async()=>{
  for(const n of ['buildPackage','planInstall','applyInstall'])assert.equal(typeof api[n],'function');
  const p=JSON.parse(await fs.readFile(path.join(source,'package.json')));
  assert.equal(p.bin,undefined);
  assert.equal(p.dependencies,undefined);
});
for(const host of ['claude','codex'])test(`${host} bundle has self-contained references and verified content hashes`,async t=>{
  const b=await bundle(t,host),m=JSON.parse(await fs.readFile(path.join(b,'manifest.json')));
  assert.equal(m.host,host);
  assert.equal(m.packageVersion,'0.1.0');
  assert.ok(m.files.length>15);
  assert.ok(!m.files.some(f=>f.path.endsWith('install-manifest.json')));
  for(const f of m.files){
    const bytes=await fs.readFile(path.join(b,f.path));
    assert.equal(sha(bytes),f.sha256,f.path);
    if(f.path.endsWith('.md'))for(const match of bytes.toString().matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)){
      if(!/^https?:/.test(match[1]))await fs.access(path.resolve(b,path.dirname(f.path),match[1]));
    }
  }
  assert.equal(await fs.readFile(path.join(b,skill(host),'install-manifest.json'),'utf8'),await fs.readFile(path.join(b,'manifest.json'),'utf8'));
});
test('build refuses an existing nonempty output instead of overwriting',async t=>{
  const r=await temp(t);
  await fs.writeFile(path.join(r,'owned'),'user');
  await assert.rejects(api.buildPackage(source,'codex',r));
  assert.equal(await fs.readFile(path.join(r,'owned'),'utf8'),'user');
});
test('install is add-only and reports exact colliding path',async t=>{
  const b=await bundle(t),r=await temp(t),p=`${skill('codex')}/SKILL.md`;
  await fs.mkdir(path.dirname(path.join(r,p)),{
    recursive:true
  });
  await fs.writeFile(path.join(r,p),'mine');
  const plan=await api.planInstall(b,r,'install');
  assert.deepEqual(plan.conflicts,[p]);
  assert.equal((await api.applyInstall(plan)).status,'conflict');
  assert.equal(await fs.readFile(path.join(r,p),'utf8'),'mine');
});
test('existing root policies settings and gitignore remain byte-identical',async t=>{
  const b=await bundle(t),r=await temp(t);
  for(const p of ['AGENTS.md','CLAUDE.md','.gitignore'])await fs.writeFile(path.join(r,p),'my '+p);
  await fs.mkdir(path.join(r,'.codex'));
  await fs.writeFile(path.join(r,'.codex/config.toml'),'my-settings');
  const before=await bytesTree(r);
  const result=await api.applyInstall(await api.planInstall(b,r,'install'));
  assert.equal(result.status,'applied');
  const after=await bytesTree(r);
  for(const[p,h]of Object.entries(before))assert.equal(after[p],h);
});
test('modified managed file blocks the entire update and removal',async t=>{
  const{
    b,r
  }
  =await installed(t);
  const p=`${skill('codex')}/SKILL.md`;
  await fs.appendFile(path.join(r,p),'user edit');
  const before=await bytesTree(r);
  for(const op of ['update','remove']){
    const plan=await api.planInstall(b,r,op);
    assert.ok(plan.conflicts.includes(p));
    assert.equal((await api.applyInstall(plan)).status,'conflict');
  }
  assert.deepEqual(await bytesTree(r),before);
});
test('missing or malformed ownership manifest refuses update/remove',async t=>{
  const{
    b,r
  }
  =await installed(t);
  const m=path.join(r,skill('codex'),'install-manifest.json');
  for(const content of [null,'{broken',JSON.stringify({
    host:'codex',packageVersion:'0.1.0',files:[]
  })]){
    if(content===null)await fs.unlink(m);
    else await fs.writeFile(m,content);
    for(const op of ['update','remove'])assert.ok((await api.planInstall(b,r,op)).conflicts.length>0);
  }
});
test('apply rechecks target bytes and manifest bytes',async t=>{
  const{
    b,r
  }
  =await installed(t);
  for(const p of [`${skill('codex')}/SKILL.md`,`${skill('codex')}/install-manifest.json`]){
    const original=await fs.readFile(path.join(r,p)),plan=await api.planInstall(b,r,'update');
    await fs.appendFile(path.join(r,p),'changed since plan');
    const before=await bytesTree(r);
    assert.equal((await api.applyInstall(plan)).status,'conflict');
    assert.deepEqual(await bytesTree(r),before);
    await fs.writeFile(path.join(r,p),original);
  }
});
test('apply rechecks bundle source bytes',async t=>{
  const b=await bundle(t),r=await temp(t),plan=await api.planInstall(b,r,'install');
  await fs.appendFile(path.join(b,skill('codex'),'SKILL.md'),'modified');
  assert.equal((await api.applyInstall(plan)).status,'conflict');
  assert.deepEqual(await bytesTree(r),{
  });
});
for(const type of ['external','broken','case'])test(`${type} aliases block installation without touching outside bytes`,async t=>{
  const b=await bundle(t),r=await temp(t),outside=await temp(t);
  if(type==='case')await fs.mkdir(path.join(r,'.Agents'));
  else await fs.symlink(type==='external'?outside:path.join(outside,'missing'),path.join(r,'.agents'));
  const p=await api.planInstall(b,r,'install');
  assert.ok(p.conflicts.length>0);
  assert.equal((await api.applyInstall(p)).status,'conflict');
  assert.deepEqual(await bytesTree(outside),{
  });
});
test('remove deletes only hash-owned files and leaves unrelated files intact',async t=>{
  const{
    b,r
  }
  =await installed(t);
  await fs.writeFile(path.join(r,skill('codex'),'personal.txt'),'mine');
  await fs.writeFile(path.join(r,'app.js'),'learner');
  const plan=await api.planInstall(b,r,'remove');
  assert.equal((await api.applyInstall(plan)).status,'applied');
  assert.equal(await fs.readFile(path.join(r,skill('codex'),'personal.txt'),'utf8'),'mine');
  assert.equal(await fs.readFile(path.join(r,'app.js'),'utf8'),'learner');
  await assert.rejects(fs.access(path.join(r,skill('codex'),'SKILL.md')));
});
test('mid-update rename failure rolls back all managed bytes',async t=>{
  const{
    b,r
  }
  =await installed(t),plan=await api.planInstall(b,r,'update'),before=await bytesTree(r),original=fs.rename;
  let count=0;
  t.mock.method(fs,'rename',async(...args)=>{
    if(String(args[0]).includes('/new/')&&++count===3)throw Object.assign(new Error('injected rename failure'),{
      code:'EIO'
    });
    return original(...args);
  });
  assert.equal((await api.applyInstall(plan)).status,'rolled-back');
  assert.deepEqual(await bytesTree(r),before);
});
test('mid-install write failure leaves no managed files',async t=>{
  const b=await bundle(t),r=await temp(t),plan=await api.planInstall(b,r,'install'),original=fs.open;
  let count=0;
  t.mock.method(fs,'open',async(...args)=>{
    const h=await original(...args);
    if(String(args[0]).includes('/new/')&&++count===2)h.writeFile=async()=>{
      throw Object.assign(new Error('injected write failure'),{
        code:'EIO'
      });
    };
    return h;
  });
  assert.equal((await api.applyInstall(plan)).status,'rolled-back');
  assert.deepEqual(await bytesTree(r),{
  });
});
test('forged plan cannot write outside managed roots or omit guards',async t=>{
  const b=await bundle(t),r=await temp(t),plan=await api.planInstall(b,r,'install');
  for(const forged of [{
    ...plan,targetRoot:'/'
  },{
    ...plan,writes:[{
      path:'app.js',sourcePath:'manifest.json',sha256:'bad'
    }]
  },{
    ...plan,expected:[]
  }])assert.equal((await api.applyInstall(forged)).status,'conflict');
  assert.deepEqual(await bytesTree(r),{
  });
});
test('untrusted manifest cannot claim project policy or traversal paths',async t=>{
  const b=await bundle(t),r=await temp(t),mp=path.join(b,'manifest.json'),base=JSON.parse(await fs.readFile(mp));
  for(const p of ['AGENTS.md','../outside','.codex/config.toml']){
    await fs.writeFile(mp,JSON.stringify({
      ...base,files:[{
        path:p,sha256:'a'.repeat(64)
      }]
    }));
    assert.ok((await api.planInstall(b,r,'install')).conflicts.length>0);
    assert.deepEqual(await bytesTree(r),{
    });
  }
});
test('a genuine new-version update replaces only owned content',async t=>{
  const{
    b,r
  }
  =await installed(t);
  const p=`${skill('codex')}/core/learning-policy.md`;
  const bytes=Buffer.from('updated reviewed learning policy\n');
  await fs.writeFile(path.join(b,p),bytes);
  const mp=path.join(b,'manifest.json'),m=JSON.parse(await fs.readFile(mp));
  m.packageVersion='0.1.1';
  m.files.find(f=>f.path===p).sha256=sha(bytes);
  const encoded=JSON.stringify(m,null,2)+'\n';
  await fs.writeFile(mp,encoded);
  await fs.writeFile(path.join(b,skill('codex'),'install-manifest.json'),encoded);
  const result=await api.applyInstall(await api.planInstall(b,r,'update'));
  assert.equal(result.status,'applied');
  assert.deepEqual(await fs.readFile(path.join(r,p)),bytes);
  assert.equal(JSON.parse(await fs.readFile(path.join(r,skill('codex'),'install-manifest.json'))).packageVersion,'0.1.1');
});
test('remove preserves a new bundle path that was never owned by old install',async t=>{
  const{
    b,r
  }
  =await installed(t),p=`${skill('codex')}/extra.md`,bytes=Buffer.from('new package text');
  await fs.writeFile(path.join(b,p),bytes);
  await fs.writeFile(path.join(r,p),'unmanaged learner notes');
  const mp=path.join(b,'manifest.json'),m=JSON.parse(await fs.readFile(mp));
  m.files.push({
    path:p,sha256:sha(bytes)
  });
  const encoded=JSON.stringify(m);
  await fs.writeFile(mp,encoded);
  await fs.writeFile(path.join(b,skill('codex'),'install-manifest.json'),encoded);
  const plan=await api.planInstall(b,r,'remove');
  assert.deepEqual(plan.conflicts,[]);
  assert.equal((await api.applyInstall(plan)).status,'applied');
  assert.equal(await fs.readFile(path.join(r,p),'utf8'),'unmanaged learner notes');
});
test('concurrent apply attempts cannot interleave managed files',async t=>{
  const b=await bundle(t),r=await temp(t);
  const a=await api.planInstall(b,r,'install'),c=await api.planInstall(b,r,'install');
  const results=await Promise.all([api.applyInstall(a),api.applyInstall(c)]);
  assert.equal(results.filter(r=>r.status==='applied').length,1);
  assert.equal(results.filter(r=>r.status==='conflict').length,1);
});
for (const failure of ['transaction-removal', 'unlock']) test(`committed install truthfully reports ${failure} cleanup failure`, async t => {
  const b = await bundle(t), r = await temp(t), plan = await api.planInstall(b, r, 'install');
  const method = failure === 'transaction-removal' ? 'rm' : 'unlink';
  const original = fs[method];
  t.mock.method(fs, method, async (...args) => {
    const p = String(args[0]);
    if (failure === 'transaction-removal' ? p.includes('/.to-be-psycho-transaction-') : p.endsWith('/.to-be-psycho-transaction.lock')) {
      throw Object.assign(new Error('cleanup denied'), {code:'EACCES'});
    }
    return original(...args);
  });
  const result = await api.applyInstall(plan);
  assert.equal(result.status, 'applied-with-cleanup-needed');
  assert.ok(result.paths.length > 15);
  assert.equal(result.cleanup.lockPath, '.codex/.to-be-psycho-transaction.lock');
  assert.match(result.cleanup.transactionPath, /^\.codex\/\.to-be-psycho-transaction-/);
  assert.ok(result.cleanup.errors.some(error => error.code === 'EACCES'));
  for (const write of plan.writes) assert.equal(sha(await fs.readFile(path.join(r, write.path))), write.sha256);
  await fs.access(path.join(r, result.cleanup.lockPath));
});
test('rolled back install preserves truthful outcome when cleanup also fails', async t => {
  const b = await bundle(t), r = await temp(t), plan = await api.planInstall(b, r, 'install');
  const originalOpen = fs.open, originalRm = fs.rm;
  t.mock.method(fs, 'open', async (...args) => {
    const handle = await originalOpen(...args);
    if (String(args[0]).includes('/new/')) handle.writeFile = async () => { throw Object.assign(new Error('write failed'), {code:'EIO'}); };
    return handle;
  });
  t.mock.method(fs, 'rm', async (...args) => {
    if (String(args[0]).includes('/.to-be-psycho-transaction-')) throw Object.assign(new Error('cleanup denied'), {code:'EACCES'});
    return originalRm(...args);
  });
  const result = await api.applyInstall(plan);
  assert.equal(result.status, 'rolled-back');
  assert.ok(result.cleanup.errors.length);
  await assert.rejects(fs.access(path.join(r, skill('codex'), 'SKILL.md')));
});
