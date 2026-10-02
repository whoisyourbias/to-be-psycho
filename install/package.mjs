/** Local package/build/install functions. No CLI, subprocesses, network or learner-code execution. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { resolveInside, portablePath } from '../core/safe-path.mjs';
import { fault } from '../core/state.mjs';
const name='learning-with-to-be-psycho';
const hash=b=>createHash('sha256').update(b).digest('hex');
const issuedPlans=new WeakMap();
const hosts=['claude','codex'];
const skillRoot=h=>`${h==='claude'?'.claude':'.agents'}/skills/${name}`;
const agentPath=h=>h==='claude'?'.claude/agents/implementation-reviewer.md':'.codex/agents/implementation-reviewer.toml';
const manifestPath=h=>`${skillRoot(h)}/install-manifest.json`;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=m=>{
  throw fault('PACKAGE_INVALID',m);
};
function managed(h,p){
  return p===agentPath(h)||p.startsWith(skillRoot(h)+'/');
}
function parseManifest(bytes,host){
  let m;
  try{
    m=JSON.parse(bytes);
  } catch{
    fail('Invalid manifest JSON');
  }
  if(!m||!hosts.includes(m.host)||host&&m.host!==host||typeof m.packageVersion!=='string'||!Array.isArray(m.files)||m.files.length===0)fail('Invalid manifest shape');
  const seen=new Set();
  for(const f of m.files){
    if(!f||typeof f.path!=='string'||portablePath(f.path)!==f.path||!managed(m.host,f.path)||f.path===manifestPath(m.host)||!/^[0-9a-f]{64}$/.test(f.sha256))fail('Invalid manifest entry');
    const alias=f.path.normalize('NFC').toLowerCase();
    if(seen.has(alias))fail('Aliased/duplicate manifest entry');
    seen.add(alias);
  }
  if(!seen.has(`${skillRoot(m.host)}/skill.md`.toLowerCase())||!seen.has(agentPath(m.host).toLowerCase()))fail('Missing required package files');
  return m;
}
async function bytesAt(root,p){
  const full=await resolveInside(root,p);
  try{
    return await fs.readFile(full);
  } catch(e){
    if(e.code==='ENOENT')return null;
    throw e;
  }
}
async function hashAt(root,p){
  const b=await bytesAt(root,p);
  return b===null?null:hash(b);
}
async function mkdirParents(root,p){
  const parts=portablePath(p).split('/').slice(0,-1);
  let rel='';
  for(const part of parts){
    rel=rel?`${rel}/${part}`:part;
    const full=await resolveInside(root,rel);
    try{
      await fs.mkdir(full);
    } catch(e){
      if(e.code!=='EEXIST')throw e;
    }
    await resolveInside(root,rel);
  }
}
async function writeExclusive(root,p,bytes){
  await mkdirParents(root,p);
  const full=await resolveInside(root,p),h=await fs.open(full,'wx',0o600);
  try{
    await h.writeFile(bytes);
    await h.sync();
  } finally{
    await h.close();
  }
}
export async function buildPackage(sourceRoot,host,outputRoot){
  if(!hosts.includes(host))fail('Unsupported host');
  const parent=path.dirname(path.resolve(outputRoot)),leaf=path.basename(outputRoot);
  // Caller creates the existing, explicitly selected parent. Never mkdir arbitrary ancestors.
  await resolveInside(parent,leaf);
  try{
    await fs.mkdir(outputRoot);
  } catch(e){
    if(e.code!=='EEXIST')throw e;
  }
  if((await fs.readdir(outputRoot)).length)fail('Output must be empty');
  const inputs=[['skills/'+name+'/SKILL.md','SKILL.md'],['AGENTS.md','AGENTS.md'],['CLAUDE.md','CLAUDE.md']];
  for(const dir of ['core','profiles'])for(const entry of(await fs.readdir(path.join(sourceRoot,dir),{
    withFileTypes:true
  })).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
    if(!entry.isFile())fail('Package inputs must be ordinary files');
    inputs.push([`${dir}/${entry.name}`,`${dir}/${entry.name}`]);
  }
  for(const h of hosts)inputs.push([`adapters/${h}/README.md`,`adapters/${h}/README.md`]);
  const files=[];
  for(const [src,dst]of inputs){
    let bytes=await bytesAt(sourceRoot,src);
    if(bytes===null)fail(`Missing source ${src}`);
    if(dst==='SKILL.md')bytes=Buffer.from(bytes.toString().replaceAll('../../core/','core/').replaceAll('../../profiles/','profiles/').replaceAll('../../adapters/','adapters/'));
    const p=`${skillRoot(host)}/${dst}`;
    await writeExclusive(outputRoot,p,bytes);
    files.push({
      path:p,sha256:hash(bytes)
    });
  }
  const adapter=host==='claude'?'adapters/claude/implementation-reviewer.md':'adapters/codex/implementation-reviewer.toml';
  let bytes=await bytesAt(sourceRoot,adapter);
  if(bytes===null)fail('Missing reviewer');
  const contract=host==='claude'?`../skills/${name}/core/review-contract.md`:`../../.agents/skills/${name}/core/review-contract.md`;
  bytes=Buffer.from(bytes.toString().replaceAll('../../core/review-contract.md',contract));
  await writeExclusive(outputRoot,agentPath(host),bytes);
  files.push({
    path:agentPath(host),sha256:hash(bytes)
  });
  const pkg=JSON.parse(await fs.readFile(await resolveInside(sourceRoot,'package.json'),'utf8'));
  const manifest={
    packageVersion:pkg.version,host,files:files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)
  };
  const encoded=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
  parseManifest(encoded,host);
  await writeExclusive(outputRoot,'manifest.json',encoded);
  await writeExclusive(outputRoot,manifestPath(host),encoded);
  return manifest;
}
export async function planInstall(bundleRoot,targetRoot,operation){
  const plan={
    host:null,operation,bundleRoot:path.resolve(bundleRoot),targetRoot:path.resolve(targetRoot),expected:[],writes:[],removes:[],conflicts:[]
  };
  const conflict=p=>{
    if(!plan.conflicts.includes(p))plan.conflicts.push(p);
  };
  if(!['install','update','remove'].includes(operation)){
    conflict('operation');
    return plan;
  }
  let manifest,manifestBytes;
  try{
    manifestBytes=await bytesAt(plan.bundleRoot,'manifest.json');
    manifest=parseManifest(manifestBytes);
    plan.host=manifest.host;
    const own=await bytesAt(plan.bundleRoot,manifestPath(plan.host));
    if(own===null||!own.equals(manifestBytes))fail('Bundle manifest mismatch');
    for(const f of manifest.files)if(await hashAt(plan.bundleRoot,f.path)!==f.sha256)fail(`Bundle file changed: ${f.path}`);
  } catch{
    conflict('manifest.json');
    return plan;
  }
  const mp=manifestPath(plan.host);
  let old=null;
  try{
    const b=await bytesAt(plan.targetRoot,mp);
    if(operation==='install'){
      if(b!==null)conflict(mp);
    } else{
      if(b===null)fail('Ownership manifest missing');
      old=parseManifest(b,plan.host);
    }
  } catch{
    conflict(mp);
  }
  const oldFiles=new Map((old?.files||[]).map(f=>[f.path,f.sha256]));
  const nextFiles=new Map(manifest.files.map(f=>[f.path,f.sha256]));
  const paths=[...new Set([...(operation==='remove'?[]:nextFiles.keys()),...oldFiles.keys(),mp])].sort();
  for(const p of paths){
    let current;
    try{
      current=await hashAt(plan.targetRoot,p);
    } catch{
      conflict(p);
      continue;
    }
    plan.expected.push({
      path:p,sha256:current
    });
    if(operation==='install'){
      if(current!==null)conflict(p);
    } else if(p!==mp&&oldFiles.has(p)){
      if(current!==oldFiles.get(p))conflict(p);
    } else if(p!==mp&&current!==null)conflict(p);
  }
  if(operation==='remove')plan.removes=[...oldFiles.keys(),mp].sort();
  else{
    plan.writes=manifest.files.map(f=>({
      ...f,sourcePath:f.path
    }));
    plan.writes.push({
      path:mp,sourcePath:mp,sha256:hash(manifestBytes)
    });
    if(old)plan.removes=[...oldFiles.keys()].filter(p=>!nextFiles.has(p));
  }
  plan.conflicts.sort();
  issuedPlans.set(plan,{
    serialized:JSON.stringify(plan),bundleManifestHash:hash(manifestBytes)
  });
  return plan;
}
async function checkPlan(plan,saved){
  if(!saved||saved.serialized!==JSON.stringify(plan)||plan.conflicts.length)return false;
  try{
    if(await hashAt(plan.bundleRoot,'manifest.json')!==saved.bundleManifestHash)return false;
    for(const e of plan.expected)if(await hashAt(plan.targetRoot,e.path)!==e.sha256)return false;
    for(const w of plan.writes)if(await hashAt(plan.bundleRoot,w.sourcePath)!==w.sha256)return false;
  } catch{
    return false;
  }
  return true;
}
/** Apply only the same, unmodified plan object after the caller obtains user approval. */
export async function applyInstall(plan){
  const saved=issuedPlans.get(plan);
  if(!await checkPlan(plan,saved))return{
    status:'conflict',paths:[]
  };
  const affected=[...new Set([...plan.writes.map(w=>w.path),...plan.removes])];
  const base=`${plan.host==='claude'?'.claude':'.codex'}/.to-be-psycho-transaction`;
  const transaction=`${base}-${randomUUID()}`,lock=`${base}.lock`;
  let lockHandle;
  const moved=[],installed=[];
  try{
    await mkdirParents(plan.targetRoot,lock);
    lockHandle=await fs.open(await resolveInside(plan.targetRoot,lock),'wx',0o600);
  } catch{
    return{
      status:'conflict',paths:[]
    };
  }
  let retained=false;
  const outcome={status:'conflict',paths:[]};
  let rollbackError;
  try{
    if(!await checkPlan(plan,saved))return outcome;
    // Every replacement is staged before touching installed bytes, on the same filesystem.
    for(let i=0; i<plan.writes.length; i++){
      const w=plan.writes[i],bytes=await bytesAt(plan.bundleRoot,w.sourcePath);
      if(bytes===null||hash(bytes)!==w.sha256)return outcome;
      await writeExclusive(plan.targetRoot,`${transaction}/new/${i}`,bytes);
    }
    if(!await checkPlan(plan,saved))return outcome;
    await mkdirParents(plan.targetRoot,`${transaction}/old/marker`);
    for(let i=0; i<affected.length; i++){
      const p=affected[i],expected=plan.expected.find(e=>e.path===p);
      if(!expected)fail('Missing guard');
      if(await hashAt(plan.targetRoot,p)!==expected.sha256)throw fault('INSTALL_CONFLICT','Target changed during apply');
      if(expected.sha256!==null){
        const old=`${transaction}/old/${i}`;
        await fs.rename(await resolveInside(plan.targetRoot,p),await resolveInside(plan.targetRoot,old));
        moved.push({
          path:p,backup:old
        });
      }
    }
    for(let i=0; i<plan.writes.length; i++){
      const p=plan.writes[i].path;
      await mkdirParents(plan.targetRoot,p);
      if(await hashAt(plan.targetRoot,p)!==null)throw fault('INSTALL_CONFLICT','A destination appeared during apply');
      await fs.rename(await resolveInside(plan.targetRoot,`${transaction}/new/${i}`),await resolveInside(plan.targetRoot,p));
      installed.push(p);
    }
    // Backups survive until all resulting hashes and removals are verified.
    for(const w of plan.writes)if(await hashAt(plan.targetRoot,w.path)!==w.sha256)throw fault('INSTALL_CONFLICT','Installed verification failed');
    for(const p of plan.removes)if(await hashAt(plan.targetRoot,p)!==null)throw fault('INSTALL_CONFLICT','Removal verification failed');
    issuedPlans.delete(plan);
    outcome.status='applied';
    outcome.paths=affected;
    return outcome;
  } catch(error){
    try{
      for(const p of installed.reverse()){
        const w=plan.writes.find(w=>w.path===p);
        if(await hashAt(plan.targetRoot,p)!==w.sha256)throw new Error('Installed file changed during rollback');
        await fs.unlink(await resolveInside(plan.targetRoot,p));
      }
      for(const m of moved.reverse()){
        if(await hashAt(plan.targetRoot,m.path)!==null)throw new Error('Original destination changed during rollback');
        await mkdirParents(plan.targetRoot,m.path);
        await fs.rename(await resolveInside(plan.targetRoot,m.backup),await resolveInside(plan.targetRoot,m.path));
      }
      outcome.status='rolled-back';
      return outcome;
    } catch{
      retained=true;
      rollbackError=fault('ROLLBACK_FAILED',`Rollback could not safely complete; preserve ${transaction} and ${lock} for manual recovery`);
      throw rollbackError;
    }
  } finally{
    const cleanupErrors=[];
    const recordCleanup=(operation,error)=>cleanupErrors.push({operation,code:error.code||'UNKNOWN'});
    try{
      await lockHandle.close();
    } catch(error){
      recordCleanup('close-lock',error);
    }
    if(!retained&&cleanupErrors.length===0){
      try{
        await fs.rm(await resolveInside(plan.targetRoot,transaction),{
          recursive:true,force:true
        });
      } catch(e){
        if(e.code!=='ENOENT')recordCleanup('remove-transaction',e);
      }
    }
    // A cleanup failure preserves the lock rather than inviting an ambiguous retry.
    if(!retained&&cleanupErrors.length===0){
      try{
        await fs.unlink(await resolveInside(plan.targetRoot,lock));
      } catch(e){
        if(e.code!=='ENOENT')recordCleanup('remove-lock',e);
      }
    }
    if(cleanupErrors.length){
      const cleanup={transactionPath:transaction,lockPath:lock,errors:cleanupErrors};
      if(rollbackError)rollbackError.cleanup=cleanup;
      else{
        if(outcome.status==='applied')outcome.status='applied-with-cleanup-needed';
        outcome.cleanup=cleanup;
      }
    }
  }
}
