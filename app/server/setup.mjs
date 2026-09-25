import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';
const root=path.dirname(fileURLToPath(import.meta.url));
const local=path.join(root,'.local');
await mkdir(local,{recursive:true,mode:0o700});
const socket=path.join('/tmp',`ecodump-direct-${process.getuid()}`);
await mkdir(socket,{recursive:true,mode:0o700}); await chmod(socket,0o700);
const data=path.join(local,'postgres');
const bin='/opt/homebrew/opt/postgresql@16/bin';
if(!existsSync(path.join(data,'PG_VERSION'))) execFileSync(`${bin}/initdb`,['-D',data,'-U','ecodump_owner','-A','trust','--no-locale','-E','UTF8'],{stdio:'ignore'});
try { execFileSync(`${bin}/pg_ctl`,['-D',data,'status'],{stdio:'ignore'}); }
catch { execFileSync(`${bin}/pg_ctl`,['-D',data,'-l',path.join(local,'postgres.log'),'-o',`-k ${socket} -p 55439 -c listen_addresses=''`,'-w','start'],{stdio:'ignore'}); }
const admin={host:socket,port:55439,user:'ecodump_owner',database:'postgres'};
const bootstrap=new pg.Client(admin); await bootstrap.connect();
if(!(await bootstrap.query("SELECT 1 FROM pg_database WHERE datname='ecodump_direct_validation'")).rowCount) await bootstrap.query('CREATE DATABASE ecodump_direct_validation');
await bootstrap.end();
admin.database='ecodump_direct_validation';
const db=new pg.Client(admin);await db.connect();
await db.query(`CREATE SCHEMA IF NOT EXISTS auth; CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY,email text UNIQUE NOT NULL);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE ecodump_api LOGIN INHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO ecodump_api;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE IF NOT EXISTS public.schema_migrations(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());`);
await db.query("SELECT pg_advisory_lock(hashtext('ecodump-direct-migrations'))");
for(const name of ['001_core.sql','002_direct_transport.sql','003_null_guards.sql','004_quantity_and_time.sql','005_audit_scope.sql','20260925_matching.sql','20260925_matching_refinement.sql','20260925_matching_reservation_checks.sql','20260925_matching_visibility_guards.sql','20260925_receiving_evidence.sql','20260925_receiving_evidence_guards.sql','20260925_driver_documents.sql','20260925_driver_documents_result.sql','20260925_driver_documents_lock_order.sql','20260925_receiving_evidence_metadata.sql','20260925_shared_operations_v2.sql','20260925_shared_operations_issue_kinds.sql','20260925_shared_operations_reapproval.sql','20260925_shared_operations_partial_cancel.sql','20260925_shared_operations_state_fixes.sql','20260925_driver_documents_v2_compat.sql','20260925_receiving_conditions_v2.sql','20260925_shared_projection_v2.sql','20260925_shared_projection_privacy.sql','20260925_receiving_condition_reason.sql','20260925_trip_projection_time.sql','20260925_driver_documents_strict_trip_version.sql','20260925_receiving_condition_conflict.sql','20260925_site_management_v2.sql','20260925_matching_booking_reference.sql','20260925_matching_booking_reference_guards.sql','20260925_information.sql']) {
 const sql=await readFile(path.join(root,'migrations',name),'utf8');const digest=createHash('sha256').update(sql).digest('hex');
 const previous=await db.query('SELECT sha256 FROM public.schema_migrations WHERE version=$1',[name]);
 if(previous.rowCount){if(previous.rows[0].sha256!==digest)throw new Error(`Migration checksum mismatch: ${name}`);continue;}
 await db.query('BEGIN');try {await db.query(sql);await db.query('INSERT INTO public.schema_migrations VALUES($1,$2,now())',[name,digest]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}
}
await db.query(`CREATE SCHEMA IF NOT EXISTS validation;
CREATE TABLE IF NOT EXISTS validation.accounts(user_id uuid PRIMARY KEY REFERENCES auth.users(id),email text NOT NULL UNIQUE,salt text NOT NULL,password_hash text NOT NULL);
CREATE TABLE IF NOT EXISTS validation.sessions(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),expires_at timestamptz NOT NULL);
DO $$ BEGIN CREATE ROLE ecodump_auth LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA validation TO ecodump_auth;
GRANT SELECT ON validation.accounts TO ecodump_auth;
GRANT SELECT,INSERT,DELETE ON validation.sessions TO ecodump_auth;`);
export const ids={orgC:'10000000-0000-4000-8000-000000000001',orgR:'10000000-0000-4000-8000-000000000002',orgX:'10000000-0000-4000-8000-000000000003',site:'20000000-0000-4000-8000-000000000001',siteOther:'20000000-0000-4000-8000-000000000002',location:'20000000-0000-4000-8000-000000000003',locationOther:'20000000-0000-4000-8000-000000000004',vehicle:'30000000-0000-4000-8000-000000000001',vehicleOther:'30000000-0000-4000-8000-000000000002',driver:'40000000-0000-4000-8000-000000000001',driverOther:'40000000-0000-4000-8000-000000000002'};
export const naritaIds={
 orgConstruction:'11000000-0000-4000-8000-000000000001',orgTochigi:'11000000-0000-4000-8000-000000000002',orgIbaraki:'11000000-0000-4000-8000-000000000003',orgCarrier:'11000000-0000-4000-8000-000000000004',
 siteA:'21000000-0000-4000-8000-000000000001',siteB:'21000000-0000-4000-8000-000000000002',locationTochigi:'21000000-0000-4000-8000-000000000003',locationIbaraki:'21000000-0000-4000-8000-000000000004',
 vehicle01:'31000000-0000-4000-8000-000000000001',vehicle02:'31000000-0000-4000-8000-000000000002',vehicle03:'31000000-0000-4000-8000-000000000003',
 driverAoki:'41000000-0000-4000-8000-000000000001',driverSato:'41000000-0000-4000-8000-000000000002',driverSuzuki:'41000000-0000-4000-8000-000000000003'
};
const names=['construction','receiver','driver','construction-other','receiver-other','driver-other','outsider'];
const credentialsFile=path.join(local,'credentials.json');
const credentials=existsSync(credentialsFile)?JSON.parse(await readFile(credentialsFile,'utf8')):{password:`Local-${randomBytes(12).toString('base64url')}!`,accounts:names.map((name,i)=>({name,email:`${name}@sample.invalid`,id:`50000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}))};
for(const account of [
 {name:'narita-construction',email:'narita-construction@sample.invalid',id:'51000000-0000-4000-8000-000000000001'},
 {name:'narita-receiver-tochigi',email:'narita-receiver-tochigi@sample.invalid',id:'51000000-0000-4000-8000-000000000002'},
 {name:'narita-receiver-ibaraki',email:'narita-receiver-ibaraki@sample.invalid',id:'51000000-0000-4000-8000-000000000003'},
 {name:'narita-driver-aoki',email:'narita-driver-aoki@sample.invalid',id:'51000000-0000-4000-8000-000000000004'},
 {name:'narita-driver-sato',email:'narita-driver-sato@sample.invalid',id:'51000000-0000-4000-8000-000000000005'},
 {name:'narita-driver-suzuki',email:'narita-driver-suzuki@sample.invalid',id:'51000000-0000-4000-8000-000000000006'},
 {name:'narita-outside',email:'narita-outside@sample.invalid',id:'51000000-0000-4000-8000-000000000007'}
]) if(!credentials.accounts.some(a=>a.name===account.name)) credentials.accounts.push(account);
await db.query('BEGIN');
try{
for(const [id,name,code] of [[ids.orgC,'サンプル施工会社 A','DEMO-C'],[ids.orgR,'サンプル受入会社 B','DEMO-R'],[ids.orgX,'サンプル別会社 C','DEMO-X']]) {
 await db.query('INSERT INTO public.organizations(id,name,customer_code) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,name,code]);
 await db.query('INSERT INTO public.projects(id,organization_id,name) VALUES($1,$1,$2) ON CONFLICT DO NOTHING',[id,`${name} 検証プロジェクト`]);
}
for(const [id,org,name] of [[ids.site,ids.orgC,'サンプル搬出現場 A'],[ids.siteOther,ids.orgC,'担当外の搬出現場 A2'],[ids.location,ids.orgR,'サンプル受入場所 B'],[ids.locationOther,ids.orgR,'担当外の受入場所 B2']]) {
 await db.query('INSERT INTO public.sites(id,organization_id,project_id,external_code,name,address) VALUES($1,$2,$2,$5,$3,$4) ON CONFLICT DO NOTHING',[id,org,name,'サンプル市 匿名区画（架空）',id]);
 await db.query('INSERT INTO direct.site_details VALUES($1,$2,$3,NULL,$4) ON CONFLICT DO NOTHING',[id,'東側ゲート','サンプル担当者','停車して受付。誘導員の指示を確認。']);
}
for(const id of [ids.location,ids.locationOther]){await db.query("INSERT INTO direct.receiving_locations VALUES($1,'第2種建設発生土','m3',1000) ON CONFLICT DO NOTHING",[id]);await db.query('INSERT INTO direct.partner_locations VALUES($1,$2) ON CONFLICT DO NOTHING',[ids.orgC,id]);}
for(const [i,a] of credentials.accounts.slice(0,names.length).entries()) {
 const org=[ids.orgC,ids.orgR,ids.orgC,ids.orgC,ids.orgR,ids.orgC,ids.orgX][i];const role=['prime_admin','receiver','driver','site_manager','receiver','driver','viewer'][i];
 await db.query('INSERT INTO auth.users VALUES($1,$2) ON CONFLICT DO NOTHING',[a.id,a.email]);
 await db.query('INSERT INTO public.profiles(id,display_name) VALUES($1,$2) ON CONFLICT DO NOTHING',[a.id,`サンプル ${a.name}`]);
 await db.query('INSERT INTO public.memberships(organization_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[org,a.id,role]);
 const salt=randomBytes(16).toString('hex');await db.query('INSERT INTO validation.accounts VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[a.id,a.email,salt,scryptSync(credentials.password,salt,64).toString('hex')]);
 if([0,1,3,4].includes(i))await db.query('INSERT INTO direct.scopes VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[a.id,({0:ids.site,1:ids.location,3:ids.siteOther,4:ids.locationOther})[i],i===0||i===3?'construction':'receiving']);
}
for(const [id,name] of [[ids.vehicle,'サンプル車両 01'],[ids.vehicleOther,'サンプル車両 02']])await db.query("INSERT INTO public.vehicles(id,organization_id,registration_number,display_name,vehicle_class) VALUES($1,$2,$3,$3,'10tダンプ') ON CONFLICT DO NOTHING",[id,ids.orgC,name]);
for(const [id,i] of [[ids.driver,2],[ids.driverOther,5]])await db.query('INSERT INTO public.drivers(id,organization_id,profile_id,display_name) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[id,ids.orgC,credentials.accounts[i].id,`サンプル運転者 ${i===2?'01':'02'}`]);

// WINNERS Narita validation model. Fixed IDs make the seed re-runnable and let
// construction, receiving and driver sessions refer to the exact same rows.
for(const [id,name,code] of [
 [naritaIds.orgConstruction,'WINNERS建設〈検証用〉','NARITA-C'],[naritaIds.orgTochigi,'栃木モデル受入会社〈架空〉','NARITA-R-T'],
 [naritaIds.orgIbaraki,'茨城モデル受入会社〈架空〉','NARITA-R-I'],[naritaIds.orgCarrier,'モデル運送〈架空〉','NARITA-T']
]){await db.query('INSERT INTO public.organizations(id,name,customer_code) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=excluded.name',[id,name,code]);await db.query('INSERT INTO public.projects(id,organization_id,name) VALUES($1,$1,$2) ON CONFLICT(id) DO UPDATE SET name=excluded.name',[id,`${name} 成田モデル検証`]);}
for(const [id,org,code,name,address] of [
 [naritaIds.siteA,naritaIds.orgConstruction,'NARITA-A','成田空港モデル現場A工区','千葉県成田市 モデル区画A（架空）'],
 [naritaIds.siteB,naritaIds.orgConstruction,'NARITA-B','成田空港モデル現場B工区','千葉県成田市 モデル区画B（架空）'],
 [naritaIds.locationTochigi,naritaIds.orgTochigi,'TOCHIGI-MODEL','栃木モデル採石場〈架空〉','栃木県 モデル受入区画（架空）'],
 [naritaIds.locationIbaraki,naritaIds.orgIbaraki,'IBARAKI-MODEL','茨城モデル採石場〈架空〉','茨城県 モデル受入区画（架空）']
]){await db.query('INSERT INTO public.sites(id,organization_id,project_id,external_code,name,address) VALUES($1,$2,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=excluded.name,address=excluded.address',[id,org,code,name,address]);await db.query("INSERT INTO direct.site_details(site_id,entrance,contact_name,notes) VALUES($1,'検証用ゲート','検証担当者','架空の検証データです。実在工事・契約条件ではありません。') ON CONFLICT(site_id) DO UPDATE SET notes=excluded.notes",[id]);}
for(const id of [naritaIds.locationTochigi,naritaIds.locationIbaraki]){await db.query("INSERT INTO direct.receiving_locations(id,soil,unit,daily_capacity) VALUES($1,'第2種建設発生土','m3',300) ON CONFLICT(id) DO UPDATE SET soil=excluded.soil,unit=excluded.unit,daily_capacity=excluded.daily_capacity",[id]);await db.query('INSERT INTO direct.partner_locations VALUES($1,$2) ON CONFLICT DO NOTHING',[naritaIds.orgConstruction,id]);}
const naritaAccounts=Object.fromEntries(credentials.accounts.filter(a=>a.name.startsWith('narita-')).map(a=>[a.name,a]));
for(const [name,org,role,label] of [
 ['narita-construction',naritaIds.orgConstruction,'prime_admin','WINNERS建設 配車担当〈検証用〉'],
 ['narita-receiver-tochigi',naritaIds.orgTochigi,'receiver','栃木モデル 受入担当〈架空〉'],
 ['narita-receiver-ibaraki',naritaIds.orgIbaraki,'receiver','茨城モデル 受入担当〈架空〉'],
 ['narita-driver-aoki',naritaIds.orgCarrier,'driver','青木太郎〈架空〉'],['narita-driver-sato',naritaIds.orgCarrier,'driver','佐藤健〈架空〉'],['narita-driver-suzuki',naritaIds.orgCarrier,'driver','鈴木一郎〈架空〉'],
 ['narita-outside',ids.orgX,'viewer','担当外検証ユーザー']
]){const a=naritaAccounts[name];await db.query('INSERT INTO auth.users VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET email=excluded.email',[a.id,a.email]);await db.query('INSERT INTO public.profiles(id,display_name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name',[a.id,label]);await db.query('INSERT INTO public.memberships(organization_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role,active=true',[org,a.id,role]);const salt=randomBytes(16).toString('hex');await db.query('INSERT INTO validation.accounts VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,salt=excluded.salt,password_hash=excluded.password_hash',[a.id,a.email,salt,scryptSync(credentials.password,salt,64).toString('hex')]);}
// Drivers are employees of the external carrier, not of the construction company.
// Deactivate obsolete seed memberships so organization labels and server-side
// authorization cannot silently treat them as WINNERS employees.
for(const accountName of ['narita-driver-aoki','narita-driver-sato','narita-driver-suzuki'])await db.query('UPDATE public.memberships SET active=false WHERE user_id=$1 AND organization_id<>$2',[naritaAccounts[accountName].id,naritaIds.orgCarrier]);
for(const site of [naritaIds.siteA,naritaIds.siteB])await db.query("INSERT INTO direct.scopes VALUES($1,$2,'construction') ON CONFLICT DO NOTHING",[naritaAccounts['narita-construction'].id,site]);
await db.query("INSERT INTO direct.scopes VALUES($1,$2,'receiving') ON CONFLICT DO NOTHING",[naritaAccounts['narita-receiver-tochigi'].id,naritaIds.locationTochigi]);
await db.query("INSERT INTO direct.scopes VALUES($1,$2,'receiving') ON CONFLICT DO NOTHING",[naritaAccounts['narita-receiver-ibaraki'].id,naritaIds.locationIbaraki]);
for(const [id,name,plate] of [[naritaIds.vehicle01,'検証車両01','成田100を01-01'],[naritaIds.vehicle02,'検証車両02','成田100を02-02'],[naritaIds.vehicle03,'検証車両03','成田100を03-03']])await db.query("INSERT INTO public.vehicles(id,organization_id,registration_number,display_name,vehicle_class) VALUES($1,$2,$3,$4,'10tダンプ') ON CONFLICT(id) DO UPDATE SET organization_id=excluded.organization_id,display_name=excluded.display_name,registration_number=excluded.registration_number",[id,naritaIds.orgCarrier,plate,name]);
for(const [id,account,name] of [[naritaIds.driverAoki,'narita-driver-aoki','青木太郎〈架空〉'],[naritaIds.driverSato,'narita-driver-sato','佐藤健〈架空〉'],[naritaIds.driverSuzuki,'narita-driver-suzuki','鈴木一郎〈架空〉']])await db.query('INSERT INTO public.drivers(id,organization_id,profile_id,display_name) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET organization_id=excluded.organization_id,profile_id=excluded.profile_id,display_name=excluded.display_name,active=true',[id,naritaIds.orgCarrier,naritaAccounts[account].id,name]);
for(const [vehicle,driver] of [[naritaIds.vehicle01,naritaIds.driverAoki],[naritaIds.vehicle02,naritaIds.driverSato],[naritaIds.vehicle03,naritaIds.driverSuzuki]])await db.query('INSERT INTO direct.carrier_permissions(construction_org_id,carrier_org_id,vehicle_id,driver_id,active) VALUES($1,$2,$3,$4,true) ON CONFLICT(construction_org_id,vehicle_id,driver_id) DO UPDATE SET carrier_org_id=excluded.carrier_org_id,active=true',[naritaIds.orgConstruction,naritaIds.orgCarrier,vehicle,driver]);
// Published information fixtures are read-only examples. Editor grants remain
// empty so construction/receiving roles never inherit platform editing rights.
for(const [id,scope,target,title,category,body,requiresAck] of [
 ['63000000-0000-4000-8000-000000000001','platform',null,'ECO DUMP 検証環境の利用について','運用案内','この画面は隔離した検証環境です。本番データ・実在契約・実通知は使用していません。',true],
 ['63000000-0000-4000-8000-000000000002','company',naritaIds.orgConstruction,'WINNERS建設〈検証用〉 社内連絡','お知らせ','成田モデルA工区・B工区の検証データは、実在工事の条件を示すものではありません。',false],
 ['63000000-0000-4000-8000-000000000003','site',naritaIds.siteA,'A工区 搬出時の安全確認','安全・注意','搬出前に車番・運転手・予約便を確認してください。位置情報とPush通知は未接続です。',true],
 ['63000000-0000-4000-8000-000000000004','company',naritaIds.orgTochigi,'栃木モデル受入会社〈架空〉 社内連絡','お知らせ','受入数量の確定は原票確認後に行います。荷下ろし完了とは別の状態です。',false],
 ['63000000-0000-4000-8000-000000000005','site',naritaIds.locationTochigi,'栃木モデル採石場 受付確認','運用案内','入場時に予約便と車番を照合してください。メール・Pushによる通知は行われません。',true]
]){const data={title,body,category,requiresAck,start:'2026-01-01T00:00:00+09:00',end:'2027-12-31T23:59:00+09:00',documents:[]};await db.query("INSERT INTO direct.info_articles(id,scope,target_id,status,data,actor_id) VALUES($1,$2,$3,'published',$4,$5) ON CONFLICT(id) DO NOTHING",[id,scope,target,JSON.stringify(data),naritaAccounts['narita-outside'].id]);await db.query("INSERT INTO direct.info_history(article_id,version,snapshot,actor_id,action,reason) VALUES($1,1,$2,$3,'seed','検証用の初期掲載') ON CONFLICT DO NOTHING",[id,JSON.stringify(data),naritaAccounts['narita-outside'].id]);}
await db.query('COMMIT');
}catch(e){await db.query('ROLLBACK');throw e;}
await writeFile(credentialsFile,JSON.stringify(credentials,null,2),{mode:0o600});
await writeFile(path.join(local,'config.json'),JSON.stringify({admin,api:{...admin,user:'ecodump_api'},auth:{...admin,user:'ecodump_auth'},port:6102,ids,naritaIds},null,2),{mode:0o600});
await db.end();
console.log('Isolated PostgreSQL ready; no TCP listener. Database: ecodump_direct_validation. Credentials: server/.local/credentials.json');
