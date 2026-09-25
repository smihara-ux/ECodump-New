import {useEffect,useRef,useState} from 'react';
import {draftStore} from './documents/draftStore.mjs';
// Operation names/fields are shared API contracts, not driver-only persistence.
export default function DriverIssueForm({booking:b,session,ask,disabled}){
 const key=`issue:${session.userId}:${b.trip.id}`;
 const [value,setValue]=useState(null),[error,setError]=useState('');const queue=useRef(Promise.resolve());
 useEffect(()=>{let active=true;draftStore(key).then(d=>{if(active)setValue(d||{kind:'delay',reason:'',tripVersion:b.trip.version});}).catch(()=>setError('端末保存を利用できません。'));return()=>{active=false;};},[key]);
 function change(p){const next={...value,...p,state:'unsent'};setValue(next);queue.current=queue.current.catch(()=>{}).then(()=>draftStore(key,next)).catch(()=>setError('下書きを端末に保存できません。'));}
 const submitted=value&&(b.issues||[]).some(i=>i.kind===value.kind&&i.reason===value.reason);
 const outdated=value&&value.tripVersion!==b.trip.version;
 return <section className="connected-card"><h2>問題報告・担当の確認依頼</h2><p>停車中に内容を確認して送信してください。問題報告だけで入場・退場・数量を確定しません。</p>{['unloaded','cancelled','refused'].includes(b.trip.status)&&<p>完了・取消・受入不可が確定した便の追加問題報告は管理者へ確認してください。</p>}{error&&<p role="alert">{error}</p>}{value&&outdated&&!submitted&&<div className="document-warning"><p>運行情報が更新されました。対象便と現在の担当内容を再確認してください。</p><button disabled={disabled} onClick={()=>change({tripVersion:b.trip.version})}>現在の便に対する問題報告と確認</button></div>}{submitted&&<p role="status">この内容は送信済みです。管理側の対応をお待ちください。</p>}{value&&<form className="connected-form" onSubmit={async e=>{e.preventDefault();await queue.current;ask('問題を報告',value.reason,'trip_issue',{bookingId:b.id,tripId:b.trip.id,expectedVersion:value.tripVersion,kind:value.kind,reason:value.reason});}}><fieldset disabled={disabled||(outdated&&!submitted)}><label>問題の種類<select value={value.kind} onChange={e=>change({kind:e.target.value})}><option value="delay">遅延</option><option value="vehicle_trouble">車両トラブル</option><option value="receiving_unavailable">受入不可の連絡</option><option value="assignment_mismatch">車両・担当違いの確認依頼</option><option value="other">その他</option></select></label><label>状況・管理者への確認内容<textarea required maxLength={2000} value={value.reason} onChange={e=>change({reason:e.target.value})}/></label><small>{submitted?'DBに同じ内容の報告を確認済みです。':'入力はこのユーザー・便の端末下書きとして保持します。未送信です。'}</small><button className="primary" disabled={submitted}>内容を確認して問題報告へ</button></fieldset></form>}
 {(b.issues||[]).map(i=><article key={i.id}><strong>{({delay:'遅延',vehicle_trouble:'車両トラブル',receiving_unavailable:'受入不可の連絡',assignment_mismatch:'担当確認',other:'その他'})[i.kind]||i.kind}</strong><p>{i.reason}</p><small>{i.status==='resolved'?'対応済み':'管理側の対応待ち'} / {new Date(i.createdAt).toLocaleString('ja-JP')}</small></article>)}
 </section>;
}
