import { useEffect, useRef, useState } from 'react';
import { createMutationJournal } from '../receiving/mutationJournal.mjs';
import { call } from '../integration/api';
import './business.css';

const keys = (role) => [`ecodump-admin-session:${role}`, `ecodump-direct-session:${role}`, `ecodump:match:session:${role}`];

function read(role) {
  try { return JSON.parse(sessionStorage.getItem(keys(role)[0]) || 'null'); } catch { return null; }
}

export function useBusinessSession(role) {
  const [session, setSession] = useState(() => read(role));
  useEffect(() => setSession(read(role)), [role]);
  const save = (value) => {
    keys(role).forEach((key) => value ? sessionStorage.setItem(key, JSON.stringify(value)) : sessionStorage.removeItem(key));
    setSession(value);
  };
  const logout = async () => {
    if (!session) return;
    const pending = createMutationJournal({ storage: localStorage, actorId: session.userId, scope: 'matching' }).read();
    if (sessionStorage.getItem(`ecodump-direct-operation:${session.userId}`) || ['pending', 'unknown'].includes(pending?.status)) throw new Error('保存結果を照会してからログアウトしてください。');
    try { await call(session.token, '/session', { method: 'DELETE' }); } catch (error) { if (error.status !== 401) throw error; }
    save(null);
  };
  return { session, save, logout };
}

export function BusinessSessionBar({ role, session, save, logout: signOut }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    dialog.current.showModal();
    return () => previousFocus?.focus();
  }, [open]);

  async function login(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const next = await call(null, '/session', { method: 'POST', body: { email: form.get('email'), password: form.get('password') } });
      const context = await call(next.token, '/context');
      if (!context.roles.includes(role)) {
        await call(next.token, '/session', { method: 'DELETE' });
        throw new Error('この管理画面の利用権限がありません。');
      }
      save({ ...next, displayName: context.profile.display_name }); setOpen(false);
    } catch (nextError) { setError(nextError.message); } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError('');
    try { await signOut(); } catch (nextError) { setError(nextError.message); } finally { setBusy(false); }
  }

  return <>
    <div className="business-session-bar">
      <span>{session ? `${session.displayName || 'ログイン中'} · 共通データを利用（検証環境）` : 'サンプル表示 · 保存する場合は検証環境へログインしてください'}</span>
      <button disabled={busy} onClick={() => session ? logout() : setOpen(true)}>{session ? 'ログアウト' : 'ログインして保存を利用'}</button>
    </div>
    {error && !open && <p role="alert">{error}</p>}
    {open && <dialog ref={dialog} className="business-login" onCancel={(event) => { if (busy) event.preventDefault(); else setOpen(false); }}>
      <form onSubmit={login}>
        <h2>{role === 'receiving' ? '受入側' : '施工側'}アカウントでログイン</h2>
        <p>DGXまたはローカルの隔離検証環境を使用します。本番アカウントは使用しません。</p>
        <label>メールアドレス<input name="email" type="email" required autoComplete="username" defaultValue={role === 'receiving' ? 'receiver@sample.invalid' : 'construction@sample.invalid'} /></label>
        <label>パスワード<input name="password" type="password" required autoComplete="current-password" /></label>
        {error && <p role="alert">{error}</p>}
        <div><button type="button" disabled={busy} onClick={() => setOpen(false)}>戻る</button><button className="primary" disabled={busy}>{busy ? 'ログイン中…' : 'ログイン'}</button></div>
      </form>
    </dialog>}
  </>;
}
