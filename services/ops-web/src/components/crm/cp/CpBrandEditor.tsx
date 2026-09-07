'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  buildBrandVersionPayload,
  getKit,
  listVersions,
  saveVersion,
  type CpBrandKit,
  type CpBrandPayload,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

export type CpBrandTab = 'editor' | 'rules' | 'preview' | 'history';

const EMPTY_PAYLOAD: CpBrandPayload = {
  logos: { primary: '', light: '', mark: '', icon: '' },
  palette: [],
  typography: { font_family: '', heading_weight: '', body_weight: '' },
  cta: { label: '', url: '' },
  disclaimer: { text: '', channels: '' },
  motion: { intro: '', outro: '', caption_style: '', watermark: '' },
  audio: { sound_logo: '', voice_style: '', music_style: '' },
};

const TABS: Array<{ id: CpBrandTab; label: string }> = [
  { id: 'editor', label: 'Editor' },
  { id: 'rules', label: 'Rules' },
  { id: 'preview', label: 'Preview' },
  { id: 'history', label: 'History' },
];

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizePayload(value: Record<string, unknown> | undefined): CpBrandPayload {
  const source = value ?? {};
  const logos = record(source.logos);
  const typography = record(source.typography);
  const cta = record(source.cta);
  const disclaimer = record(source.disclaimer);
  const motion = record(source.motion);
  const audio = record(source.audio);
  return {
    logos: {
      primary: text(logos.primary),
      light: text(logos.light),
      mark: text(logos.mark),
      icon: text(logos.icon),
    },
    palette: Array.isArray(source.palette)
      ? source.palette.filter((color): color is string => typeof color === 'string')
      : [],
    typography: {
      font_family: text(typography.font_family),
      heading_weight: text(typography.heading_weight),
      body_weight: text(typography.body_weight),
    },
    cta: { label: text(cta.label), url: text(cta.url) },
    disclaimer: {
      text: text(disclaimer.text),
      channels: text(disclaimer.channels),
    },
    motion: {
      intro: text(motion.intro),
      outro: text(motion.outro),
      caption_style: text(motion.caption_style),
      watermark: text(motion.watermark),
    },
    audio: {
      sound_logo: text(audio.sound_logo),
      voice_style: text(audio.voice_style),
      music_style: text(audio.music_style),
    },
  };
}

function parseScope(value: string | undefined): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function UnavailableTab() {
  return (
    <section className="cp-card">
      <h2>Chưa có dữ liệu</h2>
      <p className="cp-empty">{dash(null)}</p>
    </section>
  );
}

export function CpBrandEditor({
  kitId,
  activeTab = 'editor',
  scope: scopeValue,
}: {
  kitId: string;
  activeTab?: CpBrandTab;
  scope?: string;
}) {
  const scope = parseScope(scopeValue);
  const [kit, setKit] = useState<CpBrandKit | null>(null);
  const [payload, setPayload] = useState<CpBrandPayload>(EMPTY_PAYLOAD);
  const [version, setVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const [kitResult, versionsResult] = await Promise.all([
        getKit(token, kitId, scope),
        listVersions(token, kitId, scope),
      ]);
      const latest = versionsResult.items[0];
      setKit(kitResult);
      setVersion(latest?.n ?? null);
      setPayload(normalizePayload(latest?.payload_json));
    } catch (err) {
      setKit(null);
      setVersion(null);
      setPayload(EMPTY_PAYLOAD);
      setError(err instanceof Error ? err.message : 'Không tải được Brand Kit');
    } finally {
      setLoading(false);
    }
  }, [kitId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    const form = new FormData(event.currentTarget);
    const draft: CpBrandPayload = {
      logos: {
        primary: text(form.get('logo_primary')),
        light: text(form.get('logo_light')),
        mark: text(form.get('logo_mark')),
        icon: text(form.get('logo_icon')),
      },
      palette: text(form.get('palette')).split(',').map((item) => item.trim()).filter(Boolean),
      typography: {
        font_family: text(form.get('font_family')),
        heading_weight: text(form.get('heading_weight')),
        body_weight: text(form.get('body_weight')),
      },
      cta: {
        label: text(form.get('cta_label')),
        url: text(form.get('cta_url')),
      },
      disclaimer: {
        text: text(form.get('disclaimer_text')),
        channels: text(form.get('disclaimer_channels')),
      },
      motion: {
        intro: text(form.get('motion_intro')),
        outro: text(form.get('motion_outro')),
        caption_style: text(form.get('caption_style')),
        watermark: text(form.get('watermark')),
      },
      audio: {
        sound_logo: text(form.get('sound_logo')),
        voice_style: text(form.get('voice_style')),
        music_style: text(form.get('music_style')),
      },
    };
    const nextPayload = buildBrandVersionPayload(payload, draft);

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const created = await saveVersion(token, kitId, nextPayload, scope);
      setPayload(nextPayload);
      setVersion(created.n);
      setNotice(`Đã tạo phiên bản mới v${created.n}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được phiên bản mới');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Brand Kit</p>
          <h1>{kit?.name ? `Brand Kit — ${kit.name}` : 'Brand Kit Editor'}</h1>
          <p className="cp-muted">
            {version == null ? dash(null) : `Phiên bản hiện tại: v${version}`}
            {' · '}Mỗi lần lưu sẽ tạo một phiên bản mới.
          </p>
        </div>
        <Link className="cp-btn" href={`/crm/creative-os/brand-kits?scope=${scope}`}>
          Portfolio
        </Link>
      </header>

      <nav className="cp-card__head" aria-label="Brand Kit">
        <div>
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              className={activeTab === tab.id ? 'cp-btn cp-btn--primary' : 'cp-btn'}
              href={`/crm/creative-os/brand-kits/${kitId}?tab=${tab.id}&scope=${scope}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
          <button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button>
        </section>
      ) : null}
      {notice ? <section className="cp-alert">{notice}</section> : null}

      {activeTab !== 'editor' ? <UnavailableTab /> : (
        <form key={version ?? 'empty'} className="cp-overview" onSubmit={submit}>
          <div className="cp-overview-grid">
            <section className="cp-card">
              <div className="cp-card__head"><h2>Logo variants</h2></div>
              <div className="cp-filters">
                <label><span>Primary</span><input name="logo_primary" defaultValue={payload.logos.primary} placeholder="Asset/version ID hoặc URL" /></label>
                <label><span>Light</span><input name="logo_light" defaultValue={payload.logos.light} placeholder="Asset/version ID hoặc URL" /></label>
                <label><span>Mark</span><input name="logo_mark" defaultValue={payload.logos.mark} placeholder="Asset/version ID hoặc URL" /></label>
                <label><span>Icon</span><input name="logo_icon" defaultValue={payload.logos.icon} placeholder="Asset/version ID hoặc URL" /></label>
              </div>
            </section>

            <section className="cp-card">
              <div className="cp-card__head"><h2>Palette</h2></div>
              <div className="cp-filters">
                <label>
                  <span>Màu, phân cách bằng dấu phẩy</span>
                  <input name="palette" defaultValue={payload.palette.join(', ')} placeholder="#0f2747, #ffffff" />
                </label>
              </div>
            </section>
          </div>

          <div className="cp-overview-grid">
            <section className="cp-card">
              <div className="cp-card__head"><h2>Type / Typography</h2></div>
              <div className="cp-filters">
                <label><span>Font family</span><input name="font_family" defaultValue={payload.typography.font_family} /></label>
                <label><span>Heading weight</span><input name="heading_weight" defaultValue={payload.typography.heading_weight} /></label>
                <label><span>Body weight</span><input name="body_weight" defaultValue={payload.typography.body_weight} /></label>
              </div>
            </section>

            <section className="cp-card">
              <div className="cp-card__head"><h2>CTA</h2></div>
              <div className="cp-filters">
                <label><span>Nhãn</span><input name="cta_label" defaultValue={payload.cta.label} /></label>
                <label><span>URL</span><input name="cta_url" defaultValue={payload.cta.url} /></label>
              </div>
            </section>
          </div>

          <section className="cp-card">
            <div className="cp-card__head"><h2>Disclaimer</h2></div>
            <div className="cp-filters">
              <label><span>Nội dung</span><input name="disclaimer_text" defaultValue={payload.disclaimer.text} /></label>
              <label><span>Kênh áp dụng</span><input name="disclaimer_channels" defaultValue={payload.disclaimer.channels} /></label>
            </div>
          </section>

          <div className="cp-overview-grid">
            <section className="cp-card">
              <div className="cp-card__head"><h2>Motion</h2></div>
              <div className="cp-filters">
                <label><span>Intro</span><input name="motion_intro" defaultValue={payload.motion.intro} /></label>
                <label><span>Outro</span><input name="motion_outro" defaultValue={payload.motion.outro} /></label>
                <label><span>Caption style</span><input name="caption_style" defaultValue={payload.motion.caption_style} /></label>
                <label><span>Watermark</span><input name="watermark" defaultValue={payload.motion.watermark} /></label>
              </div>
            </section>

            <section className="cp-card">
              <div className="cp-card__head"><h2>Audio</h2></div>
              <div className="cp-filters">
                <label><span>Sound logo</span><input name="sound_logo" defaultValue={payload.audio.sound_logo} /></label>
                <label><span>Voice style</span><input name="voice_style" defaultValue={payload.audio.voice_style} /></label>
                <label><span>Music style</span><input name="music_style" defaultValue={payload.audio.music_style} /></label>
              </div>
            </section>
          </div>

          <button className="cp-btn cp-btn--primary" type="submit" disabled={saving || loading}>
            {saving ? 'Đang tạo phiên bản…' : 'Lưu thành phiên bản mới'}
          </button>
        </form>
      )}
    </div>
  );
}
