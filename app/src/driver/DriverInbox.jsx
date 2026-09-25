import {useEffect,useState} from 'react';
import {call} from '../integration/api';
import {driverNotifications} from './connectedModel.mjs';
import {draftSummaries} from './documents/draftStore.mjs';
export default function DriverInbox({session,rows,open,assignmentAlerts={}}){
 const [drafts,setDrafts]=useState([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;draftSummaries(session.userId).then(d=>{if(active)setDrafts(d);}).catch(()=>{if(active)setError('端末下書きの一覧を取得できません。');});return()=>{active=false;};},[session.userId,rows]);
 const notices=driverNotifications(rows);
 const [result,setResult]=useState({}),[checking,setChecking]=useState(false);
 async function lookup(d){if(checking)return;setChecking(true);try{const r=await call(session.token,`/operations/${d.operationKey}`);setResult(v=>({...v,[d.tripId]:r.state==='applied'?'DB保存済み。現在の担当権限では詳細を表示できない場合があります。':'DB未処理。現在の割当を再確認してください。自動再送しません。'}));}catch{setResult(v=>({...v,[d.tripId]:'照会できません。結果不明のまま保持しています。'}));}finally{setChecking(false);}}
 return <><h1>お知らせ・未処理</h1><p>共通DBから取得した現在の確認状況です。端末へのPush通知は未接続です。</p>{error&&<p role="alert">{error}</p>}
 <section className="connected-card"><h2>端末に残っている伝票</h2>{drafts.filter(d=>d.state!=='sent').map(d=>{const b=rows.find(b=>b.trip?.id===d.tripId);return <article key={d.tripId}><strong>{({unsent:'未送信下書き',sending:'結果確認中',unknown:'結果確認中',failed:'送信失敗',not_applied:'未送信・処理結果照会済み'})[d.state]||d.state}</strong><p>便 {d.tripId.slice(0,8)}</p>{d.operationKey&&<button className="secondary" disabled={checking} onClick={()=>lookup(d)}>提出の処理結果を照会</button>}{result[d.tripId]&&<p role="status">{result[d.tripId]}</p>}{b?<button className="secondary" onClick={()=>open(d.tripId)}>対象便を確認</button>:<p>現在の担当範囲にありません。旧下書きは送信せず、管理者に確認してください。</p>}</article>;})}{!drafts.some(d=>d.state!=='sent')&&<p>未送信の伝票はありません。</p>}</section>
 {Object.entries(assignmentAlerts).filter(([tripId])=>rows.some(b=>b.trip?.id===tripId)).map(([tripId,changes])=><section className="connected-card" key={`assignment:${tripId}`}><h2>配車内容の変更</h2><p>便 {tripId.slice(0,8)} / {changes.map(c=>c.label).join('・')}</p><button className="secondary" onClick={()=>open(tripId)}>変更内容を確認</button></section>)}{notices.map(n=><section key={n.id} className="connected-card"><h2>{n.title}</h2><p>{n.route}</p><p>{n.detail}</p><button className="secondary" onClick={()=>open(n.tripId)}>対象便を開く</button></section>)}{!notices.length&&<p>確認が必要な伝票・実績のお知らせはありません。</p>}</>;
}
