// Baseline API verification, NOT a Narita seed. Shared Narita IDs remain required.
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import pg from 'pg';
const config=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url))),creds=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));
const base='http://127.0.0.1:6103/api/direct',tokens={};
async function call(who,path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID(),...(tokens[who]?{Authorization:`Bearer ${tokens[who]}`}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
async function login(who){tokens[who]=(await call(null,'/session',{email:creds.accounts.find(a=>a.name===who).email,password:creds.password})).token;}
const act=(who,action,body)=>call(who,`/actions/${action}`,body);
test('shared DB: same vehicle three trips; planned 10 vs confirmed 9.5; new session persists',async()=>{
 const db=new pg.Client(config.admin);await db.connect();let run;try{run=(await db.query('INSERT INTO validation.test_runs DEFAULT VALUES RETURNING id')).rows[0].id;}finally{await db.end();}
 const day=new Date(Date.UTC(2055,0,Number(run))).toISOString().slice(0,10),ids=[];
 for(const who of ['construction','receiver','driver'])await login(who);
 for(const hour of ['08','11','14']){const id=randomUUID();ids.push(id);await act('construction','create',{id,siteId:config.ids.site,locationId:config.ids.location,quantity:10,unit:'m3',soil:'第2種建設発生土',plannedAt:`${day}T${hour}:00:00+09:00`,agreementNote:'既存匿名APIの3便検証。成田seedではない'});await act('receiver','confirm',{bookingId:id,expectedVersion:1,agree:true});await act('construction','assign',{bookingId:id,expectedVersion:2,vehicleId:config.ids.vehicle,driverId:config.ids.driver});}
 const list=(await call('driver','/bookings')).bookings.filter(b=>ids.includes(b.id));assert.equal(list.length,3);assert.equal(new Set(list.map(b=>b.trip.vehicleId)).size,1);assert.deepEqual(list.map(b=>b.trip.rotation).sort(),[1,2,3]);assert.equal(new Set(list.map(b=>b.trip.id)).size,3);
 const id=ids[0],base64=(await readFile(new URL('../../../docs/receiving-evidence-qa/anonymous-original.png',import.meta.url))).toString('base64');
 const photo=await act('driver','attachment',{bookingId:id,filename:'baseline-test-document.png',mime:'image/png',base64});
 await act('driver','receipt_submit',{bookingId:id,expectedVersion:0,attachmentId:photo.attachmentId,quantity:9.5,unit:'m3'});
 assert.equal((await call('construction','/bookings')).bookings.find(b=>b.id===id).actual,null);
 for(const [i,state] of ['site_arrived','in_transit','receiver_arrived','unloaded'].entries())await act('driver','report',{bookingId:id,expectedVersion:i+1,state,reportedAt:new Date().toISOString()});
 await act('receiver','receipt_confirm',{bookingId:id,expectedVersion:1,quantity:9.5,unit:'m3',reason:'検証入力10から9.5への数量差異',originalChecked:true});
 for(const who of ['construction','receiver','driver']){await login(who);const b=(await call(who,'/bookings')).bookings.find(b=>b.id===id);assert.equal(b.quantity,10);assert.equal(b.actual.quantity,9.5);assert.equal(b.receiptRecord.status,'confirmed');assert.equal(b.gateRecords.length,0);}
});
