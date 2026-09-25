import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';

const config=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url)));
const credentials=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));
const base='http://127.0.0.1:6103/api/direct';
const tokens={};
async function request(who,path,body,key=randomUUID(),extra={},method=body===undefined?'GET':'POST'){
 const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${tokens[who]||''}`,'Content-Type':'application/json','Idempotency-Key':key,...extra},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
}
async function login(who){const account=credentials.accounts.find(a=>a.name===who);assert.ok(account,`missing ${who}`);const result=await request(null,'/session',{email:account.email,password:credentials.password});assert.equal(result.status,200,JSON.stringify(result));tokens[who]=result.data.token;}
async function action(who,name,body,key=randomUUID(),extra={}){const result=await request(who,`/actions/${name}`,body,key,extra);assert.equal(result.status,200,JSON.stringify(result));return result.data;}
async function booking(who,id){const result=await request(who,'/bookings');assert.equal(result.status,200,JSON.stringify(result));return result.data.bookings.find(item=>item.id===id);}

test('WINNERS Narita model: direct reservation through confirmed actual across separate scoped sessions',async()=>{
 assert.equal(config.api.database,'ecodump_direct_validation');
 const db=new pg.Client(config.admin);await db.connect();
 try{
  const run=Number((await db.query('INSERT INTO validation.test_runs DEFAULT VALUES RETURNING id')).rows[0].id);
  const day=new Date(Date.UTC(2055,0,run)).toISOString().slice(0,10);
  for(const who of ['narita-construction','narita-receiver-tochigi','narita-receiver-ibaraki','narita-driver-aoki','narita-driver-sato','narita-driver-suzuki','narita-outside'])await login(who);
  const plans=[
   {siteId:config.naritaIds.siteA,locationId:config.naritaIds.locationTochigi,time:'08:00',vehicleId:config.naritaIds.vehicle01,driverId:config.naritaIds.driverAoki,quantity:10,actual:9.5},
   {siteId:config.naritaIds.siteA,locationId:config.naritaIds.locationIbaraki,time:'11:00',vehicleId:config.naritaIds.vehicle01,driverId:config.naritaIds.driverAoki,quantity:10,actual:10},
   {siteId:config.naritaIds.siteB,locationId:config.naritaIds.locationTochigi,time:'14:00',vehicleId:config.naritaIds.vehicle01,driverId:config.naritaIds.driverAoki,quantity:10,actual:10}
  ];
  const evidence=[];
  for(const [index,plan] of plans.entries()){
   const id=randomUUID(),receiver=plan.locationId===config.naritaIds.locationTochigi?'narita-receiver-tochigi':'narita-receiver-ibaraki';
   await action('narita-construction','create',{id,siteId:plan.siteId,locationId:plan.locationId,plannedAt:`${day}T${plan.time}:00+09:00`,quantity:plan.quantity,unit:'m3',soil:'第2種建設発生土',agreementNote:'成田空港モデル現場の架空検証。実在契約・条件ではありません。'});
   assert.equal((await booking(receiver,id)).status,'requested');
   assert.equal(await booking(receiver==='narita-receiver-tochigi'?'narita-receiver-ibaraki':'narita-receiver-tochigi',id),undefined);
   await action(receiver,'confirm',{bookingId:id,expectedVersion:1,agree:true});
   await action('narita-construction','assign',{bookingId:id,expectedVersion:2,vehicleId:plan.vehicleId,driverId:plan.driverId});
   const assigned=await booking('narita-driver-aoki',id);assert.ok(assigned.trip?.id);assert.equal(assigned.trip.rotation,index+1);
   assert.equal(await booking('narita-driver-sato',id),undefined);assert.equal(await booking('narita-outside',id),undefined);
   for(const [version,state] of ['site_arrived','in_transit','receiver_arrived','unloaded'].entries())await action('narita-driver-aoki','report',{bookingId:id,expectedVersion:version+1,state,reportedAt:new Date().toISOString()});
   const before=await booking(receiver,id);assert.equal(before.actual,null);
   await action(receiver,'actual',{bookingId:id,expectedVersion:5,quantity:plan.actual,unit:'m3',differenceReason:plan.actual===plan.quantity?'':'受入側計量で9.5m³を確認'});
   const shared=await Promise.all(['narita-construction',receiver,'narita-driver-aoki'].map(role=>booking(role,id)));
   assert.ok(shared.every(item=>item.trip.id===assigned.trip.id));assert.ok(shared.every(item=>Number(item.actual.quantity)===plan.actual));
   evidence.push({bookingId:id,tripId:assigned.trip.id,rotation:assigned.trip.rotation,siteId:plan.siteId,locationId:plan.locationId,planned:plan.quantity,confirmedActual:plan.actual,unit:'m3'});
  }
  assert.equal(new Set(evidence.map(item=>item.tripId)).size,3);
  const first=evidence[0];const duplicateKey=randomUUID();const stale={bookingId:first.bookingId,expectedVersion:2,vehicleId:config.naritaIds.vehicle02,driverId:config.naritaIds.driverSato};
  const staleResult=await request('narita-construction','/actions/assign',stale,duplicateKey);assert.equal(staleResult.status,409);
  const unknownKey=randomUUID();const unknownId=randomUUID();const unknownBody={id:unknownId,siteId:config.naritaIds.siteB,locationId:config.naritaIds.locationIbaraki,plannedAt:`${day}T17:00:00+09:00`,quantity:10,unit:'m3',soil:'第2種建設発生土',agreementNote:'応答喪失の結果照会検証'};
  await assert.rejects(request('narita-construction','/actions/create',unknownBody,unknownKey,{'x-validation-drop-response':'1'}));
  assert.equal((await request('narita-construction',`/operations/${unknownKey}`)).data.state,'applied');
  const oldToken=tokens['narita-driver-aoki'];assert.equal((await request('narita-driver-aoki','/session',undefined,randomUUID(),{},'DELETE')).status,200);
  // The API's existing integration suite covers explicit logout. A fresh login here
  // proves the seeded account can refetch the same persisted trips.
  await login('narita-driver-aoki');assert.notEqual(tokens['narita-driver-aoki'],oldToken);assert.equal((await booking('narita-driver-aoki',first.bookingId)).trip.id,first.tripId);
  const out=new URL('../../../docs/narita-validation/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('api-evidence.json',out),JSON.stringify({checkedAt:new Date().toISOString(),environment:'isolated-postgresql',production:false,day,scenario:'WINNERS Narita fictional validation',trips:evidence,unknownOperation:unknownKey,scopeDenied:true,notes:['Three rotations are currently represented by three bookings because the current schema allows one trip per booking.','GPS and physical-device confirmation are outside this API test.']},null,2));
 }finally{await db.end();}
});
