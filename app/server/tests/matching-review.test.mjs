import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {fileURLToPath} from 'node:url';
const cfg=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url)));
const credentials=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));
const base='http://127.0.0.1:6116';
const agreementId='64000000-0000-4000-8000-000000000016';
test('review fixtures persist shared snapshots, isolate nonparties and preserve reruns without reservations',async()=>{
 const result={};
 for(const name of ['narita-construction','narita-receiver-tochigi','narita-receiver-ibaraki']){
  const login=await fetch(base+'/api/direct/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:credentials.accounts.find(a=>a.name===name).email,password:credentials.password})});
  assert.equal(login.status,200);const {token}=await login.json();const headers={Authorization:`Bearer ${token}`};
  try{
   const side=name==='narita-construction'?'construction':'receiving';
   const response=await fetch(base+'/api/match/list?side='+side,{headers});assert.equal(response.status,200);
   result[name]=(await response.json()).data;
  }finally{await fetch(base+'/api/direct/session',{method:'DELETE',headers});}
 }
 const a=result['narita-construction'].agreements.find(a=>a.id===agreementId),b=result['narita-receiver-tochigi'].agreements.find(a=>a.id===agreementId);
 assert.ok(a);assert.deepEqual(a.snapshot,b.snapshot);assert.equal(a.bookingId,null);
 assert.equal(a.snapshot.terms.quantity,10);assert.equal(a.snapshot.terms.unit,'m3');
 assert.equal(a.snapshot.source.internal,undefined);assert.equal(a.snapshot.target.internal,undefined);
 assert.ok(!result['narita-receiver-ibaraki'].agreements.some(a=>a.id===agreementId));
 const co=result['narita-receiver-tochigi'].consultations.find(c=>c.id==='64000000-0000-4000-8000-000000000003');
 assert.equal(co.offers.length,2);assert.notEqual(co.offers[0].terms.conditions,co.offers[1].terms.conditions);
 const db=new pg.Client(cfg.admin);await db.connect();
 try{
  const before=(await db.query('SELECT snapshot,booking_id FROM direct.match_agreements WHERE id=$1',[agreementId])).rows;
  execFileSync(process.execPath,[fileURLToPath(new URL('./prepare-matching-review.mjs',import.meta.url))]);
  const after=(await db.query('SELECT snapshot,booking_id FROM direct.match_agreements WHERE id=$1',[agreementId])).rows;
  assert.deepEqual(after,before);
 }finally{await db.end();}
});
