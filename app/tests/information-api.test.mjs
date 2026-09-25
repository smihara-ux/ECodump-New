import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const credentials=JSON.parse(await readFile(new URL('../server/.local/credentials.json',import.meta.url)));
const base='http://127.0.0.1:6103',tokens={};
async function request(name,path,body,key=randomUUID()){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(tokens[name]?{Authorization:`Bearer ${tokens[name]}`} : {}),'Content-Type':'application/json','Idempotency-Key':key},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,data:await response.json()};}
async function login(name){const account=credentials.accounts.find(a=>a.name===name),r=await request(name,'/api/direct/session',{email:account.email,password:credentials.password});assert.equal(r.status,200);tokens[name]=r.data.token;}
test('business sessions cannot access operator-only information', async t => {
 for (const name of ['narita-construction', 'narita-receiver-tochigi', 'driver', 'narita-outside']) {
  await login(name);
  await t.test(name, async () => {
   for (const path of ['/api/direct/information', '/api/direct/information/documents/example', '/api/direct/information/operations/example']) {
    assert.equal((await request(name, path)).status, 403);
   }
   for (const action of ['create', 'update', 'publish', 'withdraw', 'ack']) {
    assert.equal((await request(name, `/api/direct/information/actions/${action}`, {id:randomUUID(),version:1})).status, 403);
   }
  });
 }
});
