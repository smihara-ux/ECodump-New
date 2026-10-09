import { demoCompany, demoCarrier, demoSites } from "./model.mjs";
export const categories = {
  一括提出書類: ["施工体制台帳", "再下請負通知書", "作業員名簿（ドライバー）"],
  個別提出書類: ["車両情報", "ドライバー情報", "搬入承認書"],
  許可情報: ["建設業許可情報", "運送事業許可情報"],
  契約情報: ["運搬契約", "受入条件合意"],
  保険加入証明書: ["自動車保険", "加入証明書"],
  主任技術者: ["主任技術者情報", "資格証明"],
};
export const companies = [
  { id: "NC-01", name: demoCompany, tier: "元請", parent: "なし", parentId: null },
  { id: "NC-02", name: demoCarrier, tier: "一次", parent: demoCompany, parentId: "NC-01" },
  {
    id: "NC-03",
    name: "成田モデル協力会社 B〈架空〉",
    tier: "二次",
    parent: demoCarrier,
    parentId: "NC-02",
  },
];
export function initialCompliance() {
  return {
    version: 1,
    records: companies.flatMap((c, i) =>
      Object.keys(categories).map((category) => ({
        id: `${c.id}:${category}`,
        companyId: c.id,
        siteId: demoSites[0].id,
        category,
        status: ["受領済", "提出済", "未提出"][i],
        version: 1,
        checks: i < 2 ? categories[category] : [],
        comments: [],
        history: [],
      })),
    ),
    participants: companies.map((c, i) => ({
      ...c,
      siteId: demoSites[0].id,
      role: "運搬",
      contact: i === 2 ? "" : "検証担当者",
      email: i === 2 ? "" : "review@example.invalid",
      state: i === 2 ? "招待未対応" : "現場参加済み",
      history: [],
    })),
  };
}
// Legacy company/document IDs stay intact; participation is scoped to a site.
export function participationKey(companyId, siteId) {
  return `${companyId}:${siteId}`;
}
export function normalizeCompliance(state) {
  return {
    ...state,
    participants: state.participants.map(p => ({
      ...p,
      companyId: p.companyId || p.id,
      participationId: p.participationId || participationKey(p.companyId || p.id, p.siteId),
      parentId: p.parentId ?? companies.find(c => c.id === (p.companyId || p.id))?.parentId ?? null,
    })),
  };
}
export function findParticipation(state, companyId, siteId) {
  return state.participants.find(p => (p.companyId || p.id) === companyId && (!siteId || p.siteId === siteId));
}
export function participationDocuments(state, companyId, siteId) {
  return state.records.filter(r => r.companyId === companyId && r.siteId === siteId);
}
export function missingDocuments(records) {
  return records.filter(r => r.status === "差戻し" || categories[r.category].some(c => !r.checks.includes(c)));
}
export function saveParticipation(state, companyId, input, action = "save") {
  const company = companies.find(c => c.id === companyId);
  if (!company || !input.siteId) throw new Error("会社と参加現場を選択してください。");
  const current = normalizeCompliance(state);
  const existing = findParticipation(current, companyId, input.siteId);
  const p = {
    ...company,
    role: "運搬", contact: "", email: "", history: [],
    ...existing,
    ...input,
    id: companyId, companyId,
    participationId: participationKey(companyId, input.siteId),
    state: action === "invite" ? "招待の下書き" : "登録内容確認待ち",
    history: [...(existing?.history || []), action === "invite" ? "招待下書き作成（メール未送信）" : `${new Date().toLocaleString("ja-JP")} 登録内容をデモ内に保存（未送信）`],
  };
  // Adding another site must never relocate existing participation or documents.
  const addedRecords = Object.keys(categories)
    .filter(category => !current.records.some(r => r.companyId === companyId && r.siteId === input.siteId && r.category === category))
    .map(category => ({id: `${p.participationId}:${category}`, companyId, siteId: input.siteId, category, status: "未提出", version: 1, checks: [], comments: [], history: []}));
  return {
    ...current, version: current.version + 1,
    participants: existing ? current.participants.map(row => row.participationId === p.participationId ? p : row) : [...current.participants, p],
    records: [...current.records, ...addedRecords],
  };
}
export function changeDocument(state, id, action, input = {}) {
  const row = state.records.find((r) => r.id === id);
  if (!row) throw new Error("対象書類がありません。");
  if (input.expectedVersion != null && row.version !== input.expectedVersion)
    throw new Error("書類の版が更新されました。再表示してください。");
  let patch = {},
    message = "";
  if (action === "draft") {
    patch.checks = input.checks;
    patch.status = "未提出";
    message = "不足項目の入力をデモ内に保存";
  }
  if (action === "submit") {
    if (categories[row.category].some((x) => !row.checks.includes(x)))
      throw new Error("不足項目を確認してください。");
    patch.status = "提出済";
    message = "仮提出（未送信）";
  }
  if (action === "return") {
    if (!input.comment?.trim()) throw new Error("差戻し理由が必要です。");
    patch.status = "差戻し";
    message = `差戻し（未送信）：${input.comment.trim()}`;
  }
  if (action === "confirm") {
    if (row.status !== "提出済")
      throw new Error("提出済みの版を確認してください。");
    patch.status = "受領済";
    message = "元請確認（デモ）";
  }
  if (action === "withdraw") {
    patch.status = "未提出";
    message = "取下げ（未送信）";
  }
  if (action === "comment") {
    if (!input.comment?.trim()) throw new Error("コメントを入力してください。");
    patch.comments = [
      ...row.comments,
      {
        at: new Date().toISOString(),
        version: row.version,
        text: input.comment.trim(),
      },
    ];
    message = "コメントをデモ内に記録（未送信）";
  }
  const changed = {
    ...row,
    ...patch,
    version: row.version + 1,
    history: [
      ...row.history,
      { at: new Date().toISOString(), version: row.version, message },
    ],
  };
  return {
    ...state,
    records: state.records.map((r) => (r.id === id ? changed : r)),
    version: state.version + 1,
  };
}
