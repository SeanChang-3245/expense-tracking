import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, supabase } from './supabase';
import { listCategories, loadSharing, type Sharing } from './api';
import { Ctx } from './context';
import type { Category } from './types';
import { Login } from './pages/Login';
import { AddPage } from './pages/Add';
import { ListPage } from './pages/List';
import { StatsPage } from './pages/Stats';
import { SettingsPage } from './pages/Settings';

const TABS = [
  { id: 'add', label: '記帳', icon: 'M12 5v14M5 12h14' },
  { id: 'list', label: '明細', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'stats', label: '分析', icon: 'M5 20V12M12 20V5M19 20v-9' },
  { id: 'settings', label: '設定', icon: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function useHashTab(): [Tab, (t: Tab) => void] {
  const read = () => {
    const h = location.hash.replace('#/', '') as Tab;
    return TABS.some((t) => t.id === h) ? h : 'add';
  };
  const [tab, setTab] = useState<Tab>(read);
  useEffect(() => {
    const on = () => setTab(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return [tab, (t) => { location.hash = `#/${t}`; }];
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) {
    return (
      <div class="center-screen">
        <div class="card narrow">
          <h1>尚未設定 Supabase</h1>
          <p class="muted">請設定環境變數 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY，詳見 README。</p>
        </div>
      </div>
    );
  }
  if (session === undefined) return <div class="center-screen muted">載入中…</div>;
  if (!session) return <Login />;
  return <Main me={session.user.id} email={session.user.email ?? ''} />;
}

function Main({ me, email }: { me: string; email: string }) {
  const [tab, setTab] = useHashTab();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [sharing, setSharing] = useState<Sharing>({ canView: [], viewers: [], myName: null });
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const reloadCategories = useCallback(async () => {
    try {
      setCategories(await listCategories(me, true));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [me]);

  // Sharing is optional: without it (or before the schema update) the app works solo.
  const reloadSharing = useCallback(async () => {
    try { setSharing(await loadSharing(me)); } catch { /* keep solo */ }
  }, [me]);

  useEffect(() => { reloadCategories(); reloadSharing(); }, [reloadCategories, reloadSharing]);

  const ctx = useMemo(
    () => ({
      me,
      email,
      categories: categories ?? [],
      byId: new Map((categories ?? []).map((c) => [c.id, c])),
      reloadCategories,
      sharing,
      reloadSharing,
      toast,
    }),
    [me, email, categories, reloadCategories, sharing, reloadSharing, toast],
  );

  return (
    <Ctx.Provider value={ctx}>
      <main class="page">
        {error ? (
          <div class="card">
            <p>無法載入資料：{error}</p>
            <button class="btn" onClick={reloadCategories}>重試</button>
          </div>
        ) : categories === null ? (
          <p class="muted center-pad">載入中…</p>
        ) : tab === 'add' ? (
          <AddPage />
        ) : tab === 'list' ? (
          <ListPage />
        ) : tab === 'stats' ? (
          <StatsPage />
        ) : (
          <SettingsPage />
        )}
      </main>
      <nav class="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            class={'tab' + (tab === t.id ? ' active' : '')}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d={t.icon} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      {toastMsg && <div class="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}
