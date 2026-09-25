import { useCallback, useEffect, useState } from "react";
import { workflowApi } from "./workflowApi";
import "./workflow.css";

const labels = {
  requested: "予約確認待ち",
  confirmed: "予約確定",
  assigned: "配車済み",
  arrived: "現場到着",
  departed: "出発済み",
  unloaded: "荷下ろし完了",
  cancelled: "予約取消",
  rejected: "受入不可",
};
const key = () => crypto.randomUUID();
export default function DirectWorkflowPanel({ role }) {
  const [items, setItems] = useState([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const load = useCallback(async (throwOnFailure = false) => {
    try {
      const result = await workflowApi.list(role);
      setItems(result.data);
      setError("");
    } catch (e) {
      setError("隔離APIに接続できません。ローカル統合環境で確認してください。");
      if (throwOnFailure === true) throw e;
    }
  }, [role]);
  useEffect(() => {
    load();
  }, [load]);
  const run = async (fn) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await load(true);
      setMessage("DB保存後の再取得を確認しました。");
    } catch (e) {
      setError(`${e.message}${e.code ? `（${e.code}）` : ""}`);
    } finally {
      setBusy(false);
    }
  };
  const item = items[0],
    r = item?.reservation,
    t = item?.trip,
    trips = item?.trips || (t ? [t] : []);
  return (
    <section className="direct-workflow" aria-label="直接予約の共通API連携">
      <header>
        <div>
          <span>旧SQLite検証 · 共通PostgreSQLとは別データ</span>
          <h2>マッチングを経由しない運搬</h2>
        </div>
        <button onClick={load} disabled={busy}>
          再取得
        </button>
      </header>
      <p>今回の試験運用確認は <a href={`/?data=isolated&role=${role}`}>共通PostgreSQLの運搬画面</a> を使用してください。この旧検証パネルの記録は共有されません。</p>
      {error && (
        <p className="workflow-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="workflow-success" role="status">
          {message}
        </p>
      )}
      {!r && role === "construction" && (
        <button
          className="workflow-primary"
          disabled={busy}
          onClick={() =>
            run(() =>
              workflowApi.create(
                {
                  siteId: "site-01",
                  receivingLocationId: "location-01",
                  plannedAt: new Date(Date.now() + 86400000).toISOString(),
                  soilType: "第2種建設発生土",
                  plannedQuantity: 8,
                  unit: "m3",
                },
                key(),
              ),
            )
          }
        >
          搬出予定・搬入予約をDBへ登録
        </button>
      )}
      {!r && role !== "construction" && (
        <p>施工側からの予約登録を待っています。</p>
      )}
      {r && (
        <>
          <div className="workflow-status">
            <b>{labels[r.status] || r.status}</b>
            <span>
              予約 {r.id.slice(0, 8)} · v{r.version}
            </span>
            {trips.map((trip) => (
              <span className="workflow-trip" key={trip.id}>
                <b>{labels[trip.status] || trip.status}</b>
                運行 {trip.id.slice(0, 8)} · {trip.rotation_no}便目 · v
                {trip.version}
              </span>
            ))}
          </div>
          <div className="workflow-actions">
            {role === "receiving" && r.status === "requested" && (
              <>
                <button
                  className="workflow-primary"
                  disabled={busy}
                  onClick={() =>
                    run(() => workflowApi.confirm(r.id, r.version, key()))
                  }
                >
                  予約を確認して確定
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      workflowApi.unavailable(
                        r.id,
                        r.version,
                        "受入条件を満たさないため",
                        key(),
                      ),
                    )
                  }
                >
                  受入不可を報告
                </button>
              </>
            )}
            {role === "construction" && r.status === "confirmed" && (
              <button
                className="workflow-primary"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    workflowApi.assign(
                      r.id,
                      r.version,
                      key(),
                      trips.length + 1,
                    ),
                  )
                }
              >
                {trips.length
                  ? "同じ車両で次便を追加"
                  : "車両・ドライバーを割り当て"}
              </button>
            )}
            {role === "construction" && r.status === "requested" && (
              <button
                disabled={busy}
                onClick={() =>
                  run(() =>
                    workflowApi.changeReservation(
                      r.id,
                      r.version,
                      {
                        plannedQuantity: r.planned_quantity + 1,
                        reason: "試験運用で予定数量を変更",
                      },
                      key(),
                    ),
                  )
                }
              >
                予定数量を変更
              </button>
            )}
            {role === "construction" &&
              !["cancelled", "rejected"].includes(r.status) &&
              !trips.some((trip) => trip.status !== "assigned") && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      workflowApi.cancelReservation(
                        r.id,
                        r.version,
                        "試験運用で予約を取消",
                        key(),
                      ),
                    )
                  }
                >
                  予約を取消
                </button>
              )}
            {role === "construction" && t?.status === "assigned" && (
              <button
                disabled={busy}
                onClick={() =>
                  run(() => workflowApi.reassign(t.id, t.version, key()))
                }
              >
                配車を変更
              </button>
            )}
            {role === "driver" && t && t.status === "assigned" && (
              <>
                <button
                  className="workflow-primary"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      workflowApi.report(t.id, t.version, "arrived", key()),
                    )
                  }
                >
                  到着を報告
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() => workflowApi.delay(t.id, t.version, key()))
                  }
                >
                  30分の遅延を報告
                </button>
              </>
            )}
            {role === "driver" && t?.status === "arrived" && (
              <button
                className="workflow-primary"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    workflowApi.report(t.id, t.version, "departed", key()),
                  )
                }
              >
                出発を報告
              </button>
            )}
            {role === "driver" && t?.status === "departed" && (
              <button
                className="workflow-primary"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    workflowApi.report(t.id, t.version, "unloaded", key()),
                  )
                }
              >
                荷下ろし完了を報告
              </button>
            )}
            {role === "receiving" &&
              t?.status === "unloaded" &&
              !item.receipt && (
                <button
                  className="workflow-primary"
                  disabled={busy}
                  onClick={() =>
                    run(() => workflowApi.receipt(t.id, t.version, 7.8, key()))
                  }
                >
                  実績数量 7.8m³を確認・確定
                </button>
              )}
          </div>
          {item.receipt && (
            <div className="workflow-complete">
              <p>
                受入実績
                {item.receipt.status === "corrected" ? "訂正済み" : "確定"}：
                {item.receipt.actual_quantity}
                {item.receipt.unit}。施工側・受入側の双方から再取得できます。
              </p>
              {role === "receiving" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      workflowApi.correctReceipt(
                        item.receipt.id,
                        item.receipt.version,
                        Number(item.receipt.actual_quantity) - 0.1,
                        "計量票の再確認",
                        key(),
                      ),
                    )
                  }
                >
                  数量を訂正
                </button>
              )}
            </div>
          )}
        </>
      )}
      <small>
        更新ごとに冪等キーとversionを検証します。結果不明時は同じ更新を再送せず処理結果照会APIを使用します。
      </small>
    </section>
  );
}
