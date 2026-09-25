import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID as uuid } from 'node:crypto';
import pg from '../server/node_modules/pg/lib/index.js';
const config=JSON.parse(await readFile(new URL('../server/.local/config.json',import.meta.url)));
const credentials=JSON.parse(await readFile(new URL('../server/.local/credentials.json',import.meta.url)));
const base='http://127.0.0.1:6103'; const tokens={};
async function call(role,path,body,key=uuid(),headers={}){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${tokens[role]}`,'Content-Type':'application/json','Idempotency-Key':key,...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
const act=(role,action,body,key,headers)=>call(role,`/api/match/actions/${action}`,body,key,headers);
async function list(role,query=''){const r=await call(role,`/api/match/list?side=${role==='receiver'?'receiving':'construction'}${query}`);assert.equal(r.status,200,JSON.stringify(r));return r.data.data;}
const docs=['public','shared','internal'].map(visibility=>({id:uuid(),name:`${visibility}.pdf`,mime:'application/pdf',base64:Buffer.from(`%PDF-1.4\n${visibility}\n%%EOF`).toString('base64'),visibility}));
const data=title=>({title,region:'匿名検証地域',soil:'第2種建設発生土',quantity:100,unit:'m3',start:'2038-01-01',end:'2038-01-31',public:'公開概要',shared:'相談限定の入口案内',internal:'非公開社内メモ',privateExtra:'公開してはいけない追加項目',documents:docs});
test('PostgreSQL shared matching acceptance',async t=>{
 assert.equal(config.api.database,'ecodump_direct_validation');
 for(const name of ['construction','receiver','driver','construction-other','receiver-other','outsider']){const account=credentials.accounts.find(a=>a.name===name);const r=await call(name,'/api/direct/session',{email:account.email,password:credentials.password});assert.equal(r.status,200);tokens[name]=r.data.token;}
 const source=uuid(),target=uuid(),consultation=uuid(); const sourceData=data('API検証搬出'),targetData=data('API検証受入');
 const db=new pg.Client(config.admin);await db.connect();
 t.after(async()=>{await db.query('BEGIN');const cs=[source,target];const ag=await db.query('SELECT booking_id FROM direct.match_agreements WHERE consultation_id=$1',[consultation]);await db.query('UPDATE direct.bookings SET match_agreement_id=NULL WHERE id=ANY($1::uuid[])',[ag.rows.map(r=>r.booking_id).filter(Boolean)]);await db.query('DELETE FROM direct.match_agreements WHERE consultation_id=$1',[consultation]);await db.query('DELETE FROM direct.match_acceptances WHERE offer_id IN (SELECT id FROM direct.match_offers WHERE consultation_id=$1)',[consultation]);await db.query('DELETE FROM direct.match_offers WHERE consultation_id=$1',[consultation]);await db.query('DELETE FROM direct.match_consultations WHERE id=$1',[consultation]);await db.query('DELETE FROM direct.match_history WHERE case_id=ANY($1::uuid[])',[cs]);await db.query('DELETE FROM direct.match_cases WHERE id=ANY($1::uuid[])',[cs]);await db.query("DELETE FROM direct.match_operations WHERE result->>'caseId'=ANY($1::text[]) OR result->>'consultationId'=$2 OR result->>'bookingId'=ANY($3::text[])",[cs,consultation,ag.rows.map(r=>r.booking_id).filter(Boolean)]);for(const r of ag.rows)if(r.booking_id)await db.query('DELETE FROM direct.bookings WHERE id=$1',[r.booking_id]);await db.query('COMMIT');await db.end();});
 await t.test('scoped draft creation, file persistence, invalid inputs and immutable idempotency',async()=>{
 const key=uuid(),payload={id:source,side:'construction',siteId:config.ids.site,data:sourceData};
 assert.equal((await act('construction','create',{...payload,siteId:config.ids.siteOther})).status,403);
 assert.equal((await act('construction','create',{...payload,data:{...sourceData,quantity:-1}})).status,422);
 assert.equal((await act('construction','create',{...payload,data:{...sourceData,documents:[docs[0],{...docs[1],id:docs[0].id}]}})).status,422);
 assert.equal((await act('construction','create',payload,key)).status,200);
 assert.equal((await act('construction','create',payload,key)).status,200);
 assert.equal((await act('construction','create',{...payload,data:{...sourceData,quantity:9}},key)).status,409);
 assert.equal((await act('receiver','create',{id:target,side:'receiving',siteId:config.ids.location,data:targetData})).status,200);
 assert.ok(!(await list('receiver')).searchResults.some(c=>c.id===source));
 assert.equal((await act('construction-other','publish',{id:source,version:1})).status,403);
 });
 await t.test('public and consultation document visibility, unit-aware search and messaging',async()=>{
 assert.equal((await act('construction','publish',{id:source,version:1})).status,200);assert.equal((await act('receiver','publish',{id:target,version:1})).status,200);
 const publicCase=(await list('receiver','&region=匿名検証地域&quantity=90&unit=m3&start=2038-01-01')).searchResults.find(c=>c.id===source);
 assert.equal(publicCase.privateExtra,undefined);assert.equal(publicCase.shared,undefined);assert.equal(publicCase.internal,undefined);assert.equal(publicCase.documents.length,1);
 assert.equal((await call('receiver',`/api/match/documents/${source}/${docs[1].id}`)).status,403);
 assert.equal((await call('receiver',`/api/match/documents/${source}/${docs[0].id}`)).data.document.base64,docs[0].base64);
 assert.ok(!(await list('receiver','&unit=t')).searchResults.some(c=>c.id===source));
 assert.equal((await act('construction','consult',{id:consultation,sourceId:source,targetId:target,message:'試験書類を確認してください'})).status,200);
 const shared=(await list('receiver')).searchResults.find(c=>c.id===source);assert.equal(shared.shared,sourceData.shared);assert.equal(shared.internal,undefined);assert.equal(shared.documents.length,2);
 assert.equal((await call('receiver',`/api/match/documents/${source}/${docs[1].id}`)).status,200);assert.equal((await call('receiver',`/api/match/documents/${source}/${docs[2].id}`)).status,403);
 assert.equal((await list('receiver')).consultations.find(c=>c.id===consultation).initialMessage,'試験書類を確認してください');
 });
 const terms={soil:sourceData.soil,quantity:80,unit:'m3',start:'2038-01-05',end:'2038-01-10',conditions:'入口で計量して受入',message:'この数量で相談'};
 let offer;
 await t.test('editable offers, history, stale versions and renewed bilateral consent',async()=>{
 assert.equal((await act('construction','offer',{id:consultation,version:1,terms:{...terms,unit:'t'}})).status,422);
 assert.equal((await act('construction','offer',{id:consultation,version:1,terms})).status,200);
 let c=(await list('receiver')).consultations.find(c=>c.id===consultation);offer=c.offers.at(-1);
 assert.equal((await act('construction','accept',{id:consultation,version:c.version,offerId:offer.id})).status,200);
 c=(await list('receiver')).consultations.find(c=>c.id===consultation);
 assert.equal((await act('receiver','offer',{id:consultation,version:c.version,terms:{...terms,quantity:75}})).status,200);
 c=(await list('receiver')).consultations.find(c=>c.id===consultation);assert.equal(c.offers.length,2);
 assert.equal((await act('receiver','accept',{id:consultation,version:c.version,offerId:offer.id})).status,409);
 offer=c.offers.at(-1);
 assert.equal((await act('receiver','accept',{id:consultation,version:c.version,offerId:offer.id})).status,200);
 assert.ok(!(await list('receiver')).agreements.some(a=>a.snapshot.source.id===source));
 c=(await list('construction')).consultations.find(c=>c.id===consultation);
 assert.equal((await act('construction','accept',{id:consultation,version:c.version,offerId:offer.id})).status,200);
 });
 await t.test('agreed snapshot stays frozen after edits, transfers correct locations without confirming or dispatching',async()=>{
 assert.equal((await act('construction','edit',{id:source,version:2,data:{...sourceData,title:'編集後の搬出',quantity:120,shared:'編集後の共有'}})).status,200);
 assert.equal((await act('construction','edit',{id:source,version:2,data:sourceData})).status,409);
 const agreed=(await list('receiver')).agreements.find(a=>a.snapshot.source.id===source);
 assert.equal(agreed.snapshot.source.title,sourceData.title);assert.equal(agreed.snapshot.source.shared,sourceData.shared);assert.equal(agreed.snapshot.source.internal,undefined);assert.equal(agreed.snapshot.source.documents.length,2);assert.ok(agreed.snapshot.source.documents[0].base64);
 assert.equal((await act('receiver','reserve',{id:consultation,plannedAt:'2038-01-06T09:00:00+09:00'})).status,403);
 assert.equal((await act('construction','reserve',{id:consultation,plannedAt:'2038-02-06T09:00:00+09:00'})).status,422);
 const operation=uuid();await assert.rejects(act('construction','reserve',{id:consultation,plannedAt:'2038-01-06T10:00:00+09:00'},operation,{'x-validation-drop-response':'1'}));
 const result=await call('construction',`/api/match/operations/${operation}`);assert.equal(result.data.status,'completed');
 const bookings=(await call('receiver','/api/direct/bookings')).data.bookings;const booking=bookings.find(b=>b.id===result.data.result.bookingId);assert.equal(booking.status,'requested');assert.equal(booking.trip,null);assert.equal(booking.quantity,75);assert.equal(booking.site.id,config.ids.site);assert.equal(booking.location.id,config.ids.location);assert.equal(booking.agreementState,'agreed');
 assert.equal((await list('construction')).history.filter(h=>h.caseId===source).length,3);
 assert.equal((await act('construction','close',{id:source,version:3})).status,200);assert.ok(!(await list('receiver')).searchResults.some(c=>c.id===source));
 });
 await t.test('database denies raw private reads and out-of-scope mutations; driver cannot match',async()=>{
 assert.equal((await call('driver','/api/match/list?side=construction')).status,403);
 const scoped=new pg.Client(config.api);await scoped.connect();try{await scoped.query('BEGIN');await scoped.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[credentials.accounts.find(a=>a.name==='construction-other').id]);await assert.rejects(scoped.query('SELECT * FROM direct.match_cases'),e=>e.code==='42501');await scoped.query('ROLLBACK');await scoped.query('BEGIN');await scoped.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[credentials.accounts.find(a=>a.name==='construction-other').id]);await assert.rejects(scoped.query("SELECT direct.match_mutate('publish',$1,$2)",[uuid(),{id:source,version:4}]),e=>e.code==='42501');await scoped.query('ROLLBACK')}finally{await scoped.end()}
 });
});
