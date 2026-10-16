import ReservationDetail from './ReservationDetail.jsx';
import {useDemoTrips,writeDemoTrips,demoNotice} from '../demo/store.jsx';
import {asReceiving,mergeReceiving,demoLocations,demoSites,demoCompany} from '../demo/model.mjs';
import DailyCapacity from './DailyCapacity.jsx';
import ReceivingVehicleSummary, {receivingVehicleExport} from './ReceivingVehicleSummary.jsx';
import TripList,{demoReportRows,transportRows} from './TripList';
import {downloadTransportWorkbook,reportTotals,formatReportQuantity} from '../reports/transportReport.mjs';
import {DemoNotice} from '../review/Readability';
import { matchingRolePageUrl } from '../demo/matchingRoutes.mjs';
import { validateMatchingPlan } from '../demo/matchingPlan.mjs';
import DateControls from './DateControls';
import {useReceivingView,useListPosition} from './viewState';
import CapacityChart from './CapacityChart';
import { useEffect,useState } from "react";
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
    seedLocations.slice(0,2).map((l,i)=>({...structuredClone(l),...demoLocations[i]})),
  );
  const sharedTrips=useDemoTrips();
  const trips=sharedTrips.map(asReceiving);
  const setTrips=(update)=>writeDemoTrips(previous=>{
    const before=previous.map(asReceiving),next=typeof update==='function'?update(before):update;
    return next.map(r=>{const old=previous.find(t=>t.id===r.id);if(old)return mergeReceiving(old,r);
      const site=demoSites.find(s=>s.name===r.site),location=demoLocations.find(l=>l.id===r.locationId);
      return {...r,siteId:site?.id||r.site,departure:r.site,destination:location?.name||'未設定',company:r.partner||demoCompany,driverId:r.driverId||'',vehicleId:r.vehicleId||'',departAt:r.departAt||'08:30',arriveAt:r.eta,booking:'有効',reported:null,confirmed:null,received:null,slip:'未提出',material:r.soil,assignmentVersion:1,operation:'未手配',issue:'なし',correctionHistory:'訂正なし',history:r.history||[]};});
  });
  const [selectedTrip, setSelectedTrip] = useState(() => new URLSearchParams(location.search).get("matchTrip"));
  const [selectedLocation, setSelectedLocation] = useState("Y-01");
  const [reservationDraft, setReservationDraft] = useState(null);
  const [notice, setNotice] = useState("");
  const [returnPage, setReturnPage] = useState('搬入予約・受付');
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
    returnPage,
    setReturnPage,
  };
}
export function PrototypeNotice() {
  return <DemoNotice className="receiving-prototype" />;
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
    m.setReturnPage?.(page);
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
      {page === "受入場所管理" && <><Locations m={m} /><details className="receiving-advanced"><summary>日次の受入枠を確認・設定</summary><p>数量設定はサンプルです。物理容量・月間処理能力・契約枠の空き容量を示しません。</p><DailyCapacity locations={m.locations} trips={m.trips}/></details></>}
      {page === "搬入予約・受付" && (
        <Reservations
          m={m}
          openTrip={openTrip}
          newReservation={newReservation}
          navigate={navigate}
        />
      )}
      {page === "受入実績・帳票" && <Results m={m} openTrip={openTrip} navigate={navigate}/>}
      {page === "取引先・基本設定" && (
        <Settings m={m} navigate={navigate} newReservation={newReservation} />
      )}
    </section>
  );
}

export function ReceivingHome({ m, openTrip, navigate, newReservation }) {
  const baseDate=m.live ? new Date().toLocaleDateString("sv-SE", {timeZone:"Asia/Tokyo"}) : demoDate;
  const scope=m.session?.userId||'demo';
  const [screen,updateScreen]=useReceivingView(scope,{date:baseDate,locationId:'すべて',query:'',traffic:'すべて',view:'受入場所別'});
  const {date:day,locationId,query,traffic,view}=screen;
  const setDay=value=>updateScreen({date:value});
  const setLocationId=value=>updateScreen({locationId:value});
  const setQuery=value=>updateScreen({query:value});
  const setTraffic=value=>updateScreen({traffic:value});
  const setView=value=>updateScreen({view:value});
  const status=screen.homeStatus||'すべて';
  const setStatus=homeStatus=>updateScreen({homeStatus});
  const homeRef=useListPosition(`${scope}:home`);
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
  const filtered = all.sort((a,b)=>a.eta.localeCompare(b.eta)).filter(
    (t) =>
      places.some((l) => l.id === t.locationId) &&
      `${t.id}${t.site}${t.vehicle}${m.locations.find((l) => l.id === t.locationId)?.name}`.includes(
        query,
      ),
  );
  const displayed=filtered.filter(t=>!filters[status]||filters[status](t));
  return (
    <div className="transport-page receiving-home" ref={homeRef}>
      <div className="receiving-sticky-controls"><div className="schedule-switches">
        <DateControls value={day} onChange={setDay} todayValue={baseDate}/>
        <button onClick={()=>navigate('受入実績・帳票')}>受入実績を見る</button><details className="receiving-quota-note"><summary>受入枠と残量：算定条件未設定</summary><p>日次枠は受入場所管理で確認できます。契約枠・物理容量とは別です。未消化予約、部分受入、取消・訂正の消化ルールと同時予約の制御は決定待ちのため、受入可能残量・新規予約可能量は算出していません。</p><button onClick={()=>navigate('受入場所管理')}>受入条件・日次枠の設定を見る</button></details>
      </div>

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
        <Field label="運搬・受付状態"><select value={status} onChange={e=>setStatus(e.target.value)}>{['すべて','有効予定','受入完了','受入待ち','取消','未到着','待機','受入中','未確認伝票'].map(s=><option key={s}>{s}</option>)}</select></Field>
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
      </div>
      <ReceivingVehicleSummary rows={filtered} selected={status} onSelect={key=>setStatus(status===key?'すべて':key)}/>
      <QuantitySummary rows={filtered} onSelect={(kind,unit)=>show(filtered,kind,unit)}/>
      {selection&&<HomeDrilldown selection={selection} rows={m.trips} close={()=>setSelection(null)} m={m} navigate={navigate} openTrip={openTrip}/>}
      <div className="receiving-heading">
        <div>
          <h2>搬出・受入スケジュール</h2>
          <div className="view-switch">{["受入場所別", "現場別"].map(value => <button key={value} className={view === value ? "active" : ""} aria-pressed={view === value} onClick={() => setView(value)}>{value}</button>)}</div>
          <p role="status">{day} · {view}で表示中。日付・検索・受入場所の条件は保持しています。</p>
          <p>
            1便ごとの到着と受入状況。荷下ろし報告後も、実績確定までは「受入中」に含めます。
          </p>
        </div>
        <Badge>{receivingVehicleExport(displayed).予定台数}</Badge>
      </div>
      {view === "受入場所別"
        ? places
            .filter(
              (l) => (!query&&status==='すべて') || displayed.some((t) => t.locationId === l.id),
            )
            .map((l) => {
              const list = displayed.filter((t) => t.locationId === l.id);
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
        : [...new Set(displayed.map((t) => t.site))].map((site) => (
            <article className="receiving-card" key={site}>
              <h3>{site}</h3>
              <SiteSummary rows={displayed.filter(t=>t.site===site)} onOpen={show}/>
              <TripTable
                trips={displayed.filter((t) => t.site === site)}
                locations={m.locations}
                openTrip={openTrip}
              />
            </article>
          ))}
      {!displayed.length && (
        <p className="receiving-empty">
          該当する予定便はありません。日付と絞り込み条件をご確認ください。
        </p>
      )}
    </div>
  );
}

function TripTable({trips,locations,openTrip}){return <TripList rows={trips.every(t=>t.evidence)?transportRows(trips.map(t=>t.evidence)):demoReportRows(trips,locations)} onOpen={openTrip}/>;}

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
            <Field label="1予約枠の上限（便）">
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
              <details className="receiving-advanced"><summary>容量グラフの表示例を見る（サンプル）</summary><CapacityChart key={location.id} name={location.name} locationId={location.id}/></details><dl className="receiving-definitions">
                {[
                  ["所在地", location.address],
                  ["営業時間", location.hours],
                  ["休業日", location.holidays],
                  ["受入可能土質", location.soil],
                  ["受入可能数量", `${location.capacity} m³`],
                  ["予約枠", `${location.slots}（各${location.slotLimit}便）`],
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

function Reservations({ m, openTrip, newReservation, navigate }) {
  const [screen,update]=useReceivingView('demo:reservations',{filter:'すべて',query:'',date:''});
  const {filter,query,date}=screen;
  const setFilter=filter=>update({filter}),setQuery=query=>update({query});
  const listRef=useListPosition('demo:reservations',!m.selectedTrip&&!m.reservationDraft);
  useEffect(()=>{const id=sessionStorage.getItem('ecodump-receiving-focus');if(id){sessionStorage.removeItem('ecodump-receiving-focus');m.setSelectedTrip(id);}},[]);
  const selected = m.trips.find((t) => t.id === m.selectedTrip);
  const list=m.trips.filter(t=>{
    const matches=filter==='すべて'||t.reservation===filter||t.reception===filter||
      (filter==='承認待ち'&&t.reservation==='申請中')||
      (filter==='到着受付待ち'&&t.reservation==='予約確定'&&t.reception==='未到着')||
      (filter==='数量確認待ち'&&t.driverReport&&t.receipt!=='実績確定'&&!['取消','受入不可'].includes(t.reservation));
    const text=`${t.id} ${t.reservationId} ${t.site} ${t.partner} ${t.driver} ${t.vehicle} ${m.locations.find(l=>l.id===t.locationId)?.name||''}`.toLocaleLowerCase();
    return matches&&(!date||t.date===date)&&text.includes(query.trim().toLocaleLowerCase());
  });
  if (m.reservationDraft) return <ReservationForm m={m} />;
  if (selected)
    return <ReservationDetail key={`${selected.id}:${selected.assignmentVersion}`} trip={selected} m={m} navigate={navigate}/>;
  return (
    <section ref={listRef}>
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
        <Field label="予約日（空欄は全日）"><input type="date" value={date} onChange={e=>update({date:e.target.value})}/></Field>
        <Field label="予約・受付状態">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {[
              "すべて",
              "承認待ち",
              "到着受付待ち",
              "数量確認待ち",
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
            placeholder="便ID・予約ID・現場・取引先・車両・担当"
          />
        </Field>
      </div>
      <div className="receiving-filter-actions" aria-label="対応が必要な予約を絞り込む">{['すべて','承認待ち','到着受付待ち','数量確認待ち'].map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value}</button>)}</div>
      <div className="receiving-heading"><p role="status">{date||'全日'} · {filter} · {list.length}件{query&&` · 検索「${query}」`}</p>{(filter!=='すべて'||query||date)&&<button onClick={()=>update({filter:'すべて',query:'',date:''})}>予約の絞り込みを解除</button>}</div>
      {!list.length&&<div className="receiving-empty"><p>現在の日付・状態・検索条件に一致する予約はありません。条件を変えるか、絞り込みを解除してください。</p></div>}
      <div className="receiving-card">
        <TripTable trips={list} locations={m.locations} openTrip={openTrip} />
      </div>
    </section>
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
          sourceCaseId: m.reservationDraft.sourceCaseId || null,
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
      {m.reservationDraft.sourceCaseId && <p>搬出案件 {m.reservationDraft.sourceCaseId} · 案件総量 {m.reservationDraft.totalVolume} · 下の予定数量は1便分です。条件合意を模した入力確認で、実際の成立案件からの引き継ぎではありません。</p>}
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
          <select name="locationId" defaultValue={m.reservationDraft.locationId || m.locations[0]?.id}>
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
          <select name="unit" defaultValue={m.reservationDraft.unit || "m³"}>
            <option>m³</option>
            <option>t</option>
          </select>
        </Field>
        <Field label="予定土質">
          <select name="soil" defaultValue={m.reservationDraft.soil || soils[0]}>
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


function Results({m,openTrip,navigate}) {
  const [screen,update]=useReceivingView('demo',{date:demoDate,locationId:'すべて',query:''});
  const end=screen.resultsEnd&&screen.resultsEnd>=screen.date?screen.resultsEnd:screen.date;
  const source=screen.resultsSource||'',receiptState=screen.receiptState||'すべて';
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const root=useListPosition('demo:results');
  const trips=m.trips.filter(t=>(receiptState==='すべて'||t.receipt===receiptState)&&t.date>=screen.date&&t.date<=end&&(screen.locationId==='すべて'||t.locationId===screen.locationId)&&(!source||t.site===source)&&`${t.id}${t.site}${t.vehicle}${m.locations.find(l=>l.id===t.locationId)?.name}`.includes(screen.query||''));
  const rows=demoReportRows(trips,m.locations);
  const locationName=m.locations.find(l=>l.id===screen.locationId)?.name||screen.locationId;
  const csv=()=>{const url=URL.createObjectURL(new Blob([receiptCsv(trips)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ECO_DUMP_受入実績_試作.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  async function excel(){setBusy(true);try{await downloadTransportWorkbook(rows,{context:'受入',period:`${screen.date}〜${end}`,sample:true,filters:{受入場所:locationName,搬出元:source||'すべて',検索:screen.query||'指定なし',実績確定状態:receiptState,...receivingVehicleExport(trips)}});}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section ref={root}>
    <div className="receiving-heading"><div><h2>受入実績・帳票（共有デモ）</h2><p>選択した開始日〜終了日を含む期間内累計です。画面とExcelは同じ絞り込み条件で集計します。</p></div><button onClick={()=>navigate('搬出・受入スケジュール')}>受入管理へ戻る</button></div>
    <div className="receiving-toolbar receiving-sticky-controls">
      <DateControls label="開始日" value={screen.date} onChange={date=>update({date,resultsEnd:end<date?date:end})} todayValue={demoDate}/>
      <Field label="終了日"><input type="date" min={screen.date} value={end} onChange={e=>e.target.value&&update({resultsEnd:e.target.value<screen.date?screen.date:e.target.value})}/></Field>
      <Field label="受入場所"><select value={screen.locationId} onChange={e=>update({locationId:e.target.value})}><option>すべて</option>{m.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
      <Field label="搬出元"><select value={source} onChange={e=>update({resultsSource:e.target.value})}><option value="">すべて</option>{[...new Set(m.trips.map(t=>t.site))].map(s=><option key={s}>{s}</option>)}</select></Field>
      <Field label="検索"><input value={screen.query} onChange={e=>update({query:e.target.value})}/></Field>
      <Field label="実績確定状態"><select value={receiptState} onChange={e=>update({receiptState:e.target.value})}>{['すべて','未確定','内容確認済み','実績確定'].map(s=><option key={s}>{s}</option>)}</select></Field>
      <button onClick={csv}>試作CSVを出力</button><button className="primary" disabled={busy} onClick={excel}>{busy?'作成中…':'Excel帳票を出力'}</button>
    </div>
    {error&&<p role="alert">{error}</p>}
    <p className="receiving-period-total" role="status">期間内累計：{screen.date}〜{end}（開始日・終了日を含む） · 受入場所 {locationName} · 搬出元 {source||'すべて'} · 状態 {receiptState}</p>
    <ReceivingVehicleSummary rows={trips} period="期間内の台数"/>
    {reportTotals(rows).map(t=><p className="receiving-report-total" key={t.unit}><b>{t.unit}</b><span>対象 {t.count}件 · {t.vehicles}台</span><span>有効予定 {formatReportQuantity(t.planned)} {t.unit}</span><span>報告 {formatReportQuantity(t.reported)} {t.unit}</span><span>受入確定 {formatReportQuantity(t.confirmed)} {t.unit}</span><span>未確定 {t.pending}件 · 取消・受入不可 {t.cancelled}件</span></p>)}
    <TripList rows={rows} onOpen={openTrip}/>
    <details className="receiving-advanced"><summary>集計の対象・数量の数え方</summary><p>予定・ドライバー報告・受入確定を分け、確定合計には受入側で確定した数量だけを計上します。取消後の確定実績は保持し、tとm³は合算しません。全期間の計画量とは別の集計です。</p></details>
  </section>;
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
          {["会社情報", "ユーザー一覧", "車両一覧", "代行先一覧", "代行登録申請", "自社の代行元一覧"].map(
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
