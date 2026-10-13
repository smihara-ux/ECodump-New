import { DemoNotice } from "../review/Readability.jsx";
import { readMatchingJourney } from "./matchingJourney.mjs";
import { validateMatchingPlan } from "./matchingPlan.mjs";
import { matchingRolePageUrl } from "./matchingRoutes.mjs";
import MatchingPlanForm from "./MatchingPlanForm.jsx";
import { useEffect, useRef, useState } from "react";
import {
  useDemoTrips,
  writeDemoTrips,
  updateDemoTrip,
  demoTrips,
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
export default function DispatchWorkspace({
  navigate,
  navigationReview = false,
  siteOptions,
}) {
  const planningSites = siteOptions?.length ? siteOptions : demoSites;
  const all = useDemoTrips(),
    saved = context(),
    [date, setDate] = useState(saved.date || demoDay()),
    [site, setSite] = useState(saved.field || "すべて"),
    [mode, setMode] = useState("日単位の予定・割当"),
    [adding, setAdding] = useState(() => {
      const value = sessionStorage.getItem("ecodump-dispatch-add") === "1";
      sessionStorage.removeItem("ecodump-dispatch-add");
      return value;
    }),
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
  const [agreement, setAgreement] = useState(() => { try { return readMatchingJourney(localStorage).agreement; } catch { return null; } });
  const [createMethod, setCreateMethod] = useState(() => sessionStorage.getItem("ecodump-matching-plan") ? "matching" : "direct");
  useEffect(() => {
    const refresh = () => { try { setAgreement(readMatchingJourney(localStorage).agreement); } catch { setAgreement(null); } };
    window.addEventListener("ecodump-matching-updated", refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("ecodump-matching-updated", refresh); window.removeEventListener("storage", refresh); };
  }, []);
  useEffect(() => {
    if (navigationReview)
      sessionStorage.setItem(
        "ecodump-construction-schedule-filters",
        JSON.stringify({ ...context(), date, field: site }),
      );
  }, [date, site, navigationReview]);
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
      site = planningSites.find((s) => s.id === f.get("site")),
      loc = demoLocations.find((l) => l.id === f.get("location")),
      count = Number(f.get("count"));
    try {
      if (!site || !loc) throw new Error("搬出元と受入先を選択してください。");
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
          companyId: prev[0]?.companyId || "11000000-0000-4000-8000-000000000001",
          company: demoCompany,
          carrier: demoCarrier,
          vehicleId: "",
          driverId: "",
          vehicle: "未配車",
          driver: "未配車",
          planned: Number(f.get("quantity")),
          unit: f.get("unit"),
          material: f.get("soil"),
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
      writeDemoTrips((prev) => {
        if (prev.some(t => t.copiedFromDate === sourceDate && t.date === copyDate)) throw new Error("同じ対象日のコピーは既にデモへ反映済みです。二重登録しません。");
        const reservationIds = new Map();
        const copied = source.map((t) => {
          const group = `${t.matchAgreementId}:${t.reservationId}`;
          if (t.matchAgreementId && !reservationIds.has(group)) reservationIds.set(group, `MATCH-R-${crypto.randomUUID()}`);
          return {
          ...t,
          id: `NARITA-${crypto.randomUUID()}`,
          reservationId: t.matchAgreementId ? reservationIds.get(group) : `DEMO-R-${crypto.randomUUID()}`,
          ...(t.matchAgreementId ? { matchingRequestKey: `copy-${crypto.randomUUID()}`, vehicleId: "", driverId: "", vehicle: "未配車", driver: "未配車", assignmentHistory: [] } : {}),
          date: copyDate,
          copiedFromDate: sourceDate,
          copiedFrom: t.id,
          assignmentVersion: 1,
          booking: "有効",
          reservation: "申請中",
          operation: !t.matchAgreementId && t.vehicleId ? "配車済み" : "未手配",
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
          };
        });
        const validated = [...prev];
        for (const trip of copied) {
          if (trip.matchAgreementId) validateMatchingPlan(trip.agreementSnapshot, { date: trip.date, count: 1, quantity: trip.planned, unit: trip.unit, soil: trip.material, siteId: trip.siteId, locationId: trip.locationDatabaseId, time: trip.departAt, arrival: trip.arriveAt, requestKey: trip.matchingRequestKey }, validated);
          validated.push(trip);
        }
        return validated;
      });
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
      <DemoNotice />
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
            {planningSites.map(item => (
              <option key={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>
      {navigationReview && (
        <div className="review-actions">
          <button
            className="primary"
            onClick={() => {
              setMode("日単位の予定・割当");
              setAdding(!adding);
            }}
          >
            {adding ? "予定追加を閉じる" : "予定を追加"}
          </button>
          <button
            className="outline"
            onClick={() =>
              setMode(
                mode === "前日・前週からコピー"
                  ? "日単位の予定・割当"
                  : "前日・前週からコピー",
              )
            }
          >
            前日・前週からコピー
          </button>
        </div>
      )}
      <div className="dispatch-mode-switch" hidden={navigationReview}>
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
      {mode === "日単位の予定・割当" && (!navigationReview || adding) && <div className="review-actions" aria-label="予定の作成方法"><button className="outline" aria-pressed={createMethod === "direct"} onClick={() => { setCreateMethod("direct"); sessionStorage.removeItem("ecodump-matching-plan"); }}>既存取引先で直接予定を作る</button><button className="outline" aria-pressed={createMethod === "matching"} onClick={() => setCreateMethod("matching")}>合意済み案件から作る</button></div>}
      {mode === "日単位の予定・割当" && createMethod === "matching" ? ((!navigationReview || adding) && (agreement ? <MatchingPlanForm agreement={agreement} trips={all} onDateChange={value=>{setDate(value);setSite(agreement.sourceSiteName);}} onCancel={() => setAdding(false)} onCreated={created => { setDate(created[0].date); setSite(created[0].departure); setAdding(false); setMessage(`${created.length}便を同じ予約ID ${created[0].reservationId} で申請しました（デモ）。受入承認待ち・未配車です。`); setError(""); }} /> : <p role="status">成立済みの案件がありません。<button className="outline" onClick={() => navigate("UCRマッチング")}>発生土マッチで条件合意へ進む</button></p>)) : mode === "日単位の予定・割当" ? (
        <form
          className="daily-plan-form"
          hidden={navigationReview && !adding}
          onSubmit={create}
        >
          <p className="matching-plan-context">既存取引先への直接予定作成です。登録後も受入側の予約承認が必要です。</p>
          <label>
            搬出元
            <select name="site">
              {planningSites
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
            予定土質<select name="soil"><option>第2種建設発生土</option><option>第1種建設発生土</option><option>第3種建設発生土</option></select>
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
                <td data-label="便ID・状態">
                  {t.id}
                  <small>
                    {t.operation}／{t.tripNo}
                  </small>
                  {t.matchAgreementId && <small>予約：{t.reservation} · 合意 第{t.agreementRevision}版</small>}
                </td>
                <td data-label="現場／受入先">
                  {t.departure}
                  <small>{t.destination}</small>
                </td>
                <td data-label="車番・担当">
                  {t.vehicle}
                  <small>{t.driver}</small>
                </td>
                <td data-label="指定時刻">
                  {t.departAt} → {t.arriveAt}
                </td>
                <td data-label="操作">
                  <button
                    className="outline"
                    onClick={() => setSelected({ ...t })}
                  >
                    {navigationReview ? "詳細・操作" : "割当・変更・取消・履歴"}
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
          navigationReview={navigationReview}
          original={selected}
          current={all.find((t) => t.id === selected.id)}
          vehicles={vehicles}
          close={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function AssignmentEditor({
  original,
  current,
  vehicles,
  close,
  navigationReview = false,
}) {
  const ref = useRef(null),
    [action, setAction] = useState("概要"),
    [cancelConfirmed, setCancelConfirmed] = useState(false),
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
      site = demoSites.find((s) => s.id === draft.siteId) || { id: current.siteId, name: current.departure };
    try {
      if (current.matchAgreementId && current.reservation !== "予約確定") throw new Error("受入側の予約承認後に配車してください。変更依頼中は予約を修正・再申請します。");
      if (current.matchAgreementId && (draft.siteId !== current.siteId || draft.locationId !== current.locationId)) throw new Error("合意した現場・受入先は変更できません。相手を変更する場合は再相談してください。");
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
          reservation: t.matchAgreementId && !t.vehicleId ? t.reservation : "変更依頼",
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
  function resubmit(e) {
    e.preventDefault();
    try {
      const plan = { date: current.date, count: 1, quantity: Number(draft.planned), time: draft.departAt, arrival: draft.arriveAt, unit: current.unit, soil: current.material, siteId: current.siteId, locationId: current.locationDatabaseId, requestKey: `resubmit-${crypto.randomUUID()}` };
      if (!draft.reason.trim()) throw new Error("修正理由を入力してください。");
      updateDemoTrip(current.id, trip => {
        if (trip.reservation !== "変更依頼") throw new Error("変更依頼中の予約だけ再申請できます。");
        validateMatchingPlan(trip.agreementSnapshot, plan, demoTrips().filter(row => row.id !== trip.id));
        return { ...trip, planned: plan.quantity, departAt: plan.time, arriveAt: plan.arrival, receivingScheduledAt: plan.arrival, reservation: "申請中", reason: draft.reason, history: [...trip.history, { at: new Date().toISOString(), message: `施工側が予約を修正・再申請（デモ）：${draft.reason}` }] };
      }, current.assignmentVersion);
      close();
    } catch (issue) { setError(issue.message); }
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
    <dialog
      ref={ref}
      className="review-dialog"
      aria-label={`${original.id} 配車操作`}
      onCancel={close}
    >
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
      {navigationReview && (
        <>
          <div
            className="review-detail-tabs"
            role="tablist"
            aria-label="便の操作"
          >
            {[
              "概要",
              current.vehicleId ? "担当変更" : "割当",
              "取消",
              "履歴",
            ].map((x) => (
              <button
                key={x}
                role="tab"
                aria-selected={action === x}
                className={action === x ? "active" : ""}
                onClick={() => {
                  setAction(x);
                  setCancelConfirmed(false);
                }}
              >
                {x}
              </button>
            ))}
          </div>
          {action === "概要" && (
            <dl className="review-company-facts">
              <dt>現場</dt>
              <dd>{current.departure}</dd>
              <dt>受入先</dt>
              <dd>{current.destination}</dd>
              <dt>車両・ドライバー</dt>
              <dd>
                {current.vehicle}／{current.driver}
              </dd>
              <dt>状態</dt>
              <dd>{current.operation}</dd>
            </dl>
          )}
        </>
      )}
      {locked ? (
        <p>
          確定実績・取消済み便はここで変更できません。訂正権限の業務ルールは別途決定します。
        </p>
      ) : (
        <form
          onSubmit={save}
          hidden={
            navigationReview && !["割当", "担当変更", "取消"].includes(action)
          }
        >
          <div className="review-filter">
            {[
              ["siteId", "搬出現場", demoSites.some(site => site.id === current.siteId) ? demoSites : [...demoSites, {id:current.siteId,name:current.departure}]],
              ["locationId", "受入先", demoLocations],
              ["vehicleId", "車両", vehicles],
              ["driverId", "ドライバー", demoDrivers],
            ]
              .filter(() => !navigationReview || action !== "取消")
              .map(([key, label, list]) => (
                <label key={key}>
                  {label}
                  <select
                    aria-label={label}
                    required
                    disabled={Boolean(current.matchAgreementId) && ["siteId", "locationId"].includes(key)}
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
            {current.matchAgreementId && !current.vehicleId
              ? "承認済み予約に車両・ドライバーを割り当てます。予約承認は保持し、ドライバーは新しい配車版を確認します。"
              : "仮変更は同じブラウザの3画面に反映します。変更後は受入側の再確認とドライバーの配車版確認が必要です。"}実通知は送信しません。
          </p>
          <div className="review-actions">
            {(!navigationReview || action !== "取消") && (
              <button className="primary" disabled={Boolean(current.matchAgreementId) && current.reservation !== "予約確定"}>変更をデモ内に反映（未送信）</button>
            )}
            {(!navigationReview || action === "取消") && (
              <button
                type="button"
                className="outline"
                onClick={() => {
                  if (navigationReview && !cancelConfirmed) {
                    if (!draft.reason.trim()) {
                      setError("取消理由を入力してください。");
                      return;
                    }
                    setCancelConfirmed(true);
                    return;
                  }
                  cancel();
                }}
              >
                {navigationReview && cancelConfirmed
                  ? "この便の取消を確定する（デモ）"
                  : "取消をデモ内に反映"}
              </button>
            )}
            {navigationReview && cancelConfirmed && (
              <p role="alert">
                この便を取り消します。理由と対象便を確認して、もう一度ボタンを押してください。
              </p>
            )}
          </div>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {current.matchAgreementId && <div className="journey-section"><p>搬出案件 {current.sourceCaseId} · 合意 {current.matchAgreementId} 第{current.agreementRevision}版 · 予約 {current.reservation}</p><button className="outline" onClick={() => location.assign(matchingRolePageUrl("receiving", "receiving-reservations", current.id))}>受入側でこの予約を確認</button>{current.reservation === "変更依頼" && <form onSubmit={resubmit} aria-label="予約の修正・再申請"><div className="review-filter"><label>再申請する数量（{current.unit}）<input type="number" min="0.001" step="0.001" required value={draft.planned} onChange={event => setDraft({ ...draft, planned: event.target.value })} /></label><label>再申請の受入指定時刻<input type="time" required value={draft.arriveAt} onChange={event => setDraft({ ...draft, arriveAt: event.target.value })} /></label><label>修正理由<input required value={draft.reason} onChange={event => setDraft({ ...draft, reason: event.target.value })} /></label><button className="primary">修正して予約を再申請（デモ）</button></div></form>}</div>}
      <section hidden={navigationReview && action !== "履歴"}>
        <h3>変更前後・適用日時</h3>
        {current.history.length ? (
          current.history.map((h, i) => (
            <p key={i}>{typeof h === "string" ? h : `${h.at} ${h.message}`}</p>
          ))
        ) : (
          <p>変更なし</p>
        )}
      </section>
    </dialog>
  );
}
