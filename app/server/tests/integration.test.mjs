import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const config=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url)));
const credentials=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));
const base='http://127.0.0.1:6102/api/direct';const tokens={};const ids=config.ids;
const admin=new pg.Client(config.admin);let principal; let runDay, capacityDay, otherDay;
async function request(user,path,{method='GET',body,key,headers={}}={}){const response=await fetch(base+path,{method,headers:{...(tokens[user]?{Authorization:`Bearer ${tokens[user]}`} : {}),'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{}),...headers},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
const act=(user,action,body,key=randomUUID(),headers)=>request(user,`/actions/${action}`,{method:'POST',body,key,headers});
const payload=(extra={})=>({id:randomUUID(),siteId:ids.site,locationId:ids.location,quantity:7,unit:'m3',soil:'第2種建設発生土',plannedAt:`${otherDay}T08:00:00+09:00`,agreementNote:'検証専用：直接取引の受入条件を確認',...extra});
async function rows(user){const r=await request(user,'/bookings');assert.equal(r.status,200);return r.data.bookings;}
before(async()=>{await admin.connect(); await admin.query('CREATE TABLE IF NOT EXISTS validation.test_runs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at timestamptz DEFAULT now())'); const run=Number((await admin.query('INSERT INTO validation.test_runs DEFAULT VALUES RETURNING id')).rows[0].id); const day=offset=>new Date(Date.UTC(2035,0,1+run*3+offset)).toISOString().slice(0,10); runDay=day(0);capacityDay=day(1);otherDay=day(2); for(const a of credentials.accounts){const r=await request(null,'/session',{method:'POST',body:{email:a.email,password:credentials.password}});assert.equal(r.status,200);tokens[a.name]=r.data.token;}});
after(async()=>{await admin.end();});
test('unauthenticated and invalid-password access rejected',async()=>{assert.equal((await request(null,'/bookings')).status,401);assert.equal((await request(null,'/session',{method:'POST',body:{email:credentials.accounts[0].email,password:'invalid'}})).status,401);});
test('real shared 7-step flow persists and is visible across roles',async()=>{
 const p=payload({plannedAt:`${runDay}T08:00:00+09:00`}); principal=p.id;
 assert.equal((await act('construction','create',p)).status,200);
 assert.equal((await rows('receiver')).find(b=>b.id===p.id).status,'requested');assert.ok(!(await rows('driver')).some(b=>b.id===p.id));
 assert.equal((await act('receiver','confirm',{bookingId:p.id,expectedVersion:1,agree:true})).status,200);
 const assign=await act('construction','assign',{bookingId:p.id,expectedVersion:2,vehicleId:ids.vehicle,driverId:ids.driver});assert.equal(assign.status,200,JSON.stringify(assign));
 const trip=(await rows('driver')).find(b=>b.id===p.id);assert.ok(trip.trip.id);assert.equal(trip.agreementNote,null);assert.equal(trip.trip.status,'assigned');
 for(const [i,state] of ['site_arrived','in_transit','receiver_arrived','unloaded'].entries())assert.equal((await act('driver','report',{bookingId:p.id,expectedVersion:i+1,state,reportedAt:new Date().toISOString()})).status,200);
 assert.equal((await rows('receiver')).find(b=>b.id===p.id).actual,null);
 assert.equal((await act('receiver','actual',{bookingId:p.id,expectedVersion:5,quantity:6.5,unit:'m3',differenceReason:'検証：計量差異'})).status,200);
 for(const role of ['construction','receiver','driver']){const b=(await rows(role)).find(b=>b.id===p.id);assert.equal(Number(b.actual.quantity),6.5);assert.equal(b.trip.status,'unloaded');assert.equal(b.events.length,4);}
 const persisted=(await admin.query('SELECT count(*) FROM direct.actuals a JOIN direct.trips t ON t.id=a.trip_id WHERE t.booking_id=$1',[p.id])).rows[0];assert.equal(Number(persisted.count),1);
});
test('API denies other site, location, driver, company and unauthorized transitions',async()=>{
 for(const role of ['construction-other','receiver-other','driver-other','outsider']){assert.ok(!(await rows(role)).some(b=>b.id===principal));assert.equal((await act(role,'confirm',{bookingId:principal,expectedVersion:3,agree:true})).status,403);}
 assert.equal((await act('construction','create',payload({siteId:ids.siteOther}))).status,403);
 const p=payload();await act('construction','create',p);
 assert.equal((await act('construction','confirm',{bookingId:p.id,expectedVersion:1,agree:true})).status,403);
 assert.equal((await act('construction','assign',{bookingId:p.id,expectedVersion:1,vehicleId:ids.vehicle,driverId:ids.driver})).status,422);
 assert.equal((await act('receiver','confirm',{bookingId:p.id,expectedVersion:1})).status,422);
});
test('duplicate request is one row, key/body conflict and stale updates are rejected',async()=>{
 const p=payload();const key=randomUUID();const responses=await Promise.all([act('construction','create',p,key),act('construction','create',p,key)]);assert.ok(responses.every(x=>x.status===200));assert.equal((await rows('construction')).filter(b=>b.id===p.id).length,1);
 assert.equal((await act('construction','create',{...p,quantity:8},key)).status,409);
 const updates=await Promise.all([act('receiver','confirm',{bookingId:p.id,expectedVersion:1,agree:true}),act('receiver','confirm',{bookingId:p.id,expectedVersion:1,agree:true})]);assert.deepEqual(updates.map(r=>r.status).sort(),[200,409]);
 assert.equal((await act('construction','assign',{bookingId:p.id,expectedVersion:1,vehicleId:ids.vehicle,driverId:ids.driver})).status,409);
});
test('lost response is resolved by operation lookup without a duplicate mutation',async()=>{
 const p=payload();const key=randomUUID();await assert.rejects(act('construction','create',p,key,{'X-Validation-Drop-Response':'1'}));
 const result=await request('construction',`/operations/${key}`);assert.equal(result.data.state,'applied');assert.equal(result.data.result.bookingId,p.id);assert.equal((await rows('construction')).filter(b=>b.id===p.id).length,1);
 assert.equal((await request('receiver',`/operations/${key}`)).data.state,'not_applied');
});
test('attachment bytes persist and inaccessible parties cannot read them',async()=>{
 const p=payload();await act('construction','create',p);const data=Buffer.from('%PDF-1.4\n%anonymous validation fixture\n%%EOF');
 const upload=await act('construction','attachment',{bookingId:p.id,filename:'anonymous.pdf',mime:'application/pdf',base64:data.toString('base64')});assert.equal(upload.status,200);const attachmentId=upload.data.attachmentId;
 const r=await fetch(base+`/attachments/${attachmentId}`,{headers:{Authorization:`Bearer ${tokens.receiver}`}});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),data);
 assert.equal((await request('outsider',`/attachments/${attachmentId}`)).status,404);assert.equal((await request('driver',`/attachments/${attachmentId}`)).status,404);
 assert.equal((await act('construction','attachment',{bookingId:p.id,filename:'bad.png',mime:'image/png',base64:data.toString('base64')})).status,422);
});
test('database RLS and mutation permissions reject access without relying on API filters',async()=>{
 const db=new pg.Client(config.api);await db.connect();try{
 await db.query('BEGIN');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[credentials.accounts[3].id]);
 assert.equal((await db.query('SELECT id FROM direct.bookings WHERE id=$1',[principal])).rowCount,0);
 assert.equal((await db.query('SELECT id FROM public.sites WHERE id=$1',[ids.site])).rowCount,0);
 await db.query('ROLLBACK');await db.query('BEGIN');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[credentials.accounts[0].id]);
 await assert.rejects(db.query("UPDATE direct.bookings SET status='confirmed' WHERE id=$1",[principal]),e=>e.code==='42501');await db.query('ROLLBACK');
 await db.query('BEGIN');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[credentials.accounts[4].id]);
 await assert.rejects(db.query("SELECT direct.mutate('confirm',$1,$2)",[randomUUID(),JSON.stringify({bookingId:principal,expectedVersion:3,agree:true})]),e=>e.code==='42501');await db.query('ROLLBACK');
 }finally{await db.end();}
});
test('same vehicle round trips remain independent; invalid step and premature actual are denied',async()=>{
 const p=payload({plannedAt:`${runDay}T12:00:00+09:00`});await act('construction','create',p);await act('receiver','confirm',{bookingId:p.id,expectedVersion:1,agree:true});const r=await act('construction','assign',{bookingId:p.id,expectedVersion:2,vehicleId:ids.vehicle,driverId:ids.driver});assert.equal(r.status,200);
 const b=(await rows('driver')).find(b=>b.id===p.id);assert.equal(b.trip.rotation,2);assert.notEqual(b.trip.id,(await rows('driver')).find(x=>x.id===principal).trip.id);
 assert.equal((await act('driver','report',{bookingId:p.id,expectedVersion:1,state:'unloaded',reportedAt:new Date().toISOString()})).status,422);
 assert.equal((await act('receiver','actual',{bookingId:p.id,expectedVersion:1,quantity:7,unit:'m3'})).status,422);
});
test('capacity and asset overlap are enforced under concurrent writes',async()=>{
 const ps=[payload({plannedAt:`${capacityDay}T08:00:00+09:00`,quantity:700}),payload({plannedAt:`${capacityDay}T10:00:00+09:00`,quantity:700})];for(const p of ps)await act('construction','create',p);
 const rs=await Promise.all(ps.map(p=>act('receiver','confirm',{bookingId:p.id,expectedVersion:1,agree:true})));assert.deepEqual(rs.map(x=>x.status).sort(),[200,409]);
 const p=payload({plannedAt:`${runDay}T08:15:00+09:00`});await act('construction','create',p);await act('receiver','confirm',{bookingId:p.id,expectedVersion:1,agree:true});assert.equal((await act('construction','assign',{bookingId:p.id,expectedVersion:2,vehicleId:ids.vehicle,driverId:ids.driver})).status,409);
});

test('membership revocation is enforced for existing authenticated sessions',async()=>{
 const user=credentials.accounts.find(a=>a.name==='driver-other').id;
 try{await admin.query('UPDATE public.memberships SET active=false WHERE user_id=$1',[user]);assert.equal((await request('driver-other','/bookings')).status,403);}finally{await admin.query('UPDATE public.memberships SET active=true WHERE user_id=$1',[user]);}
});
test('a role query or actor field cannot impersonate another account',async()=>{
 const p=payload();await act('construction','create',p);
 const result=await act('construction','confirm',{bookingId:p.id,expectedVersion:1,agree:true,actorId:credentials.accounts[1].id,role:'receiving'});assert.equal(result.status,403);
});

test('invalid quantities, wrong units, and out-of-order timestamps cannot reach actuals',async()=>{
 const p=payload({plannedAt:`${runDay}T16:00:00+09:00`});await act('construction','create',p);await act('receiver','confirm',{bookingId:p.id,expectedVersion:1,agree:true});assert.equal((await act('construction','assign',{bookingId:p.id,expectedVersion:2,vehicleId:ids.vehicleOther,driverId:ids.driverOther})).status,200);
 const now=new Date().toISOString();assert.equal((await act('driver-other','report',{bookingId:p.id,expectedVersion:1,state:'site_arrived',reportedAt:now})).status,200);
 assert.equal((await act('driver-other','report',{bookingId:p.id,expectedVersion:2,state:'in_transit',reportedAt:new Date(Date.now()-60000).toISOString()})).status,422);
 for(const [i,state] of ['in_transit','receiver_arrived','unloaded'].entries())assert.equal((await act('driver-other','report',{bookingId:p.id,expectedVersion:i+2,state,reportedAt:new Date().toISOString()})).status,200);
 for(const change of [{quantity:'NaN',unit:'m3',differenceReason:'invalid'},{quantity:7,unit:'t'},{quantity:6,unit:'m3'}])assert.equal((await act('receiver','actual',{bookingId:p.id,expectedVersion:5,...change})).status,422);
 const key=randomUUID(),body={bookingId:p.id,expectedVersion:5,quantity:7,unit:'m3'};assert.equal((await act('receiver','actual',body,key)).status,200);assert.equal((await act('receiver','actual',body,key)).status,200);assert.equal((await act('receiver','actual',body)).status,409);
});
test('raw DB projections do not expose agreement terms or audit history to a driver',async()=>{
 const db=new pg.Client(config.api);await db.connect();try{await db.query('BEGIN');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[credentials.accounts[2].id]);assert.equal((await db.query('SELECT * FROM direct.bookings WHERE id=$1',[principal])).rowCount,0);assert.equal((await db.query('SELECT * FROM direct.audit WHERE booking_id=$1',[principal])).rowCount,0);assert.ok((await db.query('SELECT direct.list_bookings() AS data')).rows[0].data.some(b=>b.id===principal&&b.agreementNote===null));await db.query('ROLLBACK');}finally{await db.end();}
});
