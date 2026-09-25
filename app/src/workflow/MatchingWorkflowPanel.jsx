import { useCallback, useEffect, useState } from "react";
import { workflowApi } from "./workflowApi";
import "./matching-workflow.css";

const op = () => crypto.randomUUID();
const blank = (role) => ({
  ownerSide: role,
  title: "",
  region: "",
  soilType: "第2種建設発生土",
  quantity: 100,
  unit: "m3",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  public: { summary: "" },
  shared: { conditions: "" },
  internal: { memo: "" },
  documents: [],
});
export default function MatchingWorkflowPanel({ role }) {
  const [tab, setTab] = useState("探す"),
    [data, setData] = useState({
      ownCases: [],
      searchResults: [],
      consultations: [],
      agreements: [],
    }),
    [filters, setFilters] = useState({
      region: "",
      soil: "",
      quantity: "",
      start: "",
      end: "",
    }),
    [form, setForm] = useState(() => blank(role)),
    [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setData((await workflowApi.matching(role, filters)).data);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [role, filters]);
  useEffect(() => {
    setForm(blank(role));
    load();
  }, [role, load]);
  const run = async (fn, msg) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      setNotice(msg);
    } catch (e) {
      setError(`${e.message}${e.code ? `（${e.code}）` : ""}`);
    } finally {
      setBusy(false);
    }
  };
  const ownPublished = data.ownCases.find((c) => c.status === "published");
  return (
    <section className="matching-live" aria-label="共通発生土マッチAPI">
      <header>
        <div>
          <span>隔離検証API・共通DB</span>
          <h2>発生土マッチ</h2>
          <p>
            適合度・距離は未計算のため表示しません。検索結果は入力条件との一致だけで絞り込みます。
          </p>
        </div>
        <button onClick={load}>再取得</button>
      </header>
      <nav>
        {["探す", "自社の案件", "相談・条件調整", "成立済み"].map((v) => (
          <button
            key={v}
            className={tab === v ? "active" : ""}
            onClick={() => setTab(v)}
          >
            {v}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="matching-live-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="matching-live-notice">
          {notice}
        </p>
      )}
      {tab === "探す" && (
        <>
          <div className="matching-live-filters">
            <input
              aria-label="地域"
              placeholder="地域"
              value={filters.region}
              onChange={(e) =>
                setFilters({ ...filters, region: e.target.value })
              }
            />
            <input
              aria-label="土質"
              placeholder="土質"
              value={filters.soil}
              onChange={(e) => setFilters({ ...filters, soil: e.target.value })}
            />
            <input
              aria-label="必要数量"
              type="number"
              placeholder="必要数量"
              value={filters.quantity}
              onChange={(e) =>
                setFilters({ ...filters, quantity: e.target.value })
              }
            />
            <input
              aria-label="期間開始"
              type="date"
              value={filters.start}
              onChange={(e) =>
                setFilters({ ...filters, start: e.target.value })
              }
            />
            <input
              aria-label="期間終了"
              type="date"
              value={filters.end}
              onChange={(e) => setFilters({ ...filters, end: e.target.value })}
            />
          </div>
          <div className="matching-live-list">
            {data.searchResults.map((c) => (
              <article key={c.id}>
                <b>{c.title}</b>
                <span>
                  {c.region} · {c.soilType}
                </span>
                <span>
                  {c.quantity}
                  {c.unit} · {c.periodStart}〜{c.periodEnd}
                </span>
                <small>公開情報：{c.public?.summary || "記載なし"}</small>
                <button onClick={() => setSelected(c)}>案件詳細</button>
                {ownPublished && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          workflowApi.consult(
                            role,
                            {
                              sourceCaseId: ownPublished.id,
                              targetCaseId: c.id,
                              message: "条件の事前確認をお願いします。",
                            },
                            op(),
                          ),
                        "事前相談を開始しました。",
                      )
                    }
                  >
                    事前相談
                  </button>
                )}
              </article>
            ))}
          </div>
          {selected && (
            <div className="matching-live-detail">
              <h3>案件詳細</h3>
              <p>{selected.title}</p>
              <p>公開範囲：{selected.public?.summary || "記載なし"}</p>
              <p>
                {selected.shared
                  ? `相談相手共有：${selected.shared.conditions || "記載なし"}`
                  : "相談開始後に共有条件を表示します。"}
              </p>
              <button onClick={() => setSelected(null)}>閉じる</button>
            </div>
          )}
        </>
      )}
      {tab === "自社の案件" && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => workflowApi.createCase(role, form, op()),
                "下書きをDBに保存しました。",
              );
              setForm(blank(role));
            }}
          >
            <h3>{role === "construction" ? "搬出案件" : "受入条件"}を登録</h3>
            <input
              required
              aria-label={role === "construction" ? "搬出場所" : "受入場所"}
              placeholder={role === "construction" ? "搬出場所" : "受入場所"}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              required
              aria-label="地域"
              placeholder="地域"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            />
            <input
              required
              aria-label="土質"
              value={form.soilType}
              onChange={(e) => setForm({ ...form, soilType: e.target.value })}
            />
            <input
              required
              aria-label="数量"
            type="number"
            min="0.01"
            step="0.01"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
            <select
              aria-label="単位"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              <option value="m3">m³</option>
              <option value="t">t</option>
            </select>
            <input
              aria-label="期間開始"
              type="date"
              value={form.periodStart}
              onChange={(e) =>
                setForm({ ...form, periodStart: e.target.value })
              }
            />
            <input
              aria-label="期間終了"
              type="date"
              value={form.periodEnd}
              onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
            />
            <textarea
              aria-label="公開情報"
              placeholder="公開情報"
              value={form.public.summary}
              onChange={(e) =>
                setForm({ ...form, public: { summary: e.target.value } })
              }
            />
            <textarea
              aria-label="相談相手共有情報"
              placeholder={
                role === "construction"
                  ? "分析結果・搬出条件"
                  : "受入条件・必要書類"
              }
              value={form.shared.conditions}
              onChange={(e) =>
                setForm({ ...form, shared: { conditions: e.target.value } })
              }
            />
            <textarea
              aria-label="社内情報"
              placeholder="社内メモ（相手には非公開）"
              value={form.internal.memo}
              onChange={(e) =>
                setForm({ ...form, internal: { memo: e.target.value } })
              }
            />
            <input
              aria-label="関連資料名"
              placeholder="関連資料名（メタデータ）"
              onChange={(e) =>
                setForm({
                  ...form,
                  documents: e.target.value ? [{ name: e.target.value }] : [],
                })
              }
            />
          <button type="submit" className="matching-live-primary" disabled={busy}>
              下書き保存
            </button>
          </form>
          <div className="matching-live-list">
            {data.ownCases.map((c) => (
              <article key={c.id}>
                <b>{c.title}</b>
                <span>
                  {c.status} · v{c.version}
                </span>
                <small>社内情報：{c.internal?.memo || "なし"}</small>
                <div>
                  {c.status !== "published" && (
                    <button
                      onClick={() =>
                        run(
                          () =>
                            workflowApi.caseAction(
                              role,
                              c.id,
                              "publish",
                              c.version,
                              {},
                              op(),
                            ),
                          "案件を公開しました。",
                        )
                      }
                    >
                      公開
                    </button>
                  )}
                  {c.status === "published" && (
                    <button
                      onClick={() =>
                        run(
                          () =>
                            workflowApi.caseAction(
                              role,
                              c.id,
                              "close",
                              c.version,
                              {},
                              op(),
                            ),
                          "公開を終了しました。",
                        )
                      }
                    >
                      公開終了
                    </button>
                  )}
                  <button
                    onClick={() =>
                      run(
                        () =>
                          workflowApi.caseAction(
                            role,
                            c.id,
                            "edit",
                            c.version,
                            { quantity: Number(c.quantity) + 10 },
                            op(),
                          ),
                        "数量を編集し履歴を保存しました。",
                      )
                    }
                  >
                    数量を+10編集
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {tab === "相談・条件調整" && (
        <div className="matching-live-list">
          {data.consultations.map((c) => {
            const latest = c.offers.at(-1),
              mine = c.acceptances.some(
                (a) =>
                  a.organization_id ===
                  (role === "construction"
                    ? "org-construction"
                    : "org-receiving"),
              );
            return (
              <article key={c.id}>
                <b>相談 {c.id.slice(0, 8)}</b>
                <span>
                  {c.status} · v{c.version}
                </span>
                {latest && (
                  <small>
                    提示条件：{latest.terms.quantity}
                    {latest.terms.unit} / {latest.terms.periodStart}〜
                    {latest.terms.periodEnd}
                  </small>
                )}
                {c.status === "consulting" && (
                  <>
                    <button
                      onClick={() =>
                        run(
                          () =>
                            workflowApi.offer(
                              role,
                              c.id,
                              c.version,
                              {
                                ...latest.terms,
                                quantity: Number(latest.terms.quantity),
                              },
                              "条件を確認しました",
                              op(),
                            ),
                          "条件提示を履歴に追加しました。",
                        )
                      }
                    >
                      条件を提示
                    </button>
                    <button
                      disabled={mine}
                      onClick={() =>
                        run(
                          () => workflowApi.accept(role, c.id, c.version, op()),
                          "現在の提示条件に同意しました。相手方の同意後に成立します。",
                        )
                      }
                    >
                      {mine ? "同意済み" : "条件に同意"}
                    </button>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
      {tab === "成立済み" && (
        <div className="matching-live-list">
          {data.agreements.map((a) => (
            <article key={a.id}>
              <b>条件合意 {a.id.slice(0, 8)}</b>
              <span>
                {a.terms.quantity}
                {a.terms.unit} · {a.terms.periodStart}〜{a.terms.periodEnd}
              </span>
              <small>
                合意時点の案件 v{a.sourceCase.version} / v{a.targetCase.version}{" "}
                を不変保存
              </small>
              {role === "construction" && !a.reservationId && (
                <button
                  className="matching-live-primary"
                  onClick={() =>
                    run(
                      () => workflowApi.reserveAgreement(a.id, op()),
                      "合意条件から予約申請を作成しました。予約確定・配車完了ではありません。",
                    )
                  }
                >
                  搬出予定・搬入予約を作成
                </button>
              )}
              {a.reservationId && (
                <strong>予約申請作成済み（受入確認待ち）</strong>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
