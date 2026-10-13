import { useEffect, useRef, useState } from "react";
import { demoDay } from "./model.mjs";
import { readMatchingJourney } from "./matchingJourney.mjs";
import { createMatchingPlanTrips } from "./matchingPlan.mjs";
import { writeDemoTrips } from "./store.jsx";

export default function MatchingPlanForm({ agreement, trips, onCreated, onCancel, onDateChange }) {
  const [date, setDate] = useState(demoDay() > agreement.terms.start ? demoDay() : agreement.terms.start);
  const [count, setCount] = useState(2), [quantity, setQuantity] = useState(7);
  const [error, setError] = useState("");
  const requestKey = useRef(crypto.randomUUID());
  useEffect(() => { onDateChange?.(date); }, [date]);
  const active = trips.filter(trip => trip.matchAgreementId === agreement.id && trip.booking !== "取消" && trip.reservation !== "受入不可");
  const remaining = agreement.terms.volume - active.reduce((sum, trip) => sum + trip.planned, 0);
  return <form className="daily-plan-form matching-plan-form" aria-label="合意済み案件の予定作成" onSubmit={event => {
    event.preventDefault();
    try {
      const latest = readMatchingJourney(localStorage).agreement;
      if (!latest || latest.id !== agreement.id || latest.revision !== agreement.revision) throw new Error("案件の状態が変わりました。マッチング画面で最新の成立内容を確認してください。");
      const fields = new FormData(event.currentTarget);
      const plan = { requestKey: requestKey.current, date, count: Number(count), quantity: Number(quantity), time: fields.get("time"), arrival: fields.get("arrival"), unit: agreement.terms.unit, soil: agreement.terms.soil, siteId: agreement.sourceSiteId, locationId: agreement.targetLocationId };
      let created;
      writeDemoTrips(previous => { created = createMatchingPlanTrips(agreement, plan, previous); return [...previous, ...created]; });
      setError("");
      onCreated(created);
    } catch (issue) { setError(issue.message); }
  }}>
    <div className="matching-plan-context"><h3>合意済み案件から予定を作る</h3><p>{agreement.id} · 第{agreement.revision}版</p><p>{agreement.sourceSiteName} → {agreement.targetLocationName}</p><p>{agreement.terms.soil} · 総量 {agreement.terms.volume.toLocaleString()} {agreement.terms.unit} · 残予定量 {remaining.toLocaleString()} {agreement.terms.unit}</p><p>{agreement.terms.start}〜{agreement.terms.end} · 日別上限 {agreement.terms.daily} {agreement.terms.unit}/日</p><small>現場・受入先・土質・単位は合意内容を引き継ぎます。別の相手に変更する場合は再相談してください。</small></div>
    <label>搬入日<input type="date" required min={agreement.terms.start} max={agreement.terms.end} value={date} onChange={event => setDate(event.target.value)} /></label>
    <label>予定便数<input type="number" min="1" max="20" step="1" required value={count} onChange={event => setCount(event.target.value)} /></label>
    <label>1便の予定数量（{agreement.terms.unit}）<input type="number" min="0.001" step="0.001" required value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
    <label>現場指定時刻<input type="time" name="time" defaultValue="08:30" required /></label>
    <label>受入指定時刻<input type="time" name="arrival" defaultValue="10:00" required /></label>
    <p className="matching-plan-context">{Number(count) || 0}便 × {Number(quantity) || 0} {agreement.terms.unit} = {(Number(count) * Number(quantity) || 0).toLocaleString()} {agreement.terms.unit}。作成後は「予約申請中・未配車」です。受入側の承認は別の操作です。</p>
    {error && <p className="matching-plan-context" role="alert">{error}</p>}
    <button className="primary">予定を作成して予約申請（デモ）</button><button type="button" className="outline" onClick={onCancel}>入力を閉じる</button>
  </form>;
}
