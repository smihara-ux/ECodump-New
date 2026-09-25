import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const c=JSON.parse(await readFile(new URL('../server/.local/credentials.json',import.meta.url))),base='http://127.0.0.1:5199',date=process.env.QA_DATE||'2048-02-15';
const b=await chromium.launch();const out=new URL('../../docs/admin-restoration-qa/transport.json',import.meta.url);
const button=(p,n)=>p.getByRole('button',{name:n,exact:true});
async function open(role){const p=await b.newPage({viewport:{width:1440,height:1000}});await p.goto(`${base}/?preview=app&role=${role}&page=transport&date=${date}`);await button(p,'ログインして保存を利用').click();const d=p.getByRole('dialog');await d.getByLabel('パスワード',{exact:true}).fill(c.password);await button(d,'ログイン').click();await expect(d).toHaveCount(0);return p;}
async function save(p){await button(p.getByRole('dialog'),'内容を確認して保存').click();await expect(p.getByText('DB保存と再取得を確認しました。',{exact:true})).toBeVisible();}
async function detail(p,id){await p.locator('.sidebar').getByRole('button',{name:'搬入予約・受付',exact:true}).click();await p.getByLabel('表示日（日本時間）',{exact:true}).fill(date);await button(p.locator('tbody tr').filter({hasText:id.slice(0,8)}),'詳細を確認').click();}
try{
 const pc=await open('construction'),pr=await open('receiving');
 await button(pc,'搬出予定・予約を作成').click();await pc.getByLabel('搬入日（日本時間）',{exact:true}).fill(date);await pc.getByLabel('指定時刻',{exact:true}).fill('10:00');await pc.getByLabel('予定数量（m³）',{exact:true}).fill('5');await pc.getByLabel('直接取引の条件・合意内容（受入側確認前）',{exact:true}).fill('通常画面からの匿名連携確認');await button(pc,'予約を申請').click();const response=pc.waitForResponse(r=>r.url().endsWith('/api/direct/actions/create')&&r.status()===200);await save(pc);const id=(await(await response).json()).bookingId;
 await detail(pr,id);await button(pr,'条件を確認して予約確定').click();await save(pr);
 await button(pc,'再取得').click();await button(pc.locator('tbody tr').filter({hasText:id.slice(0,8)}),'詳細を確認').click();await button(pc,'この内容で配車').click();await save(pc);
 const s=await fetch('http://127.0.0.1:6103/api/direct/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'driver@sample.invalid',password:c.password})}).then(r=>r.json());
 for(const [i,state]of ['site_arrived','in_transit','receiver_arrived','unloaded'].entries()){const r=await fetch('http://127.0.0.1:6103/api/direct/actions/report',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${s.token}`,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({bookingId:id,expectedVersion:i+1,state,reportedAt:new Date().toISOString()})});expect(r.status).toBe(200);}
 await button(pr,'再取得').click();await pr.getByLabel('受入実績数量（m³）',{exact:true}).fill('4.8');await pr.getByLabel('差異理由（予定と異なる場合は必須）',{exact:true}).fill('匿名の計量差確認');await button(pr,'受入実績を確定').click();await save(pr);
 for(const p of [pc,pr]){await p.reload();await p.locator('.sidebar').getByRole('button',{name:'実績・帳票',exact:true}).click();await p.getByLabel('表示日（日本時間）',{exact:true}).fill(date);await expect(p.locator('tbody tr').filter({hasText:id.slice(0,8)})).toContainText('4.8 m³');}
 await writeFile(out,JSON.stringify({date,bookingId:id,planned:5,actual:4.8,unit:'m3',normalAdminUI:'create-confirm-assign-actual-refetch-reload-both-roles PASS',driver:'authenticated API status reports (not device)',result:'PASS'},null,2));console.log('PASS normal admin transport persisted across both roles');
}finally{await b.close();}
