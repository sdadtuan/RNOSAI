'use client';

import { useEffect, useState } from 'react';
import { PublicProposalView } from '@/components/PublicProposalView';
import {
  PublicProposalApiError,
  acceptPublicProposal,
  fetchPublicProposal,
  isGonePublicProposal,
  requestPublicProposalOtp,
  type PublicAcceptInput,
  type PublicProposal,
} from '@/lib/public-proposal';

export default function PublicProposalPage({ params }: { params: { token: string } }) {
  const token = params.token ?? '';
  const [data, setData] = useState<PublicProposal | null>(null);
  const [error, setError] = useState('');
  const [gone, setGone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [optionKey, setOptionKey] = useState('A');
  const [otp, setOtp] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [acting, setActing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Link không hợp lệ.');
      setLoading(false);
      return;
    }
    void fetchPublicProposal(token)
      .then((next) => {
        setData(next);
        const first = (next.options ?? []).find((row) => row.client_visible !== false);
        if (first?.option_key) setOptionKey(first.option_key);
      })
      .catch((err) => {
        if (isGonePublicProposal(err instanceof PublicProposalApiError ? err : {})) {
          setGone(true);
          setError(err instanceof Error ? err.message : 'Liên kết không còn hiệu lực.');
        } else {
          setError(err instanceof Error ? err.message : 'Không tải được đề xuất');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function submit(body: PublicAcceptInput) {
    setActing(true);
    setMessage('');
    try {
      const out = await acceptPublicProposal(token, body);
      setData((prev) => (prev ? { ...prev, status: out.status, option_key: out.option_key } : prev));
      setMessage('Đã xác nhận đề xuất. Cảm ơn bạn.');
    } catch (err) {
      if (isGonePublicProposal(err instanceof PublicProposalApiError ? err : {})) {
        setGone(true);
        setData(null);
        setError(err instanceof Error ? err.message : 'Liên kết không còn hiệu lực.');
      } else {
        setMessage(err instanceof Error ? err.message : 'Xác nhận thất bại');
      }
    } finally {
      setActing(false);
    }
  }

  async function sendOtp() {
    setActing(true);
    setMessage('');
    try {
      await requestPublicProposalOtp(token, { email });
      setMessage('Đã gửi mã OTP tới email.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không gửi được OTP');
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <main className="deal-teaser-page">
        <p className="muted">Đang tải đề xuất…</p>
      </main>
    );
  }

  if (gone || !data) {
    return (
      <main className="deal-teaser-page">
        <div className="deal-teaser-card deal-teaser-card--error">
          <h1>Liên kết không còn hiệu lực</h1>
          <p>
            {gone
              ? 'Đề xuất đã hết hạn hoặc được thu hồi. Liên hệ AM để nhận phiên bản mới.'
              : error || 'Link không hợp lệ.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="deal-teaser-page">
      <PublicProposalView
        data={data}
        name={name}
        email={email}
        title={title}
        optionKey={optionKey}
        otp={otp}
        accepted={accepted}
        acting={acting}
        message={message}
        onName={setName}
        onEmail={setEmail}
        onTitle={setTitle}
        onOptionKey={setOptionKey}
        onOtp={setOtp}
        onAccepted={setAccepted}
        onRequestOtp={() => void sendOtp()}
        onSubmit={(body) => void submit(body)}
      />
    </main>
  );
}
