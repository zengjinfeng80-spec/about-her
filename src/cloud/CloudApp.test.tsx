import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudApp } from './CloudApp';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth }),
}));

describe('CloudApp 邮箱登录', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/about-her/');
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    auth.signInWithOtp.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValue({ error: null });
  });

  it('发送验证码后进入验证码步骤', async () => {
    const user = userEvent.setup();
    render(<CloudApp config={{ url: 'https://example.supabase.co', anonKey: 'anon-key' }} />);

    await user.type(await screen.findByLabelText('邮箱'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '发送验证码' }));

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: { shouldCreateUser: true },
    });
    expect(screen.getByLabelText('6 位验证码')).toBeInTheDocument();
    expect(screen.getByText('验证码已发送至 user@example.com')).toBeInTheDocument();
  });

  it('提交 6 位验证码进行登录', async () => {
    const user = userEvent.setup();
    render(<CloudApp config={{ url: 'https://example.supabase.co', anonKey: 'anon-key' }} />);

    await user.type(await screen.findByLabelText('邮箱'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '发送验证码' }));
    await user.type(screen.getByLabelText('6 位验证码'), '123456');
    await user.click(screen.getByRole('button', { name: '验证并登录' }));

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('可以重新发送验证码', async () => {
    const user = userEvent.setup();
    render(<CloudApp config={{ url: 'https://example.supabase.co', anonKey: 'anon-key' }} />);

    await user.type(await screen.findByLabelText('邮箱'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '发送验证码' }));
    await user.click(screen.getByRole('button', { name: '重新发送' }));

    expect(auth.signInWithOtp).toHaveBeenCalledTimes(2);
    expect(screen.getByText('新验证码已发送。')).toBeInTheDocument();
  });

  it('可以返回修改邮箱', async () => {
    const user = userEvent.setup();
    render(<CloudApp config={{ url: 'https://example.supabase.co', anonKey: 'anon-key' }} />);

    await user.type(await screen.findByLabelText('邮箱'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '发送验证码' }));
    await user.click(screen.getByRole('button', { name: '修改邮箱' }));

    expect(screen.getByLabelText('邮箱')).toHaveValue('user@example.com');
    expect(screen.queryByLabelText('6 位验证码')).not.toBeInTheDocument();
  });

  it('验证码无效时保留验证步骤并提示错误', async () => {
    auth.verifyOtp.mockResolvedValueOnce({ error: new Error('验证码无效或已过期') });
    const user = userEvent.setup();
    render(<CloudApp config={{ url: 'https://example.supabase.co', anonKey: 'anon-key' }} />);

    await user.type(await screen.findByLabelText('邮箱'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '发送验证码' }));
    await user.type(screen.getByLabelText('6 位验证码'), '654321');
    await user.click(screen.getByRole('button', { name: '验证并登录' }));

    expect(await screen.findByText('验证码无效或已过期')).toBeInTheDocument();
    expect(screen.getByLabelText('6 位验证码')).toBeInTheDocument();
  });

  it('邮件链接过期时提示重新发送', async () => {
    window.history.replaceState({}, '', '/about-her/?error=access_denied&error_code=otp_expired');

    render(<CloudApp config={{ url: 'https://example.supabase.co', anonKey: 'anon-key' }} />);

    expect(await screen.findByText('登录链接已失效，请重新发送一封新邮件。')).toBeInTheDocument();
  });
});
