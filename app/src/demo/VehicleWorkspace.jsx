import { useEffect, useRef, useState } from "react";
import { useDemoTrips, demoNotice } from "./store.jsx";
import { demoVehicles, demoDrivers, demoCarrier, demoDay } from "./model.mjs";
const key = "ecodump-preview-vehicles-v1";
export function readVehicles() {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || demoVehicles;
  } catch {
    return demoVehicles;
  }
}
export default function VehicleWorkspace({ query, setQuery }) {
  const trips = useDemoTrips(),
    [rows, setRows] = useState(readVehicles),
    [expired, setExpired] = useState(false),
    [selected, setSelected] = useState(null),
    [editing, setEditing] = useState(null),
    [error, setError] = useState("");
  const visible = rows.filter(
    (v) =>
      `${v.number} ${v.name} ${v.company}`.includes(query) &&
      (!expired || (v.expires && v.expires < demoDay())),
  );
  function save(record) {
    try {
      const next = rows.some((r) => r.id === record.id)
        ? rows.map((r) => (r.id === record.id ? record : r))
        : [...rows, record];
      localStorage.setItem(key, JSON.stringify(next));
      setRows(next);
      setEditing(null);
      setError("");
    } catch {
      setError(
        "車両を端末に保存できません。添付サイズ・ブラウザ設定を確認してください。",
      );
    }
  }
  return (
    <section className="vehicle-page">
      <p className="review-note">
        {demoNotice}{" "}
        車番・所属会社・最大積載量・車検期限を台帳として管理します。運行状態は便一覧で確認します。
      </p>
      <div className="review-filter">
        <label>
          車番・車両名・所属会社
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="review-check">
          <input
            type="checkbox"
            checked={expired}
            onChange={(e) => setExpired(e.target.checked)}
          />
          車検期限切れのみ
        </label>
        <button
          className="outline"
          onClick={() => {
            setQuery("");
            setExpired(false);
          }}
        >
          検索条件をクリア
        </button>
        <button
          className="primary"
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              name: "",
              number: "",
              kind: "大型ダンプ",
              capacity: "",
              company: demoCarrier,
              expires: "",
              driverId: "",
              attachment: null,
            })
          }
        >
          車両情報を登録
        </button>
      </div>
      <p>検索結果：{visible.length}件</p>
      <div className="results-table-wrap">
        <table className="service-table">
          <thead>
            <tr>
              {[
                "車番・車両名",
                "所属会社",
                "種別・最大積載量",
                "車検期限・証明書",
                "通常担当候補",
                "操作",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((v) => (
              <tr key={v.id}>
                <td>
                  <b>{v.number}</b>
                  <small>{v.name}</small>
                </td>
                <td>{v.company}</td>
                <td>
                  {v.kind}
                  <small>{v.capacity}</small>
                </td>
                <td>
                  {v.expires || "未設定"}
                  {v.expires && v.expires < demoDay() && (
                    <strong>期限切れ</strong>
                  )}
                  <small>{v.attachment?.name || "車検証未添付"}</small>
                </td>
                <td>
                  {demoDrivers.find((d) => d.id === v.driverId)?.name ||
                    "未設定"}
                </td>
                <td>
                  <button className="outline" onClick={() => setEditing(v)}>
                    編集・車検証
                  </button>
                  <button className="outline" onClick={() => setSelected(v.id)}>
                    運転手情報・履歴
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p className="empty-state">該当する車両はありません。</p>
        )}
      </div>
      {editing && (
        <VehicleEditor
          record={editing}
          save={save}
          error={error}
          close={() => {
            setEditing(null);
            setError("");
          }}
        />
      )}
      {selected && (
        <VehicleHistory
          vehicle={rows.find((v) => v.id === selected)}
          trips={trips}
          close={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function VehicleEditor({ record, save, error, close }) {
  const ref = useRef(null),
    [draft, setDraft] = useState(record),
    [localError, setError] = useState("");
  useEffect(() => {
    ref.current.showModal();
    return () => ref.current?.close();
  }, []);
  async function attach(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (
      !["image/jpeg", "image/png", "application/pdf"].includes(f.type) ||
      f.size > 2 * 1024 * 1024
    ) {
      setError(
        "JPEG・PNG・PDF、2MB以下を選択してください。HEIC変換・OCRは未接続です。",
      );
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = () => {
        setDraft((d) => ({
          ...d,
          attachment: { name: f.name, url: reader.result },
        }));
        setError("");
      };
      reader.readAsDataURL(f);
    } catch {
      setError("ファイルを読み込めません。");
    }
  }
  return (
    <dialog ref={ref} className="review-dialog" onCancel={close}>
      <header>
        <h2>車両情報・車検証</h2>
        <button onClick={close} aria-label="車両編集を閉じる">
          ×
        </button>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(draft);
        }}
      >
        <div className="review-filter">
          {[
            ["number", "車番"],
            ["name", "車両名"],
            ["company", "所属会社"],
            ["kind", "種別"],
            ["capacity", "最大積載量"],
          ].map(([k, label]) => (
            <label key={k}>
              {label}
              <input
                required
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            </label>
          ))}
          <label>
            車検有効期限
            <input
              required
              type="date"
              value={draft.expires}
              onChange={(e) => setDraft({ ...draft, expires: e.target.value })}
            />
          </label>
          <label>
            通常の担当候補
            <select
              value={draft.driverId}
              onChange={(e) => setDraft({ ...draft, driverId: e.target.value })}
            >
              <option value="">未設定</option>
              {demoDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            車検証の写真・PDF（2MB以下）
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={attach}
            />
          </label>
        </div>
        {draft.attachment && (
          <p>
            <a href={draft.attachment.url} download={draft.attachment.name}>
              {draft.attachment.name}を確認
            </a>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, attachment: null })}
            >
              添付を外す
            </button>
          </p>
        )}
        <p>
          OCR・HEIC変換は未接続です。最大積載量・期限は手入力で確認してください。台帳編集で過去便の車番・担当者は変えません。
        </p>
        {(error || localError) && <p role="alert">{error || localError}</p>}
        <button className="primary">デモ内で登録・保存</button>
      </form>
    </dialog>
  );
}
function VehicleHistory({ vehicle, trips, close }) {
  const ref = useRef(null),
    [from, setFrom] = useState(demoDay),
    [to, setTo] = useState(demoDay);
  useEffect(() => {
    ref.current.showModal();
    return () => ref.current?.close();
  }, []);
  const rows = trips
    .filter((t) => t.date >= from && t.date <= to)
    .flatMap((t) => [
      ...(t.vehicleId === vehicle.id ? [t] : []),
      ...(t.assignmentHistory || [])
        .filter((h) => h.before.vehicleId === vehicle.id)
        .map((h, i) => ({
          ...t,
          id: `${t.id}（変更前 ${i + 1}）`,
          vehicle: h.before.vehicle,
          driver: h.before.driver,
          assignmentVersion: h.before.version,
          departure: h.before.from,
          destination: h.before.to,
          tripNo: "変更前の割当",
          history: [
            {
              at: h.at,
              message: `終了：${h.reason}。変更後 ${h.after.vehicle}／${h.after.driver}。当時の割当を保存。`,
            },
          ],
        })),
    ]);
  return (
    <dialog ref={ref} className="review-dialog" onCancel={close}>
      <header>
        <h2>{vehicle.number} 運転手情報・運行履歴</h2>
        <button onClick={close} aria-label="車両履歴を閉じる">
          ×
        </button>
      </header>
      <div className="review-filter">
        <label>
          開始日
          <input
            type="date"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
          />
        </label>
        <label>
          終了日
          <input
            type="date"
            min={from}
            value={to}
            onChange={(e) => e.target.value && setTo(e.target.value)}
          />
        </label>
      </div>
      <p>
        当時の車番・担当者・配車版を表示します。現在の台帳とは別の記録です。
      </p>
      {rows.map((t) => (
        <article key={t.id}>
          <h3>
            {t.date} {t.id} · {t.tripNo}
          </h3>
          <p>
            {t.vehicle} ／ {t.driver} ／ 配車版 {t.assignmentVersion}
            <br />
            {t.departure} → {t.destination}
          </p>
          <details>
            <summary>変更履歴 {t.history.length}件</summary>
            {t.history.map((h, i) => (
              <p key={i}>
                {typeof h === "string" ? h : `${h.at} ${h.message}`}
              </p>
            ))}
          </details>
        </article>
      ))}
      {!rows.length && <p>対象期間の便なし</p>}
    </dialog>
  );
}
