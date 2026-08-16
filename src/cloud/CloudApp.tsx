import { useEffect, useMemo, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { KeyRound, LoaderCircle, Mail, Snowflake } from 'lucide-react';
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
    const { error: signInError } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (signInError) throw signInError;
  }} onVerify={async (email, token) => {
    const { error: verifyError } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (verifyError) throw verifyError;
  }} initialMessage={getAuthErrorMessage(window.location.href)} />;
  if (error) return <StatusScreen label={error} action={<button className="primary-button" onClick={() => window.location.reload()}>重新加载</button>} />;
  return <App initialSnapshot={snapshot ?? EMPTY_SNAPSHOT} persist={false} service={service} accountEmail={session.user.email} onSignOut={async () => { await client.auth.signOut(); }} />;
}

function LoginPage({ onSend, onVerify, initialMessage = '' }: {
  onSend: (email: string) => Promise<void>;
  onVerify: (email: string, token: string) => Promise<void>;
  initialMessage?: string;
}) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState(initialMessage);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sendCode = async (resent = false) => {
    setSending(true); setMessage('');
    try {
      const normalizedEmail = email.trim();
      await onSend(normalizedEmail);
      setEmail(normalizedEmail);
      setStep('code');
      if (resent) setMessage('新验证码已发送。');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '发送失败，请稍后重试');
    } finally { setSending(false); }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setVerifying(true); setMessage('');
    try {
      await onVerify(email, token);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '验证失败，请重新检查验证码');
    } finally { setVerifying(false); }
  };

  return <main className="login-page">
    <div className="login-mark"><Snowflake size={25} /></div>
    <p className="login-eyebrow">只属于你的一份记忆</p>
    <h1>雪梨</h1>
    <p className="login-copy">{step === 'email' ? '用邮箱验证码登录。你的记录和媒体只对当前账号可见。' : `验证码已发送至 ${email}`}</p>
    {step === 'email' ? <form onSubmit={(event) => { event.preventDefault(); void sendCode(); }}>
      <label><span>邮箱</span><div><Mail size={18} /><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></div></label>
      <button className="primary-button" type="submit" disabled={sending}>{sending ? <><LoaderCircle className="spin" size={17} />正在发送</> : '发送验证码'}</button>
    </form> : <form onSubmit={(event) => void verifyCode(event)}>
      <label><span>6 位验证码</span><div><KeyRound size={18} /><input required className="login-code-input" aria-label="6 位验证码" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div></label>
      <button className="primary-button" type="submit" disabled={verifying}>{verifying ? <><LoaderCircle className="spin" size={17} />正在验证</> : '验证并登录'}</button>
      <div className="login-secondary-actions">
        <button className="secondary-button" type="button" disabled={sending || verifying} onClick={() => void sendCode(true)}>{sending ? '正在发送' : '重新发送'}</button>
        <button className="secondary-button" type="button" disabled={sending || verifying} onClick={() => { setStep('email'); setToken(''); setMessage(''); }}>修改邮箱</button>
      </div>
    </form>}
    {message && <p className="login-message" role="status">{message}</p>}
  </main>;
}

function getAuthErrorMessage(currentUrl: string) {
  const url = new URL(currentUrl);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.get('error_code') === 'otp_expired' || hash.get('error_code') === 'otp_expired') {
    return '登录链接已失效，请重新发送一封新邮件。';
  }
  return '';
}

function StatusScreen({ label, action }: { label: string; action?: React.ReactNode }) {
  return <main className="status-screen"><LoaderCircle className="spin" size={24} /><p>{label}</p>{action}</main>;
}
