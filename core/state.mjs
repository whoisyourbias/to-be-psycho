/** Portable v1 state validation. This module never executes learner code. */
export function fault(code, message) {
  return Object.assign(new Error(message), {
    code
  });
}
const fail = message => {
  throw fault('STATE_CORRUPT', message);
};
const object = (v, label) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) fail(`${label}: expected object`);
};
const fields = (v, names, label) => {
  object(v,label);
  for(const key of Object.keys(v)) if(!names.includes(key)) fail(`${label}: unexpected ${key}`);
  for(const key of names) if(!Object.hasOwn(v,key)) fail(`${label}: missing ${key}`);
};
const str = (v,label,empty=false) => {
  if(typeof v!=='string'||(!empty&&!v.trim())) fail(`${label}: expected string`);
};
const integer = (v,label,min=0) => {
  if(!Number.isSafeInteger(v)||v<min) fail(`${label}: expected integer >= ${min}`);
};
const choice = (v,choices,label)=>{
  if(!choices.includes(v))fail(`${label}: invalid value`);
};
const strings=(v,label)=>{
  if(!Array.isArray(v))fail(`${label}: expected array`);
  v.forEach(x=>str(x,label));
};
const iso=(v,label)=>{
  str(v,label);
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().replace('.000Z','Z')!==v.replace('.000Z','Z'))fail(`${label}: expected UTC ISO timestamp`);
};
const records=(v,label,fn)=>{
  if(!Array.isArray(v))fail(`${label}: expected array`);
  const ids=new Set();
  for(const x of v){
    object(x,label);
    str(x.id,`${label}.id`);
    if(ids.has(x.id))fail(`${label}: duplicate id`);
    ids.add(x.id);
    fn(x);
  }
  return ids;
};
const nullableString=(v,l)=>{
  if(v!==null)str(v,l);
};
export function assertState(value) {
  object(value,'state');
  if(Object.hasOwn(value,'schemaVersion')&&value.schemaVersion!==1)throw fault('UNSUPPORTED_SCHEMA',`Unsupported schema ${value.schemaVersion}`);
  fields(value,['schemaVersion','sessionId','project','revision','packageVersion','profileVersions','scope','stage','attempts','hints','snapshots','evidence','reviews'],'state');
  str(value.sessionId,'sessionId');
  integer(value.revision,'revision');
  str(value.packageVersion,'packageVersion');
  fields(value.project,['id','rootIdentity'],'project');
  str(value.project.id,'project.id');
  str(value.project.rootIdentity,'rootIdentity');
  object(value.profileVersions,'profileVersions');
  for(const [k,v]of Object.entries(value.profileVersions)){
    str(k,'profile');
    str(v,'profile version');
  }
  fields(value.scope,['goal','confirmed','criteria','rationale'],'scope');
  str(value.scope.goal,'goal');
  str(value.scope.rationale,'rationale',true);
  if(typeof value.scope.confirmed!=='boolean')fail('confirmed: expected boolean');
  const criteria=records(value.scope.criteria,'criteria',c=>{
    fields(c,['id','description'],'criterion');
    str(c.description,'criterion.description');
  });
  fields(value.stage,['id','status','openQuestions','nextAction'],'stage');
  str(value.stage.id,'stage.id');
  choice(value.stage.status,['scoping','active','needs-work','ready','complete'],'stage.status');
  strings(value.stage.openQuestions,'openQuestions');
  str(value.stage.nextAction,'nextAction',true);
  if(value.stage.status!=='scoping'&&!value.scope.confirmed)fail('Active stage requires confirmed scope');
  const attempts=records(value.attempts,'attempts',a=>{
    fields(a,['id','stageId','observation','at'],'attempt');
    str(a.stageId,'attempt.stageId');
    str(a.observation,'observation');
    iso(a.at,'attempt.at');
  });
  records(value.hints,'hints',h=>{
    fields(h,['id','stageId','attemptId','level','disclosed','at'],'hint');
    str(h.stageId,'hint.stageId');
    if(!attempts.has(h.attemptId))fail('Hint references missing attempt');
    choice(h.level,[1,2,3],'level');
    str(h.disclosed,'disclosed');
    iso(h.at,'hint.at');
  });
  const snapshots=records(value.snapshots,'snapshots',s=>{
    fields(s,['id','environmentId','coverage','files','capturedAt'],'snapshot');
    str(s.environmentId,'environmentId');
    choice(s.coverage,['complete','unknown'],'coverage');
    iso(s.capturedAt,'capturedAt');
    if(!Array.isArray(s.files))fail('files: expected array');
    const seen=new Set();
    for(const f of s.files){
      fields(f,['path','sha256'],'file');
      str(f.path,'file.path');
      if(f.path.startsWith('/')||/[\\:\0]/.test(f.path)||f.path.split('/').some(x=>!x||x==='.'||x==='..'))fail('Unsafe snapshot path');
      if(seen.has(f.path))fail('Duplicate snapshot path');
      seen.add(f.path);
      if(!/^[a-f0-9]{64}$/.test(f.sha256))fail('Invalid sha256');
    }
  });
  records(value.evidence,'evidence',e=>{
    fields(e,['id','snapshotId','environmentId','command','executedAt','submittedAt','actor','source','result','summary'],'evidence');
    nullableString(e.snapshotId,'snapshotId');
    nullableString(e.environmentId,'environmentId');
    if(e.snapshotId!==null&&!snapshots.has(e.snapshotId))fail('Evidence references missing snapshot');
    str(e.command,'command');
    if(e.executedAt!==null)iso(e.executedAt,'executedAt');
    iso(e.submittedAt,'submittedAt');
    choice(e.actor,['learner'],'actor');
    choice(e.source,['learner-submitted'],'source');
    choice(e.result,['pass','fail','unknown'],'result');
    str(e.summary,'summary');
  });
  records(value.reviews,'reviews',r=>{
    fields(r,['id','stageId','snapshotId','independent','findings','criteria','limitations','nextAction'],'review');
    str(r.stageId,'review.stageId');
    str(r.snapshotId,'review.snapshotId');
    if(!snapshots.has(r.snapshotId))fail('Review references missing snapshot');
    if(typeof r.independent!=='boolean')fail('independent: expected boolean');
    strings(r.limitations,'limitations');
    str(r.nextAction,'review.nextAction');
    if(!Array.isArray(r.findings))fail('findings: expected array');
    for(const f of r.findings){
      fields(f,['priority','requirementId','kind','file','lineStart','lineEnd','codeEvidence','condition','impact','verification','fixDirection'],'finding');
      choice(f.priority,['P0','P1','P2','P3'],'priority');
      choice(f.kind,['confirmed','risk','preference'],'kind');
      if(!criteria.has(f.requirementId))fail('Finding references unknown requirement');
      for(const k of ['file','codeEvidence','condition','impact','verification','fixDirection'])str(f[k],k);
      integer(f.lineStart,'lineStart',1);
      integer(f.lineEnd,'lineEnd',f.lineStart);
    }
    const reviewed=records(r.criteria,'review.criteria',c=>{
      fields(c,['id','status','reason'],'review criterion');
      if(!criteria.has(c.id))fail('Unknown reviewed criterion');
      choice(c.status,['met','unmet','unverified'],'criterion status');
      str(c.reason,'criterion reason');
    });
    if(reviewed.size!==criteria.size)fail('Review must account for every criterion');
  });
  return value;
}
