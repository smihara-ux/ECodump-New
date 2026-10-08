import { useState } from "react";
import { demoDay } from "../demo/model.mjs";
const storage = "ecodump-daily-capacity-demo-v1";
export default function DailyCapacity({ locations, trips }) {
  const [date, setDate] = useState(demoDay),
    [locationId, setLocationId] = useState(locations[0]?.id),
    [error, setError] = useState("");
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storage) || "{}");
    } catch {
      return {};
    }
  });
  const key = `${date}:${locationId}`,
    d = settings[key] || { slots: "", quantity: "", unit: "m³", history: [] };
  const rows = trips.filter(
    (t) =>
      t.date === date &&
      t.locationId === locationId &&
      !["取消", "受入不可"].includes(t.reservation),
  );
  const booked = rows.length,
    quantity = rows
      .filter((t) => t.unit === d.unit)
      .reduce((n, t) => n + Number(t.planned || 0), 0);
  function save(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      next = {
        slots: f.get("slots"),
        quantity: f.get("quantity"),
        unit: f.get("unit"),
        history: [
          ...d.history,
          `${new Date().toLocaleString("ja-JP")} 日次便枠 ${f.get("slots") || "未設定"}便／数量枠 ${f.get("quantity") || "未設定"}${f.get("unit")}（未送信）`,
        ],
      };
    try {
      const all = { ...settings, [key]: next };
      localStorage.setItem(storage, JSON.stringify(all));
      setSettings(all);
      setError("");
    } catch {
      setError("保存に失敗しました。入力を残して再確認してください。");
    }
  }
  return (
    <section className="receiving-card daily-capacity">
      <h2>日次の受付枠（ブラウザ内デモ）</h2>
      <p>
        便数枠と数量枠を別々に指定します。置場の物理容量・月間処理能力・契約枠とは別です。締切・混雑色の閾値・罰則は未設定です。
      </p>
      <div className="receiving-toolbar">
        <label>
          対象日
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <label>
          受入場所
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form key={key} onSubmit={save} className="receiving-form-grid">
        <label>
          当日受付の便数枠
          <input
            name="slots"
            type="number"
            min="0"
            step="1"
            defaultValue={d.slots}
            placeholder="未設定"
          />
        </label>
        <label>
          当日受付の数量枠
          <input
            name="quantity"
            type="number"
            min="0"
            step="0.001"
            defaultValue={d.quantity}
            placeholder="未設定"
          />
        </label>
        <label>
          数量の単位
          <select name="unit" defaultValue={d.unit}>
            <option>m³</option>
            <option>t</option>
          </select>
        </label>
        <button className="primary">デモ内で保存（未送信）</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <dl>
        <dt>予約便／実車両</dt>
        <dd>
          {booked}便／
          {
            new Set(rows.filter((t) => t.vehicleId).map((t) => t.vehicleId))
              .size
          }
          台
        </dd>
        <dt>残便枠／超過</dt>
        <dd>
          {d.slots === ""
            ? "便数枠未設定"
            : `${Math.max(0, Number(d.slots) - booked)}便／${Math.max(0, booked - Number(d.slots))}便`}
        </dd>
        <dt>同じ単位の予約数量／残枠／超過</dt>
        <dd>
          {quantity} {d.unit} ／{" "}
          {d.quantity === ""
            ? "数量枠未設定"
            : `${Math.max(0, Number(d.quantity) - quantity)} ${d.unit} ／ ${Math.max(0, quantity - Number(d.quantity))} ${d.unit}`}
        </dd>
      </dl>
      <details>
        <summary>設定履歴 {d.history.length}件</summary>
        {d.history.map((h, i) => (
          <p key={i}>{h}</p>
        ))}
      </details>
    </section>
  );
}
