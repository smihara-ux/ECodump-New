import {useEffect,useRef} from 'react';
import L from 'leaflet';
import './timeline.css';
export const receivingTripState=trip=>({運行中:'受入先へ移動中',遅延:'受入先へ移動中・遅延',待機中:'搬出現場で待機中',受入中:'受入先で受入中',完了:'荷下ろし完了'})[trip.status]||trip.status;
export default function ReceivingTripMap({trip,from,to,route,onClose}){
 const dialog=useRef(null),canvas=useRef(null);
 const waiting=trip.status==='待機中';
 const progress=waiting?0:['完了','受入中'].includes(trip.status)?1:.55;
 const points=route?.points||[];
 const end=points.length?Math.round((points.length-1)*progress):0;
 useEffect(()=>{const focus=document.querySelector(".timeline-list > button.selected")||document.activeElement;dialog.current.showModal();return()=>requestAnimationFrame(()=>focus?.focus({preventScroll:true}));},[]);
 useEffect(()=>{
 if(!canvas.current||!from||!to)return;
 const map=L.map(canvas.current,{zoomControl:true}).setView(from.position,11);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(map);
 for(const [p,label,color] of [[from.position,'搬出現場','#9bb700'],[to.position,'受入先','#e29227']])L.circleMarker(p,{radius:9,fillOpacity:1,color,weight:3}).bindTooltip(label,{permanent:true}).addTo(map);
 if(points.length){
 L.polyline(points,{color:'#76918e',weight:4,dashArray:'7 9'}).bindTooltip('案内候補（サンプル）・実測経路ではありません').addTo(map);
 if(end>0)L.polyline(points.slice(0,end+1),{color:'#008ecd',weight:7}).bindTooltip('通過履歴の表示例（サンプル）').addTo(map);
 L.circleMarker(points[end],{radius:10,color:'#fff',weight:3,fillColor:waiting?'#e39c28':'#007ba7',fillOpacity:1}).bindTooltip(`${trip.id}：${receivingTripState(trip)}（サンプル）`,{permanent:true,direction:'bottom'}).addTo(map);
 }
 map.fitBounds(points.length?points:[from.position,to.position],{padding:[65,65],maxZoom:12});
 const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(canvas.current);
 return()=>{observer.disconnect();map.remove();};
 },[trip.id]);
 return <dialog ref={dialog} className="receiving-track-dialog" aria-labelledby="track-title" onCancel={onClose}><header><div><small>選択した便 · {trip.time} 出発予定</small><h2 id="track-title">{trip.id} 車両の経路・状況</h2></div><button onClick={onClose} autoFocus>タイムラインに戻る</button></header><div className="receiving-track-status"><b>{receivingTripState(trip)}</b><span>{trip.vehicle} / {trip.driver}</span><span>{trip.from} → {trip.to}</span></div><p className="receiving-track-note">走行履歴・位置は表示例です。実GPS未接続のため、実際に通った道・現在位置・位置更新時刻は未取得です。</p><div className="receiving-track-map" ref={canvas} aria-label={`${trip.id}の経路地図（サンプル）`}/><div className="receiving-track-legend"><span>━━ 青：通過履歴の表示例</span><span>┄┄ 灰：案内候補</span><span>●：状態に応じた位置の表示例</span></div>{waiting?<p>搬出現場で出発待ちの表示例です。走行開始前のため通過履歴はありません。</p>:!points.length?<p>この便の経路サンプルは未登録です。出発地と目的地だけ表示しています。</p>:<p>運行中の便は通過区間と残りの候補経路を分けて表示します。道路の通行可否・経路承認を示すものではありません。</p>}<p>実際の走行履歴を表示するには、便IDに紐付くGPS座標・記録時刻の連携が必要です。</p></dialog>;
}
