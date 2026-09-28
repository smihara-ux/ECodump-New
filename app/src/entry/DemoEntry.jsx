import { useState } from 'react';
import './entry.css';

const roles = [
  { id: 'construction', name: '施工側', title: '現場・搬出を管理', icon: '01', detail: '搬出予定、配車、運行状況、伝票・実績を確認します。', company: 'サンプル建設会社', person: 'サンプル施工担当' },
  { id: 'receiving', name: '受入側', title: '受入場所・搬入を管理', icon: '02', detail: '搬入予約、受付、受入条件、数量・実績を確認します。', company: 'サンプル受入会社', person: 'サンプル受入担当' },
  { id: 'driver', name: 'ドライバー', title: '移動・運搬を担当', icon: '03', detail: '自分の便、行先、運行報告、伝票をスマートフォンで確認します。', company: 'サンプル運送会社', person: 'サンプル運転者' },
];
export function demoDestination(role) {
  return role === 'driver' ? './?app=driver&demo=1&review=20260928c' : `./?preview=app&role=${role}&page=transport&demo=1&review=20260928c`;
}
export default function DemoEntry() {
  const [mode, setMode] = useState('login');
  const [registered, setRegistered] = useState(false);
  const [theme, setTheme] = useState('light');
  const [selected, setSelected] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const role = roles.find(item => item.id === selected);
  function changeMode(next) { setMode(next); setRegistered(false); setNotice(''); setEmail(''); setPassword(''); setSelected(''); }
  function demoLogin(id) { window.location.assign(demoDestination(id)); }
  function submit(event) {
    event.preventDefault(); setNotice('');
    if (mode === 'register') { setRegistered(true); setPassword(''); return; }
    const account = roles.find(item => email === `${item.id}@sample.invalid`);
    if (account && password === 'demo-only') demoLogin(account.id);
    else setNotice('この公開画面はデモです。本番アカウントではログインできません。下の「デモで試す」からサンプルアカウントを選んでください。');
  }
  return <main className="demo-entry entry-auth" data-theme={theme}>
    <div className="entry-wrap">
      <header className="entry-header"><a href="./?entry=1"><img src={`${import.meta.env.BASE_URL}ecodump-logo.png`} alt="ECO DUMP" /><span>ECO DUMP<small>建設循環物流プラットフォーム</small></span></a><button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? 'ダーク' : 'ライト'}表示に切り替え</button></header>
      <div className="entry-auth-layout">
        <section className="entry-intro"><span className="entry-tag">ECO DUMP</span><h1>現場と受入先をつなぎ、<br />運搬をもっとスムーズに。</h1><p>搬出予定から受入・運行・伝票管理まで。<br />ひとつの入口から、あなたの業務へ。</p><div className="entry-service-note"><strong>はじめてご利用の方</strong><p>「新規会員登録」で利用区分と必要情報を入力してください。</p><strong>すでにご登録の方</strong><p>メールアドレスとパスワードでログインすると、ご利用の画面に進みます。</p></div></section>
        <section className="entry-account" aria-labelledby="account-title">
          <div className="entry-tabs" aria-label="手続きの選択">{[['login','ログイン'],['register','新規会員登録']].map(([id,label]) => <button key={id} aria-pressed={mode === id} onClick={() => changeMode(id)}>{label}</button>)}</div>
          <h2 id="account-title">{mode === 'login' ? 'ログイン' : '新規会員登録'}</h2>
          <p className="entry-preview-note">操作確認用の公開デモです。実際の個人情報・パスワードは入力しないでください。</p>
          {registered ? <div role="status" className="entry-complete"><h3>登録内容の入力確認ができました</h3><p>利用区分：{role?.name}</p><p>デモのため、アカウント作成・確認メール送信は行っていません。</p><button className="entry-primary" onClick={() => demoLogin(selected)}>{role?.name}の画面を試す</button><button onClick={() => changeMode('login')}>ログイン画面に戻る</button></div> : <form onSubmit={submit} key={mode}>
            <div className="entry-fields">
              {mode === 'register' && <><label>利用区分<select required value={selected} onChange={event => setSelected(event.target.value)}><option value="">選択してください</option>{roles.map(item => <option key={item.id} value={item.id}>{item.name}（{item.title}）</option>)}</select></label><label>会社名<input name="company" required maxLength={100} placeholder="例：サンプル建設会社" autoComplete="off" /></label><label>お名前<input name="displayName" required maxLength={80} placeholder="例：サンプル 太郎" autoComplete="off" /></label></>}
              <label>メールアドレス<input name="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="sample@example.com" autoComplete="off" /></label>
              <label>パスワード<input name="password" type="password" required minLength={mode === 'register' ? 8 : undefined} value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === 'register' ? 'デモ用の8文字以上' : 'パスワードを入力'} autoComplete="off" /></label>
            </div>
            {notice && <p role="alert" className="entry-notice">{notice}</p>}
            <button className="entry-primary" type="submit">{mode === 'register' ? '登録内容を確認する' : 'ログイン'}</button>
            <p className="entry-muted">入力内容は送信・保存されません。本番認証は未接続です。</p>
          </form>}
          <details className="entry-demo-options"><summary>デモで試す</summary><p>入力不要で、役割別のサンプルアカウントを体験できます。</p><div>{roles.map(item => <button key={item.id} onClick={() => demoLogin(item.id)}>{item.name}としてデモログイン →</button>)}</div><small>手入力で試す場合：利用区分のID（construction / receiving / driver）に @sample.invalid を付けたメールアドレス、パスワードは demo-only。</small></details>
        </section>
      </div>
      <footer className="entry-footer"><p>公開デモの操作は実際の予約・配車・請求には反映されません。各画面上部からログイン画面に戻れます。</p><a href="./review.html?v=20260928">操作項目・レビューの確認ガイド</a></footer>
    </div>
  </main>;
}
