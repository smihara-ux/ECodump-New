import { useEffect, useRef, useState } from "react";
import {
  useDemoTrips,
  writeDemoTrips,
  updateDemoTrip,
  demoNotice,
} from "./store.jsx";
import {
  demoSites,
  demoLocations,
  demoDrivers,
  demoCarrier,
  demoCompany,
  demoDay,
  dayOffset,
} from "./model.mjs";
import { readVehicles } from "./VehicleWorkspace.jsx";
const context = () => {
  try {
    return JSON.parse(
      sessionStorage.getItem("ecodump-construction-schedule-filters") || "{}",
    );
  } catch {
    return {};
  }
};
export default function DispatchWorkspace({ navigate }) {
  const all = useDemoTrips(),
    saved = context(),
    [date, setDate] = useState(saved.date || demoDay()),
    [site, setSite] = useState(saved.field || "すべて"),
    [mode, setMode] = useState("日単位の予定・割当"),
    [selected, setSelected] = useState(() => {
      const id = sessionStorage.getItem("ecodump-dispatch-focus");
      sessionStorage.removeItem("ecodump-dispatch-focus");
      return all.find((t) => t.id === id) || null;
    }),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [copyDate, setCopyDate] = useState(dayOffset(demoDay(), 1)),
    [sourceDate, setSourceDate] = useState(demoDay()),
    [copyConfirmed, setCopyConfirmed] = useState(false);
  const rows = all.filter(
    (t) => t.date === date && (site === "すべて" || t.departure === site),
  );
  const vehicles = readVehicles();
  const source = all.filter(
    (t) =>
      t.date === sourceDate &&
      t.booking !== "取消" &&
      (site === "すべて" || t.departure === site),
  );
  function create(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      site = demoSites.find((s) => s.id === f.get("site")),
      loc = demoLocations.find((l) => l.id === f.get("location")),
      count = Number(f.get("count"));
    try {
      writeDemoTrips((prev) => [
        ...prev,
        ...Array.from({ length: count }, (_, i) => ({
          id: `NARITA-${crypto.randomUUID()}`,
          reservationId: `DEMO-R-${crypto.randomUUID()}`,
          date,
          siteId: site.id,
          departure: site.name,
          locationId: loc.id,
          locationDatabaseId: loc.databaseId,
          destination: loc.name,
          companyId: prev[0].companyId,
          company: demoCompany,
          carrier: demoCarrier,
          vehicleId: "",
          driverId: "",
          vehicle: "未配車",
          driver: "未配車",
          planned: Number(f.get("quantity")),
          unit: f.get("unit"),
          material: "第2種建設発生土",
          departAt: f.get("time"),
          arriveAt: f.get("arrival"),
          siteScheduledAt: f.get("time"),
          receivingScheduledAt: f.get("arrival"),
          booking: "有効",
          reservation: "申請中",
          reception: "未到着",
          operation: "未手配",
          assignmentVersion: 1,
          reported: null,
          confirmed: null,
          departed: null,
          unloaded: null,
          received: null,
          slip: "未提出",
          issue: "なし",
          agreement: "成田モデル条件 v1（デモ）",
          history: [
            {
              at: new Date().toISOString(),
              message: `日次予定 ${i + 1}/${count} 作成（未送信）`,
            },
          ],
        })),
      ]);
      setMessage(`${count}便をブラウザ内デモに追加しました。未送信です。`);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function copy() {
    try {
      if (sourceDate === copyDate)
        throw new Error("コピー元と保存対象日は別の日にしてください。");
      if (
        all.some((t) => t.copiedFromDate === sourceDate && t.date === copyDate)
      )
        throw new Error(
          "同じ対象日のコピーは既にデモへ反映済みです。二重登録しません。",
        );
      writeDemoTrips((prev) => [
        ...prev,
        ...source.map((t) => ({
          ...t,
          id: `NARITA-${crypto.randomUUID()}`,
          reservationId: `DEMO-R-${crypto.randomUUID()}`,
          date: copyDate,
          copiedFromDate: sourceDate,
          copiedFrom: t.id,
          assignmentVersion: 1,
          booking: "有効",
          reservation: "申請中",
          operation: t.vehicleId ? "配車済み" : "未手配",
          reception: "未到着",
          reported: null,
          confirmed: null,
          actual: "",
          received: null,
          departed: null,
          unloaded: null,
          slip: "未提出",
          ticketId: null,
          driverStage: undefined,
          driverInitialStage: undefined,
          actualDestination: null,
          history: [
            {
              at: new Date().toISOString(),
              message: `${t.id}から予定のみコピー（実績・伝票は引継がない／未送信）`,
            },
          ],
        })),
      ]);
      setMessage(
        `${source.length}便を${copyDate}へ仮コピーしました。休業日・受入可否は未確認です。`,
      );
      setDate(copyDate);
      setCopyConfirmed(false);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="construction-page dispatch-page">
      <p className="review-note">{demoNotice}</p>
      <div className="construction-hero">
        <div>
          <h2>配車・運行管理</h2>
          <p>現場・日付を保持して、予定便・未手配・担当変更を管理します。</p>
        </div>
        <button
          className="outline"
          onClick={() => {
            sessionStorage.setItem(
              "ecodump-construction-schedule-filters",
              JSON.stringify({ ...context(), date, field: site }),
            );
            navigate("搬出・受入スケジュール");
          }}
        >
          搬出管理へ戻る
        </button>
      </div>
      <div className="review-filter operation-sticky-controls">
        <label>
          対象日
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <label>
          現場
          <select value={site} onChange={(e) => setSite(e.target.value)}>
            <option>すべて</option>
            {demoSites.map((s) => (
              <option key={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="dispatch-mode-switch">
        {["日単位の予定・割当", "前日・前週からコピー"].map((m) => (
          <button
            role="tab"
            aria-selected={mode === m}
            key={m}
            className={mode === m ? "active" : ""}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
      {mode === "日単位の予定・割当" ? (
        <form className="daily-plan-form" onSubmit={create}>
          <label>
            搬出元
            <select name="site">
              {demoSites
                .filter((s) => site === "すべて" || s.name === site)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            受入先
            <select name="location">
              {demoLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            予定便数
            <input
              required
              name="count"
              type="number"
              min="1"
              max="20"
              defaultValue="1"
            />
          </label>
          <label>
            1便の予定数量
            <input
              required
              name="quantity"
              type="number"
              min="0.001"
              step="0.001"
              defaultValue="7"
            />
          </label>
          <label>
            単位
            <select name="unit">
              <option>m³</option>
              <option>t</option>
            </select>
          </label>
          <label>
            現場指定時刻
            <input required name="time" type="time" defaultValue="08:30" />
          </label>
          <label>
            受入指定時刻
            <input required name="arrival" type="time" defaultValue="10:00" />
          </label>
          <button className="primary">デモ内に予定を追加（未送信）</button>
        </form>
      ) : (
        <section className="weekly-copy-panel">
          <div className="review-filter">
            <label>
              コピー元日
              <input
                type="date"
                value={sourceDate}
                onChange={(e) => {
                  setSourceDate(e.target.value);
                  setCopyConfirmed(false);
                }}
              />
            </label>
            <label>
              保存対象日
              <input
                type="date"
                value={copyDate}
                onChange={(e) => {
                  setCopyDate(e.target.value);
                  setCopyConfirmed(false);
                }}
              />
            </label>
          </div>
          <p>
            対象 {source.length}便 · 実車両{" "}
            {
              new Set(source.filter((t) => t.vehicleId).map((t) => t.vehicleId))
                .size
            }
            台
          </p>
          <p>
            コピー対象は予定だけです。実績・伝票・確認状態は引き継ぎません。休業日・受入可否・同時刻の重複は担当者が確認してください。
          </p>
          <label>
            <input
              type="checkbox"
              checked={copyConfirmed}
              onChange={(e) => setCopyConfirmed(e.target.checked)}
            />
            対象日・便・受入先を確認しました
          </label>
          <button
            className="primary"
            disabled={!copyConfirmed || !source.length}
            onClick={copy}
          >
            確認して下書きへ反映
          </button>
        </section>
      )}
      <div className="construction-kpis">
        <article>
          <span>有効予定便</span>
          <b>{rows.filter((t) => t.booking !== "取消").length}便</b>
        </article>
        <article>
          <span>未手配便</span>
          <b>
            {rows.filter((t) => !t.vehicleId && t.booking !== "取消").length}便
          </b>
        </article>
        <article>
          <span>手配済み便</span>
          <b>
            {rows.filter((t) => t.vehicleId && t.booking !== "取消").length}便
          </b>
        </article>
        <article>
          <span>実車両</span>
          <b>
            {
              new Set(
                rows
                  .filter((t) => t.vehicleId && t.booking !== "取消")
                  .map((t) => t.vehicleId),
              ).size
            }
            台
          </b>
        </article>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="results-table-wrap">
        <table className="service-table">
          <thead>
            <tr>
              <th>便ID・状態</th>
              <th>現場／受入先</th>
              <th>車番・担当</th>
              <th>指定時刻</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.id}
                  <small>
                    {t.operation}／{t.tripNo}
                  </small>
                </td>
                <td>
                  {t.departure}
                  <small>{t.destination}</small>
                </td>
                <td>
                  {t.vehicle}
                  <small>{t.driver}</small>
                </td>
                <td>
                  {t.departAt} → {t.arriveAt}
                </td>
                <td>
                  <button
                    className="outline"
                    onClick={() => setSelected({ ...t })}
                  >
                    割当・変更・取消・履歴
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>対象便はありません。</p>}
      </div>
      {selected && (
        <AssignmentEditor
          original={selected}
          current={all.find((t) => t.id === selected.id)}
          vehicles={vehicles}
          close={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function AssignmentEditor({ original, current, vehicles, close }) {
  const ref = useRef(null),
    [draft, setDraft] = useState({ ...original, reason: "" }),
    [error, setError] = useState("");
  useEffect(() => {
    ref.current.showModal();
    return () => ref.current?.close();
  }, []);
  const locked = current.confirmed != null || current.booking === "取消";
  function save(e) {
    e.preventDefault();
    const vehicle = vehicles.find((v) => v.id === draft.vehicleId),
      driver = demoDrivers.find((d) => d.id === draft.driverId),
      loc = demoLocations.find((l) => l.id === draft.locationId),
      site = demoSites.find((s) => s.id === draft.siteId);
    try {
      if (!draft.reason.trim()) throw new Error("変更理由を入力してください。");
      updateDemoTrip(
        original.id,
        (t) => ({
          ...t,
          vehicleId: vehicle.id,
          vehicle: vehicle.number,
          vehicleName: vehicle.name,
          driverId: driver.id,
          driver: driver.name,
          siteId: site.id,
          departure: site.name,
          locationId: loc.id,
          locationDatabaseId: loc.databaseId,
          destination: loc.name,
          assignmentVersion: t.assignmentVersion + 1,
          reservation: "変更依頼",
          reason: draft.reason,
          operation: t.operation === "未手配" ? "配車済み" : t.operation,
          assignmentHistory: [
            ...(t.assignmentHistory || []),
            {
              at: new Date().toISOString(),
              date: t.date,
              reason: draft.reason,
              before: {
                vehicleId: t.vehicleId,
                vehicle: t.vehicle,
                driverId: t.driverId,
                driver: t.driver,
                from: t.departure,
                to: t.destination,
                version: t.assignmentVersion,
              },
              after: {
                vehicleId: vehicle.id,
                vehicle: vehicle.number,
                driverId: driver.id,
                driver: driver.name,
                from: site.name,
                to: loc.name,
                version: t.assignmentVersion + 1,
              },
            },
          ],
          history: [
            ...t.history,
            {
              at: new Date().toISOString(),
              message: `配車版${t.assignmentVersion}→${t.assignmentVersion + 1}：${t.vehicle}／${t.driver}／${t.departure}→${t.destination} から ${vehicle.number}／${driver.name}／${site.name}→${loc.name}。理由：${draft.reason}。適用：${t.date} ${t.departAt}便（未送信）`,
            },
          ],
        }),
        original.assignmentVersion,
      );
      close();
    } catch (e) {
      setError(e.message);
    }
  }
  function cancel() {
    try {
      if (!draft.reason.trim()) throw new Error("取消理由を入力してください。");
      updateDemoTrip(
        original.id,
        (t) => ({
          ...t,
          booking: "取消",
          reservation: "取消",
          operation: "取消",
          assignmentVersion: t.assignmentVersion + 1,
          history: [
            ...t.history,
            {
              at: new Date().toISOString(),
              message: `取消（未送信）：${draft.reason}`,
            },
          ],
        }),
        original.assignmentVersion,
      );
      close();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <dialog ref={ref} className="review-dialog" onCancel={close}>
      <header>
        <h2>{original.id} 割当・変更・履歴</h2>
        <button onClick={close} aria-label="割当編集を閉じる">
          ×
        </button>
      </header>
      <p>
        配車版 {original.assignmentVersion} ／ 予定 {original.date}{" "}
        {original.departAt}
      </p>
      {locked ? (
        <p>
          確定実績・取消済み便はここで変更できません。訂正権限の業務ルールは別途決定します。
        </p>
      ) : (
        <form onSubmit={save}>
          <div className="review-filter">
            {[
              ["siteId", "搬出現場", demoSites],
              ["locationId", "受入先", demoLocations],
              ["vehicleId", "車両", vehicles],
              ["driverId", "ドライバー", demoDrivers],
            ].map(([key, label, list]) => (
              <label key={key}>
                {label}
                <select
                  aria-label={label}
                  required
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                >
                  <option value="">選択してください</option>
                  {list.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.number || v.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              変更・取消理由
              <textarea
                required
                value={draft.reason}
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              />
            </label>
          </div>
          <p>
            仮変更は同じブラウザの3画面に反映します。変更後は受入側の再確認とドライバーの配車版確認が必要です。実通知は送信しません。
          </p>
          <div className="review-actions">
            <button className="primary">変更をデモ内に反映（未送信）</button>
            <button type="button" className="outline" onClick={cancel}>
              取消をデモ内に反映
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <h3>変更前後・適用日時</h3>
      {current.history.length ? (
        current.history.map((h, i) => (
          <p key={i}>{typeof h === "string" ? h : `${h.at} ${h.message}`}</p>
        ))
      ) : (
        <p>変更なし</p>
      )}
    </dialog>
  );
}
