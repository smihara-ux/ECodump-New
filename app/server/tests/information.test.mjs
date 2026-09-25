import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {readFile} from 'node:fs/promises';import {randomUUID as uuid} from 'node:crypto';
const cfg=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url)));assert.equal(cfg.admin.database,'ecodump_direct_validation');
test('information lifecycle, audience, attachment, acknowledgement, version and idempotency guards (rollback fixture)',async()=>{
 const db=new pg.Client(cfg.admin);await db.connect();await db.query('BEGIN');
 try{
 const accounts=(await db.query("SELECT user_id,email FROM validation.accounts WHERE email LIKE 'narita-%'")).rows;
 const user=name=>accounts.find(a=>a.email===name+'@sample.invalid').user_id;
 const editor=user('narita-receiver-tochigi'),other=user('narita-receiver-ibaraki'),construction=user('narita-construction');
 const location=(await db.query('SELECT site_id FROM direct.scopes WHERE user_id=$1 LIMIT 1',[editor])).rows[0].site_id;
 const org=(await db.query('SELECT organization_id FROM public.sites WHERE id=$1',[location])).rows[0].organization_id;
 const id=uuid(),docid=uuid();
 const actor=async u=>{await db.query('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[u]);await db.query('SET LOCAL ROLE ecodump_api');};
 const mutate=async(a,p,k=uuid())=>(await db.query('SELECT direct.info_mutate($1,$2,$3) AS d',[a,k,p])).rows[0].d;
 const deny=async(fn,code)=>{await db.query('SAVEPOINT denied');await assert.rejects(fn,e=>e.code===code);await db.query('ROLLBACK TO denied');};
 const data={title:'検証専用記事',body:'架空の社内連絡',category:'お知らせ',start:new Date(Date.now()-60000).toISOString(),end:new Date(Date.now()+86400000).toISOString(),requiresAck:true,documents:[{id:docid,name:'確認.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-1.4 test').toString('base64')}]};
 await actor(editor);await deny(()=>mutate('create',{id,scope:'platform',data}),'42501');await deny(()=>db.query('SELECT * FROM direct.info_articles'),'42501');
 // Explicit grant exists only inside this rolled-back test transaction.
 await db.query('RESET ROLE');await db.query("INSERT INTO direct.info_grants VALUES($1,$2,'site',$3)",[uuid(),editor,location]);await actor(editor);
 const createKey=uuid(),p={id,scope:'site',targetId:location,data};const created=await mutate('create',p,createKey);assert.equal(created.version,1);assert.deepEqual(await mutate('create',p,createKey),created);
 await deny(()=>mutate('create',{...p,data:{...data,title:'別入力'}},createKey),'40001');
 await mutate('publish',{id,version:1,reason:'検証公開'});await deny(()=>mutate('withdraw',{id,version:1,reason:'古い画面'}),'40001');
 await mutate('ack',{id,version:2});let list=(await db.query('SELECT direct.info_list() AS d')).rows[0].d;assert.equal(list.articles.find(a=>a.id===id).acknowledged,true);assert.equal(list.articles.find(a=>a.id===id).documents[0].base64,undefined);
 assert.ok((await db.query('SELECT direct.info_document($1,$2) AS d',[id,docid])).rows[0].d.base64);
 await actor(other);assert.ok(!(await db.query('SELECT direct.info_list() AS d')).rows[0].d.articles.some(a=>a.id===id));await deny(()=>db.query('SELECT direct.info_document($1,$2)',[id,docid]),'42501');await deny(()=>mutate('ack',{id,version:2}),'42501');
 await actor(construction);await deny(()=>mutate('withdraw',{id,version:2,reason:'権限外'}),'42501');
 await actor(editor);await mutate('withdraw',{id,version:2,reason:'条件訂正'});await mutate('edit',{id,version:3,data:{...data,body:'変更後'},reason:'本文訂正'});await mutate('publish',{id,version:4,reason:'再公開'});list=(await db.query('SELECT direct.info_list() AS d')).rows[0].d;const a=list.articles.find(a=>a.id===id);assert.equal(a.acknowledged,false);assert.equal(a.history.length,5);assert.ok(a.history.some(h=>h.snapshot.body==='架空の社内連絡'));
 assert.equal((await db.query('SELECT direct.info_operation($1) AS d',[createKey])).rows[0].d.status,'completed');
 // Published company/site dates and platform are server filtered.
 await db.query('RESET ROLE');const company=uuid(),future=uuid(),platform=uuid();await db.query("INSERT INTO direct.info_articles(id,scope,target_id,status,data,actor_id) VALUES($1,'company',$2,'published',$3,$4),($5,'site',$6,'published',$7,$4),($8,'platform',NULL,'published',$3,$4)",[company,org,data,editor,future,location,{...data,start:new Date(Date.now()+60000).toISOString()},platform]);
 await actor(other);list=(await db.query('SELECT direct.info_list() AS d')).rows[0].d;assert.ok(!list.articles.some(a=>[company,future].includes(a.id)));assert.ok(list.articles.some(a=>a.id===platform));
 await db.query('RESET ROLE');await db.query('DELETE FROM direct.info_grants WHERE user_id=$1',[editor]);await actor(editor);list=(await db.query('SELECT direct.info_list() AS d')).rows[0].d;assert.ok(!list.articles.some(a=>a.id===future));assert.ok(list.articles.some(a=>a.id===company));
 }finally{await db.query('ROLLBACK');await db.end();}
});
test('business HTTP information endpoints are operator-only',async()=>{const c=JSON.parse(await readFile(new URL('../.local/credentials.json',import.meta.url)));const root='http://127.0.0.1:6117/api/direct';const r=await fetch(root+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'narita-receiver-tochigi@sample.invalid',password:c.password})});assert.equal(r.status,200);const {token}=await r.json();const headers={Authorization:'Bearer '+token};try{const list=await fetch(root+'/information',{headers});assert.equal(list.status,403);const denied=await fetch(root+'/information/actions/create',{method:'POST',headers:{...headers,'Content-Type':'application/json','Idempotency-Key':uuid()},body:JSON.stringify({id:uuid(),scope:'platform',data:{}})});assert.equal(denied.status,403);const anon=await fetch(root+'/information');assert.equal(anon.status,401);}finally{await fetch(root+'/session',{method:'DELETE',headers});}});
