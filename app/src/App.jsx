import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  BusFront,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Copy,
  HardHat,
  LayoutGrid,
  Network,
  Search,
  Settings,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

const navGroups = [
  {
    title: "現場情報",
    items: [
      [Building2, "現場一覧"],
      [LayoutGrid, "現場体制（施工体系図）"],
    ],
  },
  {
    title: "自社情報",
    items: [
      [Building2, "会社情報"],
      [UserRound, "ユーザー一覧"],
      [HardHat, "作業員一覧"],
      [BusFront, "車両・機械情報一覧"],
    ],
  },
  {
    title: "協力会社情報",
    items: [
      [Network, "代行先一覧"],
      [ClipboardList, "代行登録申請"],
      [UsersRound, "自社の代行元一覧"],
    ],
  },
];
const fields = Array.from({ length: 12 }, (_, i) => ({
  id: `D-${String(i + 1).padStart(4, "0")}`,
  company: `会社名 ${String.fromCharCode(65 + (i % 5))}`,
  branch: `支店 ${(i % 3) + 1}`,
  field: `サンプル現場 ${String.fromCharCode(65 + i)}`,
  address: `サンプル住所 ${i + 1}`,
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

function Header({ title, onHelp }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <div className="header-actions">
        <button className="guide">
          <CircleHelp />
          はじめてガイド
        </button>
        <button className="help" onClick={onHelp}>
          <CircleHelp />
          ヘルプ
        </button>
        <button className="close">
          閉じる <X />
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
        <button className="primary">
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
          <button className="outline">
            <Settings />
            操作ユーザー選択
          </button>
          <p>
            アクセスしたい現場が表示されない場合は<a href="#help">こちら</a>
            をご確認ください。
          </p>
        </div>
        <div className="table-scroll">
          <table style={{ height: `${filtered.length * 61 + 24}px` }}>
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
                    <strong>{r.field}</strong>
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
                      <i>●</i> ECO
                    </div>
                    {copied === r.id && (
                      <em className="toast">現場IDをコピーしました</em>
                    )}
                  </td>
                  <td>{r.address}</td>
                  <td>{r.start}</td>
                  <td>{r.end}</td>
                  <td>
                    <span className="status">利用中</span>
                  </td>
                  <td>ECO</td>
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
      data: people.map((x) => [
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
  const filtered = config.data.filter((r) =>
    String(r.map((x) => (typeof x === "string" ? x : ""))).includes(query),
  );
  return (
    <>
      <SearchBar
        count={filtered.length || config.data.length}
        query={query}
        setQuery={setQuery}
        placeholder={config.placeholder}
        extra={
          <>
            <label>
              支店{" "}
              <select>
                <option>支店を選択</option>
              </select>
            </label>
            <label>
              種別{" "}
              <select>
                <option>すべて</option>
              </select>
            </label>
          </>
        }
        onDetail={() => setDetailOpen(true)}
        onClear={() => setQuery("")}
      />
      <div className="action-strip">
        {config.actions.map((a, i) => (
          <button className={i === 0 ? "primary" : "outline"} key={a}>
            {a}
          </button>
        ))}
      </div>
      <GridTable
        headers={config.headers}
        rows={filtered.length ? filtered : query ? [] : config.data}
        onConfirm={(i) =>
          setConfirm({ title: `${type.slice(0, -2)}詳細`, index: i })
        }
      />
      <Pager />
    </>
  );
}
function VehiclePage({ query, setQuery, setDetailOpen }) {
  const [tab, setTab] = useState(0);
  return (
    <>
      <div className="page-tabs">
        <button className={tab === 0 ? "active" : ""} onClick={() => setTab(0)}>
          工事・通勤用車両
        </button>
        <button className={tab === 1 ? "active" : ""} onClick={() => setTab(1)}>
          移動式クレーン・車両系建設機械
        </button>
      </div>
      <SearchBar
        count={0}
        query={query}
        setQuery={setQuery}
        placeholder="車両名を入力"
        extra={
          <>
            <label>
              種別{" "}
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
        <button className="primary">新規作成</button>
        <p>ECODUMP労務安全で使用届の作成に利用できます。</p>
      </div>
      <GridTable
        headers={[
          "",
          "支店名",
          "種別",
          "車両名（ECODUMP表示名）",
          "車両番号",
          "利用状況",
          "",
        ]}
        rows={[]}
        empty
      />
      <Pager />
    </>
  );
}
function CompanyPage() {
  const [tab, setTab] = useState("本社情報");
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
      <div className="company-actions">
        <button className="primary">編集</button>
        <span>
          更新した情報を労務安全書類に反映するには書類の更新が必要です。
        </span>
      </div>
      <section className="company-card">
        <h2>{tab}</h2>
        <h3>基本情報</h3>
        {[
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
        ].map(([a, b]) => (
          <div className="info-row" key={a}>
            <b>{a}</b>
            <span>{b}</span>
          </div>
        ))}
      </section>
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
  let rows = isOrigin
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
    : [];
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

export function App() {
  const [page, setPage] = useState("現場一覧"),
    [collapsed, setCollapsed] = useState(false),
    [query, setQuery] = useState(""),
    [detailOpen, setDetailOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [confirm, setConfirm] = useState(null),
    [selected, setSelected] = useState(null),
    [copied, setCopied] = useState(null);
  const navigate = (p) => {
    setPage(p);
    setQuery("");
    setDetailOpen(false);
  };
  const copyId = async (id) => {
    await navigator.clipboard?.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 1200);
  };
  let body;
  if (page === "現場一覧")
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
        }}
      />
    );
  else if (page === "現場体制（施工体系図）") body = <OrganizationPage />;
  else if (page === "会社情報") body = <CompanyPage />;
  else if (page === "ユーザー一覧" || page === "作業員一覧")
    body = (
      <ListPage
        type={page}
        {...{ query, setQuery, setDetailOpen, setConfirm }}
      />
    );
  else if (page === "車両・機械情報一覧")
    body = <VehiclePage {...{ query, setQuery, setDetailOpen }} />;
  else
    body = (
      <AgencyPage
        type={page}
        {...{ query, setQuery, setDetailOpen, setConfirm }}
      />
    );
  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">ED</div>
          {!collapsed && <strong>ECODUMP NEW</strong>}
          <button
            className="collapse"
            onClick={() => setCollapsed((v) => !v)}
            aria-label="サイドバーを開閉"
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>
        {!collapsed && <div className="tenant">サンプルグループ</div>}
        <nav>
          {navGroups.map((g) => (
            <section className="nav-group" key={g.title}>
              {!collapsed && <h2>{g.title}</h2>}
              {g.items.map(([Icon, label]) => (
                <button
                  className={page === label ? "active" : ""}
                  onClick={() => navigate(label)}
                  key={label}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button>
            <Bell />
            <span>通知一覧</span>
          </button>
          <button onClick={() => setHelpOpen(true)}>
            <CircleHelp />
            <span>ヘルプセンター</span>
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
        <Header
          title={page === "現場一覧" ? "現場確認" : page}
          onHelp={() => setHelpOpen(true)}
        />
        {body}
      </main>
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
                ? "匿名サンプルデータの詳細画面です。情報を確認して操作できます。"
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
