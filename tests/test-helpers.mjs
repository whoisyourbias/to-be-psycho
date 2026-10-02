import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
export async function temp(t) {
  const root=await mkdtemp(path.join(tmpdir(),'psycho 한글 '));
  t.after(()=>rm(root,{
    recursive:true,force:true
  }));
  return root;
}
export const sha = bytes=>createHash('sha256').update(bytes).digest('hex');
export async function bytesTree(root) {
  const out={
  };
  async function visit(rel='') {
    for(const d of await readdir(path.join(root,rel),{
      withFileTypes:true
    })) {
      const p=path.join(rel,d.name);
      if(d.isDirectory()) await visit(p);
      else if(d.isFile()) out[p]=sha(await readFile(path.join(root,p)));
      else out[p]='link-or-special';
    }
  }
  await visit();
  return out;
}
export async function stateFixture() {
  return JSON.parse(await readFile(new URL('./fixtures/state-v1.json',import.meta.url),'utf8'));
}
