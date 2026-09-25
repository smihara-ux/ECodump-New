import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

const config=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url)));
const credentials=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));
const base='http://127.0.0.1:6102/api/direct';
async function login(name){const account=credentials.accounts.find(a=>a.name===name);const response=await fetch(base+'/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:account.email,password:credentials.password})});assert.equal(response.status,200);return (await response.json()).token;}
async function get(token,path){const response=await fetch(base+path,{headers:{authorization:`Bearer ${token}`}});return{status:response.status,data:await response.json()};}
async function update(token,body){const response=await fetch(base+'/actions/receiving_condition_update',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify(body)});return{status:response.status,data:await response.json()};}

test('receiving conditions keep unit separate, require reason/version, scope history and never claim final capacity',async()=>{
 const receiver=await login('narita-receiver-tochigi'),other=await login('narita-receiver-ibaraki'),construction=await login('narita-construction');
 let list=await get(receiver,'/receiving-conditions?date=2098-11-01');assert.equal(list.status,200);const original=list.data.conditions.find(x=>x.locationId===config.naritaIds.locationTochigi);assert.ok(original);assert.equal(original.calculationStatus,'provisional');assert.match(original.calculationNote,/確定空き容量として使用しない/);assert.equal(list.data.conditions.some(x=>x.locationId===config.naritaIds.locationIbaraki),false);
 const payload={locationId:original.locationId,expectedVersion:original.version,timezone:original.timezone,businessDays:original.businessDays,opensAt:'08:15',closesAt:String(original.closesAt).slice(0,5),soil:original.soil,unit:original.unit,dailyLimit:Number(original.dailyLimit),reason:'営業時間変更の隔離検証'};
 assert.equal((await update(construction,payload)).status,403);assert.equal((await update(other,payload)).status,403);assert.equal((await update(receiver,{...payload,reason:''})).status,422);
 const changed=await update(receiver,payload);assert.equal(changed.status,200,JSON.stringify(changed));assert.equal((await update(receiver,payload)).status,409);
 const restore=await update(receiver,{...payload,expectedVersion:changed.data.version,opensAt:String(original.opensAt).slice(0,5),reason:'隔離検証後に元の営業時間へ戻す'});assert.equal(restore.status,200,JSON.stringify(restore));
 const history=await get(receiver,`/receiving-conditions/${original.locationId}/history`);assert.equal(history.status,200);assert.ok(history.data.history.some(x=>x.reason==='営業時間変更の隔離検証'));assert.ok(history.data.history.some(x=>x.reason==='隔離検証後に元の営業時間へ戻す'));
 assert.equal((await get(other,`/receiving-conditions/${original.locationId}/history`)).data.history.length,0);
});
