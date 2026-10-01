import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, FileSpreadsheet, Truck, X } from "lucide-react";
import { addDays, constructionTrips, matchesTripState, summarizeTrips, todayJst } from "./operationsModel.mjs";
import { downloadOperationsWorkbook } from "../reports/exportWorkbook.mjs";
import "./constructionOperations.css";

const storageKey = "ecodump-construction-schedule-filters";
const readSaved = () => { try { return JSON.parse(sessionStorage.getItem(storageKey) || "{}"); } catch { return {}; } };
const fmt = (date) => new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeZone: "Asia/Tokyo" }).format(new Date(`${date}T12:00:00+09:00`));
const value = (number) => number == null ? "未報告" : Number(number).toFixed(1);

function TripDetail({ trip, close }) {
  const dialogRef = useRef(null);
  useEffect(()=>{const node=dialogRef.current;node.showModal();return()=>node.close();},[]);
  const events = [
    ["現場指定", trip.siteScheduledAt], ["搬出出発", trip.departed], ["受入指定", trip.receivingScheduledAt],
    ["荷下ろし報告", trip.unloaded], ["受入確認", trip.received],
  ];
  return <dialog ref={dialogRef} className="construction-trip-dialog" aria-labelledby="trip-detail-title" onCancel={close}>
      <header><div><small>同一運行ID</small><h2 id="trip-detail-title">{trip.id} 運行詳細</h2></div><button onClick={close} aria-label="運行詳細を閉じる"><X/></button></header>
      <div className="trip-detail-state"><span>予約：{trip.booking}</span><span>運行：{trip.operation}</span><span>受入確認：{trip.received ? "確認済み" : "未確認"}</span><span>伝票：{trip.slip}</span></div>
      <dl className="trip-detail-facts"><div><dt>搬出現場</dt><dd>{trip.departure}</dd></div><div><dt>受入先</dt><dd>{trip.destination}</dd></div><div><dt>運送会社</dt><dd>{trip.carrier}</dd></div><div><dt>車両／ドライバー</dt><dd>{trip.vehicle}／{trip.driver}</dd></div></dl>
      <section><h3>時系列・報告</h3><ol className="trip-event-list">{events.map(([label,time])=><li key={label} className={time?"done":"pending"}><b>{label}</b><time>{time || "未報告"}</time></li>)}</ol></section>
      <section className="trip-detail-grid"><article><h3>伝票</h3><p>{trip.ticketId || "原本伝票は未提出です。"}</p><small>共有デモではファイルStorage未接続です。</small></article><article><h3>問題</h3><p>{trip.issue}</p></article><article><h3>訂正履歴</h3><p>{trip.correctionHistory}</p></article></section>
      <button className="outline" onClick={close}>一覧へ戻る</button>
  </dialog>;
}

function QuantityCards({ summary, period = "当日の数量" }) {
  return <div className="construction-quantity-grid">{summary.quantities.map((row)=><article key={row.unit} className={row.remaining<0?"over":""}><header><b>{row.unit}</b><span>{period}</span></header><dl><div><dt>予定</dt><dd>{row.planned.toFixed(1)}</dd></div><div><dt>報告</dt><dd>{row.reported.toFixed(1)}</dd></div><div><dt>受入確定</dt><dd>{row.confirmed.toFixed(1)}</dd></div><div><dt>未完了の残予定</dt><dd>{row.remaining.toFixed(1)}</dd></div><div><dt>確定便の予定差異</dt><dd>{row.variance > 0 ? "+" : ""}{row.variance.toFixed(1)}</dd></div></dl>{row.remaining<0&&<p>予定超過 {Math.abs(row.remaining).toFixed(1)} {row.unit}</p>}</article>)}</div>;
}

export function ConstructionTransportPage({ plans, navigate, initialField="すべて" }) {
  const saved = readSaved();
  const today = todayJst();
  const allTrips = useMemo(()=>constructionTrips(plans,today),[plans,today]);
  const [date,setDate]=useState(saved.date||today), [field,setField]=useState(initialField!=="すべて"?initialField:saved.field||"すべて");
  const [destination,setDestination]=useState(saved.destination||"すべて"), [query,setQuery]=useState(saved.keyword||"");
  const [state,setState]=useState(saved.operationStatus||"すべて"), [view,setView]=useState(saved.view||"現場別"), [selected,setSelected]=useState(null);
  const listRef=useRef(null);
  useEffect(()=>sessionStorage.setItem(storageKey,JSON.stringify({date,field,destination,keyword:query,operationStatus:state,view,scrollTop:document.querySelector(".content")?.scrollTop||0})),[date,field,destination,query,state,view]);
  useEffect(()=>{const top=Number(readSaved().scrollTop||0);requestAnimationFrame(()=>document.querySelector(".content")?.scrollTo({top}));},[]);
  const baseRows=allTrips.filter((trip)=>trip.date===date&&(field==="すべて"||trip.departure===field)&&(destination==="すべて"||trip.destination===destination)&&(!query||`${trip.id}${trip.departure}${trip.destination}${trip.carrier}${trip.vehicle}${trip.driver}`.includes(query)));
  const rows=baseRows.filter((trip)=>matchesTripState(trip,state));
  const summary=summarizeTrips(baseRows);
  const groups=Object.entries(rows.reduce((out,trip)=>{const key=view==="現場別"?trip.departure:trip.destination;(out[key]??=[]).push(trip);return out;},{}));
  const selectState=(next)=>setState(current=>current===next?"すべて":next);
  const openResults=()=>{sessionStorage.setItem("ecodump-construction-results-filters",JSON.stringify({dateFrom:date,dateTo:date,field,destination,state,query}));sessionStorage.setItem(storageKey,JSON.stringify({...readSaved(),date,field,destination,keyword:query,operationStatus:state,view,scrollTop:document.querySelector(".content")?.scrollTop||0}));navigate("実績・帳票");};
  return <section className="transport-page construction-transport-v2">
    <div className="construction-actions"><button className="primary" onClick={()=>navigate("配車・運行管理")}>予定を作る</button><button className="outline" onClick={()=>navigate("配車・運行管理")}>今日の車両を見る</button><button className="outline" onClick={openResults}>伝票を確認する</button></div>
    <div className="construction-date-nav" aria-label="対象日を選択"><button onClick={()=>setDate(addDays(date,-1))}><ChevronLeft/>前日</button><button className={date===today?"active":""} onClick={()=>setDate(today)}>今日<span>{fmt(today)}</span></button><button onClick={()=>setDate(addDays(date,1))}>翌日<ChevronRight/></button><label><CalendarDays/>カレンダー<input aria-label="搬出管理の対象日" type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></label></div>
    <div className="transport-toolbar"><label>現場<select value={field} onChange={e=>setField(e.target.value)}><option>すべて</option>{[...new Set(allTrips.map(x=>x.departure))].map(x=><option key={x}>{x}</option>)}</select></label><label>受入先<select value={destination} onChange={e=>setDestination(e.target.value)}><option>すべて</option>{[...new Set(allTrips.map(x=>x.destination))].map(x=><option key={x}>{x}</option>)}</select></label><label>検索<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="便・現場・車両・ドライバー"/></label><div className="view-switch">{["現場別","受入場所別"].map(x=><button key={x} className={view===x?"active":""} onClick={()=>setView(x)}>{x}</button>)}</div><button className="primary" onClick={openResults}>搬出実績を見る</button></div>
    <div className="construction-progress-grid">{[["有効な予定便",summary.active,"有効予定"],["未搬出便",summary.notDeparted,"未搬出"],["搬出済み・受入未完了",summary.exportedPending,"搬出済み・受入未完了"],["受入完了便",summary.received,"受入完了"],["取消便",summary.cancelled,"取消"]].map(([label,count,key])=><button key={key} className={state===key?"active":""} onClick={()=>selectState(key)}><span>{label}</span><b>{count}<small>便</small></b></button>)}</div>
    <QuantityCards summary={summary}/>
    <div className="construction-plan-total"><b>現場全体の総搬出計画量・残計画量</b><span>数量基準が未設定のため算出していません。</span></div>
    <div className="construction-trip-list" ref={listRef}>{groups.map(([name,trips])=><section className="construction-trip-group" key={name}><header><h2>{name}</h2><span>{trips.length}便／実車両 {new Set(trips.map(x=>x.vehicle)).size}台</span></header><div className="construction-trip-table"><div className="trip-row trip-head"><span>便・状態</span><span>現場／受入先</span><span>運送会社・車両・運転手</span><span>予定／実績時刻</span><span>受入・伝票</span><span>操作</span></div>{trips.map(trip=><article className="trip-row" key={trip.id}><div><b>{trip.id}</b><small>{trip.tripNo} · {trip.operation}</small></div><div><b>{trip.departure}</b><small>{trip.destination}</small></div><div><b>{trip.carrier}</b><small>{trip.vehicle} · {trip.driver}</small></div><div><b>指定 {trip.siteScheduledAt}／{trip.receivingScheduledAt}</b><small>出発 {trip.departed||"未報告"} · 荷下ろし {trip.unloaded||"未報告"}</small></div><div><b>{trip.received?`確認済み ${trip.received}`:"受入未確認"}</b><small>伝票 {trip.slip}</small></div><div><button className="outline" onClick={()=>setSelected(trip)}>運行詳細</button></div><details><summary>補足情報</summary><p>土質：{trip.material}／予定 {trip.planned} {trip.unit}／報告 {value(trip.reported)}／受入確定 {value(trip.confirmed)}／問題：{trip.issue}</p></details></article>)}</div></section>)}{!rows.length&&<div className="empty-state"><b>対象便はありません</b><span>日付または絞り込み条件を変更してください。</span></div>}</div>
    {selected&&<TripDetail trip={selected} close={()=>setSelected(null)}/>}<p className="construction-data-boundary">共有デモ：画面内の匿名サンプルです。保存・送信は行いません。API接続時は同じ便IDの担当範囲をサーバー側で検証します。</p>
  </section>;
}

export function ConstructionResultsPage({ plans, navigate }) {
  const saved=(()=>{try{return JSON.parse(sessionStorage.getItem("ecodump-construction-results-filters")||"{}");}catch{return{};}})();
  const today=todayJst(), all=useMemo(()=>constructionTrips(plans,today),[plans,today]);
  const [dateFrom,setDateFrom]=useState(saved.dateFrom||today),[dateTo,setDateTo]=useState(saved.dateTo||today),[field,setField]=useState(saved.field||"すべて"),[destination,setDestination]=useState(saved.destination||"すべて"),[state,setState]=useState(saved.state||"すべて"),[query,setQuery]=useState(saved.query||"");
  const rows=all.filter(x=>x.date>=dateFrom&&x.date<=dateTo&&(field==="すべて"||x.departure===field)&&(destination==="すべて"||x.destination===destination)&&matchesTripState(x,state)&&(!query||`${x.id}${x.departure}${x.destination}${x.carrier}${x.vehicle}${x.driver}`.includes(query)));
  const summary=summarizeTrips(rows);
  useEffect(()=>sessionStorage.setItem("ecodump-construction-results-filters",JSON.stringify({dateFrom,dateTo,field,destination,state,query})),[dateFrom,dateTo,field,destination,state,query]);
  const exportExcel=()=>downloadOperationsWorkbook({filename:`搬出実績_${dateFrom}_${dateTo}`,title:"ECO DUMP 搬出実績",conditions:{期間:`${dateFrom}〜${dateTo}`,現場:field,受入先:destination,状態:state,検索:query||"指定なし"},summaryRows:[["対象便数","便",rows.length],...["m³","t"].flatMap(unit=>{const q=summary.quantities.find(x=>x.unit===unit);return [["予定数量",unit,q.planned],["報告数量",unit,q.reported],["受入確定数量",unit,q.confirmed],["未完了の残予定",unit,q.remaining],["確定便の予定差異",unit,q.variance]];})],detailHeaders:["対象日","便番号","往復","現場","受入先","運送会社","車両番号","ドライバー","単位","予定数量","報告数量","受入確定数量","搬出出発","荷下ろし報告","受入確認","伝票状態"],detailRows:rows.map(x=>[x.date,x.id,x.tripNo,x.departure,x.destination,x.carrier,x.vehicle,x.driver,x.unit,x.planned,x.reported??"未報告",x.confirmed??"未確定",x.departed||"未報告",x.unloaded||"未報告",x.received||"未確認",x.slip])});
  return <section className="construction-page results-page construction-results-v2"><div className="construction-hero"><div><span>RESULTS & REPORTS</span><h2>搬出実績</h2><p>予定・報告・受入確定を分け、画面と同じ対象便をExcelへ出力します。</p></div><button className="primary" disabled={!rows.length} onClick={exportExcel}><FileSpreadsheet/>Excel帳票</button></div><div className="results-filter"><label>開始日<input type="date" value={dateFrom} onChange={e=>{if(e.target.value){setDateFrom(e.target.value);if(e.target.value>dateTo)setDateTo(e.target.value);}}}/></label><label>終了日<input type="date" value={dateTo} min={dateFrom} onChange={e=>e.target.value&&setDateTo(e.target.value<dateFrom?dateFrom:e.target.value)}/></label><label>現場<select value={field} onChange={e=>setField(e.target.value)}><option>すべて</option>{[...new Set(all.map(x=>x.departure))].map(x=><option key={x}>{x}</option>)}</select></label><label>受入先<select value={destination} onChange={e=>setDestination(e.target.value)}><option>すべて</option>{[...new Set(all.map(x=>x.destination))].map(x=><option key={x}>{x}</option>)}</select></label><label>検索<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="便・現場・車両・ドライバー"/></label><label>状態<select value={state} onChange={e=>setState(e.target.value)}>{["すべて","有効予定","未搬出","搬出済み・受入未完了","受入完了","取消"].map(x=><option key={x}>{x}</option>)}</select></label><button className="outline" onClick={()=>navigate("搬出・受入スケジュール")}>搬出管理へ戻る</button></div><div className="construction-kpis"><article><span>対象便</span><b>{rows.length}<small>便</small></b></article><article><span>受入完了</span><b>{summary.received}<small>便</small></b></article><article className="warning"><span>未確定</span><b>{rows.filter(x=>x.confirmed==null&&x.booking!=="取消").length}<small>便</small></b></article><article><span>取消</span><b>{summary.cancelled}<small>便</small></b></article></div><QuantityCards summary={summary} period={`${dateFrom}〜${dateTo} の数量`}/><div className="results-table-wrap"><table className="service-table"><thead><tr>{["対象日","便番号","現場／受入先","予定","報告","受入確定","状態","伝票"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{x.date}</td><td>{x.id}<small>{x.tripNo}</small></td><td>{x.departure}<small>{x.destination}</small></td><td>{x.planned} {x.unit}</td><td>{x.reported==null?"未報告":`${x.reported} ${x.unit}`}</td><td>{x.confirmed==null?"未確定":`${x.confirmed} ${x.unit}`}</td><td>{x.booking==="取消"?"取消":x.operation}</td><td>{x.slip}</td></tr>)}</tbody></table>{!rows.length&&<div className="empty-state">対象便はありません。</div>}</div><p className="results-accounting-note">Excelは実体のある.xlsx形式で、集計・便別明細の2シートです。m³とtは換算せず、未確定数量を確定合計に含めません。残予定は未完了便の予定数量、予定差異は確定した便の実績−予定です。</p></section>;
}
