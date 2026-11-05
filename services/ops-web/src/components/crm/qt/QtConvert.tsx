'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  QtApiError,
  convertQtVersion,
  getQtProposal,
  getQtProposalLines,
  type QtBuilderLine,
  type QtBuilderProposal,
  type QtConvertResult,
} from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';

export type QtPlannedLifecycle = {
  line_id: number | null;
  lifecycle_id: number | null;
  dv_code: string;
};

export function isQtConvertible(status: string | null | undefined): boolean {
  return status === 'accepted';
}

export function plannedLifecyclesFrom(
  lines: Array<{ id?: number; dv_code: string }>,
  last?: QtConvertResult | null,
): QtPlannedLifecycle[] {
  if (last?.lifecycles?.length) {
    return last.lifecycles.map((row) => ({
      line_id: row.line_id,
      lifecycle_id: row.lifecycle_id,
      dv_code: row.dv_code,
    }));
  }
  return lines.map((line) => ({
    line_id: line.id ?? null,
    lifecycle_id: null,
    dv_code: line.dv_code,
  }));
}

export function qtConvertStatusLabel(status: string | null | undefined): string {
  if (status === 'accepted') return 'Đã xác nhận';
  return dash(status);
}

export function QtConvertPanel({
  quoteCode,
  versionId,
  status,
  planned = [],
  result = null,
  error = '',
  converting = false,
  onConvert,
}: {
  quoteCode?: string | null;
  versionId?: string | null;
  status?: string | null;
  planned?: QtPlannedLifecycle[];
  result?: QtConvertResult | null;
  error?: string;
  converting?: boolean;
  onConvert?: () => void;
}) {
  const accepted = isQtConvertible(status);
  const canConvert = accepted && Boolean(versionId) && !converting;

  return (
    <div className="qt-convert">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Convert</p>
          <h1>Convert sau xác nhận</h1>
          <p className="qt-muted">
            CVT-01 · AC-08 · idempotent (version_id, target_type) · N lifecycle + invoice
            draft
          </p>
        </div>
        <div className="qt-head__actions">
          <button
            type="button"
            className="qt-btn qt-btn--primary"
            disabled={!canConvert}
            onClick={onConvert}
          >
            Chạy convert
          </button>
        </div>
      </header>

      <div className="qt-alert">
        <span>
          {dash(quoteCode)} · {dash(versionId)} · {qtConvertStatusLabel(status)}. Convert
          lần 2 không nhân bản.
        </span>
      </div>

      {error ? (
        <section className="qt-card qt-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <div className="qt-grid2">
        <section className="qt-card">
          <header className="qt-card__head">
            <b>Lifecycle dự kiến</b>
            <span className="qt-muted">từ dòng / payload convert</span>
          </header>
          <div className="qt-table-wrap">
            <table className="qt-table">
              <thead>
                <tr>
                  <th>Dòng</th>
                  <th>dv_code</th>
                  <th>lifecycle_id</th>
                </tr>
              </thead>
              <tbody>
                {planned.length ? (
                  planned.map((row, index) => (
                    <tr key={`${row.dv_code}-${row.line_id ?? index}`}>
                      <td>{dash(row.line_id)}</td>
                      <td>{dash(row.dv_code)}</td>
                      <td>{dash(row.lifecycle_id)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="qt-empty" colSpan={3}>
                      {dash(null)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="qt-card">
          <header className="qt-card__head">
            <b>Kết quả</b>
            <span className="qt-muted">cùng id nếu chạy lại</span>
          </header>
          <div className="qt-side-row">
            <span>conversion_id</span>
            <b>{dash(result?.conversion_id)}</b>
          </div>
          <div className="qt-side-row">
            <span>invoice_draft_ids</span>
            <b>
              {result?.invoice_draft_ids?.length
                ? result.invoice_draft_ids.join(', ')
                : dash(null)}
            </b>
          </div>
          <div className="qt-side-row">
            <span>optional_handoff</span>
            <b>{dash(result?.optional_handoff?.length ? result.optional_handoff.length : null)}</b>
          </div>
          {result?.optional_handoff?.length ? (
            <ul className="qt-list">
              {result.optional_handoff.map((item, index) => (
                <li key={`${item.vd_project_id ?? item.cp_project_id ?? index}`}>
                  {item.vd_project_id ? (
                    <Link className="qt-link" href={`/crm/video/${item.vd_project_id}`}>
                      Video SOP #{item.vd_project_id}
                    </Link>
                  ) : null}
                  {item.template_key ? (
                    <span className="qt-muted"> · {item.template_key}</span>
                  ) : null}
                  {item.cp_project_id ? (
                    <>
                      {' · '}
                      <Link className="qt-link" href={`/crm/creative-os/projects/${item.cp_project_id}`}>
                        CP {item.cp_project_id}
                      </Link>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="qt-muted">optional_handoff trống — không tạo CP / CSD.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export function QtConvert() {
  const params = useParams<{ id: string }>();
  const proposalId = Number(params?.id);
  const idempotencyKey = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `qt-cvt-${proposalId || 'x'}`,
  );

  const [proposal, setProposal] = useState<QtBuilderProposal | null>(null);
  const [lines, setLines] = useState<QtBuilderLine[]>([]);
  const [result, setResult] = useState<QtConvertResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !Number.isFinite(proposalId) || proposalId <= 0) return;
    setLoading(true);
    setError('');
    try {
      const [detail, lineRes] = await Promise.all([
        getQtProposal(token, proposalId),
        getQtProposalLines(token, proposalId).catch(() => ({ lines: [] as QtBuilderLine[] })),
      ]);
      setProposal(detail);
      setLines((lineRes.lines?.length ? lineRes.lines : detail.lines) ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được convert');
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const planned = useMemo(() => plannedLifecyclesFrom(lines, result), [lines, result]);
  const versionId = proposal?.current_version_id ?? null;

  async function runConvert() {
    const token = getAccessToken();
    if (!token || !versionId || !isQtConvertible(proposal?.status)) return;
    setConverting(true);
    setError('');
    try {
      const out = await convertQtVersion(token, proposalId, versionId, idempotencyKey.current);
      setResult(out);
    } catch (caught) {
      if (caught instanceof QtApiError && caught.code === 'quote_not_accepted') {
        setError('quote_not_accepted');
      } else {
        setError(caught instanceof Error ? caught.message : 'Không convert được');
      }
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="qt-convert-page" aria-busy={loading}>
      <QtConvertPanel
        quoteCode={proposal?.quote_code}
        versionId={versionId}
        status={proposal?.status}
        planned={planned}
        result={result}
        error={error}
        converting={converting}
        onConvert={() => void runConvert()}
      />
      {Number.isFinite(proposalId) && proposalId > 0 ? (
        <p>
          <Link className="qt-link" href={`/crm/proposals/${proposalId}`}>
            Về builder
          </Link>
        </p>
      ) : null}
    </div>
  );
}
