import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=new URL('../',import.meta.url);
const skillPath=new URL('skills/learning-with-to-be-psycho/SKILL.md',root);
test('skill entrypoint has bounded trigger-only frontmatter',async()=>{
  const s=await fs.readFile(skillPath,'utf8');
  const fm=s.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(fm);
  assert.ok(fm[1].length<=1024);
  assert.match(fm[1],/^name: learning-with-to-be-psycho$/m);
  assert.match(fm[1],/^description: Use when /m);
  assert.ok(s.split(/\s+/).length<=500);
});
test('seven profiles exist and are reachable from skill source',async()=>{
  const s=await fs.readFile(skillPath,'utf8');
  for(const name of ['web','vue','react','java-spring','spring-mvc','spring-webflux','spring-boot']){
    assert.ok(s.includes(`profiles/${name}.md`),name);
    const p=await fs.readFile(new URL(`profiles/${name}.md`,root),'utf8');
    for(const heading of ['Repository checks','Concepts','Review questions'])assert.ok(p.includes(heading),name+heading);
  }
});
test('MVC and WebFlux both reference the same Boot module',async()=>{
  for(const p of ['spring-mvc','spring-webflux']){
    const s=await fs.readFile(new URL(`profiles/${p}.md`,root),'utf8');
    assert.match(s,/\]\(spring-boot\.md\)/);
  }
});
test('all local Markdown reference links resolve',async()=>{
  const paths=['skills/learning-with-to-be-psycho/SKILL.md','core/learning-policy.md','core/state-format.md'];
  for(const p of paths){
    const full=new URL(p,root),s=await fs.readFile(full,'utf8');
    for(const m of s.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)){
      if(/^(https?:|mailto:)/.test(m[1]))continue;
      await fs.access(new URL(m[1],full));
    }
  }
});
