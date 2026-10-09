import { useEffect, useRef, useState } from "react";
import { categories, companies, changeDocument, findParticipation, saveParticipation } from "./complianceModel.mjs";
import { useCompliance, updateCompliance } from "./complianceStore.jsx";
import { demoNotice, demoTrips } from "./store.jsx";
import { demoSites, demoDrivers } from "./model.mjs";
import "./review.css";
import ReviewDocuments from "../review/ReviewDocuments.jsx";
const menus = [
  "書類状況一覧",
  "元請帳票の確認",
  "配下協力会社検索",
  "ドライバー検索",
];
export default function LaborWorkspace({
  renderDocuments,
  renderDrivers,
  navigationReview = false,
  embedded = false,
  companyId,
  siteId,
  initialCategory,
  onCategoryChange,
}) {
  const state = useCompliance(),
    [focus, setFocus] = useState(() => {
      try {
        return JSON.parse(
          sessionStorage.getItem("ecodump-compliance-focus") || JSON.stringify({companyId:new URLSearchParams(location.search).get("reviewCompany"),siteId:new URLSearchParams(location.search).get("reviewSite")}),
        );
      } catch {
        return {};
      }
    });
  const [menu, setMenu] = useState("書類状況一覧"),
    [category, setCategory] = useState(() => {
      if (initialCategory) return initialCategory;
      const c = new URLSearchParams(location.search).get("documentCategory");
      return categories[c] || (navigationReview && c === "すべて") ? c : focus.category || (navigationReview ? "すべて" : "一括提出書類");
    }),
    [query, setQuery] = useState(
      companies.find((c) => c.id === (companyId || focus.companyId))?.name ||
        "",
    ),
    [statuses, setStatuses] = useState([]),
    [filter, setFilter] = useState(false),
    [selected, setSelected] = useState(null),
    [error, setError] = useState(""),
    [driverQuery, setDriverQuery] = useState("");
  const rows = state.records
    .filter((r) => category === "すべて" || r.category === category)
    .filter(
      (r) =>
        (!(companyId || focus.companyId) || r.companyId === (companyId || focus.companyId)) &&
        (!(siteId || focus.siteId) || r.siteId === (siteId || focus.siteId)) &&
        companies.find((c) => c.id === r.companyId).name.includes(query) &&
        (!statuses.length || statuses.includes(r.status)),
    );
  function chooseCategory(c) {
    setCategory(c);
    onCategoryChange?.(c);
    setMenu("書類状況一覧");
    if (navigationReview && !embedded) {
      const params = new URLSearchParams(location.search);
      params.set("documentCategory", c);
      history.replaceState(null, "", `${location.pathname}?${params}`);
    }
  }
  const row = state.records.find((r) => r.id === selected);
  function act(id, action, input = {}) {
    try {
      updateCompliance((s) =>
        changeDocument(s, id, action, {
          ...input,
          expectedVersion: state.records.find((r) => r.id === id).version,
        }),
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className={embedded ? "review-documents-embedded" : "service-shell"}>
      {!embedded && (
        <aside className="service-menu" aria-label="労務安全のメニュー">
          <b>労務安全</b>
          {(navigationReview ? menus.filter(m => m !== "ドライバー検索") : menus).map(m => (
            <button key={m} className={menu === m ? "active" : ""} onClick={() => setMenu(m)}>{m}</button>
          ))}
        </aside>
      )}
      <div className={embedded ? "" : navigationReview?"service-main navigation-review-main":"service-main"}>
        {navigationReview && !embedded && (
          <label className="navigation-review-mobile">
            労務安全のメニュー
            <select value={menu} onChange={e => setMenu(e.target.value)}>
              {menus.filter(m => m !== "ドライバー検索").map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
        )}
        {embedded && !navigationReview && (
          <label className="review-category-select">
            書類カテゴリ
            <select
              value={category}
              onChange={(e) => chooseCategory(e.target.value)}
            >
              {Object.keys(categories).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        <p className="review-note">{demoNotice}</p>
        {error && <p role="alert">{error}</p>}
        {menu === "元請帳票の確認" ? (
          renderDocuments()
        ) : menu === "ドライバー検索" ? (
          renderDrivers(driverQuery, setDriverQuery)
        ) : menu === "配下協力会社検索" ? (
          <CompanySearch state={state} />
        ) : (
          <section className="gf-page">
            <h2>書類状況一覧</h2>
            <p>
              現場参加会社の必要書類をカテゴリ・版ごとに確認します。実書類の要否は運用に合わせて設定します。
            </p>
            <div className="gf-toolbar">
              <b>検索結果：{navigationReview ? new Set(rows.map(r => `${r.companyId}:${r.siteId}`)).size : rows.length}件{navigationReview ? "（会社）" : ""}</b>
              <button className="outline" onClick={() => setFilter(!filter)}>
                検索で絞り込む
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setStatuses([]);
                  sessionStorage.removeItem("ecodump-compliance-focus");
                  setFocus({});
                  if (navigationReview && !embedded) {
                    const params = new URLSearchParams(location.search);
                    params.delete("reviewCompany");params.delete("reviewSite");
                    history.replaceState(null, "", `${location.pathname}?${params}`);
                  }
                }}
              >
                検索条件をクリア
              </button>
            </div>
            {filter && (
              <form
                className="review-filter"
                onSubmit={(e) => {
                  e.preventDefault();
                  setFilter(false);
                }}
              >
                <label>
                  会社名
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <fieldset>
                  <legend>提出状況</legend>
                  {["未提出", "提出済", "受領済", "差戻し"].map((s) => (
                    <label key={s}>
                      <input
                        type="checkbox"
                        checked={statuses.includes(s)}
                        onChange={(e) =>
                          setStatuses(
                            e.target.checked
                              ? [...statuses, s]
                              : statuses.filter((v) => v !== s),
                          )
                        }
                      />
                      {s}
                    </label>
                  ))}
                </fieldset>
                <button className="primary">検索</button>
              </form>
            )}
            {!navigationReview && (
              <div className="gf-tabs">
                {Object.keys(categories).map((c) => (
                  <button
                    key={c}
                    className={category === c ? "active" : ""}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {navigationReview ? <ReviewDocuments rows={rows} participants={state.participants} category={category} chooseCategory={chooseCategory} onOpen={setSelected}/> : (
            <div
              className="gf-matrix-wrap"
              tabIndex={0}
              aria-label="書類一覧（横スクロール）"
            >
              <table className="gf-table gf-matrix">
                <thead>
                  <tr>
                    {[
                      "提出状況",
                      "次数・会社名",
                      "対象現場",
                      "版・履歴",
                      ...categories[category],
                      "操作",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const company = companies.find((c) => c.id === r.companyId);
                    return (
                      <tr key={r.id}>
                        <td>
                          {r.status}
                          <small>デモ内・未送信</small>
                        </td>
                        <td>
                          {company.tier}
                          <br />
                          {company.name}
                        </td>
                        <td>
                          {demoSites.find((s) => s.id === r.siteId)?.name}
                        </td>
                        <td>
                          第{r.version}版<br />
                          {r.history.length}件
                        </td>
                        {categories[category].map((d) => (
                          <td key={d}>
                            {r.checks.includes(d)
                              ? "入力確認済み"
                              : "不足・未入力"}
                          </td>
                        ))}
                        <td>
                          <button
                            className="outline"
                            onClick={() => setSelected(r.id)}
                          >
                            不足確認・提出・履歴
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!rows.length && (
                <p className="empty-state">
                  該当する会社・提出状態はありません。
                </p>
              )}
            </div>
            )}
          </section>
        )}
        {row && (
          <DocumentDialog
            row={row}
            act={act}
            error={error}
            close={() => {
              setSelected(null);
              setError("");
            }}
          />
        )}
      </div>
    </div>
  );
}
function DocumentDialog({ row, act, error, close }) {
  const ref = useRef(null),
    [comment, setComment] = useState("");
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  const missing = categories[row.category].filter(
    (d) => !row.checks.includes(d),
  );
  return (
    <dialog
      ref={ref}
      className="review-dialog"
      aria-label={`${companies.find((c) => c.id === row.companyId).name} ${row.category} 書類確認`}
      onCancel={close}
    >
      <header>
        <h2>
          {companies.find((c) => c.id === row.companyId).name} · {row.category}
        </h2>
        <button onClick={close} aria-label="書類確認を閉じる">
          ×
        </button>
      </header>
      <p>
        第{row.version}版／{row.status}（デモ内・未送信）
      </p>
      <p>
        不足 {missing.length}
        項目。以下は入力確認の試作であり、実書類の受領証明ではありません。
      </p>
      {categories[row.category].map((d) => (
        <label className="review-check" key={d}>
          <input
            type="checkbox"
            checked={row.checks.includes(d)}
            onChange={(e) =>
              act(row.id, "draft", {
                checks: e.target.checked
                  ? [...row.checks, d]
                  : row.checks.filter((v) => v !== d),
              })
            }
          />
          {d}
        </label>
      ))}
      <label>
        コメント・差戻し理由
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>
      <div className="review-actions">
        <button
          className="primary"
          disabled={missing.length > 0 || row.status === "受領済"}
          onClick={() => act(row.id, "submit")}
        >
          {row.status === "差戻し" ? "再提出（デモ）" : "仮提出（デモ）"}
        </button>
        <button
          className="outline"
          disabled={row.status !== "提出済"}
          onClick={() => act(row.id, "confirm")}
        >
          元請確認（デモ）
        </button>
        <button
          className="outline"
          disabled={!comment.trim()}
          onClick={() => act(row.id, "return", { comment })}
        >
          差戻し（デモ）
        </button>
        <button
          className="outline"
          disabled={!comment.trim()}
          onClick={() => {
            act(row.id, "comment", { comment });
            setComment("");
          }}
        >
          コメントを記録（未送信）
        </button>
        <button className="outline" onClick={() => act(row.id, "withdraw")}>
          取下げ（デモ）
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <h3>変更・提出履歴</h3>
      {row.history.length ? (
        row.history.map((h, i) => (
          <p key={i}>
            第{h.version}版 · {new Date(h.at).toLocaleString("ja-JP")} ·{" "}
            {h.message}
          </p>
        ))
      ) : (
        <p>初期表示以降の変更なし</p>
      )}
      <h3>版ごとのコメント</h3>
      {row.comments.map((c, i) => (
        <p key={i}>
          第{c.version}版 · {c.text}（未送信）
        </p>
      ))}
    </dialog>
  );
}
export function CompanySearch({ state }) {
  const [query, setQuery] = useState(""),
    [site, setSite] = useState("すべて");
  const rows = state.participants.filter(
    (c) => c.name.includes(query) && (site === "すべて" || c.siteId === site),
  );
  const sites = [...new Map([...demoSites, ...state.participants.map(p => ({id:p.siteId, name:p.siteName || demoSites.find(s => s.id === p.siteId)?.name || p.siteId}))].map(s => [s.id, s])).values()];
  return (
    <section className="gf-page">
      <h2>配下協力会社検索</h2>
      <div className="review-filter">
        <label>
          会社名
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          参加現場
          <select value={site} onChange={(e) => setSite(e.target.value)}>
            <option>すべて</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            setQuery("");
            setSite("すべて");
          }}
        >
          検索条件をクリア
        </button>
      </div>
      <p>検索結果：{rows.length}件</p>
      <table className="gf-table">
        <thead>
          <tr>
            <th>会社・階層</th>
            <th>上位会社</th>
            <th>参加現場</th>
            <th>業務区分・状態</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.participationId}>
              <td>
                {c.name}
                <small>{c.tier}</small>
              </td>
              <td>{c.parent}</td>
              <td>{demoSites.find((s) => s.id === c.siteId)?.name || c.siteName || "現場未設定"}</td>
              <td>
                {c.role}・{c.state}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>該当なし</p>}
    </section>
  );
}
export function ParticipationWorkspace({
  navigate, companyId, siteId, hideCompanySelector = false, siteOptions = demoSites,
}) {
  const state = useCompliance();
  const savedScope = (() => { try { return JSON.parse(sessionStorage.getItem("ecodump-participation-scope") || "{}"); } catch { return {}; } })();
  const [id, setId] = useState(() => companyId || savedScope.companyId || sessionStorage.getItem("ecodump-participant-focus") || "NC-03");
  const [selectedSite, setSelectedSite] = useState(() => siteId || savedScope.siteId || findParticipation(state, id)?.siteId || siteOptions[0]?.id);
  const [error, setError] = useState("");
  const p = findParticipation(state, id, selectedSite) || {...companies.find(c => c.id === id), siteId: selectedSite, role: "運搬", contact: "", email: "", state: "参加情報未登録", history: []};
  function rememberScope() {
    sessionStorage.setItem("ecodump-participant-focus", id);
    sessionStorage.setItem("ecodump-participation-scope", JSON.stringify({companyId: id, siteId: selectedSite}));
  }
  function save(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      updateCompliance(s => saveParticipation(s, id, {siteId: selectedSite, siteName: siteOptions.find(s => s.id === selectedSite)?.name, role: f.get("role"), contact: f.get("contact"), email: f.get("email")}));
      rememberScope();
      setError("");
    } catch (e) { setError(e.message); }
  }
  return <section className="gf-page">
    <h2>協力会社の招待・現場参加</h2>
    <p className="review-note">既存会社台帳から選び、現場ごとに参加情報を登録します。他の現場の参加情報と書類は保持します。招待メールは送信しません。{demoNotice}</p>
    {!hideCompanySelector && <label>既存の会社<select value={id} onChange={e => {setId(e.target.value);setSelectedSite(findParticipation(state, e.target.value)?.siteId || siteOptions[0]?.id);}}>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
    <ol className="review-steps"><li>招待</li><li>参加情報の登録</li><li>不足書類確認・提出</li><li>元請確認</li></ol>
    <p role="status">状態：{p.state}</p>
    <form className="review-filter" key={`${id}:${selectedSite}`} onSubmit={save}>
      <label>参加現場<select name="site" value={selectedSite} disabled={hideCompanySelector} onChange={e => setSelectedSite(e.target.value)}>{siteOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>業務区分<select required name="role" defaultValue={p.role}><option>運搬</option><option>施工</option><option>受入</option></select></label>
      <label>担当者名<input required name="contact" defaultValue={p.contact}/></label>
      <label>招待先メール<input required type="email" name="email" defaultValue={p.email}/></label>
      <button className="primary">登録内容をデモ内で確認</button>
    </form>
    <div className="review-actions">
      <button className="outline" onClick={() => {try {updateCompliance(s => saveParticipation(s, id, {siteId: selectedSite, siteName: siteOptions.find(s => s.id === selectedSite)?.name}, "invite"));rememberScope();setError("");}catch(e){setError(e.message);}}}>招待を下書き（未送信）</button>
      <button className="primary" disabled={!findParticipation(state, id, selectedSite)} onClick={() => {
        const category = state.records.find(r => r.companyId === id && r.siteId === selectedSite && (r.status === "差戻し" || categories[r.category].some(c => !r.checks.includes(c))))?.category || "一括提出書類";
        rememberScope();sessionStorage.setItem("ecodump-compliance-focus", JSON.stringify({companyId: id, siteId: selectedSite, category}));navigate("労務安全");
      }}>不足書類確認・提出へ</button>
    </div>
    <h3>提出前チェックリスト</h3><ul><li>{p.contact ? "入力済み" : "不足"}：担当者</li><li>{p.email ? "入力済み" : "不足"}：招待先メール</li><li>{p.siteId ? "選択済み" : "不足"}：参加現場</li><li>{p.role ? "選択済み" : "不足"}：業務区分</li><li>必要書類は労務安全の6カテゴリで確認</li></ul>
    {error && <p role="alert">{error}</p>}
    <details><summary>登録・招待履歴（デモ内）</summary><ul>{p.history.map((h,i) => <li key={i}>{h}</li>)}</ul>{!p.history.length && <p>履歴はありません。</p>}</details>
  </section>;
}
export function ActionRequired({ navigate }) {
  const s = useCompliance();
  const rows = s.records.filter((r) =>
    ["未提出", "差戻し", "提出済"].includes(r.status),
  );
  return (
    <section className="review-blockers">
      <h2>要対応事項（デモ）</h2>
      <p>
        一般のお知らせとは別に、参加情報・書類の不足と元請確認待ちを表示します。
      </p>
      <div className="review-actions">
        {s.participants
          .filter((p) => !p.contact || !p.email)
          .map((p) => (
            <button
              key={p.participationId}
              onClick={() => {
                sessionStorage.setItem("ecodump-participant-focus", p.id);
                sessionStorage.setItem("ecodump-participation-scope", JSON.stringify({companyId:p.id,siteId:p.siteId}));
                navigate("代行登録申請");
              }}
            >
              {p.name}：現場参加情報が不足
            </button>
          ))}
        {rows
          .sort((a, b) => (a.status === "提出済") - (b.status === "提出済"))
          .slice(0, 4)
          .map((r) => (
            <button
              key={r.id}
              onClick={() => {
                sessionStorage.setItem(
                  "ecodump-compliance-focus",
                  JSON.stringify({
                    companyId: r.companyId,
                    siteId: r.siteId,
                    category: r.category,
                  }),
                );
                navigate("労務安全");
              }}
            >
              {companies.find((c) => c.id === r.companyId)?.name} · {r.category}
              ：{r.status === "提出済" ? "元請確認待ち" : r.status}
            </button>
          ))}
        <button
          onClick={() => {
            sessionStorage.removeItem("ecodump-compliance-focus");
            navigate("労務安全");
          }}
        >
          すべての書類状態を見る（{rows.length}件）
        </button>
      </div>
    </section>
  );
}
