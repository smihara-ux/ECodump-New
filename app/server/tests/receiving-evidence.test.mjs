import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const config=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url))),credentials=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));
const tokens={},base='http://127.0.0.1:6103/api/direct';
async function request(who,path,body,key=randomUUID(),extra={}){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${tokens[who]||''}`,'Content-Type':'application/json','Idempotency-Key':key,...extra},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
const act=(who,action,body,key,extra)=>request(who,`/actions/${action}`,body,key,extra);
async function booking(who,id){return (await request(who,'/bookings')).data.bookings.find(b=>b.id===id);}
const image=(await readFile(new URL('../../../docs/receiving-evidence-qa/anonymous-original.png',import.meta.url))).toString('base64');
test('receiving evidence: persisted original, review, correction, gate, isolation and uncertain outcomes',async t=>{
 const db=new pg.Client(config.admin);await db.connect();
 try{
 for(const a of credentials.accounts){const r=await request(null,'/session',{email:a.email,password:credentials.password});assert.equal(r.status,200);tokens[a.name]=r.data.token;}
 const run=(await db.query('INSERT INTO validation.test_runs DEFAULT VALUES RETURNING id')).rows[0].id;
 const day=new Date(Date.UTC(2052,0,Number(run))).toISOString().slice(0,10);const id=randomUUID();
 const must=async promise=>{const r=await promise;assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 await must(act('construction','create',{id,siteId:config.ids.site,locationId:config.ids.location,quantity:7,unit:'m3',soil:'第2種建設発生土',plannedAt:`${day}T09:00:00+09:00`,agreementNote:'匿名受入証拠検証'}));
 await must(act('receiver','confirm',{bookingId:id,expectedVersion:1,agree:true}));
 await must(act('construction','assign',{bookingId:id,expectedVersion:2,vehicleId:config.ids.vehicle,driverId:config.ids.driver}));
 const attachment=await must(act('driver','attachment',{bookingId:id,filename:'anonymous-original.png',mime:'image/png',base64:image}));
 await t.test('driver original submission, receiver return, resubmission retain history',async()=>{
 await must(act('driver','receipt_submit',{bookingId:id,expectedVersion:0,attachmentId:attachment.attachmentId,quantity:6.5,unit:'t'}));
 assert.equal((await booking('receiver',id)).receiptRecord.status,'pending');
 assert.equal((await act('construction','receipt_return',{bookingId:id,expectedVersion:1,reason:'denied'})).status,403);
 assert.equal((await act('receiver','receipt_return',{bookingId:id,expectedVersion:1,reason:''})).status,422);
 await must(act('receiver','receipt_return',{bookingId:id,expectedVersion:1,reason:'原票単位を再確認'}));
 await must(act('driver','receipt_submit',{bookingId:id,expectedVersion:2,attachmentId:attachment.attachmentId,quantity:6.8,unit:'t',reason:'原票を再確認して提出'}));
 const b=await booking('receiver',id);assert.equal(b.receiptHistory.length,3);assert.equal(b.receiptHistory[0].after_data.quantity,6.5);assert.equal(b.actual,null);
 });
 await t.test('unload and explicit original check required; concurrent review cannot overwrite',async()=>{
 const body={bookingId:id,expectedVersion:3,quantity:6.8,unit:'t',reason:'原票はt単位',originalChecked:true};
 assert.equal((await act('receiver','receipt_confirm',body)).status,422);
 for(const [i,state] of ['site_arrived','in_transit','receiver_arrived','unloaded'].entries())await must(act('driver','report',{bookingId:id,expectedVersion:i+1,state,reportedAt:new Date().toISOString()}));
 assert.equal((await act('receiver','receipt_confirm',{...body,originalChecked:false})).status,422);
 assert.equal((await act('receiver','actual',{bookingId:id,expectedVersion:5,quantity:6.8,unit:'m3'})).status,422);
 const updates=await Promise.all([act('receiver','receipt_confirm',body),act('receiver','receipt_confirm',body)]);assert.deepEqual(updates.map(x=>x.status).sort(),[200,409]);
 assert.equal((await booking('construction',id)).actual.unit,'t');
 });
 await t.test('correction has original actor, time, before/after; lost reply is queried',async()=>{
 const key=randomUUID(),body={bookingId:id,expectedVersion:4,quantity:6.7,unit:'t',reason:'原票の小数を訂正',originalChecked:true};
 assert.equal((await act('receiver','receipt_correct',{...body,reason:''})).status,422);
 await assert.rejects(act('receiver','receipt_correct',body,key,{'x-validation-drop-response':'1'}));
 assert.equal((await request('receiver',`/operations/${key}`)).data.state,'applied');
 await must(act('receiver','receipt_correct',body,key));
 for(const role of ['receiver','driver','construction']){const b=await booking(role,id);assert.equal(b.actual.quantity,6.7);assert.equal(b.receiptHistory.length,5);assert.equal(b.receiptHistory.at(-1).before_data.quantity,6.8);assert.ok(b.receiptHistory.at(-1).actorName);assert.ok(b.receiptHistory.at(-1).recorded_at);}
 const r=await fetch(base+`/attachments/${attachment.attachmentId}`,{headers:{Authorization:`Bearer ${tokens.receiver}`}});assert.deepEqual(Buffer.from(await r.arrayBuffer()),Buffer.from(image,'base64'));
 });
 await t.test('gate records separate human verification and duplicates',async()=>{
 const body={bookingId:id,locationId:config.ids.location,plate:'サンプル車番 01',direction:'entry',occurredAt:new Date(Date.now()-3600000).toISOString(),issue:'unread',attachmentId:attachment.attachmentId};
 const key=randomUUID();const rs=await Promise.all([act('receiver','gate_record',body,key),act('receiver','gate_record',body,key)]);assert.deepEqual(rs.map(x=>x.status),[200,200]);const gid=rs[0].data.recordId;
 let b=await booking('receiver',id);assert.equal(b.gateRecords.length,1);assert.equal(b.gateRecords[0].status,'pending');assert.equal(b.gateRecords[0].source,'human');
 await must(act('receiver','gate_review',{recordId:gid,bookingId:id,expectedVersion:1,reason:'写真・車番・便を照合'}));
 const duplicate=await must(act('receiver','gate_record',{...body,issue:'duplicate'}));await must(act('receiver','gate_review',{recordId:duplicate.recordId,bookingId:id,expectedVersion:1,reason:'同じ通過を二重登録',decision:'dismiss'}));
 const exit=await must(act('receiver','gate_record',{...body,direction:'exit',occurredAt:new Date(Date.now()-600000).toISOString(),issue:'none'}));await must(act('receiver','gate_review',{recordId:exit.recordId,bookingId:id,expectedVersion:1,reason:'退場確認'}));
 b=await booking('receiver',id);assert.equal(b.gateRecords.filter(r=>r.status==='confirmed').length,2);assert.equal(b.gateRecords.filter(r=>r.status==='dismissed').length,1);
 const unknown=await must(act('receiver','gate_record',{...body,bookingId:undefined,attachmentId:null,issue:'unexpected'}));assert.ok((await request('receiver','/gate-records')).data.records.some(r=>r.id===unknown.recordId));
 });
 await t.test('API and raw RLS prevent unrelated evidence and attachment access',async()=>{
 for(const role of ['receiver-other','construction-other','driver-other','outsider']){
 assert.equal(await booking(role,id),undefined);assert.equal((await request(role,`/attachments/${attachment.attachmentId}`)).status,404);
 assert.equal((await act(role,'receipt_correct',{bookingId:id,expectedVersion:5,quantity:2,unit:'t',reason:'denied',originalChecked:true})).status,403);
 assert.equal((await act(role,'gate_record',{locationId:config.ids.location,plate:'X',direction:'entry',issue:'none',occurredAt:new Date().toISOString()})).status,403);
 }
 const api=new pg.Client(config.api);await api.connect();try{await api.query('BEGIN');await api.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[credentials.accounts.find(a=>a.name==='outsider').id]);for(const table of ['receipts','receipt_history','gate_records','gate_history'])assert.equal((await api.query(`SELECT * FROM direct.${table}`)).rowCount,0);await assert.rejects(api.query('DELETE FROM direct.receipts'),e=>e.code==='42501');await api.query('ROLLBACK');}finally{await api.end();}
 });
 await writeFile(new URL('../../../docs/receiving-evidence-qa/fixture.json',import.meta.url),JSON.stringify({day,bookingId:id,attachmentId:attachment.attachmentId},null,2));
 }finally{await db.end();}
});
