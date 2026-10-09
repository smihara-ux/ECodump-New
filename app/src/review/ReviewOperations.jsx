import { useEffect, useRef, useState } from "react";
import { demoSites, demoDay, asControl } from "../demo/model.mjs";
import { useDemoTrips } from "../demo/store.jsx";
const savedContext = () => {
  try {
    return JSON.parse(
      sessionStorage.getItem("ecodump-construction-schedule-filters") || "{}",
    );
  } catch {
    return {};
  }
};
export default function ReviewOperations({ navigate, renderMap, onDetail, initialSite, siteOptions }) {
  const all = useDemoTrips(),
    saved = savedContext();
  const [date, setDate] = useState(saved.date || demoDay()),
    [site, setSite] = useState(initialSite || saved.field || "すべて"),
    [filter, setFilter] = useState("有効予定"),
    [cargo,setCargo]=useState("すべての荷種"),
    [selected, setSelected] = useState(null),
    [mapOnly, setMapOnly] = useState(false);
  const mapSection = useRef(null);
  const timeline = useRef(null);
  const beforeExpand = useRef(0);
  useEffect(() => {
    if (!mapOnly) return;
    const close = e => { if (e.key === "Escape") setMapOnly(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mapOnly]);
  useEffect(() => {
    const surface = mapSection.current?.closest(".navigation-review-main");
    if (!surface) return;
    if (mapOnly) { beforeExpand.current = surface.scrollTop; surface.scrollTop = 0; }
    else if (beforeExpand.current) { surface.scrollTop = beforeExpand.current; beforeExpand.current = 0; }
  }, [mapOnly]);
  useEffect(() => {
    sessionStorage.setItem(
      "ecodump-construction-schedule-filters",
      JSON.stringify({ ...savedContext(), date, field: site }),
    );
  }, [date, site]);
  const trips = all
     .filter(t=>cargo==="すべての荷種"||cargo==="建設発生土")
    .filter(
      (t) => t.date === date && (site === "すべて" || t.departure === site),
    )
    .map((t) => ({
      ...asControl(t),
      status:
        t.booking === "取消"
          ? "取消"
          : t.operation === "未手配"
            ? "未手配"
            : t.operation === "配車済み"
              ? "配車済み"
              : t.operation === "報告済み" &&
                  !t.unloaded &&
                  t.reception !== "受入中"
                ? "報告済み"
                : asControl(t).status,
    }));
  const active = trips.filter((t) => t.booking !== "取消");
  const match = (t, key) =>
    key === "すべて" ||
    (key === "有効予定"
      ? t.booking !== "取消"
      : key === "配車済み"
        ? !!t.vehicleId && t.booking !== "取消"
        : t.status === key);
  const visible = trips.filter((t) => match(t, filter));
  const chosen = visible.find((t) => t.id === selected) || visible[0];
  const metrics = [
    ["有効予定", active.length],
    ["未手配", active.filter((t) => t.status === "未手配").length],
    ["配車済み", active.filter((t) => t.vehicleId).length],
    ["運行中", active.filter((t) => t.status === "運行中").length],
    ["遅延", active.filter((t) => t.status === "遅延").length],
    ["受入中", active.filter((t) => t.status === "受入中").length],
    ["完了", active.filter((t) => t.status === "完了").length],
    ["取消", trips.length - active.length],
  ];
  function dispatch(add = false) {
    if (add) sessionStorage.setItem("ecodump-dispatch-add", "1");
    if (chosen && !add)
      sessionStorage.setItem("ecodump-dispatch-focus", chosen.id);
    navigate("配車・運行管理");
  }
  return (
    <section className={`review-operations ${mapOnly ? "review-map-expanded" : ""}`}>
      <div className="review-operation-toolbar">
        <label>
          対象日
          <input
            aria-label="運行ダッシュボードの対象日"
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value);
                setSelected(null);
              }
            }}
          />
        </label>
        <label>
          現場
          <select
            disabled={!!initialSite}
            value={site}
            onChange={(e) => {
              setSite(e.target.value);
              setSelected(null);
            }}
          >
            <option>すべて</option>
            {(siteOptions || demoSites.map(s => s.name)).map(name => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={() => dispatch()}>
          配車を組む
        </button>
        <button className="outline" onClick={() => dispatch(true)}>
          予定を追加
        </button>
      </div>
      <details className="review-operation-conditions"><summary>詳しい条件</summary><div className="review-operation-toolbar"><label>荷種<select value={cargo} onChange={e=>setCargo(e.target.value)}>{["すべての荷種","建設発生土","コンクリートがら"].map(c=><option key={c}>{c}</option>)}</select></label><button className="outline" onClick={()=>{setCargo("すべての荷種");setFilter("有効予定");if(!initialSite)setSite("すべて");}}>条件をクリア</button></div></details>
      <div className="review-metrics" aria-label="本日の運行集計">
        {metrics.map(([key, count]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
          >
            <span>{key === "完了" ? "受入完了" : key}</span>
            <b>
              {count}
              <small>便</small>
            </b>
          </button>
        ))}
        <div>
          <span>実車両</span>
          <b>
            {
              new Set(active.filter((t) => t.vehicleId).map((t) => t.vehicleId))
                .size
            }
            <small>台</small>
          </b>
        </div>
      </div>
      <p className="review-metric-note">配車済みは運行中・受入完了などを含みます。実車両は重複を除いた台数です。</p>
      <div className="review-list-heading">
        <h2>本日の運行タイムライン</h2>
        <label>
          表示条件
          <select
            aria-label="運行の表示条件"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "有効予定",
              "すべて",
              "未手配",
              "配車済み",
              "運行中",
              "遅延",
              "受入中",
              "完了",
              "待機中",
              "報告済み",
              "取消",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <button className="outline" onClick={() => setFilter("すべて")}>
          すべての便を表示
        </button>
      </div>
      <div
        className={`review-operation-layout ${mapOnly ? "map-focused" : ""}`}
      >
        {!mapOnly && (
          <div className="review-timeline" aria-label="運行便一覧" ref={timeline}>
            {visible.map((t) => (
              <button
                key={t.id}
                aria-pressed={chosen?.id === t.id}
                className={chosen?.id === t.id ? "selected" : ""}
                onClick={() => {setSelected(t.id);requestAnimationFrame(()=>mapSection.current?.scrollIntoView({block:"start"}));}}
              >
                <time>
                  {t.time} → {t.eta}
                </time>
                <b>{t.id}</b>
                <span className={`trip-status status-${t.status}`}>
                  {t.status === "運行中"
                    ? "受入先へ運行中"
                    : t.status === "待機中"
                      ? "現場待機中"
                      : t.status}
                </span>
                <span>
                  {t.departure}
                  <small>→ {t.destination}</small>
                </span>
                <span>
                  {t.vehicle}
                  <small>{t.driver}</small>
                </span>
              </button>
            ))}
            {!visible.length && (
              <p className="empty-state">
                対象便はありません。日付・現場・表示条件を変更してください。
              </p>
            )}
          </div>
        )}
        {chosen && (
          <section className="review-map-section" ref={mapSection}>
            <header>
              <div>
                <h2>選択便の地図・詳細</h2>
                <b>{chosen.id}</b>
              </div>
              <button className="outline" aria-pressed={mapOnly}
                onClick={() => {setMapOnly(!mapOnly);}}>
                {mapOnly ? "拡張表示を閉じる" : "地図を拡張表示"}
              </button>
              {!mapOnly&&<button className="outline" onClick={()=>timeline.current?.scrollIntoView({block:"start"})}>便一覧へ戻る</button>}
              <button className="outline" onClick={() => onDetail(chosen)}>
                運行詳細
              </button>
            </header>
            <p className="review-note">
              経路・位置は描画例です。実GPS・交通情報は未接続です。
              {!chosen.vehicleId && "未手配のため車両位置は表示しません。"}
            </p>
            {renderMap(visible, chosen)}
          </section>
        )}
      </div>
    </section>
  );
}
