import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash = value=>createHash('sha256').update(value).digest('hex');
const safeRelative=p=>typeof p==='string'&&p.length>0&&!path.posix.isAbsolute(p)&&!path.win32.isAbsolute(p)&&!/[\\:\0]/.test(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');
const metadata = s=>[s.dev,s.ino,s.size,s.mtimeNs?.toString(),s.ctimeNs?.toString()].join(':');
/** Conservative read-only inventory; only package state and Git metadata are excluded. */
async function inventory(root) {
  const files=[];
  let valid=true;
  async function walk(rel='') {
    let entries;
    try{
      entries=await fs.readdir(path.join(root,rel),{
        withFileTypes:true
      });
    } catch{
      valid=false;
      return;
    }
    for(const e of entries){
      if(!rel&&['.git','.to-be-psycho'].includes(e.name))continue;
      const p=rel?`${rel}/${e.name}`:e.name;
      if(!safeRelative(p)){
        valid=false;
        continue;
      }
      if(e.isDirectory())await walk(p);
      else if(e.isFile())files.push(p);
      else valid=false;
    }
  }
  await walk();
  return {
    files:files.sort(),valid
  };
}
async function readFiles(root,paths) {
  const files=[];
  const marks=[];
  let valid=true;
  for(const p of paths){
    try{
      let current=root;
      for(const part of p.split('/')){
        current=path.join(current,part);
        if((await fs.lstat(current)).isSymbolicLink())throw new Error('link');
      }
      const full=path.join(root,p),before=await fs.lstat(full,{
        bigint:true
      });
      if(!before.isFile())throw new Error('not file');
      const bytes=await fs.readFile(full),after=await fs.lstat(full,{
        bigint:true
      });
      if(metadata(before)!==metadata(after))valid=false;
      files.push({
        path:p,sha256:hash(bytes)
      });
      marks.push([p,metadata(after)]);
    } catch{
      valid=false;
      marks.push([p,'unreadable']);
    }
  }
  return {
    files,marks,valid
  };
}
export async function captureSnapshot(root,input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))input={};
  const capturedAt=new Date().toISOString();
  let valid=input.coverage==='complete';
  let paths=Array.isArray(input.paths)?input.paths:[];
  if(!paths.length||paths.some(p=>!safeRelative(p))||new Set(paths).size!==paths.length)valid=false;
  paths=[...new Set(paths.filter(safeRelative))].sort();
  const env=input.environment;
  const envValid=env&&typeof env==='object'&&!Array.isArray(env)&&Object.keys(env).length>0&&Object.entries(env).every(([k,v])=>typeof v==='string'&&!/(secret|token|password|credential|api.?key)/i.test(k));
  if(!envValid)valid=false;
  const environmentId=hash(JSON.stringify(envValid?Object.entries(env).sort(([a],[b])=>a<b?-1:a>b?1:0):[]));
  const unknownRoot=()=>({
    id:'unknown:'+hash('unreadable-root'),environmentId,coverage:'unknown',files:[],capturedAt
  });
  try{
    const s=await fs.lstat(root);
    if(!s.isDirectory()||s.isSymbolicLink()||await fs.realpath(root)!==path.resolve(root))return unknownRoot();
  } catch{
    return unknownRoot();
  }
  const firstInventory=await inventory(root),first=await readFiles(root,paths),second=await readFiles(root,paths),secondInventory=await inventory(root);
  if(!firstInventory.valid||!secondInventory.valid||!first.valid||!second.valid||JSON.stringify(first)!==JSON.stringify(second)||JSON.stringify(firstInventory.files)!==JSON.stringify(secondInventory.files)||JSON.stringify(paths)!==JSON.stringify(secondInventory.files))valid=false;
  // Preserve incomplete capture provenance so identical later bytes cannot promote old evidence.
  // Missing paths also participate in identity.
  const id=(valid?'':'unknown:')+hash(JSON.stringify({
    paths,files:second.files,missing:paths.filter(p=>!second.files.some(f=>f.path===p))
  }));
  return {
    id,environmentId,coverage:valid?'complete':'unknown',files:second.files,capturedAt
  };
}
export function evidenceFreshness(evidence,current) {
  if(typeof evidence?.snapshotId!=='string'||evidence.snapshotId.startsWith('unknown:')||!evidence.snapshotId||!evidence?.environmentId||!current?.id||!current?.environmentId||current.coverage!=='complete')return 'unknown';
  return evidence.snapshotId===current.id&&evidence.environmentId===current.environmentId?'current':'stale';
}
