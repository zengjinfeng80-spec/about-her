import { useEffect, useMemo, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { Heart, LoaderCircle, Mail } from 'lucide-react';
import { App } from '../app/App';
import { EMPTY_SNAPSHOT } from '../data/demo';
import type { MemorySnapshot } from '../domain/types';
import type { CloudConfig } from './config';
import { SupabaseMemoryService } from './service';

export function CloudApp({ config }: { config: CloudConfig }) {
  const client = useMemo(() => createClient(config.url, config.anonKey, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
  }), [config]);
  const service = useMemo(() => new SupabaseMemoryService(client), [client]);
  const [session, setSession] = useState<Session | null>(null);
  const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session); setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setSnapshot(null);
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!session) return;
    setLoading(true); setError('');
    void service.loadSnapshot()
      .then(setSnapshot)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '读取云端档案失败'))
      .finally(() => setLoading(false));
  }, [service, session]);

  if (loading) return <StatusScreen label="正在打开私人档案…" />;
  if (!session) return <LoginPage onSend={async (email) => {
    const { error: signInError } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (signInError) throw signInError;
  }} onVerify={async (email, token) => {
    const { error: verifyError } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (verifyError) throw verifyError;
  }} />;
  if (error) return <StatusScreen label={error} action={<button className="primary-button" onClick={() => window.location.reload()}>重新加载</button>} />;
  return <App initialSnapshot={snapshot ?? EMPTY_SNAPSHOT} persist={false} service={service} accountEmail={session.user.email} onSignOut={async () => { await client.auth.signOut(); }} />;
}

function LoginPage({ onSend, onVerify }: { onSend: (email: string) => Promise<void>; onVerify: (email: string, token: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true); setMessage('');
    try {
      await onSend(email.trim());
      setCodeSent(true); setMessage('验证码已发送，请查看邮箱。');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '发送失败，请稍后重试');
    } finally { setSending(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setSending(true); setMessage('');
    try { await onVerify(email.trim(), token.trim()); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : '验证码无效或已过期'); }
    finally { setSending(false); }
  };
  return <main className="login-page">
    <div className="login-mark"><Heart size={25} /></div>
    <p className="login-eyebrow">只属于你的一份记忆</p>
    <h1>关于她</h1>
    <p className="login-copy">用邮箱验证码进入。你的记录和媒体只对当前账号可见。</p>
    {!codeSent ? <form onSubmit={(event) => void submit(event)}>
      <label><span>邮箱</span><div><Mail size={18} /><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></div></label>
      <button className="primary-button" type="submit" disabled={sending}>{sending ? <><LoaderCircle className="spin" size={17} />正在发送</> : '发送验证码'}</button>
    </form> : <form onSubmit={(event) => void verify(event)}>
      <label><span>邮箱验证码</span><div><input required inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, ''))} placeholder="输入邮件中的验证码" /></div></label>
      <button className="primary-button" type="submit" disabled={sending || token.length < 6}>{sending ? <><LoaderCircle className="spin" size={17} />正在验证</> : '进入档案'}</button>
      <button className="text-button" type="button" onClick={() => { setCodeSent(false); setToken(''); setMessage(''); }}>更换邮箱</button>
    </form>}
    {message && <p className="login-message" role="status">{message}</p>}
  </main>;
}

function StatusScreen({ label, action }: { label: string; action?: React.ReactNode }) {
  return <main className="status-screen"><LoaderCircle className="spin" size={24} /><p>{label}</p>{action}</main>;
}
