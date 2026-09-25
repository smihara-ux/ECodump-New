import { useState } from "react";
import "./receivingConnected.css";

// The caller supplies the authenticated mutation and its concurrency token.
// This form never changes the displayed persisted result optimistically.
export default function ReceivingActualForm({ plannedQuantity, unit, busy, onConfirm }) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const amount = Number(quantity);
  const different = amount !== Number(plannedQuantity);
  const valid = quantity.trim() !== "" && Number.isFinite(amount) && amount > 0 && (!different || reason.trim());
  const displayUnit = unit === "m3" ? "m³" : unit;
  return <form className="receiving-actual-form" onSubmit={(event) => {
    event.preventDefault();
    if (valid && reviewed && !busy) onConfirm({ quantity: amount, unit, differenceReason: reason.trim() });
  }}>
    <h3>受入実績の確認</h3>
    <p>ドライバーは荷下ろし完了を報告済みです。受入実績は、内容を確認して確定するまで未確定です。</p>
    <p>予定数量：<strong>{plannedQuantity} {displayUnit}</strong></p>
    <label className="receiving-field">実績数量（{displayUnit}）
      <input type="number" min="0.001" step="0.001" required value={quantity} disabled={busy} onChange={(event) => { setQuantity(event.target.value); setReviewed(false); }} />
    </label>
    <label className="receiving-field">予定との差異理由{different ? "（必須）" : "（任意）"}
      <textarea required={different} maxLength={1000} value={reason} disabled={busy} onChange={(event) => { setReason(event.target.value); setReviewed(false); }} />
    </label>
    <label className="receiving-actual-review"><input type="checkbox" checked={reviewed} disabled={busy || !valid} onChange={(event) => setReviewed(event.target.checked)} />数量・単位・差異理由を確認しました</label>
    <button type="submit" className="workflow-primary" disabled={busy || !valid || !reviewed}>受入実績を確定</button>
  </form>;
}
