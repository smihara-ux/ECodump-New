import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialCompliance, normalizeCompliance, saveParticipation, changeDocument, findParticipation, participationDocuments } from '../src/demo/complianceModel.mjs';
import { demoSites } from '../src/demo/model.mjs';

test('legacy IDs, document versions and histories survive participation normalization', () => {
  const state=initialCompliance();
  const row=state.records.find(r=>r.id==='NC-03:許可情報');row.version=8;row.history=[{message:'保存済み履歴'}];row.comments=[{text:'保存済みコメント'}];
  const next=normalizeCompliance(state);
  assert.deepEqual(next.records,state.records);
  assert.equal(findParticipation(next,'NC-03',demoSites[0].id).participationId,`NC-03:${demoSites[0].id}`);
  assert.equal(findParticipation(next,'NC-03',demoSites[0].id).parentId,'NC-02');
});
test('another site gets independent participation and documents without relocating old records', () => {
  const state=initialCompliance();const original=structuredClone(state.records);
  const next=saveParticipation(state,'NC-03',{siteId:demoSites[1].id,contact:'B担当',email:'b@example.invalid',role:'運搬'});
  assert.deepEqual(next.records.slice(0,18),original);
  assert.equal(findParticipation(next,'NC-03',demoSites[0].id).state,'招待未対応');
  assert.equal(findParticipation(next,'NC-03',demoSites[1].id).contact,'B担当');
  assert.equal(participationDocuments(next,'NC-03',demoSites[1].id).length,6);
  const twice=saveParticipation(next,'NC-03',{siteId:demoSites[1].id,contact:'訂正担当'});
  assert.equal(twice.participants.length,4);assert.equal(twice.records.length,24);
  assert.equal(findParticipation(twice,'NC-03',demoSites[1].id).history.length,2);
});
test('site-specific document updates cannot modify another site or lose history', () => {
  const state=saveParticipation(initialCompliance(),'NC-03',{siteId:demoSites[1].id});
  const id=participationDocuments(state,'NC-03',demoSites[1].id).find(r=>r.category==='許可情報').id;
  const next=changeDocument(state,id,'draft',{checks:['建設業許可情報'],expectedVersion:1});
  assert.deepEqual(participationDocuments(next,'NC-03',demoSites[0].id),participationDocuments(state,'NC-03',demoSites[0].id));
  assert.equal(next.records.find(r=>r.id===id).version,2);
  assert.throws(()=>changeDocument(next,id,'draft',{checks:[],expectedVersion:1}),/版が更新/);
});
test('unknown company/site cannot create pretend participation', () => {
  assert.throws(()=>saveParticipation(initialCompliance(),'SC-unknown',{siteId:demoSites[0].id}),/会社/);
  assert.throws(()=>saveParticipation(initialCompliance(),'NC-03',{siteId:''}),/会社/);
  assert.equal(findParticipation(initialCompliance(),'NC-03','32184'),undefined);
});
