'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { formatCpApiError } from '@/lib/crm/cp-api';
import {
  listCpImageIntents,
  previewCpImageRouter,
  type CpImageIntentRow,
  type ImgIntent,
} from '@/lib/crm/cp-image-sop-api';

const ALL_INTENTS: ImgIntent[] = [
  'hero_lifestyle',
  'product_lock',
  'text_cta',
  'upscale_print',
  'bg_cutout',
  'format_pack',
  'human_art',
  'i2v_handoff',
];

function healthPill(health: string): string {
  if (health === 'ok') return 'cp-pill cp-pill--ok';
  if (health === 'fallback') return 'cp-pill cp-pill--info';
  if (health === 'blocked') return 'cp-pill cp-pill--warn';
  return 'cp-pill cp-pill--info';
}

export function CpImageProviders() {
  const [intents, setIntents] = useState<CpImageIntentRow[]>([]);
  const [selected, setSelected] = useState<ImgIntent>('hero_lifestyle');
  const [previewNote, setPreviewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await listCpImageIntents(token);
      setIntents(out.items.filter((row) => row.health !== 'hidden'));
    } catch (err) {
      setError(formatCpApiError(err, 'Không tải được intents'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    void previewCpImageRouter(token, { intent: selected })
      .then((out) => {
        setPreviewNote(
          out.blocked_reason
            ? `Blocked: ${out.blocked_reason}`
            : `${out.stages.length} stage trong recipe preview`,
        );
      })
      .catch(() => setPreviewNote(''));
  }, [selected]);

  const visibleIntents = intents.length
    ? intents
    : ALL_INTENTS.map((intent) => ({
        intent,
        capability: '—',
        health: 'blocked' as const,
        decision: '—',
      }));

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Ảnh SOP / <b>Provider Router</b></p>
          <h1>Multi-objective Provider Router</h1>
          <p className="cp-muted">
            Intent trước · hard policy · scoring sau · <b>không hiện provider chưa kết nối</b> (D-08).
          </p>
          <p className="cp-sot">GET /api/crm/cp/image/intents · /providers/router/preview</p>
        </div>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <div className="cp-img-intents">
        {ALL_INTENTS.map((intent) => (
          <button
            key={intent}
            type="button"
            className={selected === intent ? 'cp-img-intents__btn cp-img-intents__btn--on' : 'cp-img-intents__btn'}
            onClick={() => setSelected(intent)}
          >
            {intent}
          </button>
        ))}
      </div>
      {previewNote ? <p className="cp-muted">{previewNote}</p> : null}

      <div className="cp-img-grid2">
        <section className="cp-card">
          <header className="cp-card__head">
            <div>
              <h2>Intent → capability</h2>
              <p>Allowlist Magnific đã ship — không Flux/Ideogram ảo.</p>
            </div>
          </header>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Intent</th>
                  <th>Capability thật</th>
                  <th>Health</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {visibleIntents.map((row) => (
                  <tr key={row.intent}>
                    <td>{row.intent}</td>
                    <td>
                      <code>{row.capability}</code>
                    </td>
                    <td>
                      <span className={healthPill(row.health)}>{row.health}</span>
                    </td>
                    <td>{row.decision}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cp-card">
          <p className="cp-img-policy">
            <b>Hard constraints:</b>
            <br />
            RESTRICTED → Comfy only · Intent text_cta → cấm model-drawn logo · Capability ngoài
            MAGNIFIC_PILOT → 409 · Flux/Leonardo chỉ hiện khi flag + connection.
          </p>
        </section>
      </div>
    </div>
  );
}
