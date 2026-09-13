'use client';

import { FormEvent, useEffect, useState } from 'react';
import { formatCpApiError, getCpProjectLookups, type CpProjectLookups } from '@/lib/crm/cp-api';
import { getAccessToken } from '@/lib/auth';
import {
  draftCpImageJob,
  listCpImageSops,
  previewCpImageRecipe,
  type CpImageDraftResult,
  type CpImageSop,
  type ImgIntent,
  type ImgRecipeStage,
} from '@/lib/crm/cp-image-sop-api';
import { dash } from '@/lib/crm/cp-format';
import { CpImagePipe } from './CpImagePipe';

const INTENTS: ImgIntent[] = [
  'hero_lifestyle',
  'product_lock',
  'text_cta',
  'upscale_print',
  'human_art',
];

const EMPTY_LOOKUPS: CpProjectLookups = { clients: [], staff: [], lifecycles: [] };

type CpImageJobModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: CpImageDraftResult) => void;
};

export function CpImageJobModal({ open, onClose, onCreated }: CpImageJobModalProps) {
  const [lookups, setLookups] = useState<CpProjectLookups>(EMPTY_LOOKUPS);
  const [sops, setSops] = useState<CpImageSop[]>([]);
  const [clientId, setClientId] = useState('');
  const [lifecycleId, setLifecycleId] = useState('');
  const [intent, setIntent] = useState<ImgIntent>('hero_lifestyle');
  const [sopVersionId, setSopVersionId] = useState('');
  const [variants, setVariants] = useState(2);
  const [direction, setDirection] = useState('');
  const [recipe, setRecipe] = useState<ImgRecipeStage[]>([]);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const token = getAccessToken();
    if (!token) return;
    void Promise.all([
      getCpProjectLookups(token).catch(() => EMPTY_LOOKUPS),
      listCpImageSops(token).catch(() => ({ items: [] as CpImageSop[] })),
    ]).then(([lookupOut, sopOut]) => {
      setLookups(lookupOut);
      setSops(sopOut.items);
      if (lookupOut.clients[0]) setClientId(String(lookupOut.clients[0].id));
      if (lookupOut.lifecycles[0]) setLifecycleId(String(lookupOut.lifecycles[0].id));
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const token = getAccessToken();
    if (!token) return;
    void previewCpImageRecipe(token, { intent, sop_version_id: sopVersionId || null })
      .then((out) => {
        setRecipe(out.stages);
        setBlockedReason(out.blocked_reason);
      })
      .catch(() => {
        setRecipe([]);
        setBlockedReason(null);
      });
  }, [intent, open, sopVersionId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token || !clientId || !sopVersionId) {
      setError('Chọn khách, SOP và intent trước khi tạo draft.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await draftCpImageJob(token, {
        agency_client_id: Number(clientId),
        service_lifecycle_id: lifecycleId || null,
        sop_version_id: sopVersionId,
        intent,
        variants,
        creative_direction: direction,
        idempotency_key: crypto.randomUUID(),
      });
      onCreated?.(result);
      onClose();
    } catch (err) {
      setError(formatCpApiError(err, 'Không tạo được draft'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="cp-img-modalbg" role="dialog" aria-modal="true" onClick={onClose}>
      <form className="cp-img-modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <header className="cp-img-modal__head">
          <div>
            <h2>Tạo Image Job (governed)</h2>
            <p>Draft → policy → confirm credit → submit.</p>
          </div>
          <button type="button" className="cp-img-modal__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="cp-img-fieldgrid">
          <label className="cp-img-field">
            <span>Khách / Brand</span>
            <select
              className="cp-inp"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              {lookups.clients.length === 0 ? (
                <option value="">— chọn agency_client —</option>
              ) : null}
              {lookups.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="cp-img-field">
            <span>Lifecycle</span>
            <select
              className="cp-inp"
              value={lifecycleId}
              onChange={(event) => setLifecycleId(event.target.value)}
            >
              {lookups.lifecycles.length === 0 ? (
                <option value="">—</option>
              ) : null}
              {lookups.lifecycles.map((lifecycle) => (
                <option key={lifecycle.id} value={lifecycle.id}>
                  {lifecycle.service_slug ?? lifecycle.id}
                </option>
              ))}
            </select>
          </label>
          <label className="cp-img-field">
            <span>Intent</span>
            <select
              className="cp-inp"
              value={intent}
              onChange={(event) => setIntent(event.target.value as ImgIntent)}
            >
              {INTENTS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="cp-img-field">
            <span>Image SOP</span>
            <select
              className="cp-inp"
              value={sopVersionId}
              onChange={(event) => setSopVersionId(event.target.value)}
            >
              <option value="">— chọn SOP —</option>
              {sops.map((sop) => (
                <option key={sop.code} value={sop.id ?? sop.code}>
                  {sop.code} {sop.name}
                </option>
              ))}
            </select>
          </label>
          <label className="cp-img-field">
            <span>Explore variants</span>
            <input
              className="cp-inp"
              type="number"
              min={1}
              max={4}
              value={variants}
              onChange={(event) => setVariants(Number(event.target.value))}
            />
          </label>
          <label className="cp-img-field cp-img-field--full">
            <span>Creative direction + Genome</span>
            <textarea
              className="cp-inp"
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
              placeholder="Creative direction…"
            />
          </label>
        </div>
        <CpImagePipe stages={recipe} activeStage="explore" compact />
        <p className="cp-img-policy">
          GET /image/recipes/preview
          {blockedReason ? ` · blocked: ${blockedReason}` : ''}
          {blockedReason ? '' : ' · Pack local vẫn chạy. Overlay lockup bắt buộc (GT-I09).'}
        </p>
        {error ? <p className="cp-alert">{error}</p> : null}
        <div className="cp-overview__actions">
          <button type="button" className="cp-btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="cp-btn cp-btn--primary" disabled={busy}>
            Tạo draft + recipe
          </button>
        </div>
      </form>
    </div>
  );
}

export function formatImageJobCredit(value: number | null | undefined): string {
  return dash(value);
}
