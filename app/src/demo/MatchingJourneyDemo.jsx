import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, MapPin, ShieldCheck, X } from "lucide-react";
import { demoSites } from "./model.mjs";
import {
  actorNames, agreementBlockers, candidateChecks, createMatchingJourney,
  journeyStep, matchingCandidatesFor, matchingDemoKey, readMatchingJourney,
  selectedCandidate, sourceSummary, validateTerms, writeMatchingJourney,
} from "./matchingJourney.mjs";
import "./matchingJourney.css";
import { matchingRolePageUrl } from "./matchingRoutes.mjs";
import { useDemoTrips } from "./store.jsx";

const steps = ["案件条件", "候補選び", "相談・資料確認", "双方の合意", "成立"];
const number = value => Number(value).toLocaleString("ja-JP");

function TermsSummary({ terms }) {
  return <dl className="match-properties journey-terms">
    <div><dt>土質</dt><dd>{terms.soil}</dd></div>
    <div><dt>総数量</dt><dd>{number(terms.volume)} {terms.unit}</dd></div>
    <div><dt>搬出・受入期間</dt><dd>{terms.start}〜{terms.end}</dd></div>
    <div><dt>1日あたりの上限</dt><dd>{number(terms.daily)} {terms.unit}/日</dd></div>
    <div><dt>参考単価（デモ）</dt><dd>{number(terms.price)} 円/{terms.unit}</dd></div>
    <div><dt>次の手続き</dt><dd>条件合意後に搬入予約</dd></div>
  </dl>;
}

function TermsDialog({ state, actor, mode, save, close, siteOptions }) {
  const dialog = useRef(null);
  const draftKey = `${matchingDemoKey}:draft:${actor}:${mode}:${state.sourceCaseId}`;
  const retained = (() => { try { const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null"); return draft?.revision === state.revision ? draft : null; } catch { return null; } })();
  const [terms, setTerms] = useState(retained?.terms || { ...state.terms });
  const [siteId, setSiteId] = useState(retained?.siteId || state.sourceSiteId);
  const [error, setError] = useState("");
  const openedVersion = useRef(state.version);
  useEffect(() => {
    dialog.current?.showModal();
    return () => { dialog.current?.close(); requestAnimationFrame(() => document.querySelector(".matching-journey .matching-hero button.primary")?.focus({ preventScroll: true })); };
  }, []);
  useEffect(() => { try { sessionStorage.setItem(draftKey, JSON.stringify({ terms, siteId, revision: state.revision })); } catch { setError("下書きをこのタブに保持できません。現在の入力は画面内に残っています。"); } }, [terms, siteId]);
  const change = (key, value) => setTerms(current => ({ ...current, [key]: value }));
  const submit = event => {
    event.preventDefault();
    const issue = validateTerms(terms);
    if (issue) { setError(issue); return; }
    const result = save({ type: mode === "source" ? "source" : "terms", terms, siteId, siteName: siteOptions.find(site => site.id === siteId)?.name, publish: mode === "source", expectedVersion: openedVersion.current });
    if (result.ok) { try { sessionStorage.removeItem(draftKey); } catch {} close(); }
    else setError(result.error);
  };
  return <dialog className="review-dialog journey-dialog" ref={dialog} onCancel={close} aria-label={mode === "source" ? "搬出案件登録" : "相談条件の調整"}>
    <form onSubmit={submit}>
      <header><div><h2>{mode === "source" ? "搬出案件登録" : "相談条件の調整"}</h2><p>{actorNames[actor]}の操作 · 第{state.revision}版 · {state.sourceCaseId}</p></div><button type="button" aria-label="条件の編集を閉じる" onClick={close}><X /></button></header>
      <p>{mode === "source" ? "デモ内の搬出条件を設定します。会社・現場の基本情報は登録済みの例です。" : "変更すると新しい版になり、双方の資料確認・合意をやり直します。"}</p>
      <div className="form-grid journey-form">
        {mode === "source" && <label>搬出現場<select value={siteId} onChange={event => setSiteId(event.target.value)}>{siteOptions.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>}
        <label>土質<select value={terms.soil} onChange={event => change("soil", event.target.value)}>{["第1種建設発生土", "第2種建設発生土", "第3種建設発生土"].map(soil => <option key={soil}>{soil}</option>)}</select></label>
        <label>数量単位<select value={terms.unit} onChange={event => change("unit", event.target.value)}><option>m³</option><option>t</option></select></label>
        <label>総数量（{terms.unit}）<input type="number" min="0.01" step="0.01" required value={terms.volume} onChange={event => change("volume", event.target.value === "" ? "" : Number(event.target.value))} /></label>
        <label>開始日<input type="date" required value={terms.start} onChange={event => change("start", event.target.value)} /></label>
        <label>終了日<input type="date" required min={terms.start} value={terms.end} onChange={event => change("end", event.target.value)} /></label>
        <label>1日あたりの上限（{terms.unit}/日）<input type="number" min="0.01" step="0.01" required value={terms.daily} onChange={event => change("daily", event.target.value === "" ? "" : Number(event.target.value))} /></label>
        <label>参考単価（デモ、円/{terms.unit}）<input type="number" min="0" required value={terms.price} onChange={event => change("price", event.target.value === "" ? "" : Number(event.target.value))} /></label>
      </div>
      {error && <p role="alert">{error}</p>}
      <footer className="journey-actions"><button type="button" className="outline" onClick={close}>変更せず戻る</button><button className="primary">{mode === "source" ? "搬出案件を登録して候補へ（デモ）" : "変更した条件を提示（デモ）"}</button></footer>
    </form>
  </dialog>;
}

function ReceivingCaseDialog({ state, save, close }) {
  const dialog = useRef(null), openedVersion = useRef(state.version);
  const candidates = matchingCandidatesFor(state).filter(candidate => !candidate.id.endsWith("003"));
  const draftKey = `${matchingDemoKey}:draft:receiving:condition:${state.sourceCaseId}`;
  const retained = (() => { try { return JSON.parse(sessionStorage.getItem(draftKey) || "null"); } catch { return null; } })();
  const [locationId, setLocationId] = useState(retained?.locationId || candidates[0].locationId);
  const [condition, setCondition] = useState(retained?.condition || { ...candidates[0] });
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => { try { sessionStorage.setItem(draftKey, JSON.stringify({ locationId, condition })); } catch { setError("下書きをこのタブに保持できません。入力は画面内に残っています。"); } }, [locationId, condition]);
  const change = (key, value) => setCondition(current => ({ ...current, [key]: value }));
  return <dialog className="review-dialog journey-dialog" ref={dialog} onCancel={close} aria-label="受入条件登録"><form onSubmit={event => {
    event.preventDefault();
    const result = save({ type: "receivingCase", locationId, condition: { soil: condition.soil, unit: condition.unit, capacity: Number(condition.capacity), daily: Number(condition.daily), start: condition.start, end: condition.end, notes: condition.notes || "土質・搬出計画のサンプル資料を確認" }, expectedVersion: openedVersion.current });
    if (result.ok) { try { sessionStorage.removeItem(draftKey); } catch {} close(); } else setError(result.error);
  }}><header><div><h2>受入条件登録</h2><p>受入側 · 登録済みの受入場所に条件を設定します</p></div><button type="button" onClick={close} aria-label="受入条件登録を閉じる"><X /></button></header>
    <div className="form-grid journey-form">
      <label>受入場所<select aria-label="受入場所" value={locationId} onChange={event => { setLocationId(event.target.value); setCondition({ ...candidates.find(candidate => candidate.locationId === event.target.value) }); }}>{candidates.map(candidate => <option key={candidate.id} value={candidate.locationId}>{candidate.name}</option>)}</select></label>
      <label>受入可能土質<select value={condition.soil} onChange={event => change("soil", event.target.value)}>{["第1種建設発生土", "第2種建設発生土", "第3種建設発生土"].map(soil => <option key={soil}>{soil}</option>)}</select></label>
      <label>受入数量の単位<select value={condition.unit} onChange={event => change("unit", event.target.value)}><option>m³</option><option>t</option></select></label>
      <label>この受入案件の総数量上限<input type="number" min="0.01" step="0.01" required value={condition.capacity} onChange={event => change("capacity", event.target.value)} /></label>
      <label>受付開始日<input type="date" required value={condition.start} onChange={event => change("start", event.target.value)} /></label>
      <label>受付終了日<input type="date" required min={condition.start} value={condition.end} onChange={event => change("end", event.target.value)} /></label>
      <label>日別数量上限<input type="number" min="0.01" step="0.01" required value={condition.daily} onChange={event => change("daily", event.target.value)} /></label>
      <label>必要資料・受入条件<textarea value={condition.notes || "土質・搬出計画のサンプル資料を確認"} onChange={event => change("notes", event.target.value)} /></label>
    </div><p>この案件の総数量と日別上限を登録します。物理容量・月間処理能力の残量とは別です。実資料の提出や審査は行いません。</p>{error && <p role="alert">{error}</p>}
    <footer className="journey-actions"><button type="button" className="outline" onClick={close}>変更せず戻る</button><button className="primary">受入条件を登録（デモ）</button></footer></form></dialog>;
}

function ResetDialog({ close, reset }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  return <dialog className="review-dialog journey-dialog" ref={dialog} onCancel={close} aria-label="成立デモのやり直し">
    <header><h2>成立デモをやり直す</h2><button aria-label="やり直しを閉じる" onClick={close}><X /></button></header>
    <p>この成立デモの相談・確認・合意履歴を初期状態に戻します。他の現場・予定・配車のデモデータには影響しません。</p>
    <footer className="journey-actions"><button className="outline" onClick={close}>やり直さず戻る</button><button className="primary" onClick={reset}>最初からやり直す</button></footer>
  </dialog>;
}

function PreviousAgreement({ trip, trips, actor }) {
  const agreement = trip.agreementSnapshot;
  const related = trips.filter(item => item.matchAgreementId === agreement.id);
  return <section className="matching-page matching-journey" aria-label="以前の案件の成立内容">
    <p className="journey-demo-note" role="note">以前の予約の成立時の内容です。現在のマッチングデモとは別の案件で、条件は変更できません。</p>
    <div className="matching-hero"><div><span>SOIL CIRCULATION MATCHING</span><h2>成立時の条件を確認</h2><p>{agreement.sourceSiteName} → {agreement.targetLocationName}</p></div><button className="outline" onClick={() => location.assign(matchingRolePageUrl(actor))}>現在のデモへ戻る</button></div>
    <div className="journey-agreed" role="status"><h3>マッチング成立（デモ）</h3><p>双方が第{agreement.revision}版の同じ条件に合意しました。</p><b>{agreement.id}</b><small>搬出案件 {agreement.sourceCaseId} / 受入案件 {agreement.targetCaseId}</small><small>相談 {agreement.consultationId}</small><TermsSummary terms={agreement.terms} /></div>
    <section className="journey-section"><h3>この成立案件の予約</h3><div className="results-table-wrap"><table className="service-table journey-reservations-table"><thead><tr><th>便・予約ID</th><th>予定日・数量</th><th>予約状態</th></tr></thead><tbody>{related.map(item => <tr key={item.id}><td data-label="便・予約ID">{item.id}<small>{item.reservationId}</small></td><td data-label="予定日・数量">{item.date}<small>{item.planned} {item.unit} / {item.material}</small></td><td data-label="予約状態">{item.reservation}</td></tr>)}</tbody></table></div><div className="journey-actions"><button className="outline" onClick={() => location.assign(matchingRolePageUrl("receiving", "receiving-reservations", trip.id))}>受入側でこの予約を確認</button><button className="outline" onClick={() => location.assign(matchingRolePageUrl(actor === "construction" ? "receiving" : "construction", "matching", trip.id))}>相手側で成立内容を確認</button></div></section>
  </section>;
}

export default function MatchingJourneyDemo({ role, onExit, navigate, initialRegistration = false, siteOptions = demoSites }) {
  const actor = role === "receiving" ? "receiving" : "construction";
  const other = actor === "construction" ? "receiving" : "construction";
  const [state, setState] = useState(() => {
    try { return readMatchingJourney(localStorage); } catch { return createMatchingJourney(); }
  });
  const [error, setError] = useState("");
  const [unreadable, setUnreadable] = useState(false);
  const [notice, setNotice] = useState("");
  const [edit, setEdit] = useState(initialRegistration && !state.agreement ? (actor === "receiving" ? "receiving" : "source") : null);
  const [resetOpen, setResetOpen] = useState(Boolean(initialRegistration && state.agreement));
  const [docsOpen, setDocsOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const trips = useDemoTrips();
  const requestedTripId = new URLSearchParams(location.search).get("matchTrip");
  const previousTrip = trips.find(trip => trip.id === requestedTripId && trip.agreementSnapshot && trip.matchAgreementId !== state.agreement?.id);
  const refresh = () => {
    try { setState(readMatchingJourney(localStorage)); setUnreadable(false); }
    catch (issue) { setError(issue.message); setUnreadable(true); }
  };
  useEffect(() => {
    refresh();
    const changed = event => { if (event.key === matchingDemoKey || event.key === null) refresh(); };
    window.addEventListener("storage", changed);
    window.addEventListener("ecodump-matching-updated", refresh);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener("ecodump-matching-updated", refresh); };
  }, []);
  useEffect(() => { setTermsChecked(false); setReviewed(false); setDocsOpen(false); }, [state.revision, state.consultationId]);
  const act = event => {
    try {
      const next = writeMatchingJourney(localStorage, { ...event, actor, expectedVersion: event.expectedVersion ?? state.version, at: new Date().toISOString() });
      setState(next); setError(""); setNotice(next.history.at(-1).message);
      return { ok: true };
    } catch (issue) {
      const message = ["QuotaExceededError", "SecurityError"].includes(issue.name) ? "このブラウザにデモを保存できませんでした。操作は完了していません。入力は保持しています。" : issue.message;
      setError(message);
      refresh();
      return { ok: false, error: message };
    }
  };
  const reset = () => {
    try {
      const next = createMatchingJourney(undefined, crypto.randomUUID());
      localStorage.setItem(matchingDemoKey, JSON.stringify(next));
      setState(next); setError(""); setUnreadable(false); setNotice("成立デモを初期状態に戻しました。"); setResetOpen(false);
      setTermsChecked(false); setReviewed(false); setDocsOpen(false);
    } catch { setError("デモをこのブラウザに保存できませんでした。現在の内容を保持しています。保存設定を確認してください。"); }
  };
  const candidate = selectedCandidate(state);
  const { site, company } = sourceSummary(state);
  const checks = candidateChecks(state, candidate);
  const blockers = agreementBlockers(state, actor);
  const agreed = Boolean(state.agreement);
  const linkedTrips = trips.filter(trip => trip.matchAgreementId === state.agreement?.id);
  const activeTrips = linkedTrips.filter(trip => trip.booking !== "取消" && !["取消", "受入不可"].includes(trip.reservation));
  const stage = journeyStep(state);
  const confirmed = state.confirmations[actor] === state.revision;
  const score = Math.round(checks.filter(check => check.ok).length / checks.length * 100);
  const switchRole = () => location.assign(matchingRolePageUrl(other));
  const nextInstruction = !state.published ? "施工側で搬出条件を確認し、候補一覧へ進みます。"
    : !state.consultationId ? "受入条件を比較して、施工側から事前相談を開始します。"
    : agreed ? "双方が同じ版の条件に合意したため、マッチングが成立しました。次は搬入予約です。"
    : confirmed ? `${actorNames[actor]}の確認が完了しました。${actorNames[other]}の画面で同じ版に合意してください。`
    : `${actorNames[actor]}でサンプル資料と第${state.revision}版の条件を確認してください。`;

  if (previousTrip) return <PreviousAgreement trip={previousTrip} trips={trips} actor={actor} />;
  return <section className="matching-page matching-journey" aria-label="マッチング成立デモ">
    <p className="journey-demo-note" role="note">成立までの操作デモ · 架空の案件です。このブラウザ内にのみ保存し、相手への送信・本番登録・実際の契約は行いません。</p>
    <div className="matching-hero"><div><span>SOIL CIRCULATION MATCHING</span><h2>建設発生土マッチング</h2><p>案件登録から双方の条件合意・予定・受入承認まで、同じ案件で確認できます。</p></div><div className="journey-actions"><button className="primary" onClick={() => agreed ? setResetOpen(true) : setEdit(actor === "receiving" ? "receiving" : state.consultationId ? "terms" : "source")}>{actor === "receiving" ? "受入条件を登録" : "新しい案件を登録"}</button><button className="outline" onClick={onExit}><ChevronLeft /> 通常の候補画面へ</button></div></div>
    <div className="matching-toolbar journey-role-bar">
      <div><b>いまの操作：{actorNames[actor]}（デモ）</b><small>{actor === "construction" ? company : candidate.name}</small></div>
      <button className="outline" onClick={switchRole}>{actorNames[other]}の確認画面へ（デモ）<ChevronRight /></button>
      <button className="outline" onClick={() => setResetOpen(true)}>デモを最初からやり直す</button>
    </div>
    <div className="matching-progress journey-progress" aria-label="成立までの進行状況">{steps.map((step, index) => <span className={index <= stage ? "active" : ""} aria-current={index === stage ? "step" : undefined} key={step}><i>{index + 1}</i>{step}</span>)}</div>
    <div className="journey-next"><p role="status"><b>{agreed ? "成立（デモ）" : "次の操作"}</b> {nextInstruction}</p>{state.consultationId && <button className="outline" onClick={event => event.currentTarget.closest(".matching-journey").querySelector(".journey-verification")?.scrollIntoView({ block: "start", behavior: "instant" })}>{agreed ? "成立内容を確認" : "資料・条件の確認へ"}<ChevronRight /></button>}</div>
    {notice && <p className="journey-feedback" role="status">{notice}</p>}
    {error && <p className="journey-error" role="alert">{error}</p>}
    <div className="matching-workspace">
      <div className="matching-list">
        <div className="matching-list-title"><div><b>{actor === "construction" ? "自社の搬出案件" : state.consultationId ? "相談を受けた搬出案件" : "搬出案件の確認"}</b><small>{state.sourceCaseId} · {state.published ? "デモ内で公開済み" : "下書き"}</small></div></div>
        <section className="journey-source"><h3>{site.name}</h3><p>{company}</p><TermsSummary terms={state.terms} />
          {!state.consultationId && actor === "construction" && <div className="journey-actions"><button className="outline" disabled={unreadable} onClick={() => setEdit("source")}>搬出条件を編集</button>{!state.published && <button className="primary" disabled={unreadable} onClick={() => act({ type: "publish" })}>この搬出条件で候補を確認（デモ）</button>}</div>}
          {!state.published && actor === "receiving" && <p>まず施工側の画面で、搬出条件を確認してください。</p>}
        </section>
        {state.published && <>
          <div className="matching-list-title"><div><b>{actor === "construction" ? "受入候補を比較" : "自社の受入条件"}</b><small>土質・数量・期間・日別上限を比較するデモ判定です。実際の受入可否ではありません。</small></div></div>
          {(actor === "construction" ? matchingCandidatesFor(state) : [candidate]).map(item => {
            const items = candidateChecks(state, item);
            const count = items.filter(check => check.ok).length;
            return <button key={item.id} className={`match-card journey-candidate ${state.selectedId === item.id ? "selected" : ""}`} aria-pressed={state.selectedId === item.id} aria-label={`${item.name}の条件を確認`} disabled={unreadable || !!state.consultationId || actor === "receiving"} onClick={() => { act({ type: "select", id: item.id }); }}>
              <div className="match-score"><b>{count}/4</b><span>条件一致</span></div><div className="match-main"><small>{item.id}</small><h3>{item.name}</h3><p>{item.area}</p><div><span>{item.soil}</span><span>案件上限 {number(item.capacity)} {item.unit}</span></div></div><span className="match-status">{count === 4 ? "条件が一致" : `${items.filter(check => !check.ok).map(check => check.label).join("・")}を確認`}</span>
            </button>;
          })}
          {state.consultationId && <p className="journey-source">相談先を固定しています。別の候補を試す場合はデモを最初からやり直せます。</p>}
        </>}
        <details className="journey-history"><summary>相談・確認の履歴（{state.history.length}件）</summary>{state.history.length ? <ol>{state.history.map(entry => <li key={entry.version}><b>{entry.message}</b><small>{new Date(entry.at).toLocaleString("ja-JP")}</small></li>)}</ol> : <p>操作すると、ここに双方の履歴が表示されます。</p>}</details>
      </div>
      <aside className="match-detail journey-detail" aria-label="選択した候補と合意内容">
        <div className="match-detail-head match-chart-heading"><div><small>{candidate.id}</small><h3>{candidate.name}</h3><p>{candidate.area}</p></div><div className="match-score-chart" style={{ "--score": score }}><div className="match-score-ring"><b>{score}</b><span>%</span></div><small>デモ条件の一致率</small></div></div>
        <div className="match-route-preview journey-route"><MapPin /><span><small>搬出元</small><b>{site.name}</b></span><ChevronRight /><span><small>受入先</small><b>{candidate.name}</b></span></div>
        <details className="match-factor-chart journey-comparison" open={!state.consultationId}><summary><b>受入条件との比較（{checks.filter(check => check.ok).length}/4一致）</b></summary><small>このデモの4条件だけを比較</small><ul className="journey-checks">{checks.map(check => <li key={check.label}><b>{check.ok ? "✓ 一致" : "! 要確認"} · {check.label}</b><span>{check.detail}</span></li>)}</ul></details>
        {!state.consultationId ? <div className="journey-section"><h3>事前相談</h3><p>{!state.published ? "搬出条件を確認すると、受入候補を選べます。" : checks.every(check => check.ok) ? "条件が一致する候補です。相談を開始してから、受入側の確認画面へ進んでください。" : "条件が合わないため相談へ進めません。搬出条件を調整するか、別の候補を選択してください。"}</p><button className="primary" disabled={unreadable || !state.published || actor !== "construction" || !checks.every(check => check.ok)} onClick={() => act({ type: "consult" })}>事前相談を開始（デモ）</button></div>
          : <>
            <section className="journey-section"><div className="journey-section-heading"><h3>合意する条件 · 第{state.revision}版</h3>{!agreed && <button className="outline" disabled={unreadable} onClick={() => setEdit("terms")}>条件を調整</button>}</div><small>{state.consultationId}</small><TermsSummary terms={state.agreement?.terms || state.terms} /></section>
            {!agreed && <section className={`journey-section${!confirmed ? " journey-verification" : ""}`}><h3>1. {actorNames[actor]}で資料を確認</h3><p>土質・搬出計画と受入条件の、サンプル資料を確認します。実ファイルの提出・審査ではありません。</p><button className="outline" aria-expanded={docsOpen} onClick={() => setDocsOpen(!docsOpen)}><FileText /> サンプル資料を開く</button>
              {docsOpen && <div className="journey-documents"><article><h4>土質・搬出計画のサンプル</h4><p>{site.name} / {state.terms.soil} / {number(state.terms.volume)} m³</p><p>{state.terms.start}〜{state.terms.end} / 上限 {state.terms.daily} m³/日</p></article><article><h4>受入条件のサンプル</h4><p>{candidate.name} / {candidate.soil} / 受入上限の例 {number(candidate.capacity)} m³</p><p>{candidate.start}〜{candidate.end} / 上限の例 {candidate.daily} m³/日</p></article>
                {!state.documents[actor] && <><label className="journey-checkbox"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />この版のサンプル資料を確認しました</label><button className="outline" disabled={!reviewed || unreadable} onClick={() => { if (act({ type: "documents" }).ok) setDocsOpen(false); }}>資料の確認を記録（デモ）</button></>}
              </div>}
              <p>{state.documents[actor] ? `✓ ${actorNames[actor]}：第${state.revision}版の資料確認済み` : `${actorNames[actor]}：資料未確認`}</p>
            </section>}
            <section className={`journey-section${agreed || confirmed ? " journey-verification" : ""}`}><h3>{agreed ? "双方の条件合意" : "2. 同じ版の条件に合意"}</h3><ul className="journey-confirmations">{Object.entries(actorNames).map(([key, name]) => <li key={key}><ShieldCheck /><b>{name}</b><span>{state.confirmations[key] === state.revision ? `第${state.revision}版に合意済み` : "合意待ち"}</span></li>)}</ul>
              {!agreed && !confirmed && <><p>土質・数量・期間・日別上限・参考単価を確認してください。相手側も同じ版に合意すると成立します。</p><label className="journey-checkbox"><input type="checkbox" checked={termsChecked} onChange={event => setTermsChecked(event.target.checked)} />第{state.revision}版の条件を確認し、合意します（デモ）</label>{blockers.length > 0 && <ul className="journey-blockers">{blockers.map(issue => <li key={issue}>{issue}</li>)}</ul>}<button className="primary" disabled={unreadable || !termsChecked || !!blockers.length} onClick={() => act({ type: "accept", revision: state.revision })}>{actorNames[actor]}として条件に合意（デモ）</button></>}
              {!agreed && confirmed && <button className="primary" onClick={switchRole}>{actorNames[other]}の確認画面へ（デモ）<ChevronRight /></button>}
              {agreed && <div className="journey-agreed" role="status"><h3>マッチング成立（デモ）</h3><p>双方が第{state.agreement.revision}版の同じ条件に合意しました。</p><b>{state.agreement.id}</b><small>搬出案件 {state.agreement.sourceCaseId} / 受入案件 {state.agreement.targetCaseId}</small><p>成立した条件を固定して表示しています。</p></div>}
            </section>
          </>}
        {agreed && <section className="journey-section"><h3>成立後の手続き</h3><p>合意した条件から日次予定・予約を作成し、受入側が予約を承認してから配車します。</p><ol className="journey-after"><li><b>条件合意</b><span>成立（デモ）</span></li><li><b>搬入予約</b><span>{linkedTrips.length ? `${linkedTrips.length}便の予定・予約あり · 有効 ${activeTrips.length}便${linkedTrips.length !== activeTrips.length ? ` / 取消 ${linkedTrips.filter(trip => trip.booking === "取消" || trip.reservation === "取消").length}便 / 受入不可 ${linkedTrips.filter(trip => trip.reservation === "受入不可").length}便` : ""}` : "未申請"}</span></li><li><b>受入側の予約承認</b><span>{linkedTrips.length ? `承認済み ${activeTrips.filter(trip => trip.reservation === "予約確定").length}便 / 申請中 ${activeTrips.filter(trip => trip.reservation === "申請中").length}便${activeTrips.some(trip => trip.reservation === "変更依頼") ? ` / 変更依頼 ${activeTrips.filter(trip => trip.reservation === "変更依頼").length}便` : ""}` : "未承認"}</span></li><li><b>配車・運行</b><span>{activeTrips.some(trip => trip.vehicleId) ? `手配済み ${activeTrips.filter(trip => trip.vehicleId).length}便` : "未手配"}</span></li></ol>
          {actor === "construction" && <button className="primary" onClick={() => { sessionStorage.setItem("ecodump-matching-plan", state.agreement.id); sessionStorage.setItem("ecodump-dispatch-add", "1"); navigate("配車・運行管理"); }}>合意済み案件から予定を作る</button>}
          {linkedTrips.length > 0 && <><div className="results-table-wrap"><table className="service-table journey-reservations-table"><thead><tr><th>便・予約ID</th><th>予定日・数量</th><th>予約状態</th></tr></thead><tbody>{linkedTrips.map(trip => <tr key={trip.id}><td data-label="便・予約ID">{trip.id}<small>{trip.reservationId}</small></td><td data-label="予定日・数量">{trip.date}<small>{trip.planned} {trip.unit} / {trip.material}</small></td><td data-label="予約状態">{trip.reservation}</td></tr>)}</tbody></table></div><button className="outline" onClick={() => { const trip = linkedTrips.find(item => item.reservation === "申請中") || linkedTrips[0]; sessionStorage.setItem("ecodump-receiving-focus", trip.id); if (actor === "receiving") navigate("搬入予約・受付"); else location.assign(matchingRolePageUrl("receiving", "receiving-reservations", trip.id)); }}>受入側でこの案件の予約を確認</button></>}
        </section>}
      </aside>
    </div>
    {edit === "receiving" ? <ReceivingCaseDialog state={state} save={act} close={() => setEdit(null)} /> : edit && <TermsDialog state={state} actor={actor} mode={edit} save={act} siteOptions={siteOptions} close={() => setEdit(null)} />}
    {resetOpen && <ResetDialog close={() => setResetOpen(false)} reset={reset} />}
  </section>;
}
