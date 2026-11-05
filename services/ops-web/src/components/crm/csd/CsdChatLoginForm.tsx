'use client';

import { FormEvent, useState } from 'react';

type CsdChatLoginFormProps = {
  defaultUsername?: string;
  busy?: boolean;
  error?: string;
  compact?: boolean;
  onSubmit: (input: { username: string; password: string }) => Promise<void> | void;
};

export function CsdChatLoginForm({
  defaultUsername = '',
  busy = false,
  error = '',
  compact = false,
  onSubmit,
}: CsdChatLoginFormProps) {
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ username: username.trim(), password });
  }

  return (
    <form
      className={compact ? 'csd-chat-login csd-chat-login--dock' : 'csd-chat-login page-card stack-gap'}
      onSubmit={(e) => void handleSubmit(e)}
      data-testid="csd-chat-login"
    >
      <h3 className="kpi-section-title">Đăng nhập Chat</h3>
      <p className="muted">Tên và mật khẩu do Admin cấp tại Tài khoản Chat — chỉ mở hộp thoại, không phải /login hệ thống.</p>
      {error ? <p className="error">{error}</p> : null}
      <input
        className="kpi-input"
        placeholder="Tên đăng nhập chat"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        data-testid="csd-chat-login-username"
        required
      />
      <input
        className="kpi-input"
        type="password"
        placeholder="Mật khẩu chat"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        data-testid="csd-chat-login-password"
        required
      />
      <button type="submit" className="btn btn-sm" disabled={busy || !username.trim() || !password} data-testid="csd-chat-login-submit">
        Vào Chat
      </button>
    </form>
  );
}
