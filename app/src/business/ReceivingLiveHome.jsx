import GateQueue from '../receiving/GateQueue';
import {useEffect,useState} from 'react';
import {call} from '../integration/api';
import {receivingTrip} from '../receiving/liveModel.mjs';
import {useEvidenceActions} from '../receiving/ReceivingEvidence';
import {ReceivingHome} from '../receiving/ReceivingWorkspace';
export default function ReceivingLiveHome({session,navigate,onOpen}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);try{const [ctx,r,g]=await Promise.all([call(session.token,'/context'),call(session.token,'/bookings'),call(session.token,'/gate-records')]);setData({ctx,rows:r.bookings.filter(b=>b.canConfirm),gates:g.records});setError('');}catch(e){setError(e.message);throw e;}finally{setBusy(false);}}
 useEffect(()=>{load().catch(()=>{});},[session.token]);
 const actions=useEvidenceActions(session,load);
 if(!data)return <section><p role={error?'alert':'status'}>{error||'予定を取得しています…'}</p><button onClick={()=>load().catch(()=>{})} disabled={busy}>再取得</button></section>;
 const places=new Map(data.ctx.sites.filter(s=>data.ctx.scopes.some(scope=>scope.site_id===s.id&&scope.role==='receiving')).map(s=>[s.id,s]));
 data.rows.forEach(b=>places.set(b.location.id,b.location));
 // Only fields returned by the API are shown; do not invent opening hours or congestion.
 const locations=[...places.values()].map(l=>({id:l.id,name:l.name,hours:'営業時間は場所管理で確認',congestion:'混雑未確認'}));
 const trips=data.rows.map(receivingTrip);
 const model={live:true,session,actions,trips,locations,setSelectedLocation:()=>{}};
 return <section className="receiving-workspace"><div className="business-session-bar"><span>保存済みの予約・実績</span><button disabled={busy} onClick={()=>load().catch(()=>{})}>{busy?'取得中…':'再取得'}</button></div>{error&&<p role="alert">{error}（表示は前回取得時点です）</p>}<ReceivingHome m={model} openTrip={onOpen} navigate={navigate} newReservation={()=>navigate('搬入予約・受付')}/><GateQueue records={data.gates} rows={data.rows} locations={locations} actions={actions}/></section>;
}
