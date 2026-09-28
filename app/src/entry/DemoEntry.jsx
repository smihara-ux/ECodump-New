import { useState } from 'react';
import './entry.css';

const roles = [
  { id: 'construction', name: '施工側', title: '現場・搬出を管理', icon: '01', detail: '搬出予定、配車、運行状況、伝票・実績を確認します。', company: 'サンプル建設会社', person: 'サンプル施工担当' },
  { id: 'receiving', name: '受入側', title: '受入場所・搬入を管理', icon: '02', detail: '搬入予約、受付、受入条件、数量・実績を確認します。', company: 'サンプル受入会社', person: 'サンプル受入担当' },
  { id: 'driver', name: 'ドライバー', title: '移動・運搬を担当', icon: '03', detail: '自分の便、行先、運行報告、伝票をスマートフォンで確認します。', company: 'サンプル運送会社', person: 'サンプル運転者' },
];
export function demoDestination(role) {
  return role === 'driver' ? './?app=driver&demo=1&review=20260928b' : `./?preview=app&role=${role}&page=transport&demo=1&review=20260928b`;
}
export default function DemoEntry() {
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('login');
  const [registered, setRegistered] = useState(false);
  const [theme, setTheme] = useState('light');
  const role = roles.find(item => item.id === selected);
  function choose(id) { setSelected(id); setRegistered(false); }
  function submit(event) {
    event.preventDefault();
    if (mode === 'register') setRegistered(true);
    else window.location.assign(demoDestination(selected));
  }
  return <main className="demo-entry" data-theme={theme}>
    <div className="entry-wrap">
      <header className="entry-header"><a href="./?entry=1"><img src={`${import.meta.env.BASE_URL}ecodump-logo.png`} alt="ECO DUMP" /><span>ECO DUMP<small>建設循環物流プラットフォーム</small></span></a><button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? 'ダーク' : 'ライト'}表示に切り替え</button></header>
      <div className="entry-intro"><span className="entry-tag">操作確認用デモ</span><h1>あなたの業務から、はじめる。</h1><p>利用する画面を選び、ログイン・会員登録からの流れをお試しください。</p></div>
      <section aria-labelledby="role-title"><h2 id="role-title">1. 利用区分を選択</h2><div className="entry-roles">{roles.map(item => <button key={item.id} className="entry-role" aria-pressed={selected === item.id} onClick={() => choose(item.id)}><span className="entry-number">{item.icon}</span><strong>{item.name}画面</strong><b>{item.title}</b><span>{item.detail}</span><span className="entry-choice">{selected === item.id ? '選択中 ✓' : 'この画面を選ぶ →'}</span></button>)}</div></section>
      {role ? <section className="entry-account" aria-labelledby="account-title"><h2 id="account-title">2. {role.name}のログイン・会員登録</h2><div className="entry-tabs" aria-label="手続きの選択">{[['login','ログイン'],['register','新規会員登録']].map(([id,label]) => <button key={id} aria-pressed={mode === id} onClick={() => {setMode(id);setRegistered(false);}}>{label}</button>)}</div>
        {registered ? <div role="status" className="entry-complete"><h3>会員登録の入力確認ができました</h3><p>選択した利用区分：{role.name}</p><p>これはデモです。アカウントは作成されず、確認メールも送信されません。</p><a className="entry-primary" href={demoDestination(selected)}>{role.name}へデモログイン</a><button onClick={() => setRegistered(false)}>入力画面に戻る</button></div> : <form key={`${selected}:${mode}`} onSubmit={submit}>
          <p className="entry-notice">サンプル情報が入力済みです。実際のID・パスワード・個人情報は入力しないでください。入力内容は送信・保存されません。</p>
          <div className="entry-fields">{mode === 'register' && <><label>会社名<input name="company" required maxLength={100} defaultValue={role.company} autoComplete="off" /></label><label>お名前<input name="displayName" required maxLength={80} defaultValue={role.person} autoComplete="off" /></label></>}
            <label>{mode === 'login' ? 'ログインID（メールアドレス）' : 'メールアドレス'}<input name="email" type="email" required defaultValue={`${role.id}@sample.invalid`} autoComplete="off" /></label>
            <label>デモ用パスワード<input type="password" value="demo-only" readOnly aria-describedby="demo-password-note" autoComplete="off" /></label>
          </div><p id="demo-password-note" className="entry-muted">パスワードは操作確認用の固定表示です。本認証は行いません。</p>
          <button className="entry-primary" type="submit">{mode === 'register' ? '会員登録の流れを確認する（デモ）' : `${role.name}へデモログイン`}</button>
        </form>}
      </section> : <p className="entry-start" role="status">上の3つのボタンから、確認したい画面を選択してください。</p>}
      <footer className="entry-footer"><p>デモ内の操作は、実際の予約・配車・請求には反映されません。役割間のデータ連動はありません。各画面上部からこの入口へ戻れます。</p><a href="./review.html?v=20260928">操作項目・レビューの確認ガイド</a></footer>
    </div>
  </main>;
}
