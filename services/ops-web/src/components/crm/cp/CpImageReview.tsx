'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { formatCpApiError } from '@/lib/crm/cp-api';
import { getCpImageReview, type CpImageReview as CpImageReviewData } from '@/lib/crm/cp-image-sop-api';
import { dash } from '@/lib/crm/cp-format';

const QC_DIMENSIONS = [
  { key: 'technical', label: 'Technical' },
  { key: 'product_fidelity', label: 'Product fidelity' },
  { key: 'brand_fit', label: 'Brand fit' },
  { key: 'creative_fit', label: 'Creative fit' },
  { key: 'text_cta_vn', label: 'Text / CTA VN' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'delivery', label: 'Delivery / pack' },
] as const;

type CpImageReviewProps = {
  assetId?: string;
};

export function CpImageReview({ assetId }: CpImageReviewProps) {
  const [review, setReview] = useState<CpImageReviewData | null>(null);
  const [loading, setLoading] = useState(Boolean(assetId));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!assetId) {
      setReview(null);
      setLoading(false);
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setReview(await getCpImageReview(token, assetId));
    } catch (err) {
      setError(formatCpApiError(err, 'Không tải được review'));
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!assetId) {
    return (
      <div className="cp-overview">
        <header className="cp-overview__head">
          <div>
            <p className="cp-crumb">Ảnh SOP / <b>Review &amp; Approval</b></p>
            <h1>Review &amp; Approval Studio</h1>
            <p className="cp-muted">Chọn asset từ thư viện để mở studio QC.</p>
          </div>
        </header>
        <section className="cp-card">
          <p className="cp-empty">
            Chọn asset từ thư viện —{' '}
            <Link href="/crm/creative-os/image/assets">Asset Intelligence (IMG-04)</Link>
          </p>
        </section>
      </div>
    );
  }

  const scores = review?.scores ?? {};

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Ảnh SOP / <b>Review &amp; Approval</b></p>
          <h1>Review &amp; Approval Studio</h1>
          <p className="cp-muted">Human-in-the-loop · annotation · audit evidence.</p>
          <p className="cp-sot">GET/POST /api/crm/cp/image/review/:assetId</p>
        </div>
        <div className="cp-overview__actions">
          <button className="cp-btn cp-btn--danger" type="button">
            Yêu cầu revision
          </button>
          <button className="cp-btn cp-btn--ok" type="button">
            ✓ Duyệt QC nội bộ
          </button>
        </div>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <div className="cp-img-review">
        <section className="cp-img-preview">
          <span className="cp-pill cp-pill--warn" style={{ position: 'absolute', top: 12, left: 12 }}>
            {dash(review?.status ?? 'DRAFT')} · watermark
          </span>
          <div className="cp-img-bottle" aria-hidden />
          <span className="cp-img-ann cp-img-ann--one">1</span>
          <span className="cp-img-ann cp-img-ann--two">2</span>
        </section>

        <div>
          <section className="cp-card cp-img-qc">
            <header className="cp-card__head">
              <div>
                <h2>Quality evidence · 7 chiều</h2>
                <p>img_quality_results.scores_json · D-09</p>
              </div>
            </header>
            {QC_DIMENSIONS.map((dimension) => {
              const score = scores[dimension.key] ?? null;
              const width = score == null ? 0 : Math.min(100, Math.max(0, score));
              return (
                <div key={dimension.key} className="cp-img-metric">
                  <span>{dimension.label}</span>
                  <div className="cp-progress">
                    <i style={{ width: `${width}%` }} />
                  </div>
                  <b>{dash(score)}</b>
                </div>
              );
            })}
            <p className="cp-img-policy">
              GT-I09: logo + CTA <b>không</b> lấy từ model — overlay lockup{' '}
              <code>crm_cp_brand_kits</code>.
            </p>
          </section>

          <section className="cp-card">
            <header className="cp-card__head">
              <h2>Review thread</h2>
            </header>
            {review?.comments?.length ? (
              review.comments.map((comment) => (
                <div key={`${comment.at}-${comment.body}`} className="cp-img-comment">
                  <time>{comment.at}</time>
                  <b>{dash(comment.author)}</b>
                  <p>{comment.body}</p>
                </div>
              ))
            ) : (
              <p className="cp-muted">Chưa có comment — tích hợp CP task comment hoặc img_review_threads.</p>
            )}
            <textarea className="cp-inp" style={{ marginTop: 8 }} placeholder="Thêm comment…" />
          </section>
        </div>
      </div>
    </div>
  );
}
