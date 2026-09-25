import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const config=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url))),cred=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));
const base='http://127.0.0.1:6102/api/direct',tokens={};
async function request(who,path,body,key,headers={}){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${tokens[who]}`,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{}),...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
const act=(who,action,body,key=randomUUID())=>request(who,'/actions/'+action,body,key);
const rows=async who=>(await request(who,'/bookings')).data.bookings;
const photo='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=';
test('driver original / return / resubmit / permission / unknown outcome / receiving confirmation',async(t)=>{
 for(const a of cred.accounts){const r=await request(null,'/session',{email:a.email,password:cred.password});assert.equal(r.status,200);tokens[a.name]=r.data.token;}
 const admin=new pg.Client(config.admin);await admin.connect();t.after(()=>admin.end());
 const run=Number((await admin.query('INSERT INTO validation.test_runs DEFAULT VALUES RETURNING id')).rows[0].id);const day=new Date(Date.UTC(2042,0,run)).toISOString().slice(0,10);
 const id=randomUUID(),ids=config.ids;
 assert.equal((await act('construction','create',{id,siteId:ids.site,locationId:ids.location,quantity:7,unit:'m3',soil:'第2種建設発生土',plannedAt:day+'T09:00:00+09:00',agreementNote:'匿名・伝票検証'})).status,200);
 assert.equal((await act('receiver','confirm',{bookingId:id,expectedVersion:1,agree:true})).status,200);
 assert.equal((await act('construction','assign',{bookingId:id,expectedVersion:2,vehicleId:ids.vehicle,driverId:ids.driver})).status,200);
 const assigned=(await rows('driver')).find(b=>b.id===id);
 const body={bookingId:id,tripId:assigned.trip.id,expectedTripVersion:assigned.trip.version,expectedVersion:0,quantity:12.5,unit:'t',reason:'原票単位を保持',filename:'anonymous.png',mime:'image/png',base64:photo,fields:{date:day,number:'TEST-01',item:'土',plate:'サンプル車両 01',origin:'搬出 A',destination:'受入 B',checked:true,gross:'20 t',tare:'7.5 t',net:'12.5 t'}};
 for(const who of ['driver-other','outsider','construction','receiver'])assert.equal((await request(who,'/driver-document-submit',body,randomUUID())).status,403);
 assert.equal((await request('driver','/driver-document-submit',{...body,fields:{...body.fields,checked:false}},randomUUID())).status,422);
 const key=randomUUID();const concurrent=await Promise.all([request('driver','/driver-document-submit',body,key),request('driver','/driver-document-submit',body,key)]);assert.deepEqual(concurrent[0],concurrent[1]);const first=concurrent[0];assert.equal(first.status,200,JSON.stringify(first));const aid=first.data.attachmentId;
 const repeated=await request('driver','/driver-document-submit',body,key);assert.deepEqual(repeated,first);
 assert.equal((await request('driver','/driver-document-submit',{...body,quantity:9},key)).status,409);
 let b=(await rows('receiver')).find(b=>b.id===id);assert.equal(b.actual,null);assert.equal(b.receiptRecord.unit,'t');assert.equal(Number(b.receiptRecord.quantity),12.5);assert.equal(b.receiptHistory.length,1);
 assert.equal((await request('driver-other',`/driver-document-fields?bookingId=${id}`)).data.documents.length,0);
 assert.equal((await fetch(base+'/attachments/'+aid,{headers:{Authorization:`Bearer ${tokens['driver-other']}`}})).status,404);
 const read=await fetch(base+'/attachments/'+aid,{headers:{Authorization:`Bearer ${tokens.receiver}`}});assert.equal(read.status,200);assert.deepEqual(Buffer.from(await read.arrayBuffer()),Buffer.from(photo,'base64'));
 assert.equal((await act('receiver-other','receipt_return',{bookingId:id,expectedVersion:1,reason:'拒否'})).status,403);
 const returned=await act('receiver','receipt_return',{bookingId:id,expectedVersion:1,reason:'原票番号を再確認'});assert.equal(returned.status,200);
 const second={...body,expectedVersion:2,quantity:12.4,reason:'原票の数量訂正',fields:{...body.fields,number:'TEST-02'}};
 assert.equal((await request('driver','/driver-document-submit',{...second,expectedVersion:1},randomUUID())).status,409);
 const lost=randomUUID();await assert.rejects(request('driver','/driver-document-submit',second,lost,{'X-Validation-Drop-Response':'1'}));
 const lookup=await request('driver','/operations/'+lost);assert.equal(lookup.data.state,'applied');
 assert.equal((await request('driver','/driver-document-submit',second,lost)).status,200);
 const freshLogin=await request(null,'/session',{email:'driver@sample.invalid',password:cred.password});tokens.driver=freshLogin.data.token;
 b=(await rows('driver')).find(b=>b.id===id);assert.equal(b.receiptHistory.length,3);assert.equal(b.actual,null);assert.equal(Number(b.receiptRecord.quantity),12.4);
 assert.equal((await request('driver',`/driver-document-fields?bookingId=${id}`)).data.documents.length,2);
 for(const [i,state] of ['site_arrived','in_transit','receiver_arrived','unloaded'].entries())assert.equal((await act('driver','report',{bookingId:id,expectedVersion:i+1,state,reportedAt:new Date().toISOString()})).status,200);
 assert.equal((await act('driver','receipt_confirm',{bookingId:id,expectedVersion:3,quantity:12.4,unit:'t',originalChecked:true,reason:'確認'})).status,403);
 assert.equal((await act('receiver','receipt_confirm',{bookingId:id,expectedVersion:3,quantity:12.4,unit:'t',originalChecked:true,reason:'原票 t のまま照合'})).status,200);
 for(const who of ['construction','receiver','driver']){b=(await rows(who)).find(b=>b.id===id);assert.equal(Number(b.actual.quantity),12.4);assert.equal(b.actual.unit,'t');}
 await admin.query('BEGIN');await admin.query('SET LOCAL ROLE ecodump_api');await admin.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[cred.accounts.find(a=>a.name==='driver-other').id]);assert.equal((await admin.query('SELECT * FROM direct.driver_document_fields WHERE booking_id=$1',[id])).rowCount,0);await admin.query('ROLLBACK');
 const dbCount=await admin.query('SELECT count(*) FROM direct.driver_document_fields WHERE booking_id=$1',[id]);assert.equal(Number(dbCount.rows[0].count),2);
 await writeFile(new URL('../.local/driver-documents-test.json',import.meta.url),JSON.stringify({bookingId:id,date:day,checks:21}));
});
