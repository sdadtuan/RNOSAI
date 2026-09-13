'use client';

import { FormEvent, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { formatCpApiError } from '@/lib/crm/cp-api';
import { createCpImageSop, saveCpImageSopVersion } from '@/lib/crm/cp-image-sop-api';

const STEPS = ['Business', 'Input contract', 'Prompt & Brand', 'Provider recipe', 'Quality & SLA', 'Test & publish'];

export function CpImageComposer() {
  const [step, setStep] = useState(2);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [dataClass, setDataClass] = useState('INTERNAL');
  const [outcome, setOutcome] = useState('');
  const [brandVisual, setBrandVisual] = useState('');
  const [negative, setNegative] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token || !code.trim() || !name.trim()) {
      setError('Nhập mã và tên SOP.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const created = await createCpImageSop(token, {
        code: code.trim(),
        name: name.trim(),
        category: 'BRAND_KEY_VISUAL',
        data_class: dataClass,
        outcome: outcome.trim(),
      });
      await saveCpImageSopVersion(token, created.id, {
        version: 'v0.1',
        manifest_json: {
          recipe_stages: [
            { stage: 'explore', capability: 'images_generate', provider: 'magnific_rest' },
            { stage: 'select', capability: 'winner_asset_id', provider: 'local' },
            { stage: 'upscale', capability: 'images_upscale', provider: 'magnific_rest' },
            { stage: 'pack', capability: 'images_crop', provider: 'local' },
          ],
        },
        creative_genome: {
          composition: brandVisual,
          negative,
        },
      });
      setNotice('Đã lưu SOP draft v0.1.');
    } catch (err) {
      setError(formatCpApiError(err, 'Không lưu được SOP'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cp-overview" onSubmit={submit}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Ảnh SOP / <b>SOP Composer</b></p>
          <h1>Image SOP Composer</h1>
          <p className="cp-muted">Wizard 6 bước + Creative Genome + recipe 6 stage.</p>
          <p className="cp-sot">POST /api/crm/cp/image/sops · manifest_json.recipe_stages[]</p>
        </div>
        <div className="cp-overview__actions">
          <button className="cp-btn cp-btn--primary" type="submit" disabled={busy}>
            Gửi review
          </button>
        </div>
      </header>

      <div className="cp-img-stepper">
        {STEPS.map((label, index) => (
          <div
            key={label}
            className={
              index < step
                ? 'cp-img-step cp-img-step--done'
                : index === step
                  ? 'cp-img-step cp-img-step--on'
                  : 'cp-img-step'
            }
          >
            <i>{index < step ? '✓' : index + 1}</i>
            {label}
          </div>
        ))}
      </div>

      <div className="cp-img-grid2">
        <section className="cp-card">
          <header className="cp-card__head">
            <h2>Metadata SOP</h2>
          </header>
          <div className="cp-img-fieldgrid">
            <label className="cp-img-field cp-img-field--full">
              <span>Tên SOP</span>
              <input className="cp-inp" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="cp-img-field">
              <span>Mã</span>
              <input className="cp-inp" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <label className="cp-img-field">
              <span>Data class</span>
              <select className="cp-inp" value={dataClass} onChange={(e) => setDataClass(e.target.value)}>
                <option>INTERNAL</option>
                <option>CONFIDENTIAL</option>
                <option>RESTRICTED</option>
              </select>
            </label>
            <label className="cp-img-field cp-img-field--full">
              <span>Business outcome</span>
              <textarea className="cp-inp" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
            </label>
          </div>
          <p className="cp-img-policy">
            Policy preview: RESTRICTED → chỉ ComfyUI private. INTERNAL + Magnific REST khi connection on.
          </p>
        </section>

        <section className="cp-card">
          <header className="cp-card__head">
            <div>
              <h2>Prompt Package · 7 lớp</h2>
              <p>crm_cp_prompt_packages · L7 provider-syntax không lộ client</p>
            </div>
          </header>
          <div className="cp-img-fieldgrid">
            <label className="cp-img-field cp-img-field--full">
              <span>L3 Brand visual (locked)</span>
              <textarea className="cp-inp" value={brandVisual} onChange={(e) => setBrandVisual(e.target.value)} />
            </label>
            <label className="cp-img-field cp-img-field--full">
              <span>L1+L5 Negative / SOP</span>
              <textarea className="cp-inp" value={negative} onChange={(e) => setNegative(e.target.value)} />
            </label>
          </div>

          <h3 className="cp-img-section-title">Creative Genome (khoá G1)</h3>
          <div className="cp-img-genome">
            <div className="cp-img-genome__g">
              <span>composition</span>
              <b>centered architecture · CTA lower-third</b>
            </div>
            <div className="cp-img-genome__g">
              <span>light / color</span>
              <b>warm gold · dusk · navy shadow</b>
            </div>
            <div className="cp-img-genome__g">
              <span>subject / style</span>
              <b>facade · luxury still · no people</b>
            </div>
          </div>

          <h3 className="cp-img-section-title">Recipe graph</h3>
          <div className="cp-img-recipe">
            <div className="cp-img-node cp-img-node--a">
              <div className="cp-img-node__h">EXPLORE <span>M</span></div>
              <div className="cp-img-node__b">images_generate · 2–4</div>
            </div>
            <div className="cp-img-node cp-img-node--b">
              <div className="cp-img-node__h">SELECT <span>AD</span></div>
              <div className="cp-img-node__b">winner_asset_id · GT-I11</div>
            </div>
            <div className="cp-img-node cp-img-node--c">
              <div className="cp-img-node__h">UPSCALE <span>M</span></div>
              <div className="cp-img-node__b">images_upscale</div>
            </div>
            <div className="cp-img-node cp-img-node--d">
              <div className="cp-img-node__h">PACK + OVERLAY <span>PTT</span></div>
              <div className="cp-img-node__b">crop/resize + lockup GT-I09</div>
            </div>
          </div>
          <p className="cp-sot">GET /api/crm/cp/image/recipes/preview</p>
        </section>
      </div>

      {error ? <p className="cp-alert">{error}</p> : null}
      {notice ? <p className="cp-alert cp-alert--active">{notice}</p> : null}

      <div className="cp-overview__actions">
        <button type="button" className="cp-btn" onClick={() => setStep((current) => Math.max(0, current - 1))}>
          ← Trước
        </button>
        <button type="button" className="cp-btn" onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))}>
          Tiếp →
        </button>
      </div>
    </form>
  );
}
