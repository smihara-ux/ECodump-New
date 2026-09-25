import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const credentials=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));
const base=process.env.RECEIVING_TEST_API||'http://127.0.0.1:6103/api/direct';
async function session(email){const r=await fetch(base+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:credentials.password})});assert.equal(r.status,200);return (await r.json()).token;}
async function get(token,path){const r=await fetch(base+path,{headers:{Authorization:`Bearer ${token}`}});return {status:r.status,data:await r.json()};}
test('receiving scoped shared v2 read and attachment access (development, no workflow writes)',async()=>{
 const to=await session('narita-receiver-tochigi@sample.invalid'),ib=await session('narita-receiver-ibaraki@sample.invalid');
 const tc=await get(to,'/receiving-conditions?date=2026-09-25'),ic=await get(ib,'/receiving-conditions?date=2026-09-25');
 assert.equal(tc.status,200);assert.equal(ic.status,200);assert.equal(tc.data.conditions.length,1);assert.equal(ic.data.conditions.length,1);
 assert.notEqual(tc.data.conditions[0].locationId,ic.data.conditions[0].locationId);assert.equal(tc.data.conditions[0].calculationStatus,'provisional');assert.equal(tc.data.conditions[0].availableQuantity,undefined);
 const a=await get(to,'/bookings'),b=await get(ib,'/bookings');assert.equal(a.status,200);assert.equal(b.status,200);
 assert.ok(a.data.bookings.every(v=>v.location.id===tc.data.conditions[0].locationId));assert.ok(b.data.bookings.every(v=>v.location.id===ic.data.conditions[0].locationId));
 const withPhoto=a.data.bookings.find(v=>v.attachments.length);assert.ok(withPhoto,'shared validation fixture must have an original attachment');
 const own=await fetch(base+'/attachments/'+withPhoto.attachments[0].id,{headers:{Authorization:`Bearer ${to}`}});assert.equal(own.status,200);
 const other=await get(ib,'/attachments/'+withPhoto.attachments[0].id);assert.equal(other.status,404);
 const refreshed=await get(await session('narita-receiver-tochigi@sample.invalid'),'/bookings');assert.deepEqual(refreshed.data.bookings.map(v=>v.trip?.id||v.id),a.data.bookings.map(v=>v.trip?.id||v.id));
});
test('receiving condition save/refetch/history/idempotency and foreign update rejection (development)',async()=>{
 const token=await session('narita-receiver-tochigi@sample.invalid');
 const c=(await get(token,'/receiving-conditions?date=2026-09-25')).data.conditions[0];
 const body={locationId:c.locationId,expectedVersion:c.version,timezone:c.timezone,businessDays:c.businessDays,opensAt:c.opensAt,closesAt:c.closesAt,soil:c.soil,unit:c.unit,dailyLimit:c.dailyLimit,reason:'受入画面の局所開発確認：既存条件を維持して保存・履歴を確認'};
 const post=async(payload,key=crypto.randomUUID())=>{const r=await fetch(base+'/actions/receiving_condition_update',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload)});return {status:r.status,data:await r.json()};};
 const key=crypto.randomUUID(),saved=await post(body,key);assert.equal(saved.status,200,JSON.stringify(saved));
 const duplicated=await post(body,key);assert.deepEqual(duplicated,saved);
 assert.equal((await get(token,'/operations/'+key)).data.state,'applied');
 const read=(await get(await session('narita-receiver-tochigi@sample.invalid'),'/receiving-conditions?date=2026-09-25')).data.conditions[0];assert.equal(read.version,c.version+1);assert.equal(read.dailyLimit,c.dailyLimit);
 const h=await get(token,`/receiving-conditions/${c.locationId}/history`);assert.equal(h.status,200);assert.ok(h.data.history.some(r=>r.reason===body.reason&&r.before_data.version===c.version&&r.after_data.version===read.version));
 const stale=await post(body);assert.equal(stale.status,409);
 const foreign=await post({...body,locationId:'21000000-0000-4000-8000-000000000004'});assert.equal(foreign.status,403);
});
