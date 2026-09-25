// Prepare shared public cases only. No consultation, agreement, booking or trip is created.
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const config=JSON.parse(await readFile(process.env.MATCHING_PREVIEW_CONFIG||new URL('../.local/config.json',import.meta.url)));
if(config.api.database!=='ecodump_direct_validation')throw Error('Isolated validation DB required');
const credentials=JSON.parse(await readFile(process.env.MATCHING_PREVIEW_CREDENTIALS||new URL('../.local/credentials.json',import.meta.url)));
const base=process.env.MATCHING_PREVIEW_API||'http://127.0.0.1:6116';
const cases=[
 ['narita-construction','construction','siteA','62000000-0000-4000-8000-000000000001','成田モデルA工区・搬出案件〈検証用〉','千葉県成田市'],
 ['narita-construction','construction','siteB','62000000-0000-4000-8000-000000000002','成田モデルB工区・搬出案件〈検証用〉','千葉県成田市'],
 ['narita-receiver-tochigi','receiving','locationTochigi','62000000-0000-4000-8000-000000000003','栃木モデル採石場・受入案件〈架空〉','栃木県'],
 ['narita-receiver-ibaraki','receiving','locationIbaraki','62000000-0000-4000-8000-000000000004','茨城モデル採石場・受入案件〈架空〉','茨城県'],
];
async function request(path,token,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),'Idempotency-Key':randomUUID()},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(`${r.status}: ${data.error}`);return data;}
const evidence=[];
for(const [account,side,asset,id,title,region] of cases){const email=credentials.accounts.find(a=>a.name===account)?.email;if(!email)throw Error('Shared account missing');const {token}=await request('/api/direct/session',null,{email,password:credentials.password});const list=(await request(`/api/match/list?side=${side}&unit=m3`,token)).data;const existing=list.ownCases.find(c=>c.id===id);if(!existing){await request('/api/match/actions/create',token,{id,side,siteId:config.naritaIds[asset],data:{title,region,soil:'第2種建設発生土',quantity:10,unit:'m3',start:'2026-09-25',end:'2026-12-31',public:'成田モデル現場から架空採石場へ搬入する検証用案件。実際の工事・契約・受入可否を示しません。',shared:side==='receiving'?'手動受付で車番と便を照合し、原票確認後に数量確定。営業時間と土質は予約申請前に担当者へ確認。':'予定10m³。運行・配車は予約承認後に施工側が手配。',internal:'共通検証モデル。正式一連テストは画面確認OK後。',documents:[]}});await request('/api/match/actions/publish',token,{id,version:1});}evidence.push({caseId:id,siteId:config.naritaIds[asset],side,title,result:existing?'existing_preserved':'created_published'});}
await writeFile(new URL('../../../docs/narita-validation/matching-preview-cases.json',import.meta.url),JSON.stringify({environment:'local-isolated',createdAt:new Date().toISOString(),cases:evidence,agreementsCreated:false,bookingsCreated:false},null,2));
console.log('Shared Narita preview cases ready; existing edits preserved; no agreements or bookings created.');
