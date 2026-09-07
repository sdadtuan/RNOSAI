'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  compareCpVideoVersions,
  createCpVideoComment,
  exportCpVideoVersion,
  formatCpApiError,
  getCpVideoVersion,
  listCpVideoComments,
  runCpVideoQc,
  submitCpVideoApproval,
  type CpQcReport,
  type CpScope,
  type CpVersionCompare,
  type CpVideoComment,
  type CpVideoVersion,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';
import {
  APPROVAL_LABELS,
  APPROVAL_STATES,
  QC_CHECK_KEYS,
  QC_CHECK_LABELS,
  isApprovalState,
  type CpApprovalState,
} from '@/lib/crm/cp-review.util';

function scopeFrom(value?: string): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function qcReport(value: unknown): CpQcReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as CpQcReport;
  if (!report.checks || typeof report.checks !== 'object') return null;
  return report;
}

function displayJson(value: unknown): string {
  if (value == null) return dash(null);
  if (typeof value === 'string') return value.trim() ? value : dash(null);
  try {
    return JSON.stringify(value);
  } catch {
    return dash(null);
  }
}

export function CpVideoReview({
  versionId,
  scope: scopeValue,
}: {
  versionId: string;
  scope?: string;
}) {
  const scope = scopeFrom(scopeValue);
  const [version, setVersion] = useState<CpVideoVersion | null>(null);
  const [comments, setComments] = useState<CpVideoComment[]>([]);
  const [compare, setCompare] = useState<CpVersionCompare | null>(null);
  const [otherId, setOtherId] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<CpApprovalState>('internal_review');
  const [approvalReason, setApprovalReason] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [commentTimecode, setCommentTimecode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [nextVersion, commentResult] = await Promise.all([
        getCpVideoVersion(token, versionId, scope),
        listCpVideoComments(token, versionId, scope),
      ]);
      setVersion(nextVersion);
      setComments(commentResult.items);
      if (isApprovalState(nextVersion.approval_status)) {
        setApprovalStatus(nextVersion.approval_status);
      }
    } catch (caught) {
      setVersion(null);
      setComments([]);
      setError(formatCpApiError(caught, 'Không tải được review'));
    } finally {
      setLoading(false);
    }
  }, [scope, versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function withBusy(label: string, work: (token: string) => Promise<void>) {
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    setBusy(label);
    setError('');
    setNotice('');
    try {
      await work(token);
    } catch (caught) {
      setError(formatCpApiError(caught, 'Thao tác review thất bại'));
    } finally {
      setBusy('');
    }
  }

  async function runQc() {
    await withBusy('qc', async (token) => {
      const next = await runCpVideoQc(token, versionId, {}, scope);
      setVersion(next);
      setNotice('Đã chạy QC');
    });
  }

  async function exportFinal() {
    await withBusy('export', async (token) => {
      const exported = await exportCpVideoVersion(token, versionId, scope);
      setNotice(exported.output_uri ? `Export: ${exported.output_uri}` : 'Export sẵn sàng');
    });
  }

  async function submitApproval(event: FormEvent) {
    event.preventDefault();
    await withBusy('approval', async (token) => {
      const next = await submitCpVideoApproval(token, versionId, {
        status: approvalStatus,
        reason: approvalReason.trim() || null,
      }, scope);
      setVersion(next);
      setNotice(`Approval: ${dash(next.approval_status)}`);
    });
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    await withBusy('comment', async (token) => {
      const created = await createCpVideoComment(token, versionId, {
        body: commentBody.trim(),
        timecode_ms: commentTimecode.trim() === '' ? null : Number(commentTimecode),
      }, scope);
      setComments((current) => [...current, created]);
      setCommentBody('');
      setCommentTimecode('');
    });
  }

  async function runCompare(event: FormEvent) {
    event.preventDefault();
    await withBusy('compare', async (token) => {
      setCompare(await compareCpVideoVersions(token, versionId, otherId.trim(), scope));
    });
  }

  const report = qcReport(version?.qc_json);
  const overall = version?.qc_status ?? report?.overall ?? null;

  return (
    <div className="cp-overview" aria-busy={loading || Boolean(busy)}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Video Review</p>
          <h2>QC · Comments · Approval</h2>
          <p className="cp-muted">Overall QC: {dash(overall)} · Approval: {dash(version?.approval_status)}</p>
        </div>
        <div className="cp-filters">
          <button className="cp-btn" type="button" disabled={loading || Boolean(busy)} onClick={() => void runQc()}>
            {busy === 'qc' ? 'Đang QC…' : 'Chạy QC'}
          </button>
          <button className="cp-btn cp-btn--primary" type="button" disabled={loading || Boolean(busy)} onClick={() => void exportFinal()}>
            {busy === 'export' ? 'Đang export…' : 'Export final'}
          </button>
        </div>
      </header>

      {error ? <section className="cp-card cp-card--error"><p>{error}</p></section> : null}
      {notice ? <section className="cp-alert">{notice}</section> : null}

      <div className="cp-overview-grid">
        <section className="cp-card">
          <div className="cp-card__head"><h2>QC checklist</h2></div>
          <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr><th>Check</th><th>Result</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {QC_CHECK_KEYS.map((key) => {
                const item = report?.checks?.[key];
                return (
                  <tr key={key}>
                    <td>{QC_CHECK_LABELS[key]}</td>
                    <td>{dash(item?.result)}</td>
                    <td>{dash(item?.reason)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </section>

        <section className="cp-card">
          <div className="cp-card__head"><h2>Approval</h2></div>
          <form className="cp-filters" style={{ display: 'grid' }} onSubmit={(event) => void submitApproval(event)}>
            <label>
              <span>State</span>
              <select value={approvalStatus} onChange={(event) => setApprovalStatus(event.target.value as CpApprovalState)}>
                {APPROVAL_STATES.map((state) => (
                  <option key={state} value={state}>{APPROVAL_LABELS[state]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Reason</span>
              <textarea rows={3} value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} />
            </label>
            <button className="cp-btn cp-btn--primary" type="submit" disabled={loading || Boolean(busy)}>
              {busy === 'approval' ? 'Đang lưu…' : 'Gửi approval'}
            </button>
          </form>
        </section>
      </div>

      <section className="cp-card">
        <div className="cp-card__head"><h2>Comments</h2></div>
        {comments.length === 0 ? <p className="cp-empty">{dash(null)}</p> : (
          <ul>
            {comments.map((comment) => (
              <li key={comment.id}>
                <strong>{dash(comment.created_by)}</strong>
                {' · '}
                {comment.timecode_ms == null ? dash(null) : `${comment.timecode_ms}ms`}
                {' · '}
                {dash(comment.status)}
                <p>{dash(comment.body)}</p>
              </li>
            ))}
          </ul>
        )}
        <form className="cp-filters" style={{ display: 'grid' }} onSubmit={(event) => void submitComment(event)}>
          <label>
            <span>Timecode (ms)</span>
            <input inputMode="numeric" value={commentTimecode} onChange={(event) => setCommentTimecode(event.target.value)} placeholder="—" />
          </label>
          <label>
            <span>Comment</span>
            <textarea rows={3} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} required />
          </label>
          <button className="cp-btn" type="submit" disabled={loading || Boolean(busy) || !commentBody.trim()}>
            {busy === 'comment' ? 'Đang gửi…' : 'Thêm comment'}
          </button>
        </form>
      </section>

      <section className="cp-card">
        <div className="cp-card__head"><h2>Compare versions</h2></div>
        <form className="cp-filters" onSubmit={(event) => void runCompare(event)}>
          <label>
            <span>Other version id</span>
            <input value={otherId} onChange={(event) => setOtherId(event.target.value)} placeholder="—" />
          </label>
          <button className="cp-btn" type="submit" disabled={loading || Boolean(busy) || !otherId.trim()}>
            {busy === 'compare' ? 'Đang so…' : 'Compare'}
          </button>
        </form>
        {compare ? (
          <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr><th>Field</th><th>A</th><th>B</th><th>Changed</th></tr>
            </thead>
            <tbody>
              {(['metadata', 'script', 'kit_id', 'asset_ids', 'cost'] as const).map((field) => (
                <tr key={field}>
                  <td>{field}</td>
                  <td>{displayJson(compare[field].a)}</td>
                  <td>{displayJson(compare[field].b)}</td>
                  <td>{compare[field].changed ? 'changed' : 'same'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : <p className="cp-empty">{dash(null)}</p>}
      </section>
    </div>
  );
}
