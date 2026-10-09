import { categories, companies } from "../demo/complianceModel.mjs";
import { demoSites } from "../demo/model.mjs";

// Each category keeps its record ID, checks, version and submission history.
// The workspace groups those records by company/site rather than cloning a page.
export default function ReviewDocuments({ rows, participants, category, chooseCategory, onOpen }) {
  const groups = Object.values(rows.reduce((out, r) => {
    const key = `${r.companyId}:${r.siteId}`;
    (out[key] ||= []).push(r);
    return out;
  }, {}));
  return <section className="review-document-list" aria-label="会社別の書類状況">
    <label className="review-category-select">表示する書類
      <select value={category} onChange={e => chooseCategory(e.target.value)}>
        <option>すべて</option>
        {Object.keys(categories).map(c => <option key={c}>{c}</option>)}
      </select>
    </label>
    <p className="review-document-explanation">会社ごとに提出状況をまとめました。各書類の入力確認・提出・版・履歴は個別に管理します。入力確認は実ファイルの提出を意味しません。</p>
    <p className="review-document-count">対象：{groups.length}社・{rows.length}カテゴリ</p>
    {groups.map(records => {
      const first = records[0], company = companies.find(c => c.id === first.companyId);
      const participation = participants.find(p => p.companyId === first.companyId && p.siteId === first.siteId);
      const missing = records.reduce((n, r) => n + categories[r.category].filter(d => !r.checks.includes(d)).length, 0);
      return <article className="review-document-company" key={`${first.companyId}:${first.siteId}`} data-company-id={first.companyId} data-site-id={first.siteId}>
        <header><div><h3>{company.name}</h3><p>{company.tier} · {demoSites.find(s => s.id === first.siteId)?.name || participation?.siteName || "現場未設定"}</p><small>参加状況：{participation?.state || "参加情報未登録"}</small></div>
          <span className={missing ? "review-document-warning" : "review-document-ok"}>{missing ? `入力未確認 ${missing}項目` : "入力確認済み"}</span>
        </header>
        <div className="review-document-head" aria-hidden="true"><span>カテゴリ・対象書類</span><span>提出状況・履歴</span><span>操作</span></div>
        {records.map(r => <section className="review-document-row" key={r.id} data-record-id={r.id}>
          <div><h4>{r.category}</h4><ul>{categories[r.category].map(d => <li key={d} className={r.checks.includes(d) ? "checked" : "missing"}><span aria-hidden="true">{r.checks.includes(d) ? "✓" : "!"}</span><span>{d}<small>{r.checks.includes(d) ? "入力確認済み" : "入力未確認"}</small></span></li>)}</ul></div>
          <div className="review-document-state"><b className={`review-submission-status status-${r.status}`}>{r.status}</b><small>第{r.version}版 · 履歴{r.history.length}件</small><small>ブラウザ内デモ・未送信</small></div>
          <button className="outline" onClick={() => onOpen(r.id)}>確認・提出・履歴</button>
        </section>)}
      </article>;
    })}
    {!rows.length && <p className="empty-state">該当する会社・書類はありません。検索条件を変更してください。</p>}
  </section>;
}
