import fs from 'node:fs/promises';
import path from 'node:path';
import { fault } from './state.mjs';
const unsafe=()=>{
  throw fault('UNSAFE_PATH','Path is outside the allowed root, aliased, linked, or not portable');
};
export function portablePath(relativePath) {
  if(typeof relativePath!=='string'||!relativePath||path.posix.isAbsolute(relativePath)||path.win32.isAbsolute(relativePath)||/[\x00-\x1f:]/.test(relativePath))unsafe();
  const parts=relativePath.replaceAll('\\','/').split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/[<>"|?*]/.test(p)||/^(con|conin\$|conout\$|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(p)))unsafe();
  return parts.join('/');
}
/** Reject all symlinks/junctions and hardlinked files, including internal links. */
export async function resolveInside(root,relativePath) {
  const parts=portablePath(relativePath).split('/');
  if(typeof root!=='string'||!path.isAbsolute(root))unsafe();
  const base=path.resolve(root);
  let stat;
  try{
    stat=await fs.lstat(base);
  } catch(e){
    if(e.code==='ENOENT')unsafe();
    throw e;
  }
  if(!stat.isDirectory()||stat.isSymbolicLink()||await fs.realpath(base)!==base)unsafe();
  let current=base;
  for(let i=0; i<parts.length; i++){
    let entries;
    try{
      entries=await fs.readdir(current);
    } catch(e){
      if(e.code==='ENOENT')return path.join(current,...parts.slice(i));
      if(e.code==='ENOTDIR')unsafe();
      throw e;
    }
    const fold=s=>s.normalize('NFC').toLowerCase();
    if(entries.some(n=>fold(n)===fold(parts[i])&&n!==parts[i]))unsafe();
    current=path.join(current,parts[i]);
    try{
      stat=await fs.lstat(current);
    } catch(e){
      if(e.code==='ENOENT')return path.join(current,...parts.slice(i+1));
      throw e;
    }
    if(stat.isSymbolicLink()||!stat.isDirectory()&&!stat.isFile()||stat.isFile()&&stat.nlink>1||i<parts.length-1&&!stat.isDirectory())unsafe();
    if(await fs.realpath(current)!==current)unsafe();
  }
  return current;
}
