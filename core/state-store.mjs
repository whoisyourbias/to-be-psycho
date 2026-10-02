import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { assertState, fault } from './state.mjs';
import { resolveInside } from './safe-path.mjs';
const dir='.to-be-psycho',state=`${dir}/state.json`,backup=`${state}.bak`,lock=`${dir}/state.lock`;
const sha=b=>createHash('sha256').update(b).digest('hex');
function parse(bytes){
  let value;
  try{
    value=JSON.parse(bytes.toString('utf8'));
  } catch{
    throw fault('STATE_CORRUPT','State JSON is corrupt; preserve the original');
  }
  return assertState(value);
}
async function read(root,relative){
  const p=await resolveInside(root,relative);
  try{
    return await fs.readFile(p);
  } catch(e){
    if(e.code==='ENOENT')return null;
    throw e;
  }
}
export async function loadState(root){
  const bytes=await read(root,state);
  return bytes===null?null:parse(bytes);
}
async function removeTemp(root,relative){
  try{
    await fs.unlink(await resolveInside(root,relative));
  } catch(e){
    if(e.code!=='ENOENT'&&e.code!=='UNSAFE_PATH')throw e;
  }
}
async function writeNew(root,relative,bytes){
  const p=await resolveInside(root,relative),h=await fs.open(p,'wx',0o600);
  try{
    await h.writeFile(bytes);
    await h.sync();
  } finally{
    await h.close();
  }
}
async function replace(root,relative,bytes,beforeCommit){
  const tmp=`${relative}.tmp-${randomUUID()}`;
  try{
    await writeNew(root,tmp,bytes);
    const from=await resolveInside(root,tmp),to=await resolveInside(root,relative);
    if(beforeCommit)await beforeCommit();
    await fs.rename(from,to);
  } finally{
    await removeTemp(root,tmp);
  }
}
async function withLock(root,operation){
  const d=await resolveInside(root,dir);
  try{
    await fs.mkdir(d);
  } catch(e){
    if(e.code!=='EEXIST')throw e;
  }
  await resolveInside(root,dir);
  let h;
  try{
    h=await fs.open(await resolveInside(root,lock),'wx',0o600);
  } catch(e){
    if(e.code==='EEXIST')throw fault('STATE_BUSY','State lock exists; do not delete it automatically');
    throw e;
  }
  try{
    await h.writeFile(JSON.stringify({
      pid:process.pid,createdAt:new Date().toISOString()
    }));
    await h.sync();
    return await operation();
  } finally{
    await h.close();
    await removeTemp(root,lock);
  }
}
export async function saveState(root,next,expectedRevision){
  assertState(next);
  return withLock(root,async()=>{
    const old=await read(root,state),current=old===null?null:parse(old);
    if(current===null?expectedRevision!==null:expectedRevision!==current.revision)throw fault('REVISION_CONFLICT','State changed; reload before saving');
    if(current&&(current.project.id!==next.project.id||current.project.rootIdentity!==next.project.rootIdentity||current.sessionId!==next.sessionId))throw fault('REVISION_CONFLICT','Project/session identity changed');
    const result=assertState({
      ...next,revision:current?current.revision+1:0
    });
    if(old!==null)await replace(root,backup,old);
    await replace(root,state,Buffer.from(JSON.stringify(result,null,2)+'\n'),async()=>{
      const latest=await read(root,state);
      if((old===null)!==(latest===null)||old!==null&&!old.equals(latest))throw fault('REVISION_CONFLICT','State changed during save');
    });
    return result;
  });
}
export async function recoverState(root,approval){
  if(approval?.confirmed!==true||typeof approval.backupSha256!=='string')throw fault('RECOVERY_CHANGED','Explicit approval with the reviewed backup SHA-256 is required');
  return withLock(root,async()=>{
    const bytes=await read(root,backup);
    if(bytes===null||sha(bytes)!==approval.backupSha256)throw fault('RECOVERY_CHANGED','Backup changed or is unavailable');
    const restored=parse(bytes),original=await read(root,state);
    if(original===null)throw fault('RECOVERY_CHANGED','Original state is missing; manual review required');
    let corrupt=false;
    try{
      parse(original);
    } catch(e){
      if(['STATE_CORRUPT','UNSUPPORTED_SCHEMA'].includes(e.code))corrupt=true;
      else throw e;
    }
    if(!corrupt)throw fault('RECOVERY_CHANGED','Current state is healthy; recovery cannot roll it back');
    await writeNew(root,`${state}.corrupt-${randomUUID()}`,original);
    // Check after all temporary-file IO, immediately before the final rename.
    await replace(root,state,bytes,async()=>{
      const check=await read(root,backup);
      if(check===null||sha(check)!==approval.backupSha256)throw fault('RECOVERY_CHANGED','Backup changed during recovery');
      const latest=await read(root,state);
      if(latest===null||!latest.equals(original))throw fault('RECOVERY_CHANGED','State changed during recovery');
    });
    return restored;
  });
}
