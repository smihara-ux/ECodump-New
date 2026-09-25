import { handleInformation } from './information-handler.mjs';
import { driverDocuments } from './driver-documents-handler.mjs';
import { handleMatching } from './matching-handler.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import pg from 'pg';
const dgxPrivate=process.env.ECODUMP_DEPLOYMENT_MODE==='dgx-private';
const config=dgxPrivate?{
 admin:{host:process.env.ECODUMP_DB_HOST,port:Number(process.env.ECODUMP_DB_PORT||5432),user:process.env.ECODUMP_DB_ADMIN_USER,database:process.env.ECODUMP_DB_NAME,password:process.env.ECODUMP_DB_ADMIN_PASSWORD},
 api:{host:process.env.ECODUMP_DB_HOST,port:Number(process.env.ECODUMP_DB_PORT||5432),user:process.env.ECODUMP_DB_API_USER,database:process.env.ECODUMP_DB_NAME,password:process.env.ECODUMP_DB_API_PASSWORD},
 auth:{host:process.env.ECODUMP_DB_HOST,port:Number(process.env.ECODUMP_DB_PORT||5432),user:process.env.ECODUMP_DB_AUTH_USER,database:process.env.ECODUMP_DB_NAME,password:process.env.ECODUMP_DB_AUTH_PASSWORD},
 port:Number(process.env.ECODUMP_DIRECT_PORT||6102),
}:JSON.parse(await readFile(new URL('./.local/config.json',import.meta.url),'utf8'));
if(config.admin.database!=='ecodump_direct_validation' || (!dgxPrivate&&!config.api.host.startsWith('/tmp/ecodump-direct-')))throw new Error('This API only runs against the ECO DUMP validation database.');
const pool=new pg.Pool({...config.api,max:10,statement_timeout:15000});
const authPool=new pg.Pool({...config.auth,max:3,statement_timeout:15000});
const hash=value=>createHash('sha256').update(value).digest('hex');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const attempts=new Map();
function fail(status,message){return Object.assign(new Error(message),{status});}
async function jsonBody(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>3*1024*1024)throw fail(413,'ファイルを含むリクエストが大きすぎます。');chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw fail(400,'JSON形式を確認してください。');}}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function identify(req){const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)throw fail(401,'ログインしてください。');const {rows}=await authPool.query('SELECT user_id FROM validation.sessions WHERE token_hash=$1 AND expires_at>now()',[hash(token)]);if(!rows[0])throw fail(401,'セッションが切れました。再ログインしてください。');return rows[0].user_id;}
const errors={LOCATION_CONDITIONS_CHANGED:'受入場所台帳の土質・単位と合意条件が一致しません。受入場所の設定を確認してください。',TERMS_OUTSIDE_CASE:'提示数量・土質・単位・期間を双方の案件条件内で指定してください。',INVALID_RESERVATION_TIME:'搬入予定日時は合意期間内で指定してください。',STALE_OFFER:'提示条件の版が変わりました。再取得して確認してください。',FORBIDDEN:'権限がありません。',STALE_VERSION:'情報が更新されています。再取得して確認してください。',IDEMPOTENCY_CONFLICT:'同じ操作IDを異なる内容で再利用できません。',CAPACITY_EXCEEDED:'受入容量を超えています。',ASSIGNMENT_OVERLAP:'車両またはドライバーの予定が重複しています。',INVALID_TRANSITION:'報告の順序を確認してください。',UNLOAD_REQUIRED:'荷下ろし完了後に実績を確定してください。',INVALID_ACTUAL:'実績数量・単位・差異理由を確認してください。',TRIP_ID_REQUIRED:'複数便があるため便IDを指定してください。',TRIP_QUANTITY_EXCEEDS_BOOKING:'便の予定数量合計が予約数量を超えています。',STARTED_TRIP_LOCKED:'開始済みの便があるため、この変更はできません。',REASON_REQUIRED:'変更理由を入力してください。',RESERVATION_NOT_CONFIRMED:'受入承認済みの予約にのみ配車できます。'};
const server=http.createServer(async(req,res)=>{
 let client;
 try{
  const url=new URL(req.url,'http://localhost');const route=url.pathname;
  const host=(req.headers.host||'').split(':')[0];
  const allowedHosts=dgxPrivate?new Set((process.env.ECODUMP_ALLOWED_HOSTS||'127.0.0.1,localhost').split(',').map(x=>x.trim()).filter(Boolean)):new Set(['127.0.0.1','localhost']);
  if(!allowedHosts.has(host))throw fail(403,dgxPrivate?'許可されていないホストです。':'ローカル検証専用APIです。');
  if(req.headers.origin){const originHost=new URL(req.headers.origin).hostname;if(!allowedHosts.has(originHost))throw fail(403,'許可されていない接続元です。');}
  if(route==='/api/direct/health'&&req.method==='GET'){await pool.query('SELECT 1');return send(res,200,{mode:'isolated-postgresql',production:false});}
  if(route==='/api/direct/session'&&req.method==='POST'){
    const body=await jsonBody(req);const rateKey=req.socket.remoteAddress;const entry=attempts.get(rateKey)||{count:0,start:Date.now()};if(Date.now()-entry.start>60000){entry.count=0;entry.start=Date.now();}entry.count++;attempts.set(rateKey,entry);if(entry.count>30)throw fail(429,'しばらく待ってから再度ログインしてください。');
    const {rows}=await authPool.query('SELECT * FROM validation.accounts WHERE email=$1',[String(body.email||'').toLowerCase()]);const account=rows[0];const candidate=scryptSync(String(body.password||''),account?.salt||'invalid-user',64);if(!account||!timingSafeEqual(candidate,Buffer.from(account.password_hash,'hex')))throw fail(401,'メールアドレスまたはパスワードが違います。');
    const token=randomBytes(32).toString('base64url');await authPool.query("INSERT INTO validation.sessions VALUES($1,$2,now()+interval '8 hours')",[hash(token),account.user_id]);return send(res,200,{token,userId:account.user_id,mode:'isolated-validation-auth'});
  }
  const user=await identify(req);
  if(route==='/api/direct/session'&&req.method==='DELETE'){await authPool.query('DELETE FROM validation.sessions WHERE token_hash=$1',[hash(req.headers.authorization.slice(7))]);return send(res,200,{signedOut:true});}
  client=await pool.connect();await client.query('BEGIN');await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);
  if(!(await client.query('SELECT 1 FROM public.memberships WHERE user_id=$1 AND active',[user])).rowCount)throw fail(403,'所属が無効です。');
  if(route.startsWith('/api/direct/information')){
    const output=await handleInformation(req,client,url,jsonBody);await client.query('COMMIT');
    if(req.headers['x-validation-drop-response']==='1'){res.destroy();return;}
    return send(res,200,output);
  }
  if(route.startsWith('/api/match/')){
    const output=await handleMatching(req,client,url);await client.query('COMMIT');
    if(req.headers['x-validation-drop-response']==='1'){res.destroy();return;}
    return send(res,200,output);
  }
  if(route.startsWith('/api/direct/driver-')){
    const output=await driverDocuments(req,client,url,jsonBody);await client.query('COMMIT');
    if(req.headers['x-validation-drop-response']==='1'){res.destroy();return;}
    return send(res,200,output);
  }
  let output;
  if(route==='/api/direct/context'&&req.method==='GET'){
    const profile=(await client.query('SELECT id,display_name FROM public.profiles WHERE id=$1',[user])).rows[0];
    const scopes=(await client.query('SELECT * FROM direct.scopes')).rows;
    const sites=(await client.query(`SELECT s.id,s.name,s.address,s.organization_id,o.name AS organization_name,d.entrance,d.contact_name AS contact,d.phone,d.notes,m.version
      FROM public.sites s JOIN public.organizations o ON o.id=s.organization_id LEFT JOIN direct.site_details d ON d.site_id=s.id LEFT JOIN direct.site_management m ON m.site_id=s.id
      WHERE s.id=ANY($1::uuid[]) ORDER BY s.name`,[scopes.map(s=>s.site_id)])).rows;
    const membershipRows=(await client.query('SELECT organization_id,role::text FROM public.memberships WHERE user_id=$1 AND active',[user])).rows;
    const driverOnly=membershipRows.length>0&&membershipRows.every(m=>m.role==='driver');
    const vehicles=(await client.query(`SELECT DISTINCT v.id,v.display_name,v.registration_number AS vehicle_plate,v.organization_id,o.name AS organization_name
      FROM public.vehicles v JOIN public.organizations o ON o.id=v.organization_id
      WHERE v.active AND ($2::boolean=false OR EXISTS(SELECT 1 FROM direct.trips t JOIN public.drivers d ON d.id=t.driver_id WHERE t.vehicle_id=v.id AND d.profile_id=$1)) ORDER BY v.display_name`,[user,driverOnly])).rows;
    const drivers=(await client.query(`SELECT DISTINCT d.id,d.display_name,d.profile_id,d.organization_id,o.name AS organization_name
      FROM public.drivers d JOIN public.organizations o ON o.id=d.organization_id
      WHERE d.active AND ($2::boolean=false OR d.profile_id=$1) ORDER BY d.display_name`,[user,driverOnly])).rows;
    const roles=[...new Set(scopes.map(x=>x.role))];if(drivers.some(d=>d.profile_id===user))roles.push('driver');
    const ownOrganizations=new Set(membershipRows.map(x=>x.organization_id));
    output={profile,scopes,sites,vehicles:vehicles.map(v=>({...v,external:!ownOrganizations.has(v.organization_id)})),drivers:drivers.map(({profile_id,...d})=>({...d,external:!ownOrganizations.has(d.organization_id)})),roles,locations:(await client.query('SELECT direct.partner_catalog() AS data')).rows[0].data,mode:'isolated-postgresql'};
  }else if(route==='/api/direct/bookings'&&req.method==='GET')output={bookings:(await client.query('SELECT direct.list_bookings() AS data')).rows[0].data};
  else if(route==='/api/direct/receiving-conditions'&&req.method==='GET'){
    const day=url.searchParams.get('date')||new Date().toISOString().slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw fail(400,'日付を確認してください。');
    output={conditions:(await client.query('SELECT direct.list_receiving_conditions($1::date) AS data',[day])).rows[0].data};
  }
  else if(/^\/api\/direct\/receiving-conditions\/[0-9a-f-]+\/history$/i.test(route)&&req.method==='GET'){
    const locationId=route.split('/')[4];if(!uuid.test(locationId))throw fail(400,'受入場所IDが不正です。');
    output={history:(await client.query('SELECT h.actor_id,p.display_name AS actor_name,h.reason,h.before_data,h.after_data,h.created_at FROM direct.receiving_condition_history h JOIN public.profiles p ON p.id=h.actor_id WHERE h.location_id=$1 ORDER BY h.created_at,h.id',[locationId])).rows};
  }
  else if(/^\/api\/direct\/bookings\/[0-9a-f-]+\/history$/i.test(route)&&req.method==='GET'){
    const bookingId=route.split('/')[4];if(!uuid.test(bookingId))throw fail(400,'予約IDが不正です。');
    output={history:(await client.query("SELECT a.action,a.operation_key,a.actor_id,p.display_name AS actor_name,a.before_data,a.after_data,a.created_at FROM direct.audit a JOIN public.profiles p ON p.id=a.actor_id WHERE a.booking_id=$1 ORDER BY a.created_at,a.id",[bookingId])).rows};
  }
  else if(route==='/api/direct/gate-records'&&req.method==='GET')output={records:(await client.query("SELECT * FROM direct.gate_records WHERE direct.has_scope(location_id,'receiving') ORDER BY occurred_at DESC")).rows};
  else if(route.startsWith('/api/direct/operations/')&&req.method==='GET'){
    const key=route.split('/').at(-1);if(!uuid.test(key))throw fail(400,'操作IDが不正です。');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user+key]);
    const result=(await client.query('SELECT result FROM direct.operations WHERE actor_id=$1 AND operation_key=$2',[user,key])).rows[0];output=result?{state:'applied',result:result.result}:{state:'not_applied'};
  }else if(route.startsWith('/api/direct/attachments/')&&req.method==='GET'){
    const id=route.split('/').at(-1);if(!uuid.test(id))throw fail(400,'添付IDが不正です。');
    const attachment=(await client.query('SELECT filename,mime,data FROM direct.attachments WHERE id=$1',[id])).rows[0];if(!attachment)throw fail(404,'添付書類が見つかりません。');
    await client.query('COMMIT');res.writeHead(200,{'Content-Type':attachment.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(attachment.data);
  }else if(route.startsWith('/api/direct/actions/')&&req.method==='POST'){
    const action=route.split('/').at(-1);const extended=['booking_change','booking_cancel','booking_reply','trip_add','trip_reassign','trip_cancel','trip_issue','issue_resolve','report_correct'];const locationActions=['receiving_condition_update'];const siteActions=['site_update'];if(!['create','confirm','assign','report','actual','attachment','receipt_submit','receipt_return','receipt_confirm','receipt_correct','gate_record','gate_review',...extended,...locationActions,...siteActions].includes(action))throw fail(404,'操作が見つかりません。');
    const key=req.headers['idempotency-key'];if(!uuid.test(key||''))throw fail(400,'Idempotency-Keyが必要です。');
    const body=await jsonBody(req);if(!body||Array.isArray(body)||typeof body!=='object')throw fail(400,'リクエストが不正です。');
    if(action==='create'){if(!uuid.test(body.id||'')||!uuid.test(body.siteId||'')||!uuid.test(body.locationId||''))throw fail(400,'IDが不正です。');if(!Number.isFinite(Number(body.quantity))||Number(body.quantity)<=0||typeof body.agreementNote!=='string'||body.agreementNote.length>2000)throw fail(422,'予約内容を確認してください。');}
    else if(!action.startsWith('gate_')&&!locationActions.includes(action)&&!siteActions.includes(action)&&!uuid.test(body.bookingId||''))throw fail(400,'予約IDが不正です。');
    if(['confirm','assign','report','actual',...extended,...locationActions,...siteActions].includes(action)&&(!Number.isInteger(body.expectedVersion)||body.expectedVersion<1))throw fail(422,'expectedVersionが必要です。');
    if(extended.includes(action)&&typeof body.reason!=='string')throw fail(422,'変更理由が必要です。');
    if(locationActions.includes(action)&&(!String(body.reason||'').trim()||String(body.reason).length>2000))throw fail(422,'変更理由が必要です。');
    if(siteActions.includes(action)&&(!uuid.test(body.siteId||'')||!String(body.reason||'').trim()))throw fail(422,'現場IDと変更理由が必要です。');
    if(['trip_reassign','trip_cancel','trip_issue','issue_resolve','report_correct'].includes(action)&&!uuid.test(body.tripId||''))throw fail(422,'便IDが必要です。');
    if(action==='attachment'){
      const bytes=Buffer.from(body.base64||'','base64');const magic=body.mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):body.mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:body.mime==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':false;
      if(!magic||bytes.length>2097152||!body.filename||body.filename.length>120)throw fail(422,'PNG・JPEG・PDF（2MB以下）を選択してください。');
    }
    const mutation=siteActions.includes(action)?'site_mutate':locationActions.includes(action)?'location_mutate':extended.includes(action)?'extended_mutate':action.startsWith('receipt_')||action.startsWith('gate_')?'receive_mutate':'mutate';
    output=(await client.query(`SELECT direct.${mutation}($1,$2,$3::jsonb) AS result`,[action,key,JSON.stringify(body)])).rows[0].result;
    await client.query('COMMIT');
    // Explicit isolated-test fault hook: commit succeeds but its HTTP response is lost.
    if(req.headers['x-validation-drop-response']==='1'){res.destroy();return;}
    return send(res,200,{operationId:key,...output});
  }else throw fail(404,'APIが見つかりません。');
  await client.query('COMMIT');send(res,200,output);
 }catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});const status=e.status||({42501:403,40001:409,23505:409,23503:422,23502:422,23514:422,22023:422,'22P02':422,'22007':422,'22008':422,57014:503}[e.code]||500);send(res,status,{error:e.status?e.message:errors[e.message]||(status===403?'許可されていない操作です。':status===409?'競合が発生しました。再取得してください。':status===422?'入力内容または処理順序を確認してください。':'処理結果を照会してください。'),code:e.code||'HTTP_ERROR'});if(status===500)console.error('API error',e.code,e.message);}
 finally{client?.release();}
});
const listenHost=dgxPrivate?'0.0.0.0':'127.0.0.1';
server.listen(Number(process.env.ECODUMP_DIRECT_PORT||config.port),listenHost,()=>console.log(`ECO DUMP API ${listenHost}:${process.env.ECODUMP_DIRECT_PORT||config.port}; persisted PostgreSQL; validation auth only.`));
process.on('SIGTERM',()=>server.close(async()=>{await pool.end();await authPool.end();process.exit(0);}));
