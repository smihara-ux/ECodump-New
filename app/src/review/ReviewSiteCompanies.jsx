import { useCompliance } from "../demo/complianceStore.jsx";
import { companies, missingDocuments, participationDocuments } from "../demo/complianceModel.mjs";

export default function ReviewSiteCompanies({siteId, siteName, navigate}) {
  const state = useCompliance();
  const rows = state.participants.filter(p => p.siteId === siteId && p.tier !== "元請");
  function open(p, section) {
    navigate("代行先一覧", undefined, {related: true, companyId: p.companyId, siteId: p.siteId, companySection: section});
  }
  return <section className="review-site-companies" aria-label={`${siteName}の協力会社`}>
    <header><h2>協力会社の現場参加状況</h2><p>{siteName} · {rows.length}社</p></header>
    <p className="review-note">関係会社・労務安全と同じ参加情報を表示しています。ブラウザー内デモ・未送信です。</p>
    {rows.map(p => {
      const records = participationDocuments(state, p.companyId, p.siteId);
      const missing = missingDocuments(records);
      return <article className="review-site-company" key={p.participationId} data-company-id={p.companyId} data-site-id={p.siteId}>
        <div><h3>{p.name}</h3><small>{p.companyId} · {p.tier} · 上位会社：{companies.find(c => c.id === p.parentId)?.name || "なし"}</small></div>
        <dl><div><dt>参加状況</dt><dd>{p.state}</dd></div><div><dt>担当者</dt><dd>{p.contact || "未登録"}</dd></div><div><dt>不足・差戻し</dt><dd>{missing.length}カテゴリ</dd></div><div><dt>書類受領</dt><dd>{records.filter(r => r.status === "受領済").length}／{records.length}カテゴリ</dd></div></dl>
        <div className="review-actions"><button className="outline" onClick={() => open(p, "現場参加情報")}>会社・参加情報を確認</button><button className="outline" onClick={() => open(p, "不足書類")}>不足書類を確認</button></div>
      </article>;
    })}
    {!rows.length && <p className="empty-state">この現場の協力会社の参加情報はありません。</p>}
  </section>;
}
