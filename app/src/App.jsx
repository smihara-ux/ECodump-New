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
  Menu,
  Network,
  Search,
  Settings,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

const rows = Array.from({ length: 12 }, (_, i) => ({
  id: `D-${String(i + 1).padStart(4, "0")}`,
  company: `会社名 ${String.fromCharCode(65 + (i % 5))}`,
  branch: `支店 ${(i % 3) + 1}`,
  field: `サンプル現場 ${String.fromCharCode(65 + i)}`,
  address: `サンプル住所 ${i + 1}`,
  start: `2026/${String((i % 9) + 1).padStart(2, "0")}/01`,
  end: `2027/${String((i % 9) + 1).padStart(2, "0")}/28`,
}));
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

export function App() {
  const [collapsed, setCollapsed] = useState(false),
    [query, setQuery] = useState(""),
    [detailOpen, setDetailOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [selected, setSelected] = useState(null),
    [copied, setCopied] = useState(null);
  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        `${r.company} ${r.branch} ${r.field} ${r.id}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );
  const clear = () => {
    setQuery("");
    setSelected(null);
  };
  const copyId = async (id) => {
    await navigator.clipboard?.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 1300);
  };
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
              {g.items.map(([Icon, label], i) => (
                <button
                  className={g.title === "現場情報" && i === 0 ? "active" : ""}
                  key={label}
                  title={label}
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
        <header className="page-header">
          <button
            className="mobile-menu"
            onClick={() => setCollapsed((v) => !v)}
          >
            <Menu />
          </button>
          <h1>現場確認</h1>
          <div className="header-actions">
            <button className="guide">
              <CircleHelp />
              はじめてガイド
            </button>
            <button className="help" onClick={() => setHelpOpen(true)}>
              <CircleHelp />
              ヘルプ
            </button>
            <button className="close">
              閉じる <X />
            </button>
          </div>
        </header>
        <section className="search-panel">
          <div className="search-line">
            <b>検索結果：{filtered.length}件</b>
            <label>
              現場名/ID{" "}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="現場名/IDを入力"
              />
            </label>
            <label>
              利用サービス{" "}
              <select defaultValue="all">
                <option value="all">すべて</option>
                <option>サービスA</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" /> 利用終了を含める
            </label>
          </div>
          <div className="search-actions">
            <button className="primary">
              <Search />
              検索
            </button>
            <button className="text" onClick={() => setDetailOpen(true)}>
              詳細検索
            </button>
            <button className="text" onClick={clear}>
              クリア
            </button>
          </div>
        </section>
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
                          aria-label={`${r.id}をコピー`}
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
          <div className="pagination">
            <button disabled>
              <ChevronLeft />
            </button>
            <button className="current">1</button>
            <button disabled>
              <ChevronRight />
            </button>
          </div>
        </section>
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
                現場名/ID
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="現場名/IDを入力"
                />
              </label>
              <label>
                利用サービス
                <select>
                  <option>すべて</option>
                </select>
              </label>
              <label>
                利用終了を含める
                <input type="checkbox" />
              </label>
              <label>
                元請名
                <select>
                  <option>元請名を選択</option>
                </select>
              </label>
              <label>
                支店名
                <select>
                  <option>支店名を選択</option>
                </select>
              </label>
            </div>
            <button className="clear-detail" onClick={clear}>
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
      {helpOpen && (
        <div className="overlay" onMouseDown={() => setHelpOpen(false)}>
          <section
            className="modal help-modal"
            role="dialog"
            aria-label="ヘルプ"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal-x" onClick={() => setHelpOpen(false)}>
              <X />
            </button>
            <CircleHelp />
            <h2>ヘルプセンター</h2>
            <p>操作方法やよくある質問を確認できます。</p>
            <button className="primary" onClick={() => setHelpOpen(false)}>
              閉じる
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
