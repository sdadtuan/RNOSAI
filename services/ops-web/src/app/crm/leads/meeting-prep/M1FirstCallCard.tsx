'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchLeadMeetingPrep,
  runLeadMeetingPrep,
  type LeadMeetingPrepResponse,
} from '@/lib/lead-meeting-prep-api';
import { trackLeadCallScriptCopy } from '@/lib/api';
import { canRunLmp, canViewLmp, type StoredStaffUser } from '@/lib/auth';
import { leadMeetingPrepEnabled } from '@/lib/crm/lmp-flags';
import { CopyScriptButton } from './CopyScriptButton';

type Props = {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  /** B2 chưa xong — đúng khoảnh khắc M1 */
  show: boolean;
  onOpenTalkTrack?: () => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
};

function buildM1Script(prep: LeadMeetingPrepResponse): {
  opening: string;
  questions: string[];
  fullTalkTrack: string;
} {
  const sci = prep.result?.close_intelligence;
  const legacy = prep.result?.consulting_script;
  const phases = sci?.talk_track?.phases ?? [];
  const opening =
    phases[0]?.script_vi?.trim() ||
    legacy?.opening?.trim() ||
    prep.result?.company_profile?.summary?.slice(0, 280) ||
    '';
  const questions =
    legacy?.key_questions?.slice(0, 3) ??
    phases.slice(1, 4).map((p) => p.phase_vi).filter(Boolean);
  const fullTalkTrack =
    phases.length > 0
      ? phases.map((p) => `${p.phase_vi}\n${p.script_vi}`).join('\n\n')
      : [opening, ...(legacy?.key_questions ?? []).map((q, i) => `${i + 1}. ${q}`)]
          .filter(Boolean)
          .join('\n\n');
  return { opening, questions, fullTalkTrack };
}

export function M1FirstCallCard({
  token,
  leadId,
  user,
  show,
  onOpenTalkTrack,
  onMessage,
  onError,
}: Props) {
  const [prep, setPrep] = useState<LeadMeetingPrepResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!leadMeetingPrepEnabled() || !canViewLmp(user)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const row = await fetchLeadMeetingPrep(token, leadId);
      setPrep(row);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tải prep M1 thất bại');
      setPrep(null);
    } finally {
      setLoading(false);
    }
  }, [token, leadId, user, onError]);

  useEffect(() => {
    if (!show) {
      setLoading(false);
      return;
    }
    void load();
    const t = setInterval(() => {
      if (prep?.status === 'running' || prep?.status === 'pending') void load();
    }, 8000);
    return () => clearInterval(t);
  }, [show, load, prep?.status]);

  if (!show || !leadMeetingPrepEnabled() || !canViewLmp(user)) return null;

  async function onCopyTracked(text: string) {
    try {
      await trackLeadCallScriptCopy(token, leadId);
      await navigator.clipboard.writeText(text);
      onMessage?.('Đã copy script SCI — sẵn sàng gọi');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Copy script thất bại');
    }
  }

  async function onRunPrep() {
    if (!canRunLmp(user)) return;
    setBusy(true);
    try {
      await runLeadMeetingPrep(token, leadId, { prep_stage: 'm1_first_strike', force: true });
      await load();
      onMessage?.('Đã xếp hàng prep M1');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Chạy prep thất bại');
    } finally {
      setBusy(false);
    }
  }

  const status = prep?.status ?? 'none';
  const script = prep ? buildM1Script(prep) : null;

  return (
    <section className="lmp-m1-card" aria-labelledby="lmp-m1-title">
      <header className="lmp-m1-card__head">
        <div>
          <h3 id="lmp-m1-title" className="lmp-m1-card__title">
            M1 · Cuộc gọi đầu (15 phút)
          </h3>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Đọc script SCI trước khi bấm gọi — SLA 15 phút
          </p>
        </div>
        {onOpenTalkTrack ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={onOpenTalkTrack}>
            Mở Talk Track
          </button>
        ) : null}
      </header>

      {loading && !prep ? (
        <p className="muted">Đang tải prep…</p>
      ) : null}

      {status === 'running' || status === 'pending' ? (
        <p className="muted">AI đang research — thường 1–4 phút. Trang tự cập nhật.</p>
      ) : null}

      {status === 'awaiting_entity_choice' ? (
        <div className="banner banner-warn">
          <p>Cần chọn doanh nghiệp trước khi gọi.</p>
          {onOpenTalkTrack ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onOpenTalkTrack}>
              Chọn entity →
            </button>
          ) : null}
        </div>
      ) : null}

      {status === 'skipped' || status === 'failed' ? (
        <div className="banner banner-info">
          <p>{prep?.error || 'Prep chưa sẵn sàng — bổ sung tên công ty rồi chạy lại.'}</p>
          {canRunLmp(user) ? (
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void onRunPrep()}>
              Chạy prep M1
            </button>
          ) : null}
        </div>
      ) : null}

      {status === 'ready' && script?.opening ? (
        <div className="lmp-m1-card__body">
          <p className="lmp-m1-card__opening">{script.opening}</p>
          {script.questions.length > 0 ? (
            <>
              <h4 className="lmp-m1-card__sub">Câu hỏi gợi ý</h4>
              <ol className="lmp-m1-card__questions">
                {script.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </>
          ) : null}
          <div className="lmp-m1-card__actions">
            <CopyScriptButton
              text={script.fullTalkTrack || script.opening}
              label="Copy script gọi đầu"
              onCopied={() => void onCopyTracked(script.fullTalkTrack || script.opening)}
            />
            {onOpenTalkTrack ? (
              <button type="button" className="btn btn-sm btn-secondary" onClick={onOpenTalkTrack}>
                Xem objection playbook
              </button>
            ) : null}
          </div>
          <ul className="lmp-m1-checklist muted">
            <li>Đọc chân dung DN (tab Intel)</li>
            <li>Copy script → gọi trong SLA 15p</li>
            <li>Sau liên hệ OK → hoàn thành B2</li>
          </ul>
        </div>
      ) : null}

      {status === 'ready' && !script?.opening ? (
        <p className="muted">Prep ready — mở Talk Track để xem script đầy đủ.</p>
      ) : null}
    </section>
  );
}
