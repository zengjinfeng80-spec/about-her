import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudApp } from './CloudApp';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOtp: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth }),
}));

describe('CloudApp 邮箱登录', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/about-her/');
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    auth.signInWithOtp.mockResolvedValue({ error: null });
  });

  it('发送免密码登录链接并提示用户检查邮箱', async () => {
    const user = userEvent.setup();
    render(<CloudApp config={{ url: 'https://example.supabase.co', anonKey: 'anon-key' }} />);

    await user.type(await screen.findByLabelText('邮箱'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '发送登录链接' }));

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: new URL('/about-her/', window.location.origin).href,
      },
    });
    expect(screen.getByText('登录链接已发送，请在邮箱中点击进入。')).toBeInTheDocument();
  });

  it('邮件链接过期时提示重新发送', async () => {
    window.history.replaceState({}, '', '/about-her/?error=access_denied&error_code=otp_expired');

    render(<CloudApp config={{ url: 'https://example.supabase.co', anonKey: 'anon-key' }} />);

    expect(await screen.findByText('登录链接已失效，请重新发送一封新邮件。')).toBeInTheDocument();
  });
});
