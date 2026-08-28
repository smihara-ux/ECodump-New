import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Bell,
  Building2,
  BusFront,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Copy,
  DoorOpen,
  FileText,
  Filter,
  HardHat,
  LayoutGrid,
  Layers3,
  MapPin,
  MapPinned,
  Menu,
  Navigation,
  Network,
  Plus,
  Route,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  Truck,
  TriangleAlert,
  UserCircle2,
  X,
} from "lucide-react";

const navGroups = [
  {
    title: "資源循環",
    items: [[Layers3, "発生土マッチング", "UCRマッチング"]],
  },
  {
    title: "現場業務",
    items: [[Building2, "現場一覧", "現場一覧"]],
  },
  {
    title: "現場サービス",
    items: [
      [FileText, "労務安全", "労務安全"],
      [DoorOpen, "入退場管理", "入退場管理"],
      [CalendarDays, "調整会議", "調整会議"],
    ],
  },
  {
    title: "運行業務",
    items: [[Truck, "搬出・受入管理", "搬出・受入スケジュール"]],
  },
  {
    title: "基本台帳",
    items: [
      [Building2, "会社情報", "会社情報"],
      [UserRound, "ユーザー", "ユーザー一覧"],
      [BusFront, "車両・運転手", "車両一覧"],
    ],
  },
  {
    title: "関係会社",
    items: [
      [Network, "協力会社", "代行先一覧"],
      [ClipboardList, "登録申請", "代行登録申請"],
      [UsersRound, "元請会社", "自社の代行元一覧"],
    ],
  },
];
const fields = Array.from({ length: 23 }, (_, i) => ({
  id: `${32182 + i}`,
  company: `サンプル建設株式会社 ${String.fromCharCode(65 + (i % 5))}`,
  branch: ["東京支店", "首都圏建築支店", "関東支店"][i % 3],
  field: `${i % 3 === 0 ? "（仮称）" : ""}サンプル現場 ${String.fromCharCode(65 + (i % 20))}${i > 19 ? i + 1 : ""}`,
  address: `${["東京都中央区", "千葉県船橋市", "神奈川県川崎市"][i % 3]} サンプル${i + 1}-${(i % 5) + 1}`,
  start: `2026/${String((i % 9) + 1).padStart(2, "0")}/01`,
  end: `2027/${String((i % 9) + 1).padStart(2, "0")}/28`,
}));
const people = Array.from({ length: 9 }, (_, i) => ({
  branch: "本社",
  name: `サンプルユーザー ${i + 1}`,
  sub: `さんぷる ゆーざー ${i + 1}`,
  account: `user${i + 1}@example.test`,
  type: i < 3 ? "協力会社管理者" : "職長",
  created: `2025/0${(i % 9) + 1}/01`,
  updated: `2026/0${(i % 9) + 1}/15`,
}));
const workers = Array.from({ length: 12 }, (_, i) => ({
  branch: "本社",
  name: `サンプル作業員 ${i + 1}`,
  kana: `サンプル サギョウイン ${i + 1}`,
  birth: `19${80 + i}/01/01`,
  ccus: i % 4 ? "連携済み" : "未設定",
  status: "在籍",
}));
const vehicles = [
  {
    name: "10t ダンプ 01",
    number: "品川 100 あ 12-34",
    kind: "大型ダンプ",
    capacity: "10t",
    status: "稼働中",
  },
  {
    name: "4t ダンプ 02",
    number: "足立 100 か 56-78",
    kind: "中型ダンプ",
    capacity: "4t",
    status: "稼働中",
  },
  {
    name: "アームロール 03",
    number: "練馬 100 き 90-12",
    kind: "脱着装置付コンテナ車",
    capacity: "8t",
    status: "点検予定",
  },
];
const drivers = [
  {
    name: "サンプル 運転者1",
    phone: "090-0000-0001",
    license: "大型・けん引",
    expires: "2028/03/31",
    status: "配車可能",
  },
  {
    name: "サンプル 運転者2",
    phone: "090-0000-0002",
    license: "大型",
    expires: "2027/11/30",
    status: "運行中",
  },
  {
    name: "サンプル 運転者3",
    phone: "090-0000-0003",
    license: "中型",
    expires: "2029/06/30",
    status: "配車可能",
  },
];
const subcontractorHierarchy = [
  {
    id: "SC-02-01",
    name: "サンプル設備工業株式会社",
    trade: "給排水設備工事",
    workers: 8,
    status: "登録済み",
    children: [
      {
        id: "SC-03-01",
        name: "サンプル配管株式会社",
        trade: "配管工事",
        workers: 4,
        status: "登録済み",
      },
      {
        id: "SC-03-02",
        name: "サンプル保温工業",
        trade: "保温工事",
        workers: 2,
        status: "確認待ち",
      },
    ],
  },
  {
    id: "SC-02-02",
    name: "サンプル電設株式会社",
    trade: "電気設備工事",
    workers: 6,
    status: "登録済み",
    children: [
      {
        id: "SC-03-03",
        name: "サンプル通信工事株式会社",
        trade: "弱電・通信工事",
        workers: 3,
        status: "登録済み",
      },
    ],
  },
];

function Header({ title, onHelp, onClose, onMenu }) {
  return (
    <header className="page-header">
      <div className="page-title-group">
        <button className="page-menu-trigger" onClick={onMenu}>
          <LayoutGrid />
          メニュー
        </button>
        <h1>{title}</h1>
      </div>
      <div className="header-actions">
        <button className="guide" onClick={onHelp}>
          <CircleHelp />
          はじめてガイド
        </button>
        <button className="help" onClick={onHelp}>
          <CircleHelp />
          ヘルプ
        </button>
        <button className="close" onClick={onClose}>
          管制画面へ <X />
        </button>
      </div>
    </header>
  );
}
function Pager() {
  return (
    <div className="pagination">
      <button disabled>
        <ChevronLeft />
      </button>
      <button className="current">1</button>
      <button disabled>
        <ChevronRight />
      </button>
    </div>
  );
}
function SearchBar({
  count,
  query,
  setQuery,
  placeholder = "名称を入力",
  extra,
  onDetail,
  onClear,
  onSearch,
}) {
  return (
    <section className="search-panel">
      <div className="search-line">
        <b>検索結果：{count}件</b>
        <label>
          検索{" "}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
          />
        </label>
        {extra}
      </div>
      <div className="search-actions">
        <button className="primary" onClick={onSearch}>
          <Search />
          検索
        </button>
        <button className="text" onClick={onDetail}>
          詳細検索
        </button>
        <button className="text" onClick={onClear}>
          クリア
        </button>
      </div>
    </section>
  );
}
function GridTable({ headers, rows, empty = false, onConfirm }) {
  return (
    <div className="generic-table-wrap">
      <div className="generic-table" style={{ "--cols": headers.length }}>
        <div className="generic-tr generic-head">
          {headers.map((h, index) => (
            <div key={`${h}-${index}`}>{h}</div>
          ))}
        </div>
        {rows.map((r, i) => (
          <div className="generic-tr" key={i}>
            {r.map((cell, j) => (
              <div key={j}>
                {cell === "__confirm" ? (
                  <button className="outline" onClick={() => onConfirm?.(i)}>
                    確認
                  </button>
                ) : (
                  cell
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {(empty || !rows.length) && (
        <div className="empty-state">
          現在登録されているデータがありません。
        </div>
      )}
    </div>
  );
}

function FieldList({
  query,
  setQuery,
  setDetailOpen,
  selected,
  setSelected,
  copied,
  copyId,
  navigate,
  onOperatorSelect,
}) {
  const filtered = useMemo(
    () =>
      fields.filter((r) =>
        `${r.company} ${r.field} ${r.id}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );
  return (
    <>
      <SearchBar
        count={filtered.length}
        query={query}
        setQuery={setQuery}
        placeholder="現場名/IDを入力"
        extra={
          <>
            <label>
              利用サービス{" "}
              <select>
                <option>すべて</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" />
              利用終了を含める
            </label>
          </>
        }
        onDetail={() => setDetailOpen(true)}
        onClear={() => setQuery("")}
      />
      <section className="table-area">
        <div className="table-tools">
          <button className="outline" onClick={onOperatorSelect}>
            <Settings />
            操作ユーザー選択
          </button>
          <p>
            アクセスしたい現場が表示されない場合は<a href="#help">こちら</a>
            をご確認ください。
          </p>
        </div>
        <div className="table-scroll">
          <table className="field-list-table">
            <thead>
              <tr>
                {[
                  "元請名",
                  "支店名",
                  "現場名",
                  "住所",
                  "着工日",
                  "竣工日",
                  "ステータス",
                  "利用中のサービス",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className={selected === r.id ? "selected" : ""}
                  onClick={() => setSelected(r.id)}
                >
                  <td>{r.company}</td>
                  <td>{r.branch}</td>
                  <td>
                    <button
                      className="field-access"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(r.id);
                        navigate("現場詳細", r.id);
                      }}
                    >
                      {r.field}
                      <ChevronRight />
                    </button>
                    <div className="field-meta">
                      ID：{r.id}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyId(r.id);
                        }}
                      >
                        <Copy />
                      </button>
                      <span>／</span>
                      <i>
                        <ShieldCheck />
                      </i>{" "}
                      CCUS
                    </div>
                    {copied === r.id && (
                      <em className="toast">現場IDをコピーしました</em>
                    )}
                  </td>
                  <td>{r.address}</td>
                  <td>{r.start}</td>
                  <td>{r.end}</td>
                  <td></td>
                  <td>
                    <div className="service-strip">
                      <a
                        href="?page=labor"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelected(r.id);
                          navigate("労務安全");
                        }}
                        aria-label="労務安全を開く"
                      >
                        <FileText />
                        <span>書類</span>
                      </a>
                      <a
                        href="?page=gatekeeper"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelected(r.id);
                          navigate("入退場管理");
                        }}
                        aria-label="入退場管理を開く"
                      >
                        <DoorOpen />
                        <span>入退場</span>
                      </a>
                      <a
                        href="?page=conference"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelected(r.id);
                          navigate("調整会議");
                        }}
                        aria-label="調整会議を開く"
                      >
                        <CalendarDays />
                        <span>会議</span>
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager />
      </section>
    </>
  );
}
function ListPage({ type, query, setQuery, setDetailOpen, setConfirm }) {
  const [appliedQuery, setAppliedQuery] = useState("");
  const [branch, setBranch] = useState("すべて");
  const [kind, setKind] = useState("すべて");
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState([]);
  let config = {};
  if (type === "ユーザー一覧")
    config = {
      placeholder: "氏名を入力",
      actions: [
        "新規作成",
        "企業管理者申請",
        "表示データをCSV出力",
        "職長の初期パスワードを再発行",
      ],
      headers: [
        "支店",
        "氏名",
        "ユーザーID・メールアドレス",
        "種別",
        "サービス権限",
        "登録日",
        "更新日",
        "",
      ],
      searchTexts: [...people, ...created].map(
        (x) => `${x.branch} ${x.name} ${x.sub} ${x.account} ${x.type}`,
      ),
      data: [...people, ...created].map((x) => [
        x.branch,
        <span>
          <small>{x.sub}</small>
          <br />
          <b>{x.name}</b>
        </span>,
        x.account,
        x.type,
        "ECO",
        x.created,
        x.updated,
        "__confirm",
      ]),
    };
  else
    config = {
      placeholder: "氏名を入力",
      actions: ["新規作成", "表示データをCSV出力", "選択した作業員を更新"],
      headers: [
        "",
        "支店",
        "氏名",
        "生年月日",
        "CCUS技能者ID",
        "連携状況",
        "所属現場数",
        "確認状況",
        "在籍状況",
        "",
      ],
      searchTexts: workers.map(
        (x) => `${x.branch} ${x.name} ${x.kana} ${x.ccus} ${x.status}`,
      ),
      data: workers.map((x) => [
        <input type="checkbox" />,
        x.branch,
        <span>
          <small>{x.kana}</small>
          <br />
          <b>{x.name}</b>
        </span>,
        x.birth,
        "00000000000000",
        x.ccus,
        "1",
        "確認済み",
        x.status,
        "__confirm",
      ]),
    };
  const filtered = config.data.filter((r, index) => {
    const text = `${config.searchTexts[index]} ${String(
      r.map((x) => (typeof x === "string" ? x : "")),
    )}`;
    return (
      text.includes(appliedQuery) &&
      (branch === "すべて" || text.includes(branch)) &&
      (kind === "すべて" || text.includes(kind))
    );
  });
  const clearFilters = () => {
    setQuery("");
    setAppliedQuery("");
    setBranch("すべて");
    setKind("すべて");
  };
  const action = (label) => {
    if (label === "新規作成") setCreateOpen(true);
    else if (label === "表示データをCSV出力")
      setConfirm({
        title: "CSV出力完了",
        message: `${filtered.length}件の匿名データを出力しました。`,
      });
    else
      setConfirm({
        title: label,
        message: "対象を選択して操作内容を確認してください。",
      });
  };
  return (
    <>
      <SearchBar
        count={filtered.length}
        query={query}
        setQuery={setQuery}
        placeholder={config.placeholder}
        extra={
          <>
            <label>
              支店{" "}
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              >
                <option>すべて</option>
                <option>本社</option>
                <option>支店 1</option>
              </select>
            </label>
            <label>
              種別{" "}
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option>すべて</option>
                <option>協力会社管理者</option>
                <option>職長</option>
              </select>
            </label>
          </>
        }
        onDetail={() => setDetailOpen(true)}
        onSearch={() => setAppliedQuery(query)}
        onClear={clearFilters}
      />
      <div className="action-strip">
        {config.actions.map((a, i) => (
          <button
            className={i === 0 ? "primary" : "outline"}
            key={a}
            onClick={() => action(a)}
          >
            {a}
          </button>
        ))}
      </div>
      <GridTable
        headers={config.headers}
        rows={filtered}
        onConfirm={(i) =>
          setConfirm({ title: `${type.slice(0, -2)}詳細`, index: i })
        }
      />
      <Pager />
      {createOpen && (
        <CreateRecordModal
          type={type}
          onClose={() => setCreateOpen(false)}
          onSave={(record) => {
            if (type === "ユーザー一覧") setCreated((v) => [...v, record]);
            setCreateOpen(false);
            setConfirm({
              title: "登録完了",
              message: `${type.slice(0, -2)}を匿名サンプルとして追加しました。`,
            });
          }}
        />
      )}
    </>
  );
}

function CreateRecordModal({ type, onClose, onSave }) {
  const [form, setForm] = useState({
    branch: "本社",
    last: "",
    first: "",
    kanaLast: "",
    kanaFirst: "",
    account: "",
    type: type === "ユーザー一覧" ? "協力会社管理者" : "作業員",
  });
  const update = (key) => (e) =>
    setForm((v) => ({ ...v, [key]: e.target.value }));
  const valid =
    form.last && form.first && (type !== "ユーザー一覧" || form.account);
  return (
    <div className="overlay">
      <section
        className="modal form-modal"
        role="dialog"
        aria-label={`${type.slice(0, -2)}新規作成`}
      >
        <h2>{type.slice(0, -2)}新規作成</h2>
        <div className="form-grid">
          <label>
            支店
            <select value={form.branch} onChange={update("branch")}>
              <option>本社</option>
              <option>支店 1</option>
            </select>
          </label>
          <label>
            種別
            <select value={form.type} onChange={update("type")}>
              <option>協力会社管理者</option>
              <option>職長</option>
              <option>作業員</option>
            </select>
          </label>
          <label>
            姓
            <input
              value={form.last}
              onChange={update("last")}
              placeholder="姓を入力"
            />
          </label>
          <label>
            名
            <input
              value={form.first}
              onChange={update("first")}
              placeholder="名を入力"
            />
          </label>
          <label>
            せい
            <input
              value={form.kanaLast}
              onChange={update("kanaLast")}
              placeholder="せいを入力"
            />
          </label>
          <label>
            めい
            <input
              value={form.kanaFirst}
              onChange={update("kanaFirst")}
              placeholder="めいを入力"
            />
          </label>
          {type === "ユーザー一覧" && (
            <label className="wide">
              ユーザーID（メールアドレス）
              <input
                value={form.account}
                onChange={update("account")}
                placeholder="example@example.test"
              />
            </label>
          )}
          <label className="wide check">
            <input type="checkbox" /> 職長パスワードリセット通知先に設定
          </label>
        </div>
        <div className="modal-actions">
          <button className="outline" onClick={onClose}>
            閉じる
          </button>
          <button
            className="primary"
            disabled={!valid}
            onClick={() =>
              onSave({
                branch: form.branch,
                name: `${form.last} ${form.first}`,
                sub: `${form.kanaLast} ${form.kanaFirst}`,
                account: form.account,
                type: form.type,
                created: "2026/08/19",
                updated: "2026/08/19",
              })
            }
          >
            登録
          </button>
        </div>
      </section>
    </div>
  );
}
function VehiclePage({ query, setQuery, setDetailOpen, setConfirm }) {
  const [tab, setTab] = useState("車両情報");
  const [createOpen, setCreateOpen] = useState(false);
  const [vehicleRows, setVehicleRows] = useState(vehicles);
  const [driverRows, setDriverRows] = useState(drivers);
  const source = tab === "車両情報" ? vehicleRows : driverRows;
  const visible = source.filter((item) =>
    Object.values(item).join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  const addRecord = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (tab === "車両情報")
      setVehicleRows((rows) => [
        ...rows,
        {
          name: form.get("name"),
          number: form.get("number"),
          kind: form.get("kind"),
          capacity: form.get("capacity"),
          status: "稼働中",
        },
      ]);
    else
      setDriverRows((rows) => [
        ...rows,
        {
          name: form.get("name"),
          phone: form.get("phone"),
          license: form.get("license"),
          expires: form.get("expires"),
          status: "配車可能",
        },
      ]);
    setCreateOpen(false);
    setConfirm({ title: `${tab}を登録しました` });
  };
  return (
    <>
      <div className="page-tabs">
        <button
          className={tab === "車両情報" ? "active" : ""}
          onClick={() => setTab("車両情報")}
        >
          車両情報
        </button>
        <button
          className={tab === "運転手情報" ? "active" : ""}
          onClick={() => setTab("運転手情報")}
        >
          運転手情報
        </button>
      </div>
      <SearchBar
        count={visible.length}
        query={query}
        setQuery={setQuery}
        placeholder={
          tab === "車両情報" ? "車両名・車両番号を入力" : "運転手名を入力"
        }
        extra={
          <>
            <label>
              状態{" "}
              <select>
                <option>すべて</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" />
              期限切れのみ
            </label>
          </>
        }
        onDetail={() => setDetailOpen(true)}
        onClear={() => setQuery("")}
      />
      <div className="action-strip">
        <button className="primary" onClick={() => setCreateOpen(true)}>
          {tab}を登録
        </button>
        <p>
          配車時に使用する{tab === "車両情報" ? "車両" : "運転手と免許期限"}
          を管理します。
        </p>
      </div>
      <GridTable
        headers={
          tab === "車両情報"
            ? ["車両名", "車両番号", "種別", "最大積載量", "利用状況", "操作"]
            : [
                "運転手名",
                "電話番号",
                "免許区分",
                "免許期限",
                "配車状況",
                "操作",
              ]
        }
        rows={visible.map((item) =>
          tab === "車両情報"
            ? [
                item.name,
                item.number,
                item.kind,
                item.capacity,
                item.status,
                "__confirm",
              ]
            : [
                item.name,
                item.phone,
                item.license,
                item.expires,
                item.status,
                "__confirm",
              ],
        )}
        onConfirm={(index) =>
          setConfirm({
            title: `${tab}詳細`,
            message: Object.values(visible[index]).join(" / "),
          })
        }
      />
      <Pager />
      {createOpen && (
        <div className="overlay" onMouseDown={() => setCreateOpen(false)}>
          <form
            className="modal form-modal"
            onSubmit={addRecord}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2>{tab}を登録</h2>
            <div className="form-grid">
              <label>
                {tab === "車両情報" ? "車両名" : "運転手名"}
                <input name="name" required />
              </label>
              {tab === "車両情報" ? (
                <>
                  <label>
                    車両番号
                    <input name="number" required />
                  </label>
                  <label>
                    種別
                    <select name="kind">
                      <option>大型ダンプ</option>
                      <option>中型ダンプ</option>
                      <option>アームロール</option>
                    </select>
                  </label>
                  <label>
                    最大積載量
                    <input name="capacity" placeholder="10t" required />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    電話番号
                    <input name="phone" inputMode="tel" required />
                  </label>
                  <label>
                    免許区分
                    <select name="license">
                      <option>大型</option>
                      <option>中型</option>
                      <option>大型・けん引</option>
                    </select>
                  </label>
                  <label>
                    免許期限
                    <input name="expires" type="date" required />
                  </label>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="outline"
                onClick={() => setCreateOpen(false)}
              >
                閉じる
              </button>
              <button className="primary">登録</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const transportPlans = [
  {
    id: "TR-20260820-01",
    day: "当日",
    departure: "（仮称）サンプル現場 A",
    destination: "湾岸リサイクルセンター",
    material: "コンクリートがら",
    vehicle: "品川 100 あ 12-34",
    driver: "サンプル 運転者1",
    departAt: "08:30",
    travelMinutes: 45,
    arriveAt: "09:15",
    workMinutes: 35,
    finishAt: "09:50",
    status: "空きあり",
    note: "受付後、東側ヤードへ移動",
  },
  {
    id: "TR-20260820-02",
    day: "当日",
    departure: "サンプル現場 B",
    destination: "中央中間処理施設",
    material: "混合廃棄物",
    vehicle: "足立 100 か 56-78",
    driver: "サンプル 運転者2",
    departAt: "09:10",
    travelMinutes: 55,
    arriveAt: "10:05",
    workMinutes: 45,
    finishAt: "10:50",
    status: "混雑",
    note: "10時台は受付集中。到着前連絡を推奨",
  },
  {
    id: "TR-20260820-03",
    day: "当日",
    departure: "サンプル現場 C",
    destination: "北部資源化センター",
    material: "木くず",
    vehicle: "練馬 100 き 90-12",
    driver: "サンプル 運転者3",
    departAt: "11:20",
    travelMinutes: 35,
    arriveAt: "11:55",
    workMinutes: 30,
    finishAt: "12:25",
    status: "やや混雑",
    note: "正午前後は計量待ちの可能性あり",
  },
  {
    id: "TR-20260820-04",
    day: "当日",
    departure: "（仮称）サンプル現場 D",
    destination: "湾岸リサイクルセンター",
    material: "廃プラスチック類",
    vehicle: "品川 100 く 34-56",
    driver: "サンプル 運転者4",
    departAt: "13:30",
    travelMinutes: 50,
    arriveAt: "14:20",
    workMinutes: 40,
    finishAt: "15:00",
    status: "空きあり",
    note: "予約枠内で受入予定",
  },
  {
    id: "TR-20260820-05",
    day: "当日",
    departure: "（仮称）サンプル現場 A",
    destination: "湾岸リサイクルセンター",
    material: "コンクリートがら",
    vehicle: "品川 100 あ 12-34",
    driver: "サンプル 運転者1",
    departAt: "10:40",
    travelMinutes: 45,
    arriveAt: "11:25",
    workMinutes: 35,
    finishAt: "12:00",
    status: "やや混雑",
    note: "同一車両の2便目",
  },
  {
    id: "TR-20260820-06",
    day: "当日",
    departure: "サンプル現場 B",
    destination: "中央中間処理施設",
    material: "混合廃棄物",
    vehicle: "足立 100 か 56-78",
    driver: "サンプル 運転者2",
    departAt: "12:15",
    travelMinutes: 55,
    arriveAt: "13:10",
    workMinutes: 45,
    finishAt: "13:55",
    status: "空きあり",
    note: "同一車両の2便目",
  },
  {
    id: "TR-20260821-01",
    day: "翌日",
    departure: "（仮称）サンプル現場 A",
    destination: "中央中間処理施設",
    material: "混合廃棄物",
    vehicle: "足立 100 か 56-78",
    driver: "サンプル 運転者2",
    departAt: "08:45",
    travelMinutes: 50,
    arriveAt: "09:35",
    workMinutes: 40,
    finishAt: "10:15",
    status: "やや混雑",
    note: "午前予約枠、受付番号を提示",
  },
  {
    id: "TR-20260821-02",
    day: "翌日",
    departure: "サンプル現場 B",
    destination: "湾岸リサイクルセンター",
    material: "コンクリートがら",
    vehicle: "品川 100 あ 12-34",
    driver: "サンプル 運転者1",
    departAt: "13:00",
    travelMinutes: 45,
    arriveAt: "13:45",
    workMinutes: 35,
    finishAt: "14:20",
    status: "空きあり",
    note: "午後の受入枠に空きあり",
  },
];

function TransportSchedulePage({ setConfirm, initialField = "すべて" }) {
  const [status, setStatus] = useState("すべて");
  const [keyword, setKeyword] = useState("");
  const [day, setDay] = useState("当日");
  const [view, setView] = useState("現場別");
  const [field, setField] = useState(initialField);
  const [expandedField, setExpandedField] = useState(null);
  const visiblePlans = transportPlans.filter(
    (plan) =>
      plan.day === day &&
      (field === "すべて" || plan.departure === field) &&
      (status === "すべて" || plan.status === status) &&
      (!keyword ||
        `${plan.departure}${plan.destination}${plan.vehicle}${plan.driver}`.includes(
          keyword,
        )),
  );
  const destinationTotals = Object.values(
    visiblePlans.reduce((totals, plan) => {
      totals[plan.destination] ||= {
        destination: plan.destination,
        count: 0,
        status: plan.status,
        times: [],
      };
      totals[plan.destination].count += 1;
      totals[plan.destination].times.push(plan.arriveAt);
      if (plan.status === "混雑") totals[plan.destination].status = "混雑";
      return totals;
    }, {}),
  );
  const fieldTotals = Object.values(
    visiblePlans.reduce((totals, plan) => {
      totals[plan.departure] ||= {
        field: plan.departure,
        trips: [],
        vehicles: new Set(),
        destinations: new Set(),
        first: plan.departAt,
        last: plan.finishAt,
      };
      totals[plan.departure].trips.push(plan);
      totals[plan.departure].vehicles.add(plan.vehicle);
      totals[plan.departure].destinations.add(plan.destination);
      if (plan.departAt < totals[plan.departure].first)
        totals[plan.departure].first = plan.departAt;
      if (plan.finishAt > totals[plan.departure].last)
        totals[plan.departure].last = plan.finishAt;
      return totals;
    }, {}),
  );
  return (
    <section className="transport-page">
      <div className="schedule-switches" aria-label="予定表示の切り替え">
        <div className="segmented-control">
          {[
            ["当日", "2026/08/20"],
            ["翌日", "2026/08/21"],
          ].map(([label, date]) => (
            <button
              className={day === label ? "active" : ""}
              onClick={() => setDay(label)}
              key={label}
            >
              <b>{label}</b>
              <span>{date}</span>
            </button>
          ))}
        </div>
        <div className="view-switch">
          {["現場別", "受入場所別"].map((label) => (
            <button
              className={view === label ? "active" : ""}
              onClick={() => setView(label)}
              key={label}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="transport-toolbar">
        <label>
          現場
          <select
            value={field}
            onChange={(event) => setField(event.target.value)}
          >
            <option>すべて</option>
            {fields.slice(0, 8).map((item) => (
              <option key={item.id}>{item.field}</option>
            ))}
          </select>
        </label>
        <label>
          混雑状況
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option>すべて</option>
            <option>空きあり</option>
            <option>やや混雑</option>
            <option>混雑</option>
          </select>
        </label>
        <label className="transport-keyword">
          現場・受入場所・車両
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="キーワードを入力"
          />
        </label>
        <button
          className="primary"
          onClick={() => setConfirm({ title: "運行予定を追加" })}
        >
          予定を追加
        </button>
      </div>

      <div className="transport-summary" aria-label="受入予定の集計">
        <div>
          <span>{day}の現場延べ台数</span>
          <b>{visiblePlans.length}台</b>
        </div>
        <div>
          <span>空きあり</span>
          <b>{visiblePlans.filter((x) => x.status === "空きあり").length}台</b>
        </div>
        <div>
          <span>混雑注意</span>
          <b>{visiblePlans.filter((x) => x.status !== "空きあり").length}台</b>
        </div>
        <div>
          <span>運行予定時間</span>
          <b>{day === "当日" ? "08:30–15:00" : "08:45–14:20"}</b>
        </div>
      </div>

      <div className="transport-list-head">
        <div>
          <h2>搬出・受入スケジュール</h2>
          <p>
            同じ車両の複数便も1便1台として、現場ごとの予定延べ台数を集計します。
          </p>
        </div>
        <b>
          {view === "現場別"
            ? `対象：${fieldTotals.length}現場／延べ${visiblePlans.length}台`
            : `対象：${destinationTotals.length}受入場所／延べ${visiblePlans.length}台`}
        </b>
      </div>

      <div className="transport-list">
        {view === "受入場所別" &&
          destinationTotals.map((item) => (
            <article
              className="destination-summary-card"
              key={item.destination}
            >
              <MapPinned />
              <div>
                <span>受入場所情報</span>
                <h3>{item.destination}</h3>
                <p>到着予定：{item.times.sort().join("、")}</p>
              </div>
              <div className="destination-count">
                <b>{item.count}台</b>
                <span>予定延べ台数</span>
              </div>
              <span
                className={`traffic-status ${item.status === "混雑" ? "busy" : item.status === "やや混雑" ? "medium" : "open"}`}
              >
                {item.status}
              </span>
            </article>
          ))}
        {view === "現場別" &&
          fieldTotals.map((total) => (
            <article className="field-total-card" key={total.field}>
              <div className="field-total-main">
                <Building2 />
                <div>
                  <span>出発現場</span>
                  <h3>{total.field}</h3>
                  <p>
                    運行予定 {total.first}〜{total.last}　／　受入先{" "}
                    {total.destinations.size}か所
                  </p>
                </div>
                <div className="field-total-count">
                  <b>{total.trips.length}台</b>
                  <span>予定延べ台数</span>
                </div>
                <div className="field-total-vehicles">
                  <b>{total.vehicles.size}台</b>
                  <span>実車両数</span>
                </div>
                <button
                  className="outline"
                  aria-expanded={expandedField === total.field}
                  onClick={() =>
                    setExpandedField((current) =>
                      current === total.field ? null : total.field,
                    )
                  }
                >
                  {expandedField === total.field
                    ? "内訳を閉じる"
                    : "内訳を表示"}
                </button>
              </div>
              {expandedField === total.field && (
                <div className="field-trip-breakdown">
                  {total.trips.map((plan, index) => (
                    <div key={plan.id}>
                      <b>{index + 1}便目</b>
                      <span>{plan.departAt} 出発</span>
                      <span>{plan.destination}</span>
                      <span>{plan.vehicle}</span>
                      <span>{plan.finishAt} 完了予定</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        {view === "運行詳細" &&
          visiblePlans.map((plan) => (
            <article className="transport-card" key={plan.id}>
              <div className="transport-card-head">
                <div>
                  <b>{plan.id}</b>
                  <span>{plan.material}</span>
                </div>
                <span
                  className={`traffic-status ${plan.status === "混雑" ? "busy" : plan.status === "やや混雑" ? "medium" : "open"}`}
                >
                  {plan.status}
                </span>
              </div>
              <div className="transport-route">
                <div className="route-point">
                  <MapPin />
                  <span>出発現場</span>
                  <b>{plan.departure}</b>
                  <strong>{plan.departAt} 出発予定</strong>
                </div>
                <div className="route-duration">
                  <Navigation />
                  <b>所要時間 {plan.travelMinutes}分</b>
                  <span>道路状況を含む予定</span>
                </div>
                <div className="route-point destination">
                  <MapPinned />
                  <span>受入場所情報</span>
                  <b>{plan.destination}</b>
                  <strong>{plan.arriveAt} 到着予定</strong>
                </div>
                <div className="route-duration work">
                  <Clock3 />
                  <b>現地作業 {plan.workMinutes}分</b>
                  <span>{plan.finishAt} 完了予定</span>
                </div>
              </div>
              <div className="transport-meta">
                <span>
                  <b>車両</b>
                  {plan.vehicle}
                </span>
                <span>
                  <b>運転者</b>
                  {plan.driver}
                </span>
                <span>
                  <b>受入先メモ</b>
                  {plan.note}
                </span>
                <button
                  className="outline"
                  onClick={() => setConfirm({ title: `${plan.id}の予定詳細` })}
                >
                  詳細
                </button>
              </div>
            </article>
          ))}
        {!visiblePlans.length && (
          <div className="transport-empty">
            条件に一致する運行予定はありません。
          </div>
        )}
      </div>
    </section>
  );
}

function FieldDetailPage({ field, navigate, setConfirm }) {
  const [tab, setTab] = useState(() =>
    new URLSearchParams(location.search).get("section") === "contractors"
      ? "協力会社"
      : "概要",
  );
  const [expandedContractor, setExpandedContractor] = useState("SC-02-01");
  const fieldPlans = transportPlans.filter(
    (plan) => plan.departure === field.field && plan.day === "当日",
  );
  const tabs = ["概要", "協力会社", "入退場", "搬出・受入", "車両・運転手"];
  return (
    <section className="field-detail-page">
      <div className="field-detail-hero">
        <button
          className="text back-to-fields"
          onClick={() => navigate("現場一覧")}
        >
          <ChevronLeft />
          現場一覧へ戻る
        </button>
        <div>
          <span>現場ID：{field.id}</span>
          <h2>{field.field}</h2>
          <p>
            {field.address}　／　{field.start}〜{field.end}
          </p>
        </div>
      </div>
      <nav className="field-subnav" aria-label="現場内メニュー">
        {tabs.map((label) => (
          <button
            className={tab === label ? "active" : ""}
            onClick={() => setTab(label)}
            key={label}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "概要" && (
        <div className="field-dashboard">
          <div className="field-kpis">
            <div>
              <span>本日の入場者</span>
              <b>18名</b>
            </div>
            <div>
              <span>本日の車両</span>
              <b>{Math.max(fieldPlans.length, 2)}台</b>
            </div>
            <div>
              <span>予定延べ台数</span>
              <b>{fieldPlans.length}台</b>
            </div>
            <div>
              <span>未確認のお知らせ</span>
              <b>2件</b>
            </div>
          </div>
          <div className="field-action-grid">
            <button onClick={() => setTab("協力会社")}>
              <Network />
              <span>
                <b>協力会社</b>
                <small>二次・三次の登録階層を確認</small>
              </span>
              <ChevronRight />
            </button>
            <button onClick={() => setTab("入退場")}>
              <DoorOpen />
              <span>
                <b>入退場</b>
                <small>作業員・車両の入退場状況</small>
              </span>
              <ChevronRight />
            </button>
            <button onClick={() => setTab("搬出・受入")}>
              <Truck />
              <span>
                <b>搬出・受入</b>
                <small>当日・翌日の運行予定</small>
              </span>
              <ChevronRight />
            </button>
            <button onClick={() => setTab("車両・運転手")}>
              <BusFront />
              <span>
                <b>車両・運転手</b>
                <small>配車情報と担当者</small>
              </span>
              <ChevronRight />
            </button>
            <button onClick={() => navigate("調整会議")}>
              <CalendarDays />
              <span>
                <b>現場掲示板</b>
                <small>予定・連絡事項を確認</small>
              </span>
              <ChevronRight />
            </button>
          </div>
        </div>
      )}
      {tab === "協力会社" && (
        <div className="field-section contractor-section">
          <div className="section-heading">
            <div>
              <h2>協力会社の登録状況</h2>
              <p>
                二次協力会社を展開すると、配下の三次協力会社を確認できます。
              </p>
            </div>
            <div className="contractor-summary">
              <span>
                二次 <b>{subcontractorHierarchy.length}社</b>
              </span>
              <span>
                三次{" "}
                <b>
                  {subcontractorHierarchy.reduce(
                    (sum, item) => sum + item.children.length,
                    0,
                  )}
                  社
                </b>
              </span>
            </div>
          </div>
          <div
            className="contractor-list"
            role="tree"
            aria-label="協力会社階層"
          >
            {subcontractorHierarchy.map((secondary) => {
              const expanded = expandedContractor === secondary.id;
              return (
                <article
                  className="contractor-group"
                  key={secondary.id}
                  role="treeitem"
                  aria-expanded={expanded}
                >
                  <button
                    className="contractor-row secondary"
                    onClick={() =>
                      setExpandedContractor(expanded ? null : secondary.id)
                    }
                  >
                    <ChevronRight className={expanded ? "expanded" : ""} />
                    <span className="tier-badge secondary">二次</span>
                    <span className="contractor-name">
                      <b>{secondary.name}</b>
                      <small>{secondary.trade}</small>
                    </span>
                    <span>
                      作業員 <b>{secondary.workers}名</b>
                    </span>
                    <span
                      className={`registration-status ${secondary.status === "登録済み" ? "complete" : "pending"}`}
                    >
                      {secondary.status}
                    </span>
                    <span className="children-count">
                      三次 {secondary.children.length}社
                    </span>
                  </button>
                  {expanded && (
                    <div className="tertiary-list" role="group">
                      {secondary.children.map((tertiary) => (
                        <div
                          className="contractor-row tertiary"
                          key={tertiary.id}
                          role="treeitem"
                        >
                          <span className="hierarchy-line" aria-hidden="true" />
                          <span className="tier-badge tertiary">三次</span>
                          <span className="contractor-name">
                            <b>{tertiary.name}</b>
                            <small>{tertiary.trade}</small>
                          </span>
                          <span>
                            作業員 <b>{tertiary.workers}名</b>
                          </span>
                          <span
                            className={`registration-status ${tertiary.status === "登録済み" ? "complete" : "pending"}`}
                          >
                            {tertiary.status}
                          </span>
                          <button
                            className="outline"
                            onClick={() =>
                              setConfirm({
                                title: `${tertiary.name}の登録詳細`,
                                message: `三次協力会社／${tertiary.trade}／${tertiary.status}`,
                              })
                            }
                          >
                            詳細
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
      {tab === "入退場" && (
        <div className="field-section">
          <div className="section-heading">
            <div>
              <h2>本日の入退場</h2>
              <p>この現場に入場している作業員と車両を確認できます。</p>
            </div>
            <button className="primary" onClick={() => navigate("入退場管理")}>
              入退場管理を開く
            </button>
          </div>
          <GridTable
            headers={["区分", "氏名／車両", "入場時刻", "退場時刻", "状態"]}
            rows={[
              ["作業員", "サンプル 作業員1", "07:48", "—", "入場中"],
              ["車両", "10t ダンプ 01", "08:22", "09:58", "退場済み"],
              ["作業員", "サンプル 作業員2", "08:05", "—", "入場中"],
            ]}
          />
        </div>
      )}
      {tab === "搬出・受入" && (
        <TransportSchedulePage
          setConfirm={setConfirm}
          initialField={field.field}
        />
      )}
      {tab === "車両・運転手" && (
        <div className="field-section">
          <div className="section-heading">
            <div>
              <h2>本日の配車</h2>
              <p>この現場に割り当てられた車両と運転手です。</p>
            </div>
            <button className="primary" onClick={() => navigate("車両一覧")}>
              車両一覧を開く
            </button>
          </div>
          <GridTable
            headers={["車両", "車両番号", "運転手", "出発予定", "配車状況"]}
            rows={[
              [
                vehicles[0].name,
                vehicles[0].number,
                drivers[0].name,
                "08:30",
                "配車確定",
              ],
              [
                vehicles[1].name,
                vehicles[1].number,
                drivers[1].name,
                "13:00",
                "配車確定",
              ],
            ]}
          />
        </div>
      )}
    </section>
  );
}
function CompanyPage({ setConfirm }) {
  const [tab, setTab] = useState("本社情報"),
    [editing, setEditing] = useState(false);
  const infoRows = [
    ["種別", "法人"],
    ["会社名", "サンプル株式会社"],
    ["会社名（ふりがな）", "さんぷるかぶしきがいしゃ"],
    ["法人番号", "0000000000000"],
    ["郵便番号", "000-0000"],
    ["都道府県", "東京都"],
    ["市区町村", "サンプル区"],
    ["丁目・番地", "サンプル1-1-1"],
    ["電話番号", "00-0000-0000"],
    ["共通化状態", "〇"],
    ["更新ユーザー", "サンプル管理者"],
    ["更新日時", "2026/08/19 10:00:00"],
  ];
  const safetySections = [
    [
      "代表者情報",
      [
        ["代表者名", "サンプル 太郎"],
        ["代表者フリガナ", "サンプル タロウ"],
        ["代表者役職", "代表取締役"],
      ],
    ],
    [
      "建設業許可情報",
      [
        ["建設業許可有無", "有"],
        ["許可番号", "東京都知事許可（特定-1）第00000号"],
        ["有効期限", "2029/03/31"],
      ],
    ],
    [
      "健康保険情報",
      [
        ["加入状況", "有"],
        ["保険種類", "協会けんぽ"],
        ["保険者名称", "全国健康保険協会 サンプル支部"],
      ],
    ],
    [
      "年金保険情報",
      [
        ["加入状況", "有"],
        ["保険種類", "厚生年金"],
      ],
    ],
    [
      "雇用保険情報",
      [
        ["加入状況", "有"],
        ["労働保険番号", "00000000000000"],
      ],
    ],
    [
      "労災上乗せ保険情報",
      [
        ["加入状況", "有"],
        ["保険期間", "2026/05/01〜2027/05/01"],
        ["保険会社名", "サンプル損害保険"],
      ],
    ],
    [
      "退職金共済情報",
      [
        ["建退共制度加入状況", "有"],
        ["契約者番号", "00-00000"],
      ],
    ],
    ["外国人就労者情報", [["外国人就労者受入有無", "受入なし"]]],
  ];
  return (
    <>
      <div className="company-tabs">
        {["本社情報", "CCUS連携情報", "労務安全項目", "支店情報"].map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </div>
      {tab !== "CCUS連携情報" && tab !== "支店情報" && (
        <div className="company-actions">
          <button className="primary" onClick={() => setEditing((v) => !v)}>
            {editing ? "保存" : "編集"}
          </button>
          <span>
            更新した情報を労務安全書類に反映するには書類の更新が必要です。
          </span>
        </div>
      )}
      {tab === "本社情報" && (
        <section className="company-card">
          <h3>基本情報</h3>
          {infoRows.map(([a, b]) => (
            <div className="info-row" key={a}>
              <b>{a}</b>
              <span>{editing ? <input defaultValue={b} /> : b}</span>
            </div>
          ))}
        </section>
      )}
      {tab === "CCUS連携情報" && (
        <section className="company-card ccus-page">
          <h3>CCUS（建設キャリアアップシステム）と連携するには</h3>
          <p>
            連携にはCCUSの「事業者ID」「管理者ID」「パスワード（またはセキュリティコード）」が必要です。
          </p>
          <h3>CCUS基本情報</h3>
          <div className="info-row">
            <b>CCUS事業者ID</b>
            <span>00000000000000</span>
          </div>
          <div className="info-row">
            <b>CCUS管理者ID</b>
            <span>00000000000000</span>
          </div>
          <div className="sub-actions">
            <button
              key="ccus-admin-edit"
              className="outline"
              onClick={() => setConfirm({ title: "CCUS基本情報を編集" })}
            >
              基本情報を編集
            </button>
            <button
              className="outline"
              onClick={() => setConfirm({ title: "連携ユーザーを編集" })}
            >
              連携ユーザーを編集
            </button>
          </div>
          <h3>連携ユーザー</h3>
          <GridTable
            headers={["会社名", "支店", "ユーザー名", "ID"]}
            rows={[
              [
                "サンプル株式会社",
                "本社",
                "サンプル管理者",
                "sample@example.test",
              ],
            ]}
          />
          <h3>その他の管理者情報</h3>
          <GridTable
            headers={["CCUS管理者ID", "表示名", "連携ユーザー数", ""]}
            rows={[
              [
                "00000000000000",
                "サンプル管理者",
                "未登録",
                <button
                  key="ccus-row-edit"
                  className="outline"
                  onClick={() => setConfirm({ title: "管理者情報を編集" })}
                >
                  編集
                </button>,
              ],
            ]}
          />
          <button
            className="primary"
            onClick={() => setConfirm({ title: "CCUS管理者ID追加" })}
          >
            CCUS管理者ID追加
          </button>
        </section>
      )}
      {tab === "労務安全項目" && (
        <section className="company-card safety-page">
          {safetySections.map(([title, rows]) => (
            <div key={title}>
              <h3>{title}</h3>
              {rows.map(([a, b]) => (
                <div className="info-row" key={a}>
                  <b>{a}</b>
                  <span>{editing ? <input defaultValue={b} /> : b}</span>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
      {tab === "支店情報" && (
        <section className="company-card branch-empty">
          <h3>支店情報</h3>
          <p>支店の登録がありません。</p>
          <p>支店の新規作成・編集・停止は企業管理者が行えます。</p>
          <p>企業管理者の権限を持つユーザーが設定されていません。</p>
          <button
            className="primary"
            onClick={() =>
              setConfirm({
                title: "企業管理者申請",
                message: "企業管理者申請フォームを開きました。",
              })
            }
          >
            企業管理者申請
          </button>
        </section>
      )}
    </>
  );
}
function OrganizationPage() {
  return (
    <div className="org-page">
      <div className="org-toolbar">
        <button className="primary">会社を追加</button>
        <button className="outline">施工体系図を出力</button>
        <select>
          <option>サンプル現場 A</option>
        </select>
      </div>
      <div className="org-canvas">
        <div className="org-card root">
          元請会社
          <br />
          <b>サンプル建設株式会社</b>
        </div>
        <div className="org-line" />
        <div className="org-level">
          <div className="org-card">
            一次協力会社 A<br />
            <b>サンプル工業</b>
          </div>
          <div className="org-card">
            一次協力会社 B<br />
            <b>サンプル設備</b>
          </div>
        </div>
      </div>
    </div>
  );
}
function AgencyPage({ type, query, setQuery, setDetailOpen, setConfirm }) {
  let isReq = type === "代行登録申請",
    isOrigin = type === "自社の代行元一覧";
  let headers = isReq
    ? ["会社名", "住所", "電話番号", "会社種別", "ステータス", "申請履歴"]
    : isOrigin
      ? [
          "代行元会社名",
          "住所",
          "電話番号",
          "会社種別",
          "申請履歴",
          "代行関係解除",
        ]
      : [
          "代行先会社名",
          "住所",
          "電話番号",
          "代行開始日",
          "詳細確認・編集",
          "代行関係解除",
        ];
  let rows = isReq
    ? [
        [
          "サンプル運輸株式会社",
          "東京都中央区サンプル1-2-3",
          "00-0000-1001",
          "法人",
          "審査中",
          <button
            className="outline"
            onClick={() => setConfirm({ title: "申請履歴" })}
          >
            履歴
          </button>,
        ],
        [
          "サンプル土木株式会社",
          "千葉県船橋市サンプル4-5-6",
          "00-0000-1002",
          "法人",
          "承認済み",
          <button
            className="outline"
            onClick={() => setConfirm({ title: "申請履歴" })}
          >
            履歴
          </button>,
        ],
      ]
    : isOrigin
      ? [
          [
            "サンプル株式会社",
            "サンプル住所",
            "00-0000-0000",
            "法人",
            <button
              className="outline"
              onClick={() => setConfirm({ title: "申請履歴" })}
            >
              申請履歴
            </button>,
            <button
              className="danger"
              onClick={() => setConfirm({ title: "代行関係解除" })}
            >
              代行関係を解除
            </button>,
          ],
        ]
      : [
          [
            "サンプル配車株式会社",
            "東京都江東区サンプル2-3-4",
            "00-0000-2001",
            "2026/04/01",
            <button
              className="outline"
              onClick={() => setConfirm({ title: "代行先会社詳細" })}
            >
              詳細・編集
            </button>,
            <button
              className="danger"
              onClick={() => setConfirm({ title: "代行関係解除" })}
            >
              解除
            </button>,
          ],
          [
            "サンプル環境株式会社",
            "神奈川県川崎市サンプル5-6-7",
            "00-0000-2002",
            "2026/05/15",
            <button
              className="outline"
              onClick={() => setConfirm({ title: "代行先会社詳細" })}
            >
              詳細・編集
            </button>,
            <button
              className="danger"
              onClick={() => setConfirm({ title: "代行関係解除" })}
            >
              解除
            </button>,
          ],
        ];
  return (
    <>
      <SearchBar
        count={rows.length}
        query={query}
        setQuery={setQuery}
        placeholder={
          isReq
            ? "会社名を入力"
            : isOrigin
              ? "代行元会社名を入力"
              : "代行先会社名を入力"
        }
        extra={
          <label className="check">
            <input type="checkbox" />
            {isReq ? "申請中を含める" : "解除済の会社を含める"}
          </label>
        }
        onDetail={() => setDetailOpen(true)}
        onClear={() => setQuery("")}
      />
      {isReq && (
        <div className="action-strip">
          <button
            className="primary"
            onClick={() => setConfirm({ title: "代行登録申請確認" })}
          >
            新規申請
          </button>
          <button className="outline">Word</button>
          <button className="outline">PDF</button>
          <p>申請処理には数営業日かかる場合があります。</p>
        </div>
      )}{" "}
      {!isReq && !isOrigin && (
        <div className="notice">
          代行登録機能を利用すると、下位協力会社の情報を登録・編集できます。
        </div>
      )}
      <GridTable headers={headers} rows={rows} empty={!rows.length} />
      <Pager />
    </>
  );
}

const greenMenus = [
  "書類状況一覧",
  "新規入場時等教育実施報告書",
  "【元請会社】新規入場者調査票",
  "その他の安全書類",
  "元請帳票の確認",
  "配下協力会社検索",
  "配下作業員検索（送り出し教育）",
  "是正依頼内容の確認・返信",
  "書類一括出力",
  "共通メニュー",
  "現場掲示板",
];

function GfFilter({ worker = false, onClose, onSearch }) {
  return (
    <div className="gf-filter">
      <div className="gf-filter-head">
        <b>{worker ? "作業員検索" : "協力会社検索"}</b>
        <button onClick={onClose}>
          <X />
        </button>
      </div>
      <div className="gf-form-grid">
        <label>
          一次協力会社
          <select>
            <option>すべて</option>
            <option>サンプル建設株式会社</option>
          </select>
        </label>
        <label>
          {worker ? "作業員氏名" : "会社名（部分一致）"}
          <input placeholder="入力してください" />
        </label>
        {worker && (
          <>
            <label>
              所属会社
              <input placeholder="会社名を入力" />
            </label>
            <label>
              職種
              <select>
                <option>すべて</option>
                <option>土工</option>
              </select>
            </label>
          </>
        )}
      </div>
      <div className="gf-checks">
        {!worker && (
          <>
            <b>会社種別</b>
            <label>
              <input type="checkbox" /> 一人親方
            </label>
            <label>
              <input type="checkbox" /> 個人事業主
            </label>
            <label>
              <input type="checkbox" /> 法人
            </label>
          </>
        )}
        {worker && (
          <>
            <b>保険・健康情報</b>
            <label>
              <input type="checkbox" /> 社会保険未加入
            </label>
            <label>
              <input type="checkbox" /> 健康診断期限超過
            </label>
            <label>
              <input type="checkbox" /> 高血圧基準該当
            </label>
            <label>
              <input type="checkbox" /> 年齢条件を指定
            </label>
          </>
        )}
        {!worker && (
          <>
            <b>提出状況</b>
            {[
              "未提出",
              "提出済",
              "差戻し",
              "受領済",
              "未読コメントのみ",
              "未承認会社を非表示",
            ].map((x) => (
              <label key={x}>
                <input type="checkbox" /> {x}
              </label>
            ))}
          </>
        )}
      </div>
      <div className="gf-filter-actions">
        <button className="outline" onClick={onClose}>
          キャンセル
        </button>
        <button className="primary" onClick={onSearch}>
          <Search />
          検索
        </button>
      </div>
    </div>
  );
}

function GreenDocumentList({ title, setConfirm }) {
  const [filter, setFilter] = useState(false);
  const [otherTab, setOtherTab] = useState("書類の確認・提出");
  const isSurvey = title.includes("新規入場者調査票");
  const isOther = title === "その他の安全書類";
  const isReport = title.includes("教育実施報告書");
  const isOwner = title === "元請帳票の確認";
  const columns = isOther
    ? ["会社名", "一次協力会社名", "工期", "操作"]
    : ["会社名", "一次協力会社名", "工事内容", "工期", "最終更新日時", "操作"];
  const selfRow = isOwner
    ? null
    : isOther
      ? [
          "2次　サンプル協力会社A",
          "サンプル建設株式会社",
          "2026/04/08〜2027/01/31",
        ]
      : [
          "2次　サンプル協力会社A",
          "サンプル建設株式会社",
          isReport ? "新規入場時教育" : "足場組立・躯体工事",
          "2026/04/08〜2027/01/31",
          "2026/08/18 15:29",
        ];
  const lowerRow =
    isOther || isOwner
      ? null
      : [
          "3次　サンプル協力会社B",
          "サンプル協力会社A",
          isReport ? "新規入場時教育" : "コンクリート打設",
          "2026/06/04〜2027/01/31",
          "2026/08/17 15:28",
        ];
  const purpose = isSurvey
    ? "元請会社が独自に定めた、新規入場前の会社・工事内容に関する調査票です。"
    : isOther
      ? "元請会社が追加した任意様式の安全書類を、テンプレートから作成・提出します。"
      : isReport
        ? "新規入場時等教育の実施内容と実施日を会社単位で報告します。"
        : "元請会社が公開した帳票の内容と提出状況を確認します。";
  const renderTable = (row, emptyText) => (
    <div className="gf-table-wrap">
      <table className="gf-table">
        <thead>
          <tr>
            {columns.map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {row ? (
            <tr>
              {row.map((x) => (
                <td key={x}>{x}</td>
              ))}
              <td>
                <button
                  className="outline"
                  onClick={() => setConfirm({ title: `${title} 詳細` })}
                >
                  確認
                </button>
              </td>
            </tr>
          ) : (
            <tr>
              <td colSpan={columns.length} className="gf-empty">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
  return (
    <section className="gf-page">
      <h2>{title}</h2>
      <p className="gf-lead">{purpose}</p>
      <div className="gf-purpose">
        <b>
          {isSurvey
            ? "元請指定様式"
            : isOther
              ? "任意追加書類"
              : "提出・確認書類"}
        </b>
        <span>{purpose}</span>
      </div>
      {isOther && (
        <div className="gf-inner-tabs">
          <button
            className={otherTab === "書類の確認・提出" ? "active" : ""}
            onClick={() => setOtherTab("書類の確認・提出")}
          >
            書類の確認・提出
          </button>
          <button
            className={
              otherTab === "テンプレートのダウンロード" ? "active" : ""
            }
            onClick={() => setOtherTab("テンプレートのダウンロード")}
          >
            テンプレートのダウンロード
          </button>
        </div>
      )}
      {isOther && otherTab === "テンプレートのダウンロード" ? (
        <>
          <div className="gf-subhead">
            <b>利用可能なテンプレート</b>
          </div>
          <div className="gf-download-list">
            <FileText />
            <span>安全書類テンプレート（匿名サンプル）</span>
            <button
              className="outline"
              onClick={() =>
                setConfirm({ title: "テンプレートをダウンロード" })
              }
            >
              ダウンロード
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="gf-toolbar">
            <b>検索結果：{selfRow ? 1 : 0}件</b>
            <button className="outline" onClick={() => setFilter((v) => !v)}>
              検索で絞り込む
            </button>
            <button className="outline" disabled>
              Excel出力
            </button>
          </div>
          {filter && (
            <GfFilter
              onClose={() => setFilter(false)}
              onSearch={() => setFilter(false)}
            />
          )}
          <div className="gf-subhead">
            <b>自社が作成・提出する書類（ログイン中会社に関する事項）</b>
            <button
              className="primary"
              onClick={() =>
                setConfirm({
                  title: "書類を新規作成",
                  message:
                    "入力画面を開きました。匿名サンプルとして登録操作を確認できます。",
                })
              }
            >
              新規作成
            </button>
          </div>
          {renderTable(selfRow, "自社が作成・提出した書類はありません")}
          <div className="gf-subhead">
            <b>自社が確認を行う書類（下位協力会社に関する事項）</b>
          </div>
          {renderTable(lowerRow, "該当する下位協力会社の書類はありません")}
        </>
      )}
    </section>
  );
}

function GreenfilePage({ setConfirm }) {
  const [menu, setMenu] = useState("書類状況一覧");
  const [filter, setFilter] = useState(false);
  const [category, setCategory] = useState("一括提出書類");
  const [comment, setComment] = useState(false);
  const statusRows = [
    ["1次", "サンプル建設株式会社", "受領済"],
    ["2次", "サンプル協力会社A", "提出済"],
    ["3次", "サンプル協力会社B", "未提出"],
  ];
  const docMenus = greenMenus.slice(1, 5);
  let panel;
  if (menu === "書類状況一覧")
    panel = (
      <section className="gf-page">
        <h2>書類状況一覧</h2>
        <p className="gf-lead">
          協力会社から提出された安全書類の提出状況を一覧で確認します。
        </p>
        <div className="gf-alert">
          未確認・差戻しの書類がある場合は、内容を確認して受領操作を行ってください。
        </div>
        <div className="gf-toolbar">
          <b>検索結果：3件</b>
          <button className="text-button">検索条件をクリア</button>
          <button className="outline" onClick={() => setFilter((v) => !v)}>
            検索で絞り込む
          </button>
          <button
            className="outline"
            onClick={() => setConfirm({ title: "この画面の使い方" })}
          >
            この画面の使い方
          </button>
        </div>
        {filter && (
          <GfFilter
            onClose={() => setFilter(false)}
            onSearch={() => setFilter(false)}
          />
        )}
        <div className="gf-tabs">
          {[
            "一括提出書類",
            "個別提出書類",
            "許可情報",
            "契約情報",
            "保険加入証明書",
            "主任技術者",
          ].map((x) => (
            <button
              key={x}
              className={category === x ? "active" : ""}
              onClick={() => setCategory(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="gf-matrix-wrap">
          <table className="gf-table gf-matrix">
            <thead>
              <tr>
                {[
                  "提出状況",
                  "次数",
                  "会社名",
                  "コメント",
                  "提出操作",
                  "施工体制台帳",
                  "再下請負通知書",
                  "作業員名簿",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statusRows.map((r, i) => (
                <tr key={r[1]}>
                  <td>
                    <span className={`gf-status s${i}`}>{r[2]}</span>
                  </td>
                  <td>{r[0]}</td>
                  <td>{r[1]}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setComment(true)}
                    >
                      確認{i === 1 && "（1）"}
                    </button>
                  </td>
                  <td>
                    <button
                      className="outline"
                      onClick={() =>
                        setConfirm({
                          title: i === 2 ? "書類提出" : "提出書類の取下げ確認",
                        })
                      }
                    >
                      {i === 2 ? "提出" : "取下げ"}
                    </button>
                  </td>
                  {[0, 1, 2].map((n) => (
                    <td key={n}>{i === 2 ? "—" : "確認済"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {comment && (
          <aside className="gf-comment">
            <div>
              <b>コメント</b>
              <button onClick={() => setComment(false)}>
                <X />
              </button>
            </div>
            <p>提出書類についての確認コメントを表示します。</p>
            <textarea placeholder="返信を入力" />
            <button
              className="primary"
              onClick={() => {
                setComment(false);
                setConfirm({ title: "コメントを送信しました" });
              }}
            >
              返信
            </button>
          </aside>
        )}
      </section>
    );
  else if (docMenus.includes(menu))
    panel = <GreenDocumentList title={menu} setConfirm={setConfirm} />;
  else if (menu.includes("協力会社検索"))
    panel = <SearchServicePage worker={false} setConfirm={setConfirm} />;
  else if (menu.includes("作業員検索"))
    panel = <SearchServicePage worker setConfirm={setConfirm} />;
  else if (menu.includes("是正依頼"))
    panel = (
      <section className="gf-page">
        <h2>是正依頼内容の確認・返信</h2>
        <p className="gf-lead">
          元請会社からの是正依頼と返信状況を確認できます。
        </p>
        <div className="gf-toolbar">
          <b>検索結果：1件</b>
          <button className="outline">検索で絞り込む</button>
        </div>
        <table className="gf-table">
          <thead>
            <tr>
              <th>受付日</th>
              <th>対象書類</th>
              <th>依頼内容</th>
              <th>ステータス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2026/08/18</td>
              <td>作業員名簿</td>
              <td>記載内容をご確認ください</td>
              <td>未返信</td>
              <td>
                <button
                  className="primary"
                  onClick={() => setConfirm({ title: "是正依頼への返信" })}
                >
                  確認・返信
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    );
  else if (menu === "共通メニュー")
    panel = <CommonMenuPage onOpenBoard={() => setMenu("現場掲示板")} />;
  else if (menu === "現場掲示板")
    panel = <BulletinBoard setConfirm={setConfirm} />;
  else panel = <BatchOutput setConfirm={setConfirm} />;
  return (
    <div className="service-shell">
      <aside className="service-menu">
        <b>労務安全</b>
        {greenMenus.map((x, i) => (
          <button
            key={x}
            className={menu === x ? "active" : ""}
            onClick={() => setMenu(x)}
          >
            {i > 0 && i < 4 ? <span>└</span> : null}
            {x}
          </button>
        ))}
      </aside>
      <div className="service-main">{panel}</div>
    </div>
  );
}

function SearchServicePage({ worker, setConfirm }) {
  const [filter, setFilter] = useState(true);
  const cols = worker
    ? [
        "氏名",
        "次数",
        "所属会社",
        "作業内容",
        "職種",
        "役割",
        "生年月日",
        "年齢",
        "健康診断日",
        "血圧",
        "入場日",
        "教育実施日",
      ]
    : ["会社名", "一次協力会社", "作業内容", "工期", "操作"];
  return (
    <section className="gf-page">
      <h2>{worker ? "配下作業員検索（送り出し教育）" : "配下協力会社検索"}</h2>
      <p className="gf-lead">
        {worker
          ? "現場に登録された作業員情報と送り出し教育の状況を検索します。"
          : "現場に登録された配下協力会社を検索します。"}
      </p>
      <div className="gf-toolbar">
        <b>検索結果：{worker ? 2 : 3}件</b>
        <button className="outline" onClick={() => setFilter((v) => !v)}>
          検索条件
        </button>
        {worker && (
          <button
            className="primary"
            onClick={() =>
              setConfirm({
                title: "作業員の送り出し",
                message: "選択した作業員の送り出し教育画面を開きました。",
              })
            }
          >
            作業員の送り出し
          </button>
        )}
      </div>
      {filter && (
        <GfFilter
          worker={worker}
          onClose={() => setFilter(false)}
          onSearch={() => setFilter(false)}
        />
      )}
      <div className="gf-matrix-wrap">
        <table className="gf-table">
          <thead>
            <tr>
              {cols.map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1].map((i) => (
              <tr key={i}>
                {worker ? (
                  <>
                    <td>サンプル作業員 {i + 1}</td>
                    <td>{i + 1}次</td>
                    <td>サンプル協力会社{String.fromCharCode(65 + i)}</td>
                    <td>躯体工事</td>
                    <td>土工</td>
                    <td>{i ? "作業員" : "職長"}</td>
                    <td>1985/01/01</td>
                    <td>41</td>
                    <td>2026/04/01</td>
                    <td>120/75</td>
                    <td>2026/04/10</td>
                    <td>2026/04/05</td>
                  </>
                ) : (
                  <>
                    <td>サンプル協力会社{String.fromCharCode(65 + i)}</td>
                    <td>サンプル建設株式会社</td>
                    <td>躯体工事</td>
                    <td>2026/04/01〜2027/03/31</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setConfirm({ title: "協力会社詳細" })}
                      >
                        確認
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BatchOutput({ setConfirm }) {
  const [only, setOnly] = useState(false);
  return (
    <section className="gf-page">
      <h2>書類一括出力</h2>
      <p className="gf-lead">
        協力会社が提出した書類を会社単位でまとめて出力できます。
      </p>
      <div className="gf-filter static">
        <div className="gf-form-grid">
          <label>
            次数
            <select>
              <option>すべて</option>
            </select>
          </label>
          <label>
            会社名
            <input placeholder="会社名を入力" />
          </label>
        </div>
        <div className="gf-checks">
          <label>
            <input
              type="checkbox"
              checked={only}
              onChange={(e) => setOnly(e.target.checked)}
            />{" "}
            出力可能な会社のみ
          </label>
          <label>
            <input type="checkbox" /> 前回出力後に更新された会社のみ
          </label>
          <button className="primary">
            <Search />
            検索
          </button>
        </div>
      </div>
      <div className="gf-alert">
        出力予約後、処理が完了するとダウンロードできます。
      </div>
      <div className="gf-toolbar">
        <b>検索結果：3件</b>
        <button
          className="primary"
          onClick={() =>
            setConfirm({
              title: "一括出力予約",
              message: "対象の書類を一括出力予約しました。",
            })
          }
        >
          一括出力予約
        </button>
      </div>
      <table className="gf-table">
        <thead>
          <tr>
            <th>会社名</th>
            <th>作業内容</th>
            <th>工期</th>
            <th>出力状況</th>
            <th>予約日時／予約者</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>サンプル協力会社A</td>
            <td>躯体工事</td>
            <td>2026/04/01〜2027/03/31</td>
            <td>
              <b className="gf-unoutput">未出力あり</b>
            </td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

const gateMenus = [
  "ダッシュボード",
  "入退場実績",
  "作業員設定状況一覧",
  "共通メニュー",
  "現場掲示板",
];
const conferenceMenus = [
  "ダッシュボード",
  "作業予定一覧",
  "他社予定確認",
  "作業実績一覧",
  "入場人数との差異",
  "ゲート予定",
  "揚重機予定",
  "機材予定",
  "現場配置計画",
  "巡回記録/各種連絡",
  "帳票印刷",
  "共通メニュー",
  "現場掲示板",
];

function ServiceFrame({ brand, menus, active, setActive, children, notice }) {
  return (
    <div className="service-product">
      <div className="product-top">
        <b>{brand}</b>
        <span>サンプル現場 A</span>
        <button className="help">？ ヘルプ</button>
      </div>
      {notice && (
        <div className="product-notice">
          あなたへの重要なお知らせが1件あります
        </div>
      )}
      <div className="product-body">
        <aside className="product-menu">
          <h2>機能一覧</h2>
          {menus.slice(0, -2).map((m) => (
            <button
              key={m}
              className={active === m ? "active" : ""}
              onClick={() => setActive(m)}
            >
              <span>{m}</span>
            </button>
          ))}
          <h3>共通メニュー</h3>
          <button
            className={active === "共通メニュー" ? "active" : ""}
            onClick={() => setActive("共通メニュー")}
          >
            <span>共通メニュー</span>
          </button>
          <button
            className={active === menus.at(-1) ? "active" : ""}
            onClick={() => setActive(menus.at(-1))}
          >
            <span>{menus.at(-1)}</span>
          </button>
        </aside>
        <main className="product-main">{children}</main>
      </div>
    </div>
  );
}

function ServiceDashboard({ gate }) {
  return (
    <>
      <h1>ダッシュボード</h1>
      <div className="dashboard-cols">
        <section>
          <h3>現場詳細</h3>
          <dl className="detail-list">
            <dt>現場名</dt>
            <dd>サンプル現場 A</dd>
            <dt>{gate ? "着工 - 竣工予定日" : "現場住所"}</dt>
            <dd>
              {gate
                ? "2026/04/20(月) - 2027/03/31(水)"
                : "東京都中央区 サンプル1-1"}
            </dd>
            <dt>{gate ? "現場所在地" : "着工 - 竣工予定日"}</dt>
            <dd>
              {gate
                ? "東京都中央区 サンプル1-1"
                : "2026/04/20(月) - 2027/03/31(水)"}
            </dd>
          </dl>
        </section>
        <section>
          <h3>{gate ? "入退場実績" : "人工（人）"}</h3>
          {gate ? (
            <table className="service-table">
              <tbody>
                <tr>
                  <td>08/18(火)</td>
                  <td>入場者数</td>
                  <td>0人</td>
                </tr>
                <tr>
                  <td>08/19(水)</td>
                  <td>入場者数</td>
                  <td>0人</td>
                </tr>
                <tr>
                  <td></td>
                  <td>退場者数</td>
                  <td>0人</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="labor-count">
              <span>
                予定<b>--</b>
              </span>
              <span>
                実績<b>--</b>
              </span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function GatekeeperPage({ setConfirm }) {
  const [active, setActive] = useState("ダッシュボード");
  const [face, setFace] = useState(false);
  let content;
  if (active === "ダッシュボード") content = <ServiceDashboard gate />;
  else if (active === "入退場実績")
    content = (
      <ServiceList
        title={active}
        columns={[
          "日付",
          "所属会社",
          "氏名",
          "入場時刻",
          "退場時刻",
          "滞在時間",
        ]}
      />
    );
  else if (active === "作業員設定状況一覧")
    content = (
      <>
        <h1>作業員設定状況一覧</h1>
        <div className="product-actions">
          <label>
            <input
              type="checkbox"
              checked={face}
              onChange={(e) => setFace(e.target.checked)}
            />{" "}
            一覧に顔写真を表示する
          </label>
          <button className="outline">CSV出力</button>
        </div>
        <div className="service-filter">
          <b>検索条件（検索結果5件）</b>
          <input placeholder="作業員名を入力" />
          <label>
            <input type="checkbox" /> 稼働中
          </label>
          <label>
            <input type="checkbox" /> 登録あり
          </label>
          <button className="primary">検索</button>
        </div>
        <table className="service-table">
          <thead>
            <tr>
              {[
                "所属会社",
                "一次協力会社",
                "氏名",
                "ステータス",
                "顔写真",
                "顔写真送信",
                "送信対象外理由",
                "エラー状況",
                "詳細",
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((x, i) => (
              <tr key={x}>
                <td>サンプル協力会社</td>
                <td>サンプル協力会社</td>
                <td>
                  {face && (
                    <span className="face-placeholder">
                      <Camera />
                    </span>
                  )}
                  サンプル作業員 {x}
                </td>
                <td>稼働中</td>
                <td>{i === 4 ? "登録なし" : "登録あり"}</td>
                <td>{i === 4 ? "送信対象外" : "送信済み"}</td>
                <td>{i === 4 ? "顔写真がありません。" : "—"}</td>
                <td>—</td>
                <td>
                  <button
                    className="outline"
                    onClick={() => setConfirm({ title: "作業員設定詳細" })}
                  >
                    確認
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  else if (active === "共通メニュー")
    content = <CommonMenuPage onOpenBoard={() => setActive("現場掲示板")} />;
  else content = <BulletinBoard setConfirm={setConfirm} />;
  return (
    <ServiceFrame
      brand="入退場管理"
      menus={gateMenus}
      active={active}
      setActive={setActive}
      notice
    >
      {content}
    </ServiceFrame>
  );
}

function ServiceList({ title, columns }) {
  const [query, setQuery] = useState("");
  return (
    <>
      <h1>{title}</h1>
      <div className="service-filter">
        <b>検索条件</b>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キーワードを入力"
        />
        <input type="date" />
        <button className="primary">検索</button>
        <button className="text" onClick={() => setQuery("")}>
          検索条件クリア
        </button>
      </div>
      <table className="service-table">
        <thead>
          <tr>
            {columns.map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map((i) => (
            <tr key={i}>
              {columns.map((x, j) => (
                <td key={x}>
                  {j === 0
                    ? `2026/08/${18 + i}`
                    : j === 1
                      ? "サンプル協力会社"
                      : j === 2
                        ? `サンプル ${i}`
                        : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function BulletinBoard({ setConfirm }) {
  return (
    <>
      <h1>現場掲示板</h1>
      <div className="product-actions">
        <p>現場内で共有するお知らせを確認できます。</p>
        <button
          className="primary"
          onClick={() => setConfirm({ title: "掲示板へ新規投稿" })}
        >
          新規投稿
        </button>
      </div>
      <table className="service-table">
        <thead>
          <tr>
            <th>掲載期間</th>
            <th>タイトル</th>
            <th>投稿者</th>
            <th>添付</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2026/08/19〜08/31</td>
            <td>サンプルのお知らせ</td>
            <td>現場管理者</td>
            <td>—</td>
            <td>
              <button
                className="outline"
                onClick={() => setConfirm({ title: "掲示内容" })}
              >
                確認
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function CommonMenuPage({ onOpenBoard }) {
  return (
    <>
      <h1>共通メニュー</h1>
      <p className="common-menu-lead">
        現場と各サービスで共通して利用する機能を確認できます。
      </p>
      <div className="common-menu-grid">
        <button onClick={onOpenBoard}>
          <ClipboardList />
          <span>
            <b>現場掲示板</b>
            <small>現場内のお知らせを確認・共有します</small>
          </span>
          <ChevronRight />
        </button>
      </div>
    </>
  );
}

function ConferencePage({ setConfirm }) {
  const [active, setActive] = useState("ダッシュボード");
  const configs = {
    作業予定一覧: [
      "日付",
      "会社名",
      "作業内容",
      "作業場所",
      "人数",
      "安全指示",
      "承認",
    ],
    他社予定確認: [
      "会社名",
      "作業内容",
      "作業場所",
      "人数",
      "重機・機材",
      "確認",
    ],
    作業実績一覧: [
      "日付",
      "会社名",
      "作業内容",
      "予定人数",
      "実績人数",
      "操作",
    ],
    入場人数との差異: ["会社名", "予定人数", "入場人数", "差異", "確認"],
    ゲート予定: ["時間", "ゲート", "搬入会社", "車両", "搬入物", "誘導員"],
    揚重機予定: ["時間", "揚重機", "使用会社", "作業内容", "場所", "状態"],
    機材予定: ["時間", "機材", "使用会社", "用途", "場所", "状態"],
    "巡回記録/各種連絡": ["種別", "日時", "件名", "登録者", "状態", "確認"],
    帳票印刷: ["帳票名", "対象日", "更新日時", "作成者", "出力"],
  };
  let content;
  if (active === "ダッシュボード") content = <ServiceDashboard />;
  else if (active === "現場配置計画")
    content = (
      <>
        <h1>現場配置計画</h1>
        <div className="plan-canvas">
          <MapPinned />
          <b>配置計画図</b>
          <p>図面上で重機・資材・立入禁止区域を配置できます。</p>
          <button
            className="primary"
            onClick={() => setConfirm({ title: "配置計画を編集" })}
          >
            編集
          </button>
        </div>
      </>
    );
  else if (active === "共通メニュー")
    content = <CommonMenuPage onOpenBoard={() => setActive("現場掲示板")} />;
  else if (active === "現場掲示板")
    content = <BulletinBoard setConfirm={setConfirm} />;
  else
    content = (
      <ServiceList
        title={active}
        columns={configs[active] || ["項目", "内容", "状態", "操作"]}
      />
    );
  return (
    <ServiceFrame
      brand="調整会議"
      menus={conferenceMenus}
      active={active}
      setActive={setActive}
      notice
    >
      {content}
    </ServiceFrame>
  );
}

const matchingCandidates = [
  {
    id: "MT-2026-001",
    destination: "湾岸第2受入ヤード",
    area: "千葉県市川市",
    score: 94,
    distance: "18.4km",
    travel: "約38分",
    soil: "第2種建設発生土",
    capacity: "残り 12,400m³",
    daily: "120台/日",
    period: "2026/09/01〜2027/03/31",
    price: "受入 2,800円/m³",
    status: "事前相談可能",
    reasons: ["土質適合", "工期一致", "日量余裕あり", "必要書類4/5"],
  },
  {
    id: "MT-2026-002",
    destination: "北総ストックヤード",
    area: "千葉県印西市",
    score: 86,
    distance: "31.2km",
    travel: "約54分",
    soil: "第2・第3種建設発生土",
    capacity: "残り 28,000m³",
    daily: "80台/日",
    period: "2026/08/20〜2027/06/30",
    price: "受入 2,300円/m³",
    status: "条件確認中",
    reasons: ["土質適合", "工期一致", "総量余裕あり", "距離注意"],
  },
  {
    id: "MT-2026-003",
    destination: "臨海造成受入地",
    area: "神奈川県川崎市",
    score: 72,
    distance: "42.8km",
    travel: "約71分",
    soil: "第1・第2種建設発生土",
    capacity: "残り 8,600m³",
    daily: "45台/日",
    period: "2026/10/01〜2027/02/28",
    price: "受入 3,100円/m³",
    status: "追加試験必要",
    reasons: ["土質条件付き", "工期一部一致", "日量上限あり", "溶出試験必要"],
  },
];

function MatchingPage({ setConfirm }) {
  const [mode, setMode] = useState("搬出案件から探す");
  const [selected, setSelected] = useState(matchingCandidates[0]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("適合度順");
  const [createOpen, setCreateOpen] = useState(false);
  const [workflow, setWorkflow] = useState({});
  const candidates = matchingCandidates
    .filter((item) =>
      `${item.destination}${item.area}${item.soil}`.includes(query),
    )
    .sort((a, b) =>
      sort === "距離順"
        ? Number.parseFloat(a.distance) - Number.parseFloat(b.distance)
        : b.score - a.score,
    );
  const beginConsultation = (candidate) => {
    setWorkflow((current) => ({
      ...current,
      [candidate.id]: "事前相談中",
    }));
    setConfirm({
      title: "事前相談を開始しました",
      message: `${candidate.destination}との条件調整案件を作成しました。`,
    });
  };
  return (
    <section className="matching-page">
      <div className="matching-hero">
        <div>
          <span>SOIL CIRCULATION MATCHING</span>
          <h2>建設発生土マッチング</h2>
          <p>
            搬出時期・土量・土質・距離・受入条件を照合し、調整可能な受入候補を提示します。
          </p>
        </div>
        <button className="primary" onClick={() => setCreateOpen(true)}>
          <Plus /> 新しい案件を登録
        </button>
      </div>
      <div className="matching-kpis">
        <article>
          <span>公開中の搬出案件</span>
          <b>18件</b>
          <small>総量 48,600m³</small>
        </article>
        <article>
          <span>受入可能案件</span>
          <b>12件</b>
          <small>総余力 92,400m³</small>
        </article>
        <article>
          <span>条件調整中</span>
          <b>5件</b>
          <small>今週 +2件</small>
        </article>
        <article>
          <span>成立済み</span>
          <b>9件</b>
          <small>再利用率 68%</small>
        </article>
      </div>
      <div className="matching-toolbar">
        <div className="matching-mode">
          {["搬出案件から探す", "受入案件から探す"].map((item) => (
            <button
              className={mode === item ? "active" : ""}
              key={item}
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label>
          キーワード
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="受入地・地域・土質"
          />
        </label>
        <label>
          並び順
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option>適合度順</option>
            <option>距離順</option>
          </select>
        </label>
        <button
          className="outline"
          onClick={() =>
            setConfirm({
              title: "詳細条件",
              message:
                "期間、総量、日量、土質区分、試験結果、対象地域、車両条件で絞り込みます。",
            })
          }
        >
          <Filter /> 詳細条件
        </button>
      </div>
      <div className="matching-workspace">
        <div className="matching-list">
          <div className="matching-list-title">
            <div>
              <b>マッチング候補</b>
              <small>{candidates.length}件を適合条件から算出</small>
            </div>
            <span>対象案件：サンプル現場A／搬出 6,400m³</span>
          </div>
          {candidates.map((candidate) => (
            <button
              className={`match-card ${selected?.id === candidate.id ? "selected" : ""}`}
              key={candidate.id}
              onClick={() => setSelected(candidate)}
            >
              <div className="match-score">
                <b>{candidate.score}</b>
                <span>適合度</span>
              </div>
              <div className="match-main">
                <small>{candidate.id}</small>
                <h3>{candidate.destination}</h3>
                <p>{candidate.area}</p>
                <div>
                  <span>{candidate.soil}</span>
                  <span>{candidate.period}</span>
                </div>
              </div>
              <div className="match-distance">
                <Navigation />
                <b>{candidate.distance}</b>
                <span>{candidate.travel}</span>
              </div>
              <span className="match-status">
                {workflow[candidate.id] || candidate.status}
              </span>
            </button>
          ))}
        </div>
        {selected && (
          <aside className="match-detail">
            <div className="match-detail-head">
              <div>
                <small>{selected.id}</small>
                <h3>{selected.destination}</h3>
                <p>{selected.area}</p>
              </div>
              <div className="match-score large">
                <b>{selected.score}</b>
                <span>適合度</span>
              </div>
            </div>
            <div className="matching-progress" aria-label="マッチング進行状況">
              {["候補", "事前相談", "条件調整", "書類審査", "成立"].map(
                (step, index) => {
                  const currentStatus =
                    workflow[selected.id] || selected.status;
                  const activeIndex = currentStatus === "事前相談中" ? 1 : 0;
                  return (
                    <span
                      className={index <= activeIndex ? "active" : ""}
                      key={step}
                    >
                      <i>{index + 1}</i>
                      {step}
                    </span>
                  );
                },
              )}
            </div>
            <div className="match-route-preview">
              <MapPin />
              <span>
                <small>搬出元</small>
                <b>サンプル現場A</b>
              </span>
              <ChevronRight />
              <span>
                <small>運搬</small>
                <b>{selected.distance}</b>
                <em>{selected.travel}</em>
              </span>
              <ChevronRight />
              <MapPinned />
              <span>
                <small>受入先</small>
                <b>{selected.destination}</b>
              </span>
            </div>
            <dl className="match-properties">
              <div>
                <dt>受入可能土質</dt>
                <dd>{selected.soil}</dd>
              </div>
              <div>
                <dt>受入可能量</dt>
                <dd>{selected.capacity}</dd>
              </div>
              <div>
                <dt>日別上限</dt>
                <dd>{selected.daily}</dd>
              </div>
              <div>
                <dt>受入期間</dt>
                <dd>{selected.period}</dd>
              </div>
              <div>
                <dt>参考単価</dt>
                <dd>{selected.price}</dd>
              </div>
            </dl>
            <div className="matching-reasons">
              <b>判定内容</b>
              <div>
                {selected.reasons.map((reason) => (
                  <span key={reason}>
                    <ShieldCheck /> {reason}
                  </span>
                ))}
              </div>
            </div>
            <div className="match-actions">
              <button
                className="outline"
                onClick={() =>
                  setConfirm({
                    title: "必要書類",
                    message:
                      "土質試験結果、位置図、搬出計画、車両一覧、搬入申請書を確認します。",
                  })
                }
              >
                必要書類を確認
              </button>
              <button
                className="primary"
                onClick={() => beginConsultation(selected)}
              >
                事前相談を開始
              </button>
            </div>
          </aside>
        )}
      </div>
      {createOpen && (
        <div className="overlay" onMouseDown={() => setCreateOpen(false)}>
          <form
            className="modal form-modal matching-create-modal"
            aria-label="マッチング案件登録"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              setCreateOpen(false);
              setConfirm({
                title: "案件を登録しました",
                message: "条件を保存し、マッチング候補の計算を開始しました。",
              });
            }}
          >
            <h2>マッチング案件登録</h2>
            <div className="form-grid">
              <label>
                案件区分
                <select>
                  <option>建設発生土を搬出したい</option>
                  <option>受け入れたい</option>
                </select>
              </label>
              <label>
                現場
                <select>
                  <option>サンプル現場A</option>
                  <option>サンプル現場B</option>
                </select>
              </label>
              <label>
                土質区分
                <select>
                  <option>第2種建設発生土</option>
                  <option>第3種建設発生土</option>
                  <option>第4種建設発生土</option>
                </select>
              </label>
              <label>
                総土量（m³）
                <input type="number" min="1" defaultValue="6400" required />
              </label>
              <label>
                開始日
                <input type="date" defaultValue="2026-09-01" required />
              </label>
              <label>
                終了日
                <input type="date" defaultValue="2027-01-31" required />
              </label>
              <label>
                1日の予定台数
                <input type="number" min="1" defaultValue="24" required />
              </label>
              <label>
                最大運搬距離（km）
                <input type="number" min="1" defaultValue="50" required />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="outline"
                onClick={() => setCreateOpen(false)}
              >
                キャンセル
              </button>
              <button type="submit" className="primary">
                登録して候補を計算
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

const controlTrips = [
  {
    time: "07:00",
    id: "D-101",
    status: "運行中",
    from: "S-01 サンプル現場A",
    to: "R-03 エコダンプ市川",
    eta: "07:45",
  },
  {
    time: "07:30",
    id: "D-102",
    status: "運行中",
    from: "S-02 サンプル現場B",
    to: "R-01 エコダンプ船橋",
    eta: "08:00",
  },
  {
    time: "08:05",
    id: "D-103",
    status: "遅延",
    from: "S-01 サンプル現場A",
    to: "R-01 エコダンプ船橋",
    eta: "+25分",
  },
  {
    time: "08:30",
    id: "D-104",
    status: "受入中",
    from: "S-03 サンプル現場C",
    to: "R-03 エコダンプ市川",
    eta: "08:50",
  },
  {
    time: "09:15",
    id: "D-105",
    status: "完了",
    from: "S-02 サンプル現場B",
    to: "R-02 エコダンプ横浜",
    eta: "09:05",
  },
  {
    time: "10:00",
    id: "D-106",
    status: "運行中",
    from: "S-04 サンプル現場D",
    to: "R-04 エコダンプ千葉",
    eta: "10:50",
  },
  {
    time: "10:30",
    id: "D-107",
    status: "待機中",
    from: "S-05 サンプル現場E",
    to: "R-01 エコダンプ船橋",
    eta: "出発待ち",
  },
  {
    time: "11:00",
    id: "D-108",
    status: "運行中",
    from: "S-01 サンプル現場A",
    to: "R-05 エコダンプ木更津",
    eta: "11:40",
  },
  {
    time: "11:45",
    id: "D-109",
    status: "遅延",
    from: "S-03 サンプル現場C",
    to: "R-02 エコダンプ横浜",
    eta: "+15分",
  },
  {
    time: "12:30",
    id: "D-110",
    status: "完了",
    from: "S-04 サンプル現場D",
    to: "R-03 エコダンプ市川",
    eta: "12:20",
  },
];

const controlMapLocations = {
  "S-01": {
    name: "サンプル現場A",
    type: "site",
    position: [35.6764, 139.7668],
    detail: "積込中 3台",
    fieldId: "32182",
  },
  "S-02": {
    name: "サンプル現場B",
    type: "site",
    position: [35.6074, 139.6854],
    detail: "積込中 2台",
    fieldId: "32183",
  },
  "S-03": {
    name: "サンプル現場C",
    type: "site",
    position: [35.5323, 139.6967],
    detail: "積込準備 1台",
    fieldId: "32184",
  },
  "S-04": {
    name: "サンプル現場D",
    type: "site",
    position: [35.4437, 139.638],
    detail: "積込中 2台",
    fieldId: "32185",
  },
  "S-05": {
    name: "サンプル現場E",
    type: "site",
    position: [35.695, 139.982],
    detail: "待機中 1台",
    fieldId: "32186",
  },
  "R-01": {
    name: "エコダンプ船橋",
    type: "receive",
    destinationKind: "中間処分場",
    position: [35.6947, 139.9955],
    detail: "受入待ち 2台",
  },
  "R-02": {
    name: "エコダンプ横浜",
    type: "receive",
    destinationKind: "最終処分場",
    position: [35.4662, 139.6227],
    detail: "受入待ち 1台",
  },
  "R-03": {
    name: "エコダンプ市川",
    type: "receive",
    destinationKind: "中間処分場",
    position: [35.6662, 139.9236],
    detail: "受入中 3台",
  },
  "R-04": {
    name: "エコダンプ千葉",
    type: "receive",
    destinationKind: "中間処分場",
    position: [35.6073, 140.1063],
    detail: "受入中 2台",
  },
  "R-05": {
    name: "エコダンプ木更津",
    type: "receive",
    destinationKind: "最終処分場",
    position: [35.3812, 139.9249],
    detail: "受入中 1台",
  },
};

// Simplified driving geometries generated from OSRM. These are stored with the
// prototype so the map follows roads without depending on a routing request at
// page load.
const controlRoadRoutes = {
  "S-01:R-03": {
    distance: "19.0km",
    duration: "約21分",
    points: [
      [35.6764, 139.7668],
      [35.672532, 139.763331],
      [35.66354, 139.773818],
      [35.64873, 139.788449],
      [35.639599, 139.796152],
      [35.639045, 139.797276],
      [35.645662, 139.816953],
      [35.647664, 139.838026],
      [35.646389, 139.857559],
      [35.638036, 139.880946],
      [35.637831, 139.886366],
      [35.639505, 139.889778],
      [35.661272, 139.91556],
      [35.658265, 139.919057],
      [35.666106, 139.923033],
      [35.665931, 139.92343],
    ],
  },
  "S-02:R-01": {
    distance: "38.2km",
    duration: "約41分",
    points: [
      [35.607422, 139.685152],
      [35.609618, 139.695846],
      [35.610756, 139.69599],
      [35.612322, 139.706702],
      [35.616007, 139.709338],
      [35.620009, 139.717823],
      [35.62427, 139.717723],
      [35.631218, 139.720855],
      [35.637529, 139.716952],
      [35.640035, 139.717105],
      [35.645129, 139.722618],
      [35.646388, 139.725584],
      [35.646948, 139.736583],
      [35.64973, 139.737685],
      [35.658316, 139.736421],
      [35.667986, 139.739882],
      [35.671565, 139.743486],
      [35.672644, 139.746555],
      [35.677177, 139.749995],
      [35.677814, 139.753427],
      [35.675377, 139.759721],
      [35.685367, 139.763083],
      [35.684268, 139.768294],
      [35.687592, 139.769993],
      [35.690012, 139.777118],
      [35.694963, 139.784461],
      [35.694198, 139.789961],
      [35.697546, 139.843364],
      [35.703297, 139.868071],
      [35.701636, 139.897731],
      [35.705246, 139.90856],
      [35.710889, 139.919838],
      [35.706981, 139.940342],
      [35.698819, 139.969572],
      [35.693798, 139.978007],
      [35.691826, 139.986834],
      [35.686825, 140.000399],
      [35.688903, 140.000478],
      [35.693291, 139.993975],
      [35.694917, 139.995041],
    ],
  },
  "S-01:R-01": {
    distance: "25.2km",
    duration: "約27分",
    points: [
      [35.6764, 139.7668],
      [35.675597, 139.766055],
      [35.673823, 139.770822],
      [35.683439, 139.776803],
      [35.68945, 139.775763],
      [35.694963, 139.784461],
      [35.694198, 139.789961],
      [35.697546, 139.843364],
      [35.703297, 139.868071],
      [35.701636, 139.897731],
      [35.705246, 139.90856],
      [35.71088, 139.919627],
      [35.706981, 139.940342],
      [35.698819, 139.969572],
      [35.693798, 139.978007],
      [35.691826, 139.986834],
      [35.686825, 140.000399],
      [35.688903, 140.000478],
      [35.693291, 139.993975],
      [35.694917, 139.995041],
    ],
  },
  "S-03:R-03": {
    distance: "30.2km",
    duration: "約35分",
    points: [
      [35.53202, 139.696921],
      [35.536279, 139.702234],
      [35.534307, 139.707623],
      [35.542136, 139.710025],
      [35.573246, 139.733532],
      [35.582997, 139.736428],
      [35.587527, 139.754819],
      [35.610589, 139.755281],
      [35.625741, 139.774035],
      [35.640617, 139.801606],
      [35.645853, 139.818187],
      [35.647655, 139.836994],
      [35.646504, 139.856805],
      [35.637927, 139.881321],
      [35.637928, 139.886747],
      [35.661272, 139.91556],
      [35.658265, 139.919057],
      [35.665931, 139.92343],
    ],
  },
  "S-02:R-02": {
    distance: "21.0km",
    duration: "約30分",
    points: [
      [35.607422, 139.685152],
      [35.600195, 139.685268],
      [35.599072, 139.685761],
      [35.599427, 139.68703],
      [35.59648, 139.682628],
      [35.589332, 139.678443],
      [35.574056, 139.684715],
      [35.567881, 139.693243],
      [35.568134, 139.696277],
      [35.55975, 139.697258],
      [35.528311, 139.684456],
      [35.525702, 139.682009],
      [35.52219, 139.672982],
      [35.514332, 139.66464],
      [35.508038, 139.661946],
      [35.497647, 139.661578],
      [35.49041, 139.65291],
      [35.482148, 139.636666],
      [35.471068, 139.626522],
      [35.469988, 139.627533],
      [35.465758, 139.624103],
      [35.460513, 139.624048],
      [35.46626, 139.623474],
    ],
  },
  "S-04:R-04": {
    distance: "68.5km",
    duration: "約63分",
    points: [
      [35.443448, 139.638468],
      [35.44742, 139.641624],
      [35.442265, 139.650794],
      [35.443526, 139.656646],
      [35.43773, 139.666476],
      [35.445794, 139.668089],
      [35.464029, 139.681571],
      [35.505338, 139.773991],
      [35.512894, 139.786843],
      [35.519561, 139.790029],
      [35.514705, 139.800465],
      [35.43911, 139.911599],
      [35.435424, 139.920382],
      [35.422264, 139.935361],
      [35.41303, 139.955781],
      [35.421464, 139.958986],
      [35.43434, 139.969776],
      [35.443112, 139.972527],
      [35.456869, 140.00552],
      [35.468366, 140.025024],
      [35.489527, 140.042258],
      [35.528404, 140.067127],
      [35.532709, 140.079335],
      [35.528607, 140.099002],
      [35.537855, 140.11236],
      [35.550225, 140.124072],
      [35.564751, 140.129445],
      [35.57873, 140.127156],
      [35.596289, 140.11863],
      [35.607502, 140.108369],
      [35.606935, 140.10571],
    ],
  },
  "S-05:R-01": {
    distance: "1.6km",
    duration: "約4分",
    points: [
      [35.694977, 139.982059],
      [35.696383, 139.98294],
      [35.694283, 139.98812],
      [35.693619, 139.989464],
      [35.694543, 139.989951],
      [35.694659, 139.991422],
      [35.694824, 139.992044],
      [35.693959, 139.992972],
      [35.693509, 139.993564],
      [35.693291, 139.993975],
      [35.693523, 139.994107],
      [35.693984, 139.994629],
      [35.694917, 139.995041],
    ],
  },
  "S-01:R-05": {
    distance: "45.0km",
    duration: "約45分",
    points: [
      [35.6764, 139.7668],
      [35.671927, 139.772151],
      [35.659358, 139.759652],
      [35.652755, 139.7602],
      [35.633589, 139.750675],
      [35.606102, 139.750556],
      [35.590418, 139.738676],
      [35.560551, 139.754578],
      [35.557318, 139.753462],
      [35.553896, 139.746474],
      [35.537431, 139.741479],
      [35.537769, 139.75866],
      [35.515586, 139.799081],
      [35.43967, 139.910733],
      [35.432962, 139.923655],
      [35.428935, 139.92816],
      [35.423423, 139.919863],
      [35.40616, 139.918434],
      [35.399051, 139.921024],
      [35.386169, 139.920421],
      [35.381232, 139.924525],
    ],
  },
  "S-03:R-02": {
    distance: "12.1km",
    duration: "約17分",
    points: [
      [35.53202, 139.696921],
      [35.53161, 139.68588],
      [35.527248, 139.683915],
      [35.526147, 139.682757],
      [35.522591, 139.673707],
      [35.521465, 139.672098],
      [35.514682, 139.664955],
      [35.512123, 139.663231],
      [35.507804, 139.661909],
      [35.499699, 139.662327],
      [35.497289, 139.661284],
      [35.49041, 139.65291],
      [35.487187, 139.645624],
      [35.484532, 139.642138],
      [35.482148, 139.636666],
      [35.471068, 139.626522],
      [35.469988, 139.627533],
      [35.465758, 139.624103],
      [35.460513, 139.624048],
      [35.46626, 139.623474],
    ],
  },
  "S-04:R-03": {
    distance: "48.6km",
    duration: "約51分",
    points: [
      [35.443448, 139.638468],
      [35.44742, 139.641624],
      [35.442265, 139.650794],
      [35.443526, 139.656646],
      [35.437669, 139.666351],
      [35.446147, 139.668295],
      [35.464313, 139.682018],
      [35.504027, 139.771333],
      [35.515801, 139.789885],
      [35.536995, 139.794843],
      [35.557597, 139.780574],
      [35.569928, 139.7599],
      [35.58577, 139.75519],
      [35.609123, 139.755019],
      [35.613055, 139.757287],
      [35.625741, 139.774035],
      [35.640413, 139.801164],
      [35.645662, 139.816953],
      [35.647655, 139.836994],
      [35.646504, 139.856805],
      [35.637927, 139.881321],
      [35.638039, 139.887126],
      [35.661272, 139.91556],
      [35.658265, 139.919057],
      [35.665931, 139.92343],
    ],
  },
};

function mapLocationCode(label) {
  return label.split(" ")[0];
}

function tripRouteProgress(status) {
  if (status === "完了") return 1;
  if (status === "受入中") return 0.94;
  if (status === "待機中") return 0;
  if (status === "遅延") return 0.56;
  return 0.68;
}

function OperationsMap({
  visibleTrips,
  selectedTripData,
  navigate,
  setConfirm,
}) {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);
  const locationLayerRef = useRef(null);
  const callbacksRef = useRef({ navigate, setConfirm });
  callbacksRef.current = { navigate, setConfirm };

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return undefined;
    const points = Object.values(controlMapLocations).map(
      (location) => location.position,
    );
    const map = L.map(elementRef.current, {
      center: [35.61, 139.82],
      zoom: 10,
      minZoom: 8,
      maxZoom: 18,
      zoomControl: false,
    });
    mapRef.current = map;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    Object.entries(controlMapLocations).forEach(([code, location]) => {
      const isSite = location.type === "site";
      const marker = L.circleMarker(location.position, {
        radius: 9,
        color: "#f7fbef",
        weight: 3,
        fillColor: isSite ? "#c4d82e" : "#f39a2d",
        fillOpacity: 1,
      }).addTo(map);
      marker.bindTooltip(
        `<strong>${code}</strong><span>${location.name}</span><small>${location.detail}</small>`,
        { direction: "top", className: `ecodump-map-label ${location.type}` },
      );
      marker.on("click", () => {
        if (location.fieldId) {
          callbacksRef.current.navigate("現場詳細", location.fieldId);
        } else {
          callbacksRef.current.setConfirm({
            title: `${code} ${location.name}`,
            message: `${location.detail}／本日の受入予定を確認できます。`,
          });
        }
      });
    });
    map.fitBounds(points, { padding: [42, 42] });
    map.on("locationfound", (event) => {
      if (locationLayerRef.current) locationLayerRef.current.remove();
      locationLayerRef.current = L.layerGroup([
        L.circle(event.latlng, {
          radius: event.accuracy,
          color: "#61d6c5",
          fillColor: "#61d6c5",
          fillOpacity: 0.08,
          weight: 1,
        }),
        L.circleMarker(event.latlng, {
          radius: 7,
          color: "#fff",
          fillColor: "#21b9a8",
          fillOpacity: 1,
          weight: 3,
        }).bindTooltip("現在地", { permanent: true, direction: "top" }),
      ]).addTo(map);
    });
    map.on("locationerror", () =>
      callbacksRef.current.setConfirm({
        title: "現在地を取得できませんでした",
        message: "ブラウザの位置情報を許可してから、もう一度お試しください。",
      }),
    );
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(elementRef.current);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeLayerRef.current) routeLayerRef.current.remove();
    const layers = visibleTrips
      .flatMap((trip) => {
        const from = controlMapLocations[mapLocationCode(trip.from)];
        const to = controlMapLocations[mapLocationCode(trip.to)];
        if (!from || !to) return [];
        const roadRoute =
          controlRoadRoutes[
            `${mapLocationCode(trip.from)}:${mapLocationCode(trip.to)}`
          ];
        const selected = trip.id === selectedTripData?.id;
        const routePoints = roadRoute?.points || [from.position, to.position];
        const routeLine = L.polyline(routePoints, {
          color:
            trip.status === "遅延"
              ? "#f39a2d"
              : selected
                ? "#d7e82f"
                : "#63c9b2",
          weight: selected ? 6 : 3,
          opacity: selected ? 0.95 : 0.42,
          lineCap: "round",
          lineJoin: "round",
        }).bindTooltip(
          `${trip.id} ${trip.from} → ${to.destinationKind || "受入場所"} ${trip.to}${roadRoute ? `／${roadRoute.distance}・${roadRoute.duration}` : ""}`,
        );
        if (!selected) return [routeLine];
        const progressIndex = Math.min(
          routePoints.length - 1,
          Math.round((routePoints.length - 1) * tripRouteProgress(trip.status)),
        );
        const vehicleMarker = L.circleMarker(routePoints[progressIndex], {
          radius: 8,
          color: "#ffffff",
          weight: 3,
          fillColor: trip.status === "遅延" ? "#f39a2d" : "#d7e82f",
          fillOpacity: 1,
        }).bindTooltip(`${trip.id}・${trip.status}`, {
          permanent: true,
          direction: "top",
          className: "ecodump-vehicle-label",
        });
        return [routeLine, vehicleMarker];
      })
      .filter(Boolean);
    routeLayerRef.current = L.layerGroup(layers).addTo(map);
  }, [visibleTrips, selectedTripData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedTripData) return;
    const from = controlMapLocations[mapLocationCode(selectedTripData.from)];
    const to = controlMapLocations[mapLocationCode(selectedTripData.to)];
    const roadRoute =
      controlRoadRoutes[
        `${mapLocationCode(selectedTripData.from)}:${mapLocationCode(selectedTripData.to)}`
      ];
    if (from && to) {
      map.flyToBounds(roadRoute?.points || [from.position, to.position], {
        padding: [78, 78],
        maxZoom: 12,
        duration: 0.55,
      });
    }
  }, [selectedTripData]);

  const fitAll = () =>
    mapRef.current?.fitBounds(
      Object.values(controlMapLocations).map((location) => location.position),
      { padding: [42, 42] },
    );
  const selectedRoadRoute = selectedTripData
    ? controlRoadRoutes[
        `${mapLocationCode(selectedTripData.from)}:${mapLocationCode(selectedTripData.to)}`
      ]
    : null;
  const selectedFrom = selectedTripData
    ? controlMapLocations[mapLocationCode(selectedTripData.from)]
    : null;
  const selectedTo = selectedTripData
    ? controlMapLocations[mapLocationCode(selectedTripData.to)]
    : null;

  return (
    <div
      className="operations-map"
      aria-label="インタラクティブ運行マップ"
      style={{
        "--control-map-image": `url("${import.meta.env.BASE_URL}ecodump-control-map.png")`,
      }}
    >
      <div className="leaflet-map" ref={elementRef} />
      <div className="map-legend">
        <b>現場・受入先マップ</b>
        <span>
          <i className="site-dot" />
          搬出現場（5）
        </span>
        <span>
          <i className="receive-dot" />
          受入先（5）
        </span>
        <span>
          <Navigation />
          選択運行ルート
        </span>
        <span>
          <TriangleAlert />
          遅延・渋滞
        </span>
      </div>
      <div className="map-selection" aria-live="polite">
        <small>選択中の運行</small>
        <b>{selectedTripData?.id}</b>
        <div className="map-route-stages">
          <span>
            <Building2 />
            <small>搬出現場</small>
            <strong>{selectedFrom?.name}</strong>
          </span>
          <ChevronRight />
          <span>
            <Layers3 />
            <small>{selectedTo?.destinationKind || "受入場所"}</small>
            <strong>{selectedTo?.name}</strong>
          </span>
        </div>
        <span className="map-tracking-status">
          現在位置：{selectedTripData?.status}／車両を追跡中
        </span>
        {selectedRoadRoute && (
          <small>
            道路距離 {selectedRoadRoute.distance}／所要時間{" "}
            {selectedRoadRoute.duration}
          </small>
        )}
      </div>
      <div className="map-tools">
        <button
          aria-label="地図を拡大"
          onClick={() => mapRef.current?.zoomIn()}
        >
          ＋
        </button>
        <button
          aria-label="地図を縮小"
          onClick={() => mapRef.current?.zoomOut()}
        >
          −
        </button>
        <button aria-label="全地点を表示" onClick={fitAll}>
          <MapPinned />
        </button>
        <button
          aria-label="現在地"
          onClick={() =>
            mapRef.current?.locate({
              setView: true,
              maxZoom: 15,
              enableHighAccuracy: true,
            })
          }
        >
          <MapPin />
        </button>
      </div>
      <div className="map-updated">
        <Truck />
        交通情報　14:32更新
      </div>
    </div>
  );
}

function ControlTopBar({
  page,
  navigate,
  menuOpen,
  setMenuOpen,
  setHelpOpen,
  setConfirm,
}) {
  const projects = [
    ["首都圏サンプルプロジェクト", "稼働中 8現場"],
    ["湾岸再開発プロジェクト", "稼働中 4現場"],
    ["北関東造成プロジェクト", "準備中 3現場"],
  ];
  const [projectOpen, setProjectOpen] = useState(false);
  const [project, setProject] = useState(projects[0][0]);
  const dates = ["2026-08-25（火）", "2026-08-26（水）", "2026-08-27（木）"];
  const [dateIndex, setDateIndex] = useState(1);
  const [globalQuery, setGlobalQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unread, setUnread] = useState(3);
  const globalResults = [
    [Building2, "サンプル現場A", "現場", "現場詳細", "32182"],
    [Truck, "10t ダンプ 01", "車両", "車両一覧"],
    [UserRound, "サンプル 運転者1", "運転手", "車両一覧"],
    [Layers3, "湾岸第2受入ヤード", "受入候補", "UCRマッチング"],
  ].filter(([, label, type]) => `${label}${type}`.includes(globalQuery));
  return (
    <>
      <header className="control-topbar">
        <button
          className="control-brand"
          onClick={() => navigate("運行管制")}
          aria-label="運行管制へ戻る"
        >
          <img
            src={`${import.meta.env.BASE_URL}ecodump-logo.png`}
            alt="ECO DUMP"
          />
          <span>
            <b>TRANSPORT CONTROL TOWER</b>
            <small>建設循環物流オペレーション</small>
          </span>
        </button>
        <button
          className="control-project"
          onClick={() => setProjectOpen((value) => !value)}
          aria-expanded={projectOpen}
        >
          <Building2 />
          <span>{project}</span>
          <ChevronDown />
        </button>
        {projectOpen && (
          <div className="project-dropdown" role="menu">
            <div>
              <b>プロジェクトを選択</b>
              <small>表示する現場と運行情報が切り替わります</small>
            </div>
            {projects.map(([name, meta]) => (
              <button
                className={project === name ? "active" : ""}
                key={name}
                onClick={() => {
                  setProject(name);
                  setProjectOpen(false);
                }}
              >
                <Building2 />
                <span>
                  <b>{name}</b>
                  <small>{meta}</small>
                </span>
                {project === name && <ShieldCheck />}
              </button>
            ))}
          </div>
        )}
        <button className="control-date">
          <CalendarDays />
          <span>{dates[dateIndex]}</span>
          <ChevronLeft
            onClick={(event) => {
              event.stopPropagation();
              setDateIndex((value) => Math.max(0, value - 1));
            }}
          />
          <ChevronRight
            onClick={(event) => {
              event.stopPropagation();
              setDateIndex((value) => Math.min(dates.length - 1, value + 1));
            }}
          />
        </button>
        <label className="control-search">
          <Search />
          <input
            aria-label="全体検索"
            placeholder="現場名・車両・運転手で検索"
            value={globalQuery}
            onChange={(event) => setGlobalQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setGlobalQuery("");
            }}
          />
        </label>
        {globalQuery && (
          <div className="global-search-results" role="listbox">
            <header>
              <b>検索結果</b>
              <small>{globalResults.length}件</small>
            </header>
            {globalResults.map(([Icon, label, type, route, fieldId]) => (
              <button
                key={`${type}-${label}`}
                onClick={() => {
                  navigate(route, fieldId);
                  setGlobalQuery("");
                }}
              >
                <Icon />
                <span>
                  <b>{label}</b>
                  <small>{type}</small>
                </span>
                <ChevronRight />
              </button>
            ))}
            {globalResults.length === 0 && (
              <p>一致する現場・車両・運転手はありません</p>
            )}
          </div>
        )}
        <button
          className="control-icon-button"
          aria-label="通知"
          aria-expanded={notificationOpen}
          onClick={() => setNotificationOpen((value) => !value)}
        >
          <Bell />
          {unread > 0 && <i>{unread}</i>}
        </button>
        {notificationOpen && (
          <div className="notification-popover" role="dialog" aria-label="通知">
            <header>
              <div>
                <b>通知</b>
                <small>未読 {unread}件</small>
              </div>
              <button onClick={() => setUnread(0)}>すべて既読</button>
            </header>
            {[
              ["D-103が25分遅延しています", "2分前", "warning"],
              ["湾岸第2受入ヤードから回答が届きました", "18分前", "match"],
              ["サンプル現場Bの受入枠が更新されました", "42分前", "info"],
            ].map(([message, time, tone], index) => (
              <button
                className={tone}
                key={message}
                onClick={() => {
                  setUnread((value) => Math.max(0, value - 1));
                  setNotificationOpen(false);
                  setConfirm({ title: "通知詳細", message });
                }}
              >
                <i />
                <span>
                  <b>{message}</b>
                  <small>{time}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          className="control-icon-button"
          onClick={() => setHelpOpen(true)}
          aria-label="ヘルプ"
        >
          <CircleHelp />
        </button>
        <div className="control-user">
          <UserCircle2 />
          <span>
            <b>管制 太郎</b>
            <small>管制センター</small>
          </span>
        </div>
      </header>
      {menuOpen && (
        <>
          <button
            className="function-launcher-backdrop"
            onClick={() => setMenuOpen(false)}
            aria-label="機能メニューを閉じる"
          />
          <div
            className="function-launcher"
            role="dialog"
            aria-label="機能メニュー"
          >
            <div className="launcher-heading">
              <div>
                <b>機能メニュー</b>
                <small>既存機能はすべてこちらから利用できます</small>
              </div>
              <button onClick={() => setMenuOpen(false)} aria-label="閉じる">
                <X />
              </button>
            </div>
            <button
              className={page === "運行管制" ? "active" : ""}
              onClick={() => {
                navigate("運行管制");
                setMenuOpen(false);
              }}
            >
              <Route />
              <span>
                <b>運行管制</b>
                <small>本日の運行・遅延・受入状況</small>
              </span>
            </button>
            {navGroups.map((group) => (
              <section className="launcher-group" key={group.title}>
                <h3>{group.title}</h3>
                {group.items.map(([Icon, displayLabel, routeLabel]) => (
                  <button
                    className={page === routeLabel ? "active" : ""}
                    key={routeLabel}
                    onClick={() => {
                      navigate(routeLabel);
                      setMenuOpen(false);
                    }}
                  >
                    <Icon />
                    <span>
                      <b>{displayLabel}</b>
                      <small>{routeLabel}</small>
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ControlOperationModal({ mode, onClose, onSave }) {
  const [form, setForm] = useState({
    from: "S-01 サンプル現場A",
    to: "R-03 エコダンプ市川",
    vehicle: "10t ダンプ 01",
    driver: "サンプル 運転者1",
    time: "13:30",
    status: mode === "dispatch" ? "運行中" : "待機中",
  });
  const update = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  return (
    <div className="overlay" onMouseDown={onClose}>
      <form
        className="modal form-modal control-operation-modal"
        aria-label={mode === "dispatch" ? "配車を組む" : "予定を追加"}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
      >
        <div className="operation-modal-title">
          <div>
            <small>TRANSPORT OPERATION</small>
            <h2>{mode === "dispatch" ? "配車を組む" : "運行予定を追加"}</h2>
          </div>
          <button type="button" aria-label="閉じる" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="form-grid">
          <label>
            出発現場
            <select value={form.from} onChange={update("from")}>
              <option>S-01 サンプル現場A</option>
              <option>S-02 サンプル現場B</option>
              <option>S-03 サンプル現場C</option>
            </select>
          </label>
          <label>
            受入場所
            <select value={form.to} onChange={update("to")}>
              <option>R-03 エコダンプ市川</option>
              <option>R-01 エコダンプ船橋</option>
              <option>R-02 エコダンプ横浜</option>
            </select>
          </label>
          <label>
            車両
            <select value={form.vehicle} onChange={update("vehicle")}>
              {vehicles.slice(0, 3).map((vehicle) => (
                <option key={vehicle.number}>{vehicle.name}</option>
              ))}
            </select>
          </label>
          <label>
            運転手
            <select value={form.driver} onChange={update("driver")}>
              {drivers.slice(0, 3).map((driver) => (
                <option key={driver.phone}>{driver.name}</option>
              ))}
            </select>
          </label>
          <label>
            出発予定時刻
            <input type="time" value={form.time} onChange={update("time")} />
          </label>
          <label>
            初期状態
            <select value={form.status} onChange={update("status")}>
              <option>待機中</option>
              <option>運行中</option>
              <option>受入中</option>
            </select>
          </label>
        </div>
        <div className="operation-preview">
          <Truck />
          <span>
            <b>{form.vehicle}</b>
            <small>{form.driver}</small>
          </span>
          <ChevronRight />
          <span>
            <b>{form.from}</b>
            <small>{form.time} 出発予定</small>
          </span>
          <ChevronRight />
          <span>
            <b>{form.to}</b>
            <small>所要時間 約45分</small>
          </span>
        </div>
        <div className="modal-actions">
          <button type="button" className="outline" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="primary">
            {mode === "dispatch" ? "配車を確定" : "予定を登録"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ControlTowerPage({ navigate, setConfirm, collapsed, setCollapsed }) {
  const [tripFilter, setTripFilter] = useState("すべてのステータス");
  const [siteFilter, setSiteFilter] = useState("すべての現場");
  const [cargoFilter, setCargoFilter] = useState("すべての荷種");
  const [selectedTrip, setSelectedTrip] = useState("D-103");
  const [trips, setTrips] = useState(controlTrips);
  const [operationMode, setOperationMode] = useState(null);
  const visibleTrips = trips.filter(
    (trip) =>
      (tripFilter === "すべてのステータス" || trip.status === tripFilter) &&
      (siteFilter === "すべての現場" || trip.from.includes(siteFilter)) &&
      (cargoFilter === "すべての荷種" || cargoFilter === "建設発生土"),
  );
  const hasActiveFilters =
    tripFilter !== "すべてのステータス" ||
    siteFilter !== "すべての現場" ||
    cargoFilter !== "すべての荷種";
  const selectedTripData =
    trips.find((trip) => trip.id === selectedTrip) || trips[0];
  const summaries = [
    [ClipboardList, "予定総便数", "68", "便"],
    [Truck, "配車済み", "53", "便"],
    [Navigation, "運行中", "28", "便"],
    [TriangleAlert, "遅延", "3", "便", "warning"],
    [Clock3, "待機中", "6", "便"],
    [ShieldCheck, "受入完了", "22", "便", "complete"],
  ];
  return (
    <div className="control-tower-page">
      <section className="control-toolbar">
        <button
          className={`toolbar-menu-trigger ${!collapsed ? "active" : ""}`}
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
        >
          <LayoutGrid />
          <span>メニュー</span>
        </button>
        <button
          className="dispatch-primary"
          onClick={() => setOperationMode("dispatch")}
        >
          <Truck />
          <span>配車を組む</span>
          <ChevronRight />
        </button>
        <button onClick={() => setOperationMode("schedule")}>
          <CalendarDays />
          予定を追加
        </button>
        <label>
          現場
          <select
            value={siteFilter}
            onChange={(event) => setSiteFilter(event.target.value)}
          >
            <option>すべての現場</option>
            <option>サンプル現場A</option>
            <option>サンプル現場B</option>
          </select>
        </label>
        <label>
          荷種
          <select
            value={cargoFilter}
            onChange={(event) => setCargoFilter(event.target.value)}
          >
            <option>すべての荷種</option>
            <option>建設発生土</option>
            <option>コンクリートがら</option>
          </select>
        </label>
        <label>
          状態
          <select
            value={tripFilter}
            onChange={(event) => setTripFilter(event.target.value)}
          >
            <option>すべてのステータス</option>
            <option>運行中</option>
            <option>遅延</option>
            <option>受入中</option>
            <option>完了</option>
            <option>待機中</option>
          </select>
        </label>
        <button
          className={`toolbar-filter ${hasActiveFilters ? "active" : ""}`}
          onClick={() => {
            setTripFilter("すべてのステータス");
            setSiteFilter("すべての現場");
            setCargoFilter("すべての荷種");
          }}
        >
          <Filter />
          {hasActiveFilters ? "絞込解除" : "フィルター"}
        </button>
      </section>
      <section className="control-workspace">
        <OperationsMap
          visibleTrips={visibleTrips}
          selectedTripData={selectedTripData}
          navigate={navigate}
          setConfirm={setConfirm}
        />
        <div className="timeline-panel">
          <header>
            <div>
              <b>本日の運行タイムライン</b>
              <small>選択中：{selectedTrip}</small>
            </div>
            <dl>
              <div>
                <dt>計画</dt>
                <dd>68台</dd>
              </div>
              <div>
                <dt>運行中</dt>
                <dd>28台</dd>
              </div>
              <div>
                <dt>遅延</dt>
                <dd>3台</dd>
              </div>
              <div>
                <dt>完了</dt>
                <dd>22台</dd>
              </div>
            </dl>
            <button
              className="timeline-detail-action"
              onClick={() =>
                setConfirm({
                  title: `${selectedTripData.id} 運行詳細`,
                  message: `${selectedTripData.from} → ${selectedTripData.to}／状態：${selectedTripData.status}／到着・完了予定：${selectedTripData.eta}／車両：10t ダンプ 01／運転手：サンプル 運転者1`,
                })
              }
            >
              詳細 <ChevronRight />
            </button>
          </header>
          <div className="timeline-list">
            {visibleTrips.map((trip) => (
              <button
                key={trip.id}
                className={selectedTrip === trip.id ? "selected" : ""}
                onClick={() => setSelectedTrip(trip.id)}
              >
                <time>{trip.time}</time>
                <b>{trip.id}</b>
                <span className={`trip-status status-${trip.status}`}>
                  {trip.status}
                </span>
                <span className="trip-route">
                  <span title={trip.from}>{trip.from}</span>
                  <ChevronRight />
                  <span title={trip.to}>{trip.to}</span>
                </span>
                <small>{trip.eta}</small>
              </button>
            ))}
            {visibleTrips.length === 0 && (
              <div className="timeline-empty">
                <Search />
                <b>条件に一致する運行はありません</b>
                <button
                  onClick={() => {
                    setTripFilter("すべてのステータス");
                    setSiteFilter("すべての現場");
                    setCargoFilter("すべての荷種");
                  }}
                >
                  絞り込みを解除
                </button>
              </div>
            )}
          </div>
          <button
            className="all-trips"
            onClick={() => navigate("搬出・受入スケジュール")}
          >
            すべての運行（68台）を表示 <ChevronRight />
          </button>
        </div>
      </section>
      <section className="control-summary">
        <div className="summary-title">
          <b>本日の運行サマリー</b>
          <small>最終更新 14:32</small>
        </div>
        {summaries.map(([Icon, label, value, unit, tone]) => (
          <button
            className={tone || ""}
            key={label}
            onClick={() =>
              label === "予定総便数"
                ? navigate("搬出・受入スケジュール")
                : setTripFilter(
                    label === "配車済み"
                      ? "すべてのステータス"
                      : label === "受入完了"
                        ? "完了"
                        : label,
                  )
            }
          >
            <Icon />
            <span>
              <small>{label}</small>
              <b>
                {value}
                <i>{unit}</i>
              </b>
            </span>
          </button>
        ))}
      </section>
      {operationMode && (
        <ControlOperationModal
          mode={operationMode}
          onClose={() => setOperationMode(null)}
          onSave={(form) => {
            const nextId = `D-${String(101 + trips.length).padStart(3, "0")}`;
            setTrips((current) => [
              ...current,
              {
                time: form.time,
                id: nextId,
                status: form.status,
                from: form.from,
                to: form.to,
                eta: "約45分",
              },
            ]);
            setSelectedTrip(nextId);
            setTripFilter("すべてのステータス");
            setOperationMode(null);
            setConfirm({
              title: operationMode === "dispatch" ? "配車確定" : "予定登録完了",
              message: `${nextId} を本日の運行タイムラインへ追加しました。`,
            });
          }}
        />
      )}
    </div>
  );
}

export function App() {
  const [page, setPage] = useState(() => {
      const target = new URLSearchParams(location.search).get("page");
      if (target === "labor") return "労務安全";
      if (target === "gatekeeper") return "入退場管理";
      if (target === "conference") return "調整会議";
      if (target === "transport") return "搬出・受入スケジュール";
      if (target === "vehicles") return "車両一覧";
      if (target === "field") return "現場詳細";
      if (target === "fields") return "現場一覧";
      if (target === "company") return "会社情報";
      if (target === "users") return "ユーザー一覧";
      if (target === "agencies") return "代行先一覧";
      if (target === "agency-request") return "代行登録申請";
      if (target === "prime-contractors") return "自社の代行元一覧";
      if (target === "matching") return "UCRマッチング";
      return "運行管制";
    }),
    [collapsed, setCollapsed] = useState(
      () => window.matchMedia("(max-width: 1024px)").matches,
    ),
    [query, setQuery] = useState(""),
    [detailOpen, setDetailOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    [operatorOpen, setOperatorOpen] = useState(false),
    [activeOperator, setActiveOperator] =
      useState("ECO DUMP株式会社 管制 太郎"),
    [confirm, setConfirm] = useState(null),
    [selected, setSelected] = useState(
      () => new URLSearchParams(location.search).get("fieldId") || null,
    ),
    [copied, setCopied] = useState(null);
  useEffect(() => {
    const tabletQuery = window.matchMedia("(max-width: 1024px)");
    const syncNavigation = (event) => setCollapsed(event.matches);
    tabletQuery.addEventListener("change", syncNavigation);
    return () => tabletQuery.removeEventListener("change", syncNavigation);
  }, []);
  const navigate = (p, fieldId) => {
    setPage(p);
    setQuery("");
    setDetailOpen(false);
    const routeKeys = {
      運行管制: "control",
      現場一覧: "fields",
      現場詳細: "field",
      "搬出・受入スケジュール": "transport",
      車両一覧: "vehicles",
      労務安全: "labor",
      入退場管理: "gatekeeper",
      調整会議: "conference",
      会社情報: "company",
      ユーザー一覧: "users",
      代行先一覧: "agencies",
      代行登録申請: "agency-request",
      自社の代行元一覧: "prime-contractors",
      UCRマッチング: "matching",
    };
    const params = new URLSearchParams();
    if (routeKeys[p] && routeKeys[p] !== "control")
      params.set("page", routeKeys[p]);
    if (p === "現場詳細" && (fieldId || selected))
      params.set("fieldId", fieldId || selected);
    history.replaceState(
      null,
      "",
      `${location.pathname}${params.size ? `?${params}` : ""}`,
    );
    if (window.matchMedia("(max-width: 1024px)").matches) setCollapsed(true);
  };
  const copyId = async (id) => {
    await navigator.clipboard?.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 1200);
  };
  let body;
  if (page === "運行管制")
    body = (
      <ControlTowerPage
        {...{ navigate, setConfirm, collapsed, setCollapsed }}
      />
    );
  else if (page === "現場一覧")
    body = (
      <FieldList
        {...{
          query,
          setQuery,
          setDetailOpen,
          selected,
          setSelected,
          copied,
          copyId,
          navigate,
          onOperatorSelect: () => setOperatorOpen(true),
        }}
      />
    );
  else if (page === "現場詳細")
    body = (
      <FieldDetailPage
        field={fields.find((item) => item.id === selected) || fields[0]}
        {...{ navigate, setConfirm }}
      />
    );
  else if (page === "会社情報") body = <CompanyPage setConfirm={setConfirm} />;
  else if (page === "ユーザー一覧")
    body = (
      <ListPage
        type={page}
        {...{ query, setQuery, setDetailOpen, setConfirm }}
      />
    );
  else if (page === "車両一覧")
    body = <VehiclePage {...{ query, setQuery, setDetailOpen, setConfirm }} />;
  else if (page === "搬出・受入スケジュール")
    body = <TransportSchedulePage setConfirm={setConfirm} />;
  else if (page === "UCRマッチング")
    body = <MatchingPage setConfirm={setConfirm} />;
  else if (page === "労務安全")
    body = <GreenfilePage setConfirm={setConfirm} />;
  else if (page === "入退場管理")
    body = <GatekeeperPage setConfirm={setConfirm} />;
  else if (page === "調整会議")
    body = <ConferencePage setConfirm={setConfirm} />;
  else
    body = (
      <AgencyPage
        type={page}
        {...{ query, setQuery, setDetailOpen, setConfirm }}
      />
    );
  return (
    <div
      className={`app-shell control-app-shell ${collapsed ? "is-collapsed" : ""}`}
    >
      <ControlTopBar
        {...{
          page,
          navigate,
          menuOpen,
          setMenuOpen,
          setHelpOpen,
          setConfirm,
        }}
      />
      <button
        className="mobile-menu"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "メニューを開く" : "メニューを閉じる"}
        aria-expanded={!collapsed}
      >
        <Menu />
      </button>
      {!collapsed && (
        <button
          className="sidebar-backdrop"
          onClick={() => setCollapsed(true)}
          aria-label="メニューを閉じる"
        />
      )}
      <aside className="sidebar">
        <div className="brand-row">
          <img
            className="brand-mark"
            src={`${import.meta.env.BASE_URL}ecodump-logo.png`}
            alt="ECO DUMP"
          />
          {!collapsed && <strong>サンプルグループ株式会社</strong>}
          <button
            className="collapse"
            onClick={() => setCollapsed((v) => !v)}
            aria-label="サイドバーを開閉"
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>
        <nav>
          <section className="nav-group nav-group-primary">
            {!collapsed && <h2>運行管制</h2>}
            <button
              className={page === "運行管制" ? "active" : ""}
              onClick={() => navigate("運行管制")}
              aria-label="運行管制"
            >
              <span className="nav-icon">
                <Route />
              </span>
              <span>運行ダッシュボード</span>
            </button>
          </section>
          {navGroups.map((g) => (
            <section className="nav-group" key={g.title}>
              {!collapsed && <h2>{g.title}</h2>}
              {g.items.map(([Icon, displayLabel, routeLabel]) => (
                <button
                  className={page === routeLabel ? "active" : ""}
                  onClick={() => navigate(routeLabel)}
                  key={routeLabel}
                  aria-label={displayLabel}
                  title={collapsed ? displayLabel : undefined}
                >
                  <span className="nav-icon">
                    <Icon />
                  </span>
                  <span>{displayLabel}</span>
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button>
            <span className="nav-icon">
              <Bell />
            </span>
            <span>通知</span>
          </button>
          <button onClick={() => setHelpOpen(true)}>
            <span className="nav-icon">
              <CircleHelp />
            </span>
            <span>ヘルプ</span>
          </button>
          {!collapsed && (
            <>
              <b>お客様番号：0000-0000</b>
              <small>Copyright © ECODUMP. All Rights Reserved.</small>
            </>
          )}
        </div>
      </aside>
      <main className="content">
        {["労務安全", "入退場管理", "調整会議"].includes(page) && (
          <button
            className="module-menu-trigger"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
          >
            <LayoutGrid />
            メニュー
          </button>
        )}
        {!["運行管制", "労務安全", "入退場管理", "調整会議"].includes(page) && (
          <Header
            title={
              page === "現場一覧"
                ? "現場確認"
                : page === "現場詳細"
                  ? "現場詳細"
                  : page
            }
            onHelp={() => setHelpOpen(true)}
            onClose={() => navigate("運行管制")}
            onMenu={() => setCollapsed((value) => !value)}
          />
        )}
        {["運行管制", "労務安全", "入退場管理", "調整会議"].includes(page) ? (
          body
        ) : (
          <div className="control-page-surface">{body}</div>
        )}
      </main>
      {operatorOpen && (
        <div className="overlay" onMouseDown={() => setOperatorOpen(false)}>
          <section
            className="modal operator-modal"
            role="dialog"
            aria-label="操作ユーザー選択"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2>操作ユーザー選択</h2>
                <p>この画面で操作する会社・ユーザーを選択してください。</p>
              </div>
              <button
                onClick={() => setOperatorOpen(false)}
                aria-label="閉じる"
              >
                <X />
              </button>
            </header>
            <div className="operator-list">
              {[
                ["自社", "ECO DUMP株式会社", "管制管理者", "管制 太郎"],
                ["協力", "サンプル運送株式会社", "協力会社管理者", "運送 花子"],
                ["協力", "湾岸土木株式会社", "現場責任者", "湾岸 一郎"],
                ["協力", "北総建設株式会社", "配車担当者", "北総 次郎"],
              ].map(([badge, company, role, name]) => {
                const operator = `${company} ${name}`;
                return (
                  <article
                    className={activeOperator === operator ? "active" : ""}
                    key={operator}
                  >
                    <b className="operator-badge">{badge}</b>
                    <span>
                      <small>所属会社</small>
                      <strong>{company}</strong>
                    </span>
                    <span>
                      <small>ユーザー種別</small>
                      <strong>{role}</strong>
                    </span>
                    <span>
                      <small>氏名</small>
                      <strong>{name}</strong>
                    </span>
                    <button
                      onClick={() => {
                        setActiveOperator(operator);
                        setOperatorOpen(false);
                        setConfirm({
                          title: "操作ユーザーを切り替えました",
                          message: `${operator}として表示・操作します。`,
                        });
                      }}
                    >
                      {activeOperator === operator ? "選択中" : "選択"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
      {detailOpen && (
        <div className="overlay" onMouseDown={() => setDetailOpen(false)}>
          <section
            className="modal detail-modal"
            role="dialog"
            aria-label="詳細検索"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2>詳細検索</h2>
            <div className="detail-grid">
              <label>
                キーワード
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="入力してください"
                />
              </label>
              <label>
                支店
                <select>
                  <option>すべて</option>
                </select>
              </label>
              <label>
                ステータス
                <select>
                  <option>すべて</option>
                </select>
              </label>
              <label className="check">
                <input type="checkbox" />
                終了済みを含める
              </label>
            </div>
            <button className="clear-detail" onClick={() => setQuery("")}>
              検索内容をクリア
            </button>
            <div className="modal-actions">
              <button className="outline" onClick={() => setDetailOpen(false)}>
                閉じる
              </button>
              <button className="primary" onClick={() => setDetailOpen(false)}>
                検索
              </button>
            </div>
          </section>
        </div>
      )}
      {(helpOpen || confirm) && (
        <div
          className="overlay"
          onMouseDown={() => {
            setHelpOpen(false);
            setConfirm(null);
          }}
        >
          <section
            className="modal help-modal"
            role="dialog"
            aria-label={confirm?.title || "ヘルプ"}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="modal-x"
              onClick={() => {
                setHelpOpen(false);
                setConfirm(null);
              }}
            >
              <X />
            </button>
            <CircleHelp />
            <h2>{confirm?.title || "ヘルプセンター"}</h2>
            <p>
              {confirm
                ? confirm.message ||
                  "匿名サンプルデータの詳細画面です。情報を確認して操作できます。"
                : "操作方法やよくある質問を確認できます。"}
            </p>
            <button
              className="primary"
              onClick={() => {
                setHelpOpen(false);
                setConfirm(null);
              }}
            >
              閉じる
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
