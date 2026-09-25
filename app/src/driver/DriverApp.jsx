import PhoneStatus from './PhoneStatus.jsx';
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  History,
  MapPin,
  Moon,
  Navigation,
  Phone,
  Sun,
  Truck,
  UserRound,
  TriangleAlert,
  Camera,
  X,
  ClipboardList,
  ShieldCheck,
  Undo2,
  LoaderCircle,
  WifiOff,
} from "lucide-react";
import {
  activeEvents,
  appendStage,
  businessDate,
  correctionEvent,
  deliveryAction,
  deliveryStates,
  isHeld,
  makeTrips,
  newId,
  readDrafts,
  saveDrafts,
  stages,
  tripStage,
} from "./driverModel";
import "./driver.css";
import DirectWorkflowPanel from "../workflow/DirectWorkflowPanel.jsx";

function RouteMap() {
  const ref = useRef(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let map,
      cancelled = false;
    Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")])
      .then(([{ default: L }]) => {
        if (cancelled) return;
        map = L.map(ref.current, {
          scrollWheelZoom: false,
          zoomControl: true,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        }).setView([35.626, 139.785], 12);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        })
          .on("tileerror", () =>
            setError(
              "背景地図を取得できません。下の経路説明を確認してください。",
            ),
          )
          .addTo(map);
        const points = [
          [35.651, 139.77],
          [35.61, 139.805],
        ];
        points.forEach((p, i) =>
          L.circleMarker(p, {
            radius: 9,
            color: "#fff",
            weight: 3,
            fillColor: i ? "#eaaa43" : "#bfd52b",
            fillOpacity: 1,
          })
            .addTo(map)
            .bindTooltip(i ? "B サンプル受入場所" : "A サンプル現場"),
        );
        map.fitBounds(points, { padding: [32, 32], animate: false });
      })
      .catch(() =>
        setError("地図を読み込めません。経路説明を確認してください。"),
      );
    return () => {
      cancelled = true;
      map?.stop();
      map?.remove();
    };
  }, []);
  return (
    <>
      <div ref={ref} className="driver-map" aria-label="サンプル地点の地図" />
      {error && <p role="status">{error}</p>}
      <p className="muted">
        地図は架空の地点例です。実際の指定経路・現在位置は未接続です。
      </p>
    </>
  );
}
function Dialog({ title, children, close }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const el = ref.current;
    el.showModal();
    return () => {
      el.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="driver-dialog"
      aria-labelledby="driver-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <h2 id="driver-dialog-title">{title}</h2>
        <button className="icon-button" aria-label="閉じる" onClick={close}>
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Chip({ children, warning = false }) {
  return (
    <span className={`driver-chip ${warning ? "warning" : ""}`}>
      {children}
    </span>
  );
}
const navs = [
  ["today", Truck, "今日の運行"],
  ["history", History, "運行履歴"],
  ["notifications", Bell, "お知らせ"],
  ["profile", UserRound, "マイページ"],
];

export default function DriverApp() {
  const [trips] = useState(makeTrips);
  const [events, setEvents] = useState([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState("today");
  const [selected, setSelected] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("ecodump-driver-theme") || "light";
    } catch {
      return "light";
    }
  });
  const [filter, setFilter] = useState("");
  const [issueType, setIssueType] = useState("遅延");
  const [memo, setMemo] = useState("");
  const [photos, setPhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [demoState, setDemoState] = useState("unsent");
  const [demoNotice, setDemoNotice] = useState("");
  const content = useRef(null);
  const trip = trips.find((t) => t.id === selected);
  const todays = trips.filter((t) => t.date === businessDate());
  const next = todays.find((t) => tripStage(t, events) < 4);
  const currentStage = trip ? tripStage(trip, events) : 0;
  const pending = events.filter((e) => e.delivery === "unsent").length;
  const history = trips
    .filter((t) => t.date !== businessDate() || tripStage(t, events) === 4)
    .filter((t) => `${t.date}${t.id}${t.from}${t.to}`.includes(filter));
  useEffect(() => {
    document.title = "ECO DUMP | ドライバー Mobile";
    readDrafts()
      .then((value) => {
        setEvents(value);
        setReady(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    content.current?.scrollTo(0, 0);
  }, [tab, selected]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const toggleTheme = () => {
    const value = theme === "dark" ? "light" : "dark";
    setTheme(value);
    try {
      localStorage.setItem("ecodump-driver-theme", value);
    } catch {
      /* presentation remains usable */
    }
  };
  const chooseTab = (value) => {
    setTab(value);
    setSelected(null);
    setError("");
  };
  const persist = async (event) => {
    if (busyRef.current || !ready) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const updated = [...events, event];
      await saveDrafts(updated, events.length);
      setEvents(updated);
      setDialog(null);
      setPhotos([]);
      setMemo("");
      setReason("");
      setToast("端末内に下書きを保存しました。管理者には未送信です。");
    } catch (e) {
      setError(e.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const saveStage = () => {
    try {
      if (trip.id !== next?.id)
        throw new Error("先に現在の運行を確認してください。");
      persist(appendStage(trip, events, currentStage + 1));
    } catch (e) {
      setError(e.message);
    }
  };
  const saveCorrection = () => {
    try {
      if (
        trips.some(
          (t) =>
            t.date === trip.date &&
            t.sequence > trip.sequence &&
            tripStage(t, events) > 0,
        )
      )
        throw new Error(
          "後続の便が進行しています。管理者への訂正申請が必要です（未接続）。",
        );
      persist(correctionEvent(trip, events, reason));
    } catch (e) {
      setError(e.message);
    }
  };
  const closeDialog = () => {
    if (!busy && !photoBusy) {
      setDialog(null);
      setError("");
    }
  };
  const addPhotos = async (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    setError("");
    if (photos.length + files.length > 3) {
      setError("写真は3枚まで追加できます。");
      return;
    }
    if (
      files.some(
        (f) =>
          !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
          f.size > 5 * 1024 * 1024,
      )
    ) {
      setError(
        "JPEG・PNG・WebPの写真を1枚5MB以下で選んでください。HEICは未対応です。",
      );
      return;
    }
    setPhotoBusy(true);
    try {
      const loaded = await Promise.all(
        files.map(
          (f) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const img = new Image();
                img.onload = () =>
                  resolve({
                    id: newId(),
                    name: f.name,
                    data: reader.result,
                  });
                img.onerror = () =>
                  reject(
                    new Error(
                      "画像を表示できません。JPEGまたはPNGを選んでください。",
                    ),
                  );
                img.src = reader.result;
              };
              reader.onerror = () =>
                reject(new Error("写真を読み込めませんでした。"));
              reader.readAsDataURL(f);
            }),
        ),
      );
      setPhotos((prev) => [...prev, ...loaded]);
    } catch (e) {
      setError(e.message);
    } finally {
      setPhotoBusy(false);
    }
  };
  const openTrip = (id) => {
    setSelected(id);
    setError("");
  };
  function TripCard({ item, featured = false }) {
    const stage = tripStage(item, events);
    return (
      <button
        className={`trip-card ${featured ? "featured" : ""}`}
        onClick={() => openTrip(item.id)}
      >
        <div className="trip-top">
          <span>
            {featured ? "次の運行" : `${item.sequence}便目`}{" "}
            <span className="muted">／ {item.rotation}往復目</span>
          </span>
          <Chip warning={isHeld(item.id, events)}>
            {isHeld(item.id, events) ? "受入不可・保留" : stages[stage]}
          </Chip>
        </div>
        <div className="trip-time">
          {item.time}
          <small>
            現場指定 <ArrowRight size={14} /> {item.arrival} 受入指定
          </small>
        </div>
        <div className="route-stops">
          <div>
            <span className="point">A</span>
            <strong>{item.from}</strong>
          </div>
          <div>
            <span className="point destination">B</span>
            <strong>{item.to}</strong>
          </div>
        </div>
        <div className="trip-footer">
          <span>
            <Truck size={16} />
            {item.vehicle} · {item.quantity} {item.unit}
          </span>
          <ChevronRight size={20} />
        </div>
        {stage > 0 && item.baseStage === 0 && (
          <small className="draft-note">端末内の仮進捗・管理者には未送信</small>
        )}
      </button>
    );
  }
  return (
    <div className={`driver-preview ${theme}`}>
      <aside className="preview-caption">
        <img
          src={`${import.meta.env.BASE_URL}ecodump-logo.png`}
          alt="ECO DUMP"
        />
        <span>DRIVER MOBILE</span>
        <h1>
          運行を、
          <br />
          ひとつずつ確実に。
        </h1>
        <p>
          iPhoneサイズの操作プレビュー
          <br />
          390 × 844 · モバイルWeb
        </p>
        <div>
          匿名サンプル / API未接続
          <br />
          報告・写真はこのブラウザ内に保持
        </div>
      </aside>
      <section
        className="iphone-shell"
        aria-label="iPhone表示 ドライバーアプリ"
      >
        <div className="iphone-display">
        <PhoneStatus />
        <div className="driver-app">
          <header className="driver-header">
            <img
              src={`${import.meta.env.BASE_URL}ecodump-logo.png`}
              alt="ECO DUMP"
            />
            <div>
              <b>ECO DUMP</b>
              <small>ドライバー</small>
            </div>
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "ライト表示に切り替え"
                  : "ダーク表示に切り替え"
              }
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
          </header>
          <div className="prototype-banner">
            <span className="live-dot" />
            試作・API未接続 <span>すべて匿名サンプル</span>
          </div>
          <main ref={content} className="driver-content">
            {tab === "today" && !selected && <DirectWorkflowPanel role="driver" />}
            {!ready && (
              <p role="status">
                {error || "端末内の下書きを読み込んでいます…"}
              </p>
            )}
            {error && !dialog && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
            {trip ? (
              <>
                <button
                  className="back-button"
                  onClick={() => setSelected(null)}
                >
                  <ArrowLeft size={18} />
                  {tab === "history" ? "運行履歴" : "今日の運行"}へ戻る
                </button>
                <div className="eyebrow">
                  {trip.date} · {trip.rotation}往復目
                </div>
                <h1>運行詳細</h1>
                <p className="muted trip-id">{trip.id}</p>
                <div className="detail-status">
                  <Chip warning={isHeld(trip.id, events)}>
                    {isHeld(trip.id, events)
                      ? "受入不可・保留"
                      : stages[currentStage]}
                  </Chip>
                  <small>
                    {trip.baseStage === 4
                      ? "過去のサンプル記録"
                      : "端末内の仮進捗"}
                  </small>
                </div>
                <section className="detail-section">
                  <h2>
                    <MapPin size={18} />
                    搬出現場
                  </h2>
                  <h3>{trip.from}</h3>
                  <p>サンプル市 建設区画 A（架空住所）</p>
                  <dl>
                    <dt>指定時刻</dt>
                    <dd>{trip.time}</dd>
                    <dt>入口</dt>
                    <dd>東側・第1ゲート</dd>
                    <dt>担当者</dt>
                    <dd>サンプル担当者 A</dd>
                    <dt>連絡先</dt>
                    <dd>未設定（サンプル）</dd>
                  </dl>
                  <button className="secondary" disabled>
                    <Phone size={16} />
                    電話番号未接続
                  </button>
                  <p className="notice-text">
                    入口で受付後、誘導員の指示に従ってください。
                  </p>
                </section>
                <section className="detail-section">
                  <h2>
                    <MapPin size={18} />
                    受入先
                  </h2>
                  <h3>{trip.to}</h3>
                  <p>サンプル市 受入区画 B（架空住所）</p>
                  <dl>
                    <dt>指定時刻</dt>
                    <dd>{trip.arrival}</dd>
                    <dt>入口</dt>
                    <dd>南側・大型車ゲート</dd>
                    <dt>担当者</dt>
                    <dd>サンプル担当者 B</dd>
                    <dt>連絡先</dt>
                    <dd>未設定（サンプル）</dd>
                  </dl>
                  <button className="secondary" disabled>
                    <Phone size={16} />
                    電話番号未接続
                  </button>
                  <p className="notice-text">
                    受付・計量後に指定ヤードへ。受入不可の場合は待機して報告してください。
                  </p>
                </section>
                <section className="detail-section">
                  <h2>
                    <Truck size={18} />
                    運搬内容
                  </h2>
                  <dl>
                    <dt>土の種類</dt>
                    <dd>{trip.soil}</dd>
                    <dt>予定数量</dt>
                    <dd>
                      {trip.quantity} {trip.unit}
                    </dd>
                    <dt>車両</dt>
                    <dd>
                      {trip.vehicle}
                      <small>{trip.registration}（架空番号）</small>
                    </dd>
                  </dl>
                </section>
                <section className="detail-section">
                  <h2>
                    <Navigation size={18} />
                    指定経路・注意事項
                  </h2>
                  <RouteMap />
                  <p>経路例：現場東側ゲート → 幹線道路 → 受入先南側ゲート</p>
                  <p className="notice-text">
                    経路は説明用サンプルです。大型車の通行許可・実ナビは未接続です。
                  </p>
                </section>
                <section className="detail-section">
                  <h2>
                    <ClipboardList size={18} />
                    報告の流れ
                  </h2>
                  <ol className="stage-list">
                    {stages.slice(1).map((label, i) => (
                      <li
                        key={label}
                        className={currentStage > i ? "done" : ""}
                      >
                        <span>
                          {currentStage > i ? <Check size={14} /> : i + 1}
                        </span>
                        {label}
                      </li>
                    ))}
                  </ol>
                  <p className="muted">
                    荷下ろし完了は運行の完了報告です。受入実績の確定は受入側が行います。
                  </p>
                  <Chip warning>受入実績：未確定</Chip>
                </section>
                <section className="detail-section">
                  <h2>この便の端末内記録</h2>
                  {events.filter((e) => e.tripId === trip.id).length === 0 ? (
                    <p className="muted">報告下書きはありません。</p>
                  ) : (
                    events
                      .filter((e) => e.tripId === trip.id)
                      .map((e) => (
                        <article className="event-row" key={e.id}>
                          <div>
                            <b>
                              {e.kind === "stage"
                                ? stages[e.stage]
                                : e.kind === "issue"
                                  ? e.issueType
                                  : "報告の訂正"}
                            </b>
                            <Chip warning>未送信</Chip>
                          </div>
                          <small>
                            {new Date(e.at).toLocaleTimeString("ja-JP")} ·{" "}
                            {e.kind === "correction"
                              ? e.reason
                              : e.memo || "端末内の記録"}
                          </small>
                          {e.kind === "stage" &&
                            !activeEvents(events, trip.id).some(
                              (a) => a.id === e.id,
                            ) && <small>訂正により取り消された報告</small>}
                          {e.photos?.length > 0 && (
                            <div className="photo-strip">
                              {e.photos.map((p) => (
                                <img
                                  key={p.id}
                                  src={p.data}
                                  alt={`問題報告の添付写真 ${p.name}`}
                                />
                              ))}
                            </div>
                          )}
                        </article>
                      ))
                  )}
                  {activeEvents(events, trip.id).length > 0 && (
                    <button
                      className="secondary"
                      onClick={() => {
                        setReason("");
                        setDialog("correction");
                      }}
                    >
                      <Undo2 size={16} />
                      直前の報告を訂正
                    </button>
                  )}
                </section>
                {trip.baseStage === 0 && (
                  <div className="report-action">
                    <small>停車中に操作してください</small>
                    {isHeld(trip.id, events) ? (
                      <p className="notice-text">
                        受入不可のため保留中です。管理者の指示を確認してください。連絡機能は未接続です。
                      </p>
                    ) : currentStage < 4 ? (
                      <button
                        className="primary"
                        disabled={!ready || busy || next?.id !== trip.id}
                        onClick={() => setDialog("stage")}
                      >
                        {stages[currentStage + 1]}を報告
                        <ArrowRight size={20} />
                      </button>
                    ) : (
                      <p className="completion">
                        <Check size={20} />
                        荷下ろし完了の下書きあり・未送信
                      </p>
                    )}
                    {next?.id !== trip.id && currentStage < 4 && (
                      <p className="muted">
                        前の便を完了してから報告できます。
                      </p>
                    )}
                    <button
                      className="secondary"
                      disabled={!ready || busy}
                      onClick={() => {
                        setIssueType("遅延");
                        setMemo("");
                        setPhotos([]);
                        setDialog("issue");
                      }}
                    >
                      <TriangleAlert size={17} />
                      遅延・受入不可・問題を報告
                    </button>
                  </div>
                )}
              </>
            ) : tab === "today" ? (
              <>
                <div className="page-heading">
                  <div className="eyebrow">
                    {new Intl.DateTimeFormat("ja-JP", {
                      timeZone: "Asia/Tokyo",
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                    }).format(new Date())}
                  </div>
                  <h1>今日の運行</h1>
                  <p>サンプル運転者 01 さん、お疲れさまです。</p>
                </div>
                <div className="daily-summary">
                  <span>
                    <b>{todays.length}</b> 本日の便
                  </span>
                  <span>
                    <b>
                      {todays.filter((t) => tripStage(t, events) === 4).length}
                    </b>{" "}
                    荷下ろし下書き
                  </span>
                  <Truck size={28} />
                </div>
                {next ? (
                  <TripCard item={next} featured />
                ) : (
                  <div className="empty-state">
                    <ShieldCheck />
                    <h2>本日の報告下書きを作成済み</h2>
                    <p>すべて未送信です。受入実績は未確定です。</p>
                  </div>
                )}
                <div className="section-title">
                  <h2>本日のスケジュール</h2>
                  <small>同じ車両 · {todays.length}往復</small>
                </div>
                {todays
                  .filter((t) => t.id !== next?.id)
                  .map((t) => (
                    <TripCard key={t.id} item={t} />
                  ))}
                <button
                  className="queue-link"
                  onClick={() => chooseTab("profile")}
                >
                  <WifiOff size={18} />
                  <span>
                    端末内の未送信 {pending}件
                    <small>API接続後の送信機能は未実装です</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              </>
            ) : tab === "history" ? (
              <>
                <div className="eyebrow">TRIP HISTORY</div>
                <h1>運行履歴</h1>
                <p className="muted">
                  過去のサンプル記録と、荷下ろし報告の下書き
                </p>
                <label className="field">
                  日付・便番号・現場で検索
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="例：サンプル現場 A"
                  />
                </label>
                {history.length ? (
                  history.map((t) => (
                    <div key={t.id}>
                      <div className="history-date">
                        {t.date} · 受入実績は未確定
                      </div>
                      <TripCard item={t} />
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <History />
                    <p>条件に一致する運行はありません。</p>
                  </div>
                )}
              </>
            ) : tab === "notifications" ? (
              <>
                <div className="eyebrow">NOTIFICATIONS</div>
                <h1>お知らせ</h1>
                <p className="muted">
                  表示例です。管理者からの受信・Push通知は未接続です。
                </p>
                {[
                  [
                    "配車の確認",
                    "本日の3便が割り当てられています。各便の指定時刻と入口を確認してください。",
                  ],
                  [
                    "受入先の注意事項",
                    "南側の大型車ゲートから入場してください。受付前の荷下ろしは行わないでください。",
                  ],
                ].map(([title, body], i) => (
                  <button
                    key={title}
                    className="notification-row"
                    onClick={() => setDialog({ kind: "notice", title, body })}
                  >
                    <span className="notification-icon">
                      <Bell size={20} />
                    </span>
                    <span>
                      <small>サンプル · {i ? "07:15" : "07:30"}</small>
                      <b>{title}</b>
                      <p>{body}</p>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </>
            ) : (
              <>
                <div className="eyebrow">MY PAGE</div>
                <h1>マイページ</h1>
                <section className="profile-card">
                  <UserRound size={30} />
                  <div>
                    <h2>サンプル運転者 01</h2>
                    <p>サンプル運送会社 A</p>
                    <small>本人割当の表示例・認証未接続</small>
                  </div>
                </section>
                <section className="detail-section">
                  <h2>利用車両</h2>
                  <p>サンプル車両 01 · DEMO-001</p>
                </section>
                <section className="detail-section">
                  <h2>接続状況</h2>
                  <dl>
                    <dt>API・管理者への送信</dt>
                    <dd>未接続</dd>
                    <dt>位置情報</dt>
                    <dd>未接続・取得していません</dd>
                    <dt>Push通知</dt>
                    <dd>未接続</dd>
                    <dt>写真の保管</dt>
                    <dd>このブラウザ内のみ</dd>
                  </dl>
                </section>
                <section className="detail-section">
                  <h2>
                    未送信の記録 <Chip warning>{pending}件</Chip>
                  </h2>
                  <p className="muted">
                    下書きはこのブラウザに保存されます。別端末と同期されません。サイトデータ削除で失われます。
                  </p>
                  {events.length ? (
                    [...events].reverse().map((e) => (
                      <button
                        className="queue-row"
                        key={e.id}
                        onClick={() => openTrip(e.tripId)}
                      >
                        <span>
                          <b>
                            {e.kind === "stage"
                              ? stages[e.stage]
                              : e.kind === "issue"
                                ? e.issueType
                                : "訂正下書き"}
                          </b>
                          <small>{e.tripId}</small>
                        </span>
                        <Chip warning>未送信</Chip>
                      </button>
                    ))
                  ) : (
                    <p>未送信の記録はありません。</p>
                  )}
                  <button className="secondary" disabled>
                    API未接続のため送信できません
                  </button>
                </section>
                <section className="detail-section">
                  <h2>プレビューの確認</h2>
                  <button
                    className="secondary"
                    onClick={() => {
                      setDemoState("unsent");
                      setDemoNotice("");
                      setDialog("delivery");
                    }}
                  >
                    通信状態の表示を確認（模擬）
                  </button>
                  <p className="muted">
                    ここでの状態変更は下書き・運行に影響しません。
                  </p>
                </section>
              </>
            )}
          </main>
          {toast && (
            <div className="driver-toast" role="status">
              {toast}
            </div>
          )}
          <nav className="driver-bottom" aria-label="下部メニュー">
            {navs.map(([key, Icon, label]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                aria-current={tab === key ? "page" : undefined}
                onClick={() => chooseTab(key)}
              >
                <Icon size={22} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="iphone-home" aria-hidden="true">
          <span />
        </div>
        </div>
      </section>
      {dialog && (
        <Dialog
          title={
            dialog === "stage"
              ? "状態報告の確認"
              : dialog === "issue"
                ? "問題を報告"
                : dialog === "correction"
                  ? "直前の報告を訂正"
                  : dialog === "delivery"
                    ? "通信状態の表示確認"
                    : dialog.title
          }
          close={closeDialog}
        >
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          {dialog === "stage" && (
            <>
              <p className="confirm-stage">{stages[currentStage + 1]}</p>
              <p>
                {trip.from} → {trip.to}
                <br />
                {trip.rotation}往復目 · {trip.id}
              </p>
              <p className="notice-text">
                停車中に、実際の状況を確認してください。この試作では端末内に下書きを保存し、管理者へは送信しません。
              </p>
              <button className="primary" onClick={saveStage} disabled={busy}>
                {busy ? "端末内に保存中…" : "報告を下書き保存"}
              </button>
              <button
                className="secondary"
                onClick={closeDialog}
                disabled={busy}
              >
                戻る
              </button>
            </>
          )}
          {dialog === "issue" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                persist({
                  id: newId(),
                  operationId: newId(),
                  tripId: trip.id,
                  kind: "issue",
                  issueType,
                  memo: memo.trim(),
                  photos,
                  delivery: "unsent",
                  at: new Date().toISOString(),
                });
              }}
            >
              <p className="muted">{trip.rotation}往復目 · 管理者には未送信</p>
              <label className="field">
                問題の種類
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                >
                  <option>遅延</option>
                  <option>受入不可</option>
                  <option>その他</option>
                </select>
              </label>
              <label className="field">
                状況メモ（必須）
                <textarea
                  required
                  maxLength={1000}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="状況と、管理者に確認したいことを入力"
                />
              </label>
              <label className="photo-input">
                <Camera size={20} />
                {photoBusy ? "写真を読み込み中…" : "写真を追加"}
                <input
                  aria-label="問題報告の写真"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={addPhotos}
                  disabled={photoBusy || busy}
                />
              </label>
              <small>
                3枚まで・各5MB以下。JPEG / PNG /
                WebP。匿名の写真を使用してください。
              </small>
              <div className="photo-strip">
                {photos.map((p) => (
                  <div key={p.id}>
                    <img src={p.data} alt={p.name} />
                    <button
                      type="button"
                      aria-label={`${p.name}を削除`}
                      onClick={() =>
                        setPhotos(photos.filter((x) => x.id !== p.id))
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
              {issueType === "受入不可" && (
                <p className="notice-text">
                  保留として記録します。管理者の指示があるまで荷下ろしを進めないでください。
                </p>
              )}
              <button
                className="primary"
                disabled={busy || photoBusy || !memo.trim()}
              >
                {busy ? "端末内に保存中…" : "問題を下書き保存"}
              </button>
              <p className="muted">
                写真・メモはこのブラウザ内のみ。通信・外部保存は行いません。
              </p>
            </form>
          )}
          {dialog === "correction" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveCorrection();
              }}
            >
              <p>
                直前の未送信報告を取り消し、ひとつ前の段階に戻します。元の記録と訂正理由は残ります。
              </p>
              <label className="field">
                訂正理由（必須）
                <textarea
                  required
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="例：受入先到着を誤って押した"
                />
              </label>
              <p className="muted">
                送信済みの報告は管理者への訂正申請が必要です。この試作では未送信報告のみ訂正できます。
              </p>
              <button className="primary" disabled={busy || !reason.trim()}>
                理由を残して訂正
              </button>
            </form>
          )}
          {dialog === "delivery" && (
            <>
              <p className="notice-text">
                模擬表示・API未接続。実際の送信や保存結果ではありません。
              </p>
              <label className="field">
                表示する通信状態
                <select
                  value={demoState}
                  onChange={(e) => {
                    setDemoState(e.target.value);
                    setDemoNotice("");
                  }}
                >
                  {Object.entries(deliveryStates).map(([key, [label]]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div
                className={`delivery-example state-${demoState}`}
                role="status"
              >
                {demoState === "sending" ? (
                  <LoaderCircle className="spin" />
                ) : demoState === "sent" ? (
                  <Check />
                ) : (
                  <WifiOff />
                )}
                <h3>{deliveryStates[demoState][0]}（模擬）</h3>
                <p>{deliveryStates[demoState][1]}</p>
              </div>
              {deliveryAction(demoState) && (
                <button
                  className="secondary"
                  onClick={() =>
                    setDemoNotice(
                      "API未接続のため実行していません。実接続時の操作位置の確認です。",
                    )
                  }
                >
                  {deliveryAction(demoState)}（未接続）
                </button>
              )}
              {demoNotice && <p role="status">{demoNotice}</p>}
            </>
          )}
          {typeof dialog === "object" && (
            <>
              <p>{dialog.body}</p>
              <p className="muted">
                サンプルのお知らせです。実際に受信した通知ではありません。
              </p>
              <button
                className="primary"
                onClick={() => {
                  setDialog(null);
                  setTab("today");
                  openTrip(todays[0].id);
                }}
              >
                関連する運行を確認
              </button>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}
