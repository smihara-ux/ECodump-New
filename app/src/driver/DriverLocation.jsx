import {useEffect,useState} from 'react';
import {locationState} from './locationState.mjs';
export default function DriverLocation(){
 const [fix,setFix]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(id);},[]);
 function acquire(){if(busy)return;if(!navigator.geolocation){setError('このブラウザは位置取得を利用できません。');return;}setBusy(true);setError('');navigator.geolocation.getCurrentPosition(p=>{setFix({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp});setNow(Date.now());setBusy(false);},e=>{setError(e.code===1?'位置情報の利用が許可されていません。':e.code===3?'取得が時間内に完了しませんでした。':'現在地を取得できません。');setBusy(false);},{enableHighAccuracy:false,timeout:12000,maximumAge:0});}
 return <section className="connected-card"><h2>位置情報</h2><p>端末GPS：<strong>{locationState(fix,busy,error,now)}</strong></p><p>最終取得：{fix?new Date(fix.timestamp).toLocaleString('ja-JP'):'なし'}</p>{fix&&<p>端末から取得した位置：{fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)}<br/>精度の目安：±{Math.round(fix.accuracy)}m</p>}{error&&<p role="alert">{error}</p>}<button className="secondary" disabled={busy} onClick={acquire}>{busy?'端末で取得中…':'現在地を端末で確認'}</button><small>位置はこの画面だけに表示し、管理側には送信しません。取得から5分を超えると「古い」と表示します（検証用の目安）。模擬位置・ナビ・到着見込みは表示しません。</small></section>;
}
