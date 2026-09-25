import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

const config=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url)));
const credentials=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));
const base=process.env.ECODUMP_V2_BASE||'http://127.0.0.1:6104/api/direct';
const tokens={};
async function request(who,path,body,key=randomUUID(),method=body===undefined?'GET':'POST'){
 const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${tokens[who]||''}`,'Content-Type':'application/json','Idempotency-Key':key},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();return {status:response.status,data};
}
async function login(who){const a=credentials.accounts.find(x=>x.name===who);const r=await request(null,'/session',{email:a.email,password:credentials.password});assert.equal(r.status,200,JSON.stringify(r));tokens[who]=r.data.token;}
async function action(who,name,body,key=randomUUID()){return request(who,`/actions/${name}`,body,key);}
async function rows(who){const r=await request(who,'/bookings');assert.equal(r.status,200,JSON.stringify(r));return r.data.bookings;}

test('shared operations v2: external carrier, multi-trip, reassignment, issue and cancellation history',async()=>{
 for(const who of ['narita-construction','narita-receiver-tochigi','narita-driver-aoki','narita-driver-sato','narita-driver-suzuki'])await login(who);
 const bookingId=randomUUID();const compact=bookingId.replaceAll('-',''),year=2080+(Number.parseInt(compact.slice(0,2),16)%18),month=String(1+(Number.parseInt(compact.slice(2,4),16)%12)).padStart(2,'0'),day=String(1+(Number.parseInt(compact.slice(4,6),16)%27)).padStart(2,'0'),date=`${year}-${month}-${day}`,plannedAt=`${date}T08:00:00+09:00`;
 let r=await action('narita-construction','create',{id:bookingId,siteId:config.naritaIds.siteA,locationId:config.naritaIds.locationTochigi,plannedAt,quantity:10,unit:'m3',soil:'第2種建設発生土',agreementNote:'複数便・外部運送会社の隔離検証'});assert.equal(r.status,200,JSON.stringify(r));
 r=await action('narita-receiver-tochigi','confirm',{bookingId,expectedVersion:1,agree:true});assert.equal(r.status,200,JSON.stringify(r));
 r=await action('narita-construction','trip_add',{bookingId,expectedVersion:2,vehicleId:config.naritaIds.vehicle01,driverId:config.naritaIds.driverAoki,plannedAt,quantity:4,reason:'1便目を委託配車'});assert.equal(r.status,200,JSON.stringify(r));const trip1=r.data.tripId;
 r=await action('narita-construction','trip_add',{bookingId,expectedVersion:3,vehicleId:config.naritaIds.vehicle02,driverId:config.naritaIds.driverSato,plannedAt:`${date}T10:00:00+09:00`,quantity:6,reason:'2便目を委託配車'});assert.equal(r.status,200,JSON.stringify(r));const trip2=r.data.tripId;
 assert.notEqual(trip1,trip2);assert.equal((await rows('narita-driver-aoki')).find(x=>x.trip?.id===trip1)?.trip.plannedQuantity,4);assert.equal((await rows('narita-driver-sato')).find(x=>x.trip?.id===trip2)?.trip.plannedQuantity,6);
 r=await action('narita-construction','trip_add',{bookingId,expectedVersion:4,vehicleId:config.naritaIds.vehicle03,driverId:config.naritaIds.driverSuzuki,plannedAt:`${date}T12:00:00+09:00`,quantity:1,reason:'予約数量を超える便'});assert.equal(r.status,422);
 r=await action('narita-construction','trip_reassign',{bookingId,tripId:trip1,expectedVersion:1,vehicleId:config.naritaIds.vehicle03,driverId:config.naritaIds.driverSuzuki,reason:'代車・代走の検証'});assert.equal(r.status,200,JSON.stringify(r));assert.equal((await rows('narita-driver-aoki')).some(x=>x.trip?.id===trip1),false);assert.ok((await rows('narita-driver-suzuki')).some(x=>x.trip?.id===trip1));
 const issueKey=randomUUID(),issue={bookingId,tripId:trip1,expectedVersion:2,kind:'delay',reason:'道路混雑で15分遅延'};
 r=await action('narita-driver-suzuki','trip_issue',issue,issueKey);assert.equal(r.status,200,JSON.stringify(r));const duplicate=await action('narita-driver-suzuki','trip_issue',issue,issueKey);assert.deepEqual(duplicate.data,r.data);const conflict=await action('narita-driver-suzuki','trip_issue',{...issue,reason:'異なる理由'},issueKey);assert.equal(conflict.status,409);
 for(const [version,state] of [[3,'site_arrived'],[4,'in_transit'],[5,'receiver_arrived'],[6,'unloaded']]){r=await action('narita-driver-suzuki','report',{bookingId,tripId:trip1,expectedVersion:version,state,reportedAt:new Date().toISOString()});assert.equal(r.status,200,JSON.stringify(r));}
 r=await action('narita-receiver-tochigi','actual',{bookingId,tripId:trip1,expectedVersion:7,quantity:3.5,unit:'m3',differenceReason:'予定4m³に対して受入確定3.5m³'});assert.equal(r.status,200,JSON.stringify(r));
 r=await action('narita-construction','booking_cancel',{bookingId,expectedVersion:4,reason:'残りの未出発便を取消'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.status,'partially_completed');
 const final=(await rows('narita-construction')).filter(x=>x.id===bookingId);assert.ok(final.some(x=>Number(x.actual?.quantity)===3.5));assert.ok(final.some(x=>x.trip?.id===trip2&&x.trip.status==='cancelled'));
 const history=await request('narita-construction',`/bookings/${bookingId}/history`);assert.equal(history.status,200);assert.ok(history.data.history.some(x=>x.action==='booking_cancel'));assert.ok(history.data.history.some(x=>x.action==='trip_reassign'));
});
