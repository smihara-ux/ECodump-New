import {
  Building2,
  Route,
  FileText,
  ClipboardList,
  Network,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useCompliance } from "../demo/complianceStore.jsx";
import LaborWorkspace, {
  ParticipationWorkspace,
} from "../demo/LaborWorkspace.jsx";
import { findParticipation, missingDocuments, participationDocuments } from "../demo/complianceModel.mjs";
import { readReviewContext, writeReviewContext } from "./reviewContext.mjs";
import { demoSites } from "../demo/model.mjs";
import "./navigation-review.css";

// Explicit construction review: keep the existing destinations and business workflows.
export const reviewModules = [
  {
    title: "施工管理",
    icon: Building2,
    items: [["現場・搬出管理", "搬出・受入スケジュール"]],
  },
  {
    title: "運行管理",
    icon: Route,
    items: [
      ["配車・運行管理", "配車・運行管理"],
      ["運行ダッシュボード", "運行管制"],
    ],
  },
  { title: "労務安全", icon: FileText, items: [["労務安全", "労務安全"]] },
  {
    title: "実績管理",
    icon: ClipboardList,
    items: [["実績・帳票", "実績・帳票"]],
  },
  {
    title: "基本台帳",
    icon: Building2,
    items: [
      ["会社情報", "会社情報"],
      ["ユーザー", "ユーザー一覧"],
      ["車両", "車両一覧"],
      ["ドライバー検索", "ドライバー検索"],
    ],
  },
  {
    title: "関係会社",
    icon: Network,
    items: [
      ["協力会社", "代行先一覧"],
      ["登録申請", "代行登録申請"],
      ["元請会社", "自社の代行元一覧"],
    ],
  },
];
export function reviewModuleFor(page) {
  return (
    reviewModules.find((m) => m.items.some(([, p]) => p === page)) ||
    (["現場詳細", "現場一覧"].includes(page) ? reviewModules[0] : null)
  );
}
export function ReviewSidebar({ page, navigate, collapsed }) {
  const active = reviewModuleFor(page);
  return (
    <section className="nav-group">
      <h2 hidden={collapsed}>業務メニュー</h2>
      {reviewModules.map((m) => {
        const Icon = m.icon;
        return (
          <button
            key={m.title}
            className={active === m ? "active" : ""}
            aria-current={active === m ? "page" : undefined}
            aria-label={m.title}
            title={collapsed ? m.title : undefined}
            onClick={() => navigate(m.items[0][1])}
          >
            <span className="nav-icon">
              <Icon />
            </span>
            <span>{m.title}</span>
          </button>
        );
      })}
    </section>
  );
}
const companySections = [
  "本社情報",
  "CCUS連携情報",
  "労務安全項目",
  "支店情報",
];
export function ReviewWorkspace({
  page,
  navigate,
  children,
  companySection,
  onCompanySection,
}) {
  const m = reviewModuleFor(page);
  const [expanded, setExpanded] = useState(true);
  if (!m || page === "労務安全") return children;
  const current = ["現場詳細", "現場一覧"].includes(page)
    ? "搬出・受入スケジュール"
    : page;
  return (
    <div className="service-shell navigation-review-workspace">
      <aside className="service-menu" aria-label={`${m.title}のメニュー`}>
        <b>{m.title}</b>
        {m.items.map(([label, p]) => (
          <div key={p}>
            <div className="review-menu-parent">
              <button
                className={current === p ? "active" : ""}
                aria-current={current === p ? "page" : undefined}
                onClick={() => {
                  navigate(p);
                  if (p === "会社情報") {
                    onCompanySection("本社情報");
                    setExpanded(true);
                  }
                }}
              >
                {label}
              </button>
              {p === "会社情報" && (
                <button
                  className="review-disclosure"
                  aria-label="会社情報の項目を開閉"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? "⌃" : "⌄"}
                </button>
              )}
            </div>
            {p === "会社情報" && expanded && (
              <div className="review-submenu">
                {companySections.map((section) => (
                  <button
                    key={section}
                    aria-current={
                      page === p && companySection === section
                        ? "page"
                        : undefined
                    }
                    className={
                      page === p && companySection === section ? "active" : ""
                    }
                    onClick={() => {
                      if (page !== p) navigate(p);
                      onCompanySection(section);
                    }}
                  >
                    {section}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </aside>
      <div
        className={`service-main navigation-review-main ${page === "会社情報" ? "navigation-review-company" : ""}`}
      >
        <label className="navigation-review-mobile">
          {m.title}のメニュー
          <select
            value={page === "会社情報" ? companySection : current}
            onChange={(e) => {
              if (companySections.includes(e.target.value)) {
                if (page !== "会社情報") navigate("会社情報");
                onCompanySection(e.target.value);
              } else navigate(e.target.value);
            }}
          >
            {m.items.map(([label, p]) =>
              p === "会社情報" ? (
                <optgroup key={p} label={label}>
                  {companySections.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </optgroup>
              ) : (
                <option key={p} value={p}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        {children}
      </div>
    </div>
  );
}
export function ReviewRelations({ page, navigate, companyId, siteId, siteOptions, onOpen }) {
  const { participants } = useCompliance();
  const contextKey = `ecodump-review-relations:${page}`;
  const [query, setQuery] = useState(() => readReviewContext(contextKey, {}).query || "");
  useEffect(() => {
    if (!companyId) {
      const frame = requestAnimationFrame(() => document.querySelector(".navigation-review-main")?.scrollTo({top: readReviewContext(contextKey, {}).scroll || 0}));
      return () => cancelAnimationFrame(frame);
    }
  }, [companyId, contextKey]);
  const prime = page === "自社の代行元一覧";
  const rows = participants.filter(
    (p) =>
      (prime ? p.tier === "元請" : p.tier !== "元請") && p.name.includes(query),
  );
  const title = prime ? "元請会社一覧" : "協力会社一覧";
  function open(p) {
    sessionStorage.setItem("ecodump-participant-focus", p.id);
    writeReviewContext(contextKey, {query, scroll: document.querySelector(".navigation-review-main")?.scrollTop || 0});
    onOpen(p.id, p.siteId);
  }
  if (companyId)
    return (
      <section className="review-relations">
        <button className="outline" onClick={() => onOpen(null)}>
          会社一覧へ戻る
        </button>
        <ReviewCompanyDetail key={`${companyId}:${siteId}`} companyId={companyId} siteId={siteId} siteOptions={siteOptions} navigate={navigate} />
      </section>
    );
  return (
    <section className="review-relations">
      <h2>{title}</h2>
      <p className="review-note">
        既存の現場参加情報を参照したローカルデモです。会社情報と現場参加は区別します。APIへの送信は行いません。
      </p>
      <div className="searchbar">
        <label>
          会社名で検索
          <input
            placeholder="会社名"
            value={query}
            onChange={(e) => {setQuery(e.target.value);writeReviewContext(contextKey, {query:e.target.value, scroll:0});}}
          />
        </label>
      </div>
      <div
        className="review-relations-table"
        tabIndex={0}
        aria-label="関係会社一覧（横スクロール）"
      >
        <table>
          <thead>
            <tr>
              <th>会社名・ID</th>
              <th>区分</th>
              <th>参加現場</th>
              <th>参加状況</th>
              <th>確認</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.participationId} data-company-id={p.companyId} data-site-id={p.siteId}>
                <td data-label="会社名・ID">
                  {p.name}
                  <small>{p.id}</small>
                </td>
                <td data-label="区分">{p.tier}</td>
                <td data-label="参加現場">
                  {demoSites.find((s) => s.id === p.siteId)?.name ||
                    p.siteName || "現場未設定"}
                </td>
                <td data-label="参加状況">{p.state}</td>
                <td data-label="確認">
                  <button className="outline" onClick={() => open(p)}>
                    詳細
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>該当する会社はありません。</p>}
    </section>
  );
}

export function ReviewCompanyDetail({ companyId, siteId, siteOptions, navigate }) {
  const state = useCompliance();
  const p = findParticipation(state, companyId, siteId);
  const contextKey = `ecodump-review-company:${companyId}:${p?.siteId || siteId}`;
  const categoryKey = `${contextKey}:category`;
  const [section, updateSection] = useState(() => readReviewContext(contextKey, "会社情報"));
  const [documentCategory, setDocumentCategory] = useState(() => readReviewContext(categoryKey, "すべて"));
  function setSection(value) {updateSection(value);writeReviewContext(contextKey, value);}
  if (!p) return <p>会社情報が見つかりません。</p>;
  const documents = participationDocuments(state, p.id, p.siteId);
  const missing = missingDocuments(documents);
  function fullDocuments() {
    const category = documentCategory;
    sessionStorage.setItem(
      "ecodump-compliance-focus",
      JSON.stringify({ companyId: p.id, siteId: p.siteId, category }),
    );
    navigate("労務安全");
    const params = new URLSearchParams(location.search);
    params.set("documentCategory", category);
    history.replaceState(history.state, "", `${location.pathname}?${params}`);
  }
  return (
    <section className="review-company-detail" data-company-id={p.id} data-site-id={p.siteId}>
      <header>
        <div>
          <h2>{p.name}</h2>
          <p>
            {p.id} ·{" "}
            {demoSites.find((s) => s.id === p.siteId)?.name || p.siteName || "現場未設定"}
          </p>
        </div>
        <span>{p.state}</span>
      </header>
      <div
        className="review-detail-tabs"
        role="tablist"
        aria-label="会社詳細の項目"
      >
        {["会社情報", "現場参加情報", "不足書類"].map((x) => (
          <button
            role="tab"
            aria-selected={section === x}
            className={section === x ? "active" : ""}
            key={x}
            onClick={() => setSection(x)}
          >
            {x}
            {x === "不足書類" ? `（${missing.length}カテゴリ）` : ""}
          </button>
        ))}
      </div>
      <div hidden={section !== "会社情報"}>
        <dl className="review-company-facts">
          <dt>会社名</dt>
          <dd>{p.name}</dd>
          <dt>区分</dt>
          <dd>{p.tier}</dd>
          <dt>元請・上位会社</dt>
          <dd>{p.parent}</dd>
          <dt>担当者</dt>
          <dd>{p.contact || "未登録"}</dd>
          <dt>業務区分</dt>
          <dd>{p.role}</dd>
        </dl>
        <button className="outline" onClick={() => setSection("現場参加情報")}>
          現場参加情報を確認
        </button>
      </div>
      <div hidden={section !== "現場参加情報"}>
        <ParticipationWorkspace
          companyId={p.id}
          siteId={p.siteId}
          siteOptions={siteOptions}
          hideCompanySelector
          navigate={() => setSection("不足書類")}
        />
      </div>
      <div hidden={section !== "不足書類"}>
        <p>
          {missing.length
            ? `不足・差戻しのあるカテゴリ：${missing.map((r) => r.category).join("、")}`
            : "入力上の不足はありません。提出・受領状態は一覧で確認してください。"}
        </p>
        <LaborWorkspace
          key={`${p.id}:${p.siteId}`}
          embedded
          navigationReview
          companyId={p.id}
          siteId={p.siteId}
          initialCategory={documentCategory}
          onCategoryChange={c => {setDocumentCategory(c);writeReviewContext(categoryKey, c);}}
        />
        <button className="outline" onClick={fullDocuments}>
          労務安全で詳しく確認
        </button>
      </div>
    </section>
  );
}
