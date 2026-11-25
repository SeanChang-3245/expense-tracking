import { useState } from 'preact/hooks';
import { supabase } from '../supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message === 'Invalid login credentials' ? '帳號或密碼錯誤' : error.message);
  };

  return (
    <div class="center-screen">
      <form class="card narrow stack" onSubmit={submit}>
        <h1>記帳</h1>
        <input class="input" type="email" placeholder="Email" autoComplete="username" required
          value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
        <input class="input" type="password" placeholder="密碼" autoComplete="current-password" required
          value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
        {error && <p class="error">{error}</p>}
        <button class="btn primary big" disabled={busy}>{busy ? '登入中…' : '登入'}</button>
      </form>
    </div>
  );
}
