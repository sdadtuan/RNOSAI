'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  formatCpApiError,
  previewBrandKit,
  type CpBrandPayload,
  type CpBrandPreviewItem,
  type CpScope,
} from '@/lib/crm/cp-api';
import {
  overlayFromBrandPayload,
  previewOverlayInput,
} from '@/lib/crm/cp-brand-preview.util';
import { dash } from '@/lib/crm/cp-format';

const RATIO_BOX: Record<string, { width: number; height: number }> = {
  '9:16': { width: 90, height: 160 },
  '1:1': { width: 140, height: 140 },
  '4:5': { width: 112, height: 140 },
  '16:9': { width: 160, height: 90 },
};

export function CpBrandPreview({
  kitId,
  scope,
  payload,
}: {
  kitId: string;
  scope: CpScope;
  payload: CpBrandPayload;
}) {
  const [items, setItems] = useState<CpBrandPreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [overlay, setOverlay] = useState(overlayFromBrandPayload(payload));

  useEffect(() => {
    setOverlay(overlayFromBrandPayload(payload));
  }, [payload]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError('');
    try {
      const result = await previewBrandKit(token, kitId, {
        overlay: previewOverlayInput(String(form.get('overlay') ?? '')),
        foreground: payload.palette[1] || payload.palette[0] || undefined,
        background: payload.palette[0] || undefined,
      }, scope);
      setItems(result.items);
    } catch (caught) {
      setItems([]);
      setError(formatCpApiError(caught, 'Không chạy được preview'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cp-overview">
      <section className="cp-card">
        <div className="cp-card__head">
          <div>
            <h2>Brand Preview Lab</h2>
            <p className="cp-muted">9:16 / 1:1 / 4:5 / 16:9 · contrast · clipping</p>
          </div>
        </div>
        {error ? <p className="cp-card--error">{error}</p> : null}
        <form className="cp-filters" onSubmit={submit}>
          <label>
            <span>Overlay</span>
            <input
              name="overlay"
              value={overlay}
              onChange={(event) => setOverlay(event.target.value)}
              placeholder="Text overlay"
            />
          </label>
          <button className="cp-btn cp-btn--primary" type="submit" disabled={loading}>
            {loading ? 'Đang chạy…' : 'Chạy QC visual'}
          </button>
        </form>
      </section>

      <div className="cp-overview-grid">
        {(items.length ? items : [
          { ratio: '9:16', warnings: [] },
          { ratio: '1:1', warnings: [] },
          { ratio: '4:5', warnings: [] },
          { ratio: '16:9', warnings: [] },
        ]).map((item) => {
          const box = RATIO_BOX[item.ratio] ?? RATIO_BOX['1:1'];
          return (
            <section className="cp-card" key={item.ratio}>
              <div className="cp-card__head"><h2>{item.ratio}</h2></div>
              <div
                className="cp-empty"
                style={{
                  width: box.width,
                  height: box.height,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid currentColor',
                  margin: '0 auto 8px',
                }}
              >
                {item.ratio}
              </div>
              <p className="cp-muted">
                {item.warnings.length ? item.warnings.join(' · ') : dash(null)}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
