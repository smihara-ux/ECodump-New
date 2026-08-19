import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  BusFront,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Copy,
  DoorOpen,
  FileText,
  HardHat,
  LayoutGrid,
  MapPinned,
  Network,
  Search,
  Settings,
  ShieldCheck,
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
                      <img src="/buildee-service-icons.png" alt="" />
                      <a href="?page=labor" aria-label="労務安全を開く" />
                      <a
                        href="?page=gatekeeper"
                        aria-label="入退場管理を開く"
                      />
                      <a href="?page=conference" aria-label="調整会議を開く" />
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
  const filtered = config.data.filter((r) => {
    const text = String(r.map((x) => (typeof x === "string" ? x : "")));
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
        count={filtered.length || config.data.length}
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
          {menus.slice(0, -1).map((m) => (
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

export function App() {
  const [page, setPage] = useState(() => {
      const target = new URLSearchParams(location.search).get("page");
      if (target === "labor") return "労務安全";
      if (target === "gatekeeper") return "入退場管理";
      if (target === "conference") return "調整会議";
      return "現場一覧";
    }),
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
          navigate,
        }}
      />
    );
  else if (page === "現場体制（施工体系図）") body = <OrganizationPage />;
  else if (page === "会社情報") body = <CompanyPage setConfirm={setConfirm} />;
  else if (page === "ユーザー一覧" || page === "作業員一覧")
    body = (
      <ListPage
        type={page}
        {...{ query, setQuery, setDetailOpen, setConfirm }}
      />
    );
  else if (page === "車両・機械情報一覧")
    body = <VehiclePage {...{ query, setQuery, setDetailOpen }} />;
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
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">ED</div>
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
        {!["労務安全", "入退場管理", "調整会議"].includes(page) && (
          <Header
            title={page === "現場一覧" ? "現場確認" : page}
            onHelp={() => setHelpOpen(true)}
          />
        )}
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
