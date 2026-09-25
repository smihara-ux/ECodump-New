import {conditionDiff} from "./conditionDiff.mjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchingApi } from "./matchingApi";
import { createMutationJournal } from "../receiving/mutationJournal.mjs";
import "../workflow/matching-workflow.css";
import "./matching.css";
const id = () => crypto.randomUUID();
const unitLabel = (u) => (u === "m3" ? "m³" : u);
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const empty = () => ({
  title: "",
  region: "",
  soil: "第2種建設発生土",
  quantity: 100,
  unit: "m3",
  start: today(),
  end: today(),
  public: "",
  shared: "",
  internal: "",
  documents: [],
});
const states = { draft: "下書き", published: "公開中", closed: "公開終了" };
const Field = ({ label, children }) => (
  <label className="match-field">
    <span>{label}</span>
    {children}
  </label>
);
function Terms({ value, onChange, disabled = false }) {
  const set = (name, v) => onChange({ ...value, [name]: v });
  return (
    <>
      <Field label="土質">
        <input
          required
          value={value.soil}
          disabled={disabled}
          onChange={(e) => set("soil", e.target.value)}
        />
      </Field>
      <Field label="数量">
        <input
          required
          type="number"
          min="0.001"
          max="100000000"
          step="0.001"
          value={value.quantity}
          disabled={disabled}
          onChange={(e) => set("quantity", Number(e.target.value))}
        />
      </Field>
      <Field label="単位">
        <select
          value={value.unit}
          disabled={disabled}
          onChange={(e) => set("unit", e.target.value)}
        >
          <option value="m3">m³</option>
          <option value="t">t</option>
        </select>
      </Field>
      <Field label="期間開始">
        <input
          required
          type="date"
          value={value.start}
          disabled={disabled}
          onChange={(e) => set("start", e.target.value)}
        />
      </Field>
      <Field label="期間終了">
        <input
          required
          type="date"
          min={value.start}
          value={value.end}
          disabled={disabled}
          onChange={(e) => set("end", e.target.value)}
        />
      </Field>
    </>
  );
}
export default function SharedMatching({ role, account=null, embedded=false, onReservation, onManagement }) {
  const sessionKey = `ecodump:match:session:${role}`;
  const [session, setSession] = useState(() =>
    account || JSON.parse(sessionStorage.getItem(sessionKey) || "null"),
  );
  const [email, setEmail] = useState(
      role === "construction"
        ? "construction@sample.invalid"
        : "receiver@sample.invalid",
    ),
    [password, setPassword] = useState("");
  const [direction,setDirection] = useState(role === "construction" ? "receiving" : "construction");
  const [tab, setTab] = useState("探す"),
    [data, setData] = useState(null),
    [filters, setFilters] = useState({
      region: "",
      soil: "",
      quantity: "",
      unit: "m3",
      start: "",
      end: "",
    });
  const [form, setForm] = useState(empty),
    [siteId, setSiteId] = useState(""),
    [editing, setEditing] = useState(null),
    [selected, setSelected] = useState(null),
    [ownId, setOwnId] = useState(""),
    [message, setMessage] = useState("");
  const [bookingTimes, setBookingTimes] = useState({}),
    [terms, setTerms] = useState(null),
    [proposalFor, setProposalFor] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState(null);
  const detailRef=useRef(null);
  useEffect(()=>{if(selected?.id)detailRef.current?.scrollIntoView({block:"nearest"});},[selected?.id]);
  const inFlight = useRef(false),
    generation = useRef(0);
  const api = useMemo(() => matchingApi(session?.token), [session]);
  const journal = useMemo(
    () =>
      session
        ? createMutationJournal({
            storage: localStorage,
            actorId: session.userId,
            scope: "matching",
          })
        : null,
    [session],
  );
  useEffect(() => {
    setSession(account || JSON.parse(sessionStorage.getItem(sessionKey) || "null"));
    setEmail(
      role === "construction"
        ? "construction@sample.invalid"
        : "receiver@sample.invalid",
    );
    setData(null);
    setForm(empty());
    setEditing(null);
    setSelected(null);
    setProposalFor(null);
    setTab("探す");
  }, [role, sessionKey, account]);
  const load = useCallback(async () => {
    const stamp = ++generation.current;
    const result = await api.list(role, filters);
    if (stamp === generation.current) {
      setData(result.data);
      setSelected(previous=>previous ? [...result.data.ownCases,...result.data.searchResults].find(c=>c.id===previous.id)||null : null);
      setError("");
      setSiteId((current) =>
        result.data.sites.some((s) => s.id === current)
          ? current
          : result.data.sites[0]?.id || "",
      );
    }
    return result;
  }, [api, role, filters]);
  useEffect(() => {
    let active = true;
    if (session)
      load().catch((e) => {
        if (active) {
          setData(null);
          setError(e.message);
        }
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [load, session]);
  useEffect(() => {
    try {
      setPending(journal?.read() || null);
    } catch (e) {
      setError(e.message);
    }
  }, [journal]);
  const locked = busy || ["pending", "unknown"].includes(pending?.status);
  async function run(action, body, success) {
    if (inFlight.current || locked) return false;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await journal.submit(
        { action: `match:${action}`, targetId: body.id, version: body.version },
        (key) => api.action(action, body, key),
      );
      try {
        await load();
        setNotice(`${success} DB保存後の再取得を確認しました。`);
      } catch (e) {
        setError(
          `保存応答は確認できましたが、再取得に失敗しました。再取得してください。${e.message}`,
        );
      }
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      try {
        setPending(journal.read());
      } catch (e) {
        setError(e.message);
      }
      setBusy(false);
      inFlight.current = false;
    }
  }
  async function lookup() {
    setBusy(true);
    try {
      const result = await journal.reconcile((key) => api.operation(key));
      setPending(result);
      if (result.status === "confirmed") {
        await load();
        setNotice("処理結果を照会し、保存済みデータを再取得しました。");
      } else
        setNotice(
          "処理結果は未確認です。更新を再送せず、再度照会してください。",
        );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function openEdit(c) {
    setBusy(true);
    try {
      const documents = await Promise.all(
        c.documents.map(
          async (doc) => (await api.document(c.id, doc.id)).document,
        ),
      );
      setEditing(c);
      setForm({ ...empty(), ...c, documents });
      setSiteId(c.siteId);
      setTab("自社の案件");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function attach(files) {
    try {
      if (form.documents.length + files.length > 5)
        throw new Error("資料は5件までです。");
      const docs = await Promise.all(
        [...files].map(async (file) => {
          if (file.size > 1048576) throw new Error("資料は1件1MB以下です。");
          const base64 = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(",")[1]);
            r.onerror = reject;
            r.readAsDataURL(file);
          });
          return {
            id: id(),
            name: file.name,
            mime: file.type,
            base64,
            visibility: "shared",
          };
        }),
      );
      setForm((f) => ({ ...f, documents: [...f.documents, ...docs] }));
    } catch (e) {
      setError(e.message);
    }
  }
  async function download(c, doc) {
    try {
      const { document: d } = await api.document(c.id, doc.id);
      const bytes = Uint8Array.from(atob(d.base64), (v) => v.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: d.mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = d.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    }
  }
  function propose(c) {
    const previous = c.offers.at(-1);
    setProposalFor(c);
    setTerms(
      previous
        ? { ...previous.terms }
        : {
            soil: c.source.soil,
            quantity: Math.min(c.source.quantity, c.target.quantity),
            unit: c.source.unit,
            start: [c.source.start, c.target.start].sort().at(-1),
            end: [c.source.end, c.target.end].sort()[0],
            conditions: "",
            message: "",
          },
    );
  }
  const published =
    data?.ownCases.filter((c) => c.status === "published") || [];
  const selectedOwn = published.find((c) => c.id === ownId) || published[0];
  const sameSide=direction===role;
  const searchCases=sameSide ? (data?.ownCases||[]).filter(c=>c.status==="published" && (!filters.region||c.region.includes(filters.region)) && (!filters.soil||c.soil.includes(filters.soil)) && c.unit===filters.unit && (!filters.quantity||c.quantity>=Number(filters.quantity)) && (!filters.start||c.end>=filters.start) && (!filters.end||c.start<=filters.end)) : data?.searchResults||[];
  return (
    <section
      className={`matching-live shared-match ${embedded ? "business-matching" : ""}`}
      aria-label="共通発生土マッチAPI"
    >
      <header>
        <div>
          <span>{embedded ? "SOIL CIRCULATION MATCHING" : "ECO DUMP · 共通発生土マッチ"}</span>
          <h2>{embedded ? "建設発生土マッチング" : role === "construction" ? "受入れから探す" : "現場から探す"}</h2>
          <p>{embedded ? "公開案件から相談し、条件合意・予約へ進みます。" : "隔離PostgreSQLに保存・共有します。ローカル検証専用の認証です。"}</p>
        </div>
        {session && (
          <div>
            {onManagement&&<button onClick={onManagement}>{role==="receiving"?"受入側管理へ戻る":"施工側管理へ戻る"}</button>}
            <button
              disabled={busy}
              onClick={() =>
                load()
                  .then(() => setNotice("最新データを再取得しました。"))
                  .catch((e) => setError(e.message))
              }
            >
              再取得
            </button>
            {!embedded && <button
              disabled={busy}
              onClick={() => {
                sessionStorage.removeItem(sessionKey);
                setSession(null);
                setData(null);
                setPending(null);
              }}
            >
              接続を解除
            </button>}
          </div>
        )}
      </header>
      {embedded && data && <div className="matching-kpis">{[["公開候補",data.searchResults.length],["自社の案件",data.ownCases.length],["相談・条件調整",data.consultations.length],["成立済み",data.agreements.length]].map(([label,n])=><article key={label}><span>{label}</span><b>{n}件</b></article>)}</div>}
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
      {!session ? (
        <form
          className="match-login"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const s = await api.login(email, password);
              sessionStorage.setItem(sessionKey, JSON.stringify(s));
              setSession(s);
              setPassword("");
              setError("");
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>検証ユーザーで接続</h3>
          <Field label="メールアドレス">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="パスワード">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button disabled={busy}>接続</button>
          <p>
            このローカル環境の検証アカウントを使用してください。本番の認証情報は使用しません。
          </p>
        </form>
      ) : (
        <>
          {["pending", "unknown"].includes(pending?.status) && (
            <div className="match-pending" role="alert">
              前回の更新結果が未確認です。再送せず操作IDで照会します。
              <code>{pending.key}</code>
              <button onClick={lookup} disabled={busy}>
                処理結果を照会
              </button>
            </div>
          )}
          <nav aria-label="発生土マッチの区分">
            {["探す", "自社の案件", "相談・条件調整", "成立済み"].map((v) => (
              <button
                key={v}
                className={tab === v ? "active" : ""}
                aria-pressed={tab===v}
                onClick={() => {
                  setTab(v);
                  setSelected(null);
                }}
              >
                {v}
              </button>
            ))}
          </nav>
          {!data&&!error&&<p role="status">共通DBから案件を取得中…</p>}
          {busy&&<p role="status">処理中…</p>}
          {data && (
            <>
              {tab === "探す" && (
                <>
                  <div className="matching-mode">{[["construction","現場から探す"],["receiving","受入れから探す"]].map(([side,label])=><button key={side} aria-pressed={direction===side} className={direction===side?"active":""} onClick={()=>{setDirection(side);setSelected(null);}}>{label}</button>)}</div>
                  {sameSide && <p>この区分では自社の公開案件を表示しています。取引相手はもう一方の区分から探せます。</p>}
                  <p>
                    数量は選択した単位の下限、期間は重なる案件で検索します。距離・適合度・経路料金は未接続のため確定値を表示しません。
                  </p>
                  <div className="matching-live-filters">
                    {[
                      ["region", "地域", "text"],
                      ["soil", "土質", "text"],
                      ["quantity", "数量下限", "number"],
                      ["start", "検索期間開始", "date"],
                      ["end", "検索期間終了", "date"],
                    ].map(([name, label, type]) => (
                      <Field key={name} label={label}>
                        <input
                          type={type}
                          min={type === "number" ? 0 : undefined}
                          value={filters[name]}
                          onChange={(e) =>
                            setFilters({ ...filters, [name]: e.target.value })
                          }
                        />
                      </Field>
                    ))}
                    <Field label="検索単位">
                      <select
                        value={filters.unit}
                        onChange={(e) =>
                          setFilters({ ...filters, unit: e.target.value })
                        }
                      >
                        <option value="m3">m³</option>
                        <option value="t">t</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="相談に使用する自社案件">
                    <select
                      value={selectedOwn?.id || ""}
                      onChange={(e) => setOwnId(e.target.value)}
                    >
                      <option value="" disabled>
                        公開済みの自社案件を選択
                      </option>
                      {published.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="相談メッセージ">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="相手に確認したい内容"
                    />
                  </Field>
                  <div className="matching-live-list">
                    {searchCases.map((c) => (
                      <article key={c.id}>
                        <b>{c.title}</b>
                        <span>
                          {c.region} · {c.soil}
                        </span>
                        <span>
                          {c.quantity} {unitLabel(c.unit)}
                          <br />
                          {c.start}〜{c.end}
                        </span>
                        <div>
                          <button onClick={() => setSelected(c)}>
                            案件詳細
                          </button>
                          <button
                            disabled={locked || !selectedOwn || sameSide}
                            onClick={async () => {
                              if (
                                await run(
                                  "consult",
                                  {
                                    id: id(),
                                    sourceId: selectedOwn.id,
                                    targetId: c.id,
                                    message,
                                  },
                                  "相談を開始しました。",
                                )
                              ) {
                                setTab("相談・条件調整");
                                setNotice(
                                  "相談メッセージを保存しました。続けて条件を入力・提示してください。",
                                );
                              }
                            }}
                          >
                            事前相談
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!searchCases.length && (
                    <p>検索条件に一致する公開案件はありません。</p>
                  )}
                </>
              )}
              {tab === "自社の案件" && (
                <>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const body = {
                        id: editing?.id || id(),
                        side: role,
                        siteId,
                        version: editing?.version,
                        data: form,
                      };
                      if (
                        await run(
                          editing ? "edit" : "create",
                          body,
                          editing
                            ? "案件の編集を保存しました。"
                            : "下書きを保存しました。",
                        )
                      ) {
                        setEditing(null);
                        setForm(empty());
                      }
                    }}
                  >
                    <h3>{editing ? "案件を編集" : "新しい案件を登録"}</h3>
                    <Field
                      label={role === "construction" ? "搬出場所" : "受入場所"}
                    >
                      <select
                        required
                        disabled={!!editing || locked}
                        value={siteId}
                        onChange={(e) => setSiteId(e.target.value)}
                      >
                        {data.sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="案件名">
                      <input
                        required
                        maxLength={200}
                        value={form.title}
                        onChange={(e) =>
                          setForm({ ...form, title: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="地域">
                      <input
                        required
                        maxLength={200}
                        value={form.region}
                        onChange={(e) =>
                          setForm({ ...form, region: e.target.value })
                        }
                      />
                    </Field>
                    <Terms value={form} onChange={setForm} disabled={locked} />
                    <Field label="公開情報">
                      <textarea
                        value={form.public}
                        onChange={(e) =>
                          setForm({ ...form, public: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="相談相手共有情報・受入条件">
                      <textarea
                        value={form.shared}
                        onChange={(e) =>
                          setForm({ ...form, shared: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="社内情報（相手には非公開）">
                      <textarea
                        value={form.internal}
                        onChange={(e) =>
                          setForm({ ...form, internal: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="関連資料（PDF・PNG・JPEG／1件1MB、5件まで）">
                      <input
                        type="file"
                        multiple
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={(e) => attach(e.target.files)}
                      />
                    </Field>
                    <div className="match-documents">
                      {form.documents.map((doc) => (
                        <div key={doc.id}>
                          <span>{doc.name}</span>
                          <select
                            aria-label={`${doc.name}の共有範囲`}
                            value={doc.visibility}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                documents: form.documents.map((d) =>
                                  d.id === doc.id
                                    ? { ...d, visibility: e.target.value }
                                    : d,
                                ),
                              })
                            }
                          >
                            <option value="public">公開</option>
                            <option value="shared">相談相手のみ</option>
                            <option value="internal">社内のみ</option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                documents: form.documents.filter(
                                  (d) => d.id !== doc.id,
                                ),
                              })
                            }
                          >
                            削除
                          </button>
                        </div>
                      ))}
                    </div>
                    <button className="matching-live-primary" disabled={locked}>
                      {editing ? "編集を保存" : "下書き保存"}
                    </button>
                    {editing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          setForm(empty());
                        }}
                      >
                        編集を中止
                      </button>
                    )}
                  </form>
                  <div className="matching-live-list">
                    {data.ownCases.map((c) => (
                      <article key={c.id}>
                        <b>{c.title}</b>
                        <span>
                          {states[c.status]} · v{c.version}
                        </span>
                        <span>
                          {c.quantity} {unitLabel(c.unit)} · {c.start}〜{c.end}
                        </span>
                        <div>
                          <button disabled={locked} onClick={() => openEdit(c)}>
                            編集
                          </button>
                          <button onClick={() => setSelected(c)}>
                            詳細・変更履歴
                          </button>
                          <button
                            disabled={locked}
                            onClick={() =>
                              run(
                                c.status === "published" ? "close" : "publish",
                                { id: c.id, version: c.version },
                                c.status === "published"
                                  ? "公開を終了しました。"
                                  : "案件を公開しました。",
                              )
                            }
                          >
                            {c.status === "published" ? "公開終了" : "公開"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {tab === "相談・条件調整" && (
                <>
                  <div className="matching-live-list">
                    {data.consultations.map((c) => {
                      const latest = c.offers.at(-1),
                        mine =
                          latest &&
                          c.acceptances.some(
                            (a) => a.offerId === latest.id && a.side === role,
                          );
                      return (
                        <article className="match-consult" key={c.id}>
                          <h3>
                            {c.source.title} → {c.target.title}
                          </h3>
                          <span>
                            {c.state === "agreed"
                              ? "条件合意済み"
                              : "条件調整中"}{" "}
                            · v{c.version}
                          </span>
                          <p>事前相談：{c.initialMessage || "記載なし"}</p>
                          <p>
                            共有条件：{c.source.shared || "未記入"} /{" "}
                            {c.target.shared || "未記入"}
                          </p>
                          {latest && (
                            <p>
                              最新提示 第{latest.revision}版：
                              {latest.terms.quantity}{" "}
                              {unitLabel(latest.terms.unit)} ·{" "}
                              {latest.terms.soil} · {latest.terms.start}〜
                              {latest.terms.end}
                              <br />
                              {latest.terms.conditions}
                              <br />
                              {latest.terms.message}
                            </p>
                          )}
                          <details>
                            <summary>
                              条件提示・同意の履歴（{c.offers.length}版）
                            </summary>
                            {c.offers.map((o,index) => (
                              <div key={o.id}>
                                {index>0&&<ChangeDetails title="前の提示条件からの変更" before={c.offers[index-1].terms} after={o.terms}/>}
                                第{o.revision}版 ·{" "}
                                {o.side === "construction"
                                  ? "施工側"
                                  : "受入側"}{" "}
                                · {o.created_at}
                                <p>
                                  {o.terms.quantity} {unitLabel(o.terms.unit)} /{" "}
                                  {o.terms.start}〜{o.terms.end} /{" "}
                                  {o.terms.conditions} / {o.terms.message}
                                </p>
                                <p>
                                  同意：
                                  {c.acceptances
                                    .filter((a) => a.offerId === o.id)
                                    .map((a) =>
                                      a.side === "construction"
                                        ? "施工側"
                                        : "受入側",
                                    )
                                    .join("・") || "未同意"}
                                </p>
                              </div>
                            ))}
                          </details>
                          {c.state === "consulting" && (
                            <div>
                              <button
                                disabled={locked}
                                onClick={() => {
                                  propose(c);
                                  if (message)
                                    setTerms((t) => ({ ...t, message }));
                                }}
                              >
                                条件を入力・提示
                              </button>
                              <button
                                disabled={locked || !latest || mine}
                                onClick={() =>
                                  run(
                                    "accept",
                                    {
                                      id: c.id,
                                      version: c.version,
                                      offerId: latest.id,
                                    },
                                    "この版の条件に同意しました。",
                                  )
                                }
                              >
                                {mine
                                  ? "この版に同意済み"
                                  : "最新の提示条件に同意"}
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                  {!data.consultations.length && (
                    <p>
                      相談はまだありません。「探す」から公開案件を選んでください。
                    </p>
                  )}
                  {proposalFor && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          await run(
                            "offer",
                            {
                              id: proposalFor.id,
                              version: proposalFor.version,
                              terms,
                            },
                            "条件を提示しました。双方の再同意が必要です。",
                          )
                        )
                          setProposalFor(null);
                      }}
                    >
                      <h3>提示条件を編集</h3>
                      <Terms
                        value={terms}
                        onChange={setTerms}
                        disabled={locked}
                      />
                      <Field label="合意する条件">
                        <textarea
                          value={terms.conditions || ""}
                          onChange={(e) =>
                            setTerms({ ...terms, conditions: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="相手へのメッセージ">
                        <textarea
                          value={terms.message || ""}
                          onChange={(e) =>
                            setTerms({ ...terms, message: e.target.value })
                          }
                        />
                      </Field>
                      <button disabled={locked}>この条件を提示</button>
                      <button
                        type="button"
                        onClick={() => setProposalFor(null)}
                      >
                        閉じる
                      </button>
                    </form>
                  )}
                </>
              )}
              {tab === "成立済み" && (
                <>
                  <p>
                    条件合意は予約確定・配車完了とは別です。合意時点の案件と提示条件を保持します。
                  </p>
                  <div className="matching-live-list">
                    {data.agreements.map((a) => (
                      <article className="match-consult" key={a.id}>
                        <h3>
                          {a.snapshot.source.title} → {a.snapshot.target.title}
                        </h3>
                        <b>条件合意 第{a.snapshot.revision}版</b><p className="matching-agreement-id">合意ID：{a.id}</p><p>予約承認：別途必要 · 配車：別途手配</p>{(()=>{const current=data.consultations.find(c=>c.source.id===a.snapshot.source.id&&c.target.id===a.snapshot.target.id);return current&&<><ChangeDetails title="搬出案件：合意時点と現在の差分" before={a.snapshot.source} after={current.source}/><ChangeDetails title="受入案件：合意時点と現在の差分" before={a.snapshot.target} after={current.target}/></>;})()}
                        <p>
                          {a.snapshot.terms.quantity}{" "}
                          {unitLabel(a.snapshot.terms.unit)} /{" "}
                          {a.snapshot.terms.soil} / {a.snapshot.terms.start}〜
                          {a.snapshot.terms.end}
                        </p>
                        <p>{a.snapshot.terms.conditions}</p>
                        <details>
                          <summary>合意時点の案件を確認</summary>
                          {[a.snapshot.source, a.snapshot.target].map((c) => (
                            <div key={c.id}>
                              <b>
                                {c.title} · v{c.version}
                              </b>
                              <p>
                                {c.region} / {c.quantity} {unitLabel(c.unit)} /{" "}
                                {c.start}〜{c.end}
                              </p>
                              <p>公開：{c.public}</p>
                              <p>相談共有：{c.shared}</p>
                              <p>合意時点の関連資料：</p>
                              {c.documents.map((d) => (
                                <button
                                  key={d.id}
                                  onClick={() => {
                                    const bytes = Uint8Array.from(
                                      atob(d.base64),
                                      (v) => v.charCodeAt(0),
                                    );
                                    const url = URL.createObjectURL(
                                      new Blob([bytes], { type: d.mime }),
                                    );
                                    const link = document.createElement("a");
                                    link.href = url;
                                    link.download = d.name;
                                    link.click();
                                    setTimeout(
                                      () => URL.revokeObjectURL(url),
                                      1000,
                                    );
                                  }}
                                >
                                  {d.name}（合意時点）
                                </button>
                              ))}
                            </div>
                          ))}
                        </details>
                        {a.bookingId ? (
                          <>
                            <p>
                              予約申請作成済み · 予約ID {a.bookingId}
                              （予約の最新状態は搬入予約画面で確認）
                            </p>
                            <button
                              onClick={() => {
                                sessionStorage.setItem(
                                  `ecodump-direct-session:${role}`,
                                  JSON.stringify(session),
                                );
                                if(onReservation) onReservation(a.bookingId);
                                else location.href = `/?data=isolated&role=${role}&date=${(bookingTimes[a.id] || a.snapshot.terms.start).slice(0, 10)}`;
                              }}
                            >
                              {embedded ? "予約を確認" : "共通DBの予約画面へ"}
                            </button>
                          </>
                        ) : (
                          role === "construction" && (
                            <>
                              <Field label="搬入予定日時（日本時間）">
                                <input
                                  type="datetime-local"
                                  value={
                                    bookingTimes[a.id] ||
                                    `${a.snapshot.terms.start}T09:00`
                                  }
                                  min={`${a.snapshot.terms.start}T00:00`}
                                  max={`${a.snapshot.terms.end}T23:59`}
                                  onChange={(e) =>
                                    setBookingTimes({
                                      ...bookingTimes,
                                      [a.id]: e.target.value,
                                    })
                                  }
                                />
                              </Field>
                              <button
                                disabled={locked}
                                className="matching-live-primary"
                                onClick={() => {
                                  const co = data.consultations.find(
                                    (c) =>
                                      c.source.id === a.snapshot.source.id &&
                                      c.target.id === a.snapshot.target.id,
                                  );
                                  run(
                                    "reserve",
                                    {
                                      id: co.id,
                                      plannedAt: `${bookingTimes[a.id] || a.snapshot.terms.start + "T09:00"}:00+09:00`,
                                    },
                                    "搬出予定・搬入予約を作成しました。受入側の予約確定が別途必要です。",
                                  );
                                }}
                              >
                                搬出予定・搬入予約を作成
                              </button>
                            </>
                          )
                        )}
                      </article>
                    ))}
                  </div>
                  {!data.agreements.length && (
                    <p>双方で合意した案件はまだありません。</p>
                  )}
                </>
              )}
              {selected && (
                <section ref={detailRef} className="matching-live-detail" aria-label="案件詳細">
                  <h3>{selected.title}</h3>
                  <p>
                    {selected.region} · {selected.soil} · {selected.quantity}{" "}
                    {unitLabel(selected.unit)}
                  </p>
                  <p>
                    {selected.start}〜{selected.end}
                  </p>
                  <p>公開情報・条件：{selected.public || "記載なし"}</p>{selected.shared===undefined&&<p>相談相手に限定した条件・資料は、相談開始後に表示します。</p>}
                  {selected.shared !== undefined && (
                    <p>相談相手共有：{selected.shared || "記載なし"}</p>
                  )}
                  {selected.internal !== undefined && (
                    <p>社内情報：{selected.internal || "記載なし"}</p>
                  )}
                  <div>
                    {selected.documents.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => download(selected, doc)}
                      >
                        {doc.name} を取得
                      </button>
                    ))}
                  </div>
                  {selected.canEdit && (
                    <details>
                      <summary>案件の変更履歴</summary>
                      {data.history
                        .filter((h) => h.caseId === selected.id)
                        .map((h) => (
                          <p key={h.version}>
                            v{h.version} · {h.at} · {h.snapshot.title} ·{" "}
                            {h.snapshot.quantity} {unitLabel(h.snapshot.unit)} ·{" "}
                            {states[h.snapshot.status]}
                          </p>
                        ))}
                    </details>
                  )}
                  <button onClick={() => setSelected(null)}>閉じる</button>
                </section>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function ChangeDetails({title,before,after}){const changes=conditionDiff(before,after);return <details className="matching-condition-diff"><summary>{title}（{changes.length}項目）</summary>{changes.length?changes.map(c=><div key={c.key}><b>{c.label}</b><span>変更前：{String(c.before)}</span><span>変更後：{String(c.after)}</span></div>):<p>条件の変更はありません。</p>}<p>以前の合意内容は変更されません。変更条件で進める場合は双方で確認してください。</p></details>;}
