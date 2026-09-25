import CapacityChart from './CapacityChart';
import { useState } from "react";
import HomeDrilldown, {SiteSummary, QuantitySummary} from "./HomeDrilldown";
import {filters} from "./receivingSummary.mjs";
import {
  MapPinned,
  Truck,
  Clock3,
  CheckCircle2,
  Plus,
  ArrowRight,
  Download,
  Layers3,
} from "lucide-react";
import {
  createDemoTrips,
  seedLocations,
  demoDate,
  nextDate,
  soils,
  transitionTrip,
  receiptCsv,
} from "../receiving-model.mjs";
import "./receiving.css";

export const receivingPages = [
  "搬出・受入スケジュール",
  "受入場所管理",
  "搬入予約・受付",
  "受入実績・帳票",
  "取引先・基本設定",
];
export function useReceivingWorkspace() {
  const [locations, setLocations] = useState(() =>
    structuredClone(seedLocations),
  );
  const [trips, setTrips] = useState(createDemoTrips);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState("Y-01");
  const [reservationDraft, setReservationDraft] = useState(null);
  const [notice, setNotice] = useState("");
  return {
    locations,
    setLocations,
    trips,
    setTrips,
    selectedTrip,
    setSelectedTrip,
    selectedLocation,
    setSelectedLocation,
    reservationDraft,
    setReservationDraft,
    notice,
    setNotice,
  };
}
export function PrototypeNotice() {
  return (
    <div className="receiving-prototype" role="note">
      <b>受入側の操作試作 · API未接続</b>
      <span>
        変更はこの画面を開いている間だけ保持されます。再読込でリセットされ、相手への送信・DB保存は行いません。
      </span>
    </div>
  );
}
const Badge = ({ children }) => (
  <span
    className={`receiving-badge ${["混雑", "変更依頼", "受入不可", "取消"].includes(children) ? "warning" : ""}`}
  >
    {children}
  </span>
);
const Field = ({ label, children }) => (
  <label className="receiving-field">
    <span>{label}</span>
    {children}
  </label>
);

export function ReceivingWorkspace({ page, model: m, navigate }) {
  const openTrip = (id) => {
    m.setSelectedTrip(id);
    navigate("搬入予約・受付");
  };
  const newReservation = (partner = "サンプル施工会社 A") => {
    m.setSelectedTrip(null);
    m.setReservationDraft({ partner, source: "直接予約" });
    navigate("搬入予約・受付");
  };
  return (
    <section className="receiving-workspace">
      {m.notice && (
        <div className="receiving-notice" role="status">
          {m.notice}
          <button
            aria-label="操作メッセージを閉じる"
            onClick={() => m.setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {page === "搬出・受入スケジュール" && (
        <ReceivingHome
          m={m}
          openTrip={openTrip}
          navigate={navigate}
          newReservation={newReservation}
        />
      )}
      {page === "受入場所管理" && <><div className="receiving-prototype" role="note">容量の定義は未確定です。以下の数量設定はサンプルで、物理容量・月間処理能力・契約枠の空き容量を示しません。</div><Locations m={m} /></>}
      {page === "搬入予約・受付" && (
        <Reservations
          m={m}
          openTrip={openTrip}
          newReservation={newReservation}
        />
      )}
      {page === "受入実績・帳票" && <Results m={m} openTrip={openTrip} />}
      {page === "取引先・基本設定" && (
        <Settings m={m} navigate={navigate} newReservation={newReservation} />
      )}
    </section>
  );
}

export function ReceivingHome({ m, openTrip, navigate, newReservation }) {
  const baseDate=m.live ? new Date().toLocaleDateString("sv-SE", {timeZone:"Asia/Tokyo"}) : demoDate;
  const [day, setDay] = useState(() => m.live ? new URLSearchParams(location.search).get("date") || new Date().toLocaleDateString("sv-SE", {timeZone:"Asia/Tokyo"}) : demoDate);
  const [view, setView] = useState("受入場所別");
  const [locationId, setLocationId] = useState("すべて");
  const [traffic, setTraffic] = useState("すべて");
  const [query, setQuery] = useState("");
  const [selection,setSelection]=useState(null);
  const show=(rows,kind,unit)=>setSelection({ids:rows.map(t=>t.id),kind,unit,date:day});
  const all = m.trips.filter(
    (t) => t.date === day,
  );
  const places = m.locations.filter(
    (l) =>
      (locationId === "すべて" || l.id === locationId) &&
      (traffic === "すべて" || l.congestion === traffic),
  );
  const filtered = all.filter(
    (t) =>
      places.some((l) => l.id === t.locationId) &&
      `${t.id}${t.site}${t.vehicle}${m.locations.find((l) => l.id === t.locationId)?.name}`.includes(
        query,
      ),
  );
  const counts = ['本日の予定','到着予定','待機','受入中','完了','取消','差分','未確認伝票'].map(label=>[label,filtered.filter(filters[label]).length,Truck]);
  return (
    <div className="transport-page receiving-home">
      <div className="schedule-switches">
        <div className="segmented-control">
          {[
            [baseDate, "本日"],
            [nextDate(baseDate), "翌日"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={day === value ? "active" : ""}
              aria-pressed={day === value}
              onClick={() => setDay(value)}
            >
              <b>{label}</b>
              <span>{value}</span>
            </button>
          ))}
        </div>
        <div className="view-switch">
          {["受入場所別", "現場別"].map((value) => (
            <button
              key={value}
              className={view === value ? "active" : ""}
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      {m.live && <Field label="表示日"><input type="date" value={day} onChange={e=>setDay(e.target.value)} /></Field>}
      <div className="receiving-toolbar">
        <Field label="受入場所">
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option>すべて</option>
            {m.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="混雑状況">
          <select value={traffic} onChange={(e) => setTraffic(e.target.value)}>
            {["すべて", "空きあり", "やや混雑", "混雑"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="現場・受入場所・車両を検索">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="便ID・現場名・車両"
          />
        </Field>
        {!m.live && <button className="primary" onClick={() => newReservation()}>
          <Plus size={18} />
          直接予約を試す
        </button>}
      </div>
      <div className="receiving-kpis">
        {counts.map(([label, count, Icon]) => (
          <article key={label}><button onClick={()=>show(filtered,label)} aria-label={`${label}の明細`}>
            <span>
              <Icon size={16} />
              {day === baseDate ? label : label.replace("本日", "選択日の")}
            </span>
            <strong>
              {count}
              <small>便</small>
            </strong></button>
          </article>
        ))}
      </div>
      <QuantitySummary rows={filtered} onSelect={(kind,unit)=>show(filtered,kind,unit)}/>
      {selection&&<HomeDrilldown selection={selection} rows={m.trips} close={()=>setSelection(null)} m={m} navigate={navigate} openTrip={openTrip}/>}
      <div className="receiving-heading">
        <div>
          <h2>搬出・受入スケジュール</h2>
          <p>
            1便ごとの到着と受入状況。荷下ろし報告後も、実績確定までは「受入中」に含めます。
          </p>
        </div>
        <Badge>
          {new Set(filtered.filter(filters["予定"]).map((t) => t.vehicleId||t.vehicle).filter(v=>v!=="未配車")).size}台 / 延べ
          {filtered.filter(filters["予定"]).length}便
        </Badge>
      </div>
      {view === "受入場所別"
        ? places
            .filter(
              (l) => !query || filtered.some((t) => t.locationId === l.id),
            )
            .map((l) => {
              const list = filtered.filter((t) => t.locationId === l.id);
              return (
                <article className="receiving-card" key={l.id}>
                  <div className="receiving-heading">
                    <div className="receiving-place-title">
                      <MapPinned />
                      <div>
                        <small>
                          {l.id} · {l.hours}
                        </small>
                        <h3>{l.name}</h3>
                        <p>
                          到着予定：
                          {list
                            .filter(filters["未着"])
                            .map((t) => t.eta)
                            .sort()
                            .join("、") || "未到着の便なし"}
                        </p>
                      </div>
                    </div>
                    <Badge>{l.congestion}</Badge>
                  </div>
                  <div className="receiving-place-counts">
                    {[
                      ["予定", list.filter(filters["予定"]).length],
                      [
                        "待機",
                        list.filter((t) => t.reception === "待機").length,
                      ],
                      [
                        "受入中",
                        list.filter((t) =>
                          ["受入中", "内容確認待ち"].includes(t.reception),
                        ).length,
                      ],
                      [
                        "完了",
                        list.filter((t) => t.receipt === "実績確定").length,
                      ],
                    ].map(([k, v]) => (
                      <button key={k} onClick={()=>show(list,k)}>{k}<b>{v}便</b></button>
                    ))}
                  </div>
                  <SiteSummary rows={list} onOpen={show}/><details><summary>便一覧・従来の予約詳細</summary><TripTable
                    trips={list}
                    locations={m.locations}
                    openTrip={openTrip}
                    compact
                  /></details>
                  <div className="receiving-actions">
                    <button
                      onClick={() => {
                        m.setSelectedLocation(l.id);
                        navigate("受入場所管理");
                      }}
                    >
                      場所・受入条件
                    </button>
                  </div>
                </article>
              );
            })
        : [...new Set(filtered.map((t) => t.site))].map((site) => (
            <article className="receiving-card" key={site}>
              <h3>{site}</h3>
              <SiteSummary rows={filtered.filter(t=>t.site===site)} onOpen={show}/>
              <TripTable
                trips={filtered.filter((t) => t.site === site)}
                locations={m.locations}
                openTrip={openTrip}
              />
            </article>
          ))}
      {!filtered.length && (
        <p className="receiving-empty">
          該当する予定便はありません。日付と絞り込み条件をご確認ください。
        </p>
      )}
    </div>
  );
}

function TripTable({ trips, locations, openTrip, compact = false }) {
  if (!trips.length) return <p className="receiving-empty">予定なし</p>;
  return (
    <div
      className="receiving-table-scroll"
      tabIndex={0}
      aria-label="便一覧（横スクロール可）"
    >
      <table className="receiving-table">
        <thead>
          <tr>
            <th>便・予約</th>
            <th>到着予定 / 現場</th>
            {!compact && <th>受入場所</th>}
            <th>車両 / 便順</th>
            <th>予定数量</th>
            <th>予約 / 受付</th>
            <th>詳細</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((t) => (
            <tr key={t.id}>
              <td>
                <b>{t.id}</b>
                <small>{t.reservationId}</small>
              </td>
              <td>
                <b>
                  {t.eta}
                  {t.delay ? " · 遅延" : ""}
                </b>
                <small>{t.site}</small>
              </td>
              {!compact && (
                <td>{locations.find((l) => l.id === t.locationId)?.name}</td>
              )}
              <td>
                {t.vehicle}
                <small>{t.rotation || t.sequence ? `車両 第${t.rotation || t.sequence}便` : "配車待ち"}</small>
              </td>
              <td>
                {t.planned} {t.unit}
              </td>
              <td>
                <Badge>{t.reservation}</Badge>
                <small>{t.reception}</small>
              </td>
              <td>
                <button
                  aria-label={`${t.id}の予約詳細`}
                  onClick={() => openTrip(t.id)}
                >
                  詳細 <ArrowRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Locations({ m }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [audience, setAudience] = useState("管理者");
  const location =
    m.locations.find((l) => l.id === m.selectedLocation) || m.locations[0];
  const begin = (isNew = false) => {
    setDraft(
      isNew
        ? {
            ...seedLocations[0],
            id: `Y-${crypto.randomUUID().slice(0, 8)}`,
            name: "",
            address: "",
            entrance: "",
            contact: "",
            privateNotes: "",
            notes: "",
          }
        : { ...location },
    );
    setEditing(true);
  };
  const change = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const textFields = [
    ["name", "場所名"],
    ["address", "所在地"],
    ["hours", "営業時間"],
    ["holidays", "休業日"],
    ["slots", "予約枠（時間帯）"],
    ["notes", "公開する注意事項"],
    ["entrance", "入口・進入方法（取引先限定）"],
    ["contact", "担当者（取引先限定）"],
    ["privateNotes", "取引先だけへの注意事項"],
  ];
  return (
    <>
      <div className="receiving-heading">
        <div>
          <h2>受入場所と条件</h2>
          <p>公開情報と取引先限定情報を分けて管理します。</p>
        </div>
        <button className="primary" onClick={() => begin(true)}>
          <Plus size={18} />
          場所を追加（試作）
        </button>
      </div>
      <div className="receiving-toolbar">
        <Field label="管理する受入場所">
          <select
            value={location.id}
            onChange={(e) => {
              m.setSelectedLocation(e.target.value);
              setEditing(false);
            }}
          >
            {m.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="情報の見え方を確認">
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            {["管理者", "公開閲覧者", "取引先"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      </div>
      {editing ? (
        <form
          className="receiving-card"
          onSubmit={(e) => {
            e.preventDefault();
            m.setLocations((prev) =>
              prev.some((l) => l.id === draft.id)
                ? prev.map((l) => (l.id === draft.id ? draft : l))
                : [...prev, draft],
            );
            m.setSelectedLocation(draft.id);
            setEditing(false);
            m.setNotice(
              "場所の編集を試作内に反映しました。DB保存・公開はしていません。",
            );
          }}
        >
          <h3>受入場所の編集（試作）</h3>
          <div className="receiving-form-grid">
            {textFields.map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  required
                  value={draft[key]}
                  onChange={(e) => change(key, e.target.value)}
                />
              </Field>
            ))}
            <Field label="受入可能土質">
              <select
                value={draft.soil}
                onChange={(e) => change("soil", e.target.value)}
              >
                {soils.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="受入可能数量（m³）">
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={draft.capacity}
                onChange={(e) => change("capacity", Number(e.target.value))}
              />
            </Field>
            <Field label="1予約枠の上限（台）">
              <input
                type="number"
                min="1"
                step="1"
                required
                value={draft.slotLimit}
                onChange={(e) => change("slotLimit", Number(e.target.value))}
              />
            </Field>
            <Field label="公開範囲">
              <select
                value={draft.visibility}
                onChange={(e) => change("visibility", e.target.value)}
              >
                <option>公開</option>
                <option>取引先のみ</option>
              </select>
            </Field>
            <Field label="混雑状況（手動・試作）">
              <select
                value={draft.congestion}
                onChange={(e) => change("congestion", e.target.value)}
              >
                {["空きあり", "やや混雑", "混雑"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <p>
            営業時間・休業日・枠は試作用設定です。予約容量の自動検証・公開制御はAPI接続時に実装します。
          </p>
          <div className="receiving-actions">
            <button type="button" onClick={() => setEditing(false)}>
              編集を取り消す
            </button>
            <button className="primary">試作に反映（保存なし）</button>
          </div>
        </form>
      ) : (
        <article className="receiving-card">
          <div className="receiving-heading">
            <h3>{location.name}</h3>
            <Badge>{location.visibility}</Badge>
          </div>
          {audience === "公開閲覧者" && location.visibility === "取引先のみ" ? (
            <p className="receiving-empty">
              この場所は公開されません。取引先にだけ表示する設定です。
            </p>
          ) : (
            <>
              <CapacityChart key={location.id} name={location.name}/><dl className="receiving-definitions">
                {[
                  ["所在地", location.address],
                  ["営業時間", location.hours],
                  ["休業日", location.holidays],
                  ["受入可能土質", location.soil],
                  ["受入可能数量", `${location.capacity} m³`],
                  ["予約枠", `${location.slots}（各${location.slotLimit}台）`],
                  ["公開注意事項", location.notes],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              {audience !== "公開閲覧者" && (
                <div className="receiving-private">
                  <b>取引先限定</b>
                  <dl className="receiving-definitions">
                    {[
                      ["入口", location.entrance],
                      ["担当者", location.contact],
                      ["限定注意事項", location.privateNotes],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </>
          )}
          {audience === "管理者" && (
            <div className="receiving-actions">
              <button className="primary" onClick={() => begin()}>
                場所・条件を編集
              </button>
            </div>
          )}
          <p className="receiving-muted">
            表示範囲の試作です。実際のアクセス制御や外部公開はしていません。
          </p>
        </article>
      )}
    </>
  );
}

function Reservations({ m, openTrip, newReservation }) {
  const [filter, setFilter] = useState("すべて");
  const [query, setQuery] = useState("");
  const selected = m.trips.find((t) => t.id === m.selectedTrip);
  const list = m.trips.filter(
    (t) =>
      (filter === "すべて" ||
        t.reservation === filter ||
        t.reception === filter) &&
      `${t.id}${t.reservationId}${t.site}${t.vehicle}`.includes(query),
  );
  if (m.reservationDraft) return <ReservationForm m={m} />;
  if (selected)
    return <ReservationDetail key={selected.id} trip={selected} m={m} />;
  return (
    <>
      <div className="receiving-heading">
        <div>
          <h2>搬入予約・受付</h2>
          <p>
            予約承認から到着、受入内容の確認、実績確定までを1便ずつ確認します。
          </p>
        </div>
        <button className="primary" onClick={() => newReservation()}>
          既存取引先へ直接予約（試作）
        </button>
      </div>
      <div className="receiving-toolbar">
        <Field label="予約・受付状態">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {[
              "すべて",
              "申請中",
              "変更依頼",
              "予約確定",
              "待機",
              "受入中",
              "内容確認待ち",
              "完了",
              "受入不可",
              "取消",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="予約を検索">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="便ID・予約ID・現場・車両"
          />
        </Field>
      </div>
      <div className="receiving-card">
        <TripTable trips={list} locations={m.locations} openTrip={openTrip} />
      </div>
    </>
  );
}

function ReservationForm({ m }) {
  const [error, setError] = useState("");
  return (
    <form
      className="receiving-card"
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        if (!data.agreement) {
          setError("条件合意の確認が必要です。");
          return;
        }
        const id = `T-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
        const row = {
          ...createDemoTrips()[0],
          id,
          reservationId: `R-${id.slice(2)}`,
          sequence: 1,
          ...data,
          planned: Number(data.planned),
          source: m.reservationDraft.source,
          agreement: "条件合意済み（試作確認）",
          reservation: "申請中",
          reception: "未到着",
          driverReport: false,
          tripStatus: "未配車",
          vehicle: "未割当",
          driver: "未割当",
          actual: "",
          actualSoil: "",
          receipt: "未確定",
          confirmedAt: "",
          confirmedBy: "",
          history: ["予約申請を試作内に追加（未送信）"],
        };
        m.setTrips((prev) => [...prev, row]);
        m.setReservationDraft(null);
        m.setSelectedTrip(id);
        m.setNotice(
          "申請中の予約を試作内に追加しました。相手への申請・枠確保・DB保存はしていません。",
        );
      }}
    >
      <h2>搬入予約の下書き（試作）</h2>
      <p>
        {m.reservationDraft.source} ·
        条件合意と予約確定は別です。追加後に受入側の承認が必要です。
      </p>
      <div className="receiving-form-grid">
        <Field label="取引先">
          <input
            name="partner"
            required
            defaultValue={m.reservationDraft.partner || "サンプル施工会社 A"}
          />
        </Field>
        <Field label="搬出現場">
          <input
            name="site"
            required
            defaultValue={m.reservationDraft.site || "サンプル搬出現場 A"}
          />
        </Field>
        <Field label="予約先の受入場所">
          <select name="locationId">
            {m.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="搬入日">
          <input
            type="date"
            name="date"
            defaultValue={demoDate}
            min={demoDate}
            required
          />
        </Field>
        <Field label="到着予定">
          <input type="time" name="eta" defaultValue="14:00" required />
        </Field>
        <Field label="予定数量">
          <input
            name="planned"
            type="number"
            min="0.1"
            step="0.1"
            defaultValue="8"
            required
          />
        </Field>
        <Field label="数量単位">
          <select name="unit">
            <option>m³</option>
            <option>t</option>
          </select>
        </Field>
        <Field label="予定土質">
          <select name="soil">
            {soils.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      </div>
      <label className="receiving-check">
        <input type="checkbox" name="agreement" required />
        サンプル条件の合意確認を試す（実際の合意・書類審査は未接続）
      </label>
      <p>
        この試作では1予約1便を追加します。複数便・休業日・予約枠容量の自動検証は未接続です。
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="receiving-actions">
        <button type="button" onClick={() => m.setReservationDraft(null)}>
          戻る
        </button>
        <button className="primary">申請を試作に追加（未送信）</button>
      </div>
    </form>
  );
}

function ReservationDetail({ trip: t, m }) {
  const [reason, setReason] = useState("");
  const [eta, setEta] = useState(t.eta);
  const [planned, setPlanned] = useState(t.planned);
  const [actual, setActual] = useState(t.actual);
  const [actualSoil, setActualSoil] = useState(t.actualSoil || t.soil);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const location = m.locations.find((l) => l.id === t.locationId);
  const terminal =
    t.receipt === "実績確定" || ["受入不可", "取消"].includes(t.reservation);
  const act = (action) => {
    try {
      const updated = transitionTrip(t, action, {
        reason,
        eta,
        planned,
        actual,
        actualSoil,
        unit: t.unit,
      });
      m.setTrips((prev) =>
        prev.map((row) => (row.id === t.id ? updated : row)),
      );
      setError("");
      setConfirming(false);
      m.setNotice(
        "状態を試作内で変更しました。DB保存・通知・相手への送信はしていません。",
      );
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <>
      <button onClick={() => m.setSelectedTrip(null)}>← 予約一覧へ</button>
      <article className="receiving-card receiving-detail">
        <div className="receiving-heading">
          <div>
            <small>
              {t.reservationId} · {t.source}
            </small>
            <h2>
              {t.id} / 車両 第{t.rotation || t.sequence}便
            </h2>
          </div>
          <Badge>{t.reservation}</Badge>
        </div>
        <div className="receiving-state-grid">
          {[
            ["条件合意", t.agreement],
            ["予約", t.reservation],
            ["運行", t.tripStatus],
            ["受入実績", t.receipt],
          ].map(([k, v]) => (
            <div key={k}>
              <small>{k}</small>
              <b>{v}</b>
            </div>
          ))}
        </div>
        <dl className="receiving-definitions">
          {[
            ["搬入日・到着予定", `${t.date} ${t.eta}`],
            ["搬出元 / 取引先", `${t.site} / ${t.partner}`],
            ["受入場所", location?.name],
            ["入口", location?.entrance],
            ["車両 / ドライバー", `${t.vehicle} / ${t.driver}`],
            ["予定数量 / 土質", `${t.planned} ${t.unit} / ${t.soil}`],
            [
              "実績数量 / 土質",
              t.actual === ""
                ? "未入力"
                : `${t.actual} ${t.unit} / ${t.actualSoil}`,
            ],
            ["受付状態", t.reception],
            [
              "ドライバー荷下ろし報告",
              t.driverReport
                ? "報告済み（サンプル）・実績確定とは別"
                : "未報告",
            ],
            ["遅延", t.delay || "なし"],
            ["判断理由", t.reason || "—"],
            ["差異理由", t.differenceReason || "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {!terminal && (
          <>
            <div className="receiving-form-grid">
              <Field label="判断・変更・差異の理由">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="変更依頼・受入不可・取消・遅延・数量差異では必須"
                />
              </Field>
              {["未到着"].includes(t.reception) && (
                <Field label="到着予定の変更">
                  <input
                    type="time"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                  />
                </Field>
              )}
              {t.reservation === "変更依頼" && (
                <Field label={`変更後の予定数量（${t.unit}）`}>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={planned}
                    onChange={(e) => setPlanned(e.target.value)}
                  />
                </Field>
              )}
            </div>
            <div className="receiving-actions">
              {t.reservation === "申請中" && (
                <>
                  <button className="primary" onClick={() => act("approve")}>
                    予約を承認（試作）
                  </button>
                  <button onClick={() => act("change")}>
                    変更依頼（試作）
                  </button>
                </>
              )}
              {t.reservation === "変更依頼" && (
                <button className="primary" onClick={() => act("resubmit")}>
                  変更内容で再申請を試す
                </button>
              )}
              {t.reservation === "予約確定" && t.reception === "未到着" && (
                <>
                  <button className="primary" onClick={() => act("arrive")}>
                    到着受付（試作）
                  </button>
                  <button onClick={() => act("delay")}>
                    遅延・到着予定を反映（試作）
                  </button>
                </>
              )}
              {t.reception === "待機" && (
                <button className="primary" onClick={() => act("start")}>
                  受入開始（試作）
                </button>
              )}
              {!t.driverReport && (
                <button onClick={() => act("reject")}>
                  受入不可（理由必須）
                </button>
              )}
              {t.reception === "未到着" && (
                <button onClick={() => act("cancel")}>
                  予約取消（理由必須）
                </button>
              )}
            </div>
            {t.reception === "受入中" && (
              <div className="receiving-private">
                <h3>ドライバー報告の受信を試す</h3>
                <p>
                  実際のアプリとは未接続です。このボタンは外部報告のサンプルを反映するだけで、受入実績を確定しません。
                </p>
                <button onClick={() => act("driver-report")}>
                  荷下ろし完了のサンプル報告を反映
                </button>
              </div>
            )}
            {t.driverReport && (
              <div className="receiving-private">
                <h3>受入内容の確認</h3>
                <p>
                  予定 {t.planned} {t.unit} /
                  実績を別に入力してください。単位の自動換算は行いません。
                </p>
                <div className="receiving-form-grid">
                  <Field label={`実績数量（${t.unit}）`}>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={actual}
                      onChange={(e) => setActual(e.target.value)}
                    />
                  </Field>
                  <Field label="確認した土質">
                    <select
                      value={actualSoil}
                      onChange={(e) => setActualSoil(e.target.value)}
                    >
                      {soils.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="receiving-actions">
                  <button onClick={() => act("review")}>
                    受入内容を確認（試作）
                  </button>
                  {t.receipt === "内容確認済み" && (
                    <button
                      className="primary"
                      onClick={() => setConfirming(true)}
                    >
                      実績確定の確認へ
                    </button>
                  )}
                </div>
                {confirming && (
                  <div
                    className="receiving-confirm"
                    role="group"
                    aria-label="実績確定の確認"
                  >
                    <b>
                      確認済み数量 {t.actual} {t.unit} / {t.actualSoil}
                    </b>
                    <p>
                      この確認済み値を試作内で確定します。未反映の入力値は含みません。正式な受入証明は発行されません。
                    </p>
                    <button className="primary" onClick={() => act("confirm")}>
                      この内容で実績確定を試す
                    </button>
                    <button onClick={() => setConfirming(false)}>戻る</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {t.receipt === "実績確定" && (
          <div className="receiving-private">
            <h3>実績確定（試作）</h3>
            <p>
              {t.actual} {t.unit} · {t.confirmedBy} · {t.confirmedAt}
            </p>
            <p>正式記録は未保存です。確定後の訂正申請は未実装です。</p>
          </div>
        )}
        {error && (
          <p className="receiving-error" role="alert">
            {error}
          </p>
        )}
        <details>
          <summary>この試作内の操作履歴</summary>
          <ul>
            {t.history.map((entry, i) => (
              <li key={i}>{entry}</li>
            ))}
          </ul>
        </details>
      </article>
    </>
  );
}

function Results({ m, openTrip }) {
  const [state, setState] = useState("すべて");
  const [date, setDate] = useState("");
  const rows = m.trips.filter(
    (t) =>
      t.driverReport &&
      (state === "すべて" || t.receipt === state) &&
      (!date || t.date === date),
  );
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([receiptCsv(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ECO_DUMP_受入実績_試作.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    m.setNotice(
      "表示中の試作データをCSVに出力しました。正式帳票ではありません。",
    );
  };
  return (
    <>
      <div className="receiving-heading">
        <div>
          <h2>実績・帳票</h2>
          <p>荷下ろし完了と受入実績確定を分けて表示します。</p>
        </div>
        <button onClick={download}>
          <Download size={18} />
          試作CSVを出力
        </button>
      </div>
      <div className="receiving-toolbar">
        <Field label="実績確定状態">
          <select value={state} onChange={(e) => setState(e.target.value)}>
            {["すべて", "未確定", "内容確認済み", "実績確定"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="実績の搬入日">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <div className="receiving-card">
        <div
          className="receiving-table-scroll"
          tabIndex={0}
          aria-label="実績一覧（横スクロール可）"
        >
          <table className="receiving-table">
            <thead>
              <tr>
                <th>便 / 現場</th>
                <th>予定数量</th>
                <th>実績数量</th>
                <th>差異</th>
                <th>ドライバー報告</th>
                <th>受入実績</th>
                <th>確認</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <b>{t.id}</b>
                    <small>{t.site}</small>
                  </td>
                  <td>
                    {t.planned} {t.unit}
                  </td>
                  <td>
                    {t.actual === "" ? "未入力" : `${t.actual} ${t.unit}`}
                  </td>
                  <td>
                    {t.actual === ""
                      ? "—"
                      : `${(t.actual - t.planned).toFixed(1)} ${t.unit}`}
                  </td>
                  <td>荷下ろし完了</td>
                  <td>
                    <Badge>{t.receipt}</Badge>
                  </td>
                  <td>
                    <button onClick={() => openTrip(t.id)}>
                      {t.receipt === "実績確定" ? "確定内容" : "実績を確認"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="receiving-empty">条件に一致する実績はありません。</p>
        )}
        <p className="receiving-muted">
          計量票・正式受入証明・PDF帳票・訂正申請は未接続です。
        </p>
      </div>
    </>
  );
}
function Settings({ navigate, newReservation }) {
  return (
    <>
      <div className="receiving-heading">
        <div>
          <h2>取引先・基本設定</h2>
          <p>既存取引先への直接予約と、共通の基本台帳を利用します。</p>
        </div>
      </div>
      <article className="receiving-card">
        <h3>既存取引先（匿名サンプル）</h3>
        {["サンプル施工会社 A", "サンプル施工会社 B"].map((name) => (
          <div className="receiving-partner" key={name}>
            <div>
              <b>{name}</b>
              <p>条件合意・書類確認後に、マッチングを経由せず予約します。</p>
            </div>
            <button className="primary" onClick={() => newReservation(name)}>
              直接予約を試す
            </button>
          </div>
        ))}
      </article>
      <article className="receiving-card">
        <h3>共通の基本台帳</h3>
        <p>
          既存画面につながります。既存台帳の登録・編集もAPI保存は未接続です。
        </p>
        <div className="receiving-actions">
          {["会社情報", "ユーザー一覧", "車両一覧", "代行先一覧", "代行登録申請", "自社の代行元一覧", "入退場管理"].map(
            (name) => (
              <button key={name} onClick={() => navigate(name)}>
                {name}
                <ArrowRight size={14} />
              </button>
            ),
          )}
        </div>
      </article>
      <article className="receiving-card">
        <h3>権限・通知・事業切替</h3>
        <p>
          施工側／受入側は、それぞれの管理画面入口から利用します。実際の会社・ユーザー・場所別の認可や通知送信は未接続です。
        </p>
      </article>
    </>
  );
}
