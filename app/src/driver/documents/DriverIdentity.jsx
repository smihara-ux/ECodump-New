import {useEffect,useState} from 'react';
import {call} from '../../integration/api';
export default function DriverIdentity({session,ctx,bookings}){
 const [identity,setIdentity]=useState(ctx.driverIdentity||null),[error,setError]=useState('');
 useEffect(()=>{if(ctx.driverIdentity){setIdentity(ctx.driverIdentity);return;}let active=true;call(session.token,'/driver-identity').then(v=>{if(active)setIdentity(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[session.token,ctx.driverIdentity]);
 const vehicles=[...new Set(bookings.map(b=>identity?.vehicles.find(v=>v.id===b.trip?.vehicleId)?.plate||b.trip?.vehicle).filter(Boolean))];
 return <section className="driver-identity"><small>今日の担当・出発前に確認</small><p><b>{ctx.profile.display_name}</b></p><p>{identity?.companies.join(' / ')||'所属を取得中'}</p><p>車番：{vehicles.join(' / ')||'この日の割当なし'}</p>{bookings.some(b=>b.site.name.includes('成田空港モデル'))&&identity?.companies.some(n=>n.includes('WINNERS'))&&!identity?.companies.some(n=>n.includes('モデル運送'))&&<p className="document-warning">運送会社「モデル運送」の所属・委託配車は共通APIの接続待ちです。現在はDBに登録された施工会社所属を表示しています。</p>}{error&&<p role="alert">所属の取得に失敗：{error}</p>}<details><summary>車両・担当が違う／管理者に確認</summary><p>報告前に配車担当へ確認してください。この画面から割当は変更できません。</p>{bookings.map(b=><p key={b.trip?.id||b.id}>{b.site.name}：{b.site.contact||'担当者未登録'} {b.site.phone?<a href={`tel:${b.site.phone}`}>電話で確認</a>:'（連絡先未登録・社内の連絡手段で確認）'}<br/>予約番号 {b.id.slice(0,8)}</p>)}<small>対象便を開き、「問題報告・担当の確認依頼」で確認内容を送信できます。</small></details></section>;
}
