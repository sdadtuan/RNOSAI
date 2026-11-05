'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { formatCpApiError } from '@/lib/crm/cp-api';
import {
  getCpImageAssetProvenance,
  listCpImageAssets,
  type CpImageAsset,
  type CpImageProvenanceEvent,
} from '@/lib/crm/cp-image-sop-api';
import { dash } from '@/lib/crm/cp-format';

const PACK_RATIOS = [
  { ratio: '1:1', label: 'Feed / catalog' },
  { ratio: '4:5', label: 'KV / ads' },
  { ratio: '9:16', label: 'Reels / I2V' },
  { ratio: '16:9', label: 'Landing' },
];

export function CpImageAssets() {
  const [assets, setAssets] = useState<CpImageAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [provenance, setProvenance] = useState<CpImageProvenanceEvent[]>([]);
  const [formatPack, setFormatPack] = useState<Record<string, string | null>>({});
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
      const out = await listCpImageAssets(token);
      setAssets(out.items);
      if (out.items[0]) setSelectedId(out.items[0].id);
    } catch (err) {
      setError(formatCpApiError(err, 'Không tải được assets'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !selectedId) {
      setProvenance([]);
      setFormatPack({});
      return;
    }
    void getCpImageAssetProvenance(token, selectedId)
      .then((out) => setProvenance(out.events))
      .catch(() => setProvenance([]));
  }, [selectedId]);

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Ảnh SOP / <b>Asset Intelligence</b></p>
          <h1>Asset Intelligence Library</h1>
          <p className="cp-muted">
            SoT: <code>crm_cp_assets</code> — provenance từ img_jobs / provider_runs.
          </p>
          <p className="cp-sot">GET /api/crm/cp/image/assets · reuse GET /api/crm/cp/assets</p>
        </div>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <div className="cp-img-assetgrid">
        {assets.length === 0 ? (
          <>
            <article className="cp-card cp-img-asset">
              <div className="cp-img-assetpic">
                <span className="cp-img-wm">DRAFT</span>
              </div>
              <div className="cp-img-ainfo">
                <b>{dash(null)}</b>
                <p>Chưa có asset image_sop</p>
                <span className="cp-pill cp-pill--info">{dash(null)}</span>
              </div>
            </article>
            <article className="cp-card cp-img-asset">
              <div className="cp-img-assetpic cp-img-assetpic--b">
                <span className="cp-img-wm">{dash(null)}</span>
              </div>
              <div className="cp-img-ainfo">
                <b>Thư viện CP hiện có</b>
                <p>
                  <Link href="/crm/creative-os/media">/crm/creative-os/media</Link>
                </p>
                <span className="cp-pill cp-pill--ok">DAM live</span>
              </div>
            </article>
          </>
        ) : (
          assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="cp-card cp-img-asset cp-img-asset--btn"
              onClick={() => setSelectedId(asset.id)}
            >
              <div className="cp-img-assetpic">
                <span className="cp-img-wm">{dash(asset.status)}</span>
              </div>
              <div className="cp-img-ainfo">
                <b>{asset.filename}</b>
                <p>{asset.id}</p>
                <span className="cp-pill cp-pill--info">{dash(asset.status)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="cp-img-grid2">
        <section className="cp-card">
          <header className="cp-card__head">
            <div>
              <h2>Provenance Graph</h2>
              <p>Khi job chạy — snapshot immutable.</p>
            </div>
          </header>
          <div className="cp-img-tl">
            {provenance.length === 0 ? (
              <>
                <div className="cp-img-tl__ev">
                  <b>Input asset</b>
                  <p>crm_cp_assets.id · checksum SHA-256</p>
                </div>
                <div className="cp-img-tl__ev">
                  <b>img_sop_versions</b>
                  <p>PTT-IMG-KV-45 · prompt_package_id</p>
                </div>
                <div className="cp-img-tl__ev">
                  <b>crm_cp_provider_runs</b>
                  <p>tool_or_workflow = image_sop:{'{code}'}@v{'{n}'}</p>
                </div>
              </>
            ) : (
              provenance.map((event) => (
                <div key={`${event.label}-${event.detail}`} className="cp-img-tl__ev">
                  <b>{event.label}</b>
                  <p>{event.detail}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="cp-card">
          <header className="cp-card__head">
            <div>
              <h2>Format pack (từ 1 winner)</h2>
              <p>GT-I10 · images_crop / images_resize</p>
            </div>
          </header>
          <div className="cp-img-pack">
            {PACK_RATIOS.map((item) => (
              <div key={item.ratio} className="cp-img-pack__ratio">
                <b>{item.ratio}</b>
                {item.label}
                <br />
                {dash(formatPack[item.ratio] ?? null)}
              </div>
            ))}
          </div>
          <p className="cp-sot">img_frames.format_pack_json → crm_cp_assets.id</p>
        </section>
      </div>
    </div>
  );
}
