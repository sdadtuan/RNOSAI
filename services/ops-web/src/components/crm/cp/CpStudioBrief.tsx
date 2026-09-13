'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CpAsset, CpVideoInputMode } from '@/lib/crm/cp-api';
import {
  appendPromptSuggestion,
  formatCharCount,
  mediaLibraryHref,
  promptMaxChars,
  promptSuggestionTags,
  removeStudioAsset,
  type StudioAssets,
  type StudioConfig,
  urlFieldState,
} from '@/lib/crm/cp-video-studio.util';
import { CpSignedAssetPlayer } from './CpSignedAssetPlayer';

function modeLabel(mode: CpVideoInputMode): string {
  if (mode === 'script') return 'Kịch bản';
  if (mode === 'url') return 'URL sản phẩm';
  return 'Prompt';
}

export function CpStudioBrief({
  mode,
  onModeChange,
  name,
  onNameChange,
  content,
  onContentChange,
  config,
  onConfigChange,
  assets,
  projectAssets,
  onAssetsChange,
  playbookId,
  settings,
  projectId,
  scope,
  disabled,
}: {
  mode: CpVideoInputMode;
  onModeChange: (mode: CpVideoInputMode) => void;
  name: string;
  onNameChange: (value: string) => void;
  content: string;
  onContentChange: (value: string) => void;
  config: StudioConfig;
  onConfigChange: (patch: Partial<StudioConfig>) => void;
  assets: StudioAssets;
  projectAssets: CpAsset[];
  onAssetsChange: (assets: StudioAssets) => void;
  playbookId: string | null;
  settings: { policy_json?: Record<string, unknown> | null } | null;
  projectId: string | null | undefined;
  scope: string;
  disabled?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState<'reference' | 'logo' | null>(null);
  const maxChars = promptMaxChars(settings?.policy_json);
  const urlState = urlFieldState(settings);
  const tags = useMemo(() => promptSuggestionTags(playbookId), [playbookId]);
  const imported = useMemo(() => {
    const map = new Map(projectAssets.map((asset) => [asset.id, asset]));
    const rows: Array<{ id: string; asset: CpAsset; role: 'reference' | 'logo' }> = [];
    for (const id of assets.reference_ids) {
      const asset = map.get(id);
      if (asset) rows.push({ id, asset, role: 'reference' });
    }
    if (assets.logo_id) {
      const asset = map.get(assets.logo_id);
      if (asset) rows.push({ id: assets.logo_id, asset, role: 'logo' });
    }
    return rows;
  }, [assets, projectAssets]);

  const pickerAssets = useMemo(() => {
    if (pickerOpen === 'logo') {
      return projectAssets.filter((asset) => asset.mime.startsWith('image/'));
    }
    return projectAssets.filter(
      (asset) => asset.mime.startsWith('image/') || asset.mime.startsWith('video/'),
    );
  }, [pickerOpen, projectAssets]);

  function pickAsset(assetId: string) {
    if (pickerOpen === 'logo') {
      onAssetsChange({
        ...assets,
        logo_id: assetId,
        reference_ids: assets.reference_ids.filter((item) => item !== assetId),
      });
    } else {
      onAssetsChange({
        ...assets,
        reference_ids: assets.reference_ids.includes(assetId)
          ? assets.reference_ids
          : [...assets.reference_ids, assetId],
      });
    }
    setPickerOpen(null);
  }

  return (
    <section className="cp-studio-pro__panel">
      <header className="cp-studio-pro__panel-head">
        <span className="cp-studio-pro__step">1</span>
        <div>
          <h2>Ý tưởng &amp; kịch bản</h2>
          <p>Nhập brief, gợi ý prompt và asset tham chiếu.</p>
        </div>
      </header>

      <div className="cp-studio-pro__tabs" role="tablist" aria-label="Nguồn brief">
        {(['prompt', 'script', 'url'] as CpVideoInputMode[]).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            className={mode === item ? 'is-on' : undefined}
            onClick={() => onModeChange(item)}
          >
            {modeLabel(item)}
          </button>
        ))}
      </div>

      <label className="cp-studio-pro__field">
        <span>Tên clip</span>
        <input value={name} disabled={disabled} onChange={(event) => onNameChange(event.target.value)} />
      </label>

      <label className="cp-studio-pro__field">
        <span>{mode === 'script' ? 'Kịch bản' : mode === 'url' ? 'URL sản phẩm' : 'Prompt chuyển động'}</span>
        <textarea
          rows={7}
          value={content}
          disabled={disabled || (mode === 'url' && urlState.disabled)}
          placeholder={
            mode === 'url'
              ? 'Dán URL landing / bài viết sản phẩm'
              : mode === 'script'
                ? 'Hook · scene · VO · overlay · CTA'
                : 'Ví dụ: Video 30s căn hộ cao cấp, ánh hoàng hôn, CTA đăng ký tour.'
          }
          onChange={(event) => onContentChange(event.target.value)}
        />
      </label>
      <p className="cp-studio-pro__meta">
        {formatCharCount(content.length, maxChars)} ký tự · kiểm duyệt trước khi render
      </p>
      {mode === 'url' && urlState.reason ? <p className="cp-studio-pro__meta">{urlState.reason}</p> : null}

      <div className="cp-studio-pro__suggest">
        <div className="cp-studio-pro__suggest-head">
          <b>Gợi ý prompt</b>
          <button
            type="button"
            className="cp-studio-pro__link"
            onClick={() => onContentChange('')}
          >
            Làm mới
          </button>
        </div>
        <div className="cp-studio-pro__chips">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="cp-studio-pro__chip"
              onClick={() => onContentChange(appendPromptSuggestion(content, tag))}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <label className="cp-studio-pro__toggle">
        <input
          type="checkbox"
          checked={config.auto_script}
          disabled={disabled}
          onChange={(event) => onConfigChange({ auto_script: event.target.checked })}
        />
        <span>Tự tạo kịch bản (hook, scene, VO, overlay, CTA)</span>
      </label>

      <div className="cp-studio-pro__uploads">
        <button type="button" className="cp-studio-pro__upload" onClick={() => setPickerOpen('reference')}>
          <strong>Ảnh / video tham chiếu</strong>
          <span>Chọn từ thư viện dự án</span>
        </button>
        <button type="button" className="cp-studio-pro__upload" onClick={() => setPickerOpen('logo')}>
          <strong>Logo thương hiệu</strong>
          <span>PNG / SVG Ready</span>
        </button>
      </div>

      <div className="cp-studio-pro__import-head">
        <b>Đã nhập ({imported.length})</b>
        <Link className="cp-studio-pro__link" href={mediaLibraryHref(projectId, scope, 'ingest')}>
          Upload mới
        </Link>
      </div>

      {imported.length ? (
        <ul className="cp-studio-pro__import-list">
          {imported.map(({ id, asset, role }) => (
            <li key={`${role}-${id}`}>
              <div className="cp-studio-pro__import-thumb">
                <CpSignedAssetPlayer assetId={asset.id} mime={asset.mime} scope={scope as 'me'} compact />
              </div>
              <div className="cp-studio-pro__import-meta">
                <b>{asset.filename}</b>
                <span>{role === 'logo' ? 'Logo' : 'Tham chiếu'} · {asset.state}</span>
              </div>
              <button
                type="button"
                className="cp-studio-pro__icon-btn"
                aria-label={`Gỡ ${asset.filename}`}
                onClick={() => onAssetsChange(removeStudioAsset(assets, id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cp-studio-pro__meta">Chưa gắn asset. Chọn từ thư viện hoặc upload.</p>
      )}

      {pickerOpen ? (
        <div className="cp-studio-pro__picker" role="dialog" aria-label="Chọn asset">
          <header>
            <b>{pickerOpen === 'logo' ? 'Chọn logo' : 'Chọn ảnh / video tham chiếu'}</b>
            <button type="button" className="cp-studio-pro__icon-btn" onClick={() => setPickerOpen(null)}>×</button>
          </header>
          {pickerAssets.length ? (
            <ul>
              {pickerAssets.map((asset) => (
                <li key={asset.id}>
                  <button type="button" onClick={() => pickAsset(asset.id)}>
                    <span className="cp-studio-pro__import-thumb">
                      <CpSignedAssetPlayer assetId={asset.id} mime={asset.mime} scope={scope as 'me'} compact />
                    </span>
                    <span>
                      <b>{asset.filename}</b>
                      <small>{asset.mime} · {asset.state}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cp-studio-pro__meta">
              Chưa có asset phù hợp.
              {' '}
              <Link href={mediaLibraryHref(projectId, scope, 'ingest')}>Mở thư viện</Link>
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
