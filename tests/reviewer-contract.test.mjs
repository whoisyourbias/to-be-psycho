import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assertState } from '../core/state.mjs';
import{
  stateFixture
}
from './test-helpers.mjs';
const text=p=>fs.readFile(new URL('../'+p,import.meta.url),'utf8');
async function reviewState(){
  const s=await stateFixture();
  s.reviews=[{
    id:'review-1',stageId:s.stage.id,snapshotId:'snapshot-1',independent:false,findings:[{
      priority:'P1',requirementId:'Q1',kind:'confirmed',file:'app.js',lineStart:4,lineEnd:4,codeEvidence:'return next;',condition:'current=0 and delta=-1',impact:'A negative quantity violates Q1',verification:'Static trace; learner should check the lower boundary',fixDirection:'Preserve the lower-bound invariant before returning'
    }],criteria:[{
      id:'Q1',status:'unmet',reason:'Lower boundary is not enforced'
    }],limitations:['Static review only; execution unverified'],nextAction:'Learner revises current stage'
  }];
  return s;
}
test('reviewer definitions explicitly restrict capabilities and have no persistent memory',async()=>{
  const claude=await text('adapters/claude/implementation-reviewer.md'),codex=await text('adapters/codex/implementation-reviewer.toml');
  assert.match(claude,/^tools: Read, Glob, Grep$/m);
  assert.doesNotMatch(claude,/^memory:/m);
  assert.match(codex,/^sandbox_mode = "read-only"$/m);
  assert.match(codex,/^approval_policy = "never"$/m);
  for(const s of[claude,codex])assert.ok(s.includes('review-contract.md'));
});
test('common contract includes input/output evidence and fallback boundaries',async()=>{
  const doc=await text('core/review-contract.md');
  for(const word of ['scope','criteria','profile','stage','files','diff','currentSnapshot','evidence','independent=false','learner-submitted','stale','unverified','codeEvidence','fixDirection'])assert.ok(doc.includes(word),word);
});
test('review example uses actual fixture line and exact code evidence',async()=>{
  const s=await reviewState(),f=s.reviews[0].findings[0],lines=(await text('tests/fixtures/learner/app.js')).split('\n');
  assert.equal(assertState(s),s);
  assert.ok(f.lineStart>=1&&f.lineEnd<=lines.length);
  assert.ok(lines.slice(f.lineStart-1,f.lineEnd).join('\n').includes(f.codeEvidence));
});
for(const field of ['priority','requirementId','kind','file','lineStart','lineEnd','codeEvidence','condition','impact','verification','fixDirection'])test(`finding requires ${field}`,async()=>{
  const s=await reviewState();
  delete s.reviews[0].findings[0][field];
  assert.throws(()=>assertState(s),{
    code:'STATE_CORRUPT'
  });
});
test('review must account for every agreed criterion',async()=>{
  const s=await reviewState();
  s.reviews[0].criteria=[];
  assert.throws(()=>assertState(s),{
    code:'STATE_CORRUPT'
  });
});
