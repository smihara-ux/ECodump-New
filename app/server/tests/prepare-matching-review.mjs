// Screen-review fixtures only: shared Narita identities, no booking/trip or grants.
// This does not execute or certify the formal agreement-to-transport workflow.
import {readFile} from 'node:fs/promises';
import pg from 'pg';

const cfg=JSON.parse(await readFile(new URL('../.local/config.json',import.meta.url)));
if(cfg.admin.database!=='ecodump_direct_validation'||!cfg.admin.host.startsWith('/tmp/ecodump-direct-'))throw Error('Local isolated database required');
const db=new pg.Client(cfg.admin);
await db.connect();
await db.query('BEGIN');
try {
 await db.query("SELECT pg_advisory_xact_lock(hashtext('matching-screen-review-v1'))");
 const accounts=(await db.query("SELECT email,user_id FROM validation.accounts WHERE email LIKE 'narita-%'")).rows;
 const actor=name=>accounts.find(a=>a.email===name+'@sample.invalid')?.user_id;
 const construction=actor('narita-construction'),receiver=actor('narita-receiver-tochigi');
 if(!construction||!receiver)throw Error('Shared Narita accounts required');
 const id=n=>`64000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 for(const [offset,agreed] of [[0,false],[10,true]]){
  const consultation=id(offset+3);
  // Never rewrite an existing fixture, including user edits or a later booking.
  if((await db.query('SELECT 1 FROM direct.match_consultations WHERE id=$1',[consultation])).rowCount)continue;
  const source=id(offset+1),target=id(offset+2);
  for(const [cid,site,side,user,region] of [[source,cfg.naritaIds.siteA,'construction',construction,'千葉県成田市'],[target,cfg.naritaIds.locationTochigi,'receiving',receiver,'栃木県']]){
   const data={title:`【画面確認用】${agreed?'条件合意済み':'条件調整中'}・${side==='construction'?'成田A工区':'栃木採石場'}`,region,soil:'第2種建設発生土',quantity:10,unit:'m3',start:'2026-09-30',end:'2026-12-31',public:'架空の画面確認用データです。実在の取引・契約・受入可否を示しません。',shared:'車番と便を手動照合し、原票確認後に受入数量を確定。',internal:'社内限定の検証メモ',documents:[]};
   await db.query('SELECT direct.match_validate($1)',[data]);
   await db.query("INSERT INTO direct.match_cases(id,site_id,side,status,data,created_by) VALUES($1,$2,$3,'published',$4,$5)",[cid,site,side,data,user]);
   await db.query('INSERT INTO direct.match_history(case_id,version,actor_id,snapshot) VALUES($1,1,$2,$3)',[cid,user,data]);
  }
  await db.query("INSERT INTO direct.match_consultations(id,source_id,target_id,version,state,initial_message) VALUES($1,$2,$3,$4,$5,$6)",[consultation,source,target,agreed?5:3,agreed?'agreed':'consulting','画面確認用の相談記録です。正式試験は未実施です。']);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[construction]);
  const sourceSnapshot=(await db.query('SELECT direct.match_view($1,true) AS d',[source])).rows[0].d;
  const targetSnapshot=(await db.query('SELECT direct.match_view($1,true) AS d',[target])).rows[0].d;
  const terms={soil:'第2種建設発生土',quantity:10,unit:'m3',start:'2026-10-01',end:'2026-12-31',conditions:'受付前に車番と便を照合する。',message:'画面確認用の初回条件'};
  for(const revision of [1,2]){
   const offerTerms=revision===1?terms:{...terms,conditions:'受付前に車番と便を照合する。原票写真の提出が必要。',message:'原票写真の条件を追加'};
   await db.query('INSERT INTO direct.match_offers(id,consultation_id,revision,terms,source_snapshot,target_snapshot,actor_id,side) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id(offset+3+revision),consultation,revision,offerTerms,sourceSnapshot,targetSnapshot,revision===1?construction:receiver,revision===1?'construction':'receiving']);
   if(agreed&&revision===2){
    for(const [side,user] of [['construction',construction],['receiving',receiver]])await db.query('INSERT INTO direct.match_acceptances(offer_id,side,actor_id) VALUES($1,$2,$3)',[id(offset+5),side,user]);
    await db.query('INSERT INTO direct.match_agreements(id,consultation_id,offer_id,snapshot) VALUES($1,$2,$3,$4)',[id(offset+6),consultation,id(offset+5),{terms:offerTerms,source:sourceSnapshot,target:targetSnapshot,revision:2}]);
   }
  }
 }
 await db.query('COMMIT');
 console.log('Screen-review consultation and agreement fixtures ready; no bookings, trips or permission grants created. Existing rows preserved.');
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
