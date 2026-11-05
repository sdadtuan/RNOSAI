'use client';

import { FormEvent, useState } from 'react';

type CsdChatOnlyLoginFormProps = {
  busy?: boolean;
  error?: string;
  onSubmit: (input: { username: string; password: string }) => Promise<void> | void;
};

export function CsdChatOnlyLoginForm({ busy = false, error = '', onSubmit }: CsdChatOnlyLoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ username: username.trim(), password });
  }

  return (
    <form className="csd-chat-login page-card stack-gap" onSubmit={(e) => void handleSubmit(e)} data-testid="csd-chat-only-login">
      <h3 className="kpi-section-title">PTT</h3>
      <p className="muted">Đăng nhập bằng tài khoản chat.</p>
      {error ? <p className="error">{error}</p> : null}
      <label className="stack-gap">
        Tên đăng nhập chat
        <input
          className="kpi-input"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          data-testid="csd-chat-only-username"
          required
        />
      </label>
      <label className="stack-gap">
        Mật khẩu chat
        <input
          className="kpi-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="csd-chat-only-password"
          required
        />
      </label>
      <button type="submit" className="btn btn-sm" disabled={busy || !username.trim() || !password} data-testid="csd-chat-only-submit">
        Đăng nhập
      </button>
    </form>
  );
}
