import {useEffect,useRef,useState} from 'react';
import {draftStore,readPhoto} from './documents/draftStore.mjs';
export default function DemoReceipt({trip}){
 const key=`demo-receipt:demo-driver-01:${trip.id}`,queue=useRef(Promise.resolve()),current=useRef(null);
 const [d,setD]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),[review,setReview]=useState(false);
 useEffect(()=>{let active=true;draftStore(key).then(v=>{if(active){const value=v||{quantity:'',unit:'m3',number:'',photo:null,history:[],state:'draft',reason:''};current.current=value;setD(value);}}).catch(()=>setError('端末下書きを読み込めません。'));return()=>{active=false;};},[key]);
 function save(p){const value={...current.current,...p};current.current=value;setD(value);setSaving(true);queue.current=queue.current.catch(()=>{}).then(()=>draftStore(key,value)).then(()=>setSaving(false)).catch(()=>{setSaving(false);setError('端末保存に失敗しました。');});}
 async function photo(e){const f=e.target.files?.[0];if(!f)return;try{save({photo:await readPhoto(f),state:'draft'});}catch(e){setError(e.message);}}
 if(!d)return <p>{error||'伝票下書きを読込中…'}</p>;
 return <section className="detail-section demo-receipt" id="demo-receipt"><h2>伝票・端末内デモ</h2><p>便 {trip.id} / {trip.registration}</p><p>API未接続。写真・入力・提出後の表示例はこの端末内のみで、管理者へは送信しません。</p>{error&&<p role="alert">{error}</p>}<p role="status">{saving?'端末下書き保存中':({draft:'未送信・端末下書き',pending:'確認待ちの表示例（未送信）',returned:'差戻しの表示例（未送信）'})[d.state]}</p>{d.state==='returned'&&<p>差戻し理由（表示例）：原票数量を再確認してください。</p>}
 <form onSubmit={e=>{e.preventDefault();setReview(true);}}><label>原票写真（JPEG・PNG 2MB以下）<input type="file" accept="image/jpeg,image/png" onChange={photo}/></label>{d.photo&&<img style={{maxWidth:'100%'}} src={`data:${d.photo.mime};base64,${d.photo.base64}`} alt="端末内の原票写真"/>}<label>伝票番号<input required value={d.number} onChange={e=>save({number:e.target.value,state:'draft'})}/></label><label>原票の数量<input required type="number" min="0.001" step="0.001" value={d.quantity} onChange={e=>save({quantity:e.target.value})}/></label><label>原票の単位<select value={d.unit} onChange={e=>save({unit:e.target.value})}><option value="m3">m³</option><option value="t">t</option></select></label><label>修正・確認メモ<input value={d.reason} onChange={e=>save({reason:e.target.value})}/></label><p>予定 {trip.quantity} {trip.unit} ／ 受入確定数量：未接続。単位の自動換算なし。</p><button className="primary" disabled={saving||!d.photo}>提出前の内容を見る</button></form>
 {review&&<div className="document-warning"><h3>提出前確認（端末内デモ）</h3><p>{trip.from} → {trip.to} / {d.quantity} {d.unit==='m3'?'m³':'t'}</p><button disabled={saving} onClick={()=>{save({state:'pending',history:[...d.history,{at:new Date().toISOString(),quantity:d.quantity,unit:d.unit,number:d.number,photo:d.photo,reason:d.reason}]});setReview(false);}}>確認待ちの表示例を端末に保存（送信しない）</button></div>}
 {d.state==='pending'&&<button className="secondary" onClick={()=>save({state:'returned'})}>差戻しの表示例に切り替える</button>}<details><summary>端末内の確認履歴 {d.history.length}件</summary>{d.history.map((h,i)=><p key={i}>第{i+1}版 / {new Date(h.at).toLocaleString('ja-JP')} / {h.quantity} {h.unit} / {h.reason||'初回確認'}（未送信）</p>)}</details></section>;
}

export function DemoReceiptSummary({tripId}){
 const [d,setD]=useState(undefined);
 useEffect(()=>{let active=true;draftStore(`demo-receipt:demo-driver-01:${tripId}`).then(v=>{if(active)setD(v||null);}).catch(()=>{if(active)setD(null);});return()=>{active=false;};},[tripId]);
 return <><small>本人入力：{d?.quantity?`${d.quantity} ${d.unit==='m3'?'m³':'t'}`:'未入力'}（端末内・未送信）</small><small>伝票：{d===undefined?'読込中':!d?'未提出':d.state==='pending'?(d.history.length>1?'再提出後確認待ちの表示例':'確認待ちの表示例'):d.state==='returned'?'差戻しの表示例':'下書き'} ／ 受入確定：未接続</small></>;
}
