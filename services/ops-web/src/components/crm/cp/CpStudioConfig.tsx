'use client';

import {
  STUDIO_DURATION_OPTIONS,
  STUDIO_MUSIC_PRESETS,
  STUDIO_RATIO_OPTIONS,
  STUDIO_STYLE_CARDS,
  STUDIO_VOICE_PRESETS,
  formatKitOption,
  modelOptions,
  studioGateItems,
  voicePresetValue,
  parseVoicePreset,
  type StudioConfig,
  type StudioGateItem,
} from '@/lib/crm/cp-video-studio.util';
import { draftLanguageWritable } from '@/lib/crm/cp-format';
import type { CpBrandKit, CpSettings, CpVideoDraft } from '@/lib/crm/cp-api';

export function CpStudioConfig({
  config,
  onConfigChange,
  kitId,
  onKitChange,
  kits,
  settings,
  draft,
  brandColors,
  estimate,
  gates,
  rendering,
  disabled,
  onSubmit,
}: {
  config: StudioConfig;
  onConfigChange: (patch: Partial<StudioConfig>) => void;
  kitId: string;
  onKitChange: (value: string) => void;
  kits: CpBrandKit[];
  settings: CpSettings | null;
  draft: CpVideoDraft | null;
  brandColors: string[];
  estimate: string;
  gates: StudioGateItem[];
  rendering: boolean;
  disabled?: boolean;
  onSubmit: () => void;
}) {
  const models = modelOptions(settings?.models_json);
  const voiceValue = voicePresetValue(config.language, config.voice_id);
  const voiceOptions = STUDIO_VOICE_PRESETS.some(
    (item) => voicePresetValue(item.locale, item.voice) === voiceValue,
  )
    ? STUDIO_VOICE_PRESETS
    : [
        ...STUDIO_VOICE_PRESETS,
        { locale: config.language, voice: config.voice_id, label: `${config.language} · ${config.voice_id || 'Voice'}` },
      ];
  const musicOptions = STUDIO_MUSIC_PRESETS.some((item) => item.id === config.music)
    ? STUDIO_MUSIC_PRESETS
    : [{ id: config.music, label: config.music }, ...STUDIO_MUSIC_PRESETS];
  const palette = config.brand_colors.length ? config.brand_colors : brandColors;
  const blocked = gates.some((gate) => !gate.ok);

  return (
    <section className="cp-studio-pro__panel">
      <header className="cp-studio-pro__panel-head">
        <span className="cp-studio-pro__step">2</span>
        <div>
          <h2>Cấu hình video</h2>
          <p>Tỉ lệ, thời lượng, style và model render.</p>
        </div>
      </header>

      <div className="cp-studio-pro__field">
        <span>Tỉ lệ khung</span>
        <div className="cp-studio-pro__ratio-grid">
          {STUDIO_RATIO_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={config.aspect_ratio === item.id ? 'is-on' : undefined}
              onClick={() => onConfigChange({ aspect_ratio: item.id })}
            >
              <b>{item.label}</b>
              <small>{item.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="cp-studio-pro__field">
        <span>Thời lượng</span>
        <div className="cp-studio-pro__pill-row">
          {STUDIO_DURATION_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className={config.duration_sec === item ? 'is-on' : undefined}
              onClick={() => onConfigChange({ duration_sec: item })}
            >
              {item}s
            </button>
          ))}
        </div>
      </div>

      <div className="cp-studio-pro__field">
        <span>Phong cách</span>
        <div className="cp-studio-pro__style-grid">
          {STUDIO_STYLE_CARDS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={config.style === item.id ? 'is-on' : undefined}
              onClick={() => onConfigChange({ style: item.id })}
            >
              <span className="cp-studio-pro__style-art" aria-hidden />
              <b>{item.label}</b>
              <small>{item.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <label className="cp-studio-pro__field">
        <span>Ngôn ngữ</span>
        <select
          value={config.language}
          disabled={!draftLanguageWritable(draft)}
          onChange={(event) => onConfigChange({ language: event.target.value })}
        >
          <option value="vi-VN">Tiếng Việt</option>
          <option value="en-US">English</option>
        </select>
      </label>

      <label className="cp-studio-pro__field">
        <span>Giọng đọc</span>
        <select
          value={voiceValue}
          disabled={!draftLanguageWritable(draft)}
          onChange={(event) => {
            const next = parseVoicePreset(event.target.value);
            onConfigChange({ language: next.locale, voice_id: next.voice });
          }}
        >
          {voiceOptions.map((item) => (
            <option key={voicePresetValue(item.locale, item.voice)} value={voicePresetValue(item.locale, item.voice)}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="cp-studio-pro__field">
        <span>Nhạc nền</span>
        <select value={config.music} onChange={(event) => onConfigChange({ music: event.target.value })}>
          {musicOptions.map((item) => (
            <option key={item.id || 'none'} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>

      <label className="cp-studio-pro__field">
        <span>Model</span>
        <select value={config.model_id} onChange={(event) => onConfigChange({ model_id: event.target.value })}>
          {models.map((model) => (
            <option key={model.id} value={model.id}>{model.label}</option>
          ))}
        </select>
      </label>

      <label className="cp-studio-pro__field">
        <span>Brand Kit</span>
        <select value={kitId} onChange={(event) => onKitChange(event.target.value)}>
          <option value="">Chưa chọn kit</option>
          {kits.map((kit) => (
            <option key={kit.id} value={kit.id}>{formatKitOption(kit)}</option>
          ))}
        </select>
      </label>

      {palette.length ? (
        <div className="cp-studio-pro__field">
          <span>Màu thương hiệu</span>
          <ul className="cp-studio-pro__colors">
            {palette.map((color) => (
              <li key={color}>
                <span className="cp-studio-pro__swatch" style={{ background: color }} aria-hidden />
                <code>{color}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="cp-studio-pro__estimate">
        <p>{estimate}</p>
        <small>Credit thật ghi sau reserve — không điền số giả.</small>
      </div>

      <ul className="cp-studio-pro__gates">
        {gates.map((gate) => (
          <li key={gate.id} className={gate.ok ? 'is-ok' : 'is-block'}>
            <span>{gate.ok ? 'OK' : 'Chặn'} · {gate.label}</span>
            <small>{gate.hint}</small>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="cp-studio-pro__cta"
        disabled={disabled || rendering || blocked}
        onClick={onSubmit}
      >
        {rendering ? 'Đang gửi render…' : 'Tạo video'}
      </button>
      {blocked ? (
        <p className="cp-studio-pro__meta">Sửa các gate bị chặn trước khi reserve render.</p>
      ) : null}
    </section>
  );
}
