import { dayOffset, demoDay, demoSites, demoLocations, demoCompany } from "./model.mjs";
import { naritaIds } from "./naritaIds.mjs";

export const matchingDemoKey = "ecodump-matching-journey-v1";
export const actorNames = { construction: "施工側", receiving: "受入側" };

export function createMatchingJourney(day = demoDay(), instance = "") {
  const suffix = instance ? `-${instance}` : "";
  return {
    schema: 1, version: 0, day, sourceCaseId: `MDEMO-EXPORT-001${suffix}`, instance,
    sourceSiteId: naritaIds.siteA, sourceCompanyId: naritaIds.orgConstruction,
    published: false, selectedId: "MDEMO-RECEIVE-001", consultationId: null,
    revision: 1,
    terms: { soil: "第2種建設発生土", volume: 6400, unit: "m³", start: dayOffset(day, 1), end: dayOffset(day, 60), daily: 160, price: 900 },
    documents: { construction: false, receiving: false },
    confirmations: { construction: null, receiving: null },
    agreement: null, history: [],
    receivingCases: {}, sourceSiteName: demoSites[0].name,
  };
}

export function matchingCandidatesFor(state) {
  const period = { start: state.day, end: dayOffset(state.day, 90) };
  return [
    { id: "MDEMO-RECEIVE-001", locationId: demoLocations[0].databaseId, companyId: naritaIds.orgTochigi,
      name: demoLocations[0].name, area: "栃木県・デモ受入地", soil: "第2種建設発生土", capacity: 8000, daily: 280, distance: "約50 km", ...period },
    { id: "MDEMO-RECEIVE-002", locationId: demoLocations[1].databaseId, companyId: naritaIds.orgIbaraki,
      name: demoLocations[1].name, area: "茨城県・数量の調整が必要な例", soil: "第2種建設発生土", capacity: 3800, daily: 280, distance: "約40 km", ...period },
    { id: "MDEMO-RECEIVE-003", locationId: "MDEMO-LOCATION-003", companyId: "MDEMO-COMPANY-003",
      name: "サンプル受入ヤード C〈架空〉", area: "土質が合わない例", soil: "第3種建設発生土", capacity: 8000, daily: 280, distance: "約30 km", ...period },
  ].map(candidate => ({ ...candidate, unit: "m³", registered: true, ...state.receivingCases?.[candidate.id] }));
}

export function validateTerms(terms) {
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!["第1種建設発生土", "第2種建設発生土", "第3種建設発生土"].includes(terms.soil) || !["m³", "t"].includes(terms.unit)) return "土質と数量単位（m³／t）を選択してください。";
  if (!Number.isFinite(terms.volume) || terms.volume <= 0 || !Number.isFinite(terms.daily) || terms.daily <= 0 || terms.daily > terms.volume) return "総数量・1日あたりの上限を正の数で入力し、日別上限を総数量以下にしてください。";
  if (!Number.isFinite(terms.price) || terms.price < 0) return "参考単価を0以上の数で入力してください。";
  if (!validDate(terms.start) || !validDate(terms.end) || terms.end < terms.start) return "開始日・終了日を確認してください。終了日は開始日以降にしてください。";
  const days = Math.round((Date.parse(terms.end) - Date.parse(terms.start)) / 86400000) + 1;
  if (terms.daily * days < terms.volume) return "この期間と日別上限では総数量を搬出できません。数量・期間・日別上限を調整してください。";
  return "";
}

export function candidateChecks(state, candidate, terms = state.terms) {
  return [
    { label: "土質", ok: terms.soil === candidate.soil, detail: `搬出：${terms.soil} ／ 受入：${candidate.soil}` },
    { label: "総数量", ok: terms.unit === candidate.unit && terms.volume <= candidate.capacity, detail: `希望 ${terms.volume.toLocaleString()} ${terms.unit} ／ 受入上限の例 ${candidate.capacity.toLocaleString()} ${candidate.unit}（単位換算なし）` },
    { label: "期間", ok: terms.start >= candidate.start && terms.end <= candidate.end, detail: `希望 ${terms.start}〜${terms.end} ／ 受入 ${candidate.start}〜${candidate.end}` },
    { label: "日別上限", ok: terms.unit === candidate.unit && terms.daily <= candidate.daily, detail: `希望 ${terms.daily} ${terms.unit}/日 ／ 受入上限の例 ${candidate.daily} ${candidate.unit}/日` },
  ];
}

export function selectedCandidate(state) {
  return matchingCandidatesFor(state).find(candidate => candidate.id === state.selectedId);
}

export function journeyStep(state) {
  if (state.agreement) return 4;
  if (Object.values(state.confirmations).some(Boolean)) return 3;
  if (state.consultationId) return 2;
  return state.published ? 1 : 0;
}

export function agreementBlockers(state, actor) {
  if (!state.consultationId) return ["事前相談を開始してください。"];
  const checks = candidateChecks(state, selectedCandidate(state));
  return [
    ...checks.filter(check => !check.ok).map(check => `${check.label}が受入条件と一致していません。`),
    ...(!state.documents[actor] ? ["サンプル資料を確認してください。"] : []),
  ];
}

// All writes stay in the browser demo. Roles here represent two fictional actors,
// never authorization to write on behalf of an actual organization.
export function transitionMatchingJourney(state, event) {
  if (event.expectedVersion !== state.version) throw new Error("別の画面でデモが更新されました。最新の内容を確認してもう一度操作してください。");
  if (!actorNames[event.actor]) throw new Error("デモの操作役割を選択してください。");
  if (state.agreement) throw new Error("成立時の条件は変更できません。新しく試す場合はデモを最初からやり直してください。");
  const next = structuredClone(state);
  const actor = actorNames[event.actor];
  let message;
  switch (event.type) {
    case "publish":
      if (event.actor !== "construction" || state.published) throw new Error("搬出条件の確認は施工側で行います。");
      if (validateTerms(state.terms)) throw new Error(validateTerms(state.terms));
      next.published = true;
      message = `${actor}：搬出案件をデモ内で公開`;
      break;
    case "source":
      if (event.actor !== "construction" || state.consultationId) throw new Error("相談開始後の搬出条件は、条件調整から変更してください。");
      if (!event.siteId || (!demoSites.some(site => site.id === event.siteId) && !event.siteName)) throw new Error("登録済みの搬出現場を選択してください。");
      if (validateTerms(event.terms)) throw new Error(validateTerms(event.terms));
      next.sourceSiteId = event.siteId;
      next.sourceSiteName = event.siteName || demoSites.find(site => site.id === event.siteId)?.name;
      next.terms = structuredClone(event.terms);
      next.revision += 1;
      if (event.publish) next.published = true;
      message = `${actor}：搬出案件の条件を${event.publish ? "登録・公開（デモ）" : "更新"}`;
      break;
    case "receivingCase": {
      if (event.actor !== "receiving") throw new Error("受入条件は受入側で登録してください。");
      const target = matchingCandidatesFor(state).find(item => item.locationId === event.locationId);
      if (!target || !demoLocations.some(item => item.databaseId === event.locationId)) throw new Error("登録済みの受入場所を選択してください。");
      const condition = event.condition;
      const issue = validateTerms({ soil: condition.soil, unit: condition.unit, volume: condition.capacity, daily: condition.daily, start: condition.start, end: condition.end, price: 0 });
      if (issue) throw new Error(issue);
      next.receivingCases = { ...state.receivingCases, [target.id]: { ...condition, registered: true } };
      if (state.consultationId && target.id === state.selectedId) {
        next.revision += 1;
        next.documents = { construction: false, receiving: false };
        next.confirmations = { construction: null, receiving: null };
      }
      message = `${actor}：${target.name}の受入条件を登録（デモ）`;
      break;
    }
    case "select":
      if (!state.published || state.consultationId || event.actor !== "construction") throw new Error("相談開始前に施工側で候補を選択してください。");
      if (!matchingCandidatesFor(state).some(candidate => candidate.id === event.id)) throw new Error("候補が見つかりません。");
      next.selectedId = event.id;
      message = `${actor}：受入候補を選択`;
      break;
    case "consult":
      if (!state.published || state.consultationId || event.actor !== "construction") throw new Error("施工側で搬出条件を確認してから相談を開始してください。");
      if (!candidateChecks(state, selectedCandidate(state)).every(check => check.ok)) throw new Error("受入条件と合わない項目があります。搬出条件を調整するか別の候補を選んでください。");
      next.consultationId = state.sourceCaseId.replace("EXPORT", "CONSULT");
      message = `${actor}：事前相談を開始（デモ内のみ）`;
      break;
    case "terms":
      if (!state.consultationId) throw new Error("先に事前相談を開始してください。");
      if (validateTerms(event.terms)) throw new Error(validateTerms(event.terms));
      if (JSON.stringify(state.terms) === JSON.stringify(event.terms)) throw new Error("変更する条件を入力してください。");
      next.terms = structuredClone(event.terms);
      next.revision += 1;
      next.confirmations = { construction: null, receiving: null };
      next.documents = { construction: false, receiving: false };
      message = `${actor}：第${next.revision}版の条件を提示。双方の確認を解除`;
      break;
    case "documents":
      if (!state.consultationId) throw new Error("先に事前相談を開始してください。");
      if (state.documents[event.actor]) throw new Error("この版の資料は確認済みです。");
      next.documents[event.actor] = true;
      message = `${actor}：第${state.revision}版のサンプル資料を確認`;
      break;
    case "accept": {
      if (event.revision !== state.revision) throw new Error("条件が変更されました。最新の版を確認してください。");
      const blockers = agreementBlockers(state, event.actor);
      if (blockers.length) throw new Error(blockers.join(" "));
      if (state.confirmations[event.actor]) throw new Error("この版の条件は確認済みです。");
      next.confirmations[event.actor] = state.revision;
      const both = Object.values(next.confirmations).every(revision => revision === state.revision);
      if (both) {
        const candidate = selectedCandidate(state);
        next.agreement = {
          id: state.sourceCaseId.replace("EXPORT", "AGREEMENT"), sourceCaseId: state.sourceCaseId, targetCaseId: candidate.id,
          consultationId: state.consultationId, sourceSiteId: state.sourceSiteId,
          sourceCompanyId: state.sourceCompanyId, targetLocationId: candidate.locationId,
          targetCompanyId: candidate.companyId, revision: state.revision,
          terms: structuredClone(state.terms), confirmations: structuredClone(next.confirmations),
          documents: structuredClone(next.documents), agreedAt: event.at,
          sourceSiteName: state.sourceSiteName || sourceSummary(state).site.name, targetLocationName: candidate.name,
          targetCondition: structuredClone(candidate),
        };
      }
      message = `${actor}：第${state.revision}版に合意${both ? "。双方の条件合意が成立（デモ）" : "。相手側の確認待ち"}`;
      break;
    }
    default: throw new Error("この操作はデモにありません。");
  }
  next.version += 1;
  next.history.push({ version: next.version, actor: event.actor, message, at: event.at });
  return next;
}

export function readMatchingJourney(storage) {
  const value = storage.getItem(matchingDemoKey);
  if (!value) return createMatchingJourney();
  const state = JSON.parse(value);
  if (state?.schema !== 1 || !Number.isSafeInteger(state.version) || state.version < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(state.day || "") ||
      !/^MDEMO-EXPORT-001(?:-[\w-]+)?$/.test(state.sourceCaseId) || !Number.isSafeInteger(state.revision) || state.revision < 1 ||
      typeof state.published !== "boolean" || ![null, state.sourceCaseId.replace("EXPORT", "CONSULT")].includes(state.consultationId) ||
      (!demoSites.some(site => site.id === state.sourceSiteId) && !state.sourceSiteName) || !Array.isArray(state.history) ||
      !state.documents || !state.confirmations || !selectedCandidate(state) || validateTerms(state.terms || {}) ||
      Object.keys(actorNames).some(actor => typeof state.documents[actor] !== "boolean" ||
        ![null, state.revision].includes(state.confirmations[actor]) ||
        (state.confirmations[actor] !== null && (!state.consultationId || !state.documents[actor]))) ||
      (state.consultationId && !state.published) ||
      (state.agreement && (state.agreement.id !== state.sourceCaseId.replace("EXPORT", "AGREEMENT") || state.agreement.revision !== state.revision ||
        state.agreement.sourceCaseId !== state.sourceCaseId || state.agreement.targetCaseId !== state.selectedId ||
        JSON.stringify(state.agreement.terms) !== JSON.stringify(state.terms) ||
        !Object.values(state.confirmations).every(revision => revision === state.revision) ||
        !candidateChecks(state, selectedCandidate(state)).every(check => check.ok)))) {
    throw new Error("保存された成立デモを読み込めません。既存の業務データには影響しません。デモを最初からやり直してください。");
  }
  if (state.agreement) {
    const candidate = selectedCandidate(state);
    state.agreement = { ...state.agreement, sourceSiteName: state.agreement.sourceSiteName || sourceSummary(state).site.name, targetLocationName: state.agreement.targetLocationName || candidate.name, targetCondition: state.agreement.targetCondition || structuredClone(candidate) };
  }
  return state;
}

export function writeMatchingJourney(storage, event) {
  const current = readMatchingJourney(storage);
  const next = transitionMatchingJourney(current, event);
  // Report success only after the local write succeeds.
  storage.setItem(matchingDemoKey, JSON.stringify(next));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ecodump-matching-updated"));
  return next;
}

export function sourceSummary(state) {
  return { site: demoSites.find(site => site.id === state.sourceSiteId) || { id: state.sourceSiteId, name: state.sourceSiteName }, company: demoCompany };
}
