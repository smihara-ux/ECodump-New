import { draftStore } from "../driver/documents/draftStore.mjs";
import { cloneElement, useEffect, useId, useRef, useState } from "react";
import { transitionTrip, soils } from "../receiving-model.mjs";
import { matchingRolePageUrl } from "../demo/matchingRoutes.mjs";
import { validateMatchingPlan } from "../demo/matchingPlan.mjs";
import { useReceivingView } from "./viewState";
import {
  reservationStep,
  reservationErrors,
  reviewedValuesMatch,
  displayReservationHistory,
} from "./reservationWorkflow.mjs";
const tabs = [
  ["conditions", "予約条件"],
  ["reception", "受付"],
  ["receipt", "伝票・数量"],
  ["history", "履歴"],
];
function Definitions({ items }) {
  return (
    <dl className="receiving-definitions">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
function InputField({ label, error, hint, children }) {
  const id = useId();
  return (
    <label className="receiving-field">
      <span>{label}</span>
      {cloneElement(children, {
        "aria-label": label,
        "aria-describedby": error || hint ? id : undefined,
      })}
      {error ? (
        <small id={id} className="receiving-field-error">
          {error}
        </small>
      ) : hint ? (
        <small id={id}>{hint}</small>
      ) : null}
    </label>
  );
}
function LocalReceiptPreview({ trip }) {
  const [entry, setEntry] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setEntry(null);
    setError("");
    draftStore(`demo-receipt:${trip.driverId}:${trip.date}:${trip.id}`)
      .then((value) => {
        if (active) setEntry(value?.history?.at(-1) || null);
      })
      .catch(() => {
        if (active) setError("端末内の原票写真を読み込めません。");
      });
    return () => {
      active = false;
    };
  }, [trip.id, trip.date, trip.driverId, trip.reported, trip.ticketId]);
  return (
    <details className="receiving-local-receipt">
      <summary>原票写真を確認（同じブラウザ内のデモ）</summary>
      {error ? (
        <p>{error}</p>
      ) : entry?.photo ? (
        <>
          <img
            src={`data:${entry.photo.mime};base64,${entry.photo.base64}`}
            alt="ドライバーが端末に保存した原票写真"
          />
          <p>
            伝票 {entry.number} · {entry.quantity}{" "}
            {entry.unit === "m3" ? "m³" : "t"} · 未送信の表示例
          </p>
        </>
      ) : (
        <p>
          この便の原票写真は同じブラウザ内に提出されていません。数量のサンプル表示と原票写真は別です。
        </p>
      )}
    </details>
  );
}

export default function ReservationDetail({ trip: t, m, navigate }) {
  const step = reservationStep(t),
    prefix = useId(),
    firstError = useRef(null);
  const [view, update] = useReceivingView(
    `demo:detail:${t.date}:${t.id}:${t.assignmentVersion}`,
    {
      panel: step.panel,
      reason: t.differenceReason || t.reason || "",
      eta: t.eta,
      planned: t.planned,
      actual: t.actual,
      actualSoil: t.actualSoil || t.soil,
    },
  );
  const { reason, eta, planned, actual, actualSoil } = view;
  const panel = tabs.some(([key]) => key === view.panel)
    ? view.panel
    : step.panel;
  const [error, setError] = useState(""),
    [fieldErrors, setFieldErrors] = useState({}),
    [confirming, setConfirming] = useState(false),
    [ending, setEnding] = useState("");
  const location = m.locations.find((l) => l.id === t.locationId);
  const terminal =
    t.receipt === "実績確定" || ["受入不可", "取消"].includes(t.reservation);
  const change = (key, value) => {
    update({ [key]: value });
    setConfirming(false);
    setEnding("");
    setError("");
    setFieldErrors((previous) => ({ ...previous, [key]: "" }));
  };
  const choose = (key) => {
    update({ panel: key });
    setConfirming(false);
    setEnding("");
    setError("");
    setFieldErrors({});
  };
  const input = { reason, eta, planned, actual, actualSoil, unit: t.unit };
  const act = (action) => {
    const errors = reservationErrors(t, input, action);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError(Object.values(errors).join(" "));
      requestAnimationFrame(() =>
        firstError.current?.querySelector('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    try {
      m.setTrips((prev) =>
        prev.map((row) => {
          if (row.id !== t.id) return row;
          if (row.assignmentVersion !== t.assignmentVersion)
            throw new Error(
              "別の画面で便が変更されました。最新の内容を確認してください。",
            );
          if (row.matchAgreementId && ["approve", "resubmit"].includes(action))
            validateMatchingPlan(
              row.agreementSnapshot,
              {
                date: row.date,
                count: 1,
                quantity: Number(action === "resubmit" ? planned : row.planned),
                unit: row.unit,
                soil: row.soil,
                siteId: row.siteId,
                locationId: row.locationDatabaseId,
                time: row.departAt,
                arrival: action === "resubmit" ? eta : row.eta,
                requestKey: `review-${crypto.randomUUID()}`,
              },
              prev.filter((item) => item.id !== row.id),
            );
          if (action === "confirm" && !reviewedValuesMatch(row, input))
            throw new Error(
              "入力内容が変わっています。受入内容をもう一度確認してください。",
            );
          return transitionTrip(row, action, input);
        }),
      );
      setError("");
      setConfirming(false);
      setEnding("");
      m.setNotice(
        "状態を試作内で変更しました。DB保存・通知・相手への送信はしていません。",
      );
      if (action === "driver-report") update({ panel: "receipt" });
      else if (["approve", "resubmit"].includes(action))
        update({ panel: action === "approve" ? "reception" : "conditions" });
      else if (["cancel", "reject"].includes(action))
        update({ panel: "history" });
    } catch (err) {
      setError(err.message);
    }
  };
  const reasonField = (
    <InputField
      label="判断・変更・差異の理由"
      error={fieldErrors.reason}
      hint="変更依頼・受入不可・取消・遅延・数量や土質の差異がある場合に入力してください。"
    >
      <textarea
        aria-invalid={!!fieldErrors.reason}
        value={reason}
        onChange={(e) => change("reason", e.target.value)}
      />
    </InputField>
  );
  const otherActions = !terminal && (
    <details className="receiving-other-actions">
      <summary>その他の操作（変更・取消など）</summary>
      <div className="receiving-actions">
        {t.reservation === "申請中" && (
          <button onClick={() => act("change")}>変更依頼（試作）</button>
        )}
        {t.reservation === "予約確定" && t.reception === "未到着" && (
          <button onClick={() => act("delay")}>
            遅延・到着予定を反映（試作）
          </button>
        )}
        {!t.driverReport && (
          <button
            onClick={() => {
              if (!reason.trim()) {
                setFieldErrors({ reason: "理由を入力してください。" });
                setError("受入不可の理由を入力してください。");
              } else setEnding("reject");
            }}
          >
            受入不可（理由必須）
          </button>
        )}
        {t.reception === "未到着" && (
          <button
            onClick={() => {
              if (!reason.trim()) {
                setFieldErrors({ reason: "理由を入力してください。" });
                setError("予約取消の理由を入力してください。");
              } else setEnding("cancel");
            }}
          >
            予約取消（理由必須）
          </button>
        )}
      </div>
    </details>
  );
  const receiptInfo = (
    <Definitions
      items={[
        ["予定数量 / 土質", `${t.planned} ${t.unit} / ${t.soil}`],
        [
          "ドライバー報告数量",
          t.reported == null
            ? "未提出"
            : `${t.reported} ${t.reportedUnit || t.unit}`,
        ],
        ["伝票番号", t.ticketId || "未提出"],
        [
          "受入側の確認数量 / 土質",
          t.actual === ""
            ? "未確認"
            : `${t.actual} ${t.unit} / ${t.actualSoil}`,
        ],
        [
          "ドライバー荷下ろし報告",
          t.driverReport ? "報告済み（サンプル）・実績確定とは別" : "未報告",
        ],
      ]}
    />
  );
  return (
    <>
      <button
        onClick={() => {
          m.setSelectedTrip(null);
          if (m.returnPage && m.returnPage !== "搬入予約・受付")
            navigate?.(m.returnPage);
        }}
      >
        {m.returnPage === "受入実績・帳票"
          ? "← 受入実績へ戻る"
          : m.returnPage === "搬出・受入スケジュール"
            ? "← 受入管理へ戻る"
            : "← 予約一覧へ"}
      </button>
      <article className="receiving-card receiving-detail" ref={firstError}>
        <div className="receiving-heading">
          <div>
            <small>
              {t.reservationId} · {t.source}
            </small>
            <h2>
              {t.id} /{" "}
              {t.vehicleId
                ? `車両 第${t.rotation || t.sequence || "—"}便`
                : "未配車の予定便"}
            </h2>
            <p>
              {t.date} {t.eta} · {t.site} → {location?.name}
            </p>
          </div>
          <span className="receiving-badge">{t.reservation}</span>
        </div>
        <div className="receiving-state-grid">
          {[
            ["条件合意", t.agreement],
            ["予約", t.reservation],
            ["運行", t.tripStatus],
            ["受入実績", t.receipt],
          ].map(([key, value]) => (
            <div key={key}>
              <small>{key}</small>
              <b>{value}</b>
            </div>
          ))}
        </div>
        <div
          className="receiving-next-action"
          aria-label="現在の状態と次の対応"
        >
          <b>{step.state}</b>
          <span>
            対応：{step.owner} · 次：{step.next}
          </span>
          <p>{step.hint}</p>
          {panel !== step.panel && (
            <button onClick={() => choose(step.panel)}>
              対応箇所を開く：{tabs.find(([key]) => key === step.panel)?.[1]}
            </button>
          )}
        </div>
        <div
          className="receiving-detail-tabs"
          role="tablist"
          aria-label="予約詳細の項目"
        >
          {tabs.map(([key, label], i) => (
            <button
              key={key}
              id={`${prefix}-${key}-tab`}
              role="tab"
              aria-selected={panel === key}
              aria-controls={`${prefix}-${key}`}
              tabIndex={panel === key ? 0 : -1}
              onClick={() => choose(key)}
              onKeyDown={(e) => {
                let target;
                if (e.key === "ArrowRight") target = (i + 1) % tabs.length;
                if (e.key === "ArrowLeft")
                  target = (i + tabs.length - 1) % tabs.length;
                if (e.key === "Home") target = 0;
                if (e.key === "End") target = tabs.length - 1;
                if (target != null) {
                  e.preventDefault();
                  choose(tabs[target][0]);
                  document
                    .getElementById(`${prefix}-${tabs[target][0]}-tab`)
                    ?.focus();
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <section
          role="tabpanel"
          id={`${prefix}-${panel}`}
          aria-labelledby={`${prefix}-${panel}-tab`}
          className="receiving-reservation-panel"
        >
          {panel === "conditions" && (
            <>
              <h3>予約条件</h3>
              <Definitions
                items={[
                  ["搬入日・到着予定", `${t.date} ${t.eta}`],
                  ["搬出元 / 取引先", `${t.site} / ${t.partner}`],
                  ["受入場所", location?.name],
                  ["予定数量 / 土質", `${t.planned} ${t.unit} / ${t.soil}`],
                ]}
              />
              {t.matchAgreementId && (
                <div className="receiving-private">
                  <b>同じ成立案件からの予約</b>
                  <p>
                    搬出案件 {t.sourceCaseId} · 受入案件 {t.targetCaseId}
                  </p>
                  <p>
                    合意 {t.matchAgreementId} 第{t.agreementRevision}版 · 相談{" "}
                    {t.consultationId}
                  </p>
                  <p>
                    合意期間 {t.agreementSnapshot.terms.start}〜
                    {t.agreementSnapshot.terms.end} · 土質{" "}
                    {t.agreementSnapshot.terms.soil}
                  </p>
                  <div className="receiving-actions">
                    <button
                      onClick={() =>
                        window.location.assign(
                          matchingRolePageUrl("receiving", "matching", t.id),
                        )
                      }
                    >
                      この案件の成立内容へ戻る
                    </button>
                    <button
                      onClick={() => {
                        sessionStorage.setItem("ecodump-dispatch-focus", t.id);
                        sessionStorage.setItem(
                          "ecodump-construction-schedule-filters",
                          JSON.stringify({ date: t.date, field: t.site }),
                        );
                        window.location.assign(
                          matchingRolePageUrl("construction", "dispatch"),
                        );
                      }}
                    >
                      施工側で予定・配車を確認
                    </button>
                  </div>
                </div>
              )}
              {!terminal && (
                <>
                  <div className="receiving-form-grid">
                    {reasonField}
                    {t.reservation === "変更依頼" && (
                      <>
                        <InputField
                          label="到着予定の変更"
                          error={fieldErrors.eta}
                        >
                          <input
                            type="time"
                            value={eta}
                            aria-invalid={!!fieldErrors.eta}
                            onChange={(e) => change("eta", e.target.value)}
                          />
                        </InputField>
                        <InputField
                          label={`変更後の予定数量（${t.unit}）`}
                          error={fieldErrors.planned}
                        >
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={planned}
                            aria-invalid={!!fieldErrors.planned}
                            onChange={(e) => change("planned", e.target.value)}
                          />
                        </InputField>
                      </>
                    )}
                  </div>
                  <div className="receiving-primary-actions">
                    {t.reservation === "申請中" && (
                      <>
                        <button
                          className="primary"
                          disabled={!t.agreement}
                          onClick={() => act("approve")}
                        >
                          予約を承認（試作）
                        </button>
                        {!t.agreement && (
                          <p>条件合意を確認してから予約を承認できます。</p>
                        )}
                      </>
                    )}
                    {t.reservation === "変更依頼" && !t.matchAgreementId && (
                      <button
                        className="primary"
                        onClick={() => act("resubmit")}
                      >
                        変更内容で再申請を試す
                      </button>
                    )}
                  </div>
                  {otherActions}
                </>
              )}
            </>
          )}
          {panel === "reception" && (
            <>
              <h3>受付</h3>
              <Definitions
                items={[
                  ["搬入日・到着予定", `${t.date} ${t.eta}`],
                  ["車両 / ドライバー", `${t.vehicle} / ${t.driver}`],
                  ["入口", location?.entrance],
                  ["受付状態", t.reception],
                  [
                    "ドライバー荷下ろし報告",
                    t.driverReport
                      ? "報告済み（サンプル）・実績確定とは別"
                      : "未報告",
                  ],
                  ["遅延", t.delay || "なし"],
                ]}
              />
              {!terminal && (
                <>
                  <div className="receiving-form-grid">
                    {reasonField}
                    {t.reception === "未到着" && (
                      <InputField
                        label="到着予定の変更"
                        error={fieldErrors.eta}
                      >
                        <input
                          type="time"
                          aria-invalid={!!fieldErrors.eta}
                          value={eta}
                          onChange={(e) => change("eta", e.target.value)}
                        />
                      </InputField>
                    )}
                  </div>
                  <div className="receiving-primary-actions">
                    {t.reservation === "予約確定" &&
                      t.reception === "未到着" && (
                        <button
                          className="primary"
                          onClick={() => act("arrive")}
                        >
                          到着受付（試作）
                        </button>
                      )}
                    {t.reception === "待機" && (
                      <button className="primary" onClick={() => act("start")}>
                        受入開始（試作）
                      </button>
                    )}
                    {t.reception === "受入中" && (
                      <div className="receiving-private">
                        <h3>ドライバー報告の受信を試す</h3>
                        <p>
                          実際のアプリとは未接続です。このボタンは外部報告のサンプルを反映するだけで、受入実績を確定しません。
                        </p>
                        <button onClick={() => act("driver-report")}>
                          荷下ろし完了のサンプル報告を反映
                        </button>
                      </div>
                    )}
                  </div>
                  {otherActions}
                </>
              )}
            </>
          )}
          {panel === "receipt" && (
            <>
              <h3>伝票・数量</h3>
              {receiptInfo}
              <LocalReceiptPreview trip={t} />
              {t.driverReport && !terminal ? (
                <>
                  <p>
                    予定・ドライバー報告・受入側の確認値を照合してください。単位の自動換算は行いません。
                  </p>
                  <div className="receiving-form-grid">
                    <InputField
                      label={`実績数量（${t.unit}）`}
                      error={fieldErrors.actual}
                    >
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={actual}
                        aria-invalid={!!fieldErrors.actual}
                        onChange={(e) => change("actual", e.target.value)}
                      />
                    </InputField>
                    <InputField label="確認した土質">
                      <select
                        value={actualSoil}
                        onChange={(e) => change("actualSoil", e.target.value)}
                      >
                        {soils.map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </InputField>
                    {reasonField}
                  </div>
                  <div className="receiving-primary-actions">
                    <button
                      className={reviewedValuesMatch(t, input) ? "" : "primary"}
                      onClick={() => act("review")}
                    >
                      受入内容を確認（試作）
                    </button>
                    {t.receipt === "内容確認済み" && (
                      <>
                        <button
                          className="primary"
                          disabled={!reviewedValuesMatch(t, input)}
                          onClick={() => setConfirming(true)}
                        >
                          実績確定の確認へ
                        </button>
                        {!reviewedValuesMatch(t, input) && (
                          <p>
                            入力内容が変わっています。「受入内容を確認」で再確認してください。
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  {confirming && (
                    <div
                      className="receiving-confirm"
                      role="group"
                      aria-label="実績確定の確認"
                    >
                      <b>
                        確認済み数量 {t.actual} {t.unit} / {t.actualSoil}
                      </b>
                      <p>
                        この確認済み値を試作内で確定します。正式な受入証明は発行されません。
                      </p>
                      <div className="receiving-actions">
                        <button
                          className="primary"
                          onClick={() => act("confirm")}
                        >
                          この内容で実績確定を試す
                        </button>
                        <button onClick={() => setConfirming(false)}>
                          戻る
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : t.receipt === "実績確定" ? (
                <div className="receiving-private">
                  <h3>実績確定（試作）</h3>
                  <p>
                    {t.actual} {t.unit} · {t.confirmedBy} · {t.confirmedAt}
                  </p>
                  <p>正式記録は未保存です。確定後の訂正申請は未実装です。</p>
                </div>
              ) : (
                <p>
                  荷下ろし完了報告後に受入数量を確認できます。現在：
                  {t.reception}
                </p>
              )}
            </>
          )}
          {panel === "history" && (
            <>
              <h3>履歴</h3>
              <Definitions
                items={[
                  ["判断理由", t.reason || "—"],
                  ["差異理由", t.differenceReason || "—"],
                ]}
              />
              <details open>
                <summary>この試作内の操作履歴</summary>
                <ul>
                  {t.history.map((entry, i) => (
                    <li key={i}>{displayReservationHistory(entry)}</li>
                  ))}
                </ul>
                {!t.history.length && <p>操作履歴はありません。</p>}
              </details>
            </>
          )}
          {ending && (
            <div
              className="receiving-confirm"
              role="group"
              aria-label="予約終了の確認"
            >
              <h3>{ending === "cancel" ? "予約取消" : "受入不可"}の確認</h3>
              <p>
                対象：{t.id} · {t.site} → {location?.name}
              </p>
              <p>理由：{reason}</p>
              <p>終了後はこの予約の受付を進められません。履歴は残ります。</p>
              <div className="receiving-actions">
                <button onClick={() => act(ending)}>
                  理由を確認して{ending === "cancel" ? "予約取消" : "受入不可"}
                  にする（試作）
                </button>
                <button onClick={() => setEnding("")}>終了せず戻る</button>
              </div>
            </div>
          )}
          {error && (
            <p className="receiving-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </article>
    </>
  );
}
