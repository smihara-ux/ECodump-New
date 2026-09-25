import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID as uuid} from 'node:crypto';
import pg from 'pg';
const cfg=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url)));
const creds=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));
const base='http://127.0.0.1:6103'; const tokens={};
async function req(role,path,body,key=uuid(),method=body===undefined?'GET':'POST'){
 const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${tokens[role]||''}`,'Content-Type':'application/json','Idempotency-Key':key},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json()};
}
async function login(role){const a=creds.accounts.find(a=>a.name===role);const r=await req(role,'/api/direct/session',{email:a.email,password:creds.password});assert.equal(r.status,200);tokens[role]=r.data.token;}
async function action(role,kind,body,match=false){const r=await req(role,`/api/${match?'match':'direct'}/actions/${kind}`,body);assert.equal(r.status,200,JSON.stringify(r));return r.data;}
async function booking(role,id){const r=await req(role,'/api/direct/bookings');assert.equal(r.status,200);return r.data.bookings.find(b=>b.id===id);}
test('shared PostgreSQL: matching through actuals, second rotation, fresh login and unsupported operations',async()=>{
 assert.equal(cfg.api.database,'ecodump_direct_validation');const db=new pg.Client(cfg.admin);await db.connect();
 try{
 const run=Number((await db.query('INSERT INTO validation.test_runs DEFAULT VALUES RETURNING id')).rows[0].id);
 const day=new Date(Date.UTC(2040,0,run)).toISOString().slice(0,10);
 for(const role of ['construction','receiver','driver'])await login(role);
 const data={title:`試験運用 ${run}`,region:'匿名検証地域',soil:'第2種建設発生土',quantity:7,unit:'m3',start:day,end:day,public:'公開概要',shared:'入口で受付',internal:'社内のみ',documents:[]};
 const source=uuid(),target=uuid(),consult=uuid();
 for(const [role,id,side,siteId] of [['construction',source,'construction',cfg.ids.site],['receiver',target,'receiving',cfg.ids.location]]){
 await action(role,'create',{id,side,siteId,data},true);await action(role,'publish',{id,version:1},true);
 }
 await action('construction','consult',{id:consult,sourceId:source,targetId:target,message:'試験運用の条件確認'},true);
 await action('construction','offer',{id:consult,version:1,terms:{soil:data.soil,quantity:7,unit:'m3',start:day,end:day,conditions:'実績を別途確認',message:'検証'}},true);
 const list=await req('receiver','/api/match/list?side=receiving');const offer=list.data.data.consultations.find(c=>c.id===consult).offers.at(-1);
 await action('construction','accept',{id:consult,version:2,offerId:offer.id},true);await action('receiver','accept',{id:consult,version:3,offerId:offer.id},true);
 const first=(await action('construction','reserve',{id:consult,plannedAt:`${day}T08:00:00+09:00`},true)).bookingId;
 const second=uuid();await action('construction','create',{id:second,siteId:cfg.ids.site,locationId:cfg.ids.location,plannedAt:`${day}T12:00:00+09:00`,quantity:7,unit:'m3',soil:data.soil,agreementNote:'同じ車両の2便目'});
 const trips=[];
 for(const [i,id] of [first,second].entries()){
 assert.equal((await booking('receiver',id)).status,'requested');assert.equal((await booking('receiver',id)).trip,null);
 await action('receiver','confirm',{bookingId:id,expectedVersion:1,agree:true});
 await action('construction','assign',{bookingId:id,expectedVersion:2,vehicleId:cfg.ids.vehicle,driverId:cfg.ids.driver});
 const assigned=await booking('driver',id);assert.equal(assigned.trip.rotation,i+1);trips.push(assigned.trip.id);
 for(const [j,state] of ['site_arrived','in_transit','receiver_arrived','unloaded'].entries())await action('driver','report',{bookingId:id,expectedVersion:j+1,state,reportedAt:new Date().toISOString()});
 assert.equal((await booking('receiver',id)).actual,null);
 await action('receiver','actual',{bookingId:id,expectedVersion:5,quantity:i?7:6.8,unit:'m3',differenceReason:i?'':'計量差異の確認'});
 }
 assert.notEqual(trips[0],trips[1]);
 const unsupported=[];
 for(const [role,kind] of [['construction','change'],['construction','cancel'],['construction','reassign'],['driver','delay'],['driver','refuse'],['receiver','correct']]){
 const before=await booking(role,first);const r=await req(role,`/api/direct/actions/${kind}`,{bookingId:first,expectedVersion:before.trip.version,reason:'試験'});assert.equal(r.status,404);assert.deepEqual(await booking(role,first),before);unsupported.push(kind);
 }
 for(const role of ['construction','receiver','driver']){
 const before=await booking(role,first);const old=tokens[role];assert.equal((await req(role,'/api/direct/session',undefined,uuid(),'DELETE')).status,200);
 assert.equal((await req(role,'/api/direct/bookings')).status,401);await login(role);assert.notEqual(tokens[role],old);assert.deepEqual(await booking(role,first),before);
 assert.equal(Number((await booking(role,first)).actual.quantity),6.8);assert.equal(Number((await booking(role,second)).actual.quantity),7);
 }
 const evidence={checkedAt:new Date().toISOString(),environment:'isolated-postgresql',day,matchedBooking:first,directBooking:second,trips,actuals:[6.8,7],rotations:[1,2],relogin:['construction','receiver','driver'],unsupported404:unsupported};
 const out=new URL('../../../docs/trial-cross-role-2026-09-25/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('api-evidence.json',out),JSON.stringify(evidence,null,2));
 }finally{await db.end();}
});
