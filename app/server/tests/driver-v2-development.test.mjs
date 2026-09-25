// Isolated component/API development checks; not the formal three-party acceptance run.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const cfg=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url))),creds=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));
const base=process.env.DRIVER_API_BASE||'http://127.0.0.1:6102/api/direct';const tokens={};
async function req(who,path,body,key,extra={}){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(tokens[who]?{Authorization:`Bearer ${tokens[who]}`} : {}),'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{}),...extra},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
const act=(who,action,body,key=randomUUID(),extra={})=>req(who,'/actions/'+action,body,key,extra);
const list=async who=>(await req(who,'/bookings')).data.bookings;
const photo='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r));return r.data;};
test('driver v2: shared trip identity, external carrier, stale assignment, issue, correction, scoped originals and unknown outcome',async t=>{
 const names=['narita-construction','narita-receiver-tochigi','narita-driver-aoki','narita-driver-sato'];
 for(const n of names){const a=creds.accounts.find(a=>a.name===n);tokens[n]=ok(await req(null,'/session',{email:a.email,password:creds.password})).token;}
 const C=names[0],R=names[1],D=names[2],X=names[3],ids=cfg.naritaIds;
 const db=new pg.Client(cfg.admin);await db.connect();t.after(()=>db.end());
 const run=Number((await db.query('INSERT INTO validation.test_runs DEFAULT VALUES RETURNING id')).rows[0].id);const day=new Date(Date.UTC(2057,0,run)).toISOString().slice(0,10);
 const bookingId=randomUUID();ok(await act(C,'create',{id:bookingId,siteId:ids.siteA,locationId:ids.locationTochigi,quantity:30,soil:'第2種建設発生土',unit:'m3',plannedAt:day+'T08:00:00+09:00',agreementNote:'ドライバー単体開発確認のための架空fixture'}));ok(await act(R,'confirm',{bookingId,expectedVersion:1,agree:true}));
 const tripIds=[];for(let i=0;i<3;i++){const result=ok(await act(C,'trip_add',{bookingId,expectedVersion:2+i,vehicleId:i===2?ids.vehicle02:ids.vehicle01,driverId:i===2?ids.driverSato:ids.driverAoki,quantity:10,plannedAt:day+`T${String(8+i*3).padStart(2,'0')}:00:00+09:00`,reason:'複数便の開発確認'}));tripIds.push(result.tripId);}
 let own=(await list(D)).filter(b=>b.id===bookingId);assert.equal(own.length,2);assert.deepEqual(new Set(own.map(b=>b.trip.id)),new Set(tripIds.slice(0,2)));assert.ok(own.every(b=>Number(b.trip.plannedQuantity)===10));
 const identity=ok(await req(D,'/driver-identity'));assert.deepEqual(identity.companies,['モデル運送〈架空〉']);
 const body={bookingId,tripId:tripIds[0],expectedVersion:1,state:'site_arrived',reportedAt:new Date().toISOString()};
 assert.equal((await act(X,'report',body)).status,403);
 ok(await act(C,'trip_reassign',{bookingId,tripId:tripIds[1],expectedVersion:1,vehicleId:ids.vehicle02,driverId:ids.driverSato,reason:'代車の版確認'}));assert.equal((await act(D,'report',{...body,tripId:tripIds[1]})).status,403);
 const key=randomUUID();const report={...body,expectedVersion:1};const pair=await Promise.all([act(D,'report',report,key),act(D,'report',report,key)]);ok(pair[0]);assert.deepEqual(pair[0],pair[1]);
 assert.equal((await act(D,'report',{...report,expectedVersion:2})).status,422);
 let first=(await list(D)).find(b=>b.trip?.id===tripIds[0]);assert.equal(first.events.length,1);assert.ok(first.events[0].receivedAt);
 ok(await act(D,'report_correct',{bookingId,tripId:tripIds[0],expectedVersion:2,eventId:first.events[0].id,reportedAt:new Date().toISOString(),reason:'時刻入力誤りの訂正・開発確認'}));
 const issueKey=randomUUID();await assert.rejects(act(D,'trip_issue',{bookingId,tripId:tripIds[0],expectedVersion:3,kind:'receiving_unavailable',reason:'検証用の受入不可連絡'},issueKey,{'X-Validation-Drop-Response':'1'}));assert.equal(ok(await req(D,'/operations/'+issueKey)).state,'applied');
 first=(await list(D)).find(b=>b.trip?.id===tripIds[0]);assert.equal(first.trip.status,'site_arrived');assert.ok(first.issues?.some(i=>i.kind==='receiving_unavailable'));assert.ok(first.reportCorrections?.length);assert.equal(JSON.stringify(first.reportCorrections).includes('agreement_note'),false);assert.ok(first.reportCorrections[0].originalReportedAt);assert.ok(first.trip.plannedAt);
 const document={bookingId,tripId:tripIds[0],expectedTripVersion:first.trip.version,expectedVersion:0,quantity:9.5,unit:'m3',reason:'検証値',filename:'validation.png',mime:'image/png',base64:photo,fields:{date:day,number:'DEV-01',item:'第2種建設発生土',plate:'検証02',origin:'成田モデルA',destination:'栃木モデル',checked:true}};
 assert.equal((await req(D,'/driver-document-submit',{...document,expectedTripVersion:1},randomUUID())).status,409);
 const {expectedTripVersion:ignored,...unversioned}=document;assert.equal((await req(D,'/driver-document-submit',unversioned,randomUUID())).status,409);
 const saved=ok(await req(D,'/driver-document-submit',document,randomUUID()));assert.equal(ok(await req(D,`/driver-document-fields?bookingId=${bookingId}&tripId=${tripIds[1]}`)).documents.length,0);assert.equal(ok(await req(X,`/driver-document-fields?bookingId=${bookingId}&tripId=${tripIds[0]}`)).documents.length,0);
 const foreign=await fetch(base+'/attachments/'+saved.attachmentId,{headers:{Authorization:`Bearer ${tokens[X]}`}});assert.equal(foreign.status,404);
 const a=creds.accounts.find(a=>a.name===D);tokens[D]=ok(await req(null,'/session',{email:a.email,password:creds.password})).token;first=(await list(D)).find(b=>b.trip?.id===tripIds[0]);assert.equal(Number(first.receiptRecord.quantity),9.5);assert.equal(first.actual,null);
 await writeFile(new URL('../../../docs/narita-validation/driver-v2-development-evidence.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),boundary:'local isolated API development, not formal acceptance',bookingId,tripIds,checks:['own-trip projection','carrier master','old version rejected','duplicate report idempotent','invalid report order rejected','report time correction history','lost response lookup','issue does not change receipt state','stale/missing document version rejected','sibling document isolation','foreign original denied','relogin persistence']},null,2));
});
