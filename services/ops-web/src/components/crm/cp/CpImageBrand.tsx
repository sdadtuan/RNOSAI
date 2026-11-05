'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { formatCpApiError, listKits, type CpBrandKit } from '@/lib/crm/cp-api';
import { getCpImageBrandGraph, type CpImageBrandGraph } from '@/lib/crm/cp-image-sop-api';
import { dash } from '@/lib/crm/cp-format';

type CpImageBrandProps = {
  kitId?: string;
};

export function CpImageBrand({ kitId }: CpImageBrandProps) {
  const [kits, setKits] = useState<CpBrandKit[]>([]);
  const [graph, setGraph] = useState<CpImageBrandGraph | null>(null);
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
      if (kitId) {
        setGraph(await getCpImageBrandGraph(token, kitId));
        setKits([]);
      } else {
        const out = await listKits(token, 'all');
        setKits(out.items);
        setGraph(null);
      }
    } catch (err) {
      setError(formatCpApiError(err, 'Không tải được brand graph'));
    } finally {
      setLoading(false);
    }
  }, [kitId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!kitId) {
    return (
      <div className="cp-overview" aria-busy={loading}>
        <header className="cp-overview__head">
          <div>
            <p className="cp-crumb">Ảnh SOP / <b>Brand Graph</b></p>
            <h1>Brand Knowledge Graph v1</h1>
            <p className="cp-muted">Chọn Brand Kit từ CP OS.</p>
          </div>
        </header>
        {error ? (
          <section className="cp-card cp-card--error">
            <p>{error}</p>
          </section>
        ) : null}
        <section className="cp-card">
          {kits.length === 0 ? (
            <p className="cp-empty">{dash(null)} · Chưa có brand kit</p>
          ) : (
            <ul className="cp-list">
              {kits.map((kit) => (
                <li key={kit.id}>
                  <Link href={`/crm/creative-os/image/brand/${kit.id}`}>{kit.name}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  const rules = graph?.rules ?? [];

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Ảnh SOP / <b>Brand Graph</b></p>
          <h1>Brand Knowledge Graph v1</h1>
          <p className="cp-muted">
            Mở rộng <code>crm_cp_brand_kits</code> + <code>img_brand_rules</code>.
          </p>
          <p className="cp-sot">GET /api/crm/cp/image/brand/:kitId/graph</p>
        </div>
        <span className="cp-pill cp-pill--ok">Kit CP</span>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <div className="cp-img-grid2">
        <section className="cp-card">
          <header className="cp-card__head">
            <div>
              <h2>{graph?.kit?.name ?? dash(null)}</h2>
              <p>Brand Kit từ CP OS · snapshot tại G1</p>
            </div>
          </header>
          <div className="cp-img-metric">
            <span>Visual rules</span>
            <div className="cp-progress">
              <i style={{ width: '0%' }} />
            </div>
            <b>{dash(null)}</b>
          </div>
          <div className="cp-img-metric">
            <span>Ref assets</span>
            <div className="cp-progress">
              <i style={{ width: '0%' }} />
            </div>
            <b>{dash(null)}</b>
          </div>
          <div className="cp-img-metric">
            <span>Forbidden</span>
            <div>
              <span className="cp-pill cp-pill--bad">img_brand_rules</span>
            </div>
            <b>{dash(null)}</b>
          </div>
        </section>

        <section className="cp-card">
          <header className="cp-card__head">
            <h2>Policy rules</h2>
          </header>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Mode</th>
                  <th>Effect</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <>
                    <tr>
                      <td>Official lockup / CTA</td>
                      <td><span className="cp-pill cp-pill--bad">BLOCK</span></td>
                      <td>GT-I09 overlay — cấm model vẽ logo</td>
                    </tr>
                    <tr>
                      <td>External Magnific</td>
                      <td><span className="cp-pill cp-pill--warn">APPROVAL</span></td>
                      <td>Brand Admin</td>
                    </tr>
                  </>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.rule_key}>
                      <td>{rule.rule_key}</td>
                      <td><span className="cp-pill cp-pill--warn">{rule.enforcement}</span></td>
                      <td>{dash(rule.effect)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
